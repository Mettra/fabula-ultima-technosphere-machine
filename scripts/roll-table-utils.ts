// Roll table functionality and custom rolling logic

import { Log } from "./core-config.js";
import { extractKVPairsFromLines, extractParagraphsAsLines } from "./parsing-utils.js";

export async function getDocumentFromResult(result: any): Promise<any | null> {
    let pack;
    if ( result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM ) {
        pack = game.packs.get(result.documentCollection);
    }

    const id = result.documentId;
    return pack ? await pack.getDocument(id) : game.tables.get(id);
}

interface RollOptions {
    roll?: any;
    existingSphere?: any;
    recursive?: boolean;
    _depth?: number;
}

export async function rollTableCustom(rollTable: any, options: RollOptions = {}): Promise<{roll: any, results: any[]}> {
    let {roll, existingSphere = null, recursive = true, _depth = 0} = options;
    if ( _depth > 10 ) {
        throw new Error(`Maximum recursion depth exceeded when attempting to draw from RollTable ${rollTable.id}`);
    }

    if ( !rollTable.formula ) {
        await rollTable.normalize();
    }

    roll = roll instanceof Roll ? roll : Roll.create(rollTable.formula);
    let results = [];

    // Custom rules processing from the RollTable description
    const paragraphs = extractParagraphsAsLines(rollTable.description)
    const lines = extractKVPairsFromLines(paragraphs)
    for(let kv of lines) {
        if(kv.key == "Start") {
            if(existingSphere == null) continue

            const abilityName = kv.value
            Log(`START Rule - Have we already picked ${abilityName}?`, existingSphere.rollTable)

            if(existingSphere.rollTable.find(v => { return v.name == abilityName })) {
                continue
            }

            Log(`START Rule - Force set roll`)

            rollTable.results.forEach(res => { 
                if(res.text == kv.value) { 
                    roll = Roll.create(res.range[0].toString()) 
                } 
            })
        }
    }

    // Ensure that at least one non-drawn result remains
    const available = rollTable.results.filter(r => !r.drawn);
    if ( !available.length ) {
        ui.notifications.warn(game.i18n.localize("TABLE.NoAvailableResults"));
        return {roll, results};
    }

    // Ensure that results are available within the range
    const minRoll = (await roll.reroll({minimize: true})).total;
    const maxRoll = (await roll.reroll({maximize: true})).total;
    const availableRange = available.reduce((range, result) => {
        const r = result.range;
        if ( !range[0] || (r[0] < range[0]) ) range[0] = r[0];
        if ( !range[1] || (r[1] > range[1]) ) range[1] = r[1];
        return range;
    }, [null, null]);

    if ( (availableRange[0] > maxRoll) || (availableRange[1] < minRoll) ) {
        ui.notifications.warn("No results can possibly be drawn from this table and formula.");
        return {roll, results};
    }

    // Continue rolling until one or more results are recovered
    let iter = 0;
    while ( !results.length ) {
        if ( iter >= 10000 ) {
            ui.notifications.error(`Failed to draw an available entry from Table ${rollTable.name}, maximum iteration reached`);
            break;
        }
        roll = await roll.reroll();
        results = rollTable.getResultsForRoll(roll.total);
        for ( let result of results ) {
            result.chain = []
        }
        iter++;
    }

    // Draw results recursively from any inner Roll Tables
    if ( recursive ) {
        let innerResults = [];
        for ( let result of results ) {
            let documentName;
            if ( result.type === CONST.TABLE_RESULT_TYPES.DOCUMENT ) documentName = result.documentCollection;

            if ( documentName === "RollTable" ) {
                const innerTable = await getDocumentFromResult(result)
                if (innerTable) {
                    const innerRoll = await rollTableCustom(innerTable, {_depth: _depth + 1, existingSphere: existingSphere});
                    for(let res of innerRoll.results) {
                        res.chain.push(result.text)
                    }
                    innerResults = innerResults.concat(innerRoll.results);
                }
            }
            else { 
                innerResults.push(result);
            }
        }
        results = innerResults;
    }

    return { roll, results };
}
