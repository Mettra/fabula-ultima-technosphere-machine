///<reference path="../.jsinclude/foundry.js"/>

const ModuleName = "fabula-ultima-technosphere-machine"
/**
 * Generates a unique event name for the module.
 * @param {string} name - The base name of the event.
 * @returns {string} The full event name.
 */
function getEventName(name) {
    return `${ModuleName}.${name}`
}

const SYSTEM = 'projectfu';

CONFIG.debug.hooks = true

if (CONFIG.debug.hooks) var Log = console.log.bind(window.console)
else var Log = function(){}

const LinkRegex = /^@UUID\[(.+)\]\{(.+)\}$/;
/**
 * Parses a UUID link string into an object containing the UUID and the name.
 * @param {string} linkText - The UUID link string to parse.
 * @returns {{uuid: string, name: string}} An object with the UUID and name.
 */
function parseUUIDLink(linkText) {
    let results = LinkRegex.exec(linkText)
    return { uuid: results[1], name: results[2] }
}

/**
 * Creates a UUID link string from an object containing the UUID and name.
 * @param {{uuid: string, name: string}} link - An object with the UUID and name.
 * @returns {string} The formatted UUID link string.
 */
function UUIDLink(link) {
    return `@UUID[${link.uuid}]{${link.name}}`
}

/**
 * Splits an array into two halves based on a predicate function.
 * The first half contains elements until the predicate returns true, and the second half contains the rest.
 * @param {Array<any>} array - The array to split.
 * @param {function(any): boolean} predicate - The function to test each element.
 * @returns {Array<Array<any>>} A two-element array, where the first element is the first half and the second is the second half.
 */
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

/**
 * Gets the currently controlled character actor or the user's default character.
 * @returns {Actor|null} The character actor, or null if none is found.
 */
function getCharacter() {
    const character = canvas.tokens.controlled.at(0)?.document.actor || game.user.character;
    return character
}

/**
 * Retrieves a flag from a sheet's document.
 * @param {FormApplication} sheet - The sheet object.
 * @param {string} flagName - The name of the flag to retrieve.
 * @returns {any|null} The value of the flag, or null if an error occurs.
 */
function getFlag(sheet, flagName) {
    try {
        return sheet.document.getFlag(ModuleName, flagName);
    } catch(err) {
        return null
    }
}

/**
 * Extracts text content from HTML paragraphs as an array of lines.
 * It expects lines to be wrapped in `<p>` tags and end with `</p>`.
 * @param {string} description - The HTML string containing paragraphs.
 * @returns {string[]} An array of extracted text lines.
 */
function extractParagraphsAsLines(description) {
    let extractedLines = []

    let lines = description.split("<p>")
    const pTagEnd = "</p>"
    for(let line of lines) {
        // Ensure the line is a complete paragraph
        if(!line.endsWith(pTagEnd)) {
            continue;
        }

        // Remove the closing p tag
        let lineText = line.substring(0, line.length - pTagEnd.length)
        extractedLines.push(lineText)
    }

    return extractedLines
}

/**
 * Extracts key-value pairs from an array of lines, where each line is formatted as "key :: value".
 * @param {string[]} lines - An array of strings, each expected to be a key-value pair.
 * @returns {{key: string, value: string}[]} An array of objects, each with 'key' and 'value' properties.
 */
function extractKVPairsFromLines(lines) {
    let extractedLines = []
    for(let lineText of lines) {
        let values = lineText.split(" :: ")
        // Ensure the line has exactly two parts for key and value
        if(values.length != 2) {
            continue;
        }

        extractedLines.push({key: values[0], value: values[1]})
    }

    return extractedLines
}

const MEMNOSPHERE_SPLIT_KEY = "@ROLLTABLE"

/**
 * Represents a Memnosphere object, which stores abilities, roll table entries, and a class.
 */
