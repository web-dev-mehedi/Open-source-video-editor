import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CaptionLine } from '../../types/caption';
import { MessageSquareText, Copy, Scissors, Trash2, Sparkles, ChevronRight } from 'lucide-react';
import { formatTimecode } from '../../utils/timecode';

interface CaptionTrackProps {
  captions: CaptionLine[];
  selectedCaptionId: string | null;
  selectedCaptionIds?: string[];
  currentTime: number;
  pixelsPerSecond: number;
  totalWidth: number;
  isLocked?: boolean;
  isHidden?: boolean;
  onSelectCaption: (id: string) => void;
  onTrimCaption: (id: string, start: number, end: number) => void;
  onMoveCaption?: (id: string, newStart: number) => void;
  onSplitCaption?: (id: string) => void;
  onDuplicateCaption?: (id: string) => void;
  onDeleteCaption?: (id: string) => void;
  onCloseGap?: (gapStart: number) => void;
  visibleStartSeconds?: number;
  visibleEndSeconds?: number;
}

export const CaptionTrack: React.FC<CaptionTrackProps> = React.memo(({
  captions,
  selectedCaptionId,
  selectedCaptionIds = [],
  currentTime,
  pixelsPerSecond,
  totalWidth,
  isLocked = false,
  isHidden = false,
  visibleStartSeconds,
  visibleEndSeconds,
  onSelectCaption,
  onTrimCaption,
  onMoveCaption,
  onSplitCaption,
  onDuplicateCaption,
  onDeleteCaption,
  onCloseGap,
}) => {
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    type: 'move' | 'trim-start' | 'trim-end';
    start: number;
    end: number;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    caption: CaptionLine;
  } | null>(null);

  // Close context menu on outside click (capture phase) or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('mousedown', handleOutside, true);
    window.addEventListener('contextmenu', handleOutside, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleOutside, true);
      window.removeEventListener('contextmenu', handleOutside, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Handle Dragging Caption Block to Move
  const handleBlockMouseDown = (e: React.MouseEvent, cap: CaptionLine) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelectCaption(cap.id);
    if (isLocked) return;

    const startClientX = e.clientX;
    const initialStart = cap.start;
    const dur = cap.end - cap.start;
    let currentStart = initialStart;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startClientX) / pixelsPerSecond;
      let rawStart = Math.max(0, initialStart + deltaSec);

      // Snap to 0s and other caption edges
      const snapThreshold = 8 / pixelsPerSecond;
      if (Math.abs(rawStart) < snapThreshold) rawStart = 0;
      for (const other of captions) {
        if (other.id === cap.id) continue;
        if (Math.abs(rawStart - other.end) < snapThreshold) rawStart = other.end;
        if (Math.abs(rawStart + dur - other.start) < snapThreshold) rawStart = Math.max(0, other.start - dur);
      }

      currentStart = Math.round(rawStart * 100) / 100;
      setActiveDrag({
        id: cap.id,
        type: 'move',
        start: currentStart,
        end: currentStart + dur,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setActiveDrag(null);
      if (onMoveCaption && Math.abs(currentStart - initialStart) > 0.02) {
        onMoveCaption(cap.id, currentStart);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Handle Left Trim Handle (Start)
  const handleTrimStartMouseDown = (e: React.MouseEvent, cap: CaptionLine) => {
    if (e.button !== 0 || isLocked) return;
    e.stopPropagation();
    onSelectCaption(cap.id);

    const startClientX = e.clientX;
    const initialStart = cap.start;
    let currentStart = initialStart;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startClientX) / pixelsPerSecond;
      const rawStart = Math.max(0, Math.min(cap.end - 0.2, initialStart + deltaSec));
      currentStart = Math.round(rawStart * 100) / 100;

      setActiveDrag({
        id: cap.id,
        type: 'trim-start',
        start: currentStart,
        end: cap.end,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setActiveDrag(null);
      if (Math.abs(currentStart - initialStart) > 0.02) {
        onTrimCaption(cap.id, currentStart, cap.end);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Handle Right Trim Handle (End)
  const handleTrimEndMouseDown = (e: React.MouseEvent, cap: CaptionLine) => {
    if (e.button !== 0 || isLocked) return;
    e.stopPropagation();
    onSelectCaption(cap.id);

    const startClientX = e.clientX;
    const initialEnd = cap.end;
    let currentEnd = initialEnd;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startClientX) / pixelsPerSecond;
      const rawEnd = Math.max(cap.start + 0.2, initialEnd + deltaSec);
      currentEnd = Math.round(rawEnd * 100) / 100;

      setActiveDrag({
        id: cap.id,
        type: 'trim-end',
        start: cap.start,
        end: currentEnd,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setActiveDrag(null);
      if (Math.abs(currentEnd - initialEnd) > 0.02) {
        onTrimCaption(cap.id, cap.start, currentEnd);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleContextMenu = (e: React.MouseEvent, cap: CaptionLine) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectCaption(cap.id);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      caption: cap,
    });
  };

  return (
    <div
      style={{ width: `${totalWidth}px` }}
      className={`h-12 bg-[#17171a]/50 border-b border-canvas-border relative select-none flex-shrink-0 ${
        isHidden ? 'opacity-40 grayscale-30' : ''
      }`}
    >
      {/* Virtualized Caption Blocks */}
      {captions
        .filter((cap) => {
          if (visibleStartSeconds === undefined || visibleEndSeconds === undefined) return true;
          const isSelected = cap.id === selectedCaptionId || selectedCaptionIds.includes(cap.id);
          if (isSelected) return true;
          const isDragging = activeDrag?.id === cap.id;
          const start = isDragging ? activeDrag.start : cap.start;
          const end = isDragging ? activeDrag.end : cap.end;
          return end >= visibleStartSeconds && start <= visibleEndSeconds;
        })
        .map((cap) => {
        const isDragging = activeDrag?.id === cap.id;
        const effectiveStart = isDragging ? activeDrag.start : cap.start;
        const effectiveEnd = isDragging ? activeDrag.end : cap.end;
        const duration = Math.max(0.1, effectiveEnd - effectiveStart);

        const isSelected = cap.id === selectedCaptionId || selectedCaptionIds.includes(cap.id);
        const isSpoken = currentTime >= effectiveStart && currentTime <= effectiveEnd;
        const left = effectiveStart * pixelsPerSecond;
        const width = Math.max(34, duration * pixelsPerSecond);

        return (
          <div
            key={cap.id}
            onMouseDown={(e) => handleBlockMouseDown(e, cap)}
            onContextMenu={(e) => handleContextMenu(e, cap)}
            style={{
              left: `${left}px`,
              width: `${width}px`,
              zIndex: isDragging ? 35 : isSelected ? 20 : 10,
            }}
            className={`absolute top-1.5 bottom-1.5 rounded-lg border flex items-center justify-between px-2.5 transition-shadow group select-none ${
              isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
            } ${
              isDragging
                ? 'opacity-85 ring-2 ring-forge-cyan bg-cyan-950/90 shadow-2xl scale-[1.01]'
                : isSelected
                ? 'border-forge-cyan bg-[#0e2229] text-white ring-2 ring-forge-cyan shadow-lg shadow-cyan-950/60 font-bold'
                : isSpoken
                ? 'border-purple-400/80 bg-purple-950/60 text-purple-100 font-semibold shadow-md'
                : 'border-[#3f3f46]/80 bg-[#1c1c20] text-gray-200 hover:border-gray-400'
            }`}
            title={`"${cap.text}" (${duration.toFixed(2)}s)${isLocked ? ' [LOCKED]' : ''}`}
          >
            {/* Left Trim Handle */}
            {!isLocked && (
              <div
                onMouseDown={(e) => handleTrimStartMouseDown(e, cap)}
                className="absolute left-0 top-0 bottom-0 w-2.5 bg-forge-cyan/40 hover:bg-forge-cyan cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-l flex items-center justify-center z-25"
                title="Drag to trim start time"
              >
                <div className="w-0.5 h-3 bg-white/80 rounded" />
              </div>
            )}

            {/* Content Text & Duration Tag */}
            <div className="flex items-center gap-1.5 truncate max-w-[85%] pointer-events-none">
              <MessageSquareText className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-forge-cyan' : isSpoken ? 'text-purple-400' : 'text-gray-400'}`} />
              <span className="text-[11px] font-medium truncate tracking-tight">{cap.text}</span>
            </div>

            {/* Duration Tag */}
            <span className="text-[9px] font-mono text-gray-400 bg-black/40 px-1 py-0.5 rounded flex-shrink-0 ml-1 pointer-events-none">
              {duration.toFixed(1)}s
            </span>

            {/* Right Trim Handle */}
            <div
              onMouseDown={(e) => handleTrimEndMouseDown(e, cap)}
              className="absolute right-0 top-0 bottom-0 w-2.5 bg-forge-cyan/40 hover:bg-forge-cyan cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r flex items-center justify-center z-25"
              title="Drag to trim end time"
            >
              <div className="w-0.5 h-3 bg-white/80 rounded" />
            </div>
          </div>
        );
      })}

      {/* Right Click Context Menu */}
      {contextMenu &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
              top: `${contextMenu.y + 180 > window.innerHeight ? Math.max(12, contextMenu.y - 180) : contextMenu.y}px`,
              zIndex: 99999,
            }}
            className="w-48 bg-neutral-900/98 border border-neutral-800 rounded-xl shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100 select-none backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-neutral-800 truncate">
              Caption ({contextMenu.caption.text.slice(0, 15)}...)
            </div>

            <button
              onClick={() => {
                onSplitCaption?.(contextMenu.caption.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between transition-colors text-gray-200 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-forge-purple" />
                <span>Split at Playhead</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">S</span>
            </button>

            <button
              onClick={() => {
                onDuplicateCaption?.(contextMenu.caption.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between transition-colors text-gray-200 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-forge-cyan" />
                <span>Duplicate</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">Ctrl+D</span>
            </button>

            <div className="h-[1px] bg-neutral-800 my-1" />

            <button
              onClick={() => {
                onDeleteCaption?.(contextMenu.caption.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Delete</span>
              </span>
              <span className="text-[10px] text-red-400 font-mono">Del</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
});

