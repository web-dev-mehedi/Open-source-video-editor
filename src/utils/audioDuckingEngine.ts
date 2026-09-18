import { ProjectData } from '../types/project';

export interface AudioDuckingConfig {
  enabled: boolean;
  duckAmountDb: number; // e.g. -18 dB (attenuation during speech)
  thresholdDb: number; // e.g. -26 dB
  attackMs: number; // e.g. 150 ms (time to ramp down)
  releaseMs: number; // e.g. 600 ms (time to restore volume)
  dialogueSource: 'captions' | 'primary-audio';
}

export const DEFAULT_AUDIO_DUCKING: AudioDuckingConfig = {
  enabled: true,
  duckAmountDb: -18,
  thresholdDb: -26,
  attackMs: 150,
  releaseMs: 600,
  dialogueSource: 'captions',
};

/**
 * Calculate the instantaneous background music gain multiplier (0.0 to 1.0) at currentTime
 */
export function calculateMusicDuckingGain(
  project?: ProjectData | null,
  currentTime: number = 0,
  config: AudioDuckingConfig = DEFAULT_AUDIO_DUCKING
): number {
  if (!project || !config.enabled) return 1.0;

  const minGain = Math.pow(10, config.duckAmountDb / 20); // e.g. -18dB ~= 0.126
  const attackSec = (config.attackMs || 150) / 1000;
  const releaseSec = (config.releaseMs || 600) / 1000;

  // Check if dialogue/speech is active from captions timestamps
  const captions = project.captions || [];
  let isSpeaking = false;
  let speechEndDist = Infinity;
  let speechStartDist = Infinity;

  for (const cap of captions) {
    if (currentTime >= cap.start - 0.05 && currentTime <= cap.end + 0.05) {
      isSpeaking = true;
      break;
    }

    if (currentTime > cap.end) {
      const dist = currentTime - cap.end;
      if (dist < speechEndDist) speechEndDist = dist;
    }

    if (currentTime < cap.start) {
      const dist = cap.start - currentTime;
      if (dist < speechStartDist) speechStartDist = dist;
    }
  }

  if (isSpeaking) {
    return minGain;
  }

  // Release ramp up after speech ends
  if (speechEndDist < releaseSec) {
    const progress = speechEndDist / releaseSec;
    return minGain + (1.0 - minGain) * Math.min(1.0, progress * progress);
  }

  // Pre-attack lookahead ramp down
  if (speechStartDist < attackSec) {
    const progress = 1.0 - speechStartDist / attackSec;
    return 1.0 - (1.0 - minGain) * Math.min(1.0, progress * progress);
  }

  return 1.0;
}

/**
 * Compile FFmpeg sidechain volume / ducking filter string for export
 */
export function compileAudioDuckingToFfmpeg(
  config: AudioDuckingConfig,
  speechIntervals: { start: number; end: number }[]
): string[] {
  if (!config.enabled || speechIntervals.length === 0) return [];

  const minGain = Math.pow(10, config.duckAmountDb / 20).toFixed(3);
  const conditions = speechIntervals
    .map((s) => `between(t,${s.start.toFixed(2)},${s.end.toFixed(2)})`)
    .join('+');

  return [`volume='if(${conditions},${minGain},1.0)':eval=frame`];
}
