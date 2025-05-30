///<reference path="../.jsinclude/foundry.js"/>

const ModuleName = "fabula-ultima-technosphere-machine"

/**
 * Generates a unique event name for the module.
 * @param {string} name - The base name of the event.
 * @returns {string} The fully qualified event name.
 */
function getEventName(name) {
    return `${ModuleName}.${name}`
}

const SYSTEM = 'projectfu';

CONFIG.debug.hooks = true

// Conditional logging for debug purposes.
if (CONFIG.debug.hooks) var Log = console.log.bind(window.console)
else var Log = function(){}

/**
 * Regular expression to parse Foundry VTT UUID links.
 * Expected format: `@UUID[uuid]{name}`
 */
const LinkRegex = /^@UUID\[(.+)\]\{(.+)\}$/;

/**
 * Parses a Foundry VTT UUID link string into an object containing the UUID and name.
 * @param {string} linkText - The UUID link string (e.g., `@UUID[Actor.abcdef]{My Actor}`).
 * @returns {{uuid: string, name: string}} An object with the extracted UUID and name.
 */
function parseUUIDLink(linkText) {
    let results = LinkRegex.exec(linkText)
    // Ensure results are not null before accessing indices.
    if (!results || results.length < 3) {
        console.warn("Invalid UUID link format:", linkText);
        return { uuid: "", name: linkText }; // Return with original text as name if parsing fails.
    }
    return { uuid: results[1], name: results[2] }
}

/**
 * Creates a Foundry VTT UUID link string from an object containing UUID and name.
 * @param {{uuid: string, name: string}} link - An object with uuid and name properties.
 * @returns {string} The formatted UUID link string.
 */
function UUIDLink(link) {
    return `@UUID[${link.uuid}]{${link.name}}`
}

/**
 * Splits an array into two halves based on a predicate function.
 * The first half contains elements until the predicate returns true, and the second half contains the rest.
 * The element for which the predicate returns true is not included in either half.
 * @param {Array<any>} array - The array to split.
 * @param {(element: any) => boolean} predicate - The function to test each element.
 * @returns {[Array<any>, Array<any>]} A tuple containing two arrays: the first half and the second half.
 */
