import { getCharacter, getEventName, getFlag, Log, MEMNOSPHERE_ROLL_COST, ModuleName, SetFlagWithoutRender, DEV_MODE } from "./core-config.js";
import { createMemnosphereDescription, createMemnosphereDescriptionBody, createMemnosphereItemData, filterMemnospheres, MemnosphereHeader, resolveSkills, SetupMemnosphereHooks } from "./memnosphere.js";
import { Memnosphere_ID, Relations } from "./relation.js";
import { getDocumentFromResult, rollTableCustom } from "./roll-table-utils.js";
import { recomputeTechnosphereSheet } from "./technosphere-recompute.js";
import { bindHeroicSkillPopup, bindMemnosphereSelectionToFlag, bindUUIDInput } from "./ui-bindings.js";
import { playMemnosphereAnimation } from "./animations/memnosphere-animation.js";
import { initializeAnimationDevMode, cleanupAnimationDevMode } from "./animations/animation-dev-manager.js";

// Setup foundry hooks for memnospheres
SetupMemnosphereHooks()

async function rollClassUUID(rollTableUUID : UUID) {
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

    return doc.uuid
}

async function rollMemnosphereAbility(classTableUUID : UUID, { initialAbility = false }) {
    // Roll for abilities based on the class table
    let classAbilityTable = await fromUuid(classTableUUID)
    if(classAbilityTable == null) {
        ui.notifications.error(`UUID ${classTableUUID} is an invalid class table reference!`);
        return
    }

    let abilityRoll = await rollTableCustom(classAbilityTable, {initialAbility: initialAbility})
    Log("abilityRoll", abilityRoll)

    let rolledUUIDS = []
    for(let result of abilityRoll.results) {
        let doc = await getDocumentFromResult(result)
        if (doc) {
            Log(`Adding result`, doc)
            rolledUUIDS.push(doc.uuid)
        } else {
            console.warn(`Could not retrieve document for ability result: ${result.text}`);
        }
    }

    return rolledUUIDS
}

async function generateNewMemnosphere(rollTableUUID : UUID) {
    Log("Rolling new Memnosphere")
    let classUUID = await rollClassUUID(rollTableUUID)
    let initialAbilities = await rollMemnosphereAbility(classUUID, {initialAbility : true})

    let description = await createMemnosphereDescription([classUUID, ...initialAbilities])
    return await createMemnosphereItemData(classUUID, description)
}

async function addAbilityToMemnosphere(sphereItemUUID : UUID) {
    const MAX_ITERATIONS = 100
    let iter = 0
    while(++iter < MAX_ITERATIONS) {
        let sphereId = Relations.Item.memnosphere.get(sphereItemUUID)
        let classUUID = Relations.Memnosphere.class.get(sphereId)
        if(classUUID == null) {
            ui.notifications.error(`Memnosphere item ${sphereItemUUID} is invalid! Ensure the item has ${MemnosphereHeader} at the start of the description, and a link to the class RollTable.`);
        }

        let existingSkills = await resolveSkills(Relations.Memnosphere.skill.get(sphereId) ?? [])
        let newAbilities = await rollMemnosphereAbility(classUUID, { initialAbility: false })
        let allValid = true
        for(let uuid of newAbilities) {
            const existingSkill = existingSkills[uuid]
            if(existingSkill && existingSkill.rank == existingSkill.maxRank) {
                allValid = false;
                break;
            }
        }
        
        // If we rolled an invalid skill, try again
        if(!allValid) {
            continue;
        }

        let newAbillityLinks = await createMemnosphereDescriptionBody([...newAbilities])
        let item = await fromUuid(sphereItemUUID)
        if (item && 'system' in item) {
            item.update({system: { description: (item as any).system.description + newAbillityLinks }})
        }
        break;
    }

    return iter < MAX_ITERATIONS
}


Hooks.on(`renderFUPartySheet`, async (sheet: any, html: any) => {
    const FLAG_ROLLTABLE = 'technosphere-roll-table'
    const FLAG_EXISTINGSPHERE = 'technosphere-existing-sphere'

    // Add Technosphere tab
    html.find(".sheet-tabs").append(
        `<a class="button button-style" data-tab="technosphere-machine"><i class="icon ra ra-sapphire"></i>Technosphere</a>`
    )    // Gather Memnosphere items
    let partyMemnospheres = [];    try {
        const items = Array.from(sheet.actor?.items || []) as Item[];
        partyMemnospheres = await filterMemnospheres(items)
    } catch (e) {
        console.warn("Could not get Memnosphere items from party inventory", e);
    }
    
    let characterMemnospheres = [];
    try {
        const items = Array.from(game.user.character?.items || []);
        characterMemnospheres = await filterMemnospheres(items)
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

    // Bind heroic skill popups
    for (const sphere of [...partyMemnospheres, ...characterMemnospheres]) {
        if (sphere.canChooseHeroicSkill) {
            bindHeroicSkillPopup(sheet, html, sphere.uuid);
        }
    }
    
    // Handle Technosphere roll button
    html.find('.technosphere-roll').unbind('click').bind('click', async (event) => {
        event.preventDefault(); 

        // Check and pay the cost to roll
        let actor = getCharacter()
        if(actor == null) {
            ui.notifications.error(`You must have an actor selected, or have chosen one to be your player character.`);
            return
        }

        const currentZenit = actor.system.resources.zenit.value;
        if(currentZenit < MEMNOSPHERE_ROLL_COST) {
            ui.notifications.error(`You must have at least ${MEMNOSPHERE_ROLL_COST} ${game.i18n.localize('FU.Zenit')} to create a new Memnosphere.`);
            return
        }
        await actor.update({'system.resources.zenit.value' : currentZenit - MEMNOSPHERE_ROLL_COST} as any)


        let sphereItemUUID = getFlag(sheet, FLAG_EXISTINGSPHERE)
        
        // No memnosphere selected means generate a new one
        if(sphereItemUUID == '') {
            const itemData = await generateNewMemnosphere(getFlag(sheet, FLAG_ROLLTABLE))
            // TODO: Get proper image URL and rarity for the animation
            await playMemnosphereAnimation({ itemName: itemData.name, rarity: "common", imageUrl: itemData.img }); // Added animation call
            sheet.actor.createEmbeddedDocuments("Item", [itemData])
        }        else {
            const item = await fromUuid(sphereItemUUID);
            await addAbilityToMemnosphere(sphereItemUUID)
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
    await loadTemplates([
        'modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/memnosphere-card.hbs',
        'modules/fabula-ultima-technosphere-machine/templates/popups/heroic-skill-popup.hbs',
        'modules/fabula-ultima-technosphere-machine/templates/animations/animation-overlay.hbs'
    ])

    document.body.insertAdjacentHTML('beforeend', await renderTemplate("modules/fabula-ultima-technosphere-machine/templates/animations/animation-overlay.hbs", {
        // Add template params here
    }))
})

Hooks.once("ready", async () => {
    // Initialize development mode if enabled
    if (DEV_MODE) {
        Log("Development mode enabled - initializing animation dev tools");
        initializeAnimationDevMode();
    }
})

Handlebars.registerHelper('times', function(n: number, block: any) {
  let accum = '';
  for (let i = 0; i < n; ++i) {
    accum += block.fn({index: i});
  }
  return accum;
});

// Cleanup when module is disabled/reloaded
Hooks.on("hotReload", () => {
    if (DEV_MODE) {
        cleanupAnimationDevMode();
    }
});

Log("Technosphere Machine Initialized!")