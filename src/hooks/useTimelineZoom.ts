import { useState, useCallback } from 'react';
import { getActiveContentDuration } from '../utils/timelineDuration';
import { ProjectData, VideoClip } from '../types/project';

/**
 * Deep Timeline Zoom Configuration
 * 
 * Supports scaling from long-form multi-hour projects down to frame-by-frame cuts.
 */
export const ZOOM_CONFIG = {
  MIN_ZOOM: 0.2,    // 1 hour = 720px width (view entire 2-3 hour long-form timeline)
  MAX_ZOOM: 250.0,  // 1 frame = ~8px (precise frame-accurate cutting)
  DEFAULT_ZOOM: 25.0,
};

/**
 * Calculates optimal zoom scale (pixels per second) to fit the entire timeline inside the visible window.
 */
export function calculateFitZoom(
  containerWidth: number,
  projectOrClips: ProjectData | VideoClip[] | any,
  headerWidth = 160,
  padding = 60
): number {
  const contentDuration = getActiveContentDuration(projectOrClips);
  const maxTime = Math.max(5, contentDuration); // Minimum 5s baseline

  const availableWidth = Math.max(300, containerWidth - headerWidth - padding);
  const targetZoom = availableWidth / maxTime;

  return Math.min(
    ZOOM_CONFIG.MAX_ZOOM,
    Math.max(ZOOM_CONFIG.MIN_ZOOM, Math.round(targetZoom * 100) / 100)
  );
}

export function useTimelineZoom(initialZoom = ZOOM_CONFIG.DEFAULT_ZOOM) {
  const [zoomLevel, setZoomLevelState] = useState<number>(initialZoom);

  const setZoomLevel = useCallback((zoom: number) => {
    const clamped = Math.min(ZOOM_CONFIG.MAX_ZOOM, Math.max(ZOOM_CONFIG.MIN_ZOOM, zoom));
    setZoomLevelState(Math.round(clamped * 100) / 100);
  }, []);

  const zoomIn = useCallback((step = 1.25) => {
    setZoomLevelState((prev) =>
      Math.min(ZOOM_CONFIG.MAX_ZOOM, Math.round(prev * step * 100) / 100)
    );
  }, []);

  const zoomOut = useCallback((step = 1.25) => {
    setZoomLevelState((prev) =>
      Math.max(ZOOM_CONFIG.MIN_ZOOM, Math.round((prev / step) * 100) / 100)
    );
  }, []);

  const fitToScreen = useCallback(
    (containerWidth: number, projectOrClips: any, headerWidth = 160) => {
      const fitZoom = calculateFitZoom(containerWidth, projectOrClips, headerWidth);
      setZoomLevelState(fitZoom);
      return fitZoom;
    },
    []
  );

  return {
    zoomLevel,
    setZoomLevel,
    zoomIn,
    zoomOut,
    fitToScreen,
    minZoom: ZOOM_CONFIG.MIN_ZOOM,
    maxZoom: ZOOM_CONFIG.MAX_ZOOM,
  };
}
