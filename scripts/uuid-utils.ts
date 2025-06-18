// UUID link parsing and manipulation utilities

export interface UUIDLink {
    uuid: UUID | null;
    name: string;
}

export const LinkRegex = /^@UUID\[(.+?)\](?:\{(.+?)\})?$/;

export async function parseUUIDLink(linkText: string): Promise<UUIDLink> {
    let results = LinkRegex.exec(linkText);
    if (!results || results.length < 2) {
        console.warn("Invalid UUID link format:", linkText);
        return { uuid: null, name: linkText };
    }

    const uuid = results[1] as UUID;
    let name = results[2]; // This will be undefined if {name} part is not present

    // If name is not provided, get it from the document
    if (!name) {
        try {
            const document = await fromUuid(uuid);
            name = document?.name || uuid;
        } catch (error) {
            console.warn("Failed to resolve UUID for name:", uuid, error);
            name = uuid;
        }
    }

    return { uuid, name };
}

export function createUUIDLink(link: UUIDLink): string {
    return `@UUID[${link.uuid}]{${link.name}}`;
}

export async function resolveCompendiumUUID(uuid: string) {
    const result = await fromUuid(uuid);
    if (result.pack !== "undefined") {
        let pack = game.packs.get(result.pack);
        return await pack.getDocument(result._id);
    }

    return result;
}
