import { getCharacter, getEventName, getFlag, Log, MEMNOSPHERE_ROLL_COST, ModuleName, SetFlagWithoutRender } from "./core-config.js";
import { filterMemnospheres, Memnosphere } from "./memnosphere.js";
import { getDocumentFromResult, rollTableCustom } from "./roll-table-utils.js";
import { recomputeTechnosphereSheet } from "./technosphere-recompute.js";
import { bindMemnosphereSelectionToFlag, bindUUIDInput } from "./ui-bindings.js";

interface RollMemnosphereParams {
    rollTableUUID: UUID;
    actorUUID: UUID;
    existingSphereUUID?: UUID;
}

export async function rollMemnosphere({rollTableUUID, actorUUID, existingSphereUUID}: RollMemnosphereParams): Promise<[Memnosphere, any] | undefined> {
    let actor = fromUuidSync(actorUUID) as FUActor
    if(actor == null) {
        ui.notifications.error(`You must have an actor selected, or have chosen one to be your player character.`);
        return
    }

    // Check and pay the cost to roll
    const currentZenit = actor.system.resources.zenit.value;
    if(currentZenit < MEMNOSPHERE_ROLL_COST) {
        ui.notifications.error(`You must have at least ${MEMNOSPHERE_ROLL_COST} ${game.i18n.localize('FU.Zenit')} to create a new Memnosphere.`);
        return
    }
    await actor.update({'system.resources.zenit.value' : currentZenit - MEMNOSPHERE_ROLL_COST} as any)

    let sphereItem = null
    let sphere = null
    
    // Load existing sphere if provided
    if(existingSphereUUID) {
        sphereItem = fromUuidSync(existingSphereUUID)
        if(sphereItem == null) {
            ui.notifications.error(`Please provide a valid item UUID, or no UUID at all.`);
            return
        }
        sphere = Memnosphere.extractFromItem(sphereItem)
        Log("Existing Sphere - ", sphere)
    }

    // Roll for new sphere class if no existing sphere
    if(sphereItem == null) {
        let rollTable = fromUuidSync(rollTableUUID)
        if (!rollTable) {
            ui.notifications.error(`Invalid RollTable UUID provided: ${rollTableUUID}`);
            return;
        }
        
        let tableRoll = await rollTableCustom(rollTable, {recursive: false})
        Log("Class Memnosphere Roll", tableRoll)

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

        sphere = new Memnosphere({ class: { uuid: doc.uuid, name: classResult.text }})
    }
    
    // Roll for abilities based on the class table
    let classAbilityTable = fromUuidSync(sphere.class.uuid)
    if(classAbilityTable == null) {
        ui.notifications.error(`Memnosphere ${existingSphereUUID || "new sphere"} has an invalid class table reference!`);
        return
    }

    let abilityRoll = await rollTableCustom(classAbilityTable, {existingSphere: sphere})
    Log("abilityRoll", abilityRoll)

    let newAbilities = []
    let newResultTables = {}

    for(let result of abilityRoll.results) {
        let doc = await game.packs.get(result.documentCollection).getDocument(result.documentId)
        if (doc) {
            newAbilities.push({uuid: doc.uuid, name: result.text, rank: 1})
        } else {
            console.warn(`Could not retrieve document for ability result: ${result.text}`);
        }

        // Aggregate counts for chained roll tables
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

    // Create and merge Memnospheres
    let generatedSphere = new Memnosphere({abilities : newAbilities, rollTable : newRollTables, class: sphere.class})
    const mergedMemnosphere = Memnosphere.merge(sphere, generatedSphere)
    if (!mergedMemnosphere) {
        return; 
    }
    Log("Merged Memnosphere", mergedMemnosphere)

    return [mergedMemnosphere, sphereItem]
}


Hooks.on(`renderFUPartySheet`, async (sheet: any, html: any) => {
    const FLAG_ROLLTABLE = 'technosphere-roll-table'
    const FLAG_EXISTINGSPHERE = 'technosphere-existing-sphere'

    // Add Technosphere tab
    html.find(".sheet-tabs").append(
        `<a class="button button-style" data-tab="technosphere-machine"><i class="icon ra ra-sapphire"></i>Technosphere</a>`
    )    // Gather Memnosphere items
    let partyMemnospheres = [];
    try {
        const items = Array.from(sheet.actor?.items || []);
        partyMemnospheres = filterMemnospheres(items)
    } catch (e) {
        console.warn("Could not get Memnosphere items from party inventory", e);
    }let characterMemnospheres = [];
    try {
        const items = Array.from(game.user.character?.items || []);
        characterMemnospheres = filterMemnospheres(items)
    } catch (e) {
        console.warn("Could not get Memnosphere items from player's inventory", e);
    }

    let existingSphereUUID = getFlag(sheet, FLAG_EXISTINGSPHERE)
    if(existingSphereUUID && !partyMemnospheres.find(v => v.uuid == existingSphereUUID)) {
        await SetFlagWithoutRender(sheet.document, ModuleName, FLAG_EXISTINGSPHERE, null)
    }
    
    // Render and append the Technosphere section
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

    // Bind UI elements
    bindUUIDInput(sheet, html, 'ts-sphere-table', FLAG_ROLLTABLE, "RollTable")
    bindMemnosphereSelectionToFlag(sheet, html, FLAG_EXISTINGSPHERE)
    
    // Handle Technosphere roll button
    html.find('.technosphere-roll').unbind('click').bind('click', async (event) => {
        event.preventDefault(); 

        let query = {
            rollTableUUID: getFlag(sheet, FLAG_ROLLTABLE),
            actorUUID: getCharacter().uuid,
            existingSphereUUID: getFlag(sheet, FLAG_EXISTINGSPHERE),
        }

        let [sphere, existingItem] = await rollMemnosphere(query)
        if(existingItem) {
            await existingItem.update({system: {description: sphere.createDescription() } })
        }
        else {
            await sheet.actor.createEmbeddedDocuments("Item", [sphere.createItemData()]);
        }

        sheet.activateTab("technosphere-machine");
        return false
    });
})

Hooks.on(`renderFUStandardActorSheet`, async (sheet: any, html: any) => {
    const FLAG_BASESHEET = 'technosphere-base-sheet'

    // Add Technosphere settings
    let settings = html.find(`.settings`)
    settings.prepend(await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/technosphere-settings.hbs", 
        {
            baseSheet: getFlag(sheet, FLAG_BASESHEET),
        }
    ))

    // Bind UI elements
    bindUUIDInput(sheet, html, 'ts-baseSheet', FLAG_BASESHEET, "ActorSheet")

    // Handle Apply Technosphere button
    html.find('.technosphere-apply').unbind('click').bind('click', async event => {
        event.target.disabled = true
        try {
            const baseSheetActor = fromUuidSync(getFlag(sheet, FLAG_BASESHEET));
            if (!baseSheetActor) {
                ui.notifications.error("Invalid Base Sheet UUID. Please ensure the UUID refers to an existing Actor.");
                return;
            }
            const currentActor = sheet.object
            await recomputeTechnosphereSheet(currentActor, baseSheetActor)
            ui.notifications.info(`Technosphere recomputation applied to ${currentActor.name}.`);
        } catch(error) {
            console.error("Error applying Technosphere recomputation:", error)
            ui.notifications.error("An error occurred during Technosphere recomputation. Check console for details.");
        } finally {
            event.target.disabled = false
            Log("Technosphere recomputation process finished.")
        }
    });
})


Hooks.once("init", async () => {
    // Register socket events
    // game.socket.on(getEventName("rollMemnosphere"), socketFn(rollMemnosphere))

    // Load templates
    await loadTemplates(['modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/memnosphere-card.hbs'])
})

Handlebars.registerHelper('times', function(n: number, block: any) {
  let accum = '';
  for (let i = 0; i < n; ++i) {
    accum += block.fn({index: i});
  }
  return accum;
});

console.log("Technosphere Machine Initialized!")