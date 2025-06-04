// Memnosphere class and related functionality
import { Log, MEMNOSPHERE_SPLIT_KEY } from "./core-config.js";
import { extractKVPairsFromLines, extractParagraphsAsLines, splitArray } from "./parsing-utils.js";
import { parseUUIDLink, UUIDLink as createUUIDLink } from "./uuid-utils.js";
export class Memnosphere {
    abilities;
    rollTable;
    class;
    constructor(config = {}) {
        this.abilities = [];
        this.rollTable = [];
        this.class = { uuid: "", name: "" };
        Object.assign(this, config);
    }
    static extractFromItem(item) {
        let result = new Memnosphere();
        let description = item.system.description;
        let lines = extractParagraphsAsLines(description);
        let kvPairs = extractKVPairsFromLines(lines);
        if (kvPairs.length == 0) {
            return null;
        }
        // The last line is always the class definition
        const classLine = kvPairs.pop();
        result.class = parseUUIDLink(classLine.key);
        // Split the remaining lines into abilities and roll table
        const [abilitiesKV, rolltableKV] = splitArray(kvPairs, kv => kv.key == MEMNOSPHERE_SPLIT_KEY);
        // Populate abilities array
        for (let kv of abilitiesKV) {
            let link = parseUUIDLink(kv.key);
            let doc = fromUuidSync(link.uuid);
            Log(doc);
            result.abilities.push({
                uuid: link.uuid,
                name: link.name,
                rank: parseInt(kv.value),
                img: doc.img,
                maxRank: (doc.type == "skill" ? doc.system.level.max : 1)
            });
        }
        // Populate roll table array
        for (let kv of rolltableKV) {
            result.rollTable.push({ name: kv.key, count: parseInt(kv.value) });
        }
        return result;
    }
    static mergeArray(arrayBase, arrayToMerge, findFn, mergeFn) {
        const mergedArray = [...arrayBase];
        arrayToMerge.forEach(v => {
            const existingIndex = mergedArray.findIndex(fV => findFn(v, fV));
            if (existingIndex !== -1) {
                mergeFn(mergedArray[existingIndex], v);
            }
            else {
                mergedArray.push(v);
            }
        });
        return mergedArray;
    }
    static mergeAbilities(baseAbilities, mergeAbilities) {
        return this.mergeArray(baseAbilities, mergeAbilities, (b, v) => b.uuid === v.uuid, (b, v) => { b.rank += v.rank; });
    }
    static mergeRollTable(baseRollTable, mergeRollTable) {
        return this.mergeArray(baseRollTable, mergeRollTable, (b, v) => b.name === v.name, (b, v) => { b.count += v.count; });
    }
    static merge(sphere_base, sphere_merge) {
        if (sphere_base.class.uuid != sphere_merge.class.uuid) {
            ui.notifications.error(`You cannot merge memnospheres unless they have the same class! ${sphere_base.class.uuid} != ${sphere_merge.class.uuid}`);
            return;
        }
        const mergedRollTable = Memnosphere.mergeRollTable(sphere_base.rollTable, sphere_merge.rollTable);
        const mergedAbilities = Memnosphere.mergeAbilities(sphere_base.abilities, sphere_merge.abilities);
        return new Memnosphere({ abilities: mergedAbilities, rollTable: mergedRollTable, class: sphere_base.class });
    }
    createDescription() {
        let description = ""; // Add abilities with their ranks
        for (let ability of this.abilities) {
            description += `<p>${createUUIDLink(ability)} :: ${ability.rank}</p>`;
        }
        // Add the split key
        description += `<p>${MEMNOSPHERE_SPLIT_KEY} :: 0</p>`;
        // Add roll table entries with their counts
        for (let tbl of this.rollTable) {
            description += `<p>${tbl.name} :: ${tbl.count}</p>`;
        }
        // Add the class information
        description += `<p>${createUUIDLink(this.class)} :: 0</p>`;
        return description;
    }
    createItemData() {
        const itemData = {
            name: `Memnosphere - ${this.class.name}`,
            img: this.class.uuid ? fromUuidSync(this.class.uuid)?.img || "icons/svg/item-bag.svg" : "icons/svg/item-bag.svg",
            type: "treasure",
            system: {
                description: this.createDescription()
            },
        };
        return itemData;
    }
}
export function filterMemnospheres(items) {
    return items.filter(i => i.type === "treasure").map(i => { return { item: i, sphere: Memnosphere.extractFromItem(i) }; }).filter(i => i.sphere != null);
}
