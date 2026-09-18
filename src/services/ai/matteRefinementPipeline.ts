import { BackgroundMattingConfig } from '../../types/matting';

export interface TemporalMaskState {
  lastAlphaBuffer?: Float32Array;
  lastWidth?: number;
  lastHeight?: number;
  lastTimestamp?: number;
}

/**
 * Professional Multi-Stage Background Removal & Matte Refinement Pipeline
 */
export class MatteRefinementPipeline {
  /**
   * Refines a raw neural segmentation mask into a production-grade alpha matte
   */
  public static refineMatte(
    sourceImageData: ImageData,
    rawMaskAlpha: Float32Array,
    width: number,
    height: number,
    config: BackgroundMattingConfig,
    temporalState?: TemporalMaskState,
    isFirstFrame = false
  ): ImageData {
    const totalPixels = width * height;
    const outputImgData = typeof ImageData !== 'undefined'
      ? new ImageData(width, height)
      : ({ width, height, data: new Uint8ClampedArray(totalPixels * 4) } as ImageData);
    const srcData = sourceImageData.data;
    const outData = outputImgData.data;

    // Allocate working alpha buffer
    let alphaBuf: any = new Float32Array(rawMaskAlpha);

    // 1. Stage: Foreground Protection & Background Suppression Curving
    const fgProt = config.foregroundProtection / 100; // default 0.75
    const bgSupp = config.backgroundSuppression / 100; // default 0.60
    const thresh = config.threshold / 100;            // default 0.50

    for (let i = 0; i < totalPixels; i++) {
      let a = alphaBuf[i];

      // Suppress low-confidence noise
      if (a < thresh * (1 - bgSupp * 0.4)) {
        a = a * (1 - bgSupp * 0.5);
      }
      // Protect high-confidence foreground subject
      if (a > thresh * (1 + (1 - fgProt) * 0.3)) {
        a = Math.min(1.0, a + fgProt * 0.25);
      }

      alphaBuf[i] = Math.max(0, Math.min(1.0, a));
    }

    // 2. Stage: Mask Expansion / Contraction (Morphological Dilation / Erosion)
    if (config.maskExpansion !== 0) {
      alphaBuf = this.applyMaskExpansion(alphaBuf, width, height, config.maskExpansion);
    }

    // 3. Stage: Hole Filling (internal body cavities & dark clothing shadows)
    if (config.holeFilling) {
      alphaBuf = this.applyHoleFilling(alphaBuf, width, height);
    }

    // 4. Stage: Guided Edge Refinement & Hair Detail Preservation
    if (config.edgeRefinement > 0 || config.hairDetail > 0) {
      alphaBuf = this.applyGuidedHairRefinement(
        srcData,
        alphaBuf,
        width,
        height,
        config.edgeRefinement,
        config.hairDetail
      );
    }

    // 5. Stage: Temporal Video Consistency (Anti-Flicker & Matte Smoothing)
    if (config.temporalSmoothing > 0 && temporalState?.lastAlphaBuffer && !isFirstFrame) {
      alphaBuf = this.applyTemporalSmoothing(
        alphaBuf,
        temporalState.lastAlphaBuffer,
        width,
        height,
        config.temporalSmoothing
      );
    }

    // Save current alpha for next frame's temporal consistency
    if (temporalState) {
      temporalState.lastAlphaBuffer = new Float32Array(alphaBuf);
      temporalState.lastWidth = width;
      temporalState.lastHeight = height;
    }

    // 6. Stage: Edge Feathering (Soft Gaussian edge)
    if (config.feather > 0) {
      alphaBuf = this.applyFeather(alphaBuf, width, height, config.feather);
    }

    // 7. Stage: Despill / Edge Decontamination & Final Compositing
    const despillFactor = (config.despill || 0) / 100;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      let r = srcData[idx];
      let g = srcData[idx + 1];
      let b = srcData[idx + 2];
      const a = alphaBuf[i];

      // Green / Blue / Light spill suppression on boundary pixels
      if (despillFactor > 0 && a > 0.05 && a < 0.95) {
        // Despill green fringe: replace excess green with average of red & blue
        if (g > (r + b) / 2) {
          const excess = g - (r + b) / 2;
          g = Math.max(0, Math.round(g - excess * despillFactor));
        }
        // Despill blue fringe
        if (b > (r + g) / 2) {
          const excess = b - (r + g) / 2;
          b = Math.max(0, Math.round(b - excess * despillFactor));
        }
      }

      outData[idx] = r;
      outData[idx + 1] = g;
      outData[idx + 2] = b;
      outData[idx + 3] = Math.round(a * 255);
    }

    // 8. Stage: Cutout Stroke Glow Border (Viral Outline Effect)
    if (config.strokeBorder && config.strokeWidth > 0) {
      this.applyCutoutStroke(outData, alphaBuf, width, height, config.strokeColor, config.strokeWidth);
    }

