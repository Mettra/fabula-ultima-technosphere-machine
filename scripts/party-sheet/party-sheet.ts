import {
    playInfusionAnimation,
    playMnemosphereAnimation,
} from "../animations/mnemosphere-animation";
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
                Relations.Mnemosphere.heroicskill.check(sphereId);
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

async function infuseSkillIntoMnemosphere(
    sphereItemUUID: UUID,
    skillUUID: UUID
) {
    let sphereId: Mnemosphere_ID;

    try {
        sphereId = Relations.Item.mnemosphere.expect(sphereItemUUID);
    } catch (e) {
        ui.notifications.error(
            `Mnemosphere item ${sphereItemUUID} is invalid! Ensure the item has ${MnemosphereHeader} at the start of the summary, and a link to the class RollTable.`
        );

        throw e;
    }

    let existingSkills = await resolveSkills(
        Relations.Mnemosphere.skill.get(sphereId) ?? []
    );

    const existingSkill = existingSkills[skillUUID];
    if (existingSkill && existingSkill.rank == existingSkill.maxRank) {
        ui.notifications.error(
            `This Mnemosphere already has the maximum rank for this skill.`
        );
        return false;
    }

    let newAbillityLinks = await createMnemosphereDescriptionBody([skillUUID]);
    let item = await fromUuid(sphereItemUUID);
    if (item && "system" in item) {
        // Get all skills for summary
        let allSkillUUIDs = [
            ...(Relations.Mnemosphere.skill.get(sphereId) ?? []),
            skillUUID,
        ];
        let heroicSkillUUID = Relations.Mnemosphere.heroicskill.check(sphereId);
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

        return true;
    }

    return false;
}

