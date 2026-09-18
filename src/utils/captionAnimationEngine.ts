import {
  AnimationDefinition,
  CaptionAnimationConfig,
  InAnimationPreset,
  OutAnimationPreset,
  LoopAnimationPreset,
  AnimationEasing,
  DEFAULT_ANIMATION_CONFIG,
} from '../types/captionAnimation';

/**
 * Catalog of Professional Built-in Caption Animations
 */
export const IN_ANIMATIONS: AnimationDefinition[] = [
  { id: 'none', name: 'None', category: 'in', description: 'Immediate appearance with no entry motion', defaultDuration: 0, iconName: 'Ban' },
  { id: 'fade-in', name: 'Fade In', category: 'in', description: 'Smooth opacity fade-in transition', defaultDuration: 0.35, iconName: 'Sun' },
  { id: 'pop-in', name: 'Pop In', category: 'in', description: 'Punchy scale-up with slight overshoot bounce (CapCut style)', defaultDuration: 0.3, iconName: 'Sparkles' },
  { id: 'slide-up', name: 'Slide Up', category: 'in', description: 'Slides upwards from bottom into position', defaultDuration: 0.35, iconName: 'ArrowUp' },
  { id: 'slide-down', name: 'Slide Down', category: 'in', description: 'Slides downwards from top into position', defaultDuration: 0.35, iconName: 'ArrowDown' },
  { id: 'slide-left', name: 'Slide Left', category: 'in', description: 'Slides in from the right edge', defaultDuration: 0.35, iconName: 'ArrowLeft' },
  { id: 'slide-right', name: 'Slide Right', category: 'in', description: 'Slides in from the left edge', defaultDuration: 0.35, iconName: 'ArrowRight' },
  { id: 'bounce-in', name: 'Bounce In', category: 'in', description: 'Dynamic elastic spring bounce', defaultDuration: 0.45, iconName: 'Activity' },
  { id: 'typewriter', name: 'Typewriter', category: 'in', description: 'Progressive character-by-character typing reveal', defaultDuration: 0.5, iconName: 'Type' },
  { id: 'blur-in', name: 'Blur In', category: 'in', description: 'Motion focus reveal from blurred to sharp', defaultDuration: 0.35, iconName: 'Eye' },
  { id: 'flip-in', name: 'Flip 3D', category: 'in', description: '3D perspective flip entry', defaultDuration: 0.4, iconName: 'RotateCw' },
  { id: 'drop-in', name: 'Drop In', category: 'in', description: 'Heavy impact drop from above with slam scale', defaultDuration: 0.3, iconName: 'Download' },
  { id: 'rise-up', name: 'Rise & Fade', category: 'in', description: 'Subtle vertical rise combined with soft fade', defaultDuration: 0.35, iconName: 'TrendingUp' },
];

export const OUT_ANIMATIONS: AnimationDefinition[] = [
  { id: 'none', name: 'None', category: 'out', description: 'Instant cut on line end', defaultDuration: 0, iconName: 'Ban' },
  { id: 'fade-out', name: 'Fade Out', category: 'out', description: 'Smooth opacity fade-out exit', defaultDuration: 0.3, iconName: 'Sun' },
  { id: 'pop-out', name: 'Pop Out', category: 'out', description: 'Shrinks down into center', defaultDuration: 0.25, iconName: 'Minimize2' },
  { id: 'slide-down', name: 'Slide Down', category: 'out', description: 'Slides down out of frame', defaultDuration: 0.3, iconName: 'ArrowDown' },
  { id: 'slide-up', name: 'Slide Up', category: 'out', description: 'Slides up out of frame', defaultDuration: 0.3, iconName: 'ArrowUp' },
  { id: 'slide-left', name: 'Slide Left', category: 'out', description: 'Slides left out of frame', defaultDuration: 0.3, iconName: 'ArrowLeft' },
  { id: 'slide-right', name: 'Slide Right', category: 'out', description: 'Slides right out of frame', defaultDuration: 0.3, iconName: 'ArrowRight' },
  { id: 'blur-out', name: 'Blur Out', category: 'out', description: 'Defocuses into radial motion blur', defaultDuration: 0.3, iconName: 'EyeOff' },
  { id: 'drop-out', name: 'Drop Out', category: 'out', description: 'Gravity drop downwards', defaultDuration: 0.25, iconName: 'ArrowDownCircle' },
];

export const LOOP_ANIMATIONS: AnimationDefinition[] = [
  { id: 'none', name: 'None', category: 'loop', description: 'Static hold throughout duration', defaultDuration: 0, iconName: 'Ban' },
  { id: 'pulse', name: 'Pulse', category: 'loop', description: 'Rhythmic breathing scale pulse', defaultDuration: 1.2, iconName: 'Heart' },
  { id: 'bounce-loop', name: 'Bouncing', category: 'loop', description: 'Continuous vertical energetic bounce', defaultDuration: 0.8, iconName: 'Activity' },
  { id: 'floating', name: 'Floating Wave', category: 'loop', description: 'Gentle oceanic floating hover sine wave', defaultDuration: 2.0, iconName: 'Waves' },
  { id: 'shake', name: 'Micro Shake', category: 'loop', description: 'High-energy jitter for impactful words', defaultDuration: 0.4, iconName: 'Zap' },
  { id: 'glow-pulse', name: 'Glow Breathe', category: 'loop', description: 'Neon lighting intensity breathing cycle', defaultDuration: 1.5, iconName: 'Sparkles' },
  { id: 'heartbeat', name: 'Heartbeat', category: 'loop', description: 'Double-beat viral rhythm pulse', defaultDuration: 1.0, iconName: 'HeartPulse' },
];

/**
 * Easing Functions
 */
function applyEasing(t: number, easing: AnimationEasing = 'ease-out'): number {
  const p = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return p;
    case 'ease-out':
      return 1 - Math.pow(1 - p, 3);
    case 'ease-in-out':
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case 'back-out': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }
    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (p < 1 / d1) return n1 * p * p;
      if (p < 2 / d1) {
        const p2 = p - 1.5 / d1;
        return n1 * p2 * p2 + 0.75;
      }
      if (p < 2.5 / d1) {
        const p2 = p - 2.25 / d1;
        return n1 * p2 * p2 + 0.9375;
      }
      const p2 = p - 2.625 / d1;
      return n1 * p2 * p2 + 0.984375;
    }
    case 'elastic-out': {
      const c4 = (2 * Math.PI) / 3;
      return p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
    }
    default:
      return 1 - Math.pow(1 - p, 3);
  }
}

export interface AnimatedCaptionEvaluation {
  transform: string;
  opacity: number;
  filter: string;
  visibleRatio: number; // 0 to 1 for typewriter character reveal
}

/**
 * Calculates current animated transform, opacity, and filters for a caption at time `t`
 */
export function calculateAnimatedCaptionTransform(
  caption: { start: number; end: number; text?: string; styleOverride?: any },
  activeStyle: any,
  currentTime: number,
  canvasWidth = 1080,
  canvasHeight = 1920
): AnimatedCaptionEvaluation {
  const start = caption.start;
  const end = caption.end;
  const duration = Math.max(0.1, end - start);

  const style = caption.styleOverride ? { ...activeStyle, ...caption.styleOverride } : activeStyle;
  const animConfig: CaptionAnimationConfig = (style as any)?.animationConfig || {
    inPreset: (style?.animation as any) === 'none' ? 'none' : 'pop-in',
    inDuration: 0.3,
    inEasing: 'back-out',
    outPreset: 'none',
    outDuration: 0.25,
    outEasing: 'ease-out',
    loopPreset: 'none',
    loopSpeed: 1.0,
    loopIntensity: 1.0,
  };

  const timeInClip = currentTime - start;
  const timeUntilEnd = end - currentTime;

  let opacity = 1.0;
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;
  let rotate = 0;
  let blurPx = 0;
  let visibleRatio = 1.0;

  // 1. IN Animation Evaluation
  const inDur = Math.min(duration * 0.4, animConfig.inDuration || 0.35);
  if (inDur > 0 && timeInClip >= 0 && timeInClip <= inDur) {
    const rawProgress = timeInClip / inDur;
    const progress = applyEasing(rawProgress, animConfig.inEasing || 'back-out');

    switch (animConfig.inPreset) {
      case 'fade-in':
        opacity = progress;
        break;
      case 'pop-in':
        opacity = Math.min(1.0, rawProgress * 2);
        scale = progress;
        break;
      case 'slide-up':
        opacity = Math.min(1.0, rawProgress * 1.5);
        translateY = (1 - progress) * (canvasHeight * 0.15);
        break;
      case 'slide-down':
        opacity = Math.min(1.0, rawProgress * 1.5);
        translateY = -(1 - progress) * (canvasHeight * 0.15);
        break;
      case 'slide-left':
        opacity = Math.min(1.0, rawProgress * 1.5);
        translateX = (1 - progress) * (canvasWidth * 0.25);
        break;
      case 'slide-right':
        opacity = Math.min(1.0, rawProgress * 1.5);
        translateX = -(1 - progress) * (canvasWidth * 0.25);
        break;
      case 'bounce-in':
        scale = progress;
        opacity = Math.min(1.0, rawProgress * 2.5);
        break;
      case 'typewriter':
        visibleRatio = rawProgress;
        break;
      case 'blur-in':
        blurPx = (1 - progress) * 20;
        opacity = progress;
        break;
      case 'flip-in':
        rotate = (1 - progress) * 90;
        opacity = progress;
        break;
      case 'drop-in':
        translateY = -(1 - progress) * (canvasHeight * 0.3);
        scale = 1.0 + (1 - progress) * 0.8;
        opacity = Math.min(1.0, rawProgress * 2);
        break;
      case 'rise-up':
        translateY = (1 - progress) * 40;
        opacity = progress;
        break;
      default:
        break;
    }
  }

  // 2. OUT Animation Evaluation
  const outDur = Math.min(duration * 0.4, animConfig.outDuration || 0.3);
  if (outDur > 0 && timeUntilEnd >= 0 && timeUntilEnd <= outDur) {
    const rawProgress = (outDur - timeUntilEnd) / outDur; // 0 at start of exit, 1 at finish
    const progress = applyEasing(rawProgress, animConfig.outEasing || 'ease-out');

    switch (animConfig.outPreset) {
      case 'fade-out':
        opacity = Math.max(0, 1 - progress);
        break;
      case 'pop-out':
        scale = Math.max(0, 1 - progress);
        opacity = Math.max(0, 1 - progress);
        break;
      case 'slide-down':
        translateY = progress * (canvasHeight * 0.15);
        opacity = Math.max(0, 1 - progress);
        break;
      case 'slide-up':
        translateY = -progress * (canvasHeight * 0.15);
        opacity = Math.max(0, 1 - progress);
        break;
      case 'slide-left':
        translateX = -progress * (canvasWidth * 0.25);
        opacity = Math.max(0, 1 - progress);
        break;
      case 'slide-right':
        translateX = progress * (canvasWidth * 0.25);
        opacity = Math.max(0, 1 - progress);
        break;
      case 'blur-out':
        blurPx = progress * 20;
        opacity = Math.max(0, 1 - progress);
        break;
      case 'drop-out':
        translateY = progress * (canvasHeight * 0.25);
        opacity = Math.max(0, 1 - progress);
        break;
      default:
        break;
    }
  }

  // 3. LOOP Animation Evaluation (during middle phase)
  if (
    animConfig.loopPreset &&
    animConfig.loopPreset !== 'none' &&
    timeInClip > inDur &&
    timeUntilEnd > outDur
  ) {
    const speed = animConfig.loopSpeed || 1.0;
    const intensity = animConfig.loopIntensity || 1.0;
    const loopTime = timeInClip * speed;

    switch (animConfig.loopPreset) {
      case 'pulse': {
        const s = Math.sin(loopTime * Math.PI * 2);
        scale *= 1.0 + s * 0.08 * intensity;
        break;
      }
      case 'bounce-loop': {
        const b = Math.abs(Math.sin(loopTime * Math.PI * 2));
        translateY -= b * 16 * intensity;
        break;
      }
      case 'floating': {
        const f = Math.sin(loopTime * Math.PI);
        translateY += f * 8 * intensity;
        rotate += Math.cos(loopTime * Math.PI) * 2 * intensity;
        break;
      }
      case 'shake': {
        const rX = (Math.sin(loopTime * 30) + Math.cos(loopTime * 45)) * 3 * intensity;
        const rY = (Math.cos(loopTime * 35) + Math.sin(loopTime * 50)) * 3 * intensity;
        translateX += rX;
        translateY += rY;
        break;
      }
      case 'glow-pulse': {
        const g = (Math.sin(loopTime * Math.PI * 2) + 1) / 2;
        blurPx = Math.max(blurPx, g * 4 * intensity);
        break;
      }
      case 'heartbeat': {
        const cycle = (loopTime * 2) % 1;
        const beat = cycle < 0.15 ? Math.sin((cycle / 0.15) * Math.PI) * 0.12 : cycle > 0.25 && cycle < 0.4 ? Math.sin(((cycle - 0.25) / 0.15) * Math.PI) * 0.08 : 0;
        scale *= 1.0 + beat * intensity;
        break;
      }
      default:
        break;
    }
  }

  const transformParts = [
    `translate(${translateX.toFixed(1)}px, ${translateY.toFixed(1)}px)`,
    scale !== 1.0 ? `scale(${scale.toFixed(3)})` : '',
    rotate !== 0 ? `rotate(${rotate.toFixed(1)}deg)` : '',
  ].filter(Boolean);

  const filterStr = blurPx > 0.5 ? `blur(${blurPx.toFixed(1)}px)` : 'none';

  return {
    transform: transformParts.join(' '),
    opacity: Math.max(0, Math.min(1, opacity)),
    filter: filterStr,
    visibleRatio: Math.max(0, Math.min(1, visibleRatio)),
  };
}