class Memnosphere {
    /**
     * Creates an instance of Memnosphere.
     * @param {object} [config={}] - Configuration object to initialize Memnosphere properties.
     * @param {Array<{uuid: string, name: string, rank: number}>} [config.abilities=[]] - List of abilities.
     * @param {Array<{name: string, count: number}>} [config.rollTable=[]] - List of roll table entries.
     * @param {{uuid: string, name: string}} [config.class={uuid: "", name: ""}] - The associated class.
     */
    constructor(config={}){
        /** @type {Array<{uuid: string, name: string, rank: number}>} */
        this.abilities = []
        /** @type {Array<{name: string, count: number}>} */
        this.rollTable = []
        /** @type {{uuid: string, name: string}} */
        this.class = { uuid: "", name: "" }
        Object.assign(this,config);
    }

    /**
     * Extracts Memnosphere data from an item's description.
     * The description is expected to contain paragraphs with key-value pairs and specific markers.
     * @param {Item} item - The Foundry VTT Item object.
     * @returns {Memnosphere} A new Memnosphere instance populated with data from the item.
     */
    static extractFromItem(item) {
        
        let result = new Memnosphere()

        // Get the raw description and parse into lines
        let description = item.system.description
        let lines = extractParagraphsAsLines(description)
        // Convert lines into key-value pairs
        lines = extractKVPairsFromLines(lines)

        // The last line is expected to be the class information
        const classLine = lines.pop()
        result.class = parseUUIDLink(classLine.key)

        // Split the remaining lines into abilities and roll table entries based on a separator key
        const [abilitiesKV, rolltableKV] = splitArray(lines, kv => kv.key == MEMNOSPHERE_SPLIT_KEY)

        // Populate abilities
        for(let kv of abilitiesKV) {
            let link = parseUUIDLink(kv.key)
            result.abilities.push({uuid: link.uuid, name: link.name, rank: parseInt(kv.value)})
        }

        // Populate roll table entries
        for(let kv of rolltableKV) {
            result.rollTable.push({name: kv.key, count: parseInt(kv.value)})
        }

        return result
    }

    /**
     * Merges two arrays based on a find function and a merge function.
     * Elements present in the array to merge that also exist in the base array are updated; otherwise, they are added.
     * @param {Array<any>} arrayBase - The base array to merge into.
     * @param {Array<any>} arrayToMerge - The array whose elements will be merged into the base array.
     * @param {function(any, any): boolean} findFn - A function to determine if an element from `arrayToMerge` exists in `arrayBase`.
     * @param {function(any, any): void} mergeFn - A function to perform the merge operation on matching elements.
     * @returns {Array<any>} The new merged array.
     */
    static mergeArray(arrayBase, arrayToMerge, findFn, mergeFn) {
        const mergedArray = [...arrayBase];

        arrayToMerge.forEach(v => {
            const existingIndex = mergedArray.findIndex(fV => findFn(v, fV));
            if (existingIndex !== -1) {
                // If element exists, merge it
                mergeFn(mergedArray[existingIndex], v)
            } else {
                // Otherwise, add it
                mergedArray.push(v);
            }
        });

        return mergedArray
    }

    /**
     * Merges two arrays of abilities. Ranks are summed for matching abilities.
     * @param {Array<{uuid: string, name: string, rank: number}>} bAbilities - Base abilities array.
     * @param {Array<{uuid: string, name: string, rank: number}>} mAbilities - Abilities array to merge.
     * @returns {Array<{uuid: string, name: string, rank: number}>} The merged abilities array.
     */
    static mergeAbilities(bAbilities, mAbilities) {
        return this.mergeArray(bAbilities, mAbilities, (b, v) => b.uuid == v.uuid, (b, v) => {
            b.rank += v.rank
        })
    }

    /**
     * Merges two arrays of roll table entries. Counts are summed for matching entries.
     * @param {Array<{name: string, count: number}>} bRollTable - Base roll table array.
     * @param {Array<{name: string, count: number}>} mRollTable - Roll table array to merge.
     * @returns {Array<{name: string, count: number}>} The merged roll table array.
     */
    static mergeRollTable(bRollTable, mRollTable) {
        return this.mergeArray(bRollTable, mRollTable, (b, v) => b.name == v.name, (b, v) => {
            b.count += v.count
        })
    }

    /**
     * Merges two Memnosphere instances. They must have the same class UUID.
     * Abilities and roll table entries are merged using their respective merge functions.
     * @param {Memnosphere} sphere_base - The base Memnosphere to merge into.
     * @param {Memnosphere} sphere_merge - The Memnosphere whose data will be merged.
     * @returns {Memnosphere|undefined} A new merged Memnosphere instance, or undefined if classes do not match.
     */
    static merge(sphere_base, sphere_merge) {
        // Prevent merging if classes are different
        if(sphere_base.class.uuid != sphere_merge.class.uuid) {
            ui.notifications.error(`You cannot merge memnospheres unless they have the same class! ${sphere_base.class.uuid} != ${sphere_merge.class.uuid}`);
            return
        }

        // Perform merges for roll tables and abilities
        const mergedRollTable = Memnosphere.mergeRollTable(sphere_base.rollTable, sphere_merge.rollTable)
        const mergedAbilities = Memnosphere.mergeAbilities(sphere_base.abilities, sphere_merge.abilities)
        return new Memnosphere({abilities: mergedAbilities, rollTable : mergedRollTable, class: sphere_base.class });
    }

    /**
     * Creates an HTML description string for the Memnosphere.
     * The description includes abilities, a separator, roll table entries, and the class.
     * @returns {string} The HTML formatted description.
     */
    createDescription() {
        let description = ""

        // Add abilities
        for(let ability of this.abilities) {
            description += `<p>${UUIDLink(ability)} :: ${ability.rank}</p>`
        }

        // Add the separator key
        description += `<p>${MEMNOSPHERE_SPLIT_KEY} :: 0</p>`

        // Add roll table entries
        for(let tbl of this.rollTable) {
            description += `<p>${tbl.name} :: ${tbl.count}</p>`
        }

        // Add the class information
        description += `<p>${UUIDLink(this.class)} :: 0</p>`

        return description
    }

    /**
     * Creates a new Foundry VTT Item representing this Memnosphere.
     * @returns {Promise<Item>} A promise that resolves to the created Item.
     */
    async createItem() {
        const itemData = {
            name: "Memnosphere",
            type: "basic",
            system: {
                description: this.createDescription() // Set the description from the Memnosphere data
            },
        };
        let item = await Item.create(itemData);
        return item
    }
}

/**
 * Retrieves a document from a RollTable result.
 * @param {object} result - The result object from a RollTable draw.
 * @returns {Promise<Document|null>} A promise that resolves to the retrieved document or null.
 */
async function getDocumentFromResult(result) {
    let pack;
    // If the result is from a compendium, get the pack
    if ( result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM ) {
        pack = game.packs.get(result.documentCollection);
    }

    const id = result.documentId;
    // Get the document from the pack or from game.tables if it's a RollTable
    return pack ? await pack.getDocument(id) : game.tables.get(id);
}

/**
 * Rolls on a custom RollTable with additional logic for Memnosphere generation.
 * Supports recursive rolling and "Start" rule for pre-selecting abilities.
 * @param {RollTable} rollTable - The RollTable document to roll on.
 * @param {object} [options={}] - Options for the roll.
 * @param {Roll} [options.roll] - An existing Roll object to use.
 * @param {Memnosphere|null} [options.existingSphere=null] - An existing Memnosphere to check against "Start" rules.
 * @param {boolean} [options.recursive=true] - Whether to recursively roll on inner RollTables.
 * @param {number} [_depth=0] - Internal parameter to track recursion depth.
 * @returns {Promise<{roll: Roll, results: Array<any>}>} A promise that resolves to the roll result and an array of results.
 */