function splitArray(array, predicate) {
    let firstHalf = true
    return array.reduce((acc, element) => {
        if (firstHalf) {
            if(predicate(element)) {
                firstHalf = false
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
 * Retrieves the currently controlled character actor, or the game user's character if no token is selected.
 * @returns {Actor|null} The character actor, or null if none is found.
 */
function getCharacter() {
    // Prioritize controlled tokens, then fall back to the user's assigned character.
    const character = canvas.tokens.controlled.at(0)?.document.actor || game.user.character;
    return character
}

/**
 * Retrieves a flag from a Foundry VTT document (typically a sheet's document).
 * @param {FormApplication} sheet - The sheet object.
 * @param {string} flagName - The name of the flag to retrieve.
 * @returns {any|null} The value of the flag, or null if an error occurs or the flag is not set.
 */
function getFlag(sheet, flagName) {
    try {
        // Access the document through the sheet and then get the flag.
        return sheet.document.getFlag(ModuleName, flagName);
    } catch(err) {
        console.error(`Failed to get flag '${flagName}':`, err);
        return null
    }
}

/**
 * Extracts paragraphs from an HTML string description and returns them as an array of plain text lines.
 * It assumes paragraphs are enclosed in `<p>` and `</p>` tags.
 * @param {string} description - The HTML string description.
 * @returns {string[]} An array of extracted plain text lines.
 */
function extractParagraphsAsLines(description) {
    let extractedLines = []
    // Split by '<p>' to get potential lines, then process each.
    let lines = description.split("<p>")
    const pTagEnd = "</p>"
    for(let line of lines) {
        // Ensure the line ends with </p> to confirm it's a valid paragraph.
        if(!line.endsWith(pTagEnd)) {
            continue;
        }
        // Remove the closing </p> tag.
        let lineText = line.substring(0, line.length - pTagEnd.length)
        extractedLines.push(lineText)
    }
    return extractedLines
}

/**
 * Extracts key-value pairs from an array of lines.
 * Each line is expected to be in the format "key :: value".
 * @param {string[]} lines - An array of strings, where each string is a key-value pair.
 * @returns {{key: string, value: string}[]} An array of objects, each with 'key' and 'value' properties.
 */
function extractKVPairsFromLines(lines) {
    let extractedKVPairs = []
    for(let lineText of lines) {
        let values = lineText.split(" :: ")
        // Only consider lines that split into exactly two parts.
        if(values.length != 2) {
            continue;
        }
        extractedKVPairs.push({key: values[0], value: values[1]})
    }
    return extractedKVPairs
}

/**
 * A special key used to delineate the abilities section from the roll table section in a Memnosphere description.
 */
const MEMNOSPHERE_SPLIT_KEY = "@ROLLTABLE"

/**
 * Represents a Memnosphere, which encapsulates abilities, a roll table, and an associated class.
 */
class Memnosphere {
    /**
     * Constructs a new Memnosphere instance.
     * @param {object} [config={}] - Initial configuration for the Memnosphere.
     * @param {Array<{uuid: string, name: string, rank: number}>} [config.abilities=[]] - An array of abilities.
     * @param {Array<{name: string, count: number}>} [config.rollTable=[]] - An array representing roll table entries.
     * @param {{uuid: string, name: string}} [config.class={}] - The associated class.
     */
    constructor(config={}){
        /**
         * List of abilities associated with this Memnosphere.
         * @type {Array<{uuid: string, name: string, rank: number}>}
         */
        this.abilities = []
        /**
         * List of roll table entries associated with this Memnosphere.
         * @type {Array<{name: string, count: number}>}
         */
        this.rollTable = []
        /**
         * The class associated with this Memnosphere.
         * @type {{uuid: string, name: string}}
         */
        this.class = { uuid: "", name: "" }
        Object.assign(this,config);
    }

    /**
     * Extracts Memnosphere data from a Foundry VTT item's description.
     * The description is expected to contain key-value pairs representing abilities, roll table, and class.
     * @param {Item} item - The Foundry VTT item to extract data from.
     * @returns {Memnosphere|null} A new Memnosphere instance populated with extracted data.
     */
    static extractFromItem(item) {
        
        let result = new Memnosphere()

        let description = item.system.description
        // Extract plain text lines from the HTML description.
        let lines = extractParagraphsAsLines(description)
        // Convert lines into key-value pairs.
        lines = extractKVPairsFromLines(lines)

        if(lines.length == 0) {
            return null
        }

        // The last line is always the class definition.
        const classLine = lines.pop()
        result.class = parseUUIDLink(classLine.key)

        // Split the remaining lines into abilities and roll table based on the MEMNOSPHERE_SPLIT_KEY.
        const [abilitiesKV, rolltableKV] = splitArray(lines, kv => kv.key == MEMNOSPHERE_SPLIT_KEY)

        //@TODO
        // technosphere-machine.js:752 Could not get Memnosphere items from player's inventory TypeError: Cannot read properties of undefined (reading 'level')

        // Populate abilities array.
        for(let kv of abilitiesKV) {
            let link = parseUUIDLink(kv.key)
            let doc = fromUuidSync(link.uuid)
            Log(doc)
            result.abilities.push({
                uuid: link.uuid, 
                name: link.name, 
                rank: parseInt(kv.value), 
                img: doc.img, 
                maxRank: (doc.type == "skill" ? doc.system.level.max : 1)
            })
        }

        // Populate roll table array.
        for(let kv of rolltableKV) {
            result.rollTable.push({name: kv.key, count: parseInt(kv.value)})
        }

        return result
    }

    /**
     * Merges two arrays based on a find function and a merge function.
     * Elements from `arrayToMerge` are added to `arrayBase` or merged with existing elements.
     * @param {Array<any>} arrayBase - The base array to merge into.
     * @param {Array<any>} arrayToMerge - The array whose elements will be merged.
     * @param {(baseElement: any, mergeElement: any) => boolean} findFn - A function to determine if elements should be merged.
     * @param {(baseElement: any, mergeElement: any) => void} mergeFn - A function to perform the merge operation on elements.
     * @returns {Array<any>} A new array containing the merged results.
     */
    static mergeArray(arrayBase, arrayToMerge, findFn, mergeFn) {
        // Create a shallow copy to avoid modifying the original base array directly.
        const mergedArray = [...arrayBase];

        arrayToMerge.forEach(v => {
            const existingIndex = mergedArray.findIndex(fV => findFn(v, fV));
            if (existingIndex !== -1) {
                // If found, apply the merge function.
                mergeFn(mergedArray[existingIndex], v)
            } else {
                // Otherwise, add the new element.
                mergedArray.push(v);
            }
        });

        return mergedArray
    }

    /**
     * Merges two arrays of abilities. Abilities with the same UUID have their ranks combined.
     * @param {Array<{uuid: string, name: string, rank: number}>} baseAbilities - The base abilities array.
     * @param {Array<{uuid: string, name: string, rank: number}>} mergeAbilities - The abilities array to merge.
     * @returns {Array<{uuid: string, name: string, rank: number}>} The merged abilities array.
     */
    static mergeAbilities(baseAbilities, mergeAbilities) {
        return this.mergeArray(baseAbilities, mergeAbilities, 
            (b, v) => b.uuid === v.uuid, // Find by UUID
            (b, v) => { b.rank += v.rank; } // Merge by summing ranks
        )
    }

    /**
     * Merges two arrays of roll table entries. Entries with the same name have their counts combined.
     * @param {Array<{name: string, count: number}>} baseRollTable - The base roll table array.
     * @param {Array<{name: string, count: number}>} mergeRollTable - The roll table array to merge.
     * @returns {Array<{name: string, count: number}>} The merged roll table array.
     */
    static mergeRollTable(baseRollTable, mergeRollTable) {
        return this.mergeArray(baseRollTable, mergeRollTable, 
            (b, v) => b.name === v.name, // Find by name
            (b, v) => { b.count += v.count; } // Merge by summing counts
        )
    }

    /**
     * Merges two Memnosphere instances.
     * They can only be merged if they share the same class. Abilities and roll tables are combined.
     * @param {Memnosphere} sphere_base - The base Memnosphere.
     * @param {Memnosphere} sphere_merge - The Memnosphere to merge into the base.
     * @returns {Memnosphere|undefined} A new merged Memnosphere, or undefined if classes do not match.
     */
    static merge(sphere_base, sphere_merge) {
        // Enforce same-class merging.
        if(sphere_base.class.uuid != sphere_merge.class.uuid) {
            ui.notifications.error(`You cannot merge memnospheres unless they have the same class! ${sphere_base.class.uuid} != ${sphere_merge.class.uuid}`);
            return
        }

        const mergedRollTable = Memnosphere.mergeRollTable(sphere_base.rollTable, sphere_merge.rollTable)
        const mergedAbilities = Memnosphere.mergeAbilities(sphere_base.abilities, sphere_merge.abilities)
        return new Memnosphere({abilities: mergedAbilities, rollTable : mergedRollTable, class: sphere_base.class });
    }

    /**
     * Creates an HTML string description for the Memnosphere, formatted with paragraphs and UUID links.
     * This description can be stored in a Foundry VTT item.
     * @returns {string} The HTML formatted description.
     */
    createDescription() {
        let description = ""

        // Add abilities with their ranks.
        for(let ability of this.abilities) {
            description += `<p>${UUIDLink(ability)} :: ${ability.rank}</p>`
        }

        // Add the split key.
        description += `<p>${MEMNOSPHERE_SPLIT_KEY} :: 0</p>`

        // Add roll table entries with their counts.
        for(let tbl of this.rollTable) {
            description += `<p>${tbl.name} :: ${tbl.count}</p>`
        }

        // Add the class information.
        description += `<p>${UUIDLink(this.class)} :: 0</p>`

        return description
    }

    /**
     * Creates a new Foundry VTT "basic" item with the Memnosphere's generated description.
     * @returns {Promise<Item>} A promise that resolves to the created Item document.
     */
    createItemData() {
        const itemData = {
            name: `Memnosphere - ${this.class.name}`,
            img: this.class.uuid ? fromUuidSync(this.class.uuid)?.img || "icons/svg/item-bag.svg" : "icons/svg/item-bag.svg",
            type: "treasure",
            system: {
                description: this.createDescription()
            },
        };
        return itemData
    }
}

/**
 * Retrieves a Foundry VTT document (e.g., RollTable) from a table result.
 * This handles both compendium and non-compendium documents.
 * @param {object} result - A result object from a RollTable draw.
 * @param {number} result.type - The type of document (e.g., CONST.TABLE_RESULT_TYPES.COMPENDIUM).
 * @param {string} result.documentCollection - The name of the compendium if type is COMPENDIUM.
 * @param {string} result.documentId - The ID of the document.
 * @returns {Promise<Document|null>} A promise that resolves to the Foundry VTT document, or null if not found.
 */
async function getDocumentFromResult(result) {
    let pack;
    if ( result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM ) {
        pack = game.packs.get(result.documentCollection);
    }

    const id = result.documentId;
    // If from a compendium, retrieve from the pack; otherwise, from game tables.
    return pack ? await pack.getDocument(id) : game.tables.get(id);
}

/**
 * Rolls on a custom Foundry VTT RollTable with additional logic for Memnosphere generation.
 * Includes support for "Start" rules and recursive rolling of inner tables.
 * @param {RollTable} rollTable - The RollTable document to roll on.
 * @param {object} [options={}] - Options for the roll.
 * @param {Roll} [options.roll] - An optional pre-defined Roll object.
 * @param {Memnosphere} [options.existingSphere=null] - An existing Memnosphere to influence the roll (e.g., for "Start" rules).
 * @param {boolean} [options.recursive=true] - Whether to recursively roll on inner RollTables.
 * @param {number} [_depth=0] - Internal parameter to track recursion depth and prevent infinite loops.
 * @returns {Promise<{roll: Roll, results: Array<object>}>} A promise that resolves to the Roll object and an array of drawn results.
 * @throws {Error} If maximum recursion depth is exceeded.
 */
async function rollTableCustom(rollTable, {roll, existingSphere=null, recursive=true, _depth=0}={}) {
    // Prevent excessive recursion.
    if ( _depth > 10 ) {
        throw new Error(`Maximum recursion depth exceeded when attempting to draw from RollTable ${rollTable.id}`);
    }

    // If there is no formula, automatically calculate an even distribution.
    if ( !rollTable.formula ) {
        await rollTable.normalize();
    }

    // Reference the provided roll formula or create a new one.
    roll = roll instanceof Roll ? roll : Roll.create(rollTable.formula);
    let results = [];

    // Custom rules processing from the RollTable description.
    let lines = extractParagraphsAsLines(rollTable.description)
    lines = extractKVPairsFromLines(lines)
    for(let kv of lines) {
        if(kv.key == "Start") {
            // "Start" rule applies only if an existing sphere is provided.
            if(existingSphere == null) continue

            const abilityName = kv.value
            Log(`START Rule - Have we already picked ${abilityName}?`, existingSphere.rollTable)

            // If the existing sphere already has this starting ability, skip the rule.
            if(existingSphere.rollTable.find(v => { return v.name == abilityName })) {
                continue
            }

            Log(`START Rule - Force set roll`)

            // Otherwise, find the matching ability in the table results and force set the dice to roll that entry.
            rollTable.results.forEach(res => { 
                if(res.text == kv.value) { 
                    // Set the roll to the minimum range value of the desired result.
                    roll = Roll.create(res.range[0].toString()) 
                } 
            })
        }
    }

    // Ensure that at least one non-drawn result remains.
    const available = rollTable.results.filter(r => !r.drawn);
    if ( !available.length ) {
        ui.notifications.warn(game.i18n.localize("TABLE.NoAvailableResults"));
        return {roll, results};
    }

    // Ensure that results are available within the minimum/maximum range of possible rolls.
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

    // Continue rolling until one or more results are recovered.
    let iter = 0;
    while ( !results.length ) {
        if ( iter >= 10000 ) {
            ui.notifications.error(`Failed to draw an available entry from Table ${rollTable.name}, maximum iteration reached`);
            break;
        }
        roll = await roll.reroll(); // Reroll until a valid result is found.
        results = rollTable.getResultsForRoll(roll.total);
        for ( let result of results ) {
            // Initialize a chain array to track nested table results.
            result.chain = []
        }
        iter++;
    }

    // Draw results recursively from any inner Roll Tables.
    if ( recursive ) {
        let innerResults = [];
        for ( let result of results ) {
            let documentName;
            if ( result.type === CONST.TABLE_RESULT_TYPES.DOCUMENT ) documentName = result.documentCollection;

            if ( documentName === "RollTable" ) {
                const innerTable = await getDocumentFromResult(result)
                if (innerTable) {
                    // Recursively call rollTableCustom for inner tables.
                    const innerRoll = await rollTableCustom(innerTable, {_depth: _depth + 1, existingSphere: existingSphere});
                    // Add the current result's text to the chain of the inner results.
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

    // Return the Roll and the results.
    return { roll, results };
}

/**
 * The cost in Zenit to roll a Memnosphere.
 */
const MEMNOSPHERE_ROLL_COST = 500

/**
 * Handles the rolling and creation/merging of Memnospheres.
 * This function orchestrates the entire process, including cost checking, initial class roll,
 * and subsequent ability/roll table generation, and merging with an existing Memnosphere.
 * @param {object} params - Parameters for the Memnosphere roll.
 * @param {string} params.rollTableUUID - The UUID of the base RollTable for classes (if no existing sphere).
 * @param {string} params.actorUUID - The UUID of the actor whose Zenit will be used and who will own the Memnosphere item.
 * @param {string} [params.existingSphereUUID] - Optional UUID of an existing Memnosphere item to merge with.
 * @returns {Promise<[Memnosphere, Item]>}
 */
async function rollMemnosphere({rollTableUUID, actorUUID, existingSphereUUID}) {
    let actor = fromUuidSync(actorUUID)
    if(actor == null) {
        ui.notifications.error(`You must have an actor selected, or have chosen one to be your player character.`);
        return
    }

    // Check and pay the cost to roll.
    const currentZenit = actor.system.resources.zenit.value;
    if(currentZenit < MEMNOSPHERE_ROLL_COST) {
        ui.notifications.error(`You must have at least ${MEMNOSPHERE_ROLL_COST} ${game.i18n.localize('FU.Zenit')} to create a new Memnosphere.`);
        return
    }
    // Deduct the cost from the actor's Zenit.
    await actor.update({'system.resources.zenit.value' : currentZenit - MEMNOSPHERE_ROLL_COST})


    let sphereItem = null
    let sphere = null
    // If an existing sphere UUID is provided, load and extract its data.
    if(existingSphereUUID) {
        sphereItem = fromUuidSync(existingSphereUUID)
        if(sphereItem == null) {
            ui.notifications.error(`Please provide a valid item UUID, or no UUID at all.`);
            return
        }
        sphere = Memnosphere.extractFromItem(sphereItem)
        Log("Existing Sphere - ", sphere)
    }

    // If we are rolling a brand new sphere (no existingSphereUUID), we first need to determine the class.
    if(sphereItem == null) {
        let rollTable = fromUuidSync(rollTableUUID)
        if (!rollTable) {
            ui.notifications.error(`Invalid RollTable UUID provided: ${rollTableUUID}`);
            return;
        }
        // Roll on the base class table, non-recursively.
        let tableRoll = await rollTableCustom(rollTable, {recursive: false})
        Log("Class Memnosphere Roll", tableRoll)

        // Ensure the class roll table only yields one result.
        if(tableRoll.results.length != 1) {
            ui.notifications.error(`The base memnosphere RollTable must only have one entry per possible result!`);
            return
        }

        let classResult = tableRoll.results[0]
        let doc = await getDocumentFromResult(classResult)
        if (!doc) {
            ui.notifications.error(`Could not retrieve document for class result: ${classResult.text}`);
            return;
        }

        // Create a new Memnosphere with the rolled class and create a new item for it.
        sphere = new Memnosphere({ class: { uuid: doc.uuid, name: classResult.text }})
    }
    
    // Now, roll for abilities based on the Memnosphere's class table.
    let classAbilityTable = fromUuidSync(sphere.class.uuid)
    if(classAbilityTable == null) {
        ui.notifications.error(`Memnosphere ${existingSphereUUID || "new sphere"} has an invalid class table reference!`);
        return
    }

    // Roll on the class's ability table, potentially influenced by existing sphere and recursively.
    let abilityRoll = await rollTableCustom(classAbilityTable, {existingSphere: sphere})
    Log("abilityRoll", abilityRoll)

    let newAbilities = []
    let newResultTables = {} // Collect counts for roll tables from the chain.

    for(let result of abilityRoll.results) {
        // Retrieve the document for each ability result.
        // Assuming result.documentCollection and result.documentId always exist for relevant results.
        let doc = await game.packs.get(result.documentCollection).getDocument(result.documentId)
        if (doc) {
            newAbilities.push({uuid: doc.uuid, name: result.text, rank: 1})
        } else {
            console.warn(`Could not retrieve document for ability result: ${result.text}`);
        }

        // Aggregate counts for chained roll tables (e.g., if a sub-table was rolled).
        for(let chain of result.chain) {
            newResultTables[chain] = (newResultTables[chain] || 0) + 1;
        }
    }
    Log("New Abilities", newAbilities)

    let newRollTables = []
    for(let k in newResultTables) {
        newRollTables.push({name: k, count: newResultTables[k]})
    }
    Log("New Rolltables", newRollTables)

    // Create a new Memnosphere instance with the rolled abilities and roll tables.
    let generatedSphere = new Memnosphere({abilities : newAbilities, rollTable : newRollTables, class: sphere.class})

    // Merge the newly generated Memnosphere data with the existing one.
    const mergedMemnosphere = Memnosphere.merge(sphere, generatedSphere)
    if (!mergedMemnosphere) {
        // Error message already handled in Memnosphere.merge.
        return; 
    }
    Log("Merged Memnosphere", mergedMemnosphere)

    return [mergedMemnosphere, sphereItem]
}


/**
 * A wrapper for socket-based function calls.
 * This function is intended to be used with `game.socket.on` to handle requests
 * received over the socket, execute a callable function, and broadcast the response.
 * @param {function} callable - The function to execute when a socket message is received.
 * @returns {function(object, function)} A function that acts as a socket event handler.
 */
function socketFn(callable) {
    return (request, ack) => {
        Log("Socket received request:", request)
        // Ensure the request is for the current user, or process if no user specified (e.g., GM action).
        if (!!request.user && game.userId !== request.user) return;

        // Execute the provided callable function with the request arguments.
        const response = callable(...request)
        // Acknowledge the sender.
        ack(response)
        // Broadcast the response to all other connected clients.
        // This might need refinement depending on the desired socket communication pattern.
        // For example, if only the sender needs the response, broadcast is not necessary.
        socket.broadcast.emit(eventName, response); 
    }
}

// CONFIG.queries[getEventName("rollMemnosphere")] = rollMemnosphere; // This line appears commented out in the original.

async function SetFlagWithoutRender(document, scope, key, value) {
    const scopes = document.constructor.database.getFlagScopes();
    if ( !scopes.includes(scope) ) throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
    return document.update({
    flags: {
        [scope]: {
        [key]: value
        }
    }
    }, {
        render: false    
    });
}


function bindUUIDInput(sheet, html, name, flag, type) {
    const input = html.find(`input[name="${name}"]`);
    const clearButton = html.find(`#clear-${name}`);
    
    input.on('dragover', (event) => {
        event.preventDefault(); // Allow drop by preventing default handling of the event
    });

    input.on('drop', async (event) => {
        event.preventDefault();  // Prevent default browser behavior (e.g., opening the dropped file)
        event.stopPropagation(); // Stop the event from bubbling up to FUPartySheet._onDrop

        const data = TextEditor.getDragEventData(event.originalEvent); // Use originalEvent for jQuery
        Log("Dropped data on ts-sphere-table:", data);

        if (data && data.type === type && data.uuid) {
            event.target.value = data.uuid; // Update the input field value
            // Manually save the flag
            await SetFlagWithoutRender(sheet.document, ModuleName, flag, data.uuid);
        }
    });
    
    // Ensure that manual changes to the input also save the flag.
    // This is important because we removed the generic bindInputToFlag for this element.
    input.on('change', async (event) => {
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, event.target.value);
    });

    if (clearButton.length) {
        clearButton.on('click', async (event) => {
            event.preventDefault();
            input.val(''); // Clear the input field
            await SetFlagWithoutRender(sheet.document, ModuleName, flag, ''); // Clear the flag
        });
    }

    html.on(`change`, `input[name="${name}"]`, async (event) => {
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, event.target.value)
    })
}


function bindSelectToFlag(sheet, html, name, flag) {
    html.on(`change`, `select[name="${name}"]`, async (event) => {
        Log("Setting flag", flag, event.target.value)
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, event.target.value)
    })
}

function bindMemnosphereSelectionToFlag(sheet, html, flag) {
    const memnosphereCards = html.find('[data-action="selectMemnosphere"]');
    memnosphereCards.on('click', async (event) => {
        const selectedCard = $(event.currentTarget);
        const newUuid = selectedCard.data('uuid');

        await SetFlagWithoutRender(sheet.document, ModuleName, flag, newUuid);

        // Update visual selection
        memnosphereCards.removeClass('selected');
        selectedCard.addClass('selected');
    });
}

function filterMemnospheres(items) {
    return items.filter(i => i.type === "treasure").map(i => {return {item: i, sphere: Memnosphere.extractFromItem(i)} } ).filter(i => i.sphere != null);
}

/**
 * Hooks into the `renderFUPartySheet` event to inject Technosphere machine UI elements.
 * This includes adding a new tab, input fields for roll table and existing sphere UUIDs,
 * and a button to trigger the Memnosphere roll.
 * @param {ActorSheet} sheet - The Foundry VTT Party Sheet application.
 * @param {jQuery} html - The jQuery object representing the rendered HTML of the sheet.
 */
Hooks.on(`renderFUPartySheet`, async (sheet, html) => {
    const FLAG_ROLLTABLE = 'technosphere-roll-table'
    const FLAG_EXISTINGSPHERE = 'technosphere-existing-sphere'

    // Add Technosphere tab to the sheet.
    html.find(".sheet-tabs").append(
        `<a class="button button-style" data-tab="technosphere-machine"><i class="icon ra ra-sapphire"></i>Technosphere</a>`
    )

    // Gather Memnosphere items from the party actor's inventory
    let partyMemnospheres = [];
    try {
        // The party actor is available as sheet.actor
        const items = sheet.actor?.items || [];
        partyMemnospheres = filterMemnospheres(items)
    } catch (e) {
        console.warn("Could not get Memnosphere items from party inventory", e);
    }

    let characterMemnospheres = [];
    try {
        // The party actor is available as sheet.actor
        const items = game.user.character?.items || [];
        characterMemnospheres = filterMemnospheres(items)
    } catch (e) {
        console.warn("Could not get Memnosphere items from player's inventory", e);
    }

    let existingSphereUUID = getFlag(sheet, FLAG_EXISTINGSPHERE)
    if(existingSphereUUID && !partyMemnospheres.find(v => v.uuid == existingSphereUUID)) {
        // Using SetFlagWithoutRender for consistency, assuming no re-render is desired here.
        await SetFlagWithoutRender(sheet.document, ModuleName, FLAG_EXISTINGSPHERE, null)
    }
    
    // Render and append the Technosphere section content.
    let tsSection = await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/technosphere-section.hbs", 
        {
            isGM: game.user.isGM,
            rollableTable: getFlag(sheet, FLAG_ROLLTABLE),
            existingSphere: existingSphereUUID,
            partyMemnospheres: partyMemnospheres,
            characterMemnospheres: characterMemnospheres
        }
    )
    html.find(".sheet-body").append(tsSection)

    // Bind input fields to flags for persistent storage.
    bindUUIDInput(sheet, html, 'ts-sphere-table', FLAG_ROLLTABLE, "RollTable")
    bindMemnosphereSelectionToFlag(sheet, html, FLAG_EXISTINGSPHERE)
    
    // Attach click event listener to the "Technosphere Roll" button.
    html.find('.technosphere-roll').unbind('click').bind('click', async (event) => {
        // Prevent default form submission or other unintended behaviors.
        event.preventDefault(); 
        
        // This line is commented out in the original, but if GM-only actions were intended,
        // you might use `game.users.activeGM.id` to send the request to the GM.
        // const gm = game.users.activeGM; 

        let query = {
            rollTableUUID: getFlag(sheet, FLAG_ROLLTABLE),
            actorUUID: getCharacter().uuid, // Get the UUID of the currently selected character.
            existingSphereUUID: getFlag(sheet, FLAG_EXISTINGSPHERE),
           // user: gm.id // If sending to GM via socket.
        }

        // Directly call rollMemnosphere. If this was intended to be a socket call,
        // the commented lines below would be relevant.
        // game.socket.emit(getEventName("rollMemnosphere"), query) // Example of emitting a socket event.
        // Log("rollMemnosphere")
        // await user.query(getEventName("rollMemnosphere"), query, { timeout: 30 * 1000 }); // Example of a query with timeout.


        let [sphere, existingItem] = await rollMemnosphere(query)
        if(existingItem) {
            // Update the description of the existing Memnosphere item with the merged data.
            await existingItem.update({system: {description: sphere.createDescription() } })
        }
        else {
            await sheet.actor.createEmbeddedDocuments("Item", [sphere.createItemData()]);
        }

        // Ensure the Technosphere tab remains active after the roll and potential re-render.
        sheet.activateTab("technosphere-machine");

        return false // Prevent further event propagation.
    });
})

Hooks.on("updateItem", (item, changes, options, userId) => {
    // Check if the updated item belongs to the player's character
    if (game.user.character && item.parent?.uuid === game.user.character.uuid) {
        // Find any open FUPartySheet and refresh it
        Object.values(ui.windows).forEach(app => {
            if (app instanceof 'FUPartySheet') {
                app.render();
            }
        });
    }
});


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
 * Recomputes and updates the items (skills, classes, spells) on an actor sheet
 * based on a "base sheet" (another actor). This is likely for a "Technosphere"
 * feature where an actor's abilities are derived or influenced by a template actor.
 * @param {Actor} actor - The target actor whose items will be recomputed.
 * @param {Actor} baseActor - The base actor providing the source items.
 * @returns {Promise<void>}
 */
async function recomputeTechnosphereSheet(actor, baseActor) {
    /**
     * Checks if an item is a Technosphere-influenced item type.
     * @param {Item} item - The item to check.
     * @returns {boolean} True if the item is a skill, class, or spell; otherwise, false.
     */
    function isTechnosphereItemType(item) {
        let type = item.type
        return type == "skill" || type == "class" || type == "spell"
    }

    // Gather and delete all existing Technosphere-influenced items from the target actor.
    // This ensures a clean slate before adding new/updated items.
    const old_items = [];
    for(const item of actor.items) {
        if(!isTechnosphereItemType(item)) continue;
        old_items.push(item.id)
    }
    Log("Old items to delete:", old_items)
    await actor.deleteEmbeddedDocuments("Item", old_items);
    Log("Deleted old items from actor.")
    
    // Now gather all relevant items from the base actor to apply to the target actor.
    const updates = [];
    for(const item of baseActor.items){
        if(!isTechnosphereItemType(item)) continue;
        // Use toJSON() to get a plain object representation suitable for creation.
        updates.push(item.toJSON());
    }
    Log("Items to update/create:", updates)

    // @TODO: Combine base features with technosphere features.
    // This comment indicates a potential future enhancement where items from the base actor
    // might be merged or processed with *additional* Technosphere-specific features,
    // rather than just being directly copied. This would involve more complex logic
    // similar to `Memnosphere.mergeAbilities` or `Memnosphere.mergeRollTable`.

    // Apply the update by creating new embedded documents (items) on the target actor.
    await actor.createEmbeddedDocuments('Item', updates)
    Log("Applied new items to actor.")
}

/**
 * Hooks into the `renderFUStandardActorSheet` event to inject Technosphere settings.
 * This allows users to designate a "base sheet" (another actor) from which to copy
 * skills, classes, and spells, effectively recomputing the current actor's sheet.
 * @param {FormApplication} sheet - The Foundry VTT Actor Sheet application.
 * @param {jQuery} html - The jQuery object representing the rendered HTML of the sheet.
 */
Hooks.on(`renderFUStandardActorSheet`, async (sheet, html) => {
    const FLAG_BASESHEET = 'technosphere-base-sheet'

    // Find the settings section and prepend the Technosphere settings template.
    let settings = html.find(`.settings`)
    settings.prepend(await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/technosphere-settings.hbs", 
        {
            // Populate template with the current base sheet UUID.
            baseSheet: getFlag(sheet, FLAG_BASESHEET),
        }
    ))

    // Bind the input field for the base sheet UUID to a flag.
    bindUUIDInput(sheet, html, 'ts-baseSheet', FLAG_BASESHEET, "ActorSheet")

    // Attach click event listener to the "Apply Technosphere" button.
    html.find('.technosphere-apply').unbind('click').bind('click', async event => {
        // Disable the button to prevent multiple clicks during processing.
        event.target.disabled = true
        try {
            // Retrieve the base sheet actor using its UUID.
            const baseSheetActor = fromUuidSync(getFlag(sheet, FLAG_BASESHEET));
            if (!baseSheetActor) {
                ui.notifications.error("Invalid Base Sheet UUID. Please ensure the UUID refers to an existing Actor.");
                return;
            }
            const currentActor = sheet.object
            // Call the recomputation function.
            await recomputeTechnosphereSheet(currentActor, baseSheetActor)
            ui.notifications.info(`Technosphere recomputation applied to ${currentActor.name}.`);
        } catch(error) {
            console.error("Error applying Technosphere recomputation:", error)
            ui.notifications.error("An error occurred during Technosphere recomputation. Check console for details.");
        } finally {
            // Re-enable the button after completion or error.
            event.target.disabled = false
            Log("Technosphere recomputation process finished.")
        }
    });
})


/**
 * Hooks into the Foundry VTT "init" event, which runs once when the game initializes.
 * This is used to register the socket event listener for "rollMemnosphere".
 */
Hooks.once("init", async () => {
    // Register the socket event for rolling Memnospheres, using the socketFn wrapper.
    game.socket.on(getEventName("rollMemnosphere"), socketFn(rollMemnosphere))

    await loadTemplates(['modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/memnosphere-card.hbs'])
})

Handlebars.registerHelper('times', function(n, block) {
  let accum = '';
  for (let i = 0; i < n; ++i) {
    accum += block.fn({index: i}); // Pass the index as context
  }
  return accum;
});