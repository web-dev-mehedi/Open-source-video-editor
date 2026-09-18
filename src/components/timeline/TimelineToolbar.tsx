import React, { useState } from 'react';
import {
  RotateCcw,
  RotateCw,
  MousePointer,
  Scissors,
  SquareChevronLeft,
  SquareChevronRight,
  Crop,
  Gauge,
  Snowflake,
  History,
  Layers,
  Scan,
  Trash2,
  Magnet,
  Link2,
  ZoomIn,
  ZoomOut,
  Clock,
  Plus,
  Mic,
  Maximize2,
  Minimize2,
  Split,
  FastForward,
} from 'lucide-react';
import { formatTimecode } from '../../utils/timecode';

export interface TimelineToolbarProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  activeTool: 'select' | 'razor' | 'crop';
  onSelectTool: (tool: 'select' | 'razor' | 'crop') => void;
  onSplit: () => void;
  onTrimLeft?: () => void;
  onTrimRight?: () => void;
  onCrop?: () => void;
  onSpeed?: () => void;
  onFreezeFrame?: () => void;
  onReverseClip?: () => void;
  onAddAdjustmentLayer?: () => void;
  onSceneDetect?: () => void;
  onDelete: () => void;
  hasSelection: boolean;
  selectionCount?: number;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  isMagnetMode: boolean;
  onToggleMagnet: () => void;
  isAutoRipple?: boolean;
  onToggleAutoRipple?: () => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onFitTimeline?: () => void;
  canSceneDetect?: boolean;
  canClipAction?: boolean;
  isCropping?: boolean;
  onImportMedia?: () => void;
  onRotateClip?: () => void;
  onVoiceoverRecord?: () => void;
  onToggleTrackLink?: () => void;
  isTrackLinked?: boolean;
  // Legacy compatibility callbacks
  onAddCaption?: () => void;
  onOpenMulticam?: () => void;
  onOpenSceneDetection?: () => void;
  onOpenHistory?: () => void;
  onOpenMacros?: () => void;
  onRollTrim?: () => void;
  onSlipTrim?: () => void;
  onSlideTrim?: () => void;
  onMatchDuration?: () => void;
  onBatchFade?: () => void;
  onCompoundClip?: () => void;
  onRemoveAllGaps?: () => void;
  onAddMarker?: () => void;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  activeTool,
  onSelectTool,
  onSplit,
  onTrimLeft,
  onTrimRight,
  onCrop,
  onSpeed,
  onFreezeFrame,
  onReverseClip,
  onAddAdjustmentLayer,
  onSceneDetect,
  onDelete,
  hasSelection,
  selectionCount = 0,
  currentTime,
  totalDuration,
  onSeek,
  isMagnetMode,
  onToggleMagnet,
  isAutoRipple = true,
  onToggleAutoRipple,
  zoomLevel,
  onZoomChange,
  onFitTimeline,
  canSceneDetect = true,
  canClipAction = false,
  isCropping = false,
  onImportMedia,
  onRotateClip,
  onVoiceoverRecord,
  onToggleTrackLink,
  isTrackLinked = true,
  onOpenSceneDetection,
}) => {
  const [isEditingTimecode, setIsEditingTimecode] = useState(false);
  const [timecodeInput, setTimecodeInput] = useState('');

  const handleTimecodeSubmit = () => {
    setIsEditingTimecode(false);
    if (!timecodeInput.trim()) return;
    const parts = timecodeInput.split(':').map(Number);
    if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
      const seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      onSeek(Math.max(0, Math.min(totalDuration, seconds)));
    } else {
      const num = parseFloat(timecodeInput);
      if (!isNaN(num)) onSeek(Math.max(0, Math.min(totalDuration, num)));
    }
  };

  const handleSceneDetectionTrigger = () => {
    if (onSceneDetect) onSceneDetect();
    else if (onOpenSceneDetection) onOpenSceneDetection();
  };

  return (
    <div className="h-10 w-full flex items-center justify-between px-3 bg-neutral-900 border-b border-neutral-800 select-none overflow-x-auto gap-2 flex-shrink-0 z-30 font-sans">
      {/* ─────────────────── LEFT CLUSTER: CAPCUT EDITING TOOLS ─────────────────── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* + Quick Import */}
        {onImportMedia && (
          <button
            onClick={onImportMedia}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors bg-forge-cyan/20 hover:bg-forge-cyan text-forge-cyan hover:text-black font-bold"
            title="Import Media (Ctrl+I)"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        )}

        {/* Undo / Redo */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="h-4 w-[1px] bg-neutral-800 mx-0.5" />

        {/* 1. Select Tool (V) */}
        <button
          onClick={() => onSelectTool('select')}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            activeTool === 'select' && !isCropping
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-xs'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Select Tool (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* 2. Split (Ctrl+B / S) */}
        <button
          onClick={() => {
            onSelectTool('razor');
            onSplit();
          }}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            activeTool === 'razor'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Split Clip at Playhead (S / Ctrl+B)"
        >
          <Scissors className="w-4 h-4" />
        </button>

        {/* 3. Delete Left to Playhead (Q) */}
        <button
          onClick={onTrimLeft}
          disabled={!canClipAction}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Trim / Ripple Delete Left to Playhead (Q)"
        >
          <SquareChevronLeft className="w-4 h-4" />
        </button>

        {/* 4. Delete Right to Playhead (W) */}
        <button
          onClick={onTrimRight}
          disabled={!canClipAction}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Trim / Ripple Delete Right to Playhead (W)"
        >
          <SquareChevronRight className="w-4 h-4" />
        </button>

        {/* 5. Delete (Del / Backspace) */}
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            hasSelection
              ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40'
              : 'text-neutral-600 disabled:opacity-30'
          }`}
          title="Delete Selected Clip (Del)"
        >
          <Trash2 className="w-4 h-4" />
          {selectionCount > 1 && (
            <span className="text-[9px] font-mono font-bold ml-0.5">{selectionCount}</span>
          )}
        </button>

        <div className="h-4 w-[1px] bg-neutral-800 mx-0.5" />

        {/* 6. Freeze Frame */}
        <button
          onClick={onFreezeFrame}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800"
          title="Freeze Frame at Playhead"
        >
          <Snowflake className="w-4 h-4" />
        </button>

        {/* 7. Reverse Clip */}
        <button
          onClick={onReverseClip}
          disabled={!canClipAction}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Reverse Clip Playback"
        >
          <History className="w-4 h-4" />
        </button>

        {/* 8. Crop Video (C) */}
        <button
          onClick={() => {
            if (onCrop) onCrop();
            onSelectTool('crop');
          }}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            isCropping || activeTool === 'crop'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-xs'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Interactive Crop (C)"
        >
          <Crop className="w-4 h-4" />
        </button>

        {/* 9. Rotate 90° */}
        {onRotateClip && (
          <button
            onClick={onRotateClip}
            disabled={!canClipAction}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Rotate Clip 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}

        {/* 10. Speed Control */}
        <button
          onClick={onSpeed}
          disabled={!canClipAction}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Clip Speed & Duration"
        >
          <Gauge className="w-4 h-4" />
        </button>

        {/* 11. Voiceover Record */}
        {onVoiceoverRecord && (
          <button
            onClick={onVoiceoverRecord}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-red-400 hover:bg-neutral-800"
            title="Record Voiceover"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}

        {/* 12. Adjustment Layer */}
        <button
          onClick={onAddAdjustmentLayer}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-purple-400 hover:bg-neutral-800"
          title="Add Adjustment Layer"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* 13. Scene Detect */}
        <button
          onClick={handleSceneDetectionTrigger}
          disabled={!canSceneDetect}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Auto Detect Scenes"
        >
          <Scan className="w-4 h-4" />
        </button>
      </div>

      {/* ─────────────────── CENTER CLUSTER: TIMECODE ─────────────────── */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-[11px] flex-shrink-0 shadow-inner">
        <Clock className="w-3.5 h-3.5 text-cyan-400" />
        {isEditingTimecode ? (
          <input
            type="text"
            value={timecodeInput}
            onChange={(e) => setTimecodeInput(e.target.value)}
            onBlur={handleTimecodeSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTimecodeSubmit();
              if (e.key === 'Escape') setIsEditingTimecode(false);
            }}
            placeholder="00:00:00"
            className="w-16 bg-neutral-800 text-cyan-400 px-1 rounded text-center outline-none border border-cyan-500 text-xs font-mono font-bold"
            autoFocus
          />
        ) : (
          <span
            onClick={() => {
              setTimecodeInput(formatTimecode(currentTime));
              setIsEditingTimecode(true);
            }}
            className="text-cyan-400 font-bold cursor-pointer hover:underline"
            title="Click to enter exact timecode or seek"
          >
            {formatTimecode(currentTime)}
          </span>
        )}
        <span className="text-neutral-600">/</span>
        <span className="text-neutral-400">{formatTimecode(totalDuration)}</span>
      </div>

      {/* ─────────────────── RIGHT CLUSTER: SNAPPING & ZOOM ─────────────────── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Snapping / Magnet (N) */}
        <button
          onClick={onToggleMagnet}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            isMagnetMode
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-xs'
              : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
          }`}
          title={isMagnetMode ? 'Timeline Snapping / Magnet ON (N)' : 'Timeline Snapping / Magnet OFF (N)'}
        >
          <Magnet className="w-4 h-4" />
        </button>

        {/* Auto Ripple Edit */}
        {onToggleAutoRipple && (
          <button
            onClick={onToggleAutoRipple}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              isAutoRipple
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-xs'
                : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
            }`}
            title={isAutoRipple ? 'Auto Ripple Edit ON' : 'Auto Ripple Edit OFF'}
          >
            <FastForward className="w-4 h-4" />
          </button>
        )}

        {/* Track Link */}
        {onToggleTrackLink && (
          <button
            onClick={onToggleTrackLink}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              isTrackLinked
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
            }`}
            title={isTrackLinked ? 'Track Link ON' : 'Track Link OFF'}
          >
            <Link2 className="w-4 h-4" />
          </button>
        )}

        {/* Fit Timeline to Screen / Overview */}
        {onFitTimeline && (
          <button
            onClick={onFitTimeline}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
            title="Fit Timeline to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="h-4 w-[1px] bg-neutral-800 mx-0.5" />

        {/* Zoom Out (-) */}
        <button
          onClick={() => onZoomChange(Math.max(0.005, Math.round((zoomLevel / 1.3) * 1000) / 1000))}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Range Slider */}
        <input
          type="range"
          min={0.01}
          max={6.0}
          step={0.01}
          value={Math.min(6.0, Math.max(0.01, zoomLevel))}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-20 accent-cyan-400 h-1 bg-neutral-800 rounded-lg cursor-pointer"
          title={`Timeline Zoom: ${(Math.max(0.2, zoomLevel * 40)).toFixed(1)}px/s`}
        />

        {/* Zoom In (+) */}
        <button
          onClick={() => onZoomChange(Math.min(6.25, Math.round((zoomLevel * 1.3) * 1000) / 1000))}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