export function SetupPartySheetHooks() {
    Hooks.on(`renderFUPartySheet`, async (sheet: any, html: any) => {
        const FLAG_ROLLTABLE = "technosphere-roll-table";
        const FLAG_EXISTINGSPHERE = "technosphere-existing-sphere";
        const FLAG_INFUSION_SKILL = "technosphere-infusion-skill";
        const FLAG_INFUSION_SPHERE = "technosphere-infusion-sphere";

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

        // Handle Technosphere tab selection
        html.find('[data-action="select-technosphere-tab"]')
            .unbind("click")
            .bind("click", (event) => {
                event.preventDefault();
                const tab = $(event.currentTarget).data("tab");

                // Update button active state
                html.find(
                    '[data-action="select-technosphere-tab"]'
                ).removeClass("active");
                $(event.currentTarget).addClass("active");

                // Show/hide tab content
                html.find(".technosphere-tab-content").hide();
                html.find(
                    `.technosphere-tab-content[data-tab="${tab}"]`
                ).show();
            });

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

                // Generate new sphere
                const itemData = await generateNewMnemosphere(
                    getFlag(sheet, FLAG_ROLLTABLE)
                );

                await playMnemosphereAnimation({
                    itemName: itemData.name,
                    rarity: "common",
                    imageUrl: itemData.img,
                });

                sheet.actor.createEmbeddedDocuments("Item", [itemData]);
                return false;
            });

        // Set up drag data for Mnemosphere cards
        html.find('.Mnemosphere-card[draggable="true"]').on(
            "dragstart",
            (event) => {
                const uuid = event.currentTarget.dataset.uuid;
                const data = {
                    type: "Item",
                    uuid: uuid,
                };
                event.originalEvent.dataTransfer.setData(
                    "text/plain",
                    JSON.stringify(data)
                );
            }
        );

        // Handle Infusion UI
        const infusionSkillDropzone = html.find(".infusion-skill-dropzone");
        const infusionSphereSocket = html.find(".infusion-sphere-socket");
        const infuseButton = html.find(".infuse-button");

        // Helper to update dropzone appearance
        async function updateDropzone(dropzone, uuid, type) {
            if (!dropzone.length) return;
            const placeholder = dropzone.find(
                type === "skill" ? ".placeholder-text" : ".socket-placeholder"
            );
            const display = dropzone.find(
                type === "skill" ? ".skill-display" : ".sphere-display"
            );

            if (!uuid) {
                placeholder.show();
                display.hide();
                return;
            }

            const item = await fromUuid(uuid);

            if (item && "img" in item && "name" in item) {
                display.find("img").attr("src", item.img);
                if (type === "skill") {
                    display.find(".skill-name").text(item.name);
                }
                placeholder.hide();
                display.show();
            } else {
                placeholder.show();
                display.hide();
            }
        }

        // Initialize UI from flags
        await updateDropzone(
            infusionSkillDropzone,
            getFlag(sheet, FLAG_INFUSION_SKILL),
            "skill"
        );
        await updateDropzone(
            infusionSphereSocket,
            getFlag(sheet, FLAG_INFUSION_SPHERE),
            "sphere"
        );

        // Drag and drop for skill
        infusionSkillDropzone
            .on("dragover", (event) => {
                event.preventDefault();
                infusionSkillDropzone.addClass("drag-over");
            })
            .on("dragleave", () => {
                infusionSkillDropzone.removeClass("drag-over");
            })
            .on("drop", async (event) => {
                event.preventDefault();
                infusionSkillDropzone.removeClass("drag-over");
                try {
                    const data = JSON.parse(
                        event.originalEvent.dataTransfer.getData("text/plain")
                    );
                    if (data.type !== "Item" || !data.uuid) return;

                    const item = await fromUuid(data.uuid);
                    if (item?.type !== "skill") {
                        ui.notifications.warn(
                            "You can only drop skills in this area."
                        );
                        return;
                    }

                    await SetFlagWithoutRender(
                        sheet.document,
                        ModuleName,
                        FLAG_INFUSION_SKILL,
                        data.uuid
                    );
                    await updateDropzone(
                        infusionSkillDropzone,
                        data.uuid,
                        "skill"
                    );
                } catch (e) {
                    console.warn("Could not parse dropped data", e);
                }
            });

        // Drag and drop for sphere
        infusionSphereSocket
            .on("dragover", (event) => {
                event.preventDefault();
                infusionSphereSocket.addClass("drag-over");
            })
            .on("dragleave", () => {
                infusionSphereSocket.removeClass("drag-over");
            })
            .on("drop", async (event) => {
                event.preventDefault();
                infusionSphereSocket.removeClass("drag-over");
                try {
                    const data = JSON.parse(
                        event.originalEvent.dataTransfer.getData("text/plain")
                    );
                    if (data.type !== "Item" || !data.uuid) return;

                    const item = await fromUuid(data.uuid);
                    if (
                        item?.type !== "treasure" ||
                        !item.system.summary?.value.startsWith(
                            MnemosphereHeader
                        )
                    ) {
                        ui.notifications.warn(
                            "You can only drop Mnemospheres in this area."
                        );
                        return;
                    }

                    await SetFlagWithoutRender(
                        sheet.document,
                        ModuleName,
                        FLAG_INFUSION_SPHERE,
                        data.uuid
                    );
                    await updateDropzone(
                        infusionSphereSocket,
                        data.uuid,
                        "sphere"
                    );
                } catch (e) {
                    console.warn("Could not parse dropped data", e);
                }
            });

        // Handle Infuse button click
        infuseButton.on("click", async (event) => {
            event.preventDefault();

            const skillUUID = getFlag(sheet, FLAG_INFUSION_SKILL);
            const sphereUUID = getFlag(sheet, FLAG_INFUSION_SPHERE);

            if (!skillUUID || !sphereUUID) {
                ui.notifications.error(
                    "You must provide both a skill and a Mnemosphere to infuse."
                );
                return;
            }

            // TODO: Add cost check similar to rolling

            const success = await infuseSkillIntoMnemosphere(
                sphereUUID,
                skillUUID
            );

            if (success) {
                const skillItem = await fromUuid(skillUUID);
                const sphereItem = await fromUuid(sphereUUID);

                await playInfusionAnimation({
                    skill: { name: skillItem.name, imageUrl: skillItem.img },
                    sphere: { name: sphereItem.name, imageUrl: sphereItem.img },
                });

                // Clear flags and reset UI
                await SetFlagWithoutRender(
                    sheet.document,
                    ModuleName,
                    FLAG_INFUSION_SKILL,
                    null
                );
                await SetFlagWithoutRender(
                    sheet.document,
                    ModuleName,
                    FLAG_INFUSION_SPHERE,
                    null
                );
                await updateDropzone(infusionSkillDropzone, null, "skill");
                await updateDropzone(infusionSphereSocket, null, "sphere");
            }
        });
    });
}
