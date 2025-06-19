// UI binding utilities for form elements and flags

import { Log, ModuleName, SetFlagWithoutRender } from "./core-config.js";
import {
    createMnemosphereDescriptionBody,
    filterMnemospheres,
} from "./mnemosphere.js";

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

export function bindActorDropZone(
    sheet: any,
    html: any,
    name: string,
    flag: string
): void {
    const dropZone = html.find(`[data-name="${name}"]`);

    if (!dropZone.length) return;

    // Handle drag over
    dropZone.on("dragover", (event) => {
        event.preventDefault();
        dropZone.addClass("drag-hover");
        dropZone.css("border-color", "#007bff");
    });

    // Handle drag leave
    dropZone.on("dragleave", (event) => {
        event.preventDefault();
        dropZone.removeClass("drag-hover");
        dropZone.css("border-color", "#ccc");
    });

    // Handle drop
    dropZone.on("drop", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropZone.removeClass("drag-hover");
        dropZone.css("border-color", "#ccc");

        const data = TextEditor.getDragEventData(event.originalEvent) as any;
        Log("Dropped data on actor drop zone:", data);

        if (data && data.type === "Actor" && data.uuid) {
            // Update the flag
            await SetFlagWithoutRender(
                sheet.document,
                ModuleName,
                flag,
                data.uuid
            ); // Get the actor to show its name
            try {
                const actor = await fromUuid(data.uuid);
                if (actor && "name" in actor) {
                    // Update the drop zone content to show the linked actor
                    const removeButton = game.user.isGM
                        ? `
                        <button type="button" class="base-actor-remove-btn" data-tooltip="Remove Base Actor" title="Remove Base Actor">
                            <i class="fas fa-times"></i>
                        </button>
                    `
                        : "";

                    dropZone.html(`
                        <a class="content-link" data-uuid="${data.uuid}" data-id="${data.uuid}" data-type="Actor" data-tooltip="${data.uuid}">
                            <i class="fas fa-user"></i> ${actor.name}
                        </a>
                        ${removeButton}
                    `);

                    // Bind click handler for the new link
                    dropZone.find(".content-link").on("click", async (ev) => {
                        ev.preventDefault();
                        const doc = await fromUuid(
                            ev.currentTarget.dataset.uuid
                        );
                        return doc?._onClickDocumentLink?.(ev);
                    });
                }
            } catch (error) {
                console.warn("Could not resolve actor UUID:", data.uuid, error);
                // Fallback to showing just the UUID
                const removeButton = game.user.isGM
                    ? `
                    <button type="button" class="base-actor-remove-btn" data-tooltip="Remove Base Actor" title="Remove Base Actor">
                        <i class="fas fa-times"></i>
                    </button>
                `
                    : "";

                dropZone.html(`
                    <a class="content-link" data-uuid="${data.uuid}" data-id="${data.uuid}" data-type="Actor" data-tooltip="${data.uuid}">
                        <i class="fas fa-user"></i> Base Actor
                    </a>
                    ${removeButton}
                `);
            }
        }
    });

    // Handle clicks on existing content links
    dropZone.on("click", ".content-link", async (ev) => {
        ev.preventDefault();
        const doc = await fromUuid(ev.currentTarget.dataset.uuid);
        return doc?._onClickDocumentLink?.(ev);
    });

    // Handle remove button clicks
    dropZone.on("click", ".base-actor-remove-btn", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        // Reset the flag
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, "");

        // Update the drop zone to show the empty state
        dropZone.html(`
            <span class="drop-message">Drag an Actor here to set as base sheet</span>
        `);
    });
}
