import { MotionBlurConfig } from '../types/motionBlur';

/**
 * Apply directional motion blur on 2D Canvas context based on shutter angle
 */
export function applyCanvasMotionBlur(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: MotionBlurConfig,
  velocityX: number = 0,
  velocityY: number = 0
) {
  if (!config.isEnabled || (velocityX === 0 && velocityY === 0)) return;

  const shutterFactor = config.shutterAngle / 360.0;
  const taps = config.samples;
  const blurX = velocityX * shutterFactor * (config.sensitivity / 100);
  const blurY = velocityY * shutterFactor * (config.sensitivity / 100);

  if (Math.abs(blurX) < 0.5 && Math.abs(blurY) < 0.5) return;

  ctx.save();
  ctx.globalAlpha = 1.0 / taps;

  for (let i = 1; i <= taps; i++) {
    const t = (i / taps) - 0.5;
    const dx = blurX * t;
    const dy = blurY * t;
    ctx.drawImage(ctx.canvas, dx, dy, width, height);
  }

  ctx.restore();
}

/**
 * Build FFmpeg minterpolate and tblend filter string for export motion blur
 */
export function buildFFmpegMotionBlurFilter(config: MotionBlurConfig): string {
  if (!config.isEnabled) return '';
  const shutterRatio = (config.shutterAngle / 360.0).toFixed(2);
  return `minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,tblend=all_mode=average:all_opacity=${shutterRatio}`;
}
