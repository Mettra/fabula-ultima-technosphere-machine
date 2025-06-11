import "../webgpu/webgpu.js"; // Import for side effects, ensuring esbuild bundles it and WebGPUParticles class becomes available.

// Declare the global WebGPUParticles class provided by webgpu.js
// This assumes webgpu.js has been loaded and makes this class available globally.
declare var WebGPUParticles: {
    new (
        canvas: HTMLCanvasElement,
        fpsDisplay: HTMLElement,
        errorDisplay: HTMLElement
    ): {
        init: () => Promise<void>;
        toggle: () => void;
        isRunning: boolean;
        // Add other methods/properties if they are defined in webgpu.js and needed here
    };
};

/**
 * WebGPU particles system specifically designed for memnosphere animations.
 * Manages a canvas for particle rendering and integrates with the WebGPU particle system
 * provided by `webgpu.js`.
 * Renders particles behind HTML content with full-screen canvas overlay.
 */
export class WebGPUAnimationParticles {
    private canvas: HTMLCanvasElement | null = null;
    private fpsDisplayElement: HTMLElement | null = null;
    private errorDisplayElement: HTMLElement | null = null;
    private parentContainer: HTMLElement | null = null;

    private particleSystem: InstanceType<typeof WebGPUParticles> | null = null;
    private isRunningState: boolean = false; // Tracks desired state

    constructor() {
        // Lightweight constructor
    }

    /**
     * Initialize WebGPU particles within a specific container element.
     * Creates and configures necessary DOM elements and initializes the WebGPUParticles system.
     */
    async init(parentContainer: HTMLElement): Promise<boolean> {
        if (this.particleSystem) {
            console.warn("WebGPUAnimationParticles already initialized.");
            return true;
        }

        if (!parentContainer) {
            console.error(
                "Parent container is required for WebGPUAnimationParticles initialization."
            );
            return false;
        }

        this.parentContainer = parentContainer;
        const elements = this.setupWebGPUElements(this.parentContainer);
        this.canvas = elements.canvas;
        this.fpsDisplayElement = elements.fpsDisplay;
        this.errorDisplayElement = elements.errorDisplay;

        if (typeof WebGPUParticles === "undefined") {
            console.error(
                "Global 'WebGPUParticles' class from webgpu.js not found. Cannot initialize particle system."
            );
            if (this.errorDisplayElement) {
                this.errorDisplayElement.textContent =
                    "Error: WebGPUParticles class not found. Check console.";
                this.errorDisplayElement.style.display = "block";
            }
            return false;
        }

        try {
            this.particleSystem = new WebGPUParticles(
                "modules/fabula-ultima-technosphere-machine/build/webgpu-particles.wasm",
                this.canvas,
                this.fpsDisplayElement,
                this.errorDisplayElement
            );
            await this.particleSystem.init();
            this.isRunningState = this.particleSystem.isRunning;
            console.log("WebGPUAnimationParticles initialized successfully.");
        } catch (error) {
            console.error("Error initializing WebGPUParticles system:", error);
            if (this.errorDisplayElement) {
                this.errorDisplayElement.textContent = `Error initializing WebGPU: ${error.message}`;
                this.errorDisplayElement.style.display = "block";
            }
            this.particleSystem = null; // Ensure it's null on failure
            return false;
        }

        return true;
    }

    /**
     * Creates or retrieves and configures the canvas, FPS display, and error display elements.
     */
    private setupWebGPUElements(container: HTMLElement): {
        canvas: HTMLCanvasElement;
        fpsDisplay: HTMLElement;
        errorDisplay: HTMLElement;
    } {
        // Canvas Element
        let canvas = document.getElementById(
            "canvas"
        ) as HTMLCanvasElement | null;
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.id = "canvas";
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.style.position = "absolute";
            canvas.style.top = "0";
            canvas.style.left = "0";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.zIndex = "-1";
            canvas.style.pointerEvents = "none";
            if (container.firstChild) {
                container.insertBefore(canvas, container.firstChild);
            } else {
                container.appendChild(canvas);
            }
        } else if (canvas.parentElement !== container) {
            console.warn(
                'WebGPUAnimationParticles: Global canvas with id="canvas" exists but is not in the target container. Moving it.'
            );
            if (container.firstChild) {
                container.insertBefore(canvas, container.firstChild);
            } else {
                container.appendChild(canvas);
            }
        }

        // FPS Display Element (id="stats")
        let fpsDisplay = document.getElementById("stats");
        if (!fpsDisplay) {
            fpsDisplay = document.createElement("div");
            fpsDisplay.id = "stats";
            fpsDisplay.style.position = "fixed";
            fpsDisplay.style.top = "10px";
            fpsDisplay.style.left = "10px";
            fpsDisplay.style.color = "white";
            fpsDisplay.style.backgroundColor = "rgba(0,0,0,0.5)";
            fpsDisplay.style.padding = "5px";
            fpsDisplay.style.zIndex = "1000";
            fpsDisplay.style.fontFamily = "monospace";
            container.appendChild(fpsDisplay); // Append to container
        }

