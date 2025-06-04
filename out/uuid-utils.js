// UUID link parsing and manipulation utilities
export const LinkRegex = /^@UUID\[(.+)\]\{(.+)\}$/;
export function parseUUIDLink(linkText) {
    let results = LinkRegex.exec(linkText);
    if (!results || results.length < 3) {
        console.warn("Invalid UUID link format:", linkText);
        return { uuid: null, name: linkText };
    }
    return { uuid: results[1], name: results[2] };
}
export function UUIDLink(link) {
    return `@UUID[${link.uuid}]{${link.name}}`;
}
