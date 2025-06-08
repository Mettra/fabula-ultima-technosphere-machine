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
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes h, s, and v are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number} h       The hue as a number in the interval [0,360]
 * @param   {number} s       The saturation as a number in the interval [0,100]
 * @param   {number} v       The value as a number in the interval [0,100]
 * @return  {Array}           The RGB representation
 */
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    h = h % 360;
    s = s / 100;
    v = v / 100;

    let r = 0;
    let g = 0;
    let b = 0;

    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and v in the set [0, 1].
 *
 * @param   {number} r       The red color value
 * @param   {number} g       The green color value
 * @param   {number} b       The blue color value
 * @return  {Array}           The HSV representation
 */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r = r / 255;
    g = g / 255;
    b = b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const v = max;

    if (delta === 0) {
        h = 0;
        s = 0;
    } else {
        s = delta / max;

        if (r === max) {
            h = (g - b) / delta;
        } else if (g === max) {
            h = 2 + (b - r) / delta;
        } else {
            h = 4 + (r - g) / delta;
        }

        h = h * 60;
        if (h < 0) {
            h = h + 360;
        }
    }

    return {
        h: Math.round(h),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
    };
}

/**
 * Quickly determines primary and secondary colors from a pixel art image URL using mean shift clustering.
 * Assumes the image has bright and distinct colors.
 * This function is intended for browser environments.
 * @param imageUrl The URL of the image to analyze.
 * @returns A Promise that resolves with an object containing primary and secondary HSL color strings.
 */
