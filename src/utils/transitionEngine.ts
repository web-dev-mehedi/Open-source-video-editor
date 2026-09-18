import { TransitionConfig, TransitionEasing } from '../types/transitions';
import { VideoClip } from '../types/project';

export interface ActiveTransitionState {
  transition: TransitionConfig;
  progress: number; // 0.0 to 1.0
  fromClip?: VideoClip;
  toClip?: VideoClip;
}

/**
 * Apply easing curve to raw progress (0.0 - 1.0)
 */
export function applyTransitionEasing(progress: number, easing: TransitionEasing = 'easeInOut'): number {
  const p = Math.max(0, Math.min(1, progress));
  switch (easing) {
    case 'linear':
      return p;
    case 'easeIn':
      return p * p;
    case 'easeOut':
      return p * (2 - p);
    case 'easeInOut':
    default:
      return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
  }
}

/**
 * Calculate the maximum safe transition duration based on available media on both clips.
 * Prevents transitions that would overrun trimmed media handles or create negative durations.
 * Returns clamped duration in seconds (0.1 .. requested, up to half of shortest clip).
 */
export function getSafeTransitionDuration(
  fromClip: VideoClip | undefined,
  toClip: VideoClip | undefined,
  requestedDuration: number,
  alignment: TransitionConfig['alignment'] = 'center'
): { safeDuration: number; wasClamped: boolean; reason?: string } {
  if (!fromClip || !toClip) {
    // Single-clip intro/outro: limit to 40% of clip duration
    const single = fromClip || toClip;
    if (!single) return { safeDuration: Math.max(0.1, Math.min(requestedDuration, 0.75)), wasClamped: false };
    const maxSingle = Math.max(0.2, single.timelineDuration * 0.4);
    const clamped = Math.min(requestedDuration, maxSingle);
    return { safeDuration: Math.max(0.1, Math.round(clamped * 100) / 100), wasClamped: clamped !== requestedDuration, reason: clamped !== requestedDuration ? `Clamped to ${clamped.toFixed(2)}s (clip too short)` : undefined };
  }

  // For a centered transition, each clip must contribute half duration from its handle
  // Handle length = actual trimmed media available (timelineDuration) minus any existing padding
  const halfRequested = requestedDuration / 2;
  // The available handle is the timeline duration (post-trim & speed) — conservative estimate
  // Also ensure at least 0.3s remains visible on each side for context
  const fromAvail = Math.max(0.15, fromClip.timelineDuration - 0.2);
  const toAvail = Math.max(0.15, toClip.timelineDuration - 0.2);

  let maxAllowed = Math.min(fromAvail, toAvail) * 2;
  // Also cap at 90% of shortest clip to avoid eating entire clip
  const shortest = Math.min(fromClip.timelineDuration, toClip.timelineDuration);
  maxAllowed = Math.min(maxAllowed, shortest * 0.9);
  // Alignment affects available handle: start/end only needs handle from one side
  if (alignment === 'start') maxAllowed = Math.min(toClip.timelineDuration * 0.8, requestedDuration);
  if (alignment === 'end') maxAllowed = Math.min(fromClip.timelineDuration * 0.8, requestedDuration);

  const safe = Math.max(0.1, Math.min(requestedDuration, maxAllowed));
  const wasClamped = Math.abs(safe - requestedDuration) > 0.01;
  return {
    safeDuration: Math.round(safe * 100) / 100,
    wasClamped,
    reason: wasClamped ? `Requested ${requestedDuration}s exceeds available media — clamped to ${safe.toFixed(2)}s` : undefined,
  };
}

/**
 * Validate if a transition can be placed between two clips at a given edit point
 */
export function validateTransitionDrop(
  fromClip: VideoClip | undefined,
  toClip: VideoClip | undefined,
  requestedDuration: number = 0.75
): { valid: boolean; safeDuration: number; message?: string } {
  if (!fromClip && !toClip) return { valid: false, safeDuration: 0, message: 'No clips at drop location' };
  if (fromClip && toClip && Math.abs((fromClip.timelineStart + fromClip.timelineDuration) - toClip.timelineStart) > 0.2) {
    return { valid: false, safeDuration: 0, message: 'Clips must be adjacent — close the gap first (or enable Auto Ripple)' };
  }
  const single = fromClip || toClip;
  if (single && single.timelineDuration < 0.3) return { valid: false, safeDuration: 0, message: 'Clip too short for a transition' };
  const { safeDuration, wasClamped, reason } = getSafeTransitionDuration(fromClip, toClip, requestedDuration);
  if (safeDuration < 0.12) return { valid: false, safeDuration, message: 'Insufficient media handles — trim less or shorten transition' };
  return { valid: true, safeDuration, message: wasClamped ? reason : undefined };
}

