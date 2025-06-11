/**
 * Test module for WebGPU particles integration
 * Can be imported to verify particle systems are working correctly
 */

import { WebGPUAnimationParticles } from "./webgpu-animation-particles.js";

export interface ParticleTestResult {
    webgpuAvailable: boolean;
    recommendedSystem: "webgpu" | "none";
    testDuration: number;
}

/**
 * Test particle system capabilities and performance
 */
export async function testParticleCapabilities(): Promise<ParticleTestResult> {
    const startTime = performance.now();

    // Test container for capability check
    const testContainer = document.createElement("div");
    testContainer.style.position = "fixed";
    testContainer.style.top = "-1000px"; // Off-screen
    testContainer.style.left = "-1000px";
    testContainer.style.width = "100px";
    testContainer.style.height = "100px";
    document.body.appendChild(testContainer);

    let webgpuAvailable = false;

    try {
        // Test WebGPU capabilities
        const webgpuParticles = new WebGPUAnimationParticles();
        webgpuAvailable = await webgpuParticles.init(testContainer);
        if (webgpuAvailable) {
            webgpuParticles.destroy();
        }
    } catch (error) {
        console.log("WebGPU test failed:", error);
        webgpuAvailable = false;
    }

    // Clean up test container
    document.body.removeChild(testContainer);

    const endTime = performance.now();
    const testDuration = endTime - startTime;

    // Determine recommended system
    let recommendedSystem: "webgpu" | "none";
    if (webgpuAvailable) {
        recommendedSystem = "webgpu";
    } else {
        recommendedSystem = "none";
    }

    const result: ParticleTestResult = {
        webgpuAvailable,
        recommendedSystem,
        testDuration,
    };

    console.log("Particle capability test results:", result);
    return result;
}

/**
 * Quick visual test of particles - creates a temporary demonstration
 */
export async function runVisualParticleTest(
    duration: number = 3000
): Promise<void> {
    // Create temporary container
    const testContainer = document.createElement("div");
    testContainer.style.position = "fixed";
    testContainer.style.top = "0";
    testContainer.style.left = "0";
    testContainer.style.width = "100vw";
    testContainer.style.height = "100vh";
    testContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    testContainer.style.zIndex = "10000";
    testContainer.style.pointerEvents = "none";
    testContainer.innerHTML =
        '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 24px; text-align: center;">Testing Particles<br><small>Click anywhere to close</small></div>';

    document.body.appendChild(testContainer);

    // Allow click to close
    testContainer.style.pointerEvents = "auto";
    const closeHandler = () => {
        cleanup();
    };
    testContainer.addEventListener("click", closeHandler);

    let particles: WebGPUAnimationParticles | null = null;

    const cleanup = () => {
        if (particles) {
            particles.destroy();
            particles = null;
        }
        if (testContainer.parentNode) {
            testContainer.parentNode.removeChild(testContainer);
        }
    };

    try {
        // Try WebGPU
        const webgpuParticles = new WebGPUAnimationParticles();
        const webgpuSuccess = await webgpuParticles.init(testContainer);

        if (webgpuSuccess) {
            particles = webgpuParticles;
            particles.start();
            console.log("Visual test: Using WebGPU particles");
        } else {
            console.log("Visual test: No particle system available");
        }

        // Auto-close after duration
        setTimeout(() => {
            cleanup();
        }, duration);
    } catch (error) {
        console.error("Visual particle test failed:", error);
        cleanup();
    }
}

// Development helpers - expose globally for console testing
if (typeof window !== "undefined") {
    (window as any).testParticles = {
        testCapabilities: testParticleCapabilities,
        runVisualTest: runVisualParticleTest,
    };
}
