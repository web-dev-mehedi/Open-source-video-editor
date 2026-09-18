/**
 * Centralized Timeline Mathematical & Spatial Utilities (src/utils/timelineMath.ts)
 * 
 * Provides single-source-of-truth mathematical operations for:
 * - Time <-> Pixel coordinate translation
 * - Snap calculations for playhead, clips, and markers
 * - Boundary clamping and duration normalization
 * - Frame-rate aware quantization
 */

/**
 * Calculates pixels-per-second based on timeline zoom level (1 to 10).
 * Range: 40px/s to 400px/s (or down to 0.2px/s for ultra-long projects).
 */
export function calculatePixelsPerSecond(zoomLevel: number, basePps: number = 40): number {
  const safeZoom = Math.max(0.01, isFinite(zoomLevel) ? zoomLevel : 1);
  return Math.max(0.2, Math.min(300.0, basePps * safeZoom));
}

/**
 * Converts timeline time in seconds to horizontal pixel offset.
 */
export function timeToPixels(seconds: number, pixelsPerSecond: number): number {
  if (!isFinite(seconds) || seconds < 0) return 0;
  if (!isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) return 0;
  return Math.round(seconds * pixelsPerSecond * 100) / 100;
}

/**
 * Converts horizontal pixel offset to timeline time in seconds.
 */
export function pixelsToTime(pixels: number, pixelsPerSecond: number): number {
  if (!isFinite(pixels) || pixels < 0) return 0;
  if (!isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) return 0;
  return Math.max(0, pixels / pixelsPerSecond);
}

/**
 * Quantizes time to the nearest frame boundary based on timeline FPS.
 */
export function quantizeToFrame(timeSeconds: number, fps: number = 30): number {
  if (!isFinite(timeSeconds)) return 0;
  const safeFps = Math.max(1, fps);
  return Math.round(timeSeconds * safeFps) / safeFps;
}

export interface SnapResult {
  snappedTime: number;
  didSnap: boolean;
  snapPoint?: number;
  distancePx?: number;
}

/**
 * Evaluates candidate points (clip edges, playhead, markers) and snaps time
 * if within pixel threshold.
 */
export function snapTimeToCandidates(
  timeSeconds: number,
  candidates: number[],
  pixelsPerSecond: number,
  thresholdPx: number = 8
): SnapResult {
  if (!isFinite(timeSeconds) || candidates.length === 0 || pixelsPerSecond <= 0) {
    return { snappedTime: timeSeconds, didSnap: false };
  }

  const thresholdSeconds = thresholdPx / pixelsPerSecond;
  let closestPoint: number | undefined;
  let minDiff = Infinity;

  for (const pt of candidates) {
    if (!isFinite(pt)) continue;
    const diff = Math.abs(timeSeconds - pt);
    if (diff <= thresholdSeconds && diff < minDiff) {
      minDiff = diff;
      closestPoint = pt;
    }
  }

  if (closestPoint !== undefined) {
    return {
      snappedTime: closestPoint,
      didSnap: true,
      snapPoint: closestPoint,
      distancePx: minDiff * pixelsPerSecond,
    };
  }

  return { snappedTime: timeSeconds, didSnap: false };
}

/**
 * Clamps clip trim boundaries ensuring positive, valid durations.
 */
export function clampTrimBoundaries(
  startOffset: number,
  endOffset: number,
  sourceDuration: number,
  minDuration: number = 0.1
): { startOffset: number; endOffset: number; duration: number } {
  const safeSource = Math.max(minDuration, isFinite(sourceDuration) ? sourceDuration : 5);
  let safeStart = Math.max(0, Math.min(safeSource - minDuration, isFinite(startOffset) ? startOffset : 0));
  let safeEnd = Math.max(safeStart + minDuration, Math.min(safeSource, isFinite(endOffset) ? endOffset : safeSource));

  if (safeEnd - safeStart < minDuration) {
    safeEnd = Math.min(safeSource, safeStart + minDuration);
    safeStart = Math.max(0, safeEnd - minDuration);
  }

  return {
    startOffset: safeStart,
    endOffset: safeEnd,
    duration: Math.max(minDuration, safeEnd - safeStart),
  };
}

/**
 * Calculates visible time window for viewport virtualization on long projects (30m - 2h+).
 */
export function calculateVisibleTimeWindow(
  scrollLeft: number,
  viewportWidth: number,
  pixelsPerSecond: number,
  bufferSeconds: number = 15
): { startSec: number; endSec: number } {
  if (pixelsPerSecond <= 0) return { startSec: 0, endSec: 300 };
  const startSec = Math.max(0, scrollLeft / pixelsPerSecond - bufferSeconds);
  const endSec = (scrollLeft + viewportWidth) / pixelsPerSecond + bufferSeconds;
  return { startSec, endSec };
}
