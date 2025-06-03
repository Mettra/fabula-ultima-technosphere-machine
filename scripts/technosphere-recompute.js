// Technosphere sheet recomputation functionality

import { Log } from "./core-config.js";

/**
 * Recomputes and updates the items on an actor sheet based on a base actor.
 * @param {Actor} actor - The target actor whose items will be recomputed.
 * @param {Actor} baseActor - The base actor providing the source items.
 * @returns {Promise<void>}
 */
export async function recomputeTechnosphereSheet(actor, baseActor) {
    /**
     * Checks if an item is a Technosphere-influenced item type.
     * @param {Item} item - The item to check.
     * @returns {boolean} True if the item is a skill, class, or spell.
     */
    function isTechnosphereItemType(item) {
        let type = item.type
        return type == "skill" || type == "class" || type == "spell"
    }

    // Delete all existing Technosphere-influenced items
    const old_items = [];
    for(const item of actor.items) {
        if(!isTechnosphereItemType(item)) continue;
        old_items.push(item.id)
    }
    Log("Old items to delete:", old_items)
    await actor.deleteEmbeddedDocuments("Item", old_items);
    Log("Deleted old items from actor.")
    
    // Gather items from the base actor
    const updates = [];
    for(const item of baseActor.items){
        if(!isTechnosphereItemType(item)) continue;
        updates.push(item.toJSON());
    }
    Log("Items to update/create:", updates)

    // @TODO: Combine base features with technosphere features
    
    // Apply the updates
    await actor.createEmbeddedDocuments('Item', updates)
    Log("Applied new items to actor.")
}
