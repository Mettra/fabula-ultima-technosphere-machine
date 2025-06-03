// Core configuration and constants for the Technosphere Machine module

export const ModuleName = "fabula-ultima-technosphere-machine"
export const SYSTEM = 'projectfu';
export const MEMNOSPHERE_ROLL_COST = 500
export const MEMNOSPHERE_SPLIT_KEY = "@ROLLTABLE"

// Debug configuration
CONFIG.debug.hooks = true

// Conditional logging for debug purposes
if (CONFIG.debug.hooks) var Log = console.log.bind(window.console)
else var Log = function(){}
export {Log};

/**
 * Generates a unique event name for the module.
 * @param {string} name - The base name of the event.
 * @returns {string} The fully qualified event name.
 */
export function getEventName(name) {
    return `${ModuleName}.${name}`
}

/**
 * Retrieves the currently controlled character actor, or the game user's character if no token is selected.
 * @returns {Actor|null} The character actor, or null if none is found.
 */
export function getCharacter() {
    const character = canvas.tokens.controlled.at(0)?.document.actor || game.user.character;
    return character
}

/**
 * Retrieves a flag from a Foundry VTT document (typically a sheet's document).
 * @param {FormApplication} sheet - The sheet object.
 * @param {string} flagName - The name of the flag to retrieve.
 * @returns {any|null} The value of the flag, or null if an error occurs or the flag is not set.
 */
export function getFlag(sheet, flagName) {
    try {
        return sheet.document.getFlag(ModuleName, flagName);
    } catch(err) {
        console.error(`Failed to get flag '${flagName}':`, err);
        return null
    }
}

export async function SetFlagWithoutRender(document, scope, key, value) {
    const scopes = document.constructor.database.getFlagScopes();
    if ( !scopes.includes(scope) ) throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
    return document.update({
        flags: {
            [scope]: {
                [key]: value
            }
        }
    }, {
        render: false    
    });
}