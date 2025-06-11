// webgpu.js - WebGPU Particles Integration
//
// This file provides the JavaScript bridge between the browser's WebGPU API and a Zig-compiled WebAssembly module for rendering GPU-accelerated particles.
// It manages WebGPU device setup, buffer and pipeline creation, WASM communication, and the animation/render loop.
//
// DO NOT MODIFY THIS FILE.
// This file is part of an external library and may be overwritten or updated by upstream changes.
//
// For customizations, use a separate file or consult project maintainers.
//
// ------------------------------------------------------------

class WebGPUParticles {
    constructor(wasmPath, canvas, fpsDisplay, errorDisplay) {
        this.wasmPath = wasmPath;
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.wasm = null;
        this.buffers = new Map();
        this.shaderModules = new Map();
        this.renderPipelines = new Map();
        this.currentRenderPass = null;
        this.commandEncoder = null;
        this.nextBufferId = 1;
        this.nextShaderId = 1;
        this.nextPipelineId = 1;
        this.isRunning = false;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsDisplay = fpsDisplay;
        this.errorDisplay = errorDisplay;
    }

    async init() {
        try {
            // Check WebGPU support
            if (!navigator.gpu) {
                throw new Error('WebGPU not supported');
            }

            // Get adapter and device
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                throw new Error('Failed to get WebGPU adapter');
            }

            this.device = await adapter.requestDevice();
            
            // Configure canvas
            this.context = this.canvas.getContext('webgpu');
            const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
            
            this.context.configure({
                device: this.device,
                format: canvasFormat,
                alphaMode: 'premultiplied', // Added for transparency
            });            // Load WASM module
            await this.loadWasm();
            
            // Test Zig communication first
            console.log('🧪 JS: Testing Zig communication...');
            this.wasm.exports.zigIsAlive();
            
            // Initialize the Zig application
            console.log('🚀 JS: Starting Zig initialization...');
            this.wasm.exports.init();
            
            this.isRunning = true;
            this.startRenderLoop();
            
            console.log('WebGPU Particles initialized successfully');
        } catch (error) {
            console.error('Initialization failed:', error);
            if (this.errorDisplay) {
                this.errorDisplay.textContent = `Error: ${error.message}`;
            }
        }
    }    async loadWasm() {
        // Import functions that WASM will call
        const imports = {
            env: {
                getCanvasWidth: () => this.canvas.width,
                getCanvasHeight: () => this.canvas.height,
                createBuffer: (size) => this.createBuffer(size),
                writeBuffer: (bufferId, dataPtr, size) => this.writeBuffer(bufferId, dataPtr, size),
                createShaderModule: (codePtr, codeLen) => this.createShaderModule(codePtr, codeLen),
                createRenderPipeline: (vertexShader, fragmentShader) => this.createRenderPipeline(vertexShader, fragmentShader),
                beginRenderPass: (r, g, b, a) => this.beginRenderPass(r, g, b, a),
                setRenderPipeline: (pipelineId) => this.setRenderPipeline(pipelineId),
                setVertexBuffer: (slot, bufferId) => this.setVertexBuffer(slot, bufferId),
                draw: (vertexCount, instanceCount) => this.draw(vertexCount, instanceCount),
                endRenderPass: () => this.endRenderPass(),
                submitCommands: () => this.submitCommands(),
                requestAnimationFrame: () => this.requestAnimationFrame(),
                // Console logging functions
                consoleLog: (msgPtr, msgLen) => this.consoleLog(msgPtr, msgLen),
                consoleWarn: (msgPtr, msgLen) => this.consoleWarn(msgPtr, msgLen),
                consoleError: (msgPtr, msgLen) => this.consoleError(msgPtr, msgLen),
            }
        };

        try {
            const wasmModule = await WebAssembly.instantiateStreaming(
                fetch(this.wasmPath),
                imports
            );
            this.wasm = wasmModule.instance;
        } catch (error) {
            console.error('Failed to load WASM:', error);
            throw new Error('Failed to load WebAssembly module. Make sure to build the project first.');
        }
    }

    createBuffer(size) {
        const buffer = this.device.createBuffer({
            size: size,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        
        const id = this.nextBufferId++;
        this.buffers.set(id, buffer);
        return id;
    }

    writeBuffer(bufferId, dataPtr, size) {
        const buffer = this.buffers.get(bufferId);
        if (!buffer) return;

        const data = new Uint8Array(this.wasm.exports.memory.buffer, dataPtr, size);
        this.device.queue.writeBuffer(buffer, 0, data);
    }

    createShaderModule(codePtr, codeLen) {
        const code = new TextDecoder().decode(
            new Uint8Array(this.wasm.exports.memory.buffer, codePtr, codeLen)
        );
        
        const shaderModule = this.device.createShaderModule({
            code: code,
        });
        
        const id = this.nextShaderId++;
        this.shaderModules.set(id, shaderModule);
        return id;
    }

    createRenderPipeline(vertexShaderId, fragmentShaderId) {
        const vertexShader = this.shaderModules.get(vertexShaderId);
        const fragmentShader = this.shaderModules.get(fragmentShaderId);
        
        if (!vertexShader || !fragmentShader) return 0;

        const pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: vertexShader,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 24, // 2 floats (position) + 4 floats (color) = 6 * 4 bytes
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x2', // position
                        },
                        {
                            shaderLocation: 1,
                            offset: 8,
                            format: 'float32x4', // color
                        },
                    ],
                }],
            },
            fragment: {
                module: fragmentShader,
                entryPoint: 'fs_main',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    blend: {
                        color: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        const id = this.nextPipelineId++;
        this.renderPipelines.set(id, pipeline);
        return id;
    }

    beginRenderPass(r, g, b, a) {
        this.commandEncoder = this.device.createCommandEncoder();
        
        this.currentRenderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r, g, b, a },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
    }

    setRenderPipeline(pipelineId) {
        const pipeline = this.renderPipelines.get(pipelineId);
        if (pipeline && this.currentRenderPass) {
            this.currentRenderPass.setPipeline(pipeline);
        }
    }

    setVertexBuffer(slot, bufferId) {
        const buffer = this.buffers.get(bufferId);
        if (buffer && this.currentRenderPass) {
            this.currentRenderPass.setVertexBuffer(slot, buffer);
        }
    }

    draw(vertexCount, instanceCount) {
        if (this.currentRenderPass) {
            this.currentRenderPass.draw(vertexCount, instanceCount);
        }
    }

    endRenderPass() {
        if (this.currentRenderPass) {
            this.currentRenderPass.end();
            this.currentRenderPass = null;
        }
    }

    submitCommands() {
        if (this.commandEncoder) {
            this.device.queue.submit([this.commandEncoder.finish()]);
            this.commandEncoder = null;
        }
    }

    requestAnimationFrame() {
        if (this.isRunning) {
            requestAnimationFrame(() => this.frame());
        }
    }

    frame() {
        this.wasm.exports.frame();
        
        // Update FPS counter
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.fpsDisplay.textContent = `Particles: ${this.wasm.exports.getParticleCount()} | FPS: ${fps}`;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }

    startRenderLoop() {
        this.requestAnimationFrame();
    }    toggle() {
        this.isRunning = !this.isRunning;
        if (this.isRunning) {
            this.startRenderLoop();
        }
    }

    // Console logging methods for Zig
    consoleLog(msgPtr, msgLen) {
        const message = new TextDecoder().decode(
            new Uint8Array(this.wasm.exports.memory.buffer, msgPtr, msgLen)
        );
        console.log(message);
    }

    consoleWarn(msgPtr, msgLen) {
        const message = new TextDecoder().decode(
            new Uint8Array(this.wasm.exports.memory.buffer, msgPtr, msgLen)
        );
        console.warn(message);
    }

    consoleError(msgPtr, msgLen) {
        const message = new TextDecoder().decode(
            new Uint8Array(this.wasm.exports.memory.buffer, msgPtr, msgLen)
        );
        console.error(message);
    }
}

// Global instance and event listeners removed for module integration.
// Instantiation and control should be handled by the importing TypeScript module.
// Make the class available globally for the importing module
if (typeof window !== 'undefined') {
    window.WebGPUParticles = WebGPUParticles;
}