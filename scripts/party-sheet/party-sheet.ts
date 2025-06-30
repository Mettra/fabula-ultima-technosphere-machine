import { getCharacter, Log, ModuleName } from "../core-config";
import {
    createMnemosphereDescription,
    createMnemosphereItemData,
    filterMnemospheres,
} from "../mnemosphere";
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

export const FLAG_ROLLTABLE = "technosphere-roll-table";
export const FLAG_EXISTINGSPHERE = "technosphere-existing-sphere";
export const FLAG_INFUSION_SKILL = "technosphere-infusion-skill";
export const FLAG_INFUSION_SPHERE = "technosphere-infusion-sphere";
export const FLAG_ROLL_COST = "technosphere-roll-cost";

// Note: Tab state is now stored in client settings, not flags
const SETTING_MAIN_TAB = "party-sheet-main-tab";
const SETTING_TECHNOSPHERE_TAB = "party-sheet-technosphere-tab";

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
                activeTab: game.settings.get(
                    ModuleName,
                    SETTING_TECHNOSPHERE_TAB
                ),
            }
        );
        html.find(".sheet-body").append(tsSection);

        // Restore main tab state if it was technosphere-machine
        const savedMainTab = game.settings.get(ModuleName, SETTING_MAIN_TAB);
        if (savedMainTab === "technosphere-machine") {
            // We need to wait for the next tick to ensure Foundry's tab system is ready
            setTimeout(() => {
                const tabs = sheet._tabs[0]; // Get the primary tab group
                if (tabs) {
                    tabs.activate("technosphere-machine");
                }
            }, 0);
        }

        // Intercept main tab changes to save state
        html.find(".sheet-tabs a[data-tab]").on("click", function (event) {
            const tabName = $(this).data("tab");
            game.settings.set(ModuleName, SETTING_MAIN_TAB, tabName);
        });

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
                const value = parseInt(
                    (event.currentTarget as HTMLInputElement).value
                );
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

                // Store the active tab state in client settings
                game.settings.set(ModuleName, SETTING_TECHNOSPHERE_TAB, tab);

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
    });
}
