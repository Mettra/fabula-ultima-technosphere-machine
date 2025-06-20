// Mnemosphere core functionality for combining equipped mnemosphere skills/features without base actors

import { Log, ModuleName } from "./core-config.js";
import { Relations } from "./relation.js";
import {
    filterMnemospheres,
    ItemIsMnemosphere,
    resolveSkills,
} from "./mnemosphere.js";
import { createUUIDLink } from "./uuid-utils.js";

interface SkillContribution {
    level: number;
    sourceUuid: string;
    sourceName: string;
}

interface CombinedSkill {
    uuid: string;
    name: string;
    img: string;
    level: number;
    maxLevel: number;
    description: string;
    contributions: SkillContribution[];
    classType: string;
}

interface CombinedFeature {
    uuid: string;
    name: string;
    img: string;
    description: string;
    contributions: SkillContribution[];
}

interface CombinedSpell {
    uuid: string;
    name: string;
    img: string;
    description: string;
    contributions: SkillContribution[];
}

interface MnemosphereCombinationResult {
    skills: CombinedSkill[];
    features: CombinedFeature[];
    spells: CombinedSpell[]; // NEW
}

type MnemosphereItemType = "skill" | "feature" | "spell";

/**
 * Get all equipped mnemospheres for an actor
 */
function getEquippedMnemospheres(actor: any): string[] {
    return actor.getFlag(ModuleName, "equipped-mnemospheres") || [];
}

/**
 * A generic function to extract items (skills, features, spells) from equipped mnemospheres.
 * This reduces code duplication by handling the common logic for all item types.
 * OMG-DESIGN-2: Less is more
 */
async function extractItemsFromMnemospheres(
    equippedMnemosphereUuids: string[],
    itemType: MnemosphereItemType
): Promise<Map<string, SkillContribution[]>> {
    const itemMap = new Map<string, SkillContribution[]>();

    for (const mnemosphereUuid of equippedMnemosphereUuids) {
        try {
            const mnemosphereItem = await fromUuid(mnemosphereUuid as UUID);
            if (!mnemosphereItem) continue;

            const mnemosphereId = Relations.Item.mnemosphere.get(
                mnemosphereUuid as UUID
            );
            if (!mnemosphereId) continue;

            let itemUuids: string[] = [];

            switch (itemType) {
                case "skill":
                    itemUuids =
                        Relations.Mnemosphere.skill.get(mnemosphereId) || [];
                    break;
                case "spell":
                    itemUuids =
                        Relations.Mnemosphere.spell.get(mnemosphereId) || [];
                    break;
                case "feature":
                    const heroicSkillUuid =
                        Relations.Mnemosphere.heroicskill.get(mnemosphereId);
                    if (heroicSkillUuid) {
                        itemUuids.push(heroicSkillUuid);
                    }
                    const features =
                        Relations.Mnemosphere.feature.get(mnemosphereId) || [];
                    itemUuids.push(...features);
                    break;
            }

            for (const itemUuid of itemUuids) {
                if (!itemMap.has(itemUuid)) {
                    itemMap.set(itemUuid, []);
                }

                itemMap.get(itemUuid)!.push({
                    level: 1, // Each instance adds 1 level
                    sourceUuid: mnemosphereUuid,
                    sourceName: (mnemosphereItem as any).name,
                });
            }
        } catch (error) {
            Log(
                `Failed to process mnemosphere ${mnemosphereUuid} for ${itemType}s:`,
                error
            );
        }
    }

    return itemMap;
}

/**
 * Helper to resolve a document from a UUID, returning null if not found.
 * OMG-DESIGN-3: Keep it simple - Fail fast rather than creating fallbacks.
 */
async function resolveDocument(
    identifier: string,
    type: MnemosphereItemType
): Promise<{ doc: any; uuid: string } | null> {
    try {
        const doc = await fromUuid(identifier as UUID);
        if (doc) {
            return { doc, uuid: identifier };
        }
    } catch (e) {
        Log(
            `Identifier '${identifier}' is not a valid UUID for ${type}, skipping.`
        );
    }

    Log(`Failed to resolve ${type} document for identifier: ${identifier}`);
    return null;
}

/**
 * Helper to safely extract an item's description.
 * OMG-DESIGN-3: Keep it simple - Centralizes complex/defensive access patterns.
 */
