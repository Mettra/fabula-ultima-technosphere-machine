import "./extensions";

import { SetupActorSheetHooks } from "./actor-sheet/actor-sheet.js";
import {
    cleanupAnimationDevMode,
    initializeAnimationDevMode,
} from "./animations/animation-dev-manager.js";
import { DEV_MODE, Log } from "./core-config.js";
import { SetupMnemosphereCoreHooks } from "./mnemosphere-core.js";
import { SetupMnemosphereHooks } from "./mnemosphere.js";
import { SetupPartySheetHooks } from "./party-sheet/party-sheet.js";

Hooks.once("init", async () => {
    SetupMnemosphereHooks();
    SetupMnemosphereCoreHooks();
    SetupPartySheetHooks();
    SetupActorSheetHooks();

    // Register socket events
    await loadTemplates([
        "modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/Mnemosphere-card.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/mnemosphere-section.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/popups/heroic-skill-popup.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/animations/animation-overlay.hbs",
    ]);

    document.body.insertAdjacentHTML(
        "beforeend",
        await renderTemplate(
            "modules/fabula-ultima-technosphere-machine/templates/animations/animation-overlay.hbs",
            {
                // Add template params here
            }
        )
    );
});

Hooks.once("ready", async () => {
    // Initialize development mode if enabled
    if (DEV_MODE) {
        Log("Development mode enabled - initializing animation dev tools");
        initializeAnimationDevMode();
    }
});

Handlebars.registerHelper("times", function (n: number, block: any) {
    let accum = "";
    for (let i = 0; i < n; ++i) {
        accum += block.fn({ index: i });
    }
    return accum;
});

// Cleanup when module is disabled/reloaded
Hooks.on("hotReload", () => {
    if (DEV_MODE) {
        cleanupAnimationDevMode();
    }
});
