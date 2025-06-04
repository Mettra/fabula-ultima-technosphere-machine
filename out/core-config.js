// Core configuration and constants for the Technosphere Machine module
export const ModuleName = "fabula-ultima-technosphere-machine";
export const SYSTEM = 'projectfu';
export const MEMNOSPHERE_ROLL_COST = 500;
export const MEMNOSPHERE_SPLIT_KEY = "@ROLLTABLE";
// Debug configuration
CONFIG.debug.hooks = true;
// Conditional logging for debug purposes
let Log;
if (CONFIG.debug.hooks) {
    Log = console.log.bind(window.console);
}
else {
    Log = function () { };
}
export { Log };
export function getEventName(name) {
    return `${ModuleName}.${name}`;
}
export function getCharacter() {
    const character = canvas.tokens.controlled.at(0)?.document.actor || game.user.character;
    return character;
}
export function getFlag(sheet, flagName) {
    try {
        return sheet.document.getFlag(ModuleName, flagName);
    }
    catch (err) {
        console.error(`Failed to get flag '${flagName}':`, err);
        return null;
    }
}
export async function SetFlagWithoutRender(document, scope, key, value) {
    const scopes = document.constructor.database.getFlagScopes();
    if (!scopes.includes(scope))
        throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
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
