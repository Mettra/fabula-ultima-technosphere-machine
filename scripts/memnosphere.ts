// Memnosphere class and related functionality

import { Log, MEMNOSPHERE_SPLIT_KEY, ModuleName } from "./core-config.js";
import {
    extractKVPairsFromLines,
    extractParagraphsAsLines,
    splitArray,
} from "./parsing-utils.js";
import { Memnosphere_ID, Relations } from "./relation.js";
import { parseUUIDLink, createUUIDLink, type UUIDLink } from "./uuid-utils.js";

export const MemnosphereHeader = "<p>@MEMNOSPHERE</p>";

export function SetupMemnosphereHooks() {
    async function MemnosphereFromDescription(
        id: Memnosphere_ID,
        description: string
    ) {
        Relations.Memnosphere.ClearRelations(id);

        let lines = extractParagraphsAsLines(description);

        for (let i = 1; i < lines.length; ++i) {
            const link = parseUUIDLink(lines[i]);
            if (!link.uuid) continue;

            let doc = await fromUuid(link.uuid);
            if (doc == null) continue;

            // fromUuid should handle compendium linking, so direct resolution might be redundant
            // if (doc.pack) { // This check might be overly specific or handled by fromUuid
            //     doc = await fromUuid(doc.uuid);
            //     if(doc == null) continue;
            // }

            Log(`Memnosphere ${id} adding`, doc);

            if (doc.documentName === "RollTable") {
                Relations.Memnosphere.class.define(id, doc.uuid);
            } else if (doc.type === "skill") {
                Relations.Memnosphere.skill.define(id, doc.uuid);
            } else if (doc.type === "heroic") {
                Relations.Memnosphere.heroicskill.define(id, doc.uuid);
            } else {
                Relations.Memnosphere.uuid.define(id, doc.uuid);
            }
        }

        Log(`Memnosphere ${id} done!`);
        return id;
    }

    // Memnosphere data hooks
    Hooks.on("ready", async () => {
        async function processItems(items, _ctx) {
            items.forEach(async (item) => {
                // Added async here
                if (item.system.description?.startsWith(MemnosphereHeader)) {
                    let memnosphereId = Relations.Memnosphere.GetNextId();
                    Relations.Item.memnosphere.define(item.uuid, memnosphereId);
                    await MemnosphereFromDescription(
                        memnosphereId,
                        item.system.description
                    );
                }
            });
        }

        // After the game is fully initialized
        await processItems(game.items, null);
        game.actors.forEach(async (v) => {
            await processItems(v.items, v);
        });

        Relations.LogAll();
    });

    Hooks.on("createItem", async (item, options, userId) => {
        Log("createItem", item, options, userId);
        // We only care about updates to the description, since that's where memnosphere data exists
        if (item.system?.description === undefined) return;
        const description = item.system.description;
        const descriptionIsMemnosphere =
            description?.startsWith(MemnosphereHeader);
        if (!descriptionIsMemnosphere) return;

        let memnosphereId = Relations.Memnosphere.GetNextId();
        Relations.Item.memnosphere.define(item.uuid, memnosphereId);
        await MemnosphereFromDescription(memnosphereId, description);
    });

    Hooks.on("updateItem", async (item, changes, options, userId) => {
        Log("updateItem", item, options, userId);
        // We only care about updates to the description, since that's where memnosphere data exists
        if (changes.system?.description === undefined) return;
        const description = changes.system.description;
        const descriptionIsMemnosphere =
            description?.startsWith(MemnosphereHeader);

        // Do we already know about this item as a memnosphere?
        let existingMemnosphereId = Relations.Item.memnosphere.get(item.uuid);
        if (existingMemnosphereId == undefined) {
            // If we didn't have an entry and it's not a memnosphere, nothing to do
            if (!descriptionIsMemnosphere) return;

            // Otherwise, link up the relation and generate the data
            let memnosphereId = Relations.Memnosphere.GetNextId();
            Relations.Item.memnosphere.define(item.uuid, memnosphereId);
            await MemnosphereFromDescription(memnosphereId, description);
            Log(`Generated new memnosphere ${memnosphereId}`);
            return;
        } else {
            // For an update we always remove the memnosphere data
            Relations.Memnosphere.ClearRelations(existingMemnosphereId);

            if (!descriptionIsMemnosphere) {
                // If a memnosphere we were tracking lost the underlying data, remove the link
                Relations.Item.memnosphere.remove(item.uuid);
                Log(`Removed memnosphere ${item.uuid}`);
            } else {
                // Otherwise, re-populate the data from the item description
                await MemnosphereFromDescription(
                    existingMemnosphereId,
                    description
                );
                Log(`Updated memnosphere ${existingMemnosphereId}`);
            }
        }
    });
}

