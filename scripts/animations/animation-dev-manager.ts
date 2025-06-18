import {
    Log,
    DEV_MODE,
    ANIMATION_TEST_KEY,
    ANIMATION_RELOAD_KEY,
    ANIMATION_DEV_MODIFIER,
} from "../core-config.js";
import {
    cycleTestScenarios,
    getRandomTestScenario,
    getCurrentScenarioInfo,
    resetScenarioCycle,
    MnemosphereTestData,
    currentTestScenarios,
} from "./animation-test-data.js";
import {
    reloadAnimationModule,
    getCurrentAnimationFunction,
    cleanupAnimationState,
    initializeHotReload,
    fallbackReload,
} from "./animation-hot-reload.js";
import { playMnemosphereAnimation } from "./mnemosphere-animation.js";
import {
    testParticleCapabilities,
    runVisualParticleTest,
} from "./particle-test.js";

/**
 * Development manager for animation testing and hot reloading
 */
export class AnimationDevManager {
    private keyHandler: ((event: KeyboardEvent) => void) | null = null;
    private isInitialized: boolean = false;
    private debugOverlay: HTMLElement | null = null;
    private lastTestScenario: MnemosphereTestData | null = null;
    private setTranslate: ((xPos: number, yPos: number) => void) | null = null;

    /**
     * Initialize the development manager
     */
    public initialize(): void {
        if (!DEV_MODE) {
            Log("Development mode disabled, skipping animation dev manager");
            return;
        }

        if (this.isInitialized) {
            Log("Animation dev manager already initialized");
            return;
        }

        Log("Initializing Animation Development Manager...");

        // Initialize hot reload system
        initializeHotReload();

        // Set up keyboard handlers
        this.setupKeyboardHandlers();

        // Create debug overlay
        this.createDebugOverlay();

        this.isInitialized = true;
        Log("Animation Development Manager initialized"); // Show initialization notification
        if (typeof ui !== "undefined" && ui.notifications) {
            ui.notifications.info(
                "Animation Dev Mode Active! Ctrl+R = Test, Ctrl+L = Reload, Ctrl+P = Particles"
            );
        }
    }

    /**
     * Set up global keyboard event handlers
     */
    private setupKeyboardHandlers(): void {
        this.keyHandler = (event: KeyboardEvent) => {
            // Only handle if development modifier is pressed
            if (!event[ANIMATION_DEV_MODIFIER as keyof KeyboardEvent]) {
                return;
            }

            // Prevent default browser behavior for our dev keys
            if (
                event.code === ANIMATION_TEST_KEY ||
                event.code === ANIMATION_RELOAD_KEY
            ) {
                event.preventDefault();
                event.stopPropagation();
            }
            switch (event.code) {
                case ANIMATION_TEST_KEY: // Ctrl+R
                    this.runAnimationTest();
                    break;

                case ANIMATION_RELOAD_KEY: // Ctrl+L
                    this.reloadAnimation();
                    break;

                case "KeyP": // Ctrl+P for particle test
                    this.runParticleTest();
                    break;
            }
        };
        document.addEventListener("keydown", this.keyHandler, true);
        Log(
            "Keyboard handlers registered (Ctrl+R for test, Ctrl+L for reload, Ctrl+P for particle test)"
        );
    }
    /**
     * Run animation test with cycling scenarios
     */
    public async runAnimationTest(
        scenario?: MnemosphereTestData
    ): Promise<void> {
        try {
            const testData = scenario || currentTestScenarios();
            this.lastTestScenario = testData;

            Log(
                `Testing animation with scenario: ${testData.itemName} (${testData.rarity})`
            );

            // Clean up any previous animation state before starting new test
            cleanupAnimationState();

            // Update debug overlay
            this.updateDebugOverlay(testData);

            // Try to use hot-reloaded function if available
            const hotReloadedFunction = getCurrentAnimationFunction();
            if (hotReloadedFunction) {
                Log("Using hot-reloaded animation function");
                await hotReloadedFunction(testData);
            } else {
                Log("Using original animation function");
                await playMnemosphereAnimation(testData);
            }

            Log("Animation test completed");
        } catch (error) {
            console.error("Animation test failed:", error);
            if (typeof ui !== "undefined" && ui.notifications) {
                ui.notifications.error(
                    "Animation test failed. Check console for details."
                );
            }
        }
    }

    /**
     * Reload animation module
     */
    public async reloadAnimation(): Promise<void> {
        try {
            Log("Reloading animation module...");
            await reloadAnimationModule();

            // Update debug overlay to show reload status
            if (this.debugOverlay) {
                const reloadStatus =
                    this.debugOverlay.querySelector(".reload-status");
                if (reloadStatus) {
                    reloadStatus.textContent = `Reloaded at ${new Date().toLocaleTimeString()}`;
                }
            }
        } catch (error) {
            console.error("Failed to reload animation:", error);
            // Fallback to full page reload if hot reload fails
            fallbackReload();
        }
    }

    /**
     * Create debug overlay UI
     */
    private createDebugOverlay(): void {
        // Remove existing overlay if present
        const existing = document.getElementById("animation-dev-overlay");
        if (existing) {
            existing.remove();
        }

        this.debugOverlay = document.createElement("div");
        this.debugOverlay.id = "animation-dev-overlay";
        this.debugOverlay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            min-width: 250px;
            border: 1px solid #444;
        `;
        this.debugOverlay.innerHTML = `
            <div class="drag-handle" style="font-weight: bold; margin-bottom: 5px; cursor: move; padding: 2px; border-radius: 3px; user-select: none;">🎬 Animation Dev Mode</div>
            <div style="margin-bottom: 3px;">Ctrl+R: Test Animation</div>
            <div style="margin-bottom: 3px;">Ctrl+L: Reload Module</div>
            <div style="margin-bottom: 3px;">Ctrl+P: Test Particles</div>
            <div style="margin-bottom: 5px; border-top: 1px solid #444; padding-top: 5px;">
                <div class="current-scenario">Scenario: Ready</div>
                <div class="reload-status">Status: Initialized</div>
            </div>
            <div style="margin-top: 5px;">
                <button class="test-btn" style="margin-right: 5px; padding: 2px 6px; background: #333; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;">Test</button>
                <button class="reload-btn" style="margin-right: 5px; padding: 2px 6px; background: #333; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;">Reload</button>
                <button class="cycle-btn" style="margin-right: 5px; padding: 2px 6px; background: #333; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;">Cycle</button>
                <button class="particle-btn" style="padding: 2px 6px; background: #333; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;">Particles</button>
            </div>
        `; // Add click handlers for buttons
        const testBtn = this.debugOverlay.querySelector(".test-btn");
        const reloadBtn = this.debugOverlay.querySelector(".reload-btn");
        const cycleBtn = this.debugOverlay.querySelector(".cycle-btn");
        const particleBtn = this.debugOverlay.querySelector(".particle-btn");

        testBtn?.addEventListener("click", () => this.runAnimationTest());
        reloadBtn?.addEventListener("click", () => this.reloadAnimation());
        cycleBtn?.addEventListener("click", () => {
            const scenario = cycleTestScenarios();
            this.updateDebugOverlay(scenario);
        });
        particleBtn?.addEventListener("click", () => this.runParticleTest());

        // Add drag functionality
        this.setupDragFunctionality();

        document.body.appendChild(this.debugOverlay);
        Log("Debug overlay created");
    }

    /**
     * Set up drag functionality for the debug overlay
     */
    private setupDragFunctionality(): void {
        if (!this.debugOverlay) return;

        const dragHandle = this.debugOverlay.querySelector(
            ".drag-handle"
        ) as HTMLElement;
        if (!dragHandle) return;

        let isDragging = false;
        let currentX = 0;
        let currentY = 0;
        let initialX = 0;
        let initialY = 0;
        let xOffset = 0;
        let yOffset = 0;

        // Get current position from computed styles
        const rect = this.debugOverlay.getBoundingClientRect();
        xOffset = rect.left;
        yOffset = rect.top;

        const dragStart = (e: MouseEvent | TouchEvent) => {
            if (e.type === "touchstart") {
                const touch = (e as TouchEvent).touches[0];
                initialX = touch.clientX - xOffset;
                initialY = touch.clientY - yOffset;
            } else {
                initialX = (e as MouseEvent).clientX - xOffset;
                initialY = (e as MouseEvent).clientY - yOffset;
            }

            if (e.target === dragHandle) {
                isDragging = true;
                dragHandle.style.background = "rgba(255, 255, 255, 0.1)";
            }
        };

        const dragEnd = () => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            dragHandle.style.background = "";

            // Save position to localStorage for persistence
            if (this.debugOverlay) {
                localStorage.setItem(
                    "animation-debug-overlay-position",
                    JSON.stringify({
                        x: xOffset,
                        y: yOffset,
                    })
                );
            }
        };

        const drag = (e: MouseEvent | TouchEvent) => {
            if (isDragging) {
                e.preventDefault();

                if (e.type === "touchmove") {
                    const touch = (e as TouchEvent).touches[0];
                    currentX = touch.clientX - initialX;
                    currentY = touch.clientY - initialY;
                } else {
                    currentX = (e as MouseEvent).clientX - initialX;
                    currentY = (e as MouseEvent).clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                // Constrain to viewport
                const overlay = this.debugOverlay!;
                const rect = overlay.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;

                xOffset = Math.max(0, Math.min(xOffset, maxX));
                yOffset = Math.max(0, Math.min(yOffset, maxY));

                this.setTranslate(xOffset, yOffset);
            }
        };

        const setTranslate = (xPos: number, yPos: number) => {
            if (this.debugOverlay) {
                this.debugOverlay.style.left = `${xPos}px`;
                this.debugOverlay.style.top = `${yPos}px`;
                this.debugOverlay.style.right = "auto"; // Remove right positioning
            }
        };

        // Store setTranslate as instance method for use in other methods
        this.setTranslate = setTranslate;

        // Event listeners
        dragHandle.addEventListener("mousedown", dragStart, false);
        document.addEventListener("mouseup", dragEnd, false);
        document.addEventListener("mousemove", drag, false);

        // Touch events for mobile support
        dragHandle.addEventListener("touchstart", dragStart, false);
        document.addEventListener("touchend", dragEnd, false);
        document.addEventListener("touchmove", drag, false);

        // Load saved position if available
        this.loadSavedPosition();
    }

    /**
     * Load saved position from localStorage
     */
    private loadSavedPosition(): void {
        try {
            const savedPosition = localStorage.getItem(
                "animation-debug-overlay-position"
            );
            if (savedPosition && this.debugOverlay && this.setTranslate) {
                const position = JSON.parse(savedPosition);

                // Validate the position is within current viewport
                const maxX = window.innerWidth - this.debugOverlay.offsetWidth;
                const maxY =
                    window.innerHeight - this.debugOverlay.offsetHeight;

                const x = Math.max(0, Math.min(position.x || 10, maxX));
                const y = Math.max(0, Math.min(position.y || 10, maxY));

                this.setTranslate(x, y);
                Log(`Restored debug overlay position to (${x}, ${y})`);
            }
        } catch (error) {
            Log("Failed to load saved overlay position:", error);
            // Fallback to default position if loading fails
            if (this.debugOverlay && this.setTranslate) {
                this.setTranslate(10, 10);
            }
        }
    }

    /**
     * Update debug overlay with current scenario info
     */
    private updateDebugOverlay(scenario: MnemosphereTestData): void {
        if (!this.debugOverlay) return;

        const scenarioInfo = getCurrentScenarioInfo();
        const currentScenario =
            this.debugOverlay.querySelector(".current-scenario");
        if (currentScenario) {
            currentScenario.textContent = `Scenario: ${scenario.itemName} (${
                scenario.rarity
            }) [${scenarioInfo.index + 1}/${scenarioInfo.total}]`;
        }
    }

    /**
     * Test specific scenario by name or rarity
     */
    public async testScenario(identifier: string): Promise<void> {
        // Try to find by rarity first, then by name
        let scenario = null;

        const rarities = ["common", "rare", "epic", "legendary", "mythic"];
        if (rarities.includes(identifier.toLowerCase())) {
            scenario = cycleTestScenarios(); // Get next in cycle, or implement rarity-specific selection
        } else {
            // For now, just use random scenario
            scenario = getRandomTestScenario();
        }

        await this.runAnimationTest(scenario);
    }
    /**
     * Cleanup and remove event handlers
     */
    public cleanup(): void {
        if (this.keyHandler) {
            document.removeEventListener("keydown", this.keyHandler, true);
            this.keyHandler = null;
        }

        if (this.debugOverlay) {
            this.debugOverlay.remove();
            this.debugOverlay = null;
        }

        // Clean up drag-related properties
        this.setTranslate = null;

        this.isInitialized = false;
        Log("Animation Development Manager cleaned up");
    }

    /**
     * Get current state for debugging
     */
    public getState(): any {
        return {
            isInitialized: this.isInitialized,
            lastTestScenario: this.lastTestScenario,
            devMode: DEV_MODE,
            hasDebugOverlay: !!this.debugOverlay,
            hasKeyHandler: !!this.keyHandler,
        };
    }

    /**
     * Run particle system test
     */
    public async runParticleTest(): Promise<void> {
        try {
            Log("Running particle system test...");

            // Run capability test first
            const capabilities = await testParticleCapabilities();
            Log("Particle capabilities:", capabilities);

            if (typeof ui !== "undefined" && ui.notifications) {
                ui.notifications.info(
                    `Particle test: ${
                        capabilities.recommendedSystem
                    } available (${capabilities.testDuration.toFixed(1)}ms)`
                );
            }

            // Run visual test if any system is available
            if (capabilities.webgpuAvailable || capabilities.cssAvailable) {
                Log("Running visual particle test...");
                await runVisualParticleTest(5000); // 5 second test
            } else {
                Log("No particle systems available for visual test");
                if (typeof ui !== "undefined" && ui.notifications) {
                    ui.notifications.warn(
                        "No particle systems available on this device"
                    );
                }
            }
        } catch (error) {
            console.error("Particle test failed:", error);
            if (typeof ui !== "undefined" && ui.notifications) {
                ui.notifications.error(
                    "Particle test failed. Check console for details."
                );
            }
        }
    }
}

// Global instance
let animationDevManager: AnimationDevManager | null = null;

/**
 * Get or create the global animation dev manager instance
 */
export function getAnimationDevManager(): AnimationDevManager {
    if (!animationDevManager) {
        animationDevManager = new AnimationDevManager();
    }
    return animationDevManager;
}

/**
 * Initialize animation development mode
 */
export function initializeAnimationDevMode(): void {
    if (!DEV_MODE) return;

    const manager = getAnimationDevManager();
    manager.initialize();
}

/**
 * Cleanup animation development mode
 */
export function cleanupAnimationDevMode(): void {
    if (animationDevManager) {
        animationDevManager.cleanup();
        animationDevManager = null;
    }
}
