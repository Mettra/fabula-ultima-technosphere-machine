import { animate, createTimeline, utils, createSpring, createTimer, eases } from 'animejs';
import { DEV_MODE, Log } from "../core-config.js";
import { easing } from 'jquery';


class PathWindowAnimator {
    path: any;
    pathLength: any;
    windowLength: number;
    currentPosition: number;

  constructor(path, windowSize = 0.3) {
    this.path = path;
    this.pathLength = this.path.getTotalLength();
    this.windowLength = Math.ceil(this.pathLength * windowSize);
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
  animateFullSequence(duration = 3000) {
    // Create a dummy object to animate for custom onRender callbacks
    const dummy = { progress: 0 };

    const tl = createTimeline()

    // Phase 1: Fade in window at start
    tl.sync(createTimer({
        duration: duration * 0.05,
        onUpdate: (anim) => {
            const progress = eases.outSine(anim.progress);
            const currentWindowLength = this.windowLength * progress;
            this.path.style.strokeDasharray = `0 1 ${currentWindowLength} ${this.pathLength}`;
        }
    }))

    // Phase 2: Slide window across path
    tl.sync(createTimer({
        duration: duration * 0.8,
        onUpdate: (anim) => {
            this.setWindowPosition(eases.inOutSine(anim.progress));
        }
    }))

    // Phase 3: Fade out window at end
    tl.sync(createTimer({
        duration: duration * 0.2,
        onUpdate: (anim) => {
            const progress = 1 - eases.outSine(anim.progress);
            const currentWindowLength = this.windowLength * progress;
            const windowStart = this.pathLength - currentWindowLength;
            this.path.style.strokeDasharray = `0 ${windowStart} ${currentWindowLength} ${this.pathLength}`;
        }
    }))

    return tl
  }
}

interface HSLColor {
  h: number; // Hue: 0-360
  s: number; // Saturation: 0-100 (%)
  l: number; // Lightness: 0-100 (%)
}

/**
 * Converts a HEX color string to an HSL object.
 * @param hex The HEX color string (e.g., "#FF0000", "FF0000", "#F00", "F00").
 * @returns An HSLColor object {h, s, l} or null if the hex string is invalid.
 */
function hexToHSL(hex: string): HSLColor | null {
  if (!hex) {
    return null;
  }

  // Remove # if present
  let sanitizedHex = hex.startsWith('#') ? hex.slice(1) : hex;

  // Expand shorthand form (e.g., "F00" to "FF0000")
  if (sanitizedHex.length === 3) {
    sanitizedHex = sanitizedHex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (sanitizedHex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(sanitizedHex)) {
    console.error("Invalid HEX color string:", hex);
    return null; // Invalid hex format
  }

  const rHex = sanitizedHex.substring(0, 2);
  const gHex = sanitizedHex.substring(2, 4);
  const bHex = sanitizedHex.substring(4, 6);

  const r = parseInt(rHex, 16);
  const g = parseInt(gHex, 16);
  const b = parseInt(bHex, 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.error("Failed to parse HEX components:", hex);
    return null; // Should not happen if regex passed
  }

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta === 0) {
    // Achromatic (gray)
    h = 0;
    s = 0;
  } else {
    // Chromatic
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / delta + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

interface ImageColors {
  primary: HSLColor;
  secondary: HSLColor;
}

/**
 * Converts RGB color components to a HEX color string.
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns HEX color string (e.g., "#FF0000")
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Quickly determines primary and secondary colors from a pixel art image URL using mean shift clustering.
 * Assumes the image has bright and distinct colors.
 * This function is intended for browser environments.
 * @param imageUrl The URL of the image to analyze.
 * @returns A Promise that resolves with an object containing primary and secondary HSL color strings.
 */
async function getPixelArtColors(imageUrl: string): Promise<ImageColors> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      if (img.width === 0 || img.height === 0) {
        reject(new Error('Image has zero width or height.'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get 2D rendering context for canvas.'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (error) {
        let message = 'Failed to get image data.';
        if (error instanceof Error) {
            message += ` This might be due to CORS policy. Original error: ${error.message}`;
        } else if (typeof error === 'string') {
            message += ` Original error: ${error}`;
        }
        reject(new Error(message));
        return;
      }
      
      const data = imageData.data;
      const colorCounts: { [hexColor: string]: number } = {};

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 255) {
          const hex = rgbToHex(r, g, b);
          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        }
      }

      // --- Start of Mean Shift Implementation ---
      if (Object.keys(colorCounts).length === 0) {
        reject(new Error('No opaque colors found in the image.'));
        return;
      }

      // 1. Prepare initial points from unique colors
      const initialPoints: {
        rgb: { r: number; g: number; b: number }; // Original RGB
        count: number; // Pixel count of this original color
        id: number; // Unique ID for tracking/debugging
        currentRgb: { r: number; g: number; b: number }; // RGB value that gets shifted
      }[] = [];
      let pointId = 0;
      for (const hex in colorCounts) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        initialPoints.push({
          rgb: { r, g, b },
          count: colorCounts[hex],
          id: pointId++,
          currentRgb: { r, g, b },
        });
      }

      if (initialPoints.length === 0) {
          reject(new Error('No valid initial points for clustering.'));
          return;
      }

      // Helper for squared Euclidean distance in RGB space
      const calculateDistanceSq = (
        p1: { r: number; g: number; b: number },
        p2: { r: number; g: number; b: number }
      ): number => {
        const dr = p1.r - p2.r;
        const dg = p1.g - p2.g;
        const db = p1.b - p2.b;
        return dr * dr + dg * dg + db * db;
      };

      // Mean Shift Parameters (these may need tuning based on your image characteristics)
      const MEAN_SHIFT_BANDWIDTH = 40; // Radius for searching neighbors in RGB space
      const BANDWIDTH_SQ = MEAN_SHIFT_BANDWIDTH * MEAN_SHIFT_BANDWIDTH;
      const MAX_ITERATIONS = 15;       // Max iterations for convergence
      const CONVERGENCE_THRESHOLD_SQ = 0.5 * 0.5; // Min average movement to continue iterating

      let currentPointsState = initialPoints.map(p => ({ ...p })); // Work with copies

      // 2. Mean Shift Iterations
      for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        let totalMovementSq = 0;
        const nextPointsState = currentPointsState.map(point => {
          let sumR = 0, sumG = 0, sumB = 0;
          let totalWeightInKernel = 0;

          // For each point, find neighbors within bandwidth and calculate weighted mean
          for (const otherPoint of currentPointsState) {
            const distSq = calculateDistanceSq(point.currentRgb, otherPoint.currentRgb);
            if (distSq < BANDWIDTH_SQ) {
              // Weight by the original pixel count of the 'otherPoint'
              // This gives more influence to colors that were initially more prevalent
              const weight = otherPoint.count;
              sumR += otherPoint.currentRgb.r * weight;
              sumG += otherPoint.currentRgb.g * weight;
              sumB += otherPoint.currentRgb.b * weight;
              totalWeightInKernel += weight;
            }
          }

          let shiftedRgb;
          if (totalWeightInKernel > 0) {
            shiftedRgb = {
              r: sumR / totalWeightInKernel,
              g: sumG / totalWeightInKernel,
              b: sumB / totalWeightInKernel,
            };
          } else {
            // If no neighbors in bandwidth (isolated point), it doesn't move
            shiftedRgb = { ...point.currentRgb };
          }
          
          totalMovementSq += calculateDistanceSq(point.currentRgb, shiftedRgb);
          return { ...point, newRgb: shiftedRgb }; // Store the shifted position
        });

        // Update points to their new shifted positions
        currentPointsState = nextPointsState.map(p => ({ ...p, currentRgb: { ...p.newRgb } }));

        // Check for convergence
        if (currentPointsState.length > 0 && (totalMovementSq / currentPointsState.length) < CONVERGENCE_THRESHOLD_SQ && iter > 0) {
          break; // Converged
        }
      }