async function rollTableCustom(rollTable, {roll, existingSphere=null, recursive=true, _depth=0}={}) {
    // Prevent excessive recursion
    if ( _depth > 10 ) {
        throw new Error(`Maximum recursion depth exceeded when attempting to draw from RollTable ${rollTable.id}`);
    }

    // If there is no formula, automatically calculate an even distribution
    if ( !rollTable.formula ) {
        await rollTable.normalize();
    }

    // Reference the provided roll formula or create a new one
    roll = roll instanceof Roll ? roll : Roll.create(rollTable.formula);
    let results = [];

    // See if we have custom rules in the roll table's description
    let lines = extractParagraphsAsLines(rollTable.description)
    lines = extractKVPairsFromLines(lines)
    for(let kv of lines) {
        if(kv.key == "Start") {
            // "Start" rule only applies if an existing sphere is provided
            if(existingSphere == null) continue

            const abilityName = kv.value
            Log(`START Rule - Have we already picked ${abilityName}?`, existingSphere.rollTable)

            // If we already have this starting ability, then we don't need to do anything
            if(existingSphere.rollTable.find(v => { return v.name == abilityName })) {
                continue
            }

            Log(`START Rule - Force set roll`)

            // Otherwise, find the matching ability and force set the dice to roll that entry
            rollTable.results.forEach(res => {
                if(res.text == kv.value) {
                    // Force the roll to match the range of the desired result
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
        // Initialize chain for tracking recursive draws
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

            // If the document is a RollTable, recurse
            if ( documentName === "RollTable" ) {
                const innerTable = await getDocumentFromResult(result)
                if (innerTable) {
                    const innerRoll = await rollTableCustom(innerTable, {_depth: _depth + 1, existingSphere: existingSphere});
                    // Add the current result's text to the chain of the inner results
                    for(let res of innerRoll.results) {
                        res.chain.push(result.text)
                    }
                    inner = inner.concat(innerRoll.results);
                }
            }
            else {
                // Otherwise, add the result directly
                inner.push(result);
            }
        }
        results = inner;
    }

    // Return the Roll and the results
    return { roll, results };
}

const MEMNOSPHERE_ROLL_COST = 500

/**
 * Handles the rolling process for a Memnosphere, including cost deduction and merging with an existing sphere.
 * @param {object} params - Parameters for the roll.
 * @param {string} params.rollTableUUID - The UUID of the base RollTable for Memnosphere generation.
 * @param {string} params.actorUUID - The UUID of the actor whose Zenit will be deducted.
 * @param {string} [params.existingSphereUUID] - The UUID of an existing Memnosphere item to merge with.
 */
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
    // Deduct the cost
    actor.update({'system.resources.zenit.value' : current - MEMNOSPHERE_ROLL_COST})


    let sphereItem = null
    let sphere = null
    // If an existing sphere UUID is provided, load and parse it
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
        // Perform a non-recursive roll for the base class
        let tableRoll = await rollTableCustom(rollTable, {recursive: false})
        Log("Class Memosphere Roll", tableRoll)

        if(tableRoll.results.length != 1) {
            ui.notifications.error(`The base memnosphere RollTable must only have one entry per possible result!`);
            return
        }

        // Get the class document and create a new Memnosphere
        let classResult = tableRoll.results[0]
        let doc = await getDocumentFromResult(classResult)

        sphere = new Memnosphere({ class: { uuid: doc.uuid, name: classResult.text }})
        sphereItem = await sphere.createItem() // Create the item for the new sphere
        Log("New Sphere", sphere, sphereItem)
    }
    
    // Roll the memnosphere abilities based on the class's ability table
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
        // Retrieve the document for the ability
        let doc = await game.packs.get(result.documentCollection).getDocument(result.documentId)
        abilities.push({uuid: doc.uuid, name: result.text, rank: 1})

        // Track results from chained tables
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
    // Convert tracked result tables into an array format
    for(let k in resultTables) {
        rollTables.push({name: k, count: resultTables[k]})
    }
    Log("Rolltables", rollTables)

    // Create a new Memnosphere instance from the rolled results
    let newSphere = new Memnosphere({abilities : abilities, rollTable : rollTables, class: sphere.class})

    // Merge the new abilities with the existing sphere
    const mergedMemnosphere = Memnosphere.merge(sphere, newSphere)
    Log(mergedMemnosphere)

    // Update the existing sphere item's description with the merged data
    await sphereItem.update({system: {description: mergedMemnosphere.createDescription() } })
}


/**
 * Wrapper function for socket calls. (Currently commented out, but shows intent).
 * @param {function(...any): any} callable - The function to call when the socket event is received.
 * @returns {function(any, function(any): void): void} The socket handler function.
 */
function socketFn(callable) {
    return (request, ack) => {
        Log("Socket", request)
        // Ensure the request is for the current user or is not user-specific
        if (!!request.user && game.userId !== request.user) return;

        const response = callable(...request)
        ack(response) // Acknowledge the request
        // socket.broadcast.emit(eventName, response); // Broadcast the response to other clients
    }
}

//CONFIG.queries[getEventName("rollMemnosphere")] = rollMemnosphere; // Potentially for future Foundry VTT query system integration

/**
 * Binds an HTML input element's change event to set a flag on a sheet's document.
 * @param {FormApplication} sheet - The sheet object.
 * @param {jQuery} html - The jQuery object representing the sheet's HTML.
 * @param {string} name - The 'name' attribute of the input element.
 * @param {string} flag - The name of the flag to set.
 */
function bindNameToFlag(sheet, html, name, flag) {
    html.on(`change`, `input[name="${name}"]`, async (event) => {
        await sheet.document.setFlag(ModuleName, flag, event.target.value)
    })
}

/**
 * Hook function executed when a FUPartySheet is rendered.
 * Injects Technosphere UI elements and binds events.
 * @param {FormApplication} sheet - The rendered sheet object.
 * @param {jQuery} html - The jQuery object representing the sheet's HTML.
 */
Hooks.on(`renderFUPartySheet`, async (sheet, /** @type {jQuery} */ html) => {
    const FLAG_ROLLTABLE = 'technosphere-roll-table'
    const FLAG_EXISTINGSPHERE = 'technosphere-existing-sphere'

    // Add Technosphere tab button to the sheet tabs
    html.find(".sheet-tabs").append(
        `<a class="button button-style" data-tab="technosphere-machine"><i class="icon ra ra-sapphire"></i>Technosphere</a>`
    )

    // Render and append the Technosphere section content
    let tsSection = await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/technosphere-section.hbs", 
        {
            rollableTable: getFlag(sheet, FLAG_ROLLTABLE),
            existingSphere: getFlag(sheet, FLAG_EXISTINGSPHERE),
        }
    )
    html.find(".sheet-body").append(tsSection)

    // Bind input fields to set flags on sheet document
    bindNameToFlag(sheet, html, 'ts-sphere-table', FLAG_ROLLTABLE)
    bindNameToFlag(sheet, html, 'ts-existingSphere', FLAG_EXISTINGSPHERE)
    

    // Bind click event for the "Roll Memnosphere" button
    html.find('.technosphere-roll').unbind('click').bind('click', async (event) => {
        // const gm = game.users.activeGM; // Not used in current implementation
        let query = {
            rollTableUUID: getFlag(sheet, FLAG_ROLLTABLE),
            actorUUID: getCharacter().uuid, // Get UUID of the controlled character
            existingSphereUUID: getFlag(sheet, FLAG_EXISTINGSPHERE),
           // user: gm.id // Not used in current implementation
        }

        await rollMemnosphere(query) // Call the rollMemnosphere function

        return false // Prevent default link behavior

        //game.socket.emit(getEventName("rollMemnosphere"), query) // Example of socket emission
        //Log("rollMemnosphere")

        //await user.query(getEventName("rollMemnosphere"), query, { timeout: 30 * 1000 }); // Example of Foundry VTT query system
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

/**
 * Recomputes the technosphere-influenced items on an actor sheet based on a base actor.
 * It deletes existing technosphere-related items and then recreates them from the base actor.
 * @param {Actor} actor - The actor whose sheet is being recomputed.
 * @param {Actor} baseActor - The base actor from which to copy technosphere items.
 */
async function recomputeTechnosphereSheet(actor, baseActor) {
    /**
     * Checks if an item is a technosphere-influenced item type.
     * @param {Item} item - The item to check.
     * @returns {boolean} True if the item is a skill, class, or spell; otherwise, false.
     */
    function isTechnosphereItemType(item) {
        let type = item.type
        return type == "skill" || type == "class" || type == "spell"
    }

    // Gather and delete all of the technosphere influenced classes/abilities/etc 
    // So that we can evaluate from scratch
    const old_items = [];
    for(const item of actor.items) {
        if(!isTechnosphereItemType(item)) continue; // Only consider technosphere-related item types

        old_items.push(item.id)
    }
    Log("Old items", old_items)
    await actor.deleteEmbeddedDocuments("Item", old_items); // Delete old items

    Log("Deleted Items!")
    
    // Now gather all of the classes and abilities from the base sheet
    const updates = [];
    for(const item of baseActor.items){
        if(!isTechnosphereItemType(item)) continue; // Only copy technosphere-related item types
        updates.push(item.toJSON()); // Convert to JSON for creating new documents
    }
    Log("Updates", updates)

    // @TODO: Combine base features with technosphere features
    // This comment indicates a future enhancement where items from the base actor
    // might be combined with or modified by technosphere-specific features,
    // rather than just being copied.

    // Apply the update to the actor by creating new embedded documents
    await actor.createEmbeddedDocuments('Item', updates)
}

/**
 * Hook function executed when a FUStandardActorSheet is rendered.
 * Injects Technosphere settings and binds apply event.
 * @param {FormApplication} sheet - The rendered sheet object.
 * @param {jQuery} html - The jQuery object representing the sheet's HTML.
 */
Hooks.on(`renderFUStandardActorSheet`, async (sheet, /** @type {jQuery} */ html) => {
    const FLAG_BASESHEET = 'technosphere-base-sheet'

    let settings = html.find(`.settings`)
    // Prepend Technosphere settings template to the settings section
    settings.prepend(await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/technosphere-settings.hbs", 
        {
            baseSheet: getFlag(sheet, FLAG_BASESHEET),
        }
    ))

    // Bind the base sheet input field to set a flag
    bindNameToFlag(sheet, html, 'ts-baseSheet', FLAG_BASESHEET)

    // Bind click event for the "Apply Technosphere" button
    html.find('.technosphere-apply').unbind('click').bind('click', async event => {
        event.target.disabled = true // Disable button during processing

        try {
            const baseSheet = fromUuidSync(getFlag(sheet, FLAG_BASESHEET)); // Get the base sheet actor
            const actor = sheet.object // The current actor being edited
            await recomputeTechnosphereSheet(actor, baseSheet) // Recompute technosphere items
        } catch(error) {
            console.error(error) // Log any errors
        } finally {
            event.target.disabled = false // Re-enable button after processing
            Log("Done!")
        }
    });

})

/**
 * Hook function executed once Foundry VTT is initialized.
 * Sets up socket event listener for "rollMemnosphere".
 */
Hooks.once("init", () => {
    // Register the socket event listener for "rollMemnosphere"
    game.socket.on(getEventName("rollMemnosphere"), socketFn(rollMemnosphere))
})