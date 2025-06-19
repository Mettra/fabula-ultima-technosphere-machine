// Mnemosphere core functionality for combining base actor and equipped mnemosphere skills/features

import { Log, ModuleName } from "./core-config.js";
import { Relations } from "./relation.js";
import { filterMnemospheres, resolveSkills } from "./mnemosphere.js";
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

interface CombinedClass {
    uuid: string;
    name: string;
    img: string;
    level: number;
    maxLevel: number;
    description: string;
}

interface CombinedFeature {
    uuid: string;
    name: string;
    img: string;
    description: string;
    contributions: SkillContribution[];
}

interface MnemosphereCombinationResult {
    baseSkills: any[]; // Skills directly copied from base actor
    sphereSkills: CombinedSkill[]; // Combined mnemosphere skills with "Sphere" suffix
    classes: CombinedClass[]; // Updated class levels
    baseFeatures: any[]; // Features directly copied from base actor
    sphereFeatures: CombinedFeature[]; // Combined mnemosphere features with "Sphere" suffix
}

/**
 * Get all equipped mnemospheres for an actor
 */
function getEquippedMnemospheres(actor: any): string[] {
    return actor.getFlag(ModuleName, "equipped-mnemospheres") || [];
}

/**
 * Get the base sheet actor for a given actor
 */
async function getBaseSheetActor(actor: any): Promise<any | null> {
    const baseSheetUuid = actor.getFlag(ModuleName, "technosphere-base-sheet");
    if (!baseSheetUuid) {
        return null;
    }

    try {
        return await fromUuid(baseSheetUuid);
    } catch (error) {
        Log(`Failed to resolve base sheet UUID: ${baseSheetUuid}`, error);
        return null;
    }
}

/**
 * Extract skills from an actor's items
 */
async function extractSkillsFromActor(
    actor: any,
    sourceUuid: string,
    sourceName: string
): Promise<Map<string, SkillContribution[]>> {
    const skillMap = new Map<string, SkillContribution[]>();

    for (const item of actor.items) {
        if (item.type === "skill") {
            // Use the skill's source UUID if available, otherwise fall back to item name
            // This helps group identical skills together instead of treating each instance as unique
            const skillIdentifier = item.system?.sourceId || item.name;
            const level = item.system?.level?.value || 1;

            if (!skillMap.has(skillIdentifier)) {
                skillMap.set(skillIdentifier, []);
            }

            skillMap.get(skillIdentifier)!.push({
                level: level,
                sourceUuid: sourceUuid,
                sourceName: sourceName,
            });
        }
    }

    return skillMap;
}

/**
 * Extract classes from an actor's items
 */
async function extractClassesFromActor(actor: any): Promise<any[]> {
    const classes = [];

    for (const item of actor.items) {
        if (item.type === "class") {
            classes.push(item);
        }
    }

    return classes;
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
            const mnemosphereId = Relations.Item.Mnemosphere.get(
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
 * Extract features from equipped mnemospheres for sphere combination
 */
async function extractFeaturesFromMnemospheresForSphere(
    equippedMnemosphereUuids: string[]
): Promise<Map<string, SkillContribution[]>> {
    const featureMap = new Map<string, SkillContribution[]>();

    for (const mnemosphereUuid of equippedMnemosphereUuids) {
        try {
            const mnemosphereItem = await fromUuid(mnemosphereUuid as UUID);
            if (!mnemosphereItem) continue;

            // Get mnemosphere data from relations
            const mnemosphereId = Relations.Item.Mnemosphere.get(
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

            // Get other UUIDs (features, spells, etc.)
            const otherUuids =
                Relations.Mnemosphere.uuid.get(mnemosphereId) || [];
            for (const featureUuid of otherUuids) {
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
                // We'll use the first contribution's sourceUuid to get a reference
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
            } // Build sources text with HTML formatting
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

                // If still empty, try system.data.description for class features
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

            const finalDescription = originalDescription + sourcesText;

            combinedSkills.push({
                uuid: skillUuid,
                name: `${(skillDoc as any).name} Sphere`,
                img: (skillDoc as any).img,
                level: finalLevel,
                maxLevel: maxPossibleLevel,
                description: finalDescription,
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
            } // Create sources section for description
            const sourcesByLevel = new Map<number, SkillContribution[]>();
            for (const contribution of contributions) {
                if (!sourcesByLevel.has(contribution.level)) {
                    sourcesByLevel.set(contribution.level, []);
                }
                sourcesByLevel.get(contribution.level)!.push(contribution);
            } // Build sources text with HTML formatting
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

            const finalDescription = originalDescription + sourcesText;

            combinedFeatures.push({
                uuid: featureUuid,
                name: `${(featureDoc as any).name} Sphere`,
                img: (featureDoc as any).img,
                description: finalDescription,
                contributions: contributions,
            });
        } catch (error) {
            Log(`Failed to process feature ${featureIdentifier}:`, error);
        }
    }

    return combinedFeatures;
}

/**
 * Calculate class levels from combined skills
 */
async function calculateClassLevels(
    combinedSkills: CombinedSkill[],
    baseClasses: any[]
): Promise<CombinedClass[]> {
    const classLevels = new Map<string, number>();
    const classInfo = new Map<string, any>();

    // Add base classes
    for (const baseClass of baseClasses) {
        const classUuid = baseClass.uuid;
        classLevels.set(classUuid, baseClass.system?.level?.value || 0);
        classInfo.set(classUuid, baseClass);
    }

    // Calculate levels from skills
    for (const skill of combinedSkills) {
        if (skill.classType) {
            const currentLevel = classLevels.get(skill.classType) || 0;
            classLevels.set(skill.classType, currentLevel + skill.level);
        }
    }

    const combinedClasses: CombinedClass[] = [];
    for (const [classUuid, totalLevel] of classLevels) {
        try {
            const classDoc =
                classInfo.get(classUuid) || (await fromUuid(classUuid as UUID));
            if (!classDoc) continue;

            const maxLevel = (classDoc as any).system?.level?.max || 10;
            const finalLevel = Math.min(totalLevel, maxLevel);

            combinedClasses.push({
                uuid: classUuid,
                name: (classDoc as any).name,
                img: (classDoc as any).img,
                level: finalLevel,
                maxLevel: maxLevel,
                description: (classDoc as any).system?.description || "",
            });
        } catch (error) {
            Log(`Failed to process class ${classUuid}:`, error);
        }
    }

    return combinedClasses;
}

/**
 * Main function to combine base actor and mnemosphere skills/features
 */
export async function combineMnemosphereData(
    actor: any
): Promise<MnemosphereCombinationResult> {
    Log("Starting mnemosphere data combination for actor:", actor.name);

    // Get equipped mnemospheres
    const equippedMnemosphereUuids = getEquippedMnemospheres(actor);
    Log("Equipped mnemospheres:", equippedMnemosphereUuids);

    // Get base sheet actor
    const baseActor = await getBaseSheetActor(actor); // Extract base skills and features directly (these will be copied as-is)
    let baseSkills: any[] = [];
    let baseFeatures: any[] = [];
    let baseClasses: any[] = [];
    if (baseActor) {
        baseSkills = baseActor.items.filter(
            (item: any) => item.type === "skill"
        );
        baseFeatures = baseActor.items.filter(
            (item: any) =>
                item.type === "spell" ||
                item.type === "feature" ||
                item.type === "ritual"
        );
        baseClasses = await extractClassesFromActor(baseActor);
        Log("Base skills found:", baseSkills.length);
        Log("Base features found:", baseFeatures.length);
        Log("Base classes found:", baseClasses.length);
    }

    // Only collect mnemosphere skill contributions for sphere skills
    const mnemosphereSkillContributions = await extractSkillsFromMnemospheres(
        equippedMnemosphereUuids
    );

    // Combine mnemosphere skills into sphere skills
    const sphereSkills = await combineSkills(mnemosphereSkillContributions);

    // Only collect mnemosphere feature contributions for sphere features
    const mnemosphereFeatureContributions =
        await extractFeaturesFromMnemospheresForSphere(
            equippedMnemosphereUuids
        );

    // Combine mnemosphere features into sphere features
    const sphereFeatures = await combineFeatures(
        mnemosphereFeatureContributions
    );

    // Calculate class levels from sphere skills only (base classes provide their own levels)
    const combinedClasses = await calculateClassLevels(
        sphereSkills,
        baseClasses
    );

    const result: MnemosphereCombinationResult = {
        baseSkills: baseSkills,
        sphereSkills: sphereSkills,
        classes: combinedClasses,
        baseFeatures: baseFeatures,
        sphereFeatures: sphereFeatures,
    };

    Log("Mnemosphere combination result:", result);
    return result;
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
        const combinedData = await combineMnemosphereData(actor); // Remove old sphere items - be more specific to avoid deleting actual Mnemospheres
        const itemsToDelete = [];
        for (const item of actor.items) {
            // Only delete items that are explicitly marked as generated by our module
            // AND either have " Sphere" in the name OR are flagged as generated
            const isGenerated = item.getFlag(
                ModuleName,
                "generated-by-mnemosphere"
            );
            const isSphereNamed = item.name.endsWith(" Sphere");

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
        } // Create new items
        const itemsToCreate = [];

        // Add base skills (copied as-is, no modifications)
        for (const baseSkill of combinedData.baseSkills) {
            try {
                const itemData = baseSkill.toJSON();
                // Mark as generated so we can clean them up later
                itemData.flags = itemData.flags || {};
                itemData.flags[ModuleName] = {
                    "generated-by-mnemosphere": true,
                    "is-base-skill": true,
                };
                itemsToCreate.push(itemData);
            } catch (error) {
                Log(
                    `Failed to create base skill item for ${baseSkill.name}:`,
                    error
                );
            }
        }

        // Add sphere skills (combined mnemosphere skills)
        for (const skill of combinedData.sphereSkills) {
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

        // Update existing classes instead of creating duplicates
        const classUpdates = [];
        for (const classItem of combinedData.classes) {
            try {
                // Find existing class item on the actor
                const existingClass = actor.items.find(
                    (item: any) =>
                        item.type === "class" && item.uuid === classItem.uuid
                );

                if (existingClass) {
                    // Update existing class level
                    classUpdates.push({
                        _id: existingClass.id,
                        "system.level.value": classItem.level,
                    });
                    Log(
                        `Updating existing class ${classItem.name} to level ${classItem.level}`
                    );
                } else {
                    // Only create if it doesn't exist (shouldn't happen with base classes)
                    const classDoc = await fromUuid(classItem.uuid as UUID);
                    if (classDoc) {
                        const itemData = (classDoc as any).toJSON();
                        itemData.system.level.value = classItem.level;
                        itemData.flags = itemData.flags || {};
                        itemData.flags[ModuleName] = {
                            "generated-by-mnemosphere": true,
                            "is-updated-class": true,
                        };
                        itemsToCreate.push(itemData);
                        Log(
                            `Creating new class ${classItem.name} at level ${classItem.level}`
                        );
                    } else {
                        Log(`Could not resolve class UUID: ${classItem.uuid}`);
                    }
                }
            } catch (error) {
                Log(
                    `Failed to handle class item for ${classItem.name}:`,
                    error
                );
            }
        } // Apply class updates
        if (classUpdates.length > 0) {
            await actor.updateEmbeddedDocuments("Item", classUpdates);
            Log("Updated existing classes:", classUpdates.length);
        }

        // Add base features (copied as-is, no modifications)
        for (const baseFeature of combinedData.baseFeatures) {
            try {
                const itemData = baseFeature.toJSON();
                // Mark as generated so we can clean them up later
                itemData.flags = itemData.flags || {};
                itemData.flags[ModuleName] = {
                    "generated-by-mnemosphere": true,
                    "is-base-feature": true,
                };
                itemsToCreate.push(itemData);
            } catch (error) {
                Log(
                    `Failed to create base feature item for ${baseFeature.name}:`,
                    error
                );
            }
        }

        // Add sphere features (combined mnemosphere features)
        for (const feature of combinedData.sphereFeatures) {
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
                } // If we couldn't get a source document, create a basic feature
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
                }
                delete actor._mnemosphereUpdateTimeout;
            }, 500); // 500ms debounce
        }
    });

    Log("Mnemosphere core hooks setup complete");
}
