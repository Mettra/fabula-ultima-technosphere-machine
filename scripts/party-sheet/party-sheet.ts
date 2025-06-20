import { playMnemosphereAnimation } from "../animations/mnemosphere-animation";
import {
    getCharacter,
    getFlag,
    Log,
    Mnemosphere_ROLL_COST,
    ModuleName,
    SetFlagWithoutRender,
} from "../core-config";
import {
    createMnemosphereDescription,
    createMnemosphereDescriptionBody,
    createMnemosphereItemData,
    createMnemosphereSummary,
    filterMnemospheres,
    MnemosphereHeader,
    resolveSkills,
} from "../mnemosphere";
import { Mnemosphere_ID, Relations } from "../relation";
import { getDocumentFromResult, rollTableCustom } from "../roll-table-utils";
import {
    bindHeroicSkillPopup,
    bindMnemosphereSelectionToFlag,
    bindUUIDInput,
} from "../ui-bindings";
import { resolveCompendiumUUID } from "../uuid-utils";

async function rollClassUUID(rollTableUUID: UUID) {
    let rollTable = await resolveCompendiumUUID(rollTableUUID);
    if (!rollTable) {
        ui.notifications.error(
            `Invalid RollTable UUID provided: ${rollTableUUID}`
        );
        return;
    }

    let tableRoll = await rollTableCustom(rollTable, { recursive: false });
    Log("Class Mnemosphere Roll", tableRoll);

    if (tableRoll.results.length != 1) {
        ui.notifications.error(
            `The base Mnemosphere RollTable must only have one entry per possible result!`
        );
        return;
    }

    let classResult = tableRoll.results[0];
    let doc = await getDocumentFromResult(classResult);
    if (!doc) {
        ui.notifications.error(
            `Could not retrieve document for class result: ${classResult.text}`
        );
        return;
    }

    return doc.uuid;
}

async function rollMnemosphereAbility(
    classTableUUID: UUID,
    { initialAbility = false }
) {
    // Roll for abilities based on the class table
    let classAbilityTable = await fromUuid(classTableUUID);
    if (classAbilityTable == null) {
        ui.notifications.error(
            `UUID ${classTableUUID} is an invalid class table reference!`
        );
        return;
    }

    let abilityRoll = await rollTableCustom(classAbilityTable, {
        initialAbility: initialAbility,
    });
    Log("abilityRoll", abilityRoll);

    let rolledUUIDS = [];
    for (let result of abilityRoll.results) {
        let doc = await getDocumentFromResult(result);
        if (doc) {
            Log(`Adding result`, doc);
            rolledUUIDS.push(doc.uuid);
        } else {
            console.warn(
                `Could not retrieve document for ability result: ${result.text}`
            );
        }
    }

    return rolledUUIDS;
}

async function generateNewMnemosphere(rollTableUUID: UUID) {
    Log("Rolling new Mnemosphere");
    let classUUID = await rollClassUUID(rollTableUUID);
    let initialAbilities = await rollMnemosphereAbility(classUUID, {
        initialAbility: true,
    });

    let description = await createMnemosphereDescription([
        classUUID,
        ...initialAbilities,
    ]);
    return await createMnemosphereItemData(classUUID, description);
}

async function addAbilityToMnemosphere(sphereItemUUID: UUID) {
    const MAX_ITERATIONS = 100;
    let iter = 0;
    while (++iter < MAX_ITERATIONS) {
        let sphereId: Mnemosphere_ID;
        let classUUID: UUID;

        try {
            sphereId = Relations.Item.mnemosphere.expect(sphereItemUUID);
            classUUID = Relations.Mnemosphere.class.expect(sphereId);
        } catch (e) {
            ui.notifications.error(
                `Mnemosphere item ${sphereItemUUID} is invalid! Ensure the item has ${MnemosphereHeader} at the start of the summary, and a link to the class RollTable.`
            );

            throw e;
        }

        let existingSkills = await resolveSkills(
            Relations.Mnemosphere.skill.get(sphereId) ?? []
        );
        let newAbilities = await rollMnemosphereAbility(classUUID, {
            initialAbility: false,
        });
        let allValid = true;
        for (let uuid of newAbilities) {
            const existingSkill = existingSkills[uuid];
            if (existingSkill && existingSkill.rank == existingSkill.maxRank) {
                allValid = false;
                break;
            }
        }

        // If we rolled an invalid skill, try again
        if (!allValid) {
            continue;
        }
        let newAbillityLinks = await createMnemosphereDescriptionBody([
            ...newAbilities,
        ]);
        let item = await fromUuid(sphereItemUUID);
        if (item && "system" in item) {
            // Get all skills for summary
            let allSkillUUIDs = Relations.Mnemosphere.skill.get(sphereId) ?? [];
            let heroicSkillUUID =
                Relations.Mnemosphere.heroicskill.expect(sphereId);
            let summary = await createMnemosphereSummary(
                allSkillUUIDs,
                heroicSkillUUID
            );

            item.update({
                system: {
                    summary: {
                        value: summary,
                    },
                    description:
                        (item as any).system.description + newAbillityLinks,
                },
            });
        }
        break;
    }

    return iter < MAX_ITERATIONS;
}

