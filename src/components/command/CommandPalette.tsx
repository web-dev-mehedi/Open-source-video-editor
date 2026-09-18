import React, { useEffect, useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { registerCommands, searchCommands, EditorCommand } from '../../utils/commandRegistry';
import { Search, Command, X } from 'lucide-react';

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const {
    splitClipAtPlayhead,
    deleteClip,
    selectedClipId,
    undo,
    redo,
    toggleMagnetMode,
    isMagnetMode,
    addMarker,
    currentTime,
    setCurrentTime,
    project,
    freezeFrameAtPlayhead,
    reverseClip,
    generateAutoMarkers,
    removeAllGaps,
    batchApplyTransition,
    saveVersionSnapshot,
  } = useProject();
  const [q, setQ] = useState('');

  useEffect(() => {
    const cmds: EditorCommand[] = [
      { id: 'cmd_split', title: 'Split Clip at Playhead', keywords: ['split', 'cut', 's'], category: 'edit', action: () => splitClipAtPlayhead(), shortcut: 'S' },
      { id: 'cmd_delete', title: 'Delete Selected Clip', keywords: ['delete', 'remove'], category: 'edit', action: () => selectedClipId && deleteClip(selectedClipId), shortcut: 'Del', enabled: () => !!selectedClipId },
      { id: 'cmd_undo', title: 'Undo', keywords: ['undo'], category: 'edit', action: () => undo(), shortcut: 'Ctrl+Z' },
      { id: 'cmd_redo', title: 'Redo', keywords: ['redo'], category: 'edit', action: () => redo(), shortcut: 'Ctrl+Y' },
      { id: 'cmd_magnet', title: isMagnetMode ? 'Disable Magnetic Timeline' : 'Enable Magnetic Timeline', keywords: ['magnet', 'snap'], category: 'timeline', action: () => toggleMagnetMode(), shortcut: 'N' },
      { id: 'cmd_marker', title: 'Add Marker at Playhead', keywords: ['marker', 'add'], category: 'marker', action: () => addMarker({ time: currentTime, name: `Marker ${Math.round(currentTime * 10) / 10}s`, color: 'cyan', type: 'custom' }) },
      { id: 'cmd_goto_start', title: 'Go to Start', keywords: ['start', 'home'], category: 'view', action: () => setCurrentTime(0), shortcut: 'Home' },
      { id: 'cmd_goto_end', title: 'Go to End', keywords: ['end'], category: 'view', action: () => setCurrentTime(project?.metadata.duration || 0), shortcut: 'End' },
      { id: 'cmd_freeze', title: 'Freeze Frame at Playhead', keywords: ['freeze', 'still'], category: 'clip', action: () => freezeFrameAtPlayhead(), shortcut: 'F' },
      { id: 'cmd_reverse', title: 'Reverse Selected Clip', keywords: ['reverse'], category: 'clip', action: () => selectedClipId && reverseClip(selectedClipId), enabled: () => !!selectedClipId },
      { id: 'cmd_automarker', title: 'Generate Auto Markers', keywords: ['auto', 'marker'], category: 'marker', action: () => generateAutoMarkers() },
      { id: 'cmd_removegaps', title: 'Remove All Gaps', keywords: ['gap', 'remove'], category: 'timeline', action: () => removeAllGaps() },
      { id: 'cmd_batch_transition', title: 'Batch Apply Fade to All Cuts', keywords: ['transition', 'batch'], category: 'timeline', action: () => batchApplyTransition('crossfade', 0.5) },
      { id: 'cmd_savever', title: 'Save Version Snapshot', keywords: ['version', 'save'], category: 'view', action: () => saveVersionSnapshot() },
    ];
    registerCommands(cmds);
  }, [splitClipAtPlayhead, deleteClip, selectedClipId, undo, redo, toggleMagnetMode, isMagnetMode, addMarker, currentTime, setCurrentTime, project, freezeFrameAtPlayhead, reverseClip, generateAutoMarkers, removeAllGaps, batchApplyTransition, saveVersionSnapshot]);

  const results = useMemo(() => searchCommands(q), [q]);

  useEffect(() => {
    if (!isOpen) setQ('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#27272a]">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search commands — e.g. 'Ripple Delete', 'Freeze Frame', 'Add Marker'..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">No commands found</div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => { if (c.enabled && !c.enabled()) return; c.action(); onClose(); }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-white/5 text-xs ${c.enabled && !c.enabled() ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'}`}
              >
                <span className="flex items-center gap-2"><Command className="w-3 h-3 text-gray-500" />{c.title}</span>
                {c.shortcut && <span className="text-[10px] font-mono text-gray-500 border border-[#27272a] px-1 rounded">{c.shortcut}</span>}
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-[#27272a] text-[10px] text-gray-500 flex items-center justify-between">
          <span>Ctrl/Cmd+K to open • ESC to close</span>
          <span>{results.length} commands</span>
        </div>
      </div>
    </div>
  );
};
