import { ChromaKeyConfig } from '../types/chromaKey';

/**
 * Parse Hex color to normalized RGB [0..1]
 */
export function hexToRgbNormalized(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

/**
 * Real-time Canvas 2D / Pixel Shader for Chroma Key Background Removal
 */
export function applyChromaKeyToImageData(
  imageData: ImageData,
  config: ChromaKeyConfig
): void {
  if (!config.enabled) return;

  const data = imageData.data;
  const keyRgb = hexToRgbNormalized(config.keyColor || '#00FF00');

  const simThreshold = (config.similarity || 35) / 100;
  const smoothness = Math.max(0.01, (config.smoothness || 15) / 100);
  const spill = (config.spillReduction || 40) / 100;
  const maskOnly = !!config.maskOnly;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    // Euclidean color distance in RGB space
    const diffR = r - keyRgb.r;
    const diffG = g - keyRgb.g;
    const diffB = b - keyRgb.b;
    const dist = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);

    // Smoothstep alpha calculation
    let alpha = 1.0;
    if (dist < simThreshold) {
      alpha = 0.0;
    } else if (dist < simThreshold + smoothness) {
      const t = (dist - simThreshold) / smoothness;
      alpha = t * t * (3 - 2 * t); // Smoothstep
    }

    if (maskOnly) {
      // Render Black & White matte view
      const matteVal = Math.round(alpha * 255);
      data[i] = matteVal;
      data[i + 1] = matteVal;
      data[i + 2] = matteVal;
      data[i + 3] = 255;
    } else {
      // Spill suppression (desaturate green/blue halo fringe)
      if (spill > 0 && alpha > 0 && alpha < 0.9) {
        const avgOther = (r + b) / 2;
        if (g > avgOther) {
          data[i + 1] = Math.round((g - (g - avgOther) * spill) * 255);
        }
      }
      data[i + 3] = Math.round(alpha * 255);
    }
  }
}

/**
 * Compile FFmpeg chromakey filter string for export
 */
export function compileChromaKeyToFfmpeg(config?: ChromaKeyConfig | null): string[] {
  if (!config || !config.enabled) return [];
  const hex = config.keyColor.replace('#', '0x');
  const sim = ((config.similarity || 35) / 100).toFixed(2);
  const blend = ((config.smoothness || 15) / 100).toFixed(2);
  return [`chromakey=color=${hex}:similarity=${sim}:blend=${blend}`];
}
