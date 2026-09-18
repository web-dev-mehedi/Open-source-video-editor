/**
 * Timeline Clip Creation & Auto-Expansion Engine (src/store/useTimelineStore.ts)
 * 
 * Provides atomic clip construction from raw media assets, preserving 100% full duration
 * and calculating dynamic timeline bounds.
 */

import { VideoClip, MediaAsset } from '../types/project';

export interface TimelineClipOptions {
  trackIndex?: number;
  startTime?: number;
  speed?: number;
  volume?: number;
}

/**
 * Creates a timeline clip with 100% full untruncated duration from raw media asset.
 */
export function createTimelineClipFromAsset(
  asset: MediaAsset | { id: string; name: string; duration: number; filePath: string; liveUrl?: string; mediaBlobUrl?: string; width?: number; height?: number; fps?: number; thumbnailUrl?: string; mediaType?: 'video' | 'audio' | 'image' },
  targetTrackIndex: number = 1,
  startTime: number = 0
): VideoClip {
  const clipDuration = Math.max(0.1, asset.duration || 5.0);

  return {
    id: `clip_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    mediaId: asset.id,
    name: (asset as any).name || (asset as any).fileName || 'Media',
    filePath: asset.filePath,
    originalFilePath: asset.filePath,
    mediaBlobUrl: (asset as any).liveUrl || (asset as any).mediaBlobUrl,
    
    // Full source media boundaries
    duration: clipDuration,
    startOffset: 0,
    endOffset: clipDuration,

    // Timeline placement
    trackIndex: targetTrackIndex,
    timelineStart: Math.max(0, startTime),
    timelineDuration: clipDuration,

    speed: 1.0,
    volume: 1.0,
    isMuted: false,
    width: asset.width || 1920,
    height: asset.height || 1080,
    fps: asset.fps || 30,
    thumbnailUrl: asset.thumbnailUrl,
    mediaType: (asset as any).mediaType || 'video',
    transform: { scale: 1, xPercent: 0, yPercent: 0, rotation: 0, opacity: 1 },
    crop: { top: 0, bottom: 0, left: 0, right: 0 },
  };
}

/**
 * Calculates total dynamic timeline duration ensuring long-form media (e.g., 30+ minutes)
 * is fully navigable without truncating.
 */
export function calculateTimelineAutoExpansion(
  clips: VideoClip[] = [],
  audioClips: any[] = [],
  captions: any[] = [],
  baseDuration: number = 15
): number {
  let maxEnd = baseDuration;
  for (const c of clips) {
    maxEnd = Math.max(maxEnd, (c.timelineStart || 0) + (c.timelineDuration || 0));
  }
  for (const a of audioClips) {
    maxEnd = Math.max(maxEnd, (a.timelineStart || 0) + (a.timelineDuration || 0));
  }
  for (const cap of captions) {
    maxEnd = Math.max(maxEnd, cap.end || cap.endTime || 0);
  }
  return Math.max(5, maxEnd);
}