        // Error Display Element (id="webgpu-error")
        let errorDisplay = document.getElementById("webgpu-error");
        if (!errorDisplay) {
            errorDisplay = document.createElement("div");
            errorDisplay.id = "webgpu-error";
            errorDisplay.style.position = "fixed";
            errorDisplay.style.bottom = "10px";
            errorDisplay.style.left = "10px";
            errorDisplay.style.right = "10px";
            errorDisplay.style.color = "red";
            errorDisplay.style.backgroundColor = "rgba(0,0,0,0.8)";
            errorDisplay.style.padding = "10px";
            errorDisplay.style.border = "1px solid darkred";
            errorDisplay.style.zIndex = "1001";
            errorDisplay.style.fontFamily = "monospace";
            errorDisplay.style.display = "none"; // Initially hidden
            container.appendChild(errorDisplay); // Append to container
        }

        return { canvas, fpsDisplay, errorDisplay };
    }

    /**
     * Start the particle animation loop.
     */
    start(): void {
        if (!this.particleSystem) {
            // console.error("WebGPUAnimationParticles not initialized or initialization failed. Call init() first.");
            // Attempt to re-initialize if parent container is known, or simply log error.
            // For now, just log and return.
            if (!this.parentContainer) {
                console.error(
                    "WebGPUAnimationParticles: Cannot start, not initialized and no parent container to re-init."
                );
                return;
            }
            console.warn(
                "WebGPUAnimationParticles: Attempting to start, but system not initialized. Trying to init again."
            );
            this.init(this.parentContainer).then((success) => {
                if (
                    success &&
                    this.particleSystem &&
                    !this.particleSystem.isRunning
                ) {
                    this.particleSystem.toggle();
                    this.isRunningState = this.particleSystem.isRunning;
                }
            });
            return;
        }

        try {
            if (!this.particleSystem.isRunning) {
                this.particleSystem.toggle();
            }
            this.isRunningState = this.particleSystem.isRunning;
        } catch (error) {
            console.error("Error starting particle animation:", error);
            if (this.errorDisplayElement) {
                this.errorDisplayElement.textContent = `Error starting animation: ${error.message}`;
                this.errorDisplayElement.style.display = "block";
            }
            this.isRunningState = false;
        }
    }

    /**
     * Stop the particle animation loop.
     */
    stop(): void {
        if (!this.particleSystem) {
            // Not initialized, so nothing to stop
            this.isRunningState = false;
            return;
        }
        try {
            if (this.particleSystem.isRunning) {
                this.particleSystem.toggle();
            }
            this.isRunningState = this.particleSystem.isRunning;
        } catch (error) {
            console.error("Error stopping particle animation:", error);
            if (this.errorDisplayElement) {
                this.errorDisplayElement.textContent = `Error stopping animation: ${error.message}`;
                this.errorDisplayElement.style.display = "block";
            }
            // Potentially, isRunning might be true if toggle failed, but reflect our intent
            this.isRunningState = false;
        }
    }

    /**
     * Clean up resources: stop animation and remove canvas and other created elements.
     */
    destroy(): void {
        this.stop();
        if (this.canvas && this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
        if (this.fpsDisplayElement && this.fpsDisplayElement.parentElement) {
            this.fpsDisplayElement.parentElement.removeChild(
                this.fpsDisplayElement
            );
        }
        if (
            this.errorDisplayElement &&
            this.errorDisplayElement.parentElement
        ) {
            this.errorDisplayElement.parentElement.removeChild(
                this.errorDisplayElement
            );
        }
        this.canvas = null;
        this.fpsDisplayElement = null;
        this.errorDisplayElement = null;
        this.parentContainer = null;
        this.particleSystem = null;
        this.isRunningState = false;
    }

    /**
     * Update canvas size, typically on window resize.
     * The underlying particle system reads canvas dimensions dynamically if designed to do so.
     */
    resize(): void {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            // If the particle system needs an explicit resize notification, call it here.
            // e.g., if (this.particleSystem && typeof this.particleSystem.resize === 'function') {
            //   this.particleSystem.resize(this.canvas.width, this.canvas.height);
            // }
        }
    }

    /**
     * Check if WebGPU particles are considered active by this manager.
     */
    get isActive(): boolean {
        if (this.particleSystem) {
            this.isRunningState = this.particleSystem.isRunning;
        } else {
            this.isRunningState = false;
        }
        return this.isRunningState;
    }
}
