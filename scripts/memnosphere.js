// Memnosphere class and related functionality

import { Log, MEMNOSPHERE_SPLIT_KEY } from "./core-config.js";
import { extractKVPairsFromLines, extractParagraphsAsLines, splitArray } from "./parsing-utils.js";
import { parseUUIDLink, UUIDLink } from "./uuid-utils.js";

/**
 * Represents a Memnosphere, which encapsulates abilities, a roll table, and an associated class.
 */
export class Memnosphere {
    /**
     * Constructs a new Memnosphere instance.
     * @param {object} [config={}] - Initial configuration for the Memnosphere.
     */
    constructor(config={}){
        this.abilities = []
        this.rollTable = []
        this.class = { uuid: "", name: "" }
        Object.assign(this,config);
    }

    /**
     * Extracts Memnosphere data from a Foundry VTT item's description.
     * @param {FUItem} item - The Foundry VTT item to extract data from.
     * @returns {Memnosphere|null} A new Memnosphere instance populated with extracted data.
     */
    static extractFromItem(item) {
        let result = new Memnosphere()

        let description = item.system.description
        let lines = extractParagraphsAsLines(description)
        lines = extractKVPairsFromLines(lines)

        if(lines.length == 0) {
            return null
        }

        // The last line is always the class definition
        const classLine = lines.pop()
        result.class = parseUUIDLink(classLine.key)

        // Split the remaining lines into abilities and roll table
        const [abilitiesKV, rolltableKV] = splitArray(lines, kv => kv.key == MEMNOSPHERE_SPLIT_KEY)

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
    }

    /**
     * Merges two arrays based on a find function and a merge function.
     * @param {Array<any>} arrayBase - The base array to merge into.
     * @param {Array<any>} arrayToMerge - The array whose elements will be merged.
     * @param {Function} findFn - A function to determine if elements should be merged.
     * @param {Function} mergeFn - A function to perform the merge operation on elements.
     * @returns {Array<any>} A new array containing the merged results.
     */
    static mergeArray(arrayBase, arrayToMerge, findFn, mergeFn) {
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
    }

    /**
     * Merges two arrays of abilities. Abilities with the same UUID have their ranks combined.
     */
    static mergeAbilities(baseAbilities, mergeAbilities) {
        return this.mergeArray(baseAbilities, mergeAbilities, 
            (b, v) => b.uuid === v.uuid,
            (b, v) => { b.rank += v.rank; }
        )
    }

    /**
     * Merges two arrays of roll table entries. Entries with the same name have their counts combined.
     */
    static mergeRollTable(baseRollTable, mergeRollTable) {
        return this.mergeArray(baseRollTable, mergeRollTable, 
            (b, v) => b.name === v.name,
            (b, v) => { b.count += v.count; }
        )
    }

    /**
     * Merges two Memnosphere instances.
     * @param {Memnosphere} sphere_base - The base Memnosphere.
     * @param {Memnosphere} sphere_merge - The Memnosphere to merge into the base.
     * @returns {Memnosphere|undefined} A new merged Memnosphere, or undefined if classes do not match.
     */
    static merge(sphere_base, sphere_merge) {
        if(sphere_base.class.uuid != sphere_merge.class.uuid) {
            ui.notifications.error(`You cannot merge memnospheres unless they have the same class! ${sphere_base.class.uuid} != ${sphere_merge.class.uuid}`);
            return
        }

        const mergedRollTable = Memnosphere.mergeRollTable(sphere_base.rollTable, sphere_merge.rollTable)
        const mergedAbilities = Memnosphere.mergeAbilities(sphere_base.abilities, sphere_merge.abilities)
        return new Memnosphere({abilities: mergedAbilities, rollTable : mergedRollTable, class: sphere_base.class });
    }

    /**
     * Creates an HTML string description for the Memnosphere.
     * @returns {string} The HTML formatted description.
     */
    createDescription() {
        let description = ""

        // Add abilities with their ranks
        for(let ability of this.abilities) {
            description += `<p>${UUIDLink(ability)} :: ${ability.rank}</p>`
        }

        // Add the split key
        description += `<p>${MEMNOSPHERE_SPLIT_KEY} :: 0</p>`

        // Add roll table entries with their counts
        for(let tbl of this.rollTable) {
            description += `<p>${tbl.name} :: ${tbl.count}</p>`
        }

        // Add the class information
        description += `<p>${UUIDLink(this.class)} :: 0</p>`

        return description
    }

    /**
     * Creates item data for a new Foundry VTT item.
     * @returns {object} Item data object.
     */
    createItemData() {
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

/**
 * Filters items to find Memnospheres and extract their data.
 * @param {Array} items - Array of items to filter.
 * @returns {Array} Array of objects with item and sphere properties.
 */
export function filterMemnospheres(items) {
    return items.filter(i => i.type === "treasure").map(i => {return {item: i, sphere: Memnosphere.extractFromItem(i)} } ).filter(i => i.sphere != null);
}