export function SetupPartySheetHooks() {
    Hooks.on(`renderFUPartySheet`, async (sheet: any, html: any) => {
        const FLAG_ROLLTABLE = "technosphere-roll-table";
        const FLAG_EXISTINGSPHERE = "technosphere-existing-sphere";

        // Add Technosphere tab
        html.find(".sheet-tabs").append(
            `<a class="button button-style" data-tab="technosphere-machine"><i class="icon ra ra-sapphire"></i>Technosphere</a>`
        );

        // Gather Mnemosphere items
        let partyMnemospheres = [];
        try {
            const items = Array.from(sheet.actor?.items || []) as Item[];
            partyMnemospheres = await filterMnemospheres(items);
        } catch (e) {
            console.warn(
                "Could not get Mnemosphere items from party inventory",
                e
            );
        }

        let characterMnemospheres = [];
        try {
            const items = Array.from(game.user.character?.items || []);
            characterMnemospheres = await filterMnemospheres(items);
        } catch (e) {
            console.warn(
                "Could not get Mnemosphere items from player's inventory",
                e
            );
        }

        let existingSphereUUID = getFlag(sheet, FLAG_EXISTINGSPHERE);
        if (
            existingSphereUUID &&
            !partyMnemospheres.find((v) => v.uuid == existingSphereUUID)
        ) {
            await SetFlagWithoutRender(
                sheet.document,
                ModuleName,
                FLAG_EXISTINGSPHERE,
                null
            );
        }

        // Render and append the Technosphere section
        let tsSection = await renderTemplate(
            "modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/technosphere-section.hbs",
            {
                isGM: game.user.isGM,
                rollableTable: getFlag(sheet, FLAG_ROLLTABLE),
                existingSphere: existingSphereUUID,
                partyMnemospheres: partyMnemospheres,
                characterMnemospheres: characterMnemospheres,
            }
        );
        html.find(".sheet-body").append(tsSection);

        // Bind UI elements
        bindUUIDInput(
            sheet,
            html,
            "ts-sphere-table",
            FLAG_ROLLTABLE,
            "RollTable"
        );
        bindMnemosphereSelectionToFlag(sheet, html, FLAG_EXISTINGSPHERE);

        // Bind heroic skill popups
        for (const sphere of [...partyMnemospheres, ...characterMnemospheres]) {
            if (sphere.canChooseHeroicSkill) {
                bindHeroicSkillPopup(sheet, html, sphere.uuid);
            }
        }

        // Handle Technosphere roll button
        html.find(".technosphere-roll")
            .unbind("click")
            .bind("click", async (event) => {
                event.preventDefault();

                // Check and pay the cost to roll
                let actor = getCharacter();
                if (actor == null) {
                    ui.notifications.error(
                        `You must have an actor selected, or have chosen one to be your player character.`
                    );
                    return;
                }

                const currentZenit = actor.system.resources.zenit.value;
                if (currentZenit < Mnemosphere_ROLL_COST) {
                    ui.notifications.error(
                        `You must have at least ${Mnemosphere_ROLL_COST} ${game.i18n.localize(
                            "FU.Zenit"
                        )} to create a new Mnemosphere.`
                    );
                    return;
                }
                await actor.update({
                    "system.resources.zenit.value":
                        currentZenit - Mnemosphere_ROLL_COST,
                } as any);

                let sphereItemUUID = getFlag(sheet, FLAG_EXISTINGSPHERE);

                // No Mnemosphere selected means generate a new one
                if (sphereItemUUID == null || sphereItemUUID == "") {
                    const itemData = await generateNewMnemosphere(
                        getFlag(sheet, FLAG_ROLLTABLE)
                    );
                    // TODO: Get proper image URL and rarity for the animation
                    await playMnemosphereAnimation({
                        itemName: itemData.name,
                        rarity: "common",
                        imageUrl: itemData.img,
                    }); // Added animation call
                    sheet.actor.createEmbeddedDocuments("Item", [itemData]);
                } else {
                    await addAbilityToMnemosphere(sphereItemUUID);
                }

                sheet.activateTab("technosphere-machine");
                return false;
            });
    });
}
