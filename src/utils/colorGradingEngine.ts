import { ColorGradingConfig, CurvePoint, ColorWheelValue } from '../types/colorGrading';

/**
 * Generate smooth Catmull-Rom / Bezier spline points for RGB curve
 */
export function evaluateSpline(points: CurvePoint[], t: number): number {
  if (!points || points.length === 0) return t;
  if (points.length === 1) return points[0].y;

  const sorted = [...points].sort((a, b) => a.x - b.x);

  if (t <= sorted[0].x) return sorted[0].y;
  if (t >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

  // Find surrounding interval
  let idx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].x && t <= sorted[i + 1].x) {
      idx = i;
      break;
    }
  }

  const p0 = sorted[Math.max(0, idx - 1)];
  const p1 = sorted[idx];
  const p2 = sorted[idx + 1];
  const p3 = sorted[Math.min(sorted.length - 1, idx + 2)];

  // Normalized time inside segment
  const segRange = p2.x - p1.x;
  const localT = segRange === 0 ? 0 : (t - p1.x) / segRange;

  // Cubic Hermite Spline calculation
  const t2 = localT * localT;
  const t3 = t2 * localT;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + localT;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const m1 = (p2.y - p0.y) / 2;
  const m2 = (p3.y - p1.y) / 2;

  const val = h00 * p1.y + h10 * m1 + h01 * p2.y + h11 * m2;
  return Math.max(0, Math.min(1, val));
}

/**
 * Build dynamic SVG filter / CSS filter for Color Wheels & Grading
 */
export function buildColorGradingCssFilter(config?: ColorGradingConfig): string {
  if (!config) return 'none';

  const filters: string[] = [];

  // 1. Contrast
  const contrastVal = 1 + (config.contrast || 0) / 100;
  if (Math.abs(config.contrast) > 0.5) {
    filters.push(`contrast(${contrastVal.toFixed(2)})`);
  }

  // 2. Saturation & Vibrance
  const satVal = Math.max(0, (config.saturation + config.vibrance * 0.5) / 100);
  if (Math.abs(satVal - 1.0) > 0.02) {
    filters.push(`saturate(${satVal.toFixed(2)})`);
  }

  // 3. Exposure / Highlights / Shadows mapped to Brightness
  const expGain = (config.gain.luma + config.highlights * 0.5 + config.offset.luma) / 100;
  const shadowLift = (config.lift.luma + config.shadows * 0.5) / 200;
  const totalBright = 1 + expGain + shadowLift;
  if (Math.abs(totalBright - 1.0) > 0.02) {
    filters.push(`brightness(${Math.max(0.1, totalBright).toFixed(2)})`);
  }

  // 4. Temperature / Tint
  if (config.temperature !== 0) {
    if (config.temperature > 0) {
      filters.push(`sepia(${(config.temperature * 0.25).toFixed(2)}%)`);
    } else {
      filters.push(`hue-rotate(${(config.temperature * 0.15).toFixed(1)}deg)`);
    }
  }

  if (config.tint !== 0) {
    filters.push(`hue-rotate(${(config.tint * 0.3).toFixed(1)}deg)`);
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Apply real-time 3-Way Color Wheels & RGB Curves onto Canvas 2D frame
 */
export function applyCanvasColorGrading(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config?: ColorGradingConfig
): void {
  if (!config) return;

  const { lift, gamma, gain, offset, curves } = config;
  const hasWheelAdjustment =
    lift.x !== 0 || lift.y !== 0 || lift.luma !== 0 ||
    gamma.x !== 0 || gamma.y !== 0 || gamma.luma !== 0 ||
    gain.x !== 0 || gain.y !== 0 || gain.luma !== 0 ||
    offset.x !== 0 || offset.y !== 0 || offset.luma !== 0;

  if (!hasWheelAdjustment) return;

  // Lift (Shadows tint) - subtle shadow wash
  if (lift.saturation > 0 || lift.x !== 0 || lift.y !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const rad = Math.atan2(lift.y, lift.x);
    const deg = (rad * 180) / Math.PI;
    const hsl = `hsla(${deg}, 70%, 40%, ${(Math.min(100, lift.saturation || 40) / 100) * 0.45})`;
    ctx.fillStyle = hsl;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Gain (Highlights tint) - subtle highlights wash
  if (gain.saturation > 0 || gain.x !== 0 || gain.y !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const rad = Math.atan2(gain.y, gain.x);
    const deg = (rad * 180) / Math.PI;
    const hsl = `hsla(${deg}, 85%, 65%, ${(Math.min(100, gain.saturation || 40) / 100) * 0.35})`;
    ctx.fillStyle = hsl;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

/**
 * Compile Color Grading & RGB Curves to FFmpeg filter string
 */
export function compileColorGradingToFFmpeg(config: ColorGradingConfig): string[] {
  const filters: string[] = [];

  // 1. Contrast / Brightness / Saturation
  const c = 1 + config.contrast / 100;
  const b = (config.gain.luma + config.offset.luma + config.highlights * 0.5) / 100;
  const s = config.saturation / 100;

  if (config.contrast !== 0 || b !== 0 || config.saturation !== 100) {
    filters.push(`eq=contrast=${c.toFixed(2)}:brightness=${b.toFixed(2)}:saturation=${s.toFixed(2)}`);
  }

  // 2. Colorbalance for 3-Way Lift (Shadows), Gamma (Midtones), Gain (Highlights)
  const rs = (liftToFfmpeg(config.lift.x, config.lift.luma)).toFixed(2);
  const gs = (liftToFfmpeg(config.lift.y, config.lift.luma)).toFixed(2);
  const rm = (liftToFfmpeg(config.gamma.x, config.gamma.luma)).toFixed(2);
  const gm = (liftToFfmpeg(config.gamma.y, config.gamma.luma)).toFixed(2);
  const rh = (liftToFfmpeg(config.gain.x, config.gain.luma)).toFixed(2);
  const gh = (liftToFfmpeg(config.gain.y, config.gain.luma)).toFixed(2);

  filters.push(`colorbalance=rs=${rs}:gs=${gs}:rm=${rm}:gm=${gm}:rh=${rh}:gh=${gh}`);

  // 3. Curves Filter
  if (config.curves) {
    const formatCurvePoints = (pts: CurvePoint[]) => {
      return pts.map((p) => `${p.x.toFixed(2)}/${p.y.toFixed(2)}`).join(' ');
    };

    const mPts = formatCurvePoints(config.curves.master);
    const rPts = formatCurvePoints(config.curves.red);
    const gPts = formatCurvePoints(config.curves.green);
    const bPts = formatCurvePoints(config.curves.blue);

    filters.push(`curves=m='${mPts}':r='${rPts}':g='${gPts}':b='${bPts}'`);
  }

  return filters;
}

function liftToFfmpeg(coord: number, luma: number): number {
  const base = coord * 0.6;
  const lumaMod = luma / 250;
  return Math.max(-1, Math.min(1, base + lumaMod));
}
