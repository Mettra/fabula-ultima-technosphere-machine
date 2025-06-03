// UUID link parsing and manipulation utilities

/**
 * Regular expression to parse Foundry VTT UUID links.
 * Expected format: `@UUID[uuid]{name}`
 */
export const LinkRegex = /^@UUID\[(.+)\]\{(.+)\}$/;

/**
 * Parses a Foundry VTT UUID link string into an object containing the UUID and name.
 * @param {string} linkText - The UUID link string (e.g., `@UUID[Actor.abcdef]{My Actor}`).
 * @returns {{uuid: string, name: string}} An object with the extracted UUID and name.
 */
export function parseUUIDLink(linkText) {
    let results = LinkRegex.exec(linkText)
    if (!results || results.length < 3) {
        console.warn("Invalid UUID link format:", linkText);
        return { uuid: "", name: linkText };
    }
    return { uuid: results[1], name: results[2] }
}

/**
 * Creates a Foundry VTT UUID link string from an object containing UUID and name.
 * @param {{uuid: string, name: string}} link - An object with uuid and name properties.
 * @returns {string} The formatted UUID link string.
 */
export function UUIDLink(link) {
    return `@UUID[${link.uuid}]{${link.name}}`;
}
