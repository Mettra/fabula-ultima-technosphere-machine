// Core configuration and constants for the Technosphere Machine module

export const ModuleName = "fabula-ultima-technosphere-machine";
export const SYSTEM = "projectfu";
export const Mnemosphere_ROLL_COST = 500;
export const Mnemosphere_SPLIT_KEY = "@ROLLTABLE";

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

export function ensureGM() {
    if (game.user.id !== game.users.activeGM?.id) {
        throw Error("This function can only be executed by the GM!");
    }
}

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

    ensureGM();
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

/**
 * Get the display data for an item.
 * @returns {object|boolean} An object containing item display information, or false if this is not an item.
 * @property {string} qualityString - The item's summary.
 */
export function getItemDisplayData(item) {
    const relevantTypes = ["consumable", "treasure", "rule"];
    if (!relevantTypes.includes(item.type)) {
        return false;
    }

    // Retrieve and process the item's summary
    const summary = item.system.summary.value?.trim() || "";
    let qualityString = game.i18n.localize("FU.SummaryNone");

    // Parse the summary if it exists and is not empty
    if (summary) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(summary, "text/html");
        qualityString =
            doc.body.textContent || game.i18n.localize("FU.SummaryNone");
    }

    return {
        qualityString,
    };
}

/**
 * Generic helper function to process an array and apply a callback to each unique element,
 * accumulating results in a functional style.
 *
 * @template T The type of the array elements.
 * @template U The type of the accumulated result.
 * @param {T[]} arr The input array.
 * @param {U} initialValue The initial value for the accumulator.
 * @param {(acc: U, value: T, count: number) => U} callback The callback function to apply to each unique element.
 *                                                             It receives the accumulator, the unique value, and its count.
 * @returns {U} The final accumulated result.
 */
export function unique<T, U>(
    arr: T[],
    initialValue: U,
    callback: (acc: U, value: T, count: number) => U
): U {
    const counts = arr.reduce((acc: Map<T, number>, val: T) => {
        acc.set(val, (acc.get(val) || 0) + 1);
        return acc;
    }, new Map<T, number>());

    let accumulator = initialValue;
    for (const [value, count] of counts) {
        accumulator = callback(accumulator, value, count);
    }

    return accumulator;
}
