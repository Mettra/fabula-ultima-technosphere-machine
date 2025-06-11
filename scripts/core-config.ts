// Core configuration and constants for the Technosphere Machine module

export const ModuleName = "fabula-ultima-technosphere-machine";
export const SYSTEM = "projectfu";
export const MEMNOSPHERE_ROLL_COST = 500;
export const MEMNOSPHERE_SPLIT_KEY = "@ROLLTABLE";

const IS_DEBUG = TS_DEBUG;

// Development mode configuration
export const DEV_MODE = IS_DEBUG; // Set to false for production
export const ANIMATION_TEST_KEY = "KeyR";
export const ANIMATION_RELOAD_KEY = "KeyL"; // Changed from T to L to avoid browser tab conflict
export const ANIMATION_DEV_MODIFIER = "ctrlKey"; // Ctrl+R for testing, Ctrl+L for reloading

// Debug configuration
CONFIG.debug.hooks = IS_DEBUG;

// Conditional logging for debug purposes
let Log: any;
if (CONFIG.debug.hooks) {
    Log = console.log.bind(window.console, `${ModuleName} | `);
} else {
    Log = function () {};
}
export { Log };

export function getEventName(name: string): string {
    return `${ModuleName}.${name}`;
}

export function getCharacter(): any | null {
    const character =
        canvas.tokens.controlled.at(0)?.document.actor || game.user.character;
    return character;
}

export function getFlag(sheet: any, flagName: string): any | null {
    try {
        return sheet.document.getFlag(ModuleName, flagName);
    } catch (err) {
        console.error(`Failed to get flag '${flagName}':`, err);
        return null;
    }
}

export async function SetFlagWithoutRender(
    document: any,
    scope: string,
    key: string,
    value: any
): Promise<any> {
    const scopes = document.constructor.database.getFlagScopes();
    if (!scopes.includes(scope))
        throw new Error(
            `Flag scope "${scope}" is not valid or not currently active`
        );
    return document.update(
        {
            flags: {
                [scope]: {
                    [key]: value,
                },
            },
        },
        {
            render: false,
        }
    );
}
