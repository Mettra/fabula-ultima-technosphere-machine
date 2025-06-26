import { playInfusionAnimation } from "../animations/mnemosphere-animation";
import {
    ensureGM,
    getCharacter,
    Log,
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
import { synchronize } from "../socket";
import { bindHeroicSkillPopup, bindUUIDInput } from "../ui-bindings";
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

export async function generateNewMnemosphere(rollTableUUID: UUID) {
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

        ensureGM();
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

export const FLAG_ROLLTABLE = "technosphere-roll-table";
export const FLAG_EXISTINGSPHERE = "technosphere-existing-sphere";
export const FLAG_INFUSION_SKILL = "technosphere-infusion-skill";
export const FLAG_INFUSION_SPHERE = "technosphere-infusion-sphere";
export const FLAG_ROLL_COST = "technosphere-roll-cost";

/**
 * Get the roll cost for Mnemospheres from the party sheet, defaulting to 600 if not set
 */
export function getMnemosphereRollCost(partySheet: any): number {
    const cost = partySheet.getFlag(ModuleName, FLAG_ROLL_COST);
    return cost ?? 600;
}

export function SetupPartySheetHooks() {
    Hooks.on(`renderFUPartySheet`, async (sheet: any, html: any) => {
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

        // Render and append the Technosphere section
        let tsSection = await renderTemplate(
            "modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/technosphere-section.hbs",
            {
                isGM: game.user.isGM,
                rollableTable: sheet.document.getFlag(
                    ModuleName,
                    FLAG_ROLLTABLE
                ),
                rollCost: getMnemosphereRollCost(sheet.document),
                partyMnemospheres: partyMnemospheres,
                characterMnemospheres: characterMnemospheres,
            }
        );
        html.find(".sheet-body").append(tsSection);

        // GM SECTION
        {
            // Bind UI elements
            bindUUIDInput(
                sheet,
                html,
                "ts-sphere-table",
                FLAG_ROLLTABLE,
                "RollTable"
            );

            // Bind roll cost input
            html.find("#ts-roll-cost").on("change", async (event) => {
                const value = parseInt((event.currentTarget as HTMLInputElement).value) || 600;
                await sheet.document.setFlag(ModuleName, FLAG_ROLL_COST, value);
                ui.notifications.info(`Roll cost updated to ${value}.`);
            });

            // Bind roll cost reset button
            html.find("#clear-ts-roll-cost").on("click", async (event) => {
                event.preventDefault();
                await sheet.document.setFlag(ModuleName, FLAG_ROLL_COST, 600);
                html.find("#ts-roll-cost").val(600);
                ui.notifications.info("Roll cost reset to default.");
            });
        }

        //bindMnemosphereSelectionToFlag(sheet, html, FLAG_EXISTINGSPHERE);

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

                let actor = getCharacter();
                if (actor == null) {
                    ui.notifications.error(
                        `You must have an actor selected, or have chosen one to be your player character.`
                    );
                    return false;
                }

                await synchronize("roll-mnemosphere", {
                    actorUUID: actor.uuid,
                    partyUUID: sheet.actor.uuid,
                });
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

        // @NOTE
        // The calls to SetFlagWithoutRender here will need to be replaced with just setting data on the sheet
        // Since they're just used for UI, and the actual updates must be broadcast to the "server" (GM)

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
            sheet.document.getFlag(ModuleName, FLAG_INFUSION_SKILL),
            "skill"
        );
        await updateDropzone(
            infusionSphereSocket,
            sheet.document.getFlag(ModuleName, FLAG_INFUSION_SPHERE),
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

            const skillUUID = sheet.document.getFlag(
                ModuleName,
                FLAG_INFUSION_SKILL
            );
            const sphereUUID = sheet.document.getFlag(
                ModuleName,
                FLAG_INFUSION_SPHERE
            );

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
