import { LumaWipeConfig } from '../types/lumaWipe';

/**
 * Render Luma Matte Wipe Transition on Canvas Context
 */
export function renderCanvasLumaWipe(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number, // 0 to 1.0
  config: LumaWipeConfig
) {
  if (progress <= 0 || progress >= 1) return;

  const p = config.isInverted ? 1 - progress : progress;
  const softness = Math.max(0.01, config.softness / 100);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';

  if (config.preset === 'linear_gradient') {
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    const split = p * width;
    const spread = softness * width;

    grad.addColorStop(0, 'black');
    grad.addColorStop(Math.min(1, Math.max(0, (split - spread) / width)), 'black');
    grad.addColorStop(Math.min(1, Math.max(0, (split + spread) / width)), 'transparent');
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (config.preset === 'radial_clock' || config.preset === 'ink_splash') {
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    const curR = p * maxR;

    const grad = ctx.createRadialGradient(cx, cy, Math.max(0, curR * (1 - softness)), cx, cy, curR);
    grad.addColorStop(0, 'black');
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/**
 * Build FFmpeg xfade custom luma matte transition filter string
 */
export function buildFFmpegLumaXFade(config: LumaWipeConfig): string {
  const dur = config.duration.toFixed(2);
  const xfadeName = config.preset === 'radial_clock' ? 'radial' : config.preset === 'linear_gradient' ? 'wipeleft' : 'dissolve';
  return `xfade=transition=${xfadeName}:duration=${dur}:offset=0`;
}
