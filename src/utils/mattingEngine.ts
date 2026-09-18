import { BackgroundMattingConfig } from '../types/matting';
import { backgroundRemovalEngine } from '../services/ai/backgroundRemovalEngine';
import { MatteRefinementPipeline } from '../services/ai/matteRefinementPipeline';

/**
 * Process frame in 2D Canvas to generate foreground silhouette alpha matte
 */
export async function extractSubjectMatte(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  config: BackgroundMattingConfig,
  frameIndex = 0,
  timestamp = 0,
  mediaId = 'default'
) {
  if (!config.isEnabled) return;
  return backgroundRemovalEngine.processFrame(
    sourceCanvas,
    targetCanvas,
    config,
    frameIndex,
    timestamp,
    mediaId
  );
}

/**
 * Synchronous lightweight frame segmenter for instant 60fps canvas fallback
 */
export function extractSubjectMatteSync(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  config: BackgroundMattingConfig
) {
  if (!config.isEnabled) return;

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;

  ctx.drawImage(sourceCanvas, 0, 0);
  const srcImgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  const { width, height } = targetCanvas;
  const totalPixels = width * height;
  const rawAlpha = new Float32Array(totalPixels);
  const d = srcImgData.data;

  const cx = width / 2;
  const cy = height * 0.48;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = d[idx];
    const g = d[idx + 1];
    const b = d[idx + 2];

    const px = i % width;
    const py = Math.floor(i / width);
    const dx = (px - cx) / cx;
    const dy = (py - cy) / (height * 0.55);
    const dist = Math.sqrt(dx * dx * 1.1 + dy * dy * 0.85);

    const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
    const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
    const isSkin = cb >= 77 && cb <= 135 && cr >= 130 && cr <= 180;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

    const prob = (isSkin ? 0.7 : 0.3) * Math.max(0, 1 - dist * 0.9) + (luma > 20 && luma < 240 ? 0.2 : 0);
    rawAlpha[i] = Math.max(0, Math.min(1.0, prob > 0.42 ? 1.0 : prob * 2.0));
  }

  const refined = MatteRefinementPipeline.refineMatte(srcImgData, rawAlpha, width, height, config);
  ctx.putImageData(refined, 0, 0);
}
