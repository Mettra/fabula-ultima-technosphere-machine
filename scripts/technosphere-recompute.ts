// Technosphere sheet recomputation functionality

import { Log } from "./core-config.js";
import { updateActorWithMnemosphereData } from "./mnemosphere-core.js";

export async function recomputeTechnosphereSheet(
    actor: any,
    baseActor: any
): Promise<void> {
    Log("Starting technosphere recomputation for actor:", actor.name);

    // Use the new mnemosphere core functionality
    await updateActorWithMnemosphereData(actor);

    Log("Technosphere recomputation completed for actor:", actor.name);
}
