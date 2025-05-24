///<reference path="../.jsinclude/foundry.js"/>

const ModuleName = "fabula-ultima-technosphere-machine"
const SYSTEM = 'projectfu';

CONFIG.debug.hooks = true

function getSphereTable(sheet) {
    try {
        return sheet.document.getFlag(ModuleName, 'technosphere-roll-table');
    } catch(err) {
        return null
    }
}

function extractParagraphsAsLines(description) {
    let extractedLines = []

    let lines = description.split("<p>")
    const pTagEnd = "</p>"
    for(let line of lines) {
        if(!line.endsWith(pTagEnd)) {
            continue;
        }

        let lineText = line.substring(0, line.length - pTagEnd.length)
        extractedLines.push(lineText)
    }

    return extractedLines
}

function extractKVPairsFromLines(lines) {
    let extractedLines = []
    for(let lineText of lines) {
        let values = lineText.split(" :: ")
        if(values.length != 2) {
            continue;
        }

        extractedLines.push({key: values[0], value: values[1]})
    }

    return extractedLines
}

async function rollTableCustom(rollTable, {roll, recursive=true, _depth=0}={}) {
    // Prevent excessive recursion
    if ( _depth > 10 ) {
      throw new Error(`Maximum recursion depth exceeded when attempting to draw from RollTable ${rollTable.id}`);
    }

    // If there is no formula, automatically calculate an even distribution
    if ( !rollTable.formula ) {
      await rollTable.normalize();
    }

    // Reference the provided roll formula
    roll = roll instanceof Roll ? roll : Roll.create(rollTable.formula);
    let results = [];

    // See if we have custom rules
    let lines = extractParagraphsAsLines(rollTable.description)
    lines = extractKVPairsFromLines(lines)
    for(let kv of lines) {
        if(kv.key == "Start") {
            for(let res of rollTable.results) {
                if(res.text == kv.value) {
                    // Force set the roll to ensure this entry
                    roll = Roll.create(res.range[0].toString())
                }
            }
        }
    }

    // Ensure that at least one non-drawn result remains
    const available = rollTable.results.filter(r => !r.drawn);
    if ( !available.length ) {
      ui.notifications.warn(game.i18n.localize("TABLE.NoAvailableResults"));
      return {roll, results};
    }

    // Ensure that results are available within the minimum/maximum range
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
      iter++;
    }

    // Draw results recursively from any inner Roll Tables
    if ( recursive ) {
      let inner = [];
      for ( let result of results ) {
        let pack;
        let documentName;
        if ( result.type === CONST.TABLE_RESULT_TYPES.DOCUMENT ) documentName = result.documentCollection;
        else if ( result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM ) {
          pack = game.packs.get(result.documentCollection);
          documentName = pack?.documentName;
        }


        if ( documentName === "RollTable" ) {
          const id = result.documentId;
          const innerTable = pack ? await pack.getDocument(id) : game.tables.get(id);
          if (innerTable) {
            const innerRoll = await rollTableCustom(innerTable, {_depth: _depth + 1});
            inner = inner.concat(innerRoll.results);
          }
        }
        else inner.push(result);
      }
      results = inner;
    }

    // Return the Roll and the results
    return { roll, results };
  }

Hooks.on(`renderFUPartySheet`, async (sheet, /** @type {jQuery} */ html) => {
    // Add button
    html.find(".sheet-tabs").append(
        `<a class="button button-style" data-tab="technosphere-machine"><i class="icon ra ra-sapphire"></i>Technosphere</a>`
    )

    // Add content
    let tableUUID = getSphereTable(sheet)
    let tsSection = await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/technosphere-section.hbs", {rollableTable: tableUUID})
    html.find(".sheet-body").append(tsSection)

    html.on(`change`, `input[name="ts-sphere-table"]`, async (event) => {
        await sheet.document.setFlag(ModuleName, 'technosphere-roll-table', event.target.value)
    })

    html.on('click', '.technosphere-roll', async (event) => {
        let tableUUID = getSphereTable(sheet)
        const rollTable = fromUuidSync(tableUUID);
        console.log(tableUUID)
        console.log(rollTable)

        let tableRoll = await rollTableCustom(rollTable)
        console.log(tableRoll)

        let description = ""
        for(let result of tableRoll.results) {
            let doc = await game.packs.get(result.documentCollection).getDocument(result.documentId)
            let rank = 1
            description += `<p>@UUID[${doc.uuid}]{${result.text}} :: ${rank}</p>`
        }

        const itemData = {
            name: "Technosphere",
            type: "basic",
            system: {
                description: description
            },
        };
        let item = await Item.create(itemData);
        console.log(item)
    });


    // Can we use rollable tables?
    // Does a good job at weighting, and subtables are a great way to roll classes/spells
    // Overlapping results for descriptions is a little strange, but works (but not well with weights)
    // No ability to do special logic:
    //  - Some classes need to be able to roll a starting ability

    console.log("Done!")
})


function getBaseSheet(actorSheet) {
    try {
        return actorSheet.document.getFlag(ModuleName, 'technosphere-base-sheet');
    } catch(err) {
        return null
    }
}


async function recomputeTechnosphereSheet(actor, baseActor) {
    function isTechnosphereItemType(item) {
        let type = item.type
        return type == "skill" || type == "class" || type == "spell"
    }

    // Gather and delete all of the technosphere influenced classes/abilities/etc 
    // So that we can evaluate from scratch
    const old_items = [];
    for(const item of actor.items) {
        if(!isTechnosphereItemType(item)) continue;

        old_items.push(item.id)
    }
    console.log("Old items", old_items)
    await actor.deleteEmbeddedDocuments("Item", old_items);

    console.log("Deleted Items!")
    
    // Now gather all of the classes and abilities from the base sheet
    const updates = [];
    for(const item of baseActor.items){
        if(!isTechnosphereItemType(item)) continue;
        updates.push(item.toJSON());
    }
    console.log("Updates", updates)

    // @TODO: Combine base features with technosphere features


    // Apply the update to the actor
    await actor.createEmbeddedDocuments('Item', updates)
}

Hooks.on(`renderFUStandardActorSheet`, async (actorSheet, /** @type {jQuery} */ html) => {
    let baseSheetUUID = getBaseSheet(actorSheet)

    let settings = html.find(`.settings`)
    let ts_settings = await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/technosphere-settings.hbs", {baseSheet: baseSheetUUID})
    settings.prepend(ts_settings)

    html.on(`change`, `input[name="ts-baseSheet"]`, async (event) => {
        await actorSheet.document.setFlag(ModuleName, 'technosphere-base-sheet', event.target.value)
    })

    html.on('click', '.technosphere-apply', async (event) => {
        event.target.disabled = true

        try {
            let baseSheetUUID = getBaseSheet(actorSheet)
            const resolvedModel = fromUuidSync(baseSheetUUID);
            console.log(resolvedModel.items)
            console.log(actorSheet)

            const actor = actorSheet.object
            await recomputeTechnosphereSheet(actor, resolvedModel)
        } catch(error) {
            console.error(error)
        } finally {
            event.target.disabled = false
            console.log("Done!")
        }
    });

})