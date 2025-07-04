// Roll table functionality and custom rolling logic

import { ensureGM, Log, ModuleName } from "./core-config.js";
import {
    extractKVPairsFromLines,
    extractParagraphsAsLines,
} from "./parsing-utils.js";
import { FLAG_ADD_SKILL, FLAG_FORCE_RESULT } from "./roll-table/roll-table.js";
import { getTSFlag } from "./utils/foundry-utils.js";
import { getUUIDFromLink } from "./uuid-utils.js";

export async function getDocumentFromResult(result: any): Promise<any | null> {
    let pack;
    if (result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM) {
        pack = game.packs.get(result.documentCollection);
    }

    const id = result.documentId;
    return pack ? await pack.getDocument(id) : game.tables.get(id);
}

interface RollOptions {
    roll?: any;
    initialAbility?: boolean;
    recursive?: boolean;
    _depth?: number;
}

export async function rollTableCustom(
    rollTable: any,
    options: RollOptions = {}
): Promise<{ roll: any; results: any[] }> {
    let {
        roll,
        initialAbility = false,
        recursive = true,
        _depth = 0,
    } = options;
    if (_depth > 10) {
        throw new Error(
            `Maximum recursion depth exceeded when attempting to draw from RollTable ${rollTable.id}`
        );
    }

    if (!rollTable.formula) {
        await rollTable.normalize();
    }

    roll = roll instanceof Roll ? roll : Roll.create(rollTable.formula);
    let extra_results = [];

    // Custom rules processing from flags
    const forceResult = getTSFlag(rollTable, "mnemosphere-rolltable-force");
    if (initialAbility && forceResult) {
        Log(`Force Start Rule - Force set roll to result: ${forceResult}`);
        const result = rollTable.results.find(
            (res) => res.text === forceResult
        );
        if (result && result.range.length > 0) {
            roll = Roll.create(result.range[0].toString());
        }
    }

    const addSkillUUID = getTSFlag(rollTable, "mnemosphere-rolltable-skill");
    if (addSkillUUID) {
        let doc = await fromUuid(addSkillUUID);
        if (doc) {
            extra_results.push({
                documentId: doc.id,
                documentCollection: doc.pack,
                type: doc.pack ? CONST.TABLE_RESULT_TYPES.COMPENDIUM : null,
                text: doc.name,
            });
        }
    }

    // Ensure that at least one non-drawn result remains
    let results = [];
    const available = rollTable.results.filter((r) => !r.drawn);
    if (!available.length) {
        ui.notifications.warn(game.i18n.localize("TABLE.NoAvailableResults"));
        return { roll, results };
    }

    // Ensure that results are available within the range
    const minRoll = (await roll.reroll({ minimize: true })).total;
    const maxRoll = (await roll.reroll({ maximize: true })).total;
    const availableRange = available.reduce(
        (range, result) => {
            const r = result.range;
            if (!range[0] || r[0] < range[0]) range[0] = r[0];
            if (!range[1] || r[1] > range[1]) range[1] = r[1];
            return range;
        },
        [null, null]
    );

    if (availableRange[0] > maxRoll || availableRange[1] < minRoll) {
        ui.notifications.warn(
            "No results can possibly be drawn from this table and formula."
        );
        return { roll, results };
    }

    // Continue rolling until one or more results are recovered
    let iter = 0;
    while (!results.length) {
        if (iter >= 10000) {
            ui.notifications.error(
                `Failed to draw an available entry from Table ${rollTable.name}, maximum iteration reached`
            );
            break;
        }
        roll = await roll.reroll();

        let rollResults = rollTable.getResultsForRoll(roll.total);
        results.push(...rollResults);
        iter++;
    }

    // Draw results recursively from any inner Roll Tables
    if (recursive) {
        let innerResults = [];
        for (let result of results) {
            let pack;
            let documentName;
            if (result.type === CONST.TABLE_RESULT_TYPES.DOCUMENT)
                documentName = result.documentCollection;
            else if (result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM) {
                pack = game.packs.get(result.documentCollection);
                documentName = pack?.documentName;
            }
            if (documentName === "RollTable") {
                const id = result.documentId;
                const innerTable = pack
                    ? await pack.getDocument(id)
                    : game.tables.get(id);
                if (innerTable) {
                    const innerRoll = await rollTableCustom(innerTable, {
                        _depth: _depth + 1,
                        initialAbility: initialAbility,
                    });
                    innerResults = innerResults.concat(innerRoll.results);
                }
            } else innerResults.push(result);
        }
        results = innerResults;
    }

    results = results.concat(extra_results);

    return { roll, results };
}

/**
 * Migrates custom rules from a RollTable's description to flags.
 * After migration, the description is cleared.
 * @param {RollTable} rollTable The RollTable document to migrate.
 */
export async function migrateRollTableDescriptionToFlags(rollTable: RollTable) {
    const description = rollTable.description;
    if (!description || description.trim().length === 0) {
        return false;
    }

    const lines = extractParagraphsAsLines(description);
    const rules = extractKVPairsFromLines(lines);

    if (rules.length === 0) {
        return false;
    }

    const updateData = {};
    let changesMade = false;

    rules.forEach((rule) => {
        if (rule.key.toLowerCase() == "start") {
            const forceResult = rule.value;
            if (forceResult) {
                updateData[`flags.${ModuleName}.${FLAG_FORCE_RESULT}`] =
                    forceResult;
                changesMade = true;
            }
        } else if (rule.key.toLowerCase() == "add") {
            const uuidLink = rule.value;
            const uuid = getUUIDFromLink(uuidLink);
            if (uuid) {
                updateData[`flags.${ModuleName}.${FLAG_ADD_SKILL}`] = uuid;
                changesMade = true;
            }
        }
    });

    if (!changesMade) {
        return false;
    }

    // If any rules were migrated, clear the description and update the document
    updateData["description"] = "";
    Log(
        `Migrating rules from description to flags for RollTable: ${rollTable.name}`
    );

    ensureGM();
    await rollTable.update(updateData);
    return true;
}
