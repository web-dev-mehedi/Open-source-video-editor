import { SpeedRampConfig, SpeedKeyframe } from '../types/speedRamp';

/**
 * Interpolate velocity along a speed ramp curve for normalized time t in [0, 1]
 */
export function interpolateRampSpeed(config?: SpeedRampConfig | null, progress: number = 0): number {
  if (!config || !config.enabled || !config.keyframes || config.keyframes.length === 0) {
    return 1.0;
  }

  const t = Math.max(0, Math.min(1.0, progress));
  const sorted = [...config.keyframes].sort((a, b) => a.time - b.time);

  if (t <= sorted[0].time) return sorted[0].speed;
  if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].speed;

  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i];
    const k2 = sorted[i + 1];

    if (t >= k1.time && t <= k2.time) {
      const interval = k2.time - k1.time;
      if (interval <= 0.0001) return k1.speed;

      const segT = (t - k1.time) / interval;
      // Smooth Hermite interpolation
      const smoothT = segT * segT * (3 - 2 * segT);
      return k1.speed + (k2.speed - k1.speed) * smoothT;
    }
  }

  return 1.0;
}

/**
 * Compile FFmpeg setpts & atempo filter expressions for variable speed curve
 */
export function compileSpeedRampToFfmpeg(config?: SpeedRampConfig | null): {
  videoFilter?: string;
  audioFilter?: string;
} {
  if (!config || !config.enabled) return {};

  const avgSpeed =
    config.keyframes.reduce((acc, k) => acc + k.speed, 0) / Math.max(1, config.keyframes.length);

  const ptsMultiplier = (1 / Math.max(0.1, avgSpeed)).toFixed(3);
  return {
    videoFilter: `setpts=${ptsMultiplier}*PTS`,
    audioFilter: `atempo=${Math.min(2.0, Math.max(0.5, avgSpeed)).toFixed(2)}`,
  };
}