/**
 * Re-aligns and clamps all transitions when clips are trimmed, moved, or deleted.
 * Prevents orphan transitions, floating cuts across gaps, or duration overruns.
 */
export function syncTransitionsWithClips(
  transitions: TransitionConfig[] | undefined,
  clips: VideoClip[]
): TransitionConfig[] {
  if (!transitions || transitions.length === 0) return [];
  const clipMap = new Map(clips.map((c) => [c.id, c]));
  const result: TransitionConfig[] = [];

  for (const trans of transitions) {
    const fromClip = clipMap.get(trans.fromClipId);
    const toClip = clipMap.get(trans.toClipId);

    if (!fromClip || !toClip) {
      // Clip deleted -> drop transition safely
      continue;
    }

    // Must be on the same track
    if ((fromClip.trackIndex || 1) !== (toClip.trackIndex || 1)) {
      continue;
    }

    if (fromClip.id === toClip.id) {
      // Intro or outro transition
      const isIntro = trans.alignment === 'start';
      const cutPoint = isIntro
        ? fromClip.timelineStart
        : fromClip.timelineStart + fromClip.timelineDuration;
      const { safeDuration } = getSafeTransitionDuration(
        fromClip,
        fromClip,
        trans.duration,
        trans.alignment
      );
      result.push({
        ...trans,
        timelineStart: cutPoint,
        duration: safeDuration,
      });
    } else {
      // Cut between two distinct clips
      const cutPoint = fromClip.timelineStart + fromClip.timelineDuration;
      const gap = Math.abs(cutPoint - toClip.timelineStart);
      if (gap > 0.25) {
        // Gap introduced or clips separated -> drop transition safely
        continue;
      }
      const { safeDuration } = getSafeTransitionDuration(
        fromClip,
        toClip,
        trans.duration,
        trans.alignment
      );
      result.push({
        ...trans,
        timelineStart: cutPoint,
        duration: safeDuration,
      });
    }
  }

  return result;
}

/**
 * Find any active transition occurring at the given timeline timestamp
 */
export function getActiveTransitionAtTime(
  currentTime: number,
  transitions?: TransitionConfig[],
  clips?: VideoClip[]
): ActiveTransitionState | null {
  if (!transitions || transitions.length === 0 || !clips) return null;

  for (const trans of transitions) {
    const fromClip = clips.find((c) => c.id === trans.fromClipId);
    const toClip = clips.find((c) => c.id === trans.toClipId);
    const editPoint = fromClip
      ? fromClip.timelineStart + fromClip.timelineDuration
      : toClip
      ? toClip.timelineStart
      : trans.timelineStart || 0;

    const halfDur = trans.duration / 2;
    let start = editPoint - halfDur;
    let end = editPoint + halfDur;

    if (trans.alignment === 'start') {
      start = editPoint;
      end = editPoint + trans.duration;
    } else if (trans.alignment === 'end') {
      start = editPoint - trans.duration;
      end = editPoint;
    }

    if (currentTime >= start && currentTime <= end && trans.duration > 0) {
      const rawProgress = (currentTime - start) / trans.duration;
      const progress = applyTransitionEasing(rawProgress, trans.easing || 'easeInOut');

      return {
        transition: trans,
        progress,
        fromClip,
        toClip,
      };
    }
  }

  return null;
}

/**
 * Render real-time visual transition overlay on canvas
 */
