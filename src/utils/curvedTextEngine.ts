import { CurvedTextConfig } from '../types/curvedText';

export interface GlyphPoint {
  char: string;
  x: number;
  y: number;
  rotation: number; // in radians
}

/**
 * Compute arc-length parameterization and distribute glyphs along 2D curve
 */
export function computeCurvedGlyphLayout(
  text: string,
  config: CurvedTextConfig,
  centerX: number,
  centerY: number,
  fontSize: number
): GlyphPoint[] {
  if (!text || !config.isEnabled || config.preset === 'none') {
    return [];
  }

  const chars = Array.from(text);
  const glyphCount = chars.length;
  if (glyphCount === 0) return [];

  const points: GlyphPoint[] = [];
  const radius = Math.max(30, config.radius);
  const curvature = config.curvature / 100;
  const isFlipped = config.inwardFacing;

  if (config.preset === 'circle_360' || config.preset === 'arc_top' || config.preset === 'arc_bottom') {
    const totalArc = (config.preset === 'circle_360' ? 360 : config.arcAngle) * (Math.PI / 180);
    const startAngle = config.preset === 'arc_top' ? -Math.PI / 2 - totalArc / 2 : config.preset === 'arc_bottom' ? Math.PI / 2 - totalArc / 2 : -Math.PI / 2;
    const angleStep = totalArc / Math.max(1, glyphCount - 1 || 1);

    chars.forEach((char, i) => {
      const angle = startAngle + i * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      const rotation = angle + Math.PI / 2 + (isFlipped ? Math.PI : 0);

      points.push({ char, x, y, rotation });
    });
  } else if (config.preset === 'wave_sine') {
    const totalWidth = glyphCount * (fontSize * 0.6 + config.letterSpacing);
    const startX = centerX - totalWidth / 2;
    const amplitude = 40 * curvature;
    const frequency = (Math.PI * 2) / Math.max(100, totalWidth);

    chars.forEach((char, i) => {
      const x = startX + i * (totalWidth / Math.max(1, glyphCount - 1));
      const phase = (x - startX) * frequency;
      const y = centerY + amplitude * Math.sin(phase);

      // Derivative dy/dx for tangent
      const dy = amplitude * frequency * Math.cos(phase);
      const rotation = Math.atan2(dy, 1) + (isFlipped ? Math.PI : 0);

      points.push({ char, x, y, rotation });
    });
  } else if (config.preset === 's_curve' || config.preset === 'arch_bridge') {
    const totalWidth = glyphCount * (fontSize * 0.65 + config.letterSpacing);
    const startX = centerX - totalWidth / 2;
    const maxH = 60 * curvature;

    chars.forEach((char, i) => {
      const t = (i / Math.max(1, glyphCount - 1)) * 2 - 1; // -1 to 1
      const x = startX + i * (totalWidth / Math.max(1, glyphCount - 1));
      const y = centerY + (config.preset === 'arch_bridge' ? -maxH * (1 - t * t) : maxH * Math.sin(t * Math.PI));
      const dy = config.preset === 'arch_bridge' ? 2 * maxH * t : maxH * Math.PI * Math.cos(t * Math.PI);
      const rotation = Math.atan2(dy, totalWidth / 2) + (isFlipped ? Math.PI : 0);

      points.push({ char, x, y, rotation });
    });
  }

  return points;
}

/**
 * Render curved text on Canvas 2D context
 */
export function renderCurvedTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  glyphs: GlyphPoint[],
  fontFamily: string,
  fontSize: number,
  textColor: string,
  strokeColor?: string,
  strokeWidth?: number,
  shadowColor?: string,
  shadowBlur?: number
) {
  if (!glyphs || glyphs.length === 0) return;

  ctx.save();
  ctx.font = `900 ${fontSize}px ${fontFamily}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (shadowColor && shadowBlur) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
  }

  glyphs.forEach((g) => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rotation);

    if (strokeColor && strokeWidth && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(g.char, 0, 0);
    }

    ctx.fillStyle = textColor;
    ctx.fillText(g.char, 0, 0);
    ctx.restore();
  });

  ctx.restore();
}