export async function createMemnosphereDescriptionBody(uuids: UUID[]) {
    let description = "";

    for (const uuid of uuids) {
        const doc = await fromUuid(uuid);
        if (doc)
            description += `<p>${createUUIDLink({
                uuid: uuid as UUID,
                name: doc.name,
            })}</p>`;
    }

    return description;
}

export async function createMemnosphereDescription(uuids: UUID[]) {
    let description = MemnosphereHeader;
    description += await createMemnosphereDescriptionBody(uuids);
    return description;
}

export async function createMemnosphereItemData(
    classUUID: UUID,
    description: string
) {
    let className = "Unnamed Memnosphere";
    let classImg = "icons/svg/item-bag.svg";

    const classDoc = await fromUuid(classUUID);
    if (classDoc) {
        className = classDoc.name || className;
        classImg = classDoc.img || classImg;
    }

    const itemData = {
        name: `Mnemosphere - ${className}`,
        img: classImg,
        type: "treasure",
        system: {
            description: description,
        },
    };
    return itemData;
}

export async function resolveSkills(skillUUIDs: UUID[]) {
    let skills = {};

    for (let uuid of skillUUIDs) {
        let skillDoc = await fromUuid(uuid);

        skills[uuid] ??= {
            name: skillDoc.name,
            img: skillDoc.img,
            uuid: skillDoc.uuid,
            maxRank: skillDoc.system.level.max,
            rank: 0,
        };

        skills[uuid].rank += 1;
    }

    return skills;
}

export async function filterMemnospheres(items: Item[]) {
    const skillsAndItems = items.map((i) => {
        const memnosphereId = Relations.Item.memnosphere.get(i.uuid as UUID);
        if (!memnosphereId) return null;

        return [
            Relations.Memnosphere.skill.get(memnosphereId),
            Relations.Memnosphere.heroicskill.get(memnosphereId),
            i,
        ];
    });

    let validMemnosphereItems = skillsAndItems.filter((obj) => obj != null);

    let result = validMemnosphereItems.map(async (obj) => {
        const skillUUIDs = (obj[0] || []) as UUID[];
        const heroicSkillUUID = obj[1] as UUID | undefined;
        const item = obj[2] as Item;

        const skills = await resolveSkills(skillUUIDs);
        let heroicSkill = null;
        if (heroicSkillUUID) {
            const heroicSkillDoc = await fromUuid(heroicSkillUUID);
            if (heroicSkillDoc) {
                heroicSkill = {
                    name: heroicSkillDoc.name,
                    img: heroicSkillDoc.img,
                    uuid: heroicSkillUUID,
                };
            }
        }

        return {
            name: item.name,
            img: item.img,
            uuid: item.uuid,
            abilities: skills,
            heroicSkill: heroicSkill,

            get totalSkillRanks() {
                return Object.values(this.abilities).reduce(
                    (total, skill: any) => total + skill.rank,
                    0
                );
            },

            get canChooseHeroicSkill() {
                return this.totalSkillRanks >= 5;
            },
        };
    });

    return await Promise.all(result);
}