export function renderTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: ActiveTransitionState
): void {
  const { transition, progress } = state;

  ctx.save();

  switch (transition.type) {
    // 1. Crossfade / Dissolve Blend
    case 'crossfade': {
      // Filmic soft exposure bloom + luma cross-dissolve flash
      const bloom = Math.sin(progress * Math.PI);
      if (bloom > 0.05) {
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = bloom * 0.45;
        ctx.fillRect(0, 0, width, height);

        // Soft vignette blend
        const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = bloom * 0.5;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    // 2. Fade In
    case 'fade-in': {
      const color = transition.color || '#000000';
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 3. Fade Out
    case 'fade-out': {
      const color = transition.color || '#000000';
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.min(1, progress);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 4. Dip to Black
    case 'dip-black': {
      const dipAlpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = Math.min(1, dipAlpha * 1.25);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 5. Dip to White
    case 'dip-white': {
      const dipAlpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = Math.min(1, dipAlpha * 1.25);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 6. Fade Through Color
    case 'fade-color': {
      const color = transition.color || '#8B5CF6';
      const dipAlpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.min(1, dipAlpha * 1.25);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 7. Wipe / Push / Slide / Whip
    case 'wipe':
    case 'push':
    case 'slide':
    case 'whip-pan': {
      const dir = transition.direction || 'right';
      const beamX = progress * width;
      const beamY = progress * height;

      // Draw sweeping wipe bar with glowing edge
      if (dir === 'right' || dir === 'left') {
        const xPos = dir === 'right' ? beamX : width - beamX;
        // Directional motion blur edge
        const edgeGrad = ctx.createLinearGradient(xPos - 30, 0, xPos + 30, 0);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.9)');
        edgeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(xPos - 15, 0, 30, height);

        // Wipe curtain
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (dir === 'right') {
          ctx.fillRect(xPos, 0, width - xPos, height);
        } else {
          ctx.fillRect(0, 0, xPos, height);
        }
      } else {
        const yPos = dir === 'down' ? beamY : height - beamY;
        const edgeGrad = ctx.createLinearGradient(0, yPos - 30, 0, yPos + 30);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.9)');
        edgeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(0, yPos - 15, width, 30);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (dir === 'down') {
          ctx.fillRect(0, yPos, width, height - yPos);
        } else {
          ctx.fillRect(0, 0, width, yPos);
        }
      }
      break;
    }

    // 8. Iris / Circle Wipe
    case 'iris': {
      const maxR = Math.sqrt(width * width + height * height) * 0.65;
      const currentR = progress * maxR;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(width / 2, height / 2, currentR, 0, Math.PI * 2, true);
      ctx.fill();

      // Glowing circle perimeter
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, currentR, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    // 9. Flash Frame
    case 'flash': {
      const flashColor = transition.color || '#FFFFFF';
      const flashAlpha = Math.sin(progress * Math.PI) * ((transition.intensity ?? 100) / 100);
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = Math.min(1, flashAlpha * 1.2);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 10. Glitch Transition
    case 'glitch': {
      const glitchStrength = Math.sin(progress * Math.PI);
      if (glitchStrength > 0.05) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.65)';
        for (let i = 0; i < 8; i++) {
          const y = (Math.sin(i * 44 + progress * 50) * 0.5 + 0.5) * height;
          ctx.fillRect(0, y, width, 18 * glitchStrength);
        }
        ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
        for (let i = 0; i < 8; i++) {
          const y = (Math.cos(i * 33 + progress * 50) * 0.5 + 0.5) * height;
          ctx.fillRect(20 * glitchStrength, y, width, 14 * glitchStrength);
        }
      }
      break;
    }

    // 11. Light Leak Transition
    case 'light-leak': {
      const leakColor = transition.color || '#F59E0B';
      const leakAlpha = Math.sin(progress * Math.PI) * 0.9;
      const grad = ctx.createRadialGradient(width * 0.65, height * 0.35, 10, width * 0.5, height * 0.5, width * 0.85);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, leakColor);
      grad.addColorStop(0.7, '#EF4444');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.globalAlpha = Math.min(1, leakAlpha);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 12. Film Burn
    case 'film-burn': {
      const burnAlpha = Math.sin(progress * Math.PI) * 0.95;
      const grad = ctx.createRadialGradient(width * 0.45, height * 0.5, 20, width * 0.5, height * 0.5, width * 0.75);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.25, '#F59E0B');
      grad.addColorStop(0.6, '#EF4444');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.globalAlpha = Math.min(1, burnAlpha);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 13. Luma Wipe
    case 'luma-wipe': {
      const lumaAlpha = progress < 0.5 ? progress * 1.8 : (1 - progress) * 1.8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.globalAlpha = Math.min(0.9, lumaAlpha);
      ctx.fillRect(0, 0, width, height);
      break;
    }

    // 14. Morph / Zoom / Spin
    case 'zoom':
    case 'spin':
    case 'morph': {
      const motionAlpha = Math.sin(progress * Math.PI);
      if (motionAlpha > 0.05) {
        // High speed zoom speed lines
        const cx = width / 2;
        const cy = height / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50);
          ctx.lineTo(cx + Math.cos(a) * width, cy + Math.sin(a) * height);
          ctx.stroke();
        }

        ctx.fillStyle = '#000000';
        ctx.globalAlpha = Math.min(0.6, motionAlpha * 0.7);
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }
  }

  ctx.restore();
}
