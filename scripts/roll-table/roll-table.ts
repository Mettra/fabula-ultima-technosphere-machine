import { Log } from "../core-config";
import { migrateRollTableDescriptionToFlags } from "../roll-table-utils";
import { getTSFlag, setTSFlag } from "../utils/foundry-utils";

export const FLAG_PROPERTIES_ROLLTABLE = "mnemosphere-rolltable";
export const FLAG_FORCE_RESULT = "mnemosphere-rolltable-force";
export const FLAG_ADD_SKILL = "mnemosphere-rolltable-skill";

export function SetupRollTableHooks() {
    Hooks.on(
        "renderRollTableConfig",
        async (sheet: RollTableConfig, html: JQuery) => {
            const sheetDoc = sheet.object as RollTable;
            Log("Rendering RollTableConfig", { sheet, html });

            const isVisible =
                getTSFlag(sheetDoc, FLAG_PROPERTIES_ROLLTABLE) ?? false;

            // Render and inject the toggle button
            const toggleButton = await renderTemplate(
                "modules/fabula-ultima-technosphere-machine/templates/inject/roll-table/mnemosphere-toggle.hbs",
                { isVisible }
            );
            const editorMenu = html.find(".editor-menu");
            editorMenu.append(toggleButton);

            let title = editorMenu.parent().parent().find("label");
            if (isVisible) {
                title.text("Mnemosphere Table Properties");
                migrateRollTableDescriptionToFlags(sheetDoc);
            }

            // Prepare data for properties pane
            const forceResult = getTSFlag(sheetDoc, FLAG_FORCE_RESULT);
            const addSkillUUID = getTSFlag(sheetDoc, FLAG_ADD_SKILL);
            const addSkillDoc = addSkillUUID
                ? await fromUuid(addSkillUUID)
                : null;

            // Render and inject the properties pane
            const propertiesPane = await renderTemplate(
                "modules/fabula-ultima-technosphere-machine/templates/inject/roll-table/mnemosphere-properties.hbs",
                {
                    resultNames: sheetDoc.results.map((r) => r.text),
                    forceResult: forceResult,
                    addSkillDoc: addSkillDoc,
                }
            );

            const editorContainer = html.find(".editor");

            const descriptionEditor = editorContainer.parent();
            descriptionEditor.after(propertiesPane);

            const mnemospherePane = html.find(".mnemosphere-properties");

            // Show/hide elements based on the flag
            if (isVisible) {
                editorMenu
                    .children()
                    .not('[data-action="toggle-mnemosphere-properties"]')
                    .hide();

                editorContainer.height("auto");
                editorContainer.children(".editor-container").height(0).hide();

                mnemospherePane.show();
            } else {
                mnemospherePane.hide();
            }

            // Bind click event
            html.find('[data-action="toggle-mnemosphere-properties"]').on(
                "click",
                async (event) => {
                    event.preventDefault();
                    const currentVisibility =
                        getTSFlag(sheetDoc, FLAG_PROPERTIES_ROLLTABLE) ?? false;
                    await setTSFlag(
                        sheetDoc,
                        FLAG_PROPERTIES_ROLLTABLE,
                        !currentVisibility
                    );
                    sheet.render(true);
                }
            );

            // Bind properties events
            html.find('[name="mnemosphere-force-result"]').on(
                "change",
                async (ev) => {
                    const target = ev.currentTarget as HTMLSelectElement;
                    await setTSFlag(
                        sheetDoc,
                        FLAG_FORCE_RESULT,
                        target.value || null
                    );
                    ui.notifications.info("Forced result updated.");
                }
            );

            html.find('[data-action="clear-add-skill"]').on(
                "click",
                async (ev) => {
                    ev.preventDefault();
                    await setTSFlag(sheetDoc, FLAG_ADD_SKILL, null);
                    sheet.render(true);
                }
            );

            // Activate drop zone
            new DragDrop({
                dropSelector: ".ts-drop-zone",
                callbacks: { drop: (event) => _onDrop(event, sheet) },
            }).bind(html[0]);
        }
    );
}

async function _onDrop(event: DragEvent, sheet: RollTableConfig) {
    event.stopPropagation();

    const data = TextEditor.getDragEventData(event);
    if (data.type !== "Item" || !data.uuid) return;

    const item = await Item.fromDropData(data);
    if (item?.type !== "skill") {
        ui.notifications.warn("You must drop a Skill item.");
        return;
    }

    await setTSFlag(sheet.object, FLAG_ADD_SKILL, data.uuid);
    sheet.render(true);
}

/**
 * Migrates all RollTables within a given compendium pack by moving specific
 * rules from their descriptions to document flags.
 * @param {string} compendiumId The ID of the compendium pack (e.g., "my-module.my-tables").
 */
export async function migrateCompendiumRollTables(compendiumId: string) {
    const pack = game.packs.get(compendiumId);
    if (!pack) {
        const message = `Compendium with ID "${compendiumId}" not found.`;
        ui.notifications.error(message);
        console.error(message);
        return;
    }
    if (pack.documentName !== "RollTable") {
        const message = `Compendium "${compendiumId}" does not contain RollTable documents.`;
        ui.notifications.error(message);
        console.error(message);
        return;
    }

    ui.notifications.info(
        `Starting migration for compendium: ${compendiumId}... Check the console (F12) for details.`
    );
    console.log(`[FUTM] Starting migration for compendium: ${compendiumId}`);

    const documents = await pack.getDocuments();
    let migratedCount = 0;

    for (const table of documents) {
        const migrated = await migrateRollTableDescriptionToFlags(table);
        if (migrated) {
            // If we migrate the table, also set that it's a mnemosphere table
            await setTSFlag(table, FLAG_PROPERTIES_ROLLTABLE, true);

            migratedCount++;
            console.log(`[FUTM] Migrated: ${table.name}`);
        }
    }

    const message = `Migration complete for ${compendiumId}. Migrated ${migratedCount} of ${documents.length} tables.`;
    ui.notifications.info(message);
    console.log(`[FUTM] ${message}`);
}
