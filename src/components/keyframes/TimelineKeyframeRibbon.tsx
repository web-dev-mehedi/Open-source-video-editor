import React from 'react';
import { VideoClip } from '../../types/project';
import { AnimatableProperty, KeyframePoint } from '../../types/keyframes';

interface TimelineKeyframeRibbonProps {
  clip: VideoClip;
  currentTime: number;
  pixelsPerSecond: number;
  onSelectKeyframeTime?: (timelineTime: number) => void;
}

export const TimelineKeyframeRibbon: React.FC<TimelineKeyframeRibbonProps> = ({
  clip,
  currentTime,
  pixelsPerSecond,
  onSelectKeyframeTime,
}) => {
  const keyframesState = clip.keyframes?.tracks;
  if (!keyframesState) return null;

  // Collect all unique keyframe times across all active tracks
  const keyframeMap = new Map<number, KeyframePoint[]>();

  for (const prop of Object.keys(keyframesState) as AnimatableProperty[]) {
    const track = keyframesState[prop];
    if (track?.keyframes) {
      for (const kf of track.keyframes) {
        const roundedTime = Math.round(kf.time * 100) / 100;
        const existing = keyframeMap.get(roundedTime) || [];
        existing.push(kf);
        keyframeMap.set(roundedTime, existing);
      }
    }
  }

  if (keyframeMap.size === 0) return null;

  const clipRelativeCurrent = currentTime - clip.timelineStart;

  return (
    <div className="absolute inset-x-0 bottom-0.5 h-3.5 pointer-events-auto flex items-center z-25 overflow-hidden">
      {Array.from(keyframeMap.entries()).map(([relTime, kfs]) => {
        const leftPercent = (relTime / Math.max(0.1, clip.timelineDuration)) * 100;
        const isCurrent = Math.abs(relTime - clipRelativeCurrent) <= 0.05;

        return (
          <div
            key={relTime}
            onClick={(e) => {
              e.stopPropagation();
              onSelectKeyframeTime?.(clip.timelineStart + relTime);
            }}
            style={{ left: `${leftPercent}%` }}
            className={`absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 rounded-[1px] cursor-pointer transition-all hover:scale-135 shadow ${
              isCurrent
                ? 'bg-forge-cyan border border-white ring-2 ring-forge-cyan shadow-[0_0_8px_#06B6D4] z-30 scale-120'
                : 'bg-amber-400/90 border border-black/80 hover:bg-amber-300 z-20'
            }`}
            title={`Keyframe at ${relTime.toFixed(2)}s (${kfs.length} properties animated)`}
          />
        );
      })}
    </div>
  );
};
