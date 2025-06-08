import animeJS from 'animejs';
import { init as initAnimeInspector } from '../../lib/anime-inspector.js';
import { DEV_MODE, Log } from "../core-config.js";
import { easing } from 'jquery';
const anime = animeJS;


class PathWindowAnimator {
    path: any;
    pathLength: any;
    windowLength: number;
    currentPosition: number;

  constructor(path, windowSize = 0.3) {
    this.path = path;
    this.pathLength = this.path.getTotalLength();
    this.windowLength = this.pathLength * windowSize;
    this.currentPosition = 0;
  }
  
  // Set window position (0 = start, 1 = end)
  setWindowPosition(progress) {
    // Clamp progress between 0 and 1
    progress = Math.max(0, Math.min(1, progress));
    
    // Calculate window boundaries
    const maxStart = this.pathLength - this.windowLength;
    const windowStart = maxStart * progress;
    const windowEnd = windowStart + this.windowLength;
    
    // Create dash pattern: gap-before, visible-section, gap-after
    const dashArray = `0 ${windowStart} ${this.windowLength} ${this.pathLength - windowEnd}`;
    this.path.style.strokeDasharray = dashArray;
    this.path.style.strokeDashoffset = '0';
    
    this.currentPosition = progress;
  }
  
  // Animate the complete sequence
  animateFullSequence(tl, duration = 3000, offset = "") {
    return tl
      // Phase 1: Fade in window at start
      .add({
        duration: duration * 0.05,
        easing: "easeOutSine",
        update: (anim) => {
          const progress = anim.progress / 100;
          const currentWindowLength = this.windowLength * progress;
          this.path.style.strokeDasharray = `0 0 ${currentWindowLength} ${this.pathLength}`;
        }
      }, offset)
      // Phase 2: Slide window across path
      .add({
        duration: duration * 0.8,
        easing: "easeInOutSine",
        update: (anim) => {
          const progress = anim.progress / 100;
          this.setWindowPosition(progress);
        }
      }, offset)
      // Phase 3: Fade out window at end
      .add({
        duration: duration * 0.2,
        easing: "easeOutSine",
        update: (anim) => {
          const progress = 1 - (anim.progress / 100);
          const currentWindowLength = this.windowLength * progress;
          const windowStart = this.pathLength - currentWindowLength;
          this.path.style.strokeDasharray = `0 ${windowStart} ${currentWindowLength} ${this.pathLength}`;
        },

        complete: () => {
            this.path.remove(); // Remove path after animation
        }
      }, offset);
  }
}

/**
 * Plays the full-screen memnosphere gacha-style animation.
 * @param {object} memnosphereData - Data about the memnosphere being rolled.
 *                                 Example: { itemName: "Crystal Shard", rarity: "rare", imageUrl: "icons/crystal.png", effects: ["sparkle", "glow"] }
 */
export function playMemnosphereAnimation(memnosphereData: { itemName: string, rarity: string, imageUrl: string | null, effects?: string[] }): Promise<void> {
    return new Promise((resolve) => {
        const animationContainerId = 'memnosphere-animation-container';
        let animationContainer = document.getElementById(animationContainerId);

        if (!animationContainer) {
            console.error("Memnosphere animation container not found! Make sure it's in animation-overlay.hbs");
            // Optionally, create it if it doesn't exist, though it's better to have it in the template.
            // animationContainer = document.createElement('div');
            // animationContainer.id = animationContainerId;
            // Object.assign(animationContainer.style, {
            //     display: 'none',
            //     position: 'fixed',
            //     top: '0',
            //     left: '0',
            //     width: '100vw',
            //     height: '100vh',
            //     backgroundColor: 'rgba(0,0,0,0.7)',
            //     zIndex: '9999', // Ensure this is higher than other UI elements
            //     overflow: 'hidden'
            // });            // document.body.appendChild(animationContainer);
            return; // If it's not in the template, we might have other issues.
        }

        // Clear previous content and reset container state
        animationContainer.innerHTML = '';
        
        // Reset all container styles to initial state
        animationContainer.style.display = 'block';
        animationContainer.style.backgroundColor = 'rgba(0,0,0,0.7)';
        animationContainer.style.opacity = '1';
        animationContainer.style.transform = '';
        animationContainer.style.pointerEvents = 'none'; // Reset pointer events

        // Enable pointer events and click to close in dev mode
        if (DEV_MODE) {
            animationContainer.style.pointerEvents = 'auto';
            const closeHint = animationContainer.querySelector('.animation-close-hint') as HTMLElement;
            if (closeHint) {
                closeHint.style.display = 'block';
            }
            
            // Add click handler to close animation in dev mode
            const clickHandler = (event: MouseEvent) => {
                if (event.target === animationContainer) {
                    Log("Dev mode: Animation closed by click");
                    animationContainer.style.display = 'none';
                    animationContainer.style.pointerEvents = 'none';
                    if (closeHint) {
                        closeHint.style.display = 'none';
                    }
                    resolve();
                }
            };
            animationContainer.addEventListener('click', clickHandler, { once: true });
        }

        // --- Helper function to create basic elements ---
        function createElement(tag: string, classes: string[] = [], styles: Partial<CSSStyleDeclaration> = {}, parent: HTMLElement = animationContainer!): HTMLElement {
            const el = document.createElement(tag);
            el.classList.add(...classes);
            Object.assign(el.style, styles);
            parent.appendChild(el); // Use the specified parent, defaulting to animationContainer
            return el;
        }

        function slidePathWindow(path, windowPercent = 0.3, duration = 3000) : anime.AnimeAnimParams {
            const pathLength = path.getTotalLength();
            const windowLength = pathLength * windowPercent;
            
            return {
                    targets: { position: 0 },
                    position: pathLength - windowLength,
                    duration: duration,
                    easing: 'easeInOutQuad',
                    update: function(anim) {
                        const pos = anim.animatables[0].target.position;
                        const dashArray = `0 ${pos} ${windowLength} ${pathLength}`;
                        path.style.strokeDasharray = dashArray;
                        path.style.strokeDashoffset = '0';
                }
            };
        }

        // Helper function to add an SVG spiral trail animation to a timeline
        function addSvgSpiralTrail(
            timeline: anime.AnimeTimelineInstance,
            baseOffset: string | number, // Base offset for this group of trails
            options: {
                svgContainer: SVGElement,
                centerX: number,
                centerY: number,
                startRadius: number,
                endRadius: number,
                rotations: number,
                duration: number,
                trailSpecificDelay?: number, // Delay for this specific trail relative to baseOffset
                color?: string,
                strokeWidth?: number,
                initialAngleOffset?: number, // in radians
                pointsPerRotation?: number,
                easing?: string,
            }
        ) {
            const {
                svgContainer,
                centerX,
                centerY,
                startRadius,
                endRadius,
                rotations,
                duration,
                trailSpecificDelay = 0,
                color = 'lime',
                strokeWidth = 4,
                initialAngleOffset = 0,
                pointsPerRotation = 36,
                easing = "easeInOutQuint",
            } = options;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            svgContainer.appendChild(path);

            const totalAngle = rotations * 2 * Math.PI;
            const numPoints = Math.max(2, Math.ceil(rotations * pointsPerRotation));

            let d = '';
            for (let i = 0; i <= numPoints; i++) {
                const progress = i / numPoints;
                const currentAngle = initialAngleOffset + progress * totalAngle;
                const currentRadius = startRadius + (endRadius - startRadius) * progress;
                const x = centerX + currentRadius * Math.cos(currentAngle);
                const y = centerY + currentRadius * Math.sin(currentAngle);
                if (i === 0) {
                    d += `M ${x} ${y}`;
                } else {
                    d += ` L ${x} ${y}`;
                }
            }

            path.setAttribute('d', d);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', strokeWidth.toString());
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            
            const pathLength = path.getTotalLength();
            if (pathLength === 0) { // Path is empty or invalid, remove and skip animation
                path.remove();
                return;
            }            
            
            // Initialize path style for animation
            path.style.opacity = '0'; // Start hidden

            const animator = new PathWindowAnimator(path, 0.25); // 25% window size
            animator.animateFullSequence(timeline, duration, `-=${trailSpecificDelay}`);

            timeline.add({
                targets: path,
                duration: duration,
                opacity : [
                    { value: 0, duration: 0, easing: 'linear' },
                    { value: 1, duration: duration * 0.05, easing: 'linear' }, // Quick fade in
                    { value: 1, duration: duration * 0.99, easing: 'linear' }, // Stay visible
                    { value: 0, duration: duration * 0.01, easing: 'linear' }  // Quick fade out
                ]
            }, `-=${duration}`)
        }

        // --- 1. Create Dynamic Elements (Examples - expand as needed) ---

        // Background layers (could be more sophisticated with multiple layers)
        const bgLayer1 = createElement('div', ['animation-bg-layer'], {
            width: '100%',
            height: '100%',
            position: 'absolute',
            opacity: '0',
            // Example: background: 'url(path/to/your/default_bg.webp) center center / cover no-repeat'
        });

        // Item image placeholder
        const itemImageElement = createElement('img', ['animation-item-image'], {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) scale(0.5)', // Initial state for animation
            opacity: '0',
            maxWidth: 'clamp(200px, 40%, 500px)', // Responsive size
            maxHeight: 'clamp(200px, 40%, 500px)',
            //border: '3px solid gold', // Example styling, can be dynamic
            //borderRadius: '10px',
            objectFit: 'contain',
        }) as HTMLImageElement;

        if (memnosphereData.imageUrl) {
            itemImageElement.src = memnosphereData.imageUrl;
        } else {
            itemImageElement.alt = memnosphereData.itemName || "Revealed Item"; // Fallback alt text
        }

        // Particle container (if using DOM particles, otherwise use canvas)
        const particleContainer = createElement('div', ['particle-container'], {
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            left: '0',
            pointerEvents: 'none' // Particles shouldn't block interaction
        });

        // SVG Overlay for trails
        const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        Object.assign(svgOverlay.style, {
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            left: '0',
            pointerEvents: 'none',
            overflow: 'visible' // Important for paths that might go slightly out of bounds during animation
        });
        particleContainer.appendChild(svgOverlay); // Add to particle container

        // Text element for item name (example)
        const itemNameText = createElement('div', ['animation-item-name'], {
            position: 'absolute',
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: '0',
            color: 'white',
            fontSize: 'clamp(1.5em, 3vw, 2.5em)',
            textAlign: 'center',
            textShadow: '0 0 5px black, 0 0 10px black'
        });
        itemNameText.textContent = memnosphereData.itemName;        // --- 2. Master Anime.js Timeline ---
        const tl = anime.timeline({
            easing: 'easeOutExpo', // Default easing for the timeline
            duration: 750,       // Default duration for animations in the timeline
            complete: () => {
                console.log(`Memnosphere animation complete for: ${memnosphereData.itemName}`);
                // Optional: Add a slight delay before hiding, or a fade-out for the container itself
                // Consider adding a "click to continue" or auto-advance after a few seconds
                const holdTime = 1000
                setTimeout(() => {
                    if (animationContainer) {
                        anime({
                            targets: animationContainer,
                            opacity: 0,
                            duration: 500,
                            easing: 'linear',
                            complete: () => {
                                animationContainer.style.display = 'none';
                                animationContainer.style.pointerEvents = 'none';
                                animationContainer.innerHTML = ''; // Clean up
                                animationContainer.style.opacity = '1'; // Reset for next time
                                const closeHint = animationContainer.querySelector('.animation-close-hint') as HTMLElement;
                                if (closeHint) {
                                    closeHint.style.display = 'none';
                                }
                                resolve(); // Resolve the promise here
                            }
                        });
                    } else {
                        resolve(); // Resolve even if container is somehow gone
                    }
                    // TODO: Call any post-animation logic here (e.g., display item in UI, resolve a promise)
                }, holdTime); // Hold the final frame before fading out
            }
        });

        // --- 3. Animation Phases (Add your Anime.js calls here) ---

        // Phase A: Intro & Background Transition
        tl.add({
            targets: animationContainer,
            backgroundColor: ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)'], // Fade in dark overlay
            duration: 300,
            easing: 'linear'
        })
        .add({
            targets: bgLayer1,
            opacity: [0, 0.6], // Example: fade in a subtle background texture or color wash
            // backgroundColor: memnosphereData.rarity === 'legendary' ? 'rgba(255,215,0,0.2)' : 'rgba(50,50,70,0.3)',
            duration: 700,
            // Add background image animation if desired
            // translateX: ['-100%', '0%'], // Example slide-in
        }, '-=150'); // Overlap with previous animation slightly

        // Phase B: Spiraling Trails
        const phaseBBaseOffset = '+=50'; // Start Phase B effects 50ms after Phase A animations effectively end

        // Ensure particle container dimensions are available for calculations
        // These might be 0 if the container is not yet rendered or display:none
        const pcRect = particleContainer.getBoundingClientRect();
        const pcWidth = pcRect.width;
        const pcHeight = pcRect.height;
        const targetX = pcWidth / 2;
        const targetY = pcHeight / 2;

        if (pcWidth > 0 && pcHeight > 0) { // Only create trails if container has valid dimensions
            const numTrails = anime.random(7, 12); // Number of trails
            const trailAnimDurationBase = 1800; // Base duration for a trail to draw
            const trailStagger = 100; // ms delay between the start of each trail

            for (let i = 0; i < numTrails; i++) {
                addSvgSpiralTrail(tl, "", {
                    svgContainer: svgOverlay,
                    centerX: targetX,
                    centerY: targetY,
                    startRadius: Math.min(pcWidth, pcHeight) * anime.random(30, 80) / 100, // Start further out
                    endRadius: 0, // End exactly at the center
                    rotations: anime.random(2, 6), // Fewer rotations for better convergence
                    duration: trailAnimDurationBase + anime.random(-300, 400),
                    trailSpecificDelay: i * trailStagger, // Stagger start time of each trail
                    color: `hsl(${anime.random(100, 170)}, 100%, ${anime.random(60, 80)}%)`, // Vibrant greens/cyans
                    strokeWidth: anime.random(1, 7),
                    initialAngleOffset: anime.random(0, Math.PI * 2), // Random start angle for each trail
                    pointsPerRotation: 48 // More points for smoother spirals
                });
            }
        } else {
            console.warn("Particle container has no dimensions, skipping Phase B trails.");
        }

        // The old Phase B (particle effects) is removed. 
        // If you still want the old particle effects, you would add them here as another set of animations.
        // For example, to add them concurrently with the trails:
        // tl.add({ /* old particle animation params */ }, phaseBBaseOffset);

        // Phase C: Item Reveal
        tl.add({
            targets: itemImageElement,
            opacity: [0, 1],
            scale: [0.3, 1.1, 1], // Zoom in, slight overshoot, then settle
            rotate: ['-10deg', '5deg', '0deg'], // Slight wobble
            duration: 1200,
            easing: 'spring(1, 80, 10, 0)', // Spring physics for a bouncier feel
        }, '-=500'); // Overlap with the end of particle effects

        // Phase D: Rarity Indication & Text Reveal
        // Example: Add a glow based on rarity
        if (memnosphereData.rarity) {
            let glowColor = 'rgba(255,255,255,0.7)'; // Default glow
            if (memnosphereData.rarity.toLowerCase() === 'rare') glowColor = 'rgba(0,191,255,0.7)'; // Deep sky blue
            else if (memnosphereData.rarity.toLowerCase() === 'epic') glowColor = 'rgba(138,43,226,0.7)'; // Blue violet
            else if (memnosphereData.rarity.toLowerCase() === 'legendary') glowColor = 'rgba(255,165,0,0.8)'; // Orange

            tl.add({
                targets: itemImageElement,
                boxShadow: [
                    `0 0 0px 0px ${glowColor}`,
                    `0 0 30px 10px ${glowColor}`,
                    `0 0 15px 5px ${glowColor}` // Settle with a smaller glow
                ],
                duration: 800,
                easing: 'easeOutQuad'
            }, '-=800'); // Start glow during item reveal
        }

        tl.add({
            targets: itemNameText,
            opacity: [0, 1],
            translateY: ['20px', '0px'], // Slide up
            duration: 600,
            easing: 'easeOutQuint'
        }, '-=600'); // Overlap with item settling


        // Phase E: Outro / Final Flourish (e.g. lingering particles, item pulse)
        tl.add({
            targets: itemImageElement,
            scale: [1, 1.05, 1], // Subtle pulse
            duration: 1500,
            easing: 'easeInOutSine',
            loop: 2, // Pulse a couple of times
        }, '-=300');


        // Start the animation
        tl.play();
    });
}

