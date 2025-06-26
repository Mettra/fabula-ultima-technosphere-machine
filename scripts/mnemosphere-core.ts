// Mnemosphere core functionality for combining equipped mnemosphere skills/features without base actors

import { Log, ModuleName } from "./core-config.js";
import { Relations } from "./relation.js";
import { expectUUID } from "./uuid-utils.js";

export const MNEMOSPHERE_CORE_VERSION = "1";

interface SkillContribution {
    level: number;
    sourceUuid: string;
    sourceName: string;
}

interface FeatureContribution {
    sourceUuid: string;
    sourceName: string;
}

interface SpellContribution {
    sourceUuid: string;
    sourceName: string;
}

interface CombinedSkill {
    uuid: UUID;
    name: string;
    img: string;
    level: number;
    maxLevel: number;
    description: string;
    contributions: SkillContribution[];
    classType: string;
}

interface CombinedFeature {
    uuid: UUID;
    name: string;
    img: string;
    description: string;
    contributions: FeatureContribution[];
}

interface CombinedSpell {
    uuid: UUID;
    name: string;
    img: string;
    description: string;
    contributions: SpellContribution[];
}

interface MnemosphereCombinationResult {
    skills: CombinedSkill[];
    features: CombinedFeature[];
    spells: CombinedSpell[];
}

type MnemosphereItemType = "skill" | "feature" | "spell";

function prefix(name) {
    return `Mnemo - ${name}`;
}

/**
 * Get all equipped mnemospheres for an actor
 */
function getEquippedMnemospheres(actor: any): string[] {
    return actor.getFlag(ModuleName, "equipped-mnemospheres") || [];
}

/**
 * Get the current mnemosphere-core version stored on the actor
 */
function getActorMnemosphereCoreVersion(actor: any): string | null {
    return actor.getFlag(ModuleName, "mnemosphere-core-version") || null;
}

/**
 * Set the mnemosphere-core version on the actor
 */
async function setActorMnemosphereCoreVersion(
    actor: any,
    version: string
): Promise<void> {
    await actor.setFlag(ModuleName, "mnemosphere-core-version", version);
}

/**
 * Check if the actor's mnemosphere-core version is current
 */
function isActorMnemosphereCoreVersionCurrent(actor: any): boolean {
    const actorVersion = getActorMnemosphereCoreVersion(actor);
    return actorVersion === MNEMOSPHERE_CORE_VERSION;
}

/**
 * Extract items from equipped mnemospheres
 * @param equippedMnemosphereUuids - Array of UUIDs for equipped mnemospheres
 */
async function extractItemsFromMnemospheres(
    equippedMnemosphereUuids: string[]
) {
    let totalSkills = new Map<string, SkillContribution[]>();
    let totalFeatures = new Map<string, FeatureContribution[]>();
    let totalSpells = new Map<string, SpellContribution[]>();

    for (const mnemosphereUuid of equippedMnemosphereUuids) {
        const mnemosphereItem = await expectUUID(mnemosphereUuid as UUID);
        const mnemosphereId = Relations.Item.mnemosphere.expect(
            mnemosphereUuid as UUID
        );

        // Initialize maps for this mnemosphere
        let skills = Relations.Mnemosphere.skill.get(mnemosphereId);
        let features = [
            ...Relations.Mnemosphere.feature.get(mnemosphereId),
            ...Relations.Mnemosphere.heroicskill.get(mnemosphereId),
        ];
        let spells = Relations.Mnemosphere.spell.get(mnemosphereId);

        // Process skills
        skills.unique().forEach((skill) => {
            const skillUuid = skill.value as UUID;
            totalSkills.ensure(skillUuid, [])!.push({
                level: skill.count,
                sourceUuid: mnemosphereUuid,
                sourceName: mnemosphereItem.name,
            });
        });

        // Process features
        features.forEach((feature) => {
            const featureUuid = feature as UUID;
            totalFeatures.ensure(featureUuid, [])!.push({
                sourceUuid: mnemosphereUuid,
                sourceName: mnemosphereItem.name,
            });
        });

        // Process spells
        spells.forEach((spell) => {
            const spellUuid = spell as UUID;
            totalSpells.ensure(spellUuid, [])!.push({
                sourceUuid: mnemosphereUuid,
                sourceName: mnemosphereItem.name,
            });
        });
    }

    return {
        skills: totalSkills,
        features: totalFeatures,
        spells: totalSpells,
    };
}

