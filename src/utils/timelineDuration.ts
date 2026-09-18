/**
 * Active Content Duration & Boundary Engine (src/utils/timelineDuration.ts)
 * 
 * Provides deterministic active content boundary calculation for timelines and export pipelines.
 * Prevents trailing black screen, frozen frames, and trailing silence by computing the exact
 * latest timestamp across active video clips, audio tracks, and captions.
 */

import { ProjectData, VideoClip, AudioClip } from '../types/project';
import { CaptionLine } from '../types/caption';

export interface TimelineTracksContainer {
  clips?: VideoClip[];
  audioClips?: AudioClip[];
  captions?: CaptionLine[];
  tracks?: Array<{ isHidden?: boolean; clips?: Array<{ end?: number; timelineStart?: number; timelineDuration?: number }> }>;
}

/**
 * Calculates the exact active content duration of a project, track collection, or clip list.
 */
export function getActiveContentDuration(
  input: ProjectData | VideoClip[] | TimelineTracksContainer | null | undefined
): number {
  if (!input) return 0;

  let clips: VideoClip[] = [];
  let audioClips: AudioClip[] = [];
  let captions: CaptionLine[] = [];

  if (Array.isArray(input)) {
    clips = input;
  } else {
    clips = input.clips || [];
    audioClips = input.audioClips || [];
    captions = input.captions || [];

    // Support nested tracks if provided
    const tracks = (input as any).tracks;
    if (tracks && Array.isArray(tracks)) {
      for (const track of tracks) {
        if (!track.isHidden && track.clips) {
          for (const c of track.clips) {
            const end = c.end ?? ((c.timelineStart ?? 0) + (c.timelineDuration ?? 0));
            if (isFinite(end) && end > 0) {
              clips.push({ timelineStart: c.timelineStart || 0, timelineDuration: c.timelineDuration || (c.end || 0) } as any);
            }
          }
        }
      }
    }
  }

  let maxEnd = 0;

  // 1. Video & Image Clips
  for (const c of clips) {
    const end = (c.timelineStart ?? 0) + (c.timelineDuration ?? 0);
    if (isFinite(end) && end > maxEnd) {
      maxEnd = end;
    }
  }

  // 2. Dedicated Audio Clips
  for (const a of audioClips) {
    const end = (a.timelineStart ?? 0) + (a.timelineDuration ?? 0);
    if (isFinite(end) && end > maxEnd) {
      maxEnd = end;
    }
  }

  // 3. Captions
  for (const cap of captions) {
    const end = cap.end ?? (cap as any).endTime ?? 0;
    if (isFinite(end) && end > maxEnd) {
      maxEnd = end;
    }
  }

  return Math.max(0, Math.round(maxEnd * 1000) / 1000);
}
