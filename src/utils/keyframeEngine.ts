import { VideoClip } from '../types/project';
import {
  AnimatableProperty,
  ClipKeyframeState,
  KeyframePoint,
  PropertyTrack,
  KeyframeEasing,
} from '../types/keyframes';
import { evaluateClipAnimation } from './animationEngine';

/**
 * Evaluate easing curve function for normalized progress t in [0, 1]
 */
export function evaluateEasing(t: number, easing: KeyframeEasing, cp?: KeyframePoint['controlPoints']): number {
  const clampedT = Math.max(0, Math.min(1, t));

  switch (easing) {
    case 'linear':
      return clampedT;

    case 'easeIn':
      return clampedT * clampedT * clampedT;

    case 'easeOut':
      return 1 - Math.pow(1 - clampedT, 3);

    case 'easeInOut':
      return clampedT < 0.5
        ? 4 * clampedT * clampedT * clampedT
        : 1 - Math.pow(-2 * clampedT + 2, 3) / 2;

    case 'spring': {
      // Damped harmonic bounce
      const s = 1.70158;
      const t1 = clampedT - 1;
      return t1 * t1 * ((s + 1) * t1 + s) + 1;
    }

    case 'hold':
      return clampedT >= 1 ? 1 : 0;

    case 'bezier': {
      if (cp) {
        // Approximate cubic bezier curve with given control points
        const cp1x = cp.cp1x ?? 0.25;
        const cp1y = cp.cp1y ?? 0.1;
        const cp2x = cp.cp2x ?? 0.25;
        const cp2y = cp.cp2y ?? 1.0;

        // 1D De Casteljau evaluation
        const u = 1 - clampedT;
        return (
          3 * u * u * clampedT * cp1y +
          3 * u * clampedT * clampedT * cp2y +
          clampedT * clampedT * clampedT
        );
      }
      return clampedT < 0.5 ? 2 * clampedT * clampedT : -1 + (4 - 2 * clampedT) * clampedT;
    }

    default:
      return clampedT;
  }
}

/**
 * Interpolate the numerical property value along a property track at a given clip-relative time
 */
export function interpolatePropertyTrackValue(
  track?: PropertyTrack,
  relativeTime: number = 0,
  fallbackValue: number = 0
): number {
  if (!track || !track.keyframes || track.keyframes.length === 0) {
    return fallbackValue;
  }

  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);

  // Before first keyframe
  if (relativeTime <= sorted[0].time) {
    return sorted[0].value;
  }

  // After last keyframe
  if (relativeTime >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }

  // Find bounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i];
    const k2 = sorted[i + 1];

    if (relativeTime >= k1.time && relativeTime <= k2.time) {
      const interval = k2.time - k1.time;
      if (interval <= 0.0001) return k1.value;

      const progress = (relativeTime - k1.time) / interval;
      const easedProgress = evaluateEasing(progress, k1.easing, k1.controlPoints);
      return k1.value + (k2.value - k1.value) * easedProgress;
    }
  }

  return fallbackValue;
}

/**
 * Compute the complete interpolated 2D transform (Position, Scale, Rotation, Opacity) of a video clip at currentTime
 */
export function getInterpolatedClipTransform(
  clip?: VideoClip,
  timelineTime: number = 0
): {
  xPercent: number;
  yPercent: number;
  scale: number;
  rotation: number;
  opacity: number;
} {
  if (!clip) {
    return { xPercent: 0, yPercent: 0, scale: 1.0, rotation: 0, opacity: 1.0 };
  }

  const staticT = clip.transform || {};
  const defaultX = staticT.xPercent ?? 0;
  const defaultY = staticT.yPercent ?? 0;
  const defaultScale = staticT.scale ?? 1.0;
  const defaultRotation = staticT.rotation ?? 0;
  const defaultOpacity = staticT.opacity ?? 1.0;

  const keyframes = clip.keyframes?.tracks;
  let baseX = defaultX;
  let baseY = defaultY;
  let baseScale = defaultScale;
  let baseRotation = defaultRotation;
  let baseOpacity = defaultOpacity;

  if (keyframes) {
    const clipRelativeTime = Math.max(
      0,
      Math.min(clip.timelineDuration, timelineTime - clip.timelineStart)
    );
    baseX = interpolatePropertyTrackValue(keyframes.positionX, clipRelativeTime, defaultX);
    baseY = interpolatePropertyTrackValue(keyframes.positionY, clipRelativeTime, defaultY);
    baseScale = interpolatePropertyTrackValue(keyframes.scale, clipRelativeTime, defaultScale);
    baseRotation = interpolatePropertyTrackValue(keyframes.rotation, clipRelativeTime, defaultRotation);
    baseOpacity = interpolatePropertyTrackValue(keyframes.opacity, clipRelativeTime, defaultOpacity);
  }

  // Evaluate clip motion animation (In / Out / Combo)
  const anim = evaluateClipAnimation(clip, timelineTime);

  const finalX = baseX + anim.deltaXPercent;
  const finalY = baseY + anim.deltaYPercent;
  const finalScale = baseScale * anim.scaleMultiplier;
  const finalRotation = baseRotation + anim.deltaRotation;
  const finalOpacity = baseOpacity * anim.opacityMultiplier;

  return {
    xPercent: Math.round(finalX * 100) / 100,
    yPercent: Math.round(finalY * 100) / 100,
    scale: Math.max(0.01, Math.round(finalScale * 100) / 100),
    rotation: Math.round(finalRotation * 10) / 10,
    opacity: Math.max(0, Math.min(1.0, Math.round(finalOpacity * 100) / 100)),
  };
}

/**
 * Check if the playhead is currently sitting directly on a keyframe
 */
export function isAtKeyframe(
  track?: PropertyTrack,
  relativeTime: number = 0,
  threshold: number = 0.05
): KeyframePoint | undefined {
  if (!track || !track.keyframes) return undefined;
  return track.keyframes.find((k) => Math.abs(k.time - relativeTime) <= threshold);
}

/**
 * Find previous keyframe time before current position
 */
export function findPreviousKeyframeTime(
  keyframesState?: ClipKeyframeState,
  relativeTime: number = 0
): number | null {
  if (!keyframesState) return null;
  const allTimes: number[] = [];

  for (const key of Object.keys(keyframesState.tracks) as AnimatableProperty[]) {
    const track = keyframesState.tracks[key];
    if (track?.keyframes) {
      for (const k of track.keyframes) {
        if (k.time < relativeTime - 0.05) allTimes.push(k.time);
      }
    }
  }

  if (allTimes.length === 0) return null;
  return Math.max(...allTimes);
}

/**
 * Find next keyframe time after current position
 */
export function findNextKeyframeTime(
  keyframesState?: ClipKeyframeState,
  relativeTime: number = 0
): number | null {
  if (!keyframesState) return null;
  const allTimes: number[] = [];

  for (const key of Object.keys(keyframesState.tracks) as AnimatableProperty[]) {
    const track = keyframesState.tracks[key];
    if (track?.keyframes) {
      for (const k of track.keyframes) {
        if (k.time > relativeTime + 0.05) allTimes.push(k.time);
      }
    }
  }

  if (allTimes.length === 0) return null;
  return Math.min(...allTimes);
}
