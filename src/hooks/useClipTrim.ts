/**
 * Professional CapCut-Style Non-Destructive Timeline Trimming Engine
 * (src/hooks/useClipTrim.ts)
 * 
 * Strict separation between Source Space [0, rawDuration] and Timeline Space [timelineStart, timelineDuration],
 * with playback rate (speed) scaling:
 *   timelineDuration = (endOffset - startOffset) / speed
 * 
 * Key Principles:
 * 1. Non-destructive: Original media files and source duration are NEVER modified or deleted.
 * 2. Left-edge trimming: Adjusts startOffset (source-in), shifts timelineStart forward/backward,
 *    and keeps the right timeline edge strictly pinned.
 * 3. Right-edge trimming: Adjusts endOffset (source-out), changes timelineDuration,
 *    and keeps the left timeline edge (timelineStart) strictly pinned.
 * 4. Recovery: Dragging outward restores previously trimmed source content seamlessly.
 * 5. Speed compatibility: Multiplies/divides timeline delta by speed so source space stays exact.
 * 6. Snapping: Snaps to playhead, markers, or neighboring clip edges within threshold.
 * 7. Frame accuracy: Quantizes to frame rate (e.g., 30fps / 60fps) to avoid sub-frame drift.
 */

export interface TrimOptions {
  fps?: number;
  isImage?: boolean;
  minDuration?: number; // default 0.05s / 1 frame
  snapCandidates?: number[];
  snapThresholdTimeline?: number; // in timeline seconds (e.g. 8px / pps)
}

export interface TrimResult {
  timelineStart: number;
  timelineDuration: number;
  startOffset: number;
  endOffset: number;
  snapped: boolean;
  snapPoint?: number;
  deltaSecondsTimeline: number;
  deltaSecondsSource: number;
  effectiveCurrentCutTime: number; // timeline timestamp for live preview scrubbing
  effectiveSourceCutTime: number;  // source timestamp for live preview video seek
}

/**
 * Quantizes a second value to the nearest frame boundary based on FPS.
 */
export function quantizeToFrame(seconds: number, fps: number = 30): number {
  if (!isFinite(seconds) || seconds < 0) return 0;
  const frameDur = 1 / Math.max(1, fps);
  const quantized = Math.round(seconds / frameDur) * frameDur;
  return Math.round(quantized * 1000) / 1000;
}

/**
 * Calculates deterministic, non-destructive CapCut-style clip edge trimming.
 */
