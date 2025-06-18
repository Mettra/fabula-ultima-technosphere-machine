// Mnemosphere class and related functionality

import { Log, Mnemosphere_SPLIT_KEY, ModuleName } from "./core-config.js";
import {
    extractKVPairsFromLines,
    extractParagraphsAsLines,
    splitArray,
} from "./parsing-utils.js";
import { Mnemosphere_ID, Relations } from "./relation.js";
import { parseUUIDLink, createUUIDLink, type UUIDLink } from "./uuid-utils.js";

export const MnemosphereHeader = "Mnemosphere";

export function SetupMnemosphereHooks() {
    async function MnemosphereFromDescription(
        id: Mnemosphere_ID,
        description: string
    ) {
        Relations.Mnemosphere.ClearRelations(id);

        let lines = extractParagraphsAsLines(description);
        for (let i = 0; i < lines.length; ++i) {
            const link = await parseUUIDLink(lines[i]);
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
                if (item.system.summary.value?.startsWith(MnemosphereHeader)) {
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

export async function createMnemosphereSummary(
    skillUUIDs: UUID[],
    heroicSkillUUID?: UUID
) {
    let summaryParts = [MnemosphereHeader];

    if (skillUUIDs.length > 0) {
        const skills = await resolveSkills(skillUUIDs);
        const skillNames = Object.values(skills).map((skill: any) => {
            const rankSuffix = skill.maxRank > 1 ? ` ${skill.rank}` : "";
            return `${skill.name}${rankSuffix}`;
        });

        if (skillNames.length > 0) {
            summaryParts.push(skillNames.join(", "));
        }
    }

    if (heroicSkillUUID) {
        const heroicSkillDoc = await fromUuid(heroicSkillUUID);
        if (heroicSkillDoc) {
            summaryParts.push(heroicSkillDoc.name);
        }
    }

    return summaryParts.join(" - ");
}

export async function createMnemosphereDescription(uuids: UUID[]) {
    let description = "";
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

    // Extract skill UUIDs from description to create summary
    let skillUUIDs: UUID[] = [];
    let lines = extractParagraphsAsLines(description);

    for (let i = 0; i < lines.length; ++i) {
        const link = await parseUUIDLink(lines[i]);
        if (!link.uuid) continue;

        let doc = await fromUuid(link.uuid);
        if (doc && "type" in doc && doc.type === "skill") {
            skillUUIDs.push(doc.uuid);
        }
    }

    // Create summary
    const summary = await createMnemosphereSummary(skillUUIDs);

    const itemData = {
        name: `${className} Sphere`,
        img: classImg,
        type: "treasure",
        system: {
            description: description,
            summary: {
                value: summary,
            },
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
