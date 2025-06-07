import  anime from 'animejs';

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
            // });
            // document.body.appendChild(animationContainer);
            return; // If it's not in the template, we might have other issues.
        }

        // 0. Clear previous animation elements and make container visible
        animationContainer.innerHTML = ''; // Clear previous content
        animationContainer.style.display = 'block';
        animationContainer.style.backgroundColor = 'rgba(0,0,0,0.7)'; // Initial background

        // --- Helper function to create basic elements ---
        function createElement(tag: string, classes: string[] = [], styles: Partial<CSSStyleDeclaration> = {}, parent: HTMLElement = animationContainer!): HTMLElement {
            const el = document.createElement(tag);
            el.classList.add(...classes);
            Object.assign(el.style, styles);
            parent.appendChild(el); // Use the specified parent, defaulting to animationContainer
            return el;
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
        itemNameText.textContent = memnosphereData.itemName;


        // --- 2. Master Anime.js Timeline ---
        const tl = anime.timeline({
            easing: 'easeOutExpo', // Default easing for the timeline
            duration: 750,       // Default duration for animations in the timeline
            complete: () => {
                console.log(`Memnosphere animation complete for: ${memnosphereData.itemName}`);
                // Optional: Add a slight delay before hiding, or a fade-out for the container itself
                // Consider adding a "click to continue" or auto-advance after a few seconds
                setTimeout(() => {
                    if (animationContainer) {
                        anime({
                            targets: animationContainer,
                            opacity: 0,
                            duration: 500,
                            easing: 'linear',
                            complete: () => {
                                animationContainer.style.display = 'none';
                                animationContainer.innerHTML = ''; // Clean up
                                animationContainer.style.opacity = '1'; // Reset for next time
                                resolve(); // Resolve the promise here
                            }
                        });
                    } else {
                        resolve(); // Resolve even if container is somehow gone
                    }
                    // TODO: Call any post-animation logic here (e.g., display item in UI, resolve a promise)
                }, 2000); // Hold the final frame for 2 seconds before fading out
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

        // Phase B: Initial Burst / Energy Gathering (Placeholder for particle effects)
        // This is where you'd trigger functions to create and animate particles
        // Example: createSparkleEffect(particleContainer, 50, memnosphereData.rarity);
        tl.add({
            // Placeholder for particle/energy animations
            duration: 1000, // Duration of this phase
            begin: () => {
                const pcWidth = particleContainer.offsetWidth;
                const pcHeight = particleContainer.offsetHeight;
                const targetX = pcWidth / 2; // Center X of the particle container
                const targetY = pcHeight / 2; // Center Y of the particle container

                for (let i = 0; i < 100; i++) {
                    const initialLeftPercent = anime.random(20, 80);
                    const initialTopPercent = anime.random(20, 80);
                    const size = anime.random(5, 25);

                    const p = createElement('div', ['particle-effect'], {
                        position: 'absolute',
                        left: `${initialLeftPercent}%`,
                        top: `${initialTopPercent}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        //backgroundColor: `hsl(${anime.random(180,240)}, 100%, 70%)`,
                        borderRadius: '50%',
                        opacity: '0' // Start transparent, anime.js will handle fade-in
                    }, particleContainer);

                    // Calculate initial pixel position of the particle's top-left corner
                    const initialLeftPx = (initialLeftPercent / 100) * pcWidth;
                    const initialTopPx = (initialTopPercent / 100) * pcHeight;

                    // Calculate the required translation to move the particle's top-left to the target center
                    const finalTranslateX = targetX - initialLeftPx;
                    const finalTranslateY = targetY - initialTopPx;

                    // Calculate the angle towards the center
                    const angleRad = Math.atan2(finalTranslateY, finalTranslateX);
                    const angleDeg = angleRad * (180 / Math.PI);

                    // Create a pseudo-element for the skewed line
                    const line = document.createElement('div');
                    line.classList.add('particle-line');
                    p.appendChild(line);

                    // Apply styles to the pseudo-element using JavaScript
                    Object.assign(line.style, {
                        position: 'absolute',
                        top: '50%',
                        left: '0%',
                        width: '100%', // Adjust as needed
                        height: `${Math.log2(size)}px`,  // Line thickness
                        backgroundColor: `hsl(${anime.random(180,240)}, 100%, 70%)`, // Blues/Cyans
                        transformOrigin: '0% 50%', // Rotate around the left edge
                        transform: `rotate(${angleDeg}deg)`, // Rotate towards the center
                    });

                    anime({
                        targets: line,
                        height: [0, `${Math.log2(size)}px`],
                        duration: anime.random(100, 200),
                        easing: 'easeOutCubic',
                        delay: anime.random(0, 50),
                    })

                    anime({
                        targets: p,
                        width: 0,
                        height: 0,
                        translateX: [0, finalTranslateX], // Move towards the center X
                        translateY: [0, finalTranslateY], // Move towards the center Y
                        scale: [1, 0],
                        opacity: [1, 0.2],
                        duration: anime.random(300, 900),// Adjusted duration for travel
                        easing: 'easeOutCubic',            // Accelerate towards the target
                        delay: anime.random(50, 500),
                        complete: () => p.remove()
                    });
                }
            }
        });


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
