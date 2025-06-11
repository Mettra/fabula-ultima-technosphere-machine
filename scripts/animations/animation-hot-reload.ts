import { Log } from "../core-config.js";
import { animate } from "animejs";

/**
 * Hot reload system for animation development
 */

let currentAnimationModule: any = null;
let animationModuleUrl: string | null = null;

/**
 * Clean up any running animations and reset container state
 */
export function cleanupAnimationState(): void {
    const container = document.getElementById(
        "memnosphere-animation-container"
    );
    if (container) {
        // Stop any running animations
        container.innerHTML = "";
        container.style.display = "none";

        // In Anime.js v4, animations are automatically cleaned up when elements are removed
        // We can also manually stop any running timelines if we have references to them
    }

    Log("Animation state cleaned up");
}

/**
 * Preserve animation container element during reload
 */
export function preserveAnimationContainer(): HTMLElement | null {
    const container = document.getElementById(
        "memnosphere-animation-container"
    );
    if (container) {
        // Store current visibility state
        const wasVisible = container.style.display !== "none";
        container.dataset.wasVisible = wasVisible.toString();
        return container;
    }
    return null;
}

/**
 * Restore animation container state after reload
 */
export function restoreAnimationContainer(): void {
    const container = document.getElementById(
        "memnosphere-animation-container"
    );
    if (container && container.dataset.wasVisible === "true") {
        // Don't automatically restore visibility - let the animation control it
        delete container.dataset.wasVisible;
    }
}

/**
 * Dynamically reload the animation module
 */
export async function reloadAnimationModule(): Promise<any> {
    try {
        Log("Starting animation module reload...");

        // Clean up current state
        cleanupAnimationState();
        preserveAnimationContainer(); // Create a new URL with cache busting timestamp for the standalone animation module
        // Use absolute URL for Foundry VTT compatibility
        const baseUrl = `${window.location.origin}/modules/fabula-ultima-technosphere-machine/build/animations/animation-standalone.js`;
        const cacheBuster = `?t=${Date.now()}`;
        const newUrl = `${baseUrl}${cacheBuster}`;

        Log(`Reloading animation module: ${newUrl}`);

        // Dynamic import with cache busting
        const newModule = await import(newUrl);

        // Store reference to the new module
        currentAnimationModule = newModule;
        animationModuleUrl = newUrl;

        // Restore container state
        restoreAnimationContainer();

        Log("Animation module reloaded successfully");

        // Show notification to user
        if (typeof ui !== "undefined" && ui.notifications) {
            ui.notifications.info("Animation module reloaded!");
        }

        return newModule;
    } catch (error) {
        console.error("Failed to reload animation module:", error);

        if (typeof ui !== "undefined" && ui.notifications) {
            ui.notifications.error(
                "Failed to reload animation module. Check console for details."
            );
        }

        throw error;
    }
}

/**
 * Get the current animation function from the loaded module
 */
export function getCurrentAnimationFunction(): Function | null {
    if (
        currentAnimationModule &&
        currentAnimationModule.playMemnosphereAnimation
    ) {
        return currentAnimationModule.playMemnosphereAnimation;
    }
    return null;
}

/**
 * Check if hot reload is available
 */
export function isHotReloadAvailable(): boolean {
    // In modern environments, dynamic import should always be available
    return true;
}

/**
 * Initialize hot reload system
 */
export function initializeHotReload(): void {
    if (!isHotReloadAvailable()) {
        console.warn("Hot reload not available in this environment");
        return;
    }

    Log("Hot reload system initialized");
}

/**
 * Force reload the entire page as fallback
 */
export function fallbackReload(): void {
    Log("Performing fallback page reload...");
    if (typeof ui !== "undefined" && ui.notifications) {
        ui.notifications.warn("Performing full page reload...");
    }
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}
