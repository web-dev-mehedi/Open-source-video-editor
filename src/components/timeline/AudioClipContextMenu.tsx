import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Scissors,
  Trash2,
  Files,
  Sparkles,
  VolumeX,
  Volume2,
  Volume1,
  Activity,
  Music,
} from 'lucide-react';

interface AudioClipContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  clipName: string;
  isMuted?: boolean;
  volume?: number;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onRemoveSilence: () => void;
  onEnhanceAudio: () => void;
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
}

export const AudioClipContextMenu: React.FC<AudioClipContextMenuProps> = ({
  x,
  y,
  clipName,
  isMuted,
  volume = 1.0,
  onClose,
  onCopy,
  onCut,
  onDelete,
  onDuplicate,
  onSplit,
  onRemoveSilence,
  onEnhanceAudio,
  onToggleMute,
  onSetVolume,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click (capture phase) or escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('contextmenu', handleMouseDown, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('contextmenu', handleMouseDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Viewport bounds adjustment
  const menuWidth = 260;
  const menuHeight = 380;
  const clampedX = Math.min(Math.max(8, x), window.innerWidth - menuWidth - 12);
  const clampedY =
    y + menuHeight > window.innerHeight
      ? Math.max(12, y - menuHeight)
      : Math.max(12, y);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        zIndex: 99999, // Strictly above player controls
      }}
      className="w-64 bg-neutral-900/98 backdrop-blur-2xl border border-neutral-800 shadow-2xl rounded-xl py-1.5 px-1 text-xs text-gray-200 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Info */}
      <div className="px-2.5 py-1.5 mb-1 border-b border-neutral-800 text-[11px] font-mono flex items-center justify-between">
        <div className="flex items-center gap-1.5 truncate max-w-[180px]">
          <Music className="w-3.5 h-3.5 text-forge-cyan flex-shrink-0" />
          <span className="truncate text-gray-200 font-semibold">{clipName || 'Audio Track'}</span>
        </div>
        <span className="text-[9px] text-forge-cyan font-bold bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 rounded uppercase">
          Audio
        </span>
      </div>

      {/* AI Audio Smart Actions */}
      <div className="py-1">
        <button
          onClick={() => {
            onRemoveSilence();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-forge-cyan/20 hover:text-forge-cyan text-forge-cyan transition-colors font-medium"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Detect & Remove Silence</span>
          </div>
          <span className="text-[10px] px-1 py-0.5 rounded bg-forge-cyan/20 text-forge-cyan font-mono">
            AI Cut
          </span>
        </button>

        <button
          onClick={() => {
            onEnhanceAudio();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Voice Enhance & Denoise</span>
          </div>
          <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
            Clean
          </span>
        </button>
      </div>

      <div className="h-[1px] bg-neutral-800 my-1" />

      {/* Standard Edit Operations */}
      <div className="py-0.5">
        <button
          onClick={() => {
            onSplit();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-white/10 text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-gray-400" />
            <span>Split Audio at Playhead</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">Ctrl+B</span>
        </button>

        <button
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-white/10 text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-gray-400" />
            <span>Copy</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">Ctrl+C</span>
        </button>

        <button
          onClick={() => {
            onCut();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-white/10 text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-gray-400" />
            <span>Cut</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">Ctrl+X</span>
        </button>

        <button
          onClick={() => {
            onDuplicate();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-white/10 text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Files className="w-3.5 h-3.5 text-gray-400" />
            <span>Duplicate Audio</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">Ctrl+D</span>
        </button>
      </div>

      <div className="h-[1px] bg-neutral-800 my-1" />

      {/* Volume & Mute Controls */}
      <div className="py-0.5">
        <button
          onClick={() => {
            onToggleMute();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-white/10 text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            {isMuted ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isMuted ? 'Unmute Track' : 'Mute Track'}</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">M</span>
        </button>

        {/* Volume Presets */}
        <div className="px-2.5 py-1 flex items-center justify-between text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <Volume1 className="w-3 h-3 text-gray-500" />
            Level:
          </span>
          <div className="flex items-center gap-1 font-mono">
            {[0.5, 1.0, 1.5, 2.0].map((v) => (
              <button
                key={v}
                onClick={() => {
                  onSetVolume(v);
                  onClose();
                }}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  Math.abs(volume - v) < 0.05
                    ? 'bg-forge-cyan text-black font-bold'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-gray-300'
                }`}
              >
                {Math.round(v * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[1px] bg-neutral-800 my-1" />

      {/* Delete Operation */}
      <div className="pt-0.5">
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Delete Track</span>
          </div>
          <span className="text-[10px] text-red-400 font-mono">Del</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