function getOriginalDescription(
    doc: any,
    identifier: string,
    type: string
): string {
    try {
        // Try direct system access first, then getter, then nested data
        return (
            doc.system?.description ||
            doc.description ||
            doc.system?.data?.description ||
            ""
        );
    } catch (error) {
        Log(`Failed to access description for ${type} ${identifier}:`, error);
        return "";
    }
}

/**
 * Combine skill contributions and create sphere skills
 */
async function combineSkills(
    allSkillContributions: Map<string, SkillContribution[]>
): Promise<CombinedSkill[]> {
    const combinedSkills: CombinedSkill[] = [];
    for (const [skillIdentifier, contributions] of allSkillContributions) {
        try {
            const resolvedDoc = await resolveDocument(skillIdentifier, "skill");
            if (!resolvedDoc) {
                Log(`Skipping unresolved skill: ${skillIdentifier}`);
                continue;
            }

            const { doc: skillDoc, uuid: skillUuid } = resolvedDoc;

            // Calculate total level (sum of all contributions, not max)
            const totalLevel = contributions.reduce(
                (sum, c) => sum + c.level,
                0
            );
            const maxPossibleLevel = (skillDoc as any).system?.level?.max || 5;
            const finalLevel = Math.min(totalLevel, maxPossibleLevel);

            // Get class type for level calculation
            const classType = (skillDoc as any).system?.class || "";

            // Create sources section for description
            const sourcesByLevel = new Map<number, SkillContribution[]>();
            for (const contribution of contributions) {
                if (!sourcesByLevel.has(contribution.level)) {
                    sourcesByLevel.set(contribution.level, []);
                }
                sourcesByLevel.get(contribution.level)!.push(contribution);
            }

            // Build sources text with HTML formatting
            let sourcesText = "<hr><h3>Sources:</h3>";
            const sortedLevels = Array.from(sourcesByLevel.keys()).sort(
                (a, b) => b - a
            );
            for (const level of sortedLevels) {
                const sources = sourcesByLevel.get(level)!;
                const sourceLinks = sources
                    .map((s) => `@UUID[${s.sourceUuid}]{${s.sourceName}}`)
                    .join(", ");
                sourcesText += `<p><strong>SL ${level}</strong> - ${sourceLinks}</p>`;
            }

            const originalDescription = getOriginalDescription(
                skillDoc,
                skillIdentifier,
                "skill"
            );
            const fullDescription = originalDescription + sourcesText;

            combinedSkills.push({
                uuid: skillUuid,
                name: `Mnemo - ${(skillDoc as any).name}`,
                img: (skillDoc as any).img,
                level: finalLevel,
                maxLevel: maxPossibleLevel,
                description: fullDescription,
                contributions: contributions,
                classType: classType,
            });
        } catch (error) {
            Log(`Failed to process skill ${skillIdentifier}:`, error);
        }
    }

    return combinedSkills;
}

/**
 * Combine feature contributions and create sphere features
 */
async function combineFeatures(
    allFeatureContributions: Map<string, SkillContribution[]>
): Promise<CombinedFeature[]> {
    const combinedFeatures: CombinedFeature[] = [];

    for (const [featureIdentifier, contributions] of allFeatureContributions) {
        try {
            const resolvedDoc = await resolveDocument(
                featureIdentifier,
                "feature"
            );
            if (!resolvedDoc) {
                Log(`Skipping unresolved feature: ${featureIdentifier}`);
                continue;
            }

            const { doc: featureDoc, uuid: featureUuid } = resolvedDoc;

            // Build sources text with HTML formatting
            let sourcesText = "<hr><h3>Sources:</h3>";

            // For features, group by source and show count if multiple instances
            const sourceGroups = new Map<string, number>();
            const sourceDetails = new Map<string, SkillContribution>();

            for (const contribution of contributions) {
                const key = `${contribution.sourceUuid}|${contribution.sourceName}`;
                sourceGroups.set(key, (sourceGroups.get(key) || 0) + 1);
                if (!sourceDetails.has(key)) {
                    sourceDetails.set(key, contribution);
                }
            }

            const sourceEntries = Array.from(sourceGroups.entries()).map(
                ([key, count]) => {
                    const detail = sourceDetails.get(key)!;
                    const link = `@UUID[${detail.sourceUuid}]{${detail.sourceName}}`;
                    return count > 1 ? `${link} (×${count})` : link;
                }
            );
            if (sourceEntries.length > 0) {
                sourcesText += `<p>${sourceEntries.join(", ")}</p>`;
            }

            const originalDescription = getOriginalDescription(
                featureDoc,
                featureIdentifier,
                "feature"
            );
            const fullDescription = originalDescription + sourcesText;

            combinedFeatures.push({
                uuid: featureUuid,
                name: `Mnemo - ${(featureDoc as any).name}`,
                img: (featureDoc as any).img,
                description: fullDescription,
                contributions: contributions,
            });
        } catch (error) {
            Log(`Failed to process feature ${featureIdentifier}:`, error);
        }
    }

    return combinedFeatures;
}

