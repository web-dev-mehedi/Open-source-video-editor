import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Scissors,
  Trash2,
  FileAudio,
  Sliders,
  Split,
  MessageSquareText,
  Wand2,
  Snowflake,
  RotateCcw,
  CopyCheck,
  Layers,
  Bookmark,
  Mic,
  UserCheck,
  Download,
  Eye,
  EyeOff,
  ChevronRight,
} from 'lucide-react';

interface ClipContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  clipName: string;
  isMuted?: boolean;
  isDeactivated?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onSplitScenes: () => void;
  onExtractAudio: () => void;
  onRemoveSilence: () => void;
  onEnhanceAudio: () => void;
  onEnhanceVisuals: () => void;
  onAdjustColor: () => void;
  onToggleMute: () => void;
  onGenerateCaptions: () => void;
  onFreeze?: () => void;
  onReverse?: () => void;
  onCopyAttributes?: () => void;
  onPasteAttributes?: () => void;
  onCreateCompound?: () => void;
  onReplaceMedia?: () => void;
  onAddMarker?: () => void;
  onToggleDeactivate?: () => void;
  onExportClip?: () => void;
}

export const ClipContextMenu: React.FC<ClipContextMenuProps> = ({
  x,
  y,
  clipName,
  isMuted,
  isDeactivated = false,
  onClose,
  onCopy,
  onCut,
  onDelete,
  onDuplicate,
  onSplit,
  onSplitScenes,
  onExtractAudio,
  onRemoveSilence,
  onEnhanceAudio,
  onEnhanceVisuals,
  onAdjustColor,
  onToggleMute,
  onGenerateCaptions,
  onFreeze,
  onReverse,
  onCopyAttributes,
  onPasteAttributes,
  onCreateCompound,
  onReplaceMedia,
  onAddMarker,
  onToggleDeactivate,
  onExportClip,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

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

  // Viewport Collision & Clamping Logic (Never clipped by screen bottom or right edge)
  const menuWidth = 260;
  const menuHeight = 440;
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
        zIndex: 99999, // Strictly above all video player playback controls, toolbars, and inspector
      }}
      className="w-[260px] bg-neutral-900/98 backdrop-blur-2xl border border-neutral-800 shadow-2xl rounded-xl py-1.5 px-1 text-xs text-gray-200 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Clean Unbranded Header (No CAPCUT PRO branding) */}
      <div className="px-2.5 py-1.5 mb-1 border-b border-neutral-800 text-[11px] flex items-center justify-between">
        <span className="truncate max-w-[170px] font-semibold text-gray-200" title={clipName}>
          {clipName || 'Video Clip'}
        </span>
        <span className="text-[9px] text-forge-cyan font-mono font-bold bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
          Clip
        </span>
      </div>

      {/* ────────────────── SECTION 1: CLIPBOARD & HISTORY ────────────────── */}
      <div className="space-y-0.5 pb-1 mb-1 border-b border-neutral-800/80">
        <button
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
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
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-gray-400" />
            <span>Cut</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">Ctrl+X</span>
        </button>

        {onPasteAttributes && (
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('attributes')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <button
              onClick={() => {
                onPasteAttributes();
                onClose();
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <CopyCheck className="w-3.5 h-3.5 text-gray-400" />
                <span>Paste Attributes</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500 font-mono">Ctrl+Shift+V</span>
                <ChevronRight className="w-3 h-3 text-gray-500" />
              </div>
            </button>

            {/* Flyout Submenu */}
            {activeSubmenu === 'attributes' && (
              <div className="absolute left-[98%] top-0 w-44 bg-neutral-900 border border-neutral-800 shadow-2xl rounded-xl py-1 px-1 z-[100000] animate-in fade-in duration-100">
                <button
                  onClick={() => {
                    onPasteAttributes();
                    onClose();
                  }}
                  className="w-full px-2 py-1 text-left hover:bg-white/10 rounded text-[11px] text-gray-300 hover:text-white"
                >
                  Apply All Attributes
                </button>
                <button
                  onClick={() => {
                    onCopyAttributes?.();
                    onClose();
                  }}
                  className="w-full px-2 py-1 text-left hover:bg-white/10 rounded text-[11px] text-gray-300 hover:text-white"
                >
                  Copy Attributes (Ctrl+Alt+C)
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-red-500/20 text-red-300 hover:text-red-200 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Delete</span>
          </div>
          <span className="text-[10px] text-red-400/80 font-mono">Del</span>
        </button>
      </div>

      {/* ────────────────── SECTION 2: CORE EDITING & AI ────────────────── */}
      <div className="space-y-0.5 pb-1 mb-1 border-b border-neutral-800/80">
        <button
          onClick={() => {
            onSplitScenes();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Split className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Split Scenes</span>
          </div>
          <span className="px-1 py-0.2 rounded bg-forge-cyan/20 border border-forge-cyan/40 text-[9px] text-forge-cyan font-bold uppercase">
            Free
          </span>
        </button>

        <button
          onClick={() => {
            onGenerateCaptions();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-3.5 h-3.5 text-amber-400" />
            <span>Transcript & AI Captions</span>
          </div>
          <span className="text-[9px] text-amber-400 font-bold uppercase">AI</span>
        </button>

        <button
          onClick={() => {
            onExtractAudio();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileAudio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Extract Audio</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">Ctrl+Shift+S</span>
        </button>

        <button
          onClick={() => {
            onEnhanceAudio();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Isolate Voice / Denoise</span>
          </div>
        </button>

        <button
          onClick={() => {
            onEnhanceVisuals();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-pink-400" />
            <span>Remove Background / Cutout</span>
          </div>
        </button>

        <button
          onClick={() => {
            onAdjustColor();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>Adjust Color / Color Match</span>
          </div>
        </button>
      </div>

      {/* ────────────────── SECTION 3: GROUPING & COMPOUND ────────────────── */}
      <div className="space-y-0.5 pb-1 mb-1 border-b border-neutral-800/80">
        {onCreateCompound && (
          <button
            onClick={() => {
              onCreateCompound();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Create Compound Clip</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Alt+G</span>
          </button>
        )}

        {onAddMarker && (
          <button
            onClick={() => {
              onAddMarker();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Marker</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">M</span>
          </button>
        )}
      </div>

      {/* ────────────────── SECTION 4: CLIP STATE & EXPORT ────────────────── */}
      <div className="space-y-0.5">
        <button
          onClick={() => {
            if (onToggleDeactivate) onToggleDeactivate();
            else onToggleMute();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            {isDeactivated ? (
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span>{isDeactivated ? 'Enable Clip' : 'Deactivate Clip'}</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">V</span>
        </button>

        {onFreeze && (
          <button
            onClick={() => {
              onFreeze();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
              <span>Freeze Frame</span>
            </div>
          </button>
        )}

        {onReverse && (
          <button
            onClick={() => {
              onReverse();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
              <span>Reverse Clip</span>
            </div>
          </button>
        )}

        <button
          onClick={() => {
            if (onExportClip) onExportClip();
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 flex items-center justify-between text-gray-200 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-gray-400" />
            <span>Export Selected Clip</span>
          </div>
          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-[9px] text-amber-300 font-bold">
            HD
          </span>
        </button>
      </div>
    </div>,
    document.body
  );
};
