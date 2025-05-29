///<reference path="../.jsinclude/foundry.js"/>

const ModuleName = "fabula-ultima-technosphere-machine"
function getEventName(name) {
    return `${ModuleName}.${name}`
}

const SYSTEM = 'projectfu';

CONFIG.debug.hooks = true

if (CONFIG.debug.hooks) var Log = console.log.bind(window.console)
else var Log = function(){}

const LinkRegex = /^@UUID\[(.+)\]\{(.+)\}$/;
function parseUUIDLink(linkText) {
    let results = LinkRegex.exec(linkText)
    return { uuid: results[1], name: results[2] }
}

function UUIDLink(link) {
    return `@UUID[${link.uuid}]{${link.name}}`
}

function splitArray(array, predicate) {
    let first_half = true
    return array.reduce((acc, element, index) => {
        if (first_half) {
            if(predicate(element)) {
                first_half = false
                return acc
            }

            acc[0].push(element);
        } else {
            acc[1].push(element);
        }
      return acc;
    }, [[], []]);
  }

function getCharacter() {
    const character = canvas.tokens.controlled.at(0)?.document.actor || game.user.character;
    return character
}

function getFlag(sheet, flagName) {
    try {
        return sheet.document.getFlag(ModuleName, flagName);
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

const MEMNOSPHERE_SPLIT_KEY = "@ROLLTABLE"

class Memnosphere {
    constructor(config={}){
        this.abilities = []
        this.rollTable = []
        this.class = { uuid: "", name: "" }
        Object.assign(this,config);
    }

    static extractFromItem(item) {
        
        let result = new Memnosphere()

        let description = item.system.description
        let lines = extractParagraphsAsLines(description)
        lines = extractKVPairsFromLines(lines)

        const classLine = lines.pop()
        result.class = parseUUIDLink(classLine.key)

        const [abilitiesKV, rolltableKV] = splitArray(lines, kv => kv.key == MEMNOSPHERE_SPLIT_KEY)

        for(let kv of abilitiesKV) {
            let link = parseUUIDLink(kv.key)
            result.abilities.push({uuid: link.uuid, name: link.name, rank: parseInt(kv.value)})
        }

        for(let kv of rolltableKV) {
            result.rollTable.push({name: kv.key, count: parseInt(kv.value)})
        }

        return result
    }

    static mergeArray(arrayBase, arrayToMerge, findFn, mergeFn) {
        const mergedArray = [...arrayBase];

        arrayToMerge.forEach(v => {
            const existingIndex = mergedArray.findIndex(fV => findFn(v, fV));
            if (existingIndex !== -1) {
                mergeFn(mergedArray[existingIndex], v)
            } else {
                mergedArray.push(v);
            }
        });

        return mergedArray
    }

    static mergeAbilities(bAbilities, mAbilities) {
        return this.mergeArray(bAbilities, mAbilities, (b, v) => b.uuid == v.uuid, (b, v) => {
            b.rank += v.rank
        })
    }

    static mergeRollTable(bRollTable, mRollTable) {
        return this.mergeArray(bRollTable, mRollTable, (b, v) => b.name == v.name, (b, v) => {
            b.count += v.count
        })
    }

    static merge(sphere_base, sphere_merge) {
        if(sphere_base.class.uuid != sphere_merge.class.uuid) {
            ui.notifications.error(`You cannot merge memnospheres unless they have the same class! ${sphere_base.class.uuid} != ${sphere_merge.class.uuid}`);
            return
        }

        const mergedRollTable = Memnosphere.mergeRollTable(sphere_base.rollTable, sphere_merge.rollTable)
        const mergedAbilities = Memnosphere.mergeAbilities(sphere_base.abilities, sphere_merge.abilities)
        return new Memnosphere({abilities: mergedAbilities, rollTable : mergedRollTable, class: sphere_base.class });
    }

    createDescription() {
        let description = ""

        for(let ability of this.abilities) {
            description += `<p>${UUIDLink(ability)} :: ${ability.rank}</p>`
        }

        description += `<p>${MEMNOSPHERE_SPLIT_KEY} :: 0</p>`

        for(let tbl of this.rollTable) {
            description += `<p>${tbl.name} :: ${tbl.count}</p>`
        }

        description += `<p>${UUIDLink(this.class)} :: 0</p>`

        return description
    }

    async createItem() {
        const itemData = {
            name: "Memnosphere",
            type: "basic",
            system: {
                description: this.createDescription()
            },
        };
        let item = await Item.create(itemData);
        return item
    }
}

async function getDocumentFromResult(result) {
    let pack;
    if ( result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM ) {
        pack = game.packs.get(result.documentCollection);
    }

    const id = result.documentId;
    return pack ? await pack.getDocument(id) : game.tables.get(id);
}

async function rollTableCustom(rollTable, {roll, existingSphere=null, recursive=true, _depth=0}={}) {
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
            if(existingSphere == null) continue

            const abilityName = kv.value
            Log(`START Rule - Have we already picked ${abilityName}?`, existingSphere.rollTable)

            // If we already have this starting ability, then we don't need to do anything 
            if(existingSphere.rollTable.find(v => { return v.name == abilityName })) {
                continue
            }

            Log(`START Rule - Force set roll`)

            // Otherwise, find the matching ability and force set the dice to roll that entry
            rollTable.results.forEach(res => { if(res.text == kv.value) { roll = Roll.create(res.range[0].toString()) } })
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
        for ( let result of results ) {
            result.chain = []
        }

        iter++;
    }

    // Draw results recursively from any inner Roll Tables
    if ( recursive ) {
        let inner = [];
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
                    inner = inner.concat(innerRoll.results);
                }
            }
            else { 
                inner.push(result);
            }
        }
        results = inner;
    }

    // Return the Roll and the results
    return { roll, results };
}