/**
 * Combine spell contributions and create sphere spells
 */
async function combineSpells(
    allSpellContributions: Map<string, SkillContribution[]>
): Promise<CombinedSpell[]> {
    const combinedSpells: CombinedSpell[] = [];

    for (const [spellIdentifier, contributions] of allSpellContributions) {
        try {
            const resolvedDoc = await resolveDocument(spellIdentifier, "spell");
            if (!resolvedDoc) {
                Log(`Skipping unresolved spell: ${spellIdentifier}`);
                continue;
            }

            const { doc: spellDoc, uuid: spellUuid } = resolvedDoc;

            // Sources
            const sourcesText = contributions
                .map((c) => `@UUID[${c.sourceUuid}]{${c.sourceName}}`)
                .join(", ");

            const originalDescription = getOriginalDescription(
                spellDoc,
                spellIdentifier,
                "spell"
            );

            const fullDescription =
                originalDescription +
                `<hr><h3>Sources:</h3><p>${sourcesText}</p>`;

            combinedSpells.push({
                uuid: spellUuid,
                name: `Mnemo - ${(spellDoc as any).name}`,
                img: (spellDoc as any).img,
                description: fullDescription,
                contributions,
            });
        } catch (error) {
            Log(`Failed to process spell ${spellIdentifier}:`, error);
        }
    }

    return combinedSpells;
}

/**
 * Main function to combine equipped mnemosphere skills/features
 */
export async function combineMnemosphereData(
    actor: any
): Promise<MnemosphereCombinationResult> {
    Log("Starting mnemosphere data combination for actor:", actor.name);

    // Get equipped mnemospheres
    const equippedMnemosphereUuids = getEquippedMnemospheres(actor);
    Log("Equipped mnemospheres:", equippedMnemosphereUuids);

    // Extract skill contributions from mnemospheres
    const skillContributions = await extractItemsFromMnemospheres(
        equippedMnemosphereUuids,
        "skill"
    );

    // Combine mnemosphere skills into sphere skills
    const sphereSkills = await combineSkills(skillContributions);

    // Extract feature contributions from mnemospheres
    const featureContributions = await extractItemsFromMnemospheres(
        equippedMnemosphereUuids,
        "feature"
    );

    // Combine mnemosphere features into sphere features
    const sphereFeatures = await combineFeatures(featureContributions);

    // Extract spells
    const spellContributions = await extractItemsFromMnemospheres(
        equippedMnemosphereUuids,
        "spell"
    );

    // Combine
    const sphereSpells = await combineSpells(spellContributions);

    const result: MnemosphereCombinationResult = {
        skills: sphereSkills,
        features: sphereFeatures,
        spells: sphereSpells, // NEW
    };

    Log("Mnemosphere combination result:", result);
    return result;
}

/**
 * Get the highest contributing mnemosphere for a given skill, feature, or spell
 */
function getHighestContributingMnemosphere(
    contributions: SkillContribution[]
): SkillContribution | null {
    if (!contributions || contributions.length === 0) {
        return null;
    }

    // Sort by level descending, then by name for consistency
    const sorted = contributions.sort((a, b) => {
        if (b.level !== a.level) {
            return b.level - a.level;
        }
        return a.sourceName.localeCompare(b.sourceName);
    });

    return sorted[0];
}

/**
 * Helper to safely resolve a document and convert it to JSON data.
 * OMG-DESIGN-3: Keep it simple - Centralizes document resolution logic.
 */
async function resolveDocumentToJson(
    uuid: string,
    itemName: string
): Promise<any | null> {
    try {
        const doc = await fromUuid(uuid as UUID);
        if (doc) {
            return (doc as any).toJSON();
        }
    } catch (error) {
        Log(`Failed to resolve UUID for ${itemName}:`, error);
    }
    return null;
}

/**
 * Helper to safely set description on item data with multiple fallback paths.
 * OMG-DESIGN-3: Keep it simple - Centralizes complex description setting logic.
 */
function setItemDescription(
    itemData: any,
    description: string,
    itemName: string
): void {
    try {
        if (!itemData.system) {
            itemData.system = {};
        }

        itemData.system.description = description;

        // Special case for class features that may store description in system.data
        if (itemData.type === "classFeature") {
            if (!itemData.system.data) {
                itemData.system.data = {};
            }
            itemData.system.data.description = description;
        }
    } catch (error) {
        Log(`Failed to set description for ${itemName}:`, error);
        // Ensure we have at least a basic system structure
        itemData.system = itemData.system || {};
        itemData.system.description = description;
    }
}

/**
 * Helper to add module-specific flags to item data.
 * OMG-DESIGN-4: Explicit is better than implicit - Makes flagging consistent.
 */
function addModuleFlags(
    itemData: any,
    itemType: "skill" | "feature" | "spell"
): void {
    itemData.flags = itemData.flags || {};
    itemData.flags[ModuleName] = {
        "generated-by-mnemosphere": true,
        [`is-sphere-${itemType}`]: true,
    };
}

/**
 * Helper to create skill item data from combined skill.
 * OMG-DESIGN-2: Less is more - Extracts skill-specific creation logic.
 */
async function createSkillItemData(skill: CombinedSkill): Promise<any> {
    const itemData = await resolveDocumentToJson(skill.uuid, skill.name);

    if (!itemData) {
        Log(`Failed to resolve skill item data for: ${skill.name}, skipping`);
        throw new Error(`Unable to resolve skill item data for ${skill.name}`);
    }

    // Update existing structure
    itemData.name = skill.name;
    itemData.system.level.value = skill.level;

    const highestContributor = getHighestContributingMnemosphere(
        skill.contributions
    );
    if (highestContributor) {
        itemData.system.class = {
            value: highestContributor.sourceName,
        };
    }

    setItemDescription(itemData, skill.description, skill.name);
    addModuleFlags(itemData, "skill");
    return itemData;
}

/**
 * Helper to create feature item data from combined feature.
 * OMG-DESIGN-2: Less is more - Extracts feature-specific creation logic.
 */
async function createFeatureItemData(feature: CombinedFeature): Promise<any> {
    const itemData = await resolveDocumentToJson(feature.uuid, feature.name);

    if (!itemData) {
        Log(
            `Failed to resolve feature item data for: ${feature.name}, skipping`
        );
        throw new Error(
            `Unable to resolve feature item data for ${feature.name}`
        );
    }

    itemData.name = feature.name;
    setItemDescription(itemData, feature.description, feature.name);
    addModuleFlags(itemData, "feature");
    return itemData;
}

/**
 * Helper to create spell item data from combined spell.
 * OMG-DESIGN-2: Less is more - Extracts spell-specific creation logic.
 */
async function createSpellItemData(spell: CombinedSpell): Promise<any> {
    const itemData = await resolveDocumentToJson(spell.uuid, spell.name);

    if (!itemData) {
        Log(`Failed to resolve spell item data for: ${spell.name}, skipping`);
        throw new Error(`Unable to resolve spell item data for ${spell.name}`);
    }

    itemData.name = spell.name;
    setItemDescription(itemData, spell.description, spell.name);
    addModuleFlags(itemData, "spell");
    return itemData;
}

/**
 * Helper to safely create item data with error handling.
 * OMG-DESIGN-2: Less is more - Centralizes error handling for item creation.
 */
async function safeCreateItemData<T>(
    items: T[],
    createFunction: (item: T) => Promise<any>,
    itemTypeName: string
): Promise<any[]> {
    const itemsToCreate: any[] = [];

    for (const item of items) {
        try {
            const itemData = await createFunction(item);
            itemsToCreate.push(itemData);
        } catch (error) {
            Log(
                `Failed to create ${itemTypeName} item for ${
                    (item as any).name
                }:`,
                error
            );
        }
    }

    return itemsToCreate;
}

/**
 * Update actor with combined mnemosphere data without causing disruptive re-renders
 */
export async function updateActorWithMnemosphereData(
    actor: any
): Promise<void> {
    Log("Updating actor with mnemosphere data:", actor.name);

    try {
        // Get combined data
        const combinedData = await combineMnemosphereData(actor);

        // Remove old sphere items - be specific to avoid deleting actual Mnemospheres
        const itemsToDelete = [];
        for (const item of actor.items) {
            // Only delete items that are explicitly marked as generated by our module
            const isGenerated = item.getFlag(
                ModuleName,
                "generated-by-mnemosphere"
            );
            const isSphereNamed = ItemIsMnemosphere(item);

            // Only delete if it's marked as generated by us, or if it's a sphere-named item
            // but NOT if it's a treasure type (which Mnemospheres are)
            if (isGenerated || (isSphereNamed && item.type !== "treasure")) {
                itemsToDelete.push(item.id);
                Log(
                    `Marking for deletion: ${item.name} (type: ${item.type}, generated: ${isGenerated})`
                );
            }
        }

        if (itemsToDelete.length > 0) {
            await actor.deleteEmbeddedDocuments("Item", itemsToDelete);
            Log("Deleted old sphere items:", itemsToDelete.length);
        }

        // Create new items using helper functions
        const skillItems = await safeCreateItemData(
            combinedData.skills,
            createSkillItemData,
            "skill"
        );

        const featureItems = await safeCreateItemData(
            combinedData.features,
            createFeatureItemData,
            "feature"
        );

        const spellItems = await safeCreateItemData(
            combinedData.spells,
            createSpellItemData,
            "spell"
        );

        const allItemsToCreate = [
            ...skillItems,
            ...featureItems,
            ...spellItems,
        ];

        if (allItemsToCreate.length > 0) {
            await actor.createEmbeddedDocuments("Item", allItemsToCreate);
            Log("Created new sphere items:", allItemsToCreate.length);
        }

        Log("Successfully updated actor with mnemosphere data");
    } catch (error) {
        Log("Error updating actor with mnemosphere data:", error);
        throw error;
    }
}

/**
 * Clean up any pending timeouts for an actor to prevent memory leaks
 */
export function cleanupActorTimeouts(actor: any): void {
    if (actor._mnemosphereUpdateTimeout) {
        clearTimeout(actor._mnemosphereUpdateTimeout);
        delete actor._mnemosphereUpdateTimeout;
        Log(`Cleaned up pending timeout for actor: ${actor.name}`);
    }
}

/**
 * Clean up all module-related timeouts and resources
 */
export function cleanupMnemosphereCore(): void {
    // Clean up all actors with pending timeouts
    if (typeof game !== "undefined" && game.actors) {
        game.actors.forEach((actor: any) => {
            cleanupActorTimeouts(actor);
        });
    }
    Log("Mnemosphere core cleanup complete");
}

/**
 * Hook into mnemosphere equip/unequip events to trigger updates
 */
export function setupMnemosphereCoreHooks(): void {
    // Listen for flag changes that indicate mnemosphere equipment changes
    Hooks.on("updateActor", async (actor, changes, options, userId) => {
        // Check if equipped mnemospheres changed
        if (
            changes.flags?.[ModuleName]?.["equipped-mnemospheres"] !== undefined
        ) {
            Log("Mnemosphere equipment changed for actor:", actor.name);

            // Debounce updates to avoid rapid fire
            if (actor._mnemosphereUpdateTimeout) {
                clearTimeout(actor._mnemosphereUpdateTimeout);
            }

            actor._mnemosphereUpdateTimeout = setTimeout(async () => {
                try {
                    await updateActorWithMnemosphereData(actor);
                } catch (error) {
                    console.error(
                        "Failed to update actor with mnemosphere data:",
                        error
                    );
                    ui.notifications.error(
                        "Failed to update character with mnemosphere data."
                    );
                } finally {
                    // Always clean up timeout reference, even on error
                    delete actor._mnemosphereUpdateTimeout;
                }
            }, 500); // 500ms debounce
        }
    });

    // Clean up timeouts when actors are deleted to prevent memory leaks
    Hooks.on("deleteActor", (actor, options, userId) => {
        cleanupActorTimeouts(actor);
    });

    // Clean up all timeouts when module is reloaded/disabled
    Hooks.on("hotReload", () => {
        cleanupMnemosphereCore();
    });

    Log("Mnemosphere core hooks setup complete");
}
