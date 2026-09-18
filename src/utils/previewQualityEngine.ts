export type PreviewQuality =
  | 'auto'
  | 'full'
  | 'high'
  | 'balanced'
  | 'fast'
  | 'half'
  | 'quarter'
  | 'draft';

export const PREVIEW_QUALITY_ORDER: PreviewQuality[] = [
  'auto',
  'full',
  'high',
  'balanced',
  'fast',
  'half',
  'quarter',
  'draft',
];

export interface TimelineWorkloadStats {
  activeClipsCount: number;
  activeEffectsCount: number;
  activeCaptionsCount: number;
  hasMatting: boolean;
  is4KFootage: boolean;
  fps: number;
  recentFrameDropCount?: number;
}

export interface DynamicQualityDecision {
  effectiveScale: number;
  bypassExpensiveShaders: boolean;
  skipIntermediateFrames: boolean;
  label: string;
  reason: string;
}

export function qualityToScale(q: PreviewQuality): number {
  switch (q) {
    case 'auto':
      return 1.0; // dynamic default
    case 'full':
      return 1.0;
    case 'high':
      return 0.75;
    case 'balanced':
    case 'half':
      return 0.5;
    case 'fast':
    case 'quarter':
      return 0.25;
    case 'draft':
      return 0.18;
    default:
      return 1.0;
  }
}

export function qualityToLabel(q: PreviewQuality): string {
  switch (q) {
    case 'auto':
      return 'Auto';
    case 'full':
      return 'Full (100%)';
    case 'high':
      return 'High (75%)';
    case 'balanced':
      return 'Balanced (50%)';
    case 'fast':
      return 'Fast (25%)';
    case 'half':
      return '½ (50%)';
    case 'quarter':
      return '¼ (25%)';
    case 'draft':
      return 'Draft (18%)';
    default:
      return 'Auto';
  }
}

/**
 * Evaluates real-time timeline complexity and dynamically scales preview resolution & shader passes
 */
export function calculateDynamicQuality(
  qualityMode: PreviewQuality,
  workload: TimelineWorkloadStats,
  isScrubbing = false,
  isPlaying = false
): DynamicQualityDecision {
  // If user selected explicit fixed mode, respect explicit setting while paused or scrubbing
  if (qualityMode !== 'auto') {
    const scale = qualityToScale(qualityMode);
    return {
      effectiveScale: scale,
      bypassExpensiveShaders: isScrubbing && scale < 0.5,
      skipIntermediateFrames: isScrubbing,
      label: qualityToLabel(qualityMode),
      reason: 'User manual quality override',
    };
  }

  // AUTO Mode: Dynamic workload analysis
  let complexityScore = 0;
  complexityScore += workload.activeClipsCount * 2;
  complexityScore += workload.activeEffectsCount * 3;
  complexityScore += workload.activeCaptionsCount * 1;
  if (workload.hasMatting) complexityScore += 8;
  if (workload.is4KFootage) complexityScore += 5;

  // During active scrubbing, prioritize instant latency over pixel density
  if (isScrubbing) {
    if (complexityScore >= 8) {
      return {
        effectiveScale: 0.5,
        bypassExpensiveShaders: true,
        skipIntermediateFrames: true,
        label: 'Auto (Scrub Fast)',
        reason: 'Heavy timeline active during scrub',
      };
    }
    return {
      effectiveScale: 0.75,
      bypassExpensiveShaders: false,
      skipIntermediateFrames: true,
      label: 'Auto (Scrub)',
      reason: 'Smooth interactive scrub',
    };
  }

  // During active playback
  if (isPlaying) {
    if (complexityScore >= 12 || (workload.recentFrameDropCount && workload.recentFrameDropCount > 3)) {
      return {
        effectiveScale: 0.5,
        bypassExpensiveShaders: false,
        skipIntermediateFrames: false,
        label: 'Auto (½ Res)',
        reason: 'Heavy multi-track/AI load detected during playback',
      };
    }
    if (complexityScore >= 6) {
      return {
        effectiveScale: 0.75,
        bypassExpensiveShaders: false,
        skipIntermediateFrames: false,
        label: 'Auto (¾ Res)',
        reason: 'Balanced preview playback',
      };
    }
    return {
      effectiveScale: 1.0,
      bypassExpensiveShaders: false,
      skipIntermediateFrames: false,
      label: 'Auto (Full)',
      reason: 'Lightweight timeline in optimal performance state',
    };
  }

  // Paused: restore full crisp quality for pristine visual inspection
  return {
    effectiveScale: 1.0,
    bypassExpensiveShaders: false,
    skipIntermediateFrames: false,
    label: 'Auto (100% Crisp)',
    reason: 'Playhead paused for detailed preview',
  };
}
