// UI binding utilities for form elements and flags
import { Log, ModuleName, SetFlagWithoutRender } from "./core-config.js";
export function bindUUIDInput(sheet, html, name, flag, type) {
    const input = html.find(`input[name="${name}"]`);
    const clearButton = html.find(`#clear-${name}`);
    input.on('dragover', (event) => {
        event.preventDefault();
    });
    input.on('drop', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const data = TextEditor.getDragEventData(event.originalEvent);
        Log("Dropped data on ts-sphere-table:", data);
        if (data && data.type === type && data.uuid) {
            event.target.value = data.uuid;
            await SetFlagWithoutRender(sheet.document, ModuleName, flag, data.uuid);
        }
    });
    input.on('change', async (event) => {
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, event.target.value);
    });
    if (clearButton.length) {
        clearButton.on('click', async (event) => {
            event.preventDefault();
            input.val('');
            await SetFlagWithoutRender(sheet.document, ModuleName, flag, '');
        });
    }
    html.on(`change`, `input[name="${name}"]`, async (event) => {
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, event.target.value);
    });
}
export function bindSelectToFlag(sheet, html, name, flag) {
    html.on(`change`, `select[name="${name}"]`, async (event) => {
        Log("Setting flag", flag, event.target.value);
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, event.target.value);
    });
}
export function bindMemnosphereSelectionToFlag(sheet, html, flag) {
    const memnosphereCards = html.find('[data-action="selectMemnosphere"]');
    memnosphereCards.on('click', async (event) => {
        const selectedCard = $(event.currentTarget);
        const newUuid = selectedCard.data('uuid');
        await SetFlagWithoutRender(sheet.document, ModuleName, flag, newUuid);
        // Update visual selection
        memnosphereCards.removeClass('selected');
        selectedCard.addClass('selected');
    });
}
