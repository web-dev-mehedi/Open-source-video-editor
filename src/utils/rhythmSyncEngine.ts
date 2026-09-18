export interface RhythmBeatMarker {
  timestamp: number; // in seconds
  strength: number; // 0 to 1.0
  isDownbeat: boolean;
}

/**
 * Detect rhythmic beats and onsets from PCM waveform buffer
 */
export function detectAudioRhythmBeats(
  peaks: number[],
  duration: number,
  sensitivity: number = 65
): { bpm: number; beats: RhythmBeatMarker[] } {
  if (!peaks || peaks.length === 0 || duration <= 0) {
    return { bpm: 120, beats: [] };
  }

  const threshold = 0.45 * (100 - sensitivity) / 50;
  const beats: RhythmBeatMarker[] = [];
  const timePerPeak = duration / peaks.length;

  let lastBeatTime = -0.3; // min 300ms gap between beats (max 200 BPM)
  let peakDiffSum = 0;
  let count = 0;

  for (let i = 1; i < peaks.length; i++) {
    const diff = peaks[i] - peaks[i - 1];
    const time = i * timePerPeak;

    if (diff > threshold && (time - lastBeatTime) > 0.28) {
      const isDownbeat = (beats.length % 4) === 0;
      beats.push({
        timestamp: parseFloat(time.toFixed(3)),
        strength: Math.min(1.0, peaks[i] * 1.2),
        isDownbeat,
      });

      if (lastBeatTime > 0) {
        peakDiffSum += (time - lastBeatTime);
        count++;
      }
      lastBeatTime = time;
    }
  }

  const avgInterval = count > 0 ? peakDiffSum / count : 0.5;
  const bpm = Math.round(Math.min(180, Math.max(60, 60 / avgInterval)));

  return { bpm, beats };
}
