import React, { useRef } from 'react';
import { formatTimecode } from '../../utils/timecode';

interface TimelineRulerProps {
  totalDuration: number;
  currentTime?: number;
  zoomLevel: number;
  pixelsPerSecond: number;
  totalWidth: number;
  onSeek: (time: number) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = React.memo(({
  totalDuration,
  zoomLevel,
  pixelsPerSecond,
  totalWidth,
  onSeek,
}) => {
  const rulerRef = useRef<HTMLDivElement | null>(null);

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    const ruler = rulerRef.current;
    if (!ruler) return;

    const rect = ruler.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = Math.max(0, Math.min(totalDuration, clickX / pixelsPerSecond));
    onSeek(clickedTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveX = moveEvent.clientX - rect.left;
      const movedTime = Math.max(0, Math.min(totalDuration, moveX / pixelsPerSecond));
      onSeek(movedTime);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Dynamically determine majorTickInterval based on pixelsPerSecond so ticks are spaced ~60-120px apart
  let majorTickInterval = 1; // seconds
  const targetPxInterval = 80;
  const rawInterval = targetPxInterval / Math.max(0.2, pixelsPerSecond);

  if (rawInterval >= 300) {
    majorTickInterval = 600; // 10 minutes
  } else if (rawInterval >= 150) {
    majorTickInterval = 300; // 5 minutes
  } else if (rawInterval >= 60) {
    majorTickInterval = 120; // 2 minutes
  } else if (rawInterval >= 30) {
    majorTickInterval = 60; // 1 minute
  } else if (rawInterval >= 15) {
    majorTickInterval = 30; // 30 seconds
  } else if (rawInterval >= 8) {
    majorTickInterval = 10; // 10 seconds
  } else if (rawInterval >= 3) {
    majorTickInterval = 5; // 5 seconds
  } else if (rawInterval >= 1.5) {
    majorTickInterval = 2; // 2 seconds
  } else if (rawInterval >= 0.8) {
    majorTickInterval = 1; // 1 second
  } else if (rawInterval >= 0.3) {
    majorTickInterval = 0.5; // 0.5s
  } else {
    majorTickInterval = 0.1; // 0.1s
  }

  const totalMajorTicks = Math.ceil(totalDuration / majorTickInterval) + 3;

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleRulerMouseDown}
      style={{ width: `${totalWidth}px` }}
      className="h-7 bg-canvas-surface border-b border-canvas-border relative select-none cursor-pointer flex-shrink-0"
    >
      {/* Major and Minor Ticks */}
      {Array.from({ length: totalMajorTicks }).map((_, i) => {
        const time = i * majorTickInterval;
        if (time > totalDuration + 5) return null;
        const left = time * pixelsPerSecond;

        return (
          <div key={i} style={{ left: `${left}px` }} className="absolute bottom-0 flex flex-col items-start pointer-events-none">
            <span className="text-[9px] font-mono text-gray-400 pl-1 -top-5 absolute select-none">
              {formatTimecode(time, false)}
            </span>
            <div className="w-[1px] h-3 bg-canvas-border" />
          </div>
        );
      })}
    </div>
  );
});

