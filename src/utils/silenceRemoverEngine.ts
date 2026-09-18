import { SilenceInterval, SilenceRemoverSettings } from '../types/silenceRemover';

/**
 * Scan audio waveform peaks for silence intervals below threshold
 */
export function detectSilenceIntervals(
  peaks: number[],
  totalDuration: number,
  settings: SilenceRemoverSettings
): SilenceInterval[] {
  if (!peaks || peaks.length === 0 || totalDuration <= 0) return [];

  // Convert dBFS threshold to linear amplitude: A = 10^(dB / 20)
  const linearThreshold = Math.pow(10, settings.dbThreshold / 20);
  const timePerSample = totalDuration / peaks.length;
  const intervals: SilenceInterval[] = [];

  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < peaks.length; i++) {
    const val = peaks[i];
    const time = i * timePerSample;

    if (val < linearThreshold) {
      if (!inSilence) {
        inSilence = true;
        silenceStart = time;
      }
    } else {
      if (inSilence) {
        inSilence = false;
        const dur = time - silenceStart;
        if (dur >= settings.minDuration) {
          intervals.push({
            id: `silence-${intervals.length + 1}`,
            start: Math.max(0, silenceStart + settings.safetyPadding),
            end: Math.max(0, time - settings.safetyPadding),
            duration: Math.max(0.05, dur - settings.safetyPadding * 2),
            isSelected: true,
          });
        }
      }
    }
  }

  // Handle trailing silence
  if (inSilence) {
    const dur = totalDuration - silenceStart;
    if (dur >= settings.minDuration) {
      intervals.push({
        id: `silence-${intervals.length + 1}`,
        start: Math.max(0, silenceStart + settings.safetyPadding),
        end: totalDuration,
        duration: Math.max(0.05, dur - settings.safetyPadding),
        isSelected: true,
      });
    }
  }

  return intervals;
}