const MEMNOSPHERE_ROLL_COST = 500

async function rollMemnosphere({rollTableUUID, actorUUID, existingSphereUUID}) {
    let actor = fromUuidSync(actorUUID)
    if(actor == null) {
        ui.notifications.error(`You must have an actor selected, or have chosen one to be your player character.`);
        return
    }

    // Check and pay the cost to roll
    const current = actor.system.resources.zenit.value;
    if(current < MEMNOSPHERE_ROLL_COST) {
        ui.notifications.error(`You must have at least ${MEMNOSPHERE_ROLL_COST} ${game.i18n.localize('FU.Zenit')} to create a new Memnosphere.`);
        return
    }
    actor.update({'system.resources.zenit.value' : current - MEMNOSPHERE_ROLL_COST})


    let sphereItem = null
    let sphere = null
    if(existingSphereUUID) {
        sphereItem = fromUuidSync(existingSphereUUID)
        if(sphereItem == null) {
            ui.notifications.error(`Please provide a valid item UUID, or no UUID at all.`);
            return
        }

        sphere = Memnosphere.extractFromItem(sphereItem)
        Log("Existing Sphere - ", sphere)
    }


    // If we are rolling a brand new sphere, we first need to determine the class
    if(sphereItem == null) {
        let rollTable = fromUuidSync(rollTableUUID)
        let tableRoll = await rollTableCustom(rollTable, {recursive: false})
        Log("Class Memosphere Roll", tableRoll)

        if(tableRoll.results.length != 1) {
            ui.notifications.error(`The base memnosphere RollTable must only have one entry per possible result!`);
            return
        }

        let classResult = tableRoll.results[0]
        let doc = await getDocumentFromResult(classResult)

        sphere = new Memnosphere({ class: { uuid: doc.uuid, name: classResult.text }})
        sphereItem = await sphere.createItem()
        Log("New Sphere", sphere, sphereItem)
    }
    
    // Roll the memnosphere!
    let classAbilityTable = fromUuidSync(sphere.class.uuid)
    if(classAbilityTable == null) {
        ui.notifications.error(`Memnosphere ${existingSphereUUID} has an invalid class table reference!`);
        return
    }

    let abilityRoll = await rollTableCustom(classAbilityTable, {existingSphere: sphere})
    Log("abilityRoll", abilityRoll)

    let abilities = []
    let resultTables = {}
    for(let result of abilityRoll.results) {
        let doc = await game.packs.get(result.documentCollection).getDocument(result.documentId)
        abilities.push({uuid: doc.uuid, name: result.text, rank: 1})

        for(let chain of result.chain) {
            if(resultTables[chain]) {
                resultTables[chain] += 1
            }
            else {
                resultTables[chain] = 1
            }
        }
    }
    Log("Abilities", abilities)

    let rollTables = []
    for(let k in resultTables) {
        rollTables.push({name: k, count: resultTables[k]})
    }
    Log("Rolltables", rollTables)

    let newSphere = new Memnosphere({abilities : abilities, rollTable : rollTables, class: sphere.class})

    // Merge the abilities with existing sphere
    const mergedMemnosphere = Memnosphere.merge(sphere, newSphere)
    Log(mergedMemnosphere)

    await sphereItem.update({system: {description: mergedMemnosphere.createDescription() } })
}


