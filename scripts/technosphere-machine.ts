import "./extensions";

import { SetupActorSheetHooks } from "./actor-sheet/actor-sheet.js";
import {
    cleanupAnimationDevMode,
    initializeAnimationDevMode,
} from "./animations/animation-dev-manager.js";
import { playMnemosphereAnimation } from "./animations/mnemosphere-animation";
import {
    DEV_MODE,
    Log,
    ModuleName,
} from "./core-config.js";
import { SetupMnemosphereCoreHooks } from "./mnemosphere-core.js";
import { SetupMnemosphereHooks } from "./mnemosphere.js";
import {
    FLAG_ROLLTABLE,
    generateNewMnemosphere,
    getMnemosphereRollCost,
    SetupPartySheetHooks,
} from "./party-sheet/party-sheet.js";
import {
    migrateCompendiumRollTables,
    SetupRollTableHooks,
} from "./roll-table/roll-table.js";
import { RegisterSynchronization, SetupSockets } from "./socket";

Hooks.once("init", async () => {
    SetupMnemosphereHooks();
    SetupMnemosphereCoreHooks();
    SetupPartySheetHooks();
    SetupActorSheetHooks();
    SetupRollTableHooks();
    SetupSockets();

    // Register client settings for per-user UI state
    game.settings.register(ModuleName, "party-sheet-main-tab", {
        name: "Party Sheet Main Tab",
        hint: "Current main tab selection in party sheet",
        scope: "client",
        config: false,
        type: String,
        default: "overview"
    });

    game.settings.register(ModuleName, "party-sheet-technosphere-tab", {
        name: "Party Sheet Technosphere Sub-Tab",
        hint: "Current technosphere sub-tab selection in party sheet", 
        scope: "client",
        config: false,
        type: String,
        default: "create"
    });

    // Register socket events
    await loadTemplates([
        "modules/fabula-ultima-technosphere-machine/templates/inject/party-sheet/Mnemosphere-card.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/mnemosphere-section.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/popups/heroic-skill-popup.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/animations/animation-overlay.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/inject/roll-table/mnemosphere-toggle.hbs",
        "modules/fabula-ultima-technosphere-machine/templates/inject/roll-table/mnemosphere-properties.hbs",
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

    // Modification Functionality
    RegisterSynchronization(
        "roll-mnemosphere",

        // GM
        async (params: any) => {
            // Check and pay the cost to roll
            let actor = await fromUuid(params.actorUUID);
            if (actor == null) {
                return {
                    success: false,
                    error: `You must have an actor selected, or have chosen one to be your player character.`,
                };
            }

            let party = await fromUuid(params.partyUUID);
            const rollCost = getMnemosphereRollCost(party);

            const currentZenit = actor.system.resources.zenit.value;
            if (currentZenit < rollCost) {
                return {
                    success: false,
                    error: `You must have at least ${rollCost} ${game.i18n.localize(
                        "FU.Zenit"
                    )} to create a new Mnemosphere.`,
                };
            }

            await actor.update({
                "system.resources.zenit.value":
                    currentZenit - rollCost,
            } as any);

            // Generate new sphere
            const itemData = await generateNewMnemosphere(
                party.getFlag(ModuleName, FLAG_ROLLTABLE)
            );
            party.createEmbeddedDocuments("Item", [itemData]);

            return {
                name: itemData.name,
                img: itemData.img,
            };
        },

        // On Success
        async (result) => {
            await playMnemosphereAnimation({
                itemName: result.name,
                rarity: "common",
                imageUrl: result.img,
            });
        }
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

Handlebars.registerHelper("eq", function (a: any, b: any) {
    return a === b;
});

// Cleanup when module is disabled/reloaded
Hooks.on("hotReload", () => {
    if (DEV_MODE) {
        cleanupAnimationDevMode();
    }
});

Hooks.once("ready", async () => {
    // Expose migration utility to the console for administrative use.
    // @ts-ignore
    window.FUTM_MIGRATION = {
        migrateCompendiumRollTables,
    };
    console.log(
        "FUTM | Migration tools available under `window.FUTM_MIGRATION`"
    );
});
