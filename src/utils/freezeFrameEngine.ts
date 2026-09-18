import { VideoClip } from '../types/project';

/**
 * Split clip and insert a static Freeze Frame segment
 */
export function insertFreezeFrame(
  clips: VideoClip[],
  activeClipId: string,
  currentTime: number,
  freezeDuration: number = 2.0
): VideoClip[] {
  const clipIndex = clips.findIndex((c) => c.id === activeClipId);
  if (clipIndex === -1) return clips;

  const clip = clips[clipIndex];
  if (currentTime <= clip.timelineStart || currentTime >= clip.timelineStart + clip.timelineDuration) {
    return clips;
  }

  const offsetInClip = (currentTime - clip.timelineStart) * (clip.speed || 1.0);
  const part1Duration = currentTime - clip.timelineStart;
  const part2Duration = clip.timelineDuration - part1Duration;

  const clipPart1: VideoClip = {
    ...clip,
    id: `${clip.id}-p1`,
    timelineDuration: part1Duration,
    endOffset: clip.startOffset + offsetInClip,
  };

  const freezeClip: VideoClip = {
    ...clip,
    id: `freeze-${Date.now()}`,
    name: `Freeze Frame (${freezeDuration}s)`,
    startOffset: clip.startOffset + offsetInClip,
    endOffset: clip.startOffset + offsetInClip + 0.04,
    timelineStart: currentTime,
    timelineDuration: freezeDuration,
    speed: 0.001, // Near static
  };

  const clipPart2: VideoClip = {
    ...clip,
    id: `${clip.id}-p2`,
    timelineStart: currentTime + freezeDuration,
    timelineDuration: part2Duration,
    startOffset: clip.startOffset + offsetInClip,
  };

  const updatedClips = [...clips];
  updatedClips.splice(clipIndex, 1, clipPart1, freezeClip, clipPart2);

  // Shift subsequent clips by freezeDuration
  for (let i = clipIndex + 3; i < updatedClips.length; i++) {
    if ((updatedClips[i].trackIndex || 1) === (clip.trackIndex || 1)) {
      updatedClips[i] = {
        ...updatedClips[i],
        timelineStart: updatedClips[i].timelineStart + freezeDuration,
      };
    }
  }

  return updatedClips;
}
