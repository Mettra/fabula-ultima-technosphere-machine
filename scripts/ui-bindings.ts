// UI binding utilities for form elements and flags

import { Log, ModuleName, SetFlagWithoutRender } from "./core-config.js";
import {
    createMemnosphereDescriptionBody,
    filterMemnospheres,
} from "./memnosphere.js";

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

export function bindSelectToFlag(
    sheet: any,
    html: any,
    name: string,
    flag: string
): void {
    html.on(`change`, `select[name="${name}"]`, async (event: any) => {
        Log("Setting flag", flag, (event.target as HTMLSelectElement).value);
        await SetFlagWithoutRender(
            sheet.document,
            ModuleName,
            flag,
            (event.target as HTMLSelectElement).value
        );
    });
}

export function bindMemnosphereSelectionToFlag(
    sheet: any,
    html: any,
    flag: string
): void {
    const memnosphereCards = html.find('[data-action="selectMemnosphere"]');
    memnosphereCards.on("click", async (event) => {
        const selectedCard = $(event.currentTarget);
        const newUuid = selectedCard.data("uuid");

        await SetFlagWithoutRender(sheet.document, ModuleName, flag, newUuid);

        // Update visual selection
        memnosphereCards.removeClass("selected");
        selectedCard.addClass("selected");
    });
}

export function bindHeroicSkillPopup(
    sheet: any,
    html: any,
    memnosphereItemUUID: string
): void {
    const openButton = html.find(
        `[data-uuid="${memnosphereItemUUID}"] .heroic-skill-button`
    );
    openButton.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const memnosphereItem = (await fromUuid(memnosphereItemUUID)) as Item;

        const sphere = (await filterMemnospheres([memnosphereItem]))[0];
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
                        if (memnosphereItem) {
                            let newAbillityLinks =
                                await createMemnosphereDescriptionBody([
                                    data.uuid,
                                ]);
                            memnosphereItem.update({
                                system: {
                                    description:
                                        memnosphereItem.system.description +
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
