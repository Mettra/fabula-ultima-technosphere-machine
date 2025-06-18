/**
 * Test data and scenarios for animation development
 */

export interface MnemosphereTestData {
    itemName: string;
    rarity: string;
    imageUrl: string | null;
    effects?: string[];
    description?: string;
}

export const TEST_SCENARIOS: MnemosphereTestData[] = [
    {
        itemName: "Mnemosphere - Entropist",
        rarity: "common",
        imageUrl:
            "modules/fabula-ultima-compendium/images/classes/Entropist.png",
        effects: ["sparkle"],
        description: "A basic test scenario with common rarity",
    },
    {
        itemName: "Mnemosphere - Chanter",
        rarity: "rare",
        imageUrl: "modules/fabula-ultima-compendium/images/classes/Chanter.png",
        effects: ["glow", "pulse"],
        description: "A rare item with multiple effects",
    },
    {
        itemName: "Mnemosphere - Darkblade",
        rarity: "epic",
        imageUrl:
            "modules/fabula-ultima-compendium/images/classes/Darkblade.png",
        effects: ["shimmer", "burst", "glow"],
        description: "An epic item with complex effects",
    },
    {
        itemName: "Mnemosphere - Guardian",
        rarity: "legendary",
        imageUrl:
            "modules/fabula-ultima-compendium/images/classes/Guardian.png",
        effects: ["explosion", "rainbow", "sparkle", "glow"],
        description: "The ultimate legendary item with all effects",
    },
    {
        itemName: "Mnemosphere - Weaponmaster",
        rarity: "mythic",
        imageUrl:
            "modules/fabula-ultima-compendium/images/classes/Weaponmaster.png",
        effects: ["void", "reality-warp", "cosmic"],
        description: "A mythic item that bends reality",
    },
    {
        itemName: "Mnemosphere - Esper",
        rarity: "rare",
        imageUrl: "modules/fabula-ultima-compendium/images/classes/Esper.png",
        effects: ["glow"],
        description: "Testing long item names for UI layout",
    },
    {
        itemName: "No Image Test",
        rarity: "epic",
        imageUrl: null,
        effects: ["sparkle"],
        description: "Testing behavior when no image is provided",
    },
];

let currentScenarioIndex = 0;

/**
 * Get a random test scenario
 */
export function getRandomTestScenario(): MnemosphereTestData {
    const randomIndex = Math.floor(Math.random() * TEST_SCENARIOS.length);
    return { ...TEST_SCENARIOS[randomIndex] };
}

/**
 * Cycle through test scenarios sequentially
 */
export function cycleTestScenarios(): MnemosphereTestData {
    const scenario = { ...TEST_SCENARIOS[currentScenarioIndex] };
    currentScenarioIndex = (currentScenarioIndex + 1) % TEST_SCENARIOS.length;
    return scenario;
}

/**
 * Cycle through test scenarios sequentially
 */
export function currentTestScenarios(): MnemosphereTestData {
    const scenario = { ...TEST_SCENARIOS[currentScenarioIndex] };
    return scenario;
}

/**
 * Get test scenario by name
 */
export function getTestScenarioByName(
    name: string
): MnemosphereTestData | null {
    const scenario = TEST_SCENARIOS.find((s) =>
        s.itemName.toLowerCase().includes(name.toLowerCase())
    );
    return scenario ? { ...scenario } : null;
}

/**
 * Get test scenario by rarity
 */
export function getTestScenarioByRarity(rarity: string): MnemosphereTestData {
    const scenarios = TEST_SCENARIOS.filter((s) => s.rarity === rarity);
    if (scenarios.length === 0) {
        return getRandomTestScenario();
    }
    const randomIndex = Math.floor(Math.random() * scenarios.length);
    return { ...scenarios[randomIndex] };
}

/**
 * Get the current scenario index for UI display
 */
export function getCurrentScenarioInfo(): {
    index: number;
    total: number;
    scenario: MnemosphereTestData;
} {
    return {
        index: currentScenarioIndex,
        total: TEST_SCENARIOS.length,
        scenario: { ...TEST_SCENARIOS[currentScenarioIndex] },
    };
}

/**
 * Reset scenario cycling to the beginning
 */
export function resetScenarioCycle(): void {
    currentScenarioIndex = 0;
}