// --- Example of how you might call this function ---
// This would typically be called from your game logic when a memnosphere is rolled.
// For testing, you could expose it globally or call it from another module.
//
// Example Usage (ensure this is called after the DOM is ready and Anime.js is loaded):
//
// document.addEventListener('DOMContentLoaded', () => {
//   const testButton = document.createElement('button');
//   testButton.textContent = "Test Memnosphere Animation";
//   testButton.style.position = 'fixed';
//   testButton.style.top = '10px';
//   testButton.style.left = '10px';
//   testButton.style.zIndex = '10000';
//   document.body.appendChild(testButton);
//
//   testButton.onclick = () => {
//     playMemnosphereAnimation({
//       itemName: "Legendary Technocore",
//       rarity: "legendary",
//       imageUrl: "modules/fabula-ultima-technosphere-machine/assets/icons/items/technocore_legendary.webp", // Replace with an actual image path
//       effects: ["glow", "shimmer"]
//     });
//   };
// });
//
// Make sure you have an image at the specified path or change it to one you have.
// You might need to adjust the imageUrl path based on your Foundry VTT module structure.
// For example, if your icons are in 'modules/your-module-name/assets/icons/...'
//
// Also, ensure the animation container exists in your HTML (e.g., in animation-overlay.hbs)
// <div id="memnosphere-animation-container" style="display: none;"></div>
//
// And the necessary CSS for .animation-item-image, .animation-item-name etc. in animation-overlay.css
//
// .animation-item-image {
//   /* Basic styles, Anime.js will override transform and opacity */
//   transition: box-shadow 0.3s ease-out; /* For smooth shadow transitions if not animated by Anime.js directly */
// }
//
// .animation-item-name {
//   font-family: var(--your-cool-font-family); /* Define in your main CSS */
// }

// Remember to export this function if it's part of a module system
// export { playMemnosphereAnimation }; // Already done by 'export function'
