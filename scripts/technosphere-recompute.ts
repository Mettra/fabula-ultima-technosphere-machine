// Technosphere sheet recomputation functionality

import { Log } from "./core-config.js";

export async function recomputeTechnosphereSheet(actor: any, baseActor: any): Promise<void> {
    function isTechnosphereItemType(item: any): boolean {
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