function socketFn(callable) {
    return (request, ack) => {
        Log("Socket", request)
        if (!!request.user && game.userId !== request.user) return;

        const response = callable(...request)
        ack(response)
        socket.broadcast.emit(eventName, response);
    }
}

//CONFIG.queries[getEventName("rollMemnosphere")] = rollMemnosphere;

function bindNameToFlag(sheet, html, name, flag) {
    html.on(`change`, `input[name="${name}"]`, async (event) => {
        await sheet.document.setFlag(ModuleName, flag, event.target.value)
    })
}

Hooks.on(`renderFUPartySheet`, async (sheet, /** @type {jQuery} */ html) => {
    const FLAG_ROLLTABLE = 'technosphere-roll-table'
    const FLAG_EXISTINGSPHERE = 'technosphere-existing-sphere'

    // Add button
    html.find(".sheet-tabs").append(
        `<a class="button button-style" data-tab="technosphere-machine"><i class="icon ra ra-sapphire"></i>Technosphere</a>`
    )

    // Add content
    let tsSection = await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/technosphere-section.hbs", 
        {
            rollableTable: getFlag(sheet, FLAG_ROLLTABLE),
            existingSphere: getFlag(sheet, FLAG_EXISTINGSPHERE),
        }
    )
    html.find(".sheet-body").append(tsSection)

    bindNameToFlag(sheet, html, 'ts-sphere-table', FLAG_ROLLTABLE)
    bindNameToFlag(sheet, html, 'ts-existingSphere', FLAG_EXISTINGSPHERE)
    

    html.find('.technosphere-roll').unbind('click').bind('click', async (event) => {
        const gm = game.users.activeGM;
        let query = {
            rollTableUUID: getFlag(sheet, FLAG_ROLLTABLE),
            actorUUID: getCharacter().uuid,
            existingSphereUUID: getFlag(sheet, FLAG_EXISTINGSPHERE),
           // user: gm.id
        }

        await rollMemnosphere(query)

        return false

        //game.socket.emit(getEventName("rollMemnosphere"), query)
        //Log("rollMemnosphere")

        //await user.query(getEventName("rollMemnosphere"), query, { timeout: 30 * 1000 });
    });


    // Can we use rollable tables?
    // Does a good job at weighting, and subtables are a great way to roll classes/spells
    // Overlapping results for descriptions is a little strange, but works (but not well with weights)
    // No ability to do special logic:
    //  - Some classes need to be able to roll a starting ability

    Log("Done!")
})


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
    Log("Old items", old_items)
    await actor.deleteEmbeddedDocuments("Item", old_items);

    Log("Deleted Items!")
    
    // Now gather all of the classes and abilities from the base sheet
    const updates = [];
    for(const item of baseActor.items){
        if(!isTechnosphereItemType(item)) continue;
        updates.push(item.toJSON());
    }
    Log("Updates", updates)

    // @TODO: Combine base features with technosphere features


    // Apply the update to the actor
    await actor.createEmbeddedDocuments('Item', updates)
}

Hooks.on(`renderFUStandardActorSheet`, async (sheet, /** @type {jQuery} */ html) => {
    const FLAG_BASESHEET = 'technosphere-base-sheet'

    let settings = html.find(`.settings`)
    settings.prepend(await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/technosphere-settings.hbs", 
        {
            baseSheet: getFlag(sheet, FLAG_BASESHEET),
        }
    ))

    bindNameToFlag(sheet, html, 'ts-baseSheet', FLAG_BASESHEET)

    html.find('.technosphere-apply').unbind('click').bind('click', async event => {
        event.target.disabled = true

        try {
            const baseSheet = fromUuidSync(getFlag(sheet, FLAG_BASESHEET));
            const actor = sheet.object
            await recomputeTechnosphereSheet(actor, baseSheet)
        } catch(error) {
            console.error(error)
        } finally {
            event.target.disabled = false
            Log("Done!")
        }
    });

})


Hooks.once("init", () => {
    game.socket.on(getEventName("rollMemnosphere"), socketFn(rollMemnosphere))
})