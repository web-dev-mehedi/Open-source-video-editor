import { VideoClip } from '../types/project';
import { ClipAnimationConfig } from '../types/animation';

export interface AnimationTransformDelta {
  deltaXPercent: number;
  deltaYPercent: number;
  scaleMultiplier: number;
  deltaRotation: number;
  opacityMultiplier: number;
}

/**
 * Standard cubic & spring easing functions for motion graphics
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutSpring(t: number): number {
  const s = 1.70158;
  const t1 = t - 1;
  return t1 * t1 * ((s + 1) * t1 + s) + 1;
}

/**
 * Evaluates the animation transform delta of a VideoClip at a specific timeline timestamp.
 * Returns multiplicative scale/opacity and additive position/rotation modifiers.
 */
export function evaluateClipAnimation(
  clip?: VideoClip,
  timelineTime: number = 0
): AnimationTransformDelta {
  const identity: AnimationTransformDelta = {
    deltaXPercent: 0,
    deltaYPercent: 0,
    scaleMultiplier: 1.0,
    deltaRotation: 0,
    opacityMultiplier: 1.0,
  };

  if (!clip || !clip.animation) {
    return identity;
  }

  const anim = clip.animation;
  const duration = Math.max(0.05, Math.min(clip.timelineDuration, anim.duration || 0.6));
  const delay = Math.max(0, anim.delay || 0);
  const intensity = (anim.intensity ?? 100) / 100;

  // Clip time bounds
  const clipStart = clip.timelineStart;
  const clipEnd = clip.timelineStart + clip.timelineDuration;

  if (timelineTime < clipStart || timelineTime > clipEnd) {
    return identity;
  }

  if (anim.category === 'in') {
    const animStart = clipStart + delay;
    const animEnd = animStart + duration;

    // Before animation starts
    if (timelineTime < animStart) {
      return getAnimationInitialState(anim.type, intensity);
    }

    // After animation completes
    if (timelineTime >= animEnd) {
      return identity;
    }

    // Animating
    const linearProgress = (timelineTime - animStart) / duration;
    return evaluateInAnimation(anim.type, linearProgress, intensity, anim.easing);
  }

  if (anim.category === 'out') {
    const animStart = Math.max(clipStart, clipEnd - duration);
    const animEnd = clipEnd;

    // Before out animation begins
    if (timelineTime < animStart) {
      return identity;
    }

    // After out animation ends
    if (timelineTime >= animEnd) {
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: 0,
        deltaRotation: 0,
        opacityMultiplier: 0,
      };
    }

    // Animating out
    const linearProgress = (timelineTime - animStart) / duration;
    return evaluateOutAnimation(anim.type, linearProgress, intensity, anim.easing);
  }

  if (anim.category === 'combo') {
    const timeSinceStart = timelineTime - clipStart;
    return evaluateComboAnimation(anim.type, timeSinceStart, duration, intensity);
  }

  return identity;
}

/**
 * State of the clip before the In animation begins (holds initial hidden/offscreen posture)
 */
function getAnimationInitialState(type: string, intensity: number): AnimationTransformDelta {
  switch (type) {
    case 'fade-in':
      return { deltaXPercent: 0, deltaYPercent: 0, scaleMultiplier: 1.0, deltaRotation: 0, opacityMultiplier: 0 };
    case 'zoom-in':
      return { deltaXPercent: 0, deltaYPercent: 0, scaleMultiplier: Math.max(0, 1 - 0.7 * intensity), deltaRotation: 0, opacityMultiplier: 0 };
    case 'zoom-out':
      return { deltaXPercent: 0, deltaYPercent: 0, scaleMultiplier: 1 + 0.6 * intensity, deltaRotation: 0, opacityMultiplier: 0 };
    case 'slide-right':
      return { deltaXPercent: -100 * intensity, deltaYPercent: 0, scaleMultiplier: 1.0, deltaRotation: 0, opacityMultiplier: 1.0 };
    case 'slide-left':
      return { deltaXPercent: 100 * intensity, deltaYPercent: 0, scaleMultiplier: 1.0, deltaRotation: 0, opacityMultiplier: 1.0 };
    case 'slide-up':
      return { deltaXPercent: 0, deltaYPercent: 100 * intensity, scaleMultiplier: 1.0, deltaRotation: 0, opacityMultiplier: 1.0 };
    case 'slide-down':
      return { deltaXPercent: 0, deltaYPercent: -100 * intensity, scaleMultiplier: 1.0, deltaRotation: 0, opacityMultiplier: 1.0 };
    case 'pop':
      return { deltaXPercent: 0, deltaYPercent: 0, scaleMultiplier: 0, deltaRotation: 0, opacityMultiplier: 0 };
    case 'spin':
      return { deltaXPercent: 0, deltaYPercent: 0, scaleMultiplier: 0.3, deltaRotation: -180 * intensity, opacityMultiplier: 0 };
    default:
      return { deltaXPercent: 0, deltaYPercent: 0, scaleMultiplier: 1.0, deltaRotation: 0, opacityMultiplier: 0 };
  }
}

/**
 * Evaluates In-Animation progress (0 -> 1)
 */
function evaluateInAnimation(
  type: string,
  progress: number,
  intensity: number,
  easing?: string
): AnimationTransformDelta {
  const p = Math.max(0, Math.min(1, progress));
  const easeProgress =
    easing === 'linear'
      ? p
      : easing === 'spring' || type === 'pop'
      ? easeOutSpring(p)
      : easeOutCubic(p);

  switch (type) {
    case 'fade-in':
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, Math.min(1, easeProgress)),
      };

    case 'zoom-in': {
      const startScale = Math.max(0, 1 - 0.7 * intensity);
      const scale = startScale + (1.0 - startScale) * easeProgress;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: Math.max(0, scale),
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, Math.min(1, easeProgress * 1.3)),
      };
    }

    case 'zoom-out': {
      const startScale = 1 + 0.6 * intensity;
      const scale = startScale + (1.0 - startScale) * easeProgress;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: Math.max(0, scale),
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, Math.min(1, easeProgress * 1.3)),
      };
    }

    case 'slide-right':
      return {
        deltaXPercent: -100 * intensity * (1 - easeProgress),
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'slide-left':
      return {
        deltaXPercent: 100 * intensity * (1 - easeProgress),
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'slide-up':
      return {
        deltaXPercent: 0,
        deltaYPercent: 100 * intensity * (1 - easeProgress),
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'slide-down':
      return {
        deltaXPercent: 0,
        deltaYPercent: -100 * intensity * (1 - easeProgress),
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'pop': {
      const spring = easeOutSpring(p);
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: Math.max(0, spring),
        deltaRotation: 0,
        opacityMultiplier: Math.min(1, p * 2),
      };
    }

    case 'spin': {
      const rot = -180 * intensity * (1 - easeProgress);
      const scale = 0.3 + 0.7 * easeProgress;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: scale,
        deltaRotation: rot,
        opacityMultiplier: Math.min(1, easeProgress * 1.5),
      };
    }

    default:
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: easeProgress,
      };
  }
}

/**
 * Evaluates Out-Animation progress (0 -> 1)
 */
function evaluateOutAnimation(
  type: string,
  progress: number,
  intensity: number,
  easing?: string
): AnimationTransformDelta {
  const p = Math.max(0, Math.min(1, progress));
  const easeProgress = easing === 'linear' ? p : easeInCubic(p);

  switch (type) {
    case 'fade-out':
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, 1 - easeProgress),
      };

    case 'zoom-out-out': {
      const targetScale = Math.max(0, 1 - 0.7 * intensity);
      const scale = 1.0 - (1.0 - targetScale) * easeProgress;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: Math.max(0, scale),
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, 1 - easeProgress * 1.2),
      };
    }

    case 'zoom-in-out': {
      const targetScale = 1.0 + 0.7 * intensity;
      const scale = 1.0 + (targetScale - 1.0) * easeProgress;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: Math.max(0, scale),
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, 1 - easeProgress * 1.2),
      };
    }

    case 'slide-left-out':
      return {
        deltaXPercent: -100 * intensity * easeProgress,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'slide-right-out':
      return {
        deltaXPercent: 100 * intensity * easeProgress,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'slide-up-out':
      return {
        deltaXPercent: 0,
        deltaYPercent: -100 * intensity * easeProgress,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'slide-down-out':
      return {
        deltaXPercent: 0,
        deltaYPercent: 100 * intensity * easeProgress,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };

    case 'shrink': {
      const scale = Math.max(0, 1 - easeProgress);
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: scale,
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, 1 - easeProgress),
      };
    }

    case 'spin-out': {
      const rot = 180 * intensity * easeProgress;
      const scale = Math.max(0, 1 - 0.6 * easeProgress);
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: scale,
        deltaRotation: rot,
        opacityMultiplier: Math.max(0, 1 - easeProgress),
      };
    }

    default:
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: Math.max(0, 1 - easeProgress),
      };
  }
}

/**
 * Evaluates Combo/Loop animations
 */
function evaluateComboAnimation(
  type: string,
  timeSinceStart: number,
  duration: number,
  intensity: number
): AnimationTransformDelta {
  const cycle = (timeSinceStart % duration) / duration;

  switch (type) {
    case 'pulse': {
      // Smooth sinusoidal scale pulse
      const wave = Math.sin(cycle * Math.PI * 2);
      const scale = 1.0 + wave * 0.08 * intensity;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: scale,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };
    }

    case 'pendulum': {
      // Subtle rotation swing
      const wave = Math.sin(cycle * Math.PI * 2);
      const rot = wave * 4 * intensity;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: rot,
        opacityMultiplier: 1.0,
      };
    }

    case 'float': {
      // Floating vertical hover
      const wave = Math.sin(cycle * Math.PI * 2);
      const y = wave * 3 * intensity;
      return {
        deltaXPercent: 0,
        deltaYPercent: y,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };
    }

    case 'zoom-combo': {
      // Continuous slow push-in
      const scale = 1.0 + cycle * 0.15 * intensity;
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: scale,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };
    }

    default:
      return {
        deltaXPercent: 0,
        deltaYPercent: 0,
        scaleMultiplier: 1.0,
        deltaRotation: 0,
        opacityMultiplier: 1.0,
      };
  }
}