/*
interface MemnosphereAbility {
    uuid: UUID;
    name: string;
    rank: number;
    img: string;
    maxRank: number;
}

interface MemnosphereRollTableEntry {
    name: string;
    count: number;
}

interface MemnosphereClass {
    uuid: UUID;
    name: string;
}

interface MemnosphereConfig {
    abilities?: MemnosphereAbility[];
    rollTable?: MemnosphereRollTableEntry[];
    class?: MemnosphereClass;
}

export class Memnosphere {
    abilities: MemnosphereAbility[];
    rollTable: MemnosphereRollTableEntry[];
    class: MemnosphereClass;

    constructor(config: MemnosphereConfig = {}) {
        this.abilities = []
        this.rollTable = []
        this.class = { uuid: "" as UUID, name: "" }
        Object.assign(this, config);
    }    static extractFromItem(item: any): Memnosphere | null {
        let result = new Memnosphere()

        let description = item.system.description
        let lines = extractParagraphsAsLines(description)
        let kvPairs = extractKVPairsFromLines(lines)

        if(kvPairs.length == 0) {
            return null
        }

        // The last line is always the class definition
        const classLine = kvPairs.pop()!
        result.class = parseUUIDLink(classLine.key)

        // Split the remaining lines into abilities and roll table
        const [abilitiesKV, rolltableKV] = splitArray(kvPairs, kv => kv.key == MEMNOSPHERE_SPLIT_KEY)

        // Populate abilities array
        for(let kv of abilitiesKV) {
            let link = parseUUIDLink(kv.key)
            let doc = fromUuidSync(link.uuid)
            Log(doc)
            result.abilities.push({
                uuid: link.uuid, 
                name: link.name, 
                rank: parseInt(kv.value), 
                img: doc.img, 
                maxRank: (doc.type == "skill" ? doc.system.level.max : 1)
            })
        }

        // Populate roll table array
        for(let kv of rolltableKV) {
            result.rollTable.push({name: kv.key, count: parseInt(kv.value)})
        }

        return result
    }    static mergeArray<T>(arrayBase: T[], arrayToMerge: T[], findFn: (a: T, b: T) => boolean, mergeFn: (a: T, b: T) => void): T[] {
        const mergedArray = [...arrayBase];

        arrayToMerge.forEach(v => {
            const existingIndex = mergedArray.findIndex(fV => findFn(v, fV));
            if (existingIndex !== -1) {
                mergeFn(mergedArray[existingIndex], v)
            } else {
                mergedArray.push(v);
            }
        });

        return mergedArray
    }    static mergeAbilities(baseAbilities: MemnosphereAbility[], mergeAbilities: MemnosphereAbility[]): MemnosphereAbility[] {
        return this.mergeArray(baseAbilities, mergeAbilities, 
            (b, v) => b.uuid === v.uuid,
            (b, v) => { b.rank += v.rank; }
        )
    }    static mergeRollTable(baseRollTable: MemnosphereRollTableEntry[], mergeRollTable: MemnosphereRollTableEntry[]): MemnosphereRollTableEntry[] {
        return this.mergeArray(baseRollTable, mergeRollTable, 
            (b, v) => b.name === v.name,
            (b, v) => { b.count += v.count; }
        )
    }    static merge(sphere_base: Memnosphere, sphere_merge: Memnosphere): Memnosphere | undefined {
        if(sphere_base.class.uuid != sphere_merge.class.uuid) {
            ui.notifications.error(`You cannot merge memnospheres unless they have the same class! ${sphere_base.class.uuid} != ${sphere_merge.class.uuid}`);
            return
        }

        const mergedRollTable = Memnosphere.mergeRollTable(sphere_base.rollTable, sphere_merge.rollTable)
        const mergedAbilities = Memnosphere.mergeAbilities(sphere_base.abilities, sphere_merge.abilities)
        return new Memnosphere({abilities: mergedAbilities, rollTable : mergedRollTable, class: sphere_base.class });
    }    createDescription(): string {
        let description = ""        // Add abilities with their ranks
        for(let ability of this.abilities) {
            description += `<p>${createUUIDLink(ability)} :: ${ability.rank}</p>`
        }

        // Add the split key
        description += `<p>${MEMNOSPHERE_SPLIT_KEY} :: 0</p>`

        // Add roll table entries with their counts
        for(let tbl of this.rollTable) {
            description += `<p>${tbl.name} :: ${tbl.count}</p>`
        }

        // Add the class information
        description += `<p>${createUUIDLink(this.class)} :: 0</p>`

        return description
    }    createItemData(): any {
        const itemData = {
            name: `Memnosphere - ${this.class.name}`,
            img: this.class.uuid ? fromUuidSync(this.class.uuid)?.img || "icons/svg/item-bag.svg" : "icons/svg/item-bag.svg",
            type: "treasure",
            system: {
                description: this.createDescription()
            },
        };
        return itemData
    }
}

export function filterMemnospheres(items: any[]): Array<{item: any, sphere: Memnosphere}> {
    return items.filter(i => i.type === "treasure").map(i => {return {item: i, sphere: Memnosphere.extractFromItem(i)} } ).filter(i => i.sphere != null);
}
*/
