import { Log } from "../core-config";
import { getTSFlag, setTSFlag } from "../utils/foundry-utils";

export const FLAG_PROPERTIES_ROLLTABLE = "mnemosphere-roll";

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
            }

            // Render and inject the properties pane
            const propertiesPane = await renderTemplate(
                "modules/fabula-ultima-technosphere-machine/templates/inject/roll-table/mnemosphere-properties.hbs",
                {}
            );
            const descriptionEditor = html.find(".editor.prosemirror").parent();
            descriptionEditor.after(propertiesPane);

            const mnemospherePane = html.find(".mnemosphere-properties");

            // Show/hide elements based on the flag
            if (isVisible) {
                editorMenu
                    .children()
                    .not('[data-action="toggle-mnemosphere-properties"]')
                    .hide();

                let container = html.find(".editor.prosemirror");
                container.height("auto");
                container.children(".editor-container").height(0).hide();

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
        }
    );
}
