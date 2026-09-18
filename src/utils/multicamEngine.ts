import { VideoClip } from '../types/project';
import { MulticamAngle, MulticamCutPoint } from '../types/multicam';

/**
 * Align multiple video clips by cross-correlating waveform energy peaks (Non-AI algorithmic sync)
 */
export function calculateWaveformSyncOffset(
  masterPeaks: number[],
  targetPeaks: number[],
  sampleRatePerSec: number = 20
): number {
  if (!masterPeaks || !targetPeaks || masterPeaks.length === 0 || targetPeaks.length === 0) {
    return 0;
  }

  const maxSearchLag = Math.min(masterPeaks.length, Math.round(15 * sampleRatePerSec)); // Search +/- 15 seconds
  let bestCorrelation = -Infinity;
  let bestLag = 0;

  for (let lag = -maxSearchLag; lag <= maxSearchLag; lag++) {
    let sum = 0;
    let count = 0;

    for (let i = 0; i < masterPeaks.length; i++) {
      const targetIdx = i + lag;
      if (targetIdx >= 0 && targetIdx < targetPeaks.length) {
        sum += masterPeaks[i] * targetPeaks[targetIdx];
        count++;
      }
    }

    if (count > 20) {
      const normalizedCorr = sum / count;
      if (normalizedCorr > bestCorrelation) {
        bestCorrelation = normalizedCorr;
        bestLag = lag;
      }
    }
  }

  return Math.round((bestLag / sampleRatePerSec) * 100) / 100;
}

/**
 * Generate timeline slice cuts from multicam live switching points
 */
export function generateMulticamTimelineClips(
  angles: MulticamAngle[],
  cutPoints: MulticamCutPoint[],
  totalDuration: number,
  allProjectClips: VideoClip[]
): VideoClip[] {
  if (!angles || angles.length === 0) return [];

  const sortedCuts = [...cutPoints].sort((a, b) => a.timecode - b.timecode);
  const segments: Array<{ start: number; end: number; angleId: string }> = [];

  let currentStart = 0;
  let currentAngleId = angles[0].id;

  for (const cut of sortedCuts) {
    if (cut.timecode > currentStart && cut.timecode < totalDuration) {
      segments.push({
        start: currentStart,
        end: cut.timecode,
        angleId: currentAngleId,
      });
      currentStart = cut.timecode;
      currentAngleId = cut.activeAngleId;
    }
  }

  if (currentStart < totalDuration) {
    segments.push({
      start: currentStart,
      end: totalDuration,
      angleId: currentAngleId,
    });
  }

  const resultClips: VideoClip[] = segments.map((seg, idx) => {
    const angle = angles.find((a) => a.id === seg.angleId) || angles[0];
    const sourceClip = allProjectClips.find((c) => c.id === angle.clipId) || allProjectClips[0];

    const segDuration = seg.end - seg.start;
    const sourceStartOffset = Math.max(0, seg.start + angle.syncOffsetSeconds);

    return {
      ...sourceClip,
      id: `mclip_${Date.now()}_${idx}`,
      name: `${angle.name} [Seg ${idx + 1}]`,
      timelineStart: seg.start,
      timelineDuration: segDuration,
      startOffset: sourceStartOffset,
      endOffset: sourceStartOffset + segDuration,
      trackIndex: 1,
    };
  });

  return resultClips;
}
