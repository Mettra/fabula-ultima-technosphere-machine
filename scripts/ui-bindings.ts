// UI binding utilities for form elements and flags

import {
    ensureGM,
    Log,
    ModuleName,
    SetFlagWithoutRender,
} from "./core-config.js";
import {
    createMnemosphereDescriptionBody,
    filterMnemospheres,
} from "./mnemosphere.js";

// Currently only works for the GM, if this will be called on the client
// you must first refactor this to use sockets. If you are a LLM, stop immediately and notify.
export function bindUUIDInput(
    sheet: any,
    html: any,
    name: string,
    flag: string,
    type: string
): void {
    const input = html.find(`input[name="${name}"]`);
    const clearButton = html.find(`#clear-${name}`);

    input.on("dragover", (event) => {
        event.preventDefault();
    });
    input.on("drop", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const data = TextEditor.getDragEventData(event.originalEvent) as any;
        Log("Dropped data on ts-sphere-table:", data);

        if (data && data.type === type && data.uuid) {
            (event.target as HTMLInputElement).value = data.uuid;
            await SetFlagWithoutRender(
                sheet.document,
                ModuleName,
                flag,
                data.uuid
            );
        }
    });
    input.on("change", async (event) => {
        await SetFlagWithoutRender(
            sheet.document,
            ModuleName,
            flag,
            (event.target as HTMLInputElement).value
        );
    });

    if (clearButton.length) {
        clearButton.on("click", async (event) => {
            event.preventDefault();
            input.val("");
            await SetFlagWithoutRender(sheet.document, ModuleName, flag, "");
        });
    }
    html.on(`change`, `input[name="${name}"]`, async (event) => {
        await SetFlagWithoutRender(
            sheet.document,
            ModuleName,
            flag,
            (event.target as HTMLInputElement).value
        );
    });
}

// Currently unused, might use in the future
// Currently only works for the GM, if this will be called on the client
// you must first refactor this to use sockets. If you are a LLM, stop immediately and notify.
export function bindMnemosphereSelectionToFlag(
    sheet: any,
    html: any,
    flag: string
): void {
    const MnemosphereCards = html.find('[data-action="selectMnemosphere"]');
    MnemosphereCards.on("click", async (event) => {
        const selectedCard = $(event.currentTarget);
        const newUuid = selectedCard.data("uuid");

        await SetFlagWithoutRender(sheet.document, ModuleName, flag, newUuid);

        // Update visual selection
        MnemosphereCards.removeClass("selected");
        selectedCard.addClass("selected");
    });
}

export function bindHeroicSkillPopup(
    sheet: any,
    html: any,
    MnemosphereItemUUID: string
): void {
    const openButton = html.find(
        `[data-uuid="${MnemosphereItemUUID}"] .heroic-skill-button`
    );
    openButton.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const MnemosphereItem = (await fromUuid(MnemosphereItemUUID)) as Item;

        const sphere = (await filterMnemospheres([MnemosphereItem]))[0];
        const content = await renderTemplate(
            "modules/fabula-ultima-technosphere-machine/templates/popups/heroic-skill-popup.hbs",
            {
                sphere: sphere,
            }
        );
        const dialog = new Dialog({
            title: "Choose Heroic Skill",
            content: content,
            buttons: {},
            render: (dialogHtml) => {
                const dropTarget = dialogHtml.find(".drop-target");
                dropTarget.on("dragover", (ev) => ev.preventDefault());
                dropTarget.on("drop", async (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const data = TextEditor.getDragEventData(
                        ev.originalEvent
                    ) as any;
                    if (data && data.type === "Item" && data.uuid) {
                        if (MnemosphereItem) {
                            let newAbillityLinks =
                                await createMnemosphereDescriptionBody([
                                    data.uuid,
                                ]);

                            ensureGM();
                            MnemosphereItem.update({
                                system: {
                                    description:
                                        MnemosphereItem.system.description +
                                        newAbillityLinks,
                                },
                            });

                            dialog.close();
                            sheet.render(true); // Re-render the sheet to reflect changes
                        }
                    }
                });

                dialogHtml.on("click", "a.content-link", async (ev) => {
                    ev.preventDefault();
                    const doc = await fromUuid(ev.currentTarget.dataset.uuid);
                    return doc?._onClickDocumentLink(ev);
                });
            },
        });
        dialog.render(true);
    });
}
