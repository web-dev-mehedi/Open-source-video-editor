import { TrackedTarget, TrackPoint } from '../types/objectTracking';

/**
 * Interpolate the 2D position, scale, and rotation of a tracked object at timelineTime
 */
export function interpolateTrackedPosition(
  target?: TrackedTarget | null,
  timelineTime: number = 0
): { x: number; y: number; scale: number; rotation: number } | null {
  if (!target || !target.enabled || !target.trackPoints || target.trackPoints.length === 0) {
    return null;
  }

  const sorted = [...target.trackPoints].sort((a, b) => a.time - b.time);

  // Before first point
  if (timelineTime <= sorted[0].time) {
    return {
      x: sorted[0].x + (target.offsetX || 0),
      y: sorted[0].y + (target.offsetY || 0),
      scale: sorted[0].scale || 1.0,
      rotation: sorted[0].rotation || 0,
    };
  }

  // After last point
  if (timelineTime >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1];
    return {
      x: last.x + (target.offsetX || 0),
      y: last.y + (target.offsetY || 0),
      scale: last.scale || 1.0,
      rotation: last.rotation || 0,
    };
  }

  // Interpolate between bounding track points
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];

    if (timelineTime >= p1.time && timelineTime <= p2.time) {
      const interval = p2.time - p1.time;
      if (interval <= 0.0001) {
        return {
          x: p1.x + (target.offsetX || 0),
          y: p1.y + (target.offsetY || 0),
          scale: p1.scale || 1.0,
          rotation: p1.rotation || 0,
        };
      }

      const t = (timelineTime - p1.time) / interval;
      // Hermite smooth interpolation
      const smoothT = t * t * (3 - 2 * t);

      const interpX = p1.x + (p2.x - p1.x) * smoothT + (target.offsetX || 0);
      const interpY = p1.y + (p2.y - p1.y) * smoothT + (target.offsetY || 0);
      const interpScale = (p1.scale || 1.0) + ((p2.scale || 1.0) - (p1.scale || 1.0)) * smoothT;
      const interpRot = (p1.rotation || 0) + ((p2.rotation || 0) - (p1.rotation || 0)) * smoothT;

      return {
        x: Math.round(interpX * 10) / 10,
        y: Math.round(interpY * 10) / 10,
        scale: Math.round(interpScale * 100) / 100,
        rotation: Math.round(interpRot * 10) / 10,
      };
    }
  }

  return null;
}
