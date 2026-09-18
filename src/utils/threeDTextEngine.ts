import { ThreeDTextConfig } from '../types/threeDText';

/**
 * Render 3D Extruded Text with Depth Slices, Bevel & Specular Highlight
 */
export function renderThreeDTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontFamily: string,
  fontSize: number,
  frontColor: string,
  config: ThreeDTextConfig,
  strokeColor?: string,
  strokeWidth?: number
) {
  if (!config.isEnabled || config.depth <= 0) {
    ctx.font = `900 ${fontSize}px ${fontFamily}, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (strokeColor && strokeWidth) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = frontColor;
    ctx.fillText(text, x, y);
    return;
  }

  const rad = (config.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const depth = Math.max(1, config.depth);

  ctx.save();
  ctx.font = `900 ${fontSize}px ${fontFamily}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1. Render depth extrusion slices from back to front
  for (let i = depth; i >= 1; i--) {
    const offsetX = x + (i * dx * 1.1);
    const offsetY = y + (i * dy * 1.1);
    const shadeFactor = 1 - (i / depth) * 0.45; // Darken towards bottom-back

    ctx.save();
    ctx.fillStyle = config.extrusionColor || '#0a0a0f';
    ctx.globalAlpha = shadeFactor;
    ctx.fillText(text, offsetX, offsetY);

    if (strokeColor && strokeWidth) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeWidth + 2;
      ctx.strokeText(text, offsetX, offsetY);
    }
    ctx.restore();
  }

  // 2. Render front face with Bevel & Material Highlight
  ctx.save();
  if (config.material === 'metallic') {
    const grad = ctx.createLinearGradient(x - 100, y - 50, x + 100, y + 50);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.3, frontColor);
    grad.addColorStop(0.6, '#E2E8F0');
    grad.addColorStop(1, frontColor);
    ctx.fillStyle = grad;
  } else if (config.material === 'neon_glow') {
    ctx.shadowColor = frontColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = frontColor;
  } else {
    ctx.fillStyle = frontColor;
  }

  if (strokeColor && strokeWidth) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }

  ctx.fillText(text, x, y);

  // 3. Blinn-Phong Specular Highlight Gloss pass
  if (config.material === 'glossy' && config.specularShine > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const glossGrad = ctx.createLinearGradient(x, y - fontSize * 0.4, x, y);
    glossGrad.addColorStop(0, `rgba(255, 255, 255, ${(config.specularShine / 100) * 0.6})`);
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(x - 500, y - fontSize, 1000, fontSize);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}