    return outputImgData;
  }

  /**
   * Morphological Mask Expansion / Contraction
   */
  private static applyMaskExpansion(
    alpha: Float32Array,
    width: number,
    height: number,
    expansionPx: number
  ): Float32Array {
    const out = new Float32Array(alpha.length);
    const radius = Math.min(10, Math.abs(Math.round(expansionPx)));
    const isExpand = expansionPx > 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let best = alpha[idx];

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            if (dx * dx + dy * dy <= radius * radius) {
              const val = alpha[ny * width + nx];
              best = isExpand ? Math.max(best, val) : Math.min(best, val);
            }
          }
        }
        out[idx] = best;
      }
    }
    return out;
  }

  /**
   * Hole Filling: Clamps small internal negative cavities inside clothing or chest
   */
  private static applyHoleFilling(
    alpha: Float32Array,
    width: number,
    height: number
  ): Float32Array {
    const out = new Float32Array(alpha);
    const rad = 3;

    for (let y = rad; y < height - rad; y++) {
      for (let x = rad; x < width - rad; x++) {
        const idx = y * width + x;
        if (alpha[idx] < 0.6) {
          // Check if surrounded by strong foreground
          const top = alpha[(y - rad) * width + x];
          const bottom = alpha[(y + rad) * width + x];
          const left = alpha[y * width + (x - rad)];
          const right = alpha[y * width + (x + rad)];

          if (top > 0.85 && bottom > 0.85 && left > 0.85 && right > 0.85) {
            out[idx] = Math.max(alpha[idx], 0.9);
          }
        }
      }
    }
    return out;
  }

  /**
   * Guided Color-Aware Edge & Hair Detail Preservation
   */
  private static applyGuidedHairRefinement(
    srcData: Uint8ClampedArray,
    alpha: Float32Array,
    width: number,
    height: number,
    edgeStrength: number,
    hairStrength: number
  ): Float32Array {
    const out = new Float32Array(alpha);
    const weight = (edgeStrength * 0.6 + hairStrength * 0.4) / 100;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const a = alpha[idx];

        // Focus refinement on semi-transparent transition boundary
        if (a > 0.1 && a < 0.9) {
          const pIdx = idx * 4;
          const r = srcData[pIdx];
          const g = srcData[pIdx + 1];
          const b = srcData[pIdx + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          // Local neighbor luma variance
          const topLuma = 0.299 * srcData[((y - 1) * width + x) * 4] + 0.587 * srcData[((y - 1) * width + x) * 4 + 1] + 0.114 * srcData[((y - 1) * width + x) * 4 + 2];
          const botLuma = 0.299 * srcData[((y + 1) * width + x) * 4] + 0.587 * srcData[((y + 1) * width + x) * 4 + 1] + 0.114 * srcData[((y + 1) * width + x) * 4 + 2];
          const lumaGrad = Math.abs(topLuma - botLuma) / 255;

          // Sub-pixel hair contrast boost
          if (lumaGrad > 0.15) {
            const refined = a > 0.5 ? Math.min(1.0, a + lumaGrad * weight * 0.5) : Math.max(0, a - lumaGrad * weight * 0.5);
            out[idx] = refined;
          }
        }
      }
    }
    return out;
  }

  /**
   * Temporal Anti-Flicker Filter (Exponential Moving Average across video frames)
   */
  private static applyTemporalSmoothing(
    currAlpha: Float32Array,
    prevAlpha: Float32Array,
    width: number,
    height: number,
    smoothness: number
  ): Float32Array {
    if (currAlpha.length !== prevAlpha.length) return currAlpha;
    const out = new Float32Array(currAlpha.length);
    const alphaFactor = Math.min(0.85, Math.max(0.1, (smoothness / 100) * 0.75));

    for (let i = 0; i < currAlpha.length; i++) {
      const c = currAlpha[i];
      const p = prevAlpha[i];
      const delta = Math.abs(c - p);

      // Clamped temporal blend: only smooth small jitter/flicker; allow fast subject motion through instantly
      if (delta < 0.4) {
        out[i] = alphaFactor * p + (1 - alphaFactor) * c;
      } else {
        out[i] = c;
      }
    }
    return out;
  }

  /**
   * Fast Box Feathering for soft photographic subject edges
   */
  private static applyFeather(
    alpha: Float32Array,
    width: number,
    height: number,
    featherPx: number
  ): Float32Array {
    const rad = Math.min(12, Math.max(1, Math.round(featherPx / 2)));
    const out = new Float32Array(alpha.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (alpha[idx] > 0.01 && alpha[idx] < 0.99) {
          let sum = 0;
          let count = 0;
          for (let dy = -rad; dy <= rad; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -rad; dx <= rad; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= width) continue;
              sum += alpha[ny * width + nx];
              count++;
            }
          }
          out[idx] = sum / count;
        } else {
          out[idx] = alpha[idx];
        }
      }
    }
    return out;
  }

  /**
   * Viral Cutout Stroke Glow Border (e.g. white or neon glow outline)
   */
  private static applyCutoutStroke(
    pixelData: Uint8ClampedArray,
    alpha: Float32Array,
    width: number,
    height: number,
    strokeHex: string,
    strokeWidthPx: number
  ) {
    const rad = Math.min(15, Math.max(1, Math.round(strokeWidthPx)));
    const { r: sr, g: sg, b: sb } = this.parseHexColor(strokeHex);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const currentAlpha = alpha[idx];

        // Render stroke on transparent edge boundary surrounding the cutout person
        if (currentAlpha < 0.3) {
          let hasNearbySubject = false;
          for (let dy = -rad; dy <= rad && !hasNearbySubject; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -rad; dx <= rad; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= width) continue;
              if (dx * dx + dy * dy <= rad * rad) {
                if (alpha[ny * width + nx] > 0.6) {
                  hasNearbySubject = true;
                  break;
                }
              }
            }
          }

          if (hasNearbySubject) {
            const pIdx = idx * 4;
            pixelData[pIdx] = sr;
            pixelData[pIdx + 1] = sg;
            pixelData[pIdx + 2] = sb;
            pixelData[pIdx + 3] = 255;
          }
        }
      }
    }
  }

  private static parseHexColor(hex: string): { r: number; g: number; b: number } {
    let clean = (hex || '#FFFFFF').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }
}