export async function getPixelArtColors(imageUrl: string): Promise<ImageColors> {
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

      // Immediately convert RGB to HSL and count colors
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 255) {
          const hex = rgbToHex(r, g, b); // Still use hex for keys
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
        hsv: { h: number; s: number; v: number }; // HSV values
        count: number; // Pixel count of this original color
        id: number; // Unique ID for tracking/debugging
        currentHsv: { h: number; s: number; v: number }; // HSV value that gets shifted
      }[] = [];
      let pointId = 0;
      for (const hex in colorCounts) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const hsv = rgbToHsv(r, g, b);
        initialPoints.push({
          hsv: hsv,
          count: colorCounts[hex],
          id: pointId++,
          currentHsv: { ...hsv },
        });
      }      if (initialPoints.length === 0) {
          reject(new Error('No valid initial points for clustering.'));
          return;
      }

      // Helper for squared Euclidean distance in HSV space (all components normalized to 0-1)
      const calculateNormalizedHsvDistanceSq = (
        p1: { h: number; s: number; v: number }, // h:0-360, s:0-100, v:0-100
        p2: { h: number; s: number; v: number }  // h:0-360, s:0-100, v:0-100
      ): number => {
        const h1_norm = p1.h / 360;
        const s1_norm = p1.s / 100;
        const v1_norm = p1.v / 100;

        const h2_norm = p2.h / 360;
        const s2_norm = p2.s / 100;
        const v2_norm = p2.v / 100;

        // Hue distance handles wraparound (e.g. 0.95 is close to 0.05)
        const dh_abs = Math.abs(h1_norm - h2_norm);
        const dh_norm = Math.min(dh_abs, 1 - dh_abs);
        const ds_norm = s1_norm - s2_norm;
        const dv_norm = v1_norm - v2_norm;
        return dh_norm * dh_norm + ds_norm * ds_norm + dv_norm * dv_norm;
      };

      // Mean Shift Parameters (these may need tuning based on your image characteristics)
      const MEAN_SHIFT_BANDWIDTH = 0.05; // Radius for searching neighbors in HSV space (normalized 0-1)
      const BANDWIDTH_SQ = MEAN_SHIFT_BANDWIDTH * MEAN_SHIFT_BANDWIDTH; // Now compares against normalized distance      
      const MAX_ITERATIONS = 25;       // Max iterations for convergence
      const CONVERGENCE_THRESHOLD_SQ = 0.0001; // Min average movement to continue iterating (normalized distance squared)

      let currentPointsState = initialPoints.map(p => ({ ...p })); // Work with copies

      // 2. Mean Shift Iterations
      for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        let totalMovementSq = 0;
        const nextPointsState = currentPointsState.map(point => {
          let sumH = 0, sumS = 0, sumV = 0;
          let totalWeightInKernel = 0;

          // For each point, find neighbors within bandwidth and calculate weighted mean
          for (const otherPoint of currentPointsState) {
            const distSq = calculateNormalizedHsvDistanceSq(point.currentHsv, otherPoint.currentHsv); // USE NORMALIZED DISTANCE
            if (distSq < BANDWIDTH_SQ) {
              // Weight by the original pixel count of the 'otherPoint'
              // This gives more influence to colors that were initially more prevalent
              const weight = otherPoint.count;
              sumH += otherPoint.currentHsv.h * weight;
              sumS += otherPoint.currentHsv.s * weight;
              sumV += otherPoint.currentHsv.v * weight;
              totalWeightInKernel += weight;
            }
          }

          let shiftedHsv;
          if (totalWeightInKernel > 0) {
            shiftedHsv = {
              h: sumH / totalWeightInKernel,
              s: sumS / totalWeightInKernel,
              v: sumV / totalWeightInKernel,
            };
          } else {
            // If no neighbors in bandwidth (isolated point), it doesn't move
            shiftedHsv = { ...point.currentHsv };
          }
          
          totalMovementSq += calculateNormalizedHsvDistanceSq(point.currentHsv, shiftedHsv); // USE NORMALIZED DISTANCE
          return { ...point, newHsv: shiftedHsv }; // Store the shifted position
        });

        // Update points to their new shifted positions
        currentPointsState = nextPointsState.map(p => ({ ...p, currentHsv: { ...p.newHsv } }));

        // Check for convergence
        if (currentPointsState.length > 0 && (totalMovementSq / currentPointsState.length) < CONVERGENCE_THRESHOLD_SQ && iter > 0) {
          break; // Converged
        }
      }

      // 3. Post-Iteration: Group converged points (modes) into clusters
      const CLUSTER_MERGE_THRESHOLD = 0.05; // Max distance to merge two modes into the same cluster (normalized 0-1)
      const MERGE_THRESHOLD_SQ = CLUSTER_MERGE_THRESHOLD * CLUSTER_MERGE_THRESHOLD; // Now compares against normalized distance
      
      // Modes are the final positions of the points after shifting
      const modes = currentPointsState.map(p => ({
          convergedHsv: p.currentHsv,
          originalCount: p.count, // Original pixel count of the color that led to this mode
      }));

      // Sort modes by their original pixel count to prioritize significant colors when forming clusters
      modes.sort((a, b) => b.originalCount - a.originalCount);

      const clusters: {
        center: { h: number; s: number; v: number };
        totalOriginalCount: number;
      }[] = [];
      const assignedToCluster = new Array(modes.length).fill(false);

      for (let i = 0; i < modes.length; i++) {
        if (assignedToCluster[i]) continue;

        const currentMode = modes[i];
        let clusterSumH = currentMode.convergedHsv.h * currentMode.originalCount;
        let clusterSumS = currentMode.convergedHsv.s * currentMode.originalCount;
        let clusterSumV = currentMode.convergedHsv.v * currentMode.originalCount;
        let clusterTotalOriginalCount = currentMode.originalCount;
        assignedToCluster[i] = true;        // Find other modes close to the currentMode to form a cluster
        for (let j = i + 1; j < modes.length; j++) {
          if (assignedToCluster[j]) continue;
          const otherMode = modes[j];
          // Using currentMode.convergedHsv as the reference for merging
          if (calculateNormalizedHsvDistanceSq(currentMode.convergedHsv, otherMode.convergedHsv) < MERGE_THRESHOLD_SQ) { // USE NORMALIZED DISTANCE
            assignedToCluster[j] = true;
            clusterSumH += otherMode.convergedHsv.h * otherMode.originalCount;
            clusterSumS += otherMode.convergedHsv.s * otherMode.originalCount;
            clusterSumV += otherMode.convergedHsv.v * otherMode.originalCount;
            clusterTotalOriginalCount += otherMode.originalCount;
          }
        }
        
        if (clusterTotalOriginalCount > 0) {
            clusters.push({
              center: { // Calculate the weighted center of the cluster
                h: clusterSumH / clusterTotalOriginalCount,
                s: clusterSumS / clusterTotalOriginalCount,
                v: clusterSumV / clusterTotalOriginalCount,
              },
              totalOriginalCount: clusterTotalOriginalCount,
            });
        }
      }

      // Sort clusters by the total original pixel count they represent
      clusters.sort((a, b) => b.totalOriginalCount - a.totalOriginalCount);

      let primaryHsv: { h: number; s: number; v: number };
      let secondaryHsv: { h: number; s: number; v: number };

      if (clusters.length === 0) {
          // Fallback if clustering yields no results (e.g., very few distinct colors or unusual distribution)
          // Use the most frequent original color
          if (initialPoints.length > 0) {
              const mostFrequentInitial = [...initialPoints].sort((a,b) => b.count - a.count)[0];
              primaryHsv = mostFrequentInitial.hsv;
              secondaryHsv = mostFrequentInitial.hsv;
          } else {
              // This case should ideally be caught by earlier checks
              reject(new Error('Clustering resulted in no clusters and no fallback available.'));
              return;
          }      } else {
          primaryHsv = clusters[0].center;
          secondaryHsv = primaryHsv; // Default secondary to primary

          if (clusters.length > 1) {
            // Thresholds for selecting a "distinct" secondary color
            const MIN_NORMALIZED_DIST_SQ_SECONDARY = (0.15) * (0.15); // Min squared normalized distance (e.g., dist of 0.15)
                                                                    // (0.15 dist can be ~54 deg hue diff, or 15% S/V diff)
            const MIN_ABS_HUE_DIFF_SECONDARY = 45; // Min absolute hue difference in degrees (0-180)

            let foundDistinctSecondary = false;
            for (let i = 1; i < clusters.length; i++) {
                const candidateHsv = clusters[i].center;
                const distSqNorm = calculateNormalizedHsvDistanceSq(primaryHsv, candidateHsv);
                const hueDiffAbs = Math.min(Math.abs(primaryHsv.h - candidateHsv.h), 360 - Math.abs(primaryHsv.h - candidateHsv.h));

                if (hueDiffAbs >= MIN_ABS_HUE_DIFF_SECONDARY || distSqNorm >= MIN_NORMALIZED_DIST_SQ_SECONDARY) {
                    secondaryHsv = candidateHsv;
                    foundDistinctSecondary = true;
                    break; 
                }
            }
            // If no "distinct" secondary was found by the criteria, fall back to the second most prominent cluster
            if (!foundDistinctSecondary) {
                secondaryHsv = clusters[1].center;
            }
          }
      }
      
      // Convert the HSV values back to RGB
      const finalPrimaryRgb = hsvToRgb(primaryHsv.h, primaryHsv.s, primaryHsv.v);
      const finalSecondaryRgb = hsvToRgb(secondaryHsv.h, secondaryHsv.s, secondaryHsv.v);

      // Ensure RGB components are integers before converting to hex
      const finalPrimaryRgbClamped = {
          r: Math.max(0, Math.min(255, Math.round(finalPrimaryRgb.r))),
          g: Math.max(0, Math.min(255, Math.round(finalPrimaryRgb.g))),
          b: Math.max(0, Math.min(255, Math.round(finalPrimaryRgb.b)))
      };
      const finalSecondaryRgbClamped = {
          r: Math.max(0, Math.min(255, Math.round(finalSecondaryRgb.r))),
          g: Math.max(0, Math.min(255, Math.round(finalSecondaryRgb.g))),
          b: Math.max(0, Math.min(255, Math.round(finalSecondaryRgb.b)))
      };

      const primaryHex = rgbToHex(finalPrimaryRgbClamped.r, finalPrimaryRgbClamped.g, finalPrimaryRgbClamped.b);
      const secondaryHex = rgbToHex(finalSecondaryRgbClamped.r, finalSecondaryRgbClamped.g, finalSecondaryRgbClamped.b);
      
      const primaryHSL = hexToHSL(primaryHex);
      const secondaryHSL = hexToHSL(secondaryHex);

      if (!primaryHSL || !secondaryHSL) {
          // Fallback if HSL conversion fails for some reason
          console.error("Failed to convert clustered RGB to HSL. Primary RGB:", finalPrimaryRgbClamped, "Secondary RGB:", finalSecondaryRgbClamped);
          // Attempt to use the most frequent color as a last resort
          if (initialPoints.length > 0) {
            // Find the most frequent color based on original RGB (before HSV conversion)
            const rgbFromHsv = hsvToRgb(initialPoints[0].hsv.h, initialPoints[0].hsv.s, initialPoints[0].hsv.v);
            const fallbackHex = rgbToHex(rgbFromHsv.r, rgbFromHsv.g, rgbFromHsv.b);
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
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
}