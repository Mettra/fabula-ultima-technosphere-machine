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

/**
 * Get all equipped mnemospheres for an actor
 */
function getEquippedMnemospheres(actor: any): string[] {
    return actor.getFlag(ModuleName, "equipped-mnemospheres") || [];
}

/**
 * Extract skills from equipped mnemospheres
 */
async function extractSkillsFromMnemospheres(
    equippedMnemosphereUuids: string[]
): Promise<Map<string, SkillContribution[]>> {
    const skillMap = new Map<string, SkillContribution[]>();

    for (const mnemosphereUuid of equippedMnemosphereUuids) {
        try {
            const mnemosphereItem = await fromUuid(mnemosphereUuid as UUID);
            if (!mnemosphereItem) continue;

            // Get mnemosphere data from relations
            const mnemosphereId = Relations.Item.mnemosphere.get(
                mnemosphereUuid as UUID
            );
            if (!mnemosphereId) continue;

            const skillUuids =
                Relations.Mnemosphere.skill.get(mnemosphereId) || [];

            for (const skillUuid of skillUuids) {
                if (!skillMap.has(skillUuid)) {
                    skillMap.set(skillUuid, []);
                }

                skillMap.get(skillUuid)!.push({
                    level: 1, // Each instance adds 1 level
                    sourceUuid: mnemosphereUuid,
                    sourceName: (mnemosphereItem as any).name,
                });
            }
        } catch (error) {
            Log(`Failed to process mnemosphere ${mnemosphereUuid}:`, error);
        }
    }

    return skillMap;
}

/**
 * Extract features from equipped mnemospheres
 */
async function extractFeaturesFromMnemospheres(
    equippedMnemosphereUuids: string[]
): Promise<Map<string, SkillContribution[]>> {
    const featureMap = new Map<string, SkillContribution[]>();

    for (const mnemosphereUuid of equippedMnemosphereUuids) {
        try {
            const mnemosphereItem = await fromUuid(mnemosphereUuid as UUID);
            if (!mnemosphereItem) continue;

            // Get mnemosphere data from relations
            const mnemosphereId = Relations.Item.mnemosphere.get(
                mnemosphereUuid as UUID
            );
            if (!mnemosphereId) continue;

            // Get heroic skills
            const heroicSkillUuid =
                Relations.Mnemosphere.heroicskill.get(mnemosphereId);
            if (heroicSkillUuid) {
                const featureIdentifier = heroicSkillUuid;
                if (!featureMap.has(featureIdentifier)) {
                    featureMap.set(featureIdentifier, []);
                }

                featureMap.get(featureIdentifier)!.push({
                    level: 1, // Each instance adds 1 level
                    sourceUuid: mnemosphereUuid,
                    sourceName: (mnemosphereItem as any).name,
                });
            }

            // Extract features
            const features =
                Relations.Mnemosphere.feature.get(mnemosphereId) || [];
            for (const featureUuid of features) {
                const featureIdentifier = featureUuid;
                if (!featureMap.has(featureIdentifier)) {
                    featureMap.set(featureIdentifier, []);
                }

                featureMap.get(featureIdentifier)!.push({
                    level: 1, // Each instance adds 1 level
                    sourceUuid: mnemosphereUuid,
                    sourceName: (mnemosphereItem as any).name,
                });
            }
        } catch (error) {
            Log(
                `Failed to process mnemosphere features ${mnemosphereUuid}:`,
                error
            );
        }
    }

    return featureMap;
}

/**
 * Extract spells from equipped mnemospheres
 */
async function extractSpellsFromMnemospheres(
    equippedMnemosphereUuids: string[]
): Promise<Map<string, SkillContribution[]>> {
    const spellMap = new Map<string, SkillContribution[]>();

    for (const mnemosphereUuid of equippedMnemosphereUuids) {
        try {
            const mnemosphereItem = await fromUuid(mnemosphereUuid as UUID);
            if (!mnemosphereItem) continue;

            const mnemosphereId = Relations.Item.mnemosphere.get(
                mnemosphereUuid as UUID
            );
            if (!mnemosphereId) continue;

            const spellUuids =
                Relations.Mnemosphere.spell.get(mnemosphereId) || [];

            for (const spellUuid of spellUuids) {
                if (!spellMap.has(spellUuid)) {
                    spellMap.set(spellUuid, []);
                }
                spellMap.get(spellUuid)!.push({
                    level: 1,
                    sourceUuid: mnemosphereUuid,
                    sourceName: (mnemosphereItem as any).name,
                });
            }
        } catch (error) {
            Log(
                `Failed to process mnemosphere spells ${mnemosphereUuid}:`,
                error
            );
        }
    }

    return spellMap;
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
            // Try to resolve as UUID first, if that fails, treat as skill name
            let skillDoc: any = null;
            let skillUuid = skillIdentifier;

            try {
                skillDoc = await fromUuid(skillIdentifier as UUID);
            } catch (e) {
                // If not a valid UUID, this is likely a skill name
                Log(
                    `Skill identifier '${skillIdentifier}' is not a UUID, treating as skill name`
                );
            }

            if (!skillDoc) {
                // Create a basic skill structure using the name
                skillDoc = {
                    name: skillIdentifier,
                    img: "icons/skills/melee/hand-grip-sword-orange.webp", // Default icon
                    system: {
                        level: { max: 5 },
                        class: "",
                        description: `Combined skill: ${skillIdentifier}`,
                    },
                };
                skillUuid = `skill-${skillIdentifier
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`;
            }

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

            // Handle description access - try multiple ways since items may have getter properties
            let originalDescription = "";
            try {
                // Try direct system access first
                originalDescription =
                    (skillDoc as any).system?.description || "";

                // If that's empty or undefined, try accessing description as a getter
                if (!originalDescription && (skillDoc as any).description) {
                    originalDescription = (skillDoc as any).description;
                }

                // If still empty, try system.data.description for skills
                if (
                    !originalDescription &&
                    (skillDoc as any).system?.data?.description
                ) {
                    originalDescription = (skillDoc as any).system.data
                        .description;
                }
            } catch (error) {
                Log(
                    `Failed to access description for skill ${skillIdentifier}:`,
                    error
                );
                originalDescription = "";
            }

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
            // Try to resolve as UUID first
            let featureDoc: any = null;
            let featureUuid = featureIdentifier;

            try {
                featureDoc = await fromUuid(featureIdentifier as UUID);
            } catch (e) {
                Log(
                    `Feature identifier '${featureIdentifier}' is not a UUID, treating as feature name`
                );
            }

            if (!featureDoc) {
                // Create a basic feature structure using the name
                featureDoc = {
                    name: featureIdentifier,
                    img: "icons/magic/symbols/rune-sigil-blue.webp", // Default icon
                    system: {
                        description: `Combined feature: ${featureIdentifier}`,
                    },
                };
                featureUuid = `feature-${featureIdentifier
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`;
            }

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

            // Handle description access - try multiple ways since features may have getter properties
            let originalDescription = "";
            try {
                // Try direct system access first
                originalDescription =
                    (featureDoc as any).system?.description || "";

                // If that's empty or undefined, try accessing description as a getter
                if (!originalDescription && (featureDoc as any).description) {
                    originalDescription = (featureDoc as any).description;
                }

                // If still empty, try system.data.description for class features
                if (
                    !originalDescription &&
                    (featureDoc as any).system?.data?.description
                ) {
                    originalDescription = (featureDoc as any).system.data
                        .description;
                }
            } catch (error) {
                Log(
                    `Failed to access description for feature ${featureIdentifier}:`,
                    error
                );
                originalDescription = "";
            }

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
            let spellDoc: any = null;
            let spellUuid = spellIdentifier;

            try {
                spellDoc = await fromUuid(spellIdentifier as UUID);
            } catch (e) {
                Log(
                    `Spell identifier '${spellIdentifier}' is not a UUID, treating as name`
                );
            }

            if (!spellDoc) {
                spellDoc = {
                    name: spellIdentifier,
                    img: "icons/magic/fire/flame-burning-embers.webp",
                    system: {
                        description: `Combined spell: ${spellIdentifier}`,
                    },
                };
                spellUuid = `spell-${spellIdentifier
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`;
            }

            // Sources
            const sourcesText = contributions
                .map((c) => `@UUID[${c.sourceUuid}]{${c.sourceName}}`)
                .join(", ");

            let originalDescription = "";
            try {
                originalDescription =
                    (spellDoc as any).system?.description ||
                    (spellDoc as any).description ||
                    (spellDoc as any).system?.data?.description ||
                    "";
            } catch {
                originalDescription = "";
            }

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
    const skillContributions = await extractSkillsFromMnemospheres(
        equippedMnemosphereUuids
    );

    // Combine mnemosphere skills into sphere skills
    const sphereSkills = await combineSkills(skillContributions);

    // Extract feature contributions from mnemospheres
    const featureContributions = await extractFeaturesFromMnemospheres(
        equippedMnemosphereUuids
    );

    // Combine mnemosphere features into sphere features
    const sphereFeatures = await combineFeatures(featureContributions);

    // Extract spells
    const spellContributions = await extractSpellsFromMnemospheres(
        equippedMnemosphereUuids
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

        // Create new items
        const itemsToCreate = [];

        // Add sphere skills (combined mnemosphere skills)
        for (const skill of combinedData.skills) {
            try {
                let itemData: any;

                // Try to get the source skill document
                try {
                    const skillDoc = await fromUuid(skill.uuid as UUID);
                    if (skillDoc) {
                        itemData = (skillDoc as any).toJSON();
                    }
                } catch (e) {
                    // If UUID resolution fails, create a basic skill structure
                    Log(`Creating basic skill structure for: ${skill.name}`);
                }

                // If we couldn't get a source document, create a basic skill
                if (!itemData) {
                    itemData = {
                        name: skill.name,
                        type: "skill",
                        img: skill.img,
                        system: {
                            level: {
                                value: skill.level,
                                max: skill.maxLevel,
                            },
                            class: skill.classType,
                            description: skill.description,
                        },
                        flags: {},
                    };
                } else {
                    // Update the existing structure
                    itemData.name = skill.name;
                    itemData.system.level.value = skill.level;
                    itemData.system.class = {
                        value: getHighestContributingMnemosphere(
                            skill.contributions
                        ).sourceName,
                    };

                    // Handle description setting with error handling
                    try {
                        if (itemData.system) {
                            itemData.system.description = skill.description;
                        } else {
                            itemData.system = {
                                description: skill.description,
                            };
                        }
                    } catch (error) {
                        Log(
                            `Failed to set description for skill ${skill.name}:`,
                            error
                        );
                        // Fallback to basic system structure
                        itemData.system = itemData.system || {};
                        itemData.system.description = skill.description;
                    }
                }

                // Ensure proper flagging
                itemData.flags = itemData.flags || {};
                itemData.flags[ModuleName] = {
                    "generated-by-mnemosphere": true,
                    "is-sphere-skill": true,
                };
                itemsToCreate.push(itemData);
            } catch (error) {
                Log(
                    `Failed to create sphere skill item for ${skill.name}:`,
                    error
                );
            }
        }

        // Add sphere features (combined mnemosphere features)
        for (const feature of combinedData.features) {
            try {
                let itemData: any;

                // Try to get the source feature document
                try {
                    const featureDoc = await fromUuid(feature.uuid as UUID);
                    if (featureDoc) {
                        itemData = (featureDoc as any).toJSON();
                    }
                } catch (e) {
                    // If UUID resolution fails, create a basic feature structure
                    Log(
                        `Creating basic feature structure for: ${feature.name}`
                    );
                }

                // If we couldn't get a source document, create a basic feature
                if (!itemData) {
                    itemData = {
                        name: feature.name,
                        type: "feature", // Default to feature type
                        img: feature.img,
                        system: {
                            description: feature.description,
                        },
                        flags: {},
                    };
                } else {
                    // Update the existing structure
                    itemData.name = feature.name;

                    // Handle description setting - try multiple paths since different item types may store it differently
                    try {
                        if (itemData.system) {
                            itemData.system.description = feature.description;
                        } else {
                            itemData.system = {
                                description: feature.description,
                            };
                        }

                        // For class features, also try setting it in system.data.description
                        if (
                            itemData.type === "classFeature" &&
                            itemData.system.data
                        ) {
                            itemData.system.data.description =
                                feature.description;
                        }
                    } catch (error) {
                        Log(
                            `Failed to set description for feature ${feature.name}:`,
                            error
                        );
                        // Fallback to basic system structure
                        itemData.system = itemData.system || {};
                        itemData.system.description = feature.description;
                    }
                }

                // Ensure proper flagging
                itemData.flags = itemData.flags || {};
                itemData.flags[ModuleName] = {
                    "generated-by-mnemosphere": true,
                    "is-sphere-feature": true,
                };
                itemsToCreate.push(itemData);
            } catch (error) {
                Log(
                    `Failed to create sphere feature item for ${feature.name}:`,
                    error
                );
            }
        }

        // Add sphere spells
        for (const spell of combinedData.spells) {
            try {
                let itemData: any;

                try {
                    const spellDoc = await fromUuid(spell.uuid as UUID);
                    if (spellDoc) {
                        itemData = (spellDoc as any).toJSON();
                    }
                } catch {
                    Log(`Creating basic spell structure for: ${spell.name}`);
                }

                if (!itemData) {
                    itemData = {
                        name: spell.name,
                        type: "spell",
                        img: spell.img,
                        system: { description: spell.description },
                        flags: {},
                    };
                } else {
                    itemData.name = spell.name;
                    try {
                        if (itemData.system) {
                            itemData.system.description = spell.description;
                        } else {
                            itemData.system = {
                                description: spell.description,
                            };
                        }
                    } catch {
                        itemData.system = itemData.system || {};
                        itemData.system.description = spell.description;
                    }
                }

                itemData.flags = itemData.flags || {};
                itemData.flags[ModuleName] = {
                    "generated-by-mnemosphere": true,
                    "is-sphere-spell": true,
                };
                itemsToCreate.push(itemData);
            } catch (error) {
                Log(
                    `Failed to create sphere spell item for ${spell.name}:`,
                    error
                );
            }
        }

        if (itemsToCreate.length > 0) {
            await actor.createEmbeddedDocuments("Item", itemsToCreate);
            Log("Created new sphere items:", itemsToCreate.length);
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
