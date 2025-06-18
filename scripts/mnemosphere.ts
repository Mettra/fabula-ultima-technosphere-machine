// Mnemosphere class and related functionality

import { Log, Mnemosphere_SPLIT_KEY, ModuleName } from "./core-config.js";
import {
    extractKVPairsFromLines,
    extractParagraphsAsLines,
    splitArray,
} from "./parsing-utils.js";
import { Mnemosphere_ID, Relations } from "./relation.js";
import { parseUUIDLink, createUUIDLink, type UUIDLink } from "./uuid-utils.js";

export const MnemosphereHeader = "<p>@Mnemosphere</p>";

export function SetupMnemosphereHooks() {
    async function MnemosphereFromDescription(
        id: Mnemosphere_ID,
        description: string
    ) {
        Relations.Mnemosphere.ClearRelations(id);

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

            Log(`Mnemosphere ${id} adding`, doc);

            if (doc.documentName === "RollTable") {
                Relations.Mnemosphere.class.define(id, doc.uuid);
            } else if (doc.type === "skill") {
                Relations.Mnemosphere.skill.define(id, doc.uuid);
            } else if (doc.type === "heroic") {
                Relations.Mnemosphere.heroicskill.define(id, doc.uuid);
            } else {
                Relations.Mnemosphere.uuid.define(id, doc.uuid);
            }
        }

        Log(`Mnemosphere ${id} done!`);
        return id;
    }

    // Mnemosphere data hooks
    Hooks.on("ready", async () => {
        async function processItems(items, _ctx) {
            items.forEach(async (item) => {
                // Added async here
                if (item.system.description?.startsWith(MnemosphereHeader)) {
                    let MnemosphereId = Relations.Mnemosphere.GetNextId();
                    Relations.Item.Mnemosphere.define(item.uuid, MnemosphereId);
                    await MnemosphereFromDescription(
                        MnemosphereId,
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
        // We only care about updates to the description, since that's where Mnemosphere data exists
        if (item.system?.description === undefined) return;
        const description = item.system.description;
        const descriptionIsMnemosphere =
            description?.startsWith(MnemosphereHeader);
        if (!descriptionIsMnemosphere) return;

        let MnemosphereId = Relations.Mnemosphere.GetNextId();
        Relations.Item.Mnemosphere.define(item.uuid, MnemosphereId);
        await MnemosphereFromDescription(MnemosphereId, description);
    });

    Hooks.on("updateItem", async (item, changes, options, userId) => {
        Log("updateItem", item, options, userId);
        // We only care about updates to the description, since that's where Mnemosphere data exists
        if (changes.system?.description === undefined) return;
        const description = changes.system.description;
        const descriptionIsMnemosphere =
            description?.startsWith(MnemosphereHeader);

        // Do we already know about this item as a Mnemosphere?
        let existingMnemosphereId = Relations.Item.Mnemosphere.get(item.uuid);
        if (existingMnemosphereId == undefined) {
            // If we didn't have an entry and it's not a Mnemosphere, nothing to do
            if (!descriptionIsMnemosphere) return;

            // Otherwise, link up the relation and generate the data
            let MnemosphereId = Relations.Mnemosphere.GetNextId();
            Relations.Item.Mnemosphere.define(item.uuid, MnemosphereId);
            await MnemosphereFromDescription(MnemosphereId, description);
            Log(`Generated new Mnemosphere ${MnemosphereId}`);
            return;
        } else {
            // For an update we always remove the Mnemosphere data
            Relations.Mnemosphere.ClearRelations(existingMnemosphereId);

            if (!descriptionIsMnemosphere) {
                // If a Mnemosphere we were tracking lost the underlying data, remove the link
                Relations.Item.Mnemosphere.remove(item.uuid);
                Log(`Removed Mnemosphere ${item.uuid}`);
            } else {
                // Otherwise, re-populate the data from the item description
                await MnemosphereFromDescription(
                    existingMnemosphereId,
                    description
                );
                Log(`Updated Mnemosphere ${existingMnemosphereId}`);
            }
        }
    });
}

export async function createMnemosphereDescriptionBody(uuids: UUID[]) {
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

export async function createMnemosphereDescription(uuids: UUID[]) {
    let description = MnemosphereHeader;
    description += await createMnemosphereDescriptionBody(uuids);
    return description;
}

export async function createMnemosphereItemData(
    classUUID: UUID,
    description: string
) {
    let className = "Unnamed Mnemosphere";
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

export async function filterMnemospheres(items: Item[]) {
    const skillsAndItems = items.map((i) => {
        const MnemosphereId = Relations.Item.Mnemosphere.get(i.uuid as UUID);
        if (!MnemosphereId) return null;

        return [
            Relations.Mnemosphere.skill.get(MnemosphereId),
            Relations.Mnemosphere.heroicskill.get(MnemosphereId),
            i,
        ];
    });

    let validMnemosphereItems = skillsAndItems.filter((obj) => obj != null);

    let result = validMnemosphereItems.map(async (obj) => {
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
interface MnemosphereAbility {
    uuid: UUID;
    name: string;
    rank: number;
    img: string;
    maxRank: number;
}

interface MnemosphereRollTableEntry {
    name: string;
    count: number;
}

interface MnemosphereClass {
    uuid: UUID;
    name: string;
}

interface MnemosphereConfig {
    abilities?: MnemosphereAbility[];
    rollTable?: MnemosphereRollTableEntry[];
    class?: MnemosphereClass;
}

export class Mnemosphere {
    abilities: MnemosphereAbility[];
    rollTable: MnemosphereRollTableEntry[];
    class: MnemosphereClass;

    constructor(config: MnemosphereConfig = {}) {
        this.abilities = []
        this.rollTable = []
        this.class = { uuid: "" as UUID, name: "" }
        Object.assign(this, config);
    }    static extractFromItem(item: any): Mnemosphere | null {
        let result = new Mnemosphere()

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
        const [abilitiesKV, rolltableKV] = splitArray(kvPairs, kv => kv.key == Mnemosphere_SPLIT_KEY)

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
    }    static mergeAbilities(baseAbilities: MnemosphereAbility[], mergeAbilities: MnemosphereAbility[]): MnemosphereAbility[] {
        return this.mergeArray(baseAbilities, mergeAbilities, 
            (b, v) => b.uuid === v.uuid,
            (b, v) => { b.rank += v.rank; }
        )
    }    static mergeRollTable(baseRollTable: MnemosphereRollTableEntry[], mergeRollTable: MnemosphereRollTableEntry[]): MnemosphereRollTableEntry[] {
        return this.mergeArray(baseRollTable, mergeRollTable, 
            (b, v) => b.name === v.name,
            (b, v) => { b.count += v.count; }
        )
    }    static merge(sphere_base: Mnemosphere, sphere_merge: Mnemosphere): Mnemosphere | undefined {
        if(sphere_base.class.uuid != sphere_merge.class.uuid) {
            ui.notifications.error(`You cannot merge Mnemospheres unless they have the same class! ${sphere_base.class.uuid} != ${sphere_merge.class.uuid}`);
            return
        }

        const mergedRollTable = Mnemosphere.mergeRollTable(sphere_base.rollTable, sphere_merge.rollTable)
        const mergedAbilities = Mnemosphere.mergeAbilities(sphere_base.abilities, sphere_merge.abilities)
        return new Mnemosphere({abilities: mergedAbilities, rollTable : mergedRollTable, class: sphere_base.class });
    }    createDescription(): string {
        let description = ""        // Add abilities with their ranks
        for(let ability of this.abilities) {
            description += `<p>${createUUIDLink(ability)} :: ${ability.rank}</p>`
        }

        // Add the split key
        description += `<p>${Mnemosphere_SPLIT_KEY} :: 0</p>`

        // Add roll table entries with their counts
        for(let tbl of this.rollTable) {
            description += `<p>${tbl.name} :: ${tbl.count}</p>`
        }

        // Add the class information
        description += `<p>${createUUIDLink(this.class)} :: 0</p>`

        return description
    }    createItemData(): any {
        const itemData = {
            name: `Mnemosphere - ${this.class.name}`,
            img: this.class.uuid ? fromUuidSync(this.class.uuid)?.img || "icons/svg/item-bag.svg" : "icons/svg/item-bag.svg",
            type: "treasure",
            system: {
                description: this.createDescription()
            },
        };
        return itemData
    }
}

export function filterMnemospheres(items: any[]): Array<{item: any, sphere: Mnemosphere}> {
    return items.filter(i => i.type === "treasure").map(i => {return {item: i, sphere: Mnemosphere.extractFromItem(i)} } ).filter(i => i.sphere != null);
}
*/