      // 3. Post-Iteration: Group converged points (modes) into clusters
      const CLUSTER_MERGE_THRESHOLD = 25; // Max distance to merge two modes into the same cluster
      const MERGE_THRESHOLD_SQ = CLUSTER_MERGE_THRESHOLD * CLUSTER_MERGE_THRESHOLD;
      
      // Modes are the final positions of the points after shifting
      const modes = currentPointsState.map(p => ({
          convergedRgb: p.currentRgb,
          originalCount: p.count, // Original pixel count of the color that led to this mode
      }));

      // Sort modes by their original pixel count to prioritize significant colors when forming clusters
      modes.sort((a, b) => b.originalCount - a.originalCount);

      const clusters: {
        center: { r: number; g: number; b: number };
        totalOriginalCount: number;
      }[] = [];
      const assignedToCluster = new Array(modes.length).fill(false);

      for (let i = 0; i < modes.length; i++) {
        if (assignedToCluster[i]) continue;

        const currentMode = modes[i];
        let clusterSumR = currentMode.convergedRgb.r * currentMode.originalCount;
        let clusterSumG = currentMode.convergedRgb.g * currentMode.originalCount;
        let clusterSumB = currentMode.convergedRgb.b * currentMode.originalCount;
        let clusterTotalOriginalCount = currentMode.originalCount;
        assignedToCluster[i] = true;

        // Find other modes close to the currentMode to form a cluster
        for (let j = i + 1; j < modes.length; j++) {
          if (assignedToCluster[j]) continue;
          const otherMode = modes[j];
          // Using currentMode.convergedRgb as the reference for merging
          if (calculateDistanceSq(currentMode.convergedRgb, otherMode.convergedRgb) < MERGE_THRESHOLD_SQ) {
            assignedToCluster[j] = true;
            clusterSumR += otherMode.convergedRgb.r * otherMode.originalCount;
            clusterSumG += otherMode.convergedRgb.g * otherMode.originalCount;
            clusterSumB += otherMode.convergedRgb.b * otherMode.originalCount;
            clusterTotalOriginalCount += otherMode.originalCount;
          }
        }
        
        if (clusterTotalOriginalCount > 0) {
            clusters.push({
              center: { // Calculate the weighted center of the cluster
                r: clusterSumR / clusterTotalOriginalCount,
                g: clusterSumG / clusterTotalOriginalCount,
                b: clusterSumB / clusterTotalOriginalCount,
              },
              totalOriginalCount: clusterTotalOriginalCount,
            });
        }
      }

      // Sort clusters by the total original pixel count they represent
      clusters.sort((a, b) => b.totalOriginalCount - a.totalOriginalCount);

      let primaryRgb: { r: number; g: number; b: number };
      let secondaryRgb: { r: number; g: number; b: number };

      if (clusters.length === 0) {
          // Fallback if clustering yields no results (e.g., very few distinct colors or unusual distribution)
          // Use the most frequent original color
          if (initialPoints.length > 0) {
              const mostFrequentInitial = [...initialPoints].sort((a,b) => b.count - a.count)[0];
              primaryRgb = mostFrequentInitial.rgb;
              secondaryRgb = mostFrequentInitial.rgb;
          } else {
              // This case should ideally be caught by earlier checks
              reject(new Error('Clustering resulted in no clusters and no fallback available.'));
              return;
          }
      } else {
          primaryRgb = clusters[0].center;
          secondaryRgb = clusters.length > 1 ? clusters[1].center : primaryRgb; // If only one cluster, use it for both
      }
      
      // Ensure RGB components are integers before converting to hex
      const finalPrimaryRgb = {
          r: Math.max(0, Math.min(255, Math.round(primaryRgb.r))),
          g: Math.max(0, Math.min(255, Math.round(primaryRgb.g))),
          b: Math.max(0, Math.min(255, Math.round(primaryRgb.b)))
      };
      const finalSecondaryRgb = {
          r: Math.max(0, Math.min(255, Math.round(secondaryRgb.r))),
          g: Math.max(0, Math.min(255, Math.round(secondaryRgb.g))),
          b: Math.max(0, Math.min(255, Math.round(secondaryRgb.b)))
      };

      const primaryHex = rgbToHex(finalPrimaryRgb.r, finalPrimaryRgb.g, finalPrimaryRgb.b);
      const secondaryHex = rgbToHex(finalSecondaryRgb.r, finalSecondaryRgb.g, finalSecondaryRgb.b);
      
      const primaryHSL = hexToHSL(primaryHex);
      const secondaryHSL = hexToHSL(secondaryHex);

      if (!primaryHSL || !secondaryHSL) {
          // Fallback if HSL conversion fails for some reason
          console.error("Failed to convert clustered RGB to HSL. Primary RGB:", finalPrimaryRgb, "Secondary RGB:", finalSecondaryRgb);
          // Attempt to use the most frequent color as a last resort
          if (initialPoints.length > 0) {
            const fallbackHex = rgbToHex(initialPoints[0].rgb.r, initialPoints[0].rgb.g, initialPoints[0].rgb.b);
            const fallbackHSL = hexToHSL(fallbackHex);
            if (fallbackHSL) {
                resolve({ primary: fallbackHSL, secondary: fallbackHSL });
                return;
            }
          }
          reject(new Error('Failed to convert clustered RGB colors to HSL and no fallback.'));
          return;
      }

      resolve({
        primary: primaryHSL,
        secondary: secondaryHSL,
      });
      // --- End of Mean Shift Implementation ---
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
}

/**
 * Plays the full-screen memnosphere gacha-style animation.
 * @param {object} memnosphereData - Data about the memnosphere being rolled.
 *                                 Example: { itemName: "Crystal Shard", rarity: "rare", imageUrl: "icons/crystal.png", effects: ["sparkle", "glow"] }
 */
export function playMemnosphereAnimation(memnosphereData: { itemName: string, rarity: string, imageUrl: string | null, effects?: string[] }): Promise<void> {
    return new Promise(async (resolve) => {
        let colors = await getPixelArtColors(memnosphereData.imageUrl)

        // --- Dynamic Color Palette Configuration ---
        // Define base palette colors - these can be easily changed to create different themes
        const PRIMARY_COLOR = colors.primary //{ h: 135, s: 100, l: 70 };   // Vibrant cyan-green (HSL: 135°, 100%, 70%)
        const SECONDARY_COLOR = colors.secondary //{ h: 190, s: 100, l: 65 }; // Bright cyan-blue (HSL: 190°, 100%, 65%)
        
        Log(PRIMARY_COLOR, SECONDARY_COLOR)

        // Enhanced color system with more sophisticated variations
        const ColorPalette = {
            // Core palette reference
            primary: PRIMARY_COLOR,
            secondary: SECONDARY_COLOR,
            
            // Generate HSL color string with optional modifications
            hsl: (baseColor: typeof PRIMARY_COLOR, hueShift = 0, satShift = 0, lightShift = 0, alpha?: number) => {
                const h = Math.max(0, Math.min(360, baseColor.h + hueShift));
                const s = Math.max(0, Math.min(100, baseColor.s + satShift));
                const l = Math.max(0, Math.min(100, baseColor.l + lightShift));
                return alpha !== undefined ? `hsla(${h}, ${s}%, ${l}%, ${alpha})` : `hsl(${h}, ${s}%, ${l}%)`;
            },
            
            // Generate RGB approximation for better compatibility
            rgb: (baseColor: typeof PRIMARY_COLOR, lightShift = 0, alpha = 1) => {
                const adjustedL = Math.max(0, Math.min(100, baseColor.l + lightShift));
                const factor = adjustedL / 100;
                
                // More accurate HSL to RGB conversion based on hue ranges
                let r, g, b;
                
                if (baseColor.h >= 120 && baseColor.h <= 180) { // Green-cyan range
                    const greenIntensity = 1 - Math.abs(baseColor.h - 150) / 30; // Peak at 150°
                    r = Math.round(80 * factor * (1 - greenIntensity * 0.6));
                    g = Math.round(255 * factor);
                    b = Math.round((180 + 75 * Math.sin((baseColor.h - 120) * Math.PI / 60)) * factor);
                } else if (baseColor.h >= 180 && baseColor.h <= 240) { // Cyan-blue range
                    const blueIntensity = (baseColor.h - 180) / 60; // 0 at cyan, 1 at blue
                    r = Math.round(60 * factor * (1 - blueIntensity * 0.3));
                    g = Math.round((220 - 20 * blueIntensity) * factor);
                    b = Math.round(255 * factor);
                } else { // Fallback for other hues
                    r = Math.round(100 * factor);
                    g = Math.round(200 * factor);
                    b = Math.round(230 * factor);
                }
                
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            },
            
            // Predefined color variations for common use cases
            variations: {
                // Light variations - higher lightness
                primaryLight: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 0, -10, 15, alpha),
                secondaryLight: (alpha?: number) => ColorPalette.hsl(SECONDARY_COLOR, 0, -10, 15, alpha),
                
                // Dark variations - lower lightness
                primaryDark: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 0, 10, -25, alpha),
                secondaryDark: (alpha?: number) => ColorPalette.hsl(SECONDARY_COLOR, 0, 10, -25, alpha),
                
                // Complementary colors - opposite on color wheel
                primaryComplement: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 180, 0, 0, alpha),
                secondaryComplement: (alpha?: number) => ColorPalette.hsl(SECONDARY_COLOR, 180, 0, 0, alpha),
                
                // Analogous colors - adjacent on color wheel
                primaryAnalog1: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 30, -5, 0, alpha),
                primaryAnalog2: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, -30, -5, 0, alpha),
                secondaryAnalog1: (alpha?: number) => ColorPalette.hsl(SECONDARY_COLOR, 30, -5, 0, alpha),
                secondaryAnalog2: (alpha?: number) => ColorPalette.hsl(SECONDARY_COLOR, -30, -5, 0, alpha),
                
                // Triadic colors - 120° apart
                primaryTriad1: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 120, -10, 5, alpha),
                primaryTriad2: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 240, -10, 5, alpha),
                
                // Desaturated versions for subtle effects
                primaryMuted: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 0, -40, -10, alpha),
                secondaryMuted: (alpha?: number) => ColorPalette.hsl(SECONDARY_COLOR, 0, -40, -10, alpha),
                
                // High contrast versions
                primaryBright: (alpha?: number) => ColorPalette.hsl(PRIMARY_COLOR, 0, 0, 20, alpha),
                secondaryBright: (alpha?: number) => ColorPalette.hsl(SECONDARY_COLOR, 0, 0, 20, alpha),
            }
        };
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
        }        function slidePathWindow(path, windowPercent = 0.3, duration = 3000) {
            const pathLength = path.getTotalLength();
            const windowLength = pathLength * windowPercent;
            
            return animate({ position: 0 }, {
                position: pathLength - windowLength,
                duration: duration,
                ease: 'inOutQuad',
                onRender: function(anim) {
                    const pos = anim.progress * (pathLength - windowLength);
                    const dashArray = `0 ${pos} ${windowLength} ${pathLength}`;
                    path.style.strokeDasharray = dashArray;
                    path.style.strokeDashoffset = '0';
                }
            });
        }

        // Helper function to add an SVG spiral trail animation to a timeline
        function addSvgSpiralTrail(
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
        ) {            const {
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
                easing = "inOutQuint",
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
            let pathTL = animator.animateFullSequence(duration);

            let opacityTL = createTimeline().add(path, {
                duration: duration,
                opacity : [
                    { to: 0, duration: 0, ease: 'linear' },
                    { to: 1, duration: duration * 0.2, ease: 'linear' }, // Quick fade in
                    { to: 1, duration: duration * 0.6, ease: 'linear' }, // Stay visible
                    { to: 0, duration: duration * 0.4, ease: 'linear' }  // Quick fade out
                ],
                onComplete: () => {
                    path.remove()
                }
            })


            let timeline = createTimeline()
            timeline.sync(pathTL)
            timeline.sync(opacityTL, `-=${duration}`)
            return timeline
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
            width: 'clamp(200px, 40%, 500px)', // Responsive size
            height: 'clamp(200px, 40%, 500px)',
            //border: '3px solid gold', // Example styling, can be dynamic
            //borderRadius: '10px',
            objectFit: 'contain',
            zIndex: '15'
        }) as HTMLImageElement;

        itemImageElement.src = "modules/fabula-ultima-technosphere-machine/assets/mnemosphere-blank.png"

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
        particleContainer.appendChild(svgOverlay); // Add to particle container        // Text element for item name (example)
        const itemNameText = createElement('div', ['animation-item-name'], {
            position: 'absolute',
            bottom: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: '0',
            color: 'white',
            fontSize: 'clamp(1.5em, 3vw, 2.5em)',
            textAlign: 'center',
            textShadow: '0 0 5px black, 0 0 10px black'
        });          // Center glow element for Phase B end transition
        const centerGlow = createElement('div', ['animation-center-glow'], {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 1) 0%, ${ColorPalette.variations.primaryDark(0.8)} 12%, ${ColorPalette.variations.secondaryDark(0.4)} 31%, rgba(255, 255, 255, 0) 50%)`,
            opacity: '0',
            pointerEvents: 'none',
            zIndex: '10' // Layer above the comets
        });

        // Star background container for Phase A and B
        const starContainer = createElement('div', ['animation-star-container'], {
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            left: '0',
            pointerEvents: 'none',
            zIndex: '5' // Below particles but above background
        });        // Create small glistening stars
        const stars: HTMLElement[] = [];
        const numStars = 40; // Number of stars to create
        for (let i = 0; i < numStars; i++) {            const star = createElement('div', ['animation-star'], {
                position: 'absolute',
                width: `${utils.random(2, 6)}px`,
                height: `${utils.random(2, 6)}px`,
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, ${ColorPalette.variations.secondaryDark(0.7)} 40%, ${ColorPalette.variations.primaryMuted(0.3)} 70%, transparent 100%)`,
                boxShadow: `0 0 ${utils.random(3, 8)}px rgba(255, 255, 255, 0.6)`,
                left: `${utils.random(5, 95)}%`,
                top: `${utils.random(5, 95)}%`,
                opacity: '0',
                transform: `scale(${utils.random(0.3, 1.2)})`,
                // Add slight color variation
                filter: `hue-rotate(${utils.random(-30, 30)}deg) brightness(${utils.random(0.8, 1.2)})`
            }, starContainer);
            stars.push(star);
        }// --- 2. Master Anime.js Timeline ---
        
        const tl = createTimeline({
            defaults: {
                ease: 'outExpo', // Default easing for the timeline
                duration: 750,       // Default duration for animations in the timeline
            },
            onComplete: () => {
                console.log(`Memnosphere animation complete for: ${memnosphereData.itemName}`);
                // Optional: Add a slight delay before hiding, or a fade-out for the container itself
                // Consider adding a "click to continue" or auto-advance after a few seconds
                const holdTime = 1000
                setTimeout(() => {                    
                    if (animationContainer) {
                        animate(animationContainer, {
                            opacity: 0,
                            duration: 500,
                            ease: 'linear',
                            onComplete: () => {
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
        });        // --- 3. Animation Phases (Add your Anime.js calls here) ---        
        // // Phase A: Intro & Background Transition
        tl.add(animationContainer, {
            backgroundColor: ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)'], // Fade in dark overlay
            duration: 300,
            ease: 'linear'
        })
        .add(bgLayer1, {
            opacity: [0, 0.6], // Example: fade in a subtle background texture or color wash
            backgroundColor: memnosphereData.rarity === 'legendary' ? 'rgba(255,215,0,0.2)' : 'rgba(50,50,70,0.3)',
            duration: 700,
            // Add background image animation if desired
            // translateX: ['-100%', '0%'], // Example slide-in
        }, '-=150') // Overlap with previous animation slightly
        
        // Add stars fade-in during Phase A
        .add(stars, {
            opacity: [0, 1],
            scale: (el, i) => [utils.random(0.1, 0.3), utils.random(0.8, 1.4)], // Random scale animation per star
            duration: (el, i) => utils.random(800, 1500), // Staggered timing
            delay: (el, i) => utils.random(0, 600), // Random delay for each star
            ease: 'outQuart'
        }, '-=500'); // Start during background fade        // Add gentle twinkling animation for stars during Phase A and B
        stars.forEach((star, index) => {
            const twinkleDelay = utils.random(1000, 3000); // Random delay before twinkling starts
            const twinkleDuration = utils.random(1500, 2500) * 2; // Random twinkling duration
            
            // Create individual twinkling timeline for each star
            setTimeout(() => {
                const starTwinkle = createTimeline({
                    loop: true
                });
                
                starTwinkle.add(star, {
                    opacity: [null, utils.random(0.3, 0.7), null, 1], // Fade down and back up
                    scale: [null, utils.random(0.7, 0.9), null, 1], // Slight scale variation
                    duration: twinkleDuration,
                    ease: 'linear'
                });
                
                // Store the timeline reference to stop it later
                (star as any).twinkleTimeline = starTwinkle;
            }, twinkleDelay);
        });

        // Phase B: Spiraling Trails
        // Ensure particle container dimensions are available for calculations
        // These might be 0 if the container is not yet rendered or display:none

        const pcRect = particleContainer.getBoundingClientRect();
        const pcWidth = pcRect.width;
        const pcHeight = pcRect.height;
        const targetX = pcWidth / 2;
        const targetY = pcHeight / 2;        
        let spiralDuration = 0
        if (pcWidth > 0 && pcHeight > 0) { // Only create trails if container has valid dimensions
            const numTrails = 30; // Number of trails
            const trailAnimDurationBase = 1800; // Base duration for a trail to draw
            const trailStagger = 100; // ms delay between the start of each trail            
            const totalSpiralTimeline = createTimeline()
            for (let i = 0; i < numTrails; i++) {
                let duration = trailAnimDurationBase + utils.random(-1000, 200)

                let color = utils.randomPick([PRIMARY_COLOR, SECONDARY_COLOR])

                  // Generate dynamic trail color using the palette
                const trailHue = color.h + utils.random(-10, 10);
                const trailSaturation = color.s + utils.random(-10, 10);
                const trailLightness = color.l + utils.random(-10, 10);
                
                let spiralTimeline = addSvgSpiralTrail("", {
                    svgContainer: svgOverlay,
                    centerX: targetX,
                    centerY: targetY,
                    startRadius: Math.min(pcWidth, pcHeight) * utils.random(30, 80) / 100, // Start further out
                    endRadius: 0, // End exactly at the center
                    rotations: utils.random(2, 6), // Fewer rotations for better convergence
                    duration: duration,
                    trailSpecificDelay: trailStagger, // Stagger start time of each trail
                    color: `hsl(${trailHue}, ${trailSaturation}%, ${trailLightness}%)`, // Dynamic colors based on palette
                    strokeWidth: utils.random(1, 7),
                    initialAngleOffset: utils.random(0, Math.PI * 2), // Random start angle for each trail
                    pointsPerRotation: 48 // More points for smoother spirals                
                });

                let offset = utils.random(0, 1000)
                spiralDuration = Math.max(spiralDuration, duration + offset)
                totalSpiralTimeline.sync(spiralTimeline, `${offset}`)

            }            
            tl.sync(totalSpiralTimeline, `<`)

        } else {
            console.warn("Particle container has no dimensions, skipping Phase B trails.");
        }       
          // Phase B.5: Center Glow Transition
        // Add a radial glow that starts at the end of the spiral trails and fades before item reveal
        tl.add(centerGlow, {
            opacity: [0, 1, 0],
            width: ['200px', '1600px', '4200px'], // Start small, grow to cover center focus area, then slightly larger as it fades
            height: ['200px', '1600px', '4200px'], // Keep it circular by matching width
            duration: spiralDuration + 500,
            ease: 'inOutQuad'
        }, '<<+=500')
        

        // Phase C: Item Reveal
        tl.add(itemImageElement, {
            opacity: [0, 1],
            scale: [0.3, 1.1, 1], // Zoom in, slight overshoot, then settle
            rotate: ['-10deg', '5deg', '0deg'], // Slight wobble
            duration: 1200,
            ease: createSpring({ mass: 1, stiffness: 80, damping: 10, velocity: 0 }), // Spring physics for a bouncier feel
        }, '<-=500'); // Overlap with the end of particle effects        // Phase D: Rarity Indication & Text Reveal
        
        let glowColor = 'rgba(255,255,255,0.7)'; // Default glow
        if (memnosphereData.rarity.toLowerCase() === 'rare') glowColor = 'rgba(0,191,255,0.7)'; // Deep sky blue
        else if (memnosphereData.rarity.toLowerCase() === 'epic') glowColor = 'rgba(138,43,226,0.7)'; // Blue violet
        else if (memnosphereData.rarity.toLowerCase() === 'legendary') glowColor = 'rgba(255,165,0,0.8)'; // Orange

        tl.add(itemImageElement, {
            boxShadow: [
                `0 0 0px 0px ${glowColor}`,
                `0 0 30px 10px ${glowColor}`,
                `0 0 15px 5px ${glowColor}` // Settle with a smaller glow
            ],
            duration: 800,
            ease: 'outQuad'
        }, '<-=800'); // Start glow during item reveal

        tl.add(itemNameText, {
            opacity: [0, 1],
            translateY: ['20px', '0px'], // Slide up
            duration: 600,
            ease: 'outQuint'
        }, '<-=600'); // Overlap with item settling


        // Phase E: Outro / Final Flourish (e.g. lingering particles, item pulse)
        tl.add(itemImageElement, {
            scale: [1, 1.05, 1], // Subtle pulse
            duration: 500,
            ease: 'inOutSine',
            loop: 2, // Pulse a couple of times
        }, '<-=300');


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