export function calculateTrimUpdate(
  clip: {
    timelineStart: number;
    timelineDuration: number;
    startOffset: number;
    endOffset: number;
    duration: number;
    speed?: number;
    fps?: number;
  },
  edge: 'left' | 'right',
  deltaSeconds: number,
  options: TrimOptions = {}
): TrimResult {
  const fps = options.fps || clip.fps || 30;
  const frameDur = 1 / fps;
  const minDuration = Math.max(frameDur, options.minDuration ?? 0.05);
  const speed = clip.speed && isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1.0;
  const isImage = options.isImage || false;

  // Source media boundaries
  const rawDuration = isImage
    ? Math.max(1000, (clip.duration || 5) * 10)
    : Math.max(minDuration, clip.duration || clip.endOffset || 5);

  const initialStartOffset = Math.max(0, clip.startOffset || 0);
  const initialEndOffset = Math.min(
    rawDuration,
    Math.max(initialStartOffset + minDuration, clip.endOffset || rawDuration)
  );

  const initialTimelineStart = Math.max(0, clip.timelineStart || 0);
  const initialTimelineDuration = Math.max(
    minDuration,
    (initialEndOffset - initialStartOffset) / speed
  );
  const initialTimelineEnd = initialTimelineStart + initialTimelineDuration;

  let effectiveDeltaTimeline = deltaSeconds;
  let snapped = false;
  let snapPoint: number | undefined;

  // Handle Snapping if candidates and threshold provided
  if (options.snapCandidates && options.snapCandidates.length > 0 && options.snapThresholdTimeline) {
    const threshold = options.snapThresholdTimeline;
    if (edge === 'left') {
      const proposedStart = initialTimelineStart + deltaSeconds;
      let bestDist = threshold + 0.0001;
      let bestCandidate: number | null = null;
      for (const cand of options.snapCandidates) {
        const dist = Math.abs(proposedStart - cand);
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = cand;
        }
      }
      if (bestCandidate !== null && bestDist <= threshold) {
        effectiveDeltaTimeline = bestCandidate - initialTimelineStart;
        snapped = true;
        snapPoint = bestCandidate;
      }
    } else {
      const proposedEnd = initialTimelineEnd + deltaSeconds;
      let bestDist = threshold + 0.0001;
      let bestCandidate: number | null = null;
      for (const cand of options.snapCandidates) {
        const dist = Math.abs(proposedEnd - cand);
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = cand;
        }
      }
      if (bestCandidate !== null && bestDist <= threshold) {
        effectiveDeltaTimeline = bestCandidate - initialTimelineEnd;
        snapped = true;
        snapPoint = bestCandidate;
      }
    }
  }

  // Convert timeline delta to source delta
  const deltaSource = effectiveDeltaTimeline * speed;

  if (edge === 'left') {
    // ----------------------------------------------------
    // LEFT HANDLE TRIMMING (Trim In-Point)
    // ----------------------------------------------------
    // Proposed source-in point
    let proposedStartOffset = initialStartOffset + deltaSource;

    // Boundary Constraint 1: cannot drag past start of source media (0s)
    proposedStartOffset = Math.max(0, proposedStartOffset);

    // Boundary Constraint 2: cannot exceed endOffset - minDuration
    proposedStartOffset = Math.min(initialEndOffset - minDuration, proposedStartOffset);

    // Frame quantize proposed start offset
    proposedStartOffset = quantizeToFrame(proposedStartOffset, fps);

    // Calculate actual delta applied to source & timeline
    const actualDeltaSource = proposedStartOffset - initialStartOffset;
    const actualDeltaTimeline = actualDeltaSource / speed;

    const newTimelineStart = quantizeToFrame(Math.max(0, initialTimelineStart + actualDeltaTimeline), fps);
    const newTimelineDuration = Math.max(
      minDuration,
      Math.round(((initialEndOffset - proposedStartOffset) / speed) * 1000) / 1000
    );

    return {
      timelineStart: newTimelineStart,
      timelineDuration: newTimelineDuration,
      startOffset: proposedStartOffset,
      endOffset: initialEndOffset,
      snapped,
      snapPoint,
      deltaSecondsTimeline: actualDeltaTimeline,
      deltaSecondsSource: actualDeltaSource,
      effectiveCurrentCutTime: newTimelineStart,
      effectiveSourceCutTime: proposedStartOffset,
    };
  } else {
    // ----------------------------------------------------
    // RIGHT HANDLE TRIMMING (Trim Out-Point)
    // ----------------------------------------------------
    // Proposed source-out point
    let proposedEndOffset = initialEndOffset + deltaSource;

    // Boundary Constraint 1: for video/audio, cannot exceed raw media duration
    if (!isImage) {
      proposedEndOffset = Math.min(rawDuration, proposedEndOffset);
    }

    // Boundary Constraint 2: cannot be less than startOffset + minDuration
    proposedEndOffset = Math.max(initialStartOffset + minDuration, proposedEndOffset);

    // Frame quantize proposed end offset
    proposedEndOffset = quantizeToFrame(proposedEndOffset, fps);

    const actualDeltaSource = proposedEndOffset - initialEndOffset;
    const actualDeltaTimeline = actualDeltaSource / speed;

    const newTimelineDuration = Math.max(
      minDuration,
      Math.round(((proposedEndOffset - initialStartOffset) / speed) * 1000) / 1000
    );

    const newTimelineEnd = initialTimelineStart + newTimelineDuration;

    return {
      timelineStart: initialTimelineStart,
      timelineDuration: newTimelineDuration,
      startOffset: initialStartOffset,
      endOffset: proposedEndOffset,
      snapped,
      snapPoint,
      deltaSecondsTimeline: actualDeltaTimeline,
      deltaSecondsSource: actualDeltaSource,
      effectiveCurrentCutTime: newTimelineEnd,
      effectiveSourceCutTime: proposedEndOffset,
    };
  }
}
