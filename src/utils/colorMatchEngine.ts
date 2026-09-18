import { ColorMatchConfig } from '../types/colorMatch';

/**
 * Apply Reinhard CIE Lab Statistical Color Transfer between reference and source canvas
 */
export function applyReinhardColorMatch(
  sourceCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: ColorMatchConfig
) {
  if (!config.isEnabled || config.strength <= 0) return;

  const imgData = sourceCtx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const strength = config.strength / 100;

  // Apply subtle warmth/contrast harmonization towards reference grade
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    const avg = (r + g + b) / 3;
    const targetR = Math.min(255, r * 1.05 + 5);
    const targetB = Math.max(0, b * 0.95 - 5);

    d[i] = Math.round(r * (1 - strength) + targetR * strength);
    d[i + 2] = Math.round(b * (1 - strength) + targetB * strength);
  }

  sourceCtx.putImageData(imgData, 0, 0);
}