/**
 * Helper to resolve a document from a UUID
 */
async function resolveDocument(identifier: string, type: MnemosphereItemType) {
    const doc = await fromUuid(identifier as UUID);
    if (doc) {
        return { doc, uuid: identifier };
    }

    throw Error(
        `Unable to resolve document ${identifier} (${type}) when merging Mnemospheres!`
    );
}

/**
 * Helper to safely extract an item's description.
 */
function getOriginalDescription(doc: any, identifier: string, type: string) {
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
            const { doc: skillDoc, uuid: skillUuid } = resolvedDoc;

            // Calculate total level
            const totalLevel = contributions.reduce(
                (sum, c) => sum + c.level,
                0
            );
            const maxPossibleLevel = (skillDoc as any).system?.level?.max || 5;
            const finalLevel = Math.min(totalLevel, maxPossibleLevel);

            // Get class type for level calculation
            const classType = (skillDoc as any).system?.class || "";

            const sortedLevels = contributions.sort(
                (a, b) => b.level - a.level
            );

            const originalDescription = getOriginalDescription(
                skillDoc,
                skillIdentifier,
                "skill"
            );

            combinedSkills.push({
                uuid: skillUuid as UUID,
                name: prefix(skillDoc.name),
                img: (skillDoc as any).img,
                level: finalLevel,
                maxLevel: maxPossibleLevel,
                description: originalDescription,
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
    allFeatureContributions: Map<string, FeatureContribution[]>
) {
    const combinedFeatures: CombinedFeature[] = [];

    for (const [featureIdentifier, contributions] of allFeatureContributions) {
        try {
            const resolvedDoc = await resolveDocument(
                featureIdentifier,
                "feature"
            );

            const { doc: featureDoc, uuid: featureUuid } = resolvedDoc;

            const originalDescription = getOriginalDescription(
                featureDoc,
                featureIdentifier,
                "feature"
            );

            combinedFeatures.push({
                uuid: featureUuid as UUID,
                name: prefix(featureDoc.name),
                img: (featureDoc as any).img,
                description: originalDescription,
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
    allSpellContributions: Map<string, SpellContribution[]>
): Promise<CombinedSpell[]> {
    const combinedSpells: CombinedSpell[] = [];

    for (const [spellIdentifier, contributions] of allSpellContributions) {
        try {
            const resolvedDoc = await resolveDocument(spellIdentifier, "spell");

            const { doc: spellDoc, uuid: spellUuid } = resolvedDoc;

            const originalDescription = getOriginalDescription(
                spellDoc,
                spellIdentifier,
                "spell"
            );

            combinedSpells.push({
                uuid: spellUuid as UUID,
                name: prefix(spellDoc.name),
                img: (spellDoc as any).img,
                description: originalDescription,
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
export async function combineMnemosphereData(actor: any) {
    const equippedMnemosphereUuids = getEquippedMnemospheres(actor);

    const extractedItems = await extractItemsFromMnemospheres(
        equippedMnemosphereUuids
    );

    return {
        skills: await combineSkills(extractedItems.skills),
        features: await combineFeatures(extractedItems.features),
        spells: await combineSpells(extractedItems.spells),
    };
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

function generateFlags(
    contributions?: SkillContribution[] | FeatureContribution[] | SpellContribution[]
) {
    const flags: any = {
        [ModuleName]: {
            "generated-by-mnemosphere": true,
        },
    };

    if (contributions && contributions.length > 0) {
        // Sort contributions by level (for skills) or by source name (for features/spells)
        const sortedContributions = [...contributions].sort((a, b) => {
            // Check if it's a skill contribution (has level property)
            if ("level" in a && "level" in b) {
                // Sort by level descending, then by source name
                if (b.level !== a.level) {
                    return b.level - a.level;
                }
                return a.sourceName.localeCompare(b.sourceName);
            } else {
                // For features and spells, sort by source name
                return a.sourceName.localeCompare(b.sourceName);
            }
        });

        flags[ModuleName]["mnemosphere-sources"] = sortedContributions.map(
            (c) => c.sourceUuid
        );
    }

    return flags;
}

async function createItems<T extends { uuid: UUID; contributions: any[] }>(
    items: T[],
    propertiesFn: (item: T) => {}
) {
    const itemsToCreate: any[] = [];

    for (const item of items) {
        const itemData = (await expectUUID(item.uuid)).toJSON();
        let properties = propertiesFn(item) as any;
        properties.flags = generateFlags(item.contributions);
        itemsToCreate.push(foundry.utils.mergeObject(itemData, properties));
    }

    return itemsToCreate;
}

/**
 * Update actor with combined mnemosphere data without causing disruptive re-renders
 */
export async function updateActorWithMnemosphereData(actor: any) {
    // Check if the current user has permission to update this actor
    if (!actor.isOwner && !game.user?.isGM) {
        Log(
            `User ${game.user?.name} lacks permission to update actor ${actor.name}`
        );
        return;
    }

    // Get combined data
    const combinedData = await combineMnemosphereData(actor);

    // Only delete items that are explicitly marked as generated by our module
    const itemsToDelete = [];
    for (const item of actor.items) {
        const isGenerated = item.getFlag(
            ModuleName,
            "generated-by-mnemosphere"
        );

        if (!isGenerated) {
            continue;
        }

        itemsToDelete.push(item.id);
    }

    if (itemsToDelete.length > 0) {
        await actor.deleteEmbeddedDocuments("Item", itemsToDelete);
    }

    // Create new items using helper functions
    const skillItems = await createItems(combinedData.skills, (item) => {
        return {
            name: item.name,
            system: {
                level: {
                    value: item.level,
                },
                class: {
                    value: getHighestContributingMnemosphere(item.contributions)
                        .sourceName,
                },
                description: item.description,
            },
        };
    });

    const featureItems = await createItems(combinedData.features, (item) => {
        return {
            name: item.name,
            system: {
                data: {
                    description: item.description,
                },
            },
        };
    });

    const spellItems = await createItems(combinedData.spells, (item) => {
        return {
            name: item.name,
            system: {
                description: item.description,
            },
        };
    });

    const allItemsToCreate = [...skillItems, ...featureItems, ...spellItems];

    if (allItemsToCreate.length > 0) {
        await actor.createEmbeddedDocuments("Item", allItemsToCreate);
        Log("Created new sphere items:", allItemsToCreate.length);
    }

    // Update the actor's mnemosphere-core version to mark it as current
    await setActorMnemosphereCoreVersion(actor, MNEMOSPHERE_CORE_VERSION);
    Log(`Updated actor ${actor.name} to mnemosphere-core version ${MNEMOSPHERE_CORE_VERSION}`);
}

/**
 * Update all actors that need a mnemosphere-core version update
 * This can be called when the module version changes to update all actors
 */
export async function updateAllActorsForVersionChange(): Promise<void> {
    const actors = game.actors?.contents || [];
    const outdatedActors = actors.filter(actor => 
        !isActorMnemosphereCoreVersionCurrent(actor) && 
        getEquippedMnemospheres(actor).length > 0
    );

    if (outdatedActors.length === 0) {
        Log("No actors need mnemosphere-core version updates");
        return;
    }

    Log(`Updating ${outdatedActors.length} actors for mnemosphere-core version change`);
    
    for (const actor of outdatedActors) {
        try {
            await updateActorWithMnemosphereData(actor);
            Log(`Updated actor ${actor.name} for version change`);
        } catch (error) {
            Log(`Failed to update actor ${actor.name}:`, error);
        }
    }
}

/**
 * Hook into mnemosphere equip/unequip events to trigger updates
 */
export function SetupMnemosphereCoreHooks(): void {
    // Listen for flag changes that indicate mnemosphere equipment changes
    Hooks.on("updateActor", async (actor, changes, options, userId) => {
        // Check if equipped mnemospheres changed
        const equippedMnemospheresChanged = changes.flags?.[ModuleName]?.["equipped-mnemospheres"] !== undefined;
        
        if (equippedMnemospheresChanged) {
            // Only process the update if:
            // 1. The current user is the one who made the change, OR
            // 2. The current user is the GM and the actor has no owner (fallback)
            const currentUserId = game.user?.id;
            const isCurrentUserChange = currentUserId === userId;
            const isActorOwner = actor.isOwner;
            const isGMFallback = game.user?.isGM && !actor.hasPlayerOwner;

            if ((isCurrentUserChange && isActorOwner) || isGMFallback) {
                await updateActorWithMnemosphereData(actor);
            }
        }
    });

    // On ready, check all actors for version updates
    Hooks.once(`${ModuleName}Ready`, async () => {
        if (game.user?.isGM) {
            await updateAllActorsForVersionChange();
        }
    });
}
