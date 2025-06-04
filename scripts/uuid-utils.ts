// UUID link parsing and manipulation utilities

export interface UUIDLink {
    uuid: UUID | null;
    name: string;
}

export const LinkRegex = /^@UUID\[(.+)\]\{(.+)\}$/;

export function parseUUIDLink(linkText: string): UUIDLink {
    let results = LinkRegex.exec(linkText)
    if (!results || results.length < 3) {
        console.warn("Invalid UUID link format:", linkText);
        return { uuid: null, name: linkText };
    }
    return { uuid: results[1] as UUID, name: results[2] }
}

export function UUIDLink(link: UUIDLink): string {
    return `@UUID[${link.uuid}]{${link.name}}`;
}
