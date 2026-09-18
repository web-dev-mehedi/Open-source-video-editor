import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Layers, Zap, Snowflake, RotateCcw, Package, Timer, Film, Wand2, Copy, Bookmark } from 'lucide-react';

export const AdvancedToolsBar: React.FC = () => {
  const {
    selectedClipId,
    rollTrim,
    slipTrim,
    slideTrim,
    freezeFrameAtPlayhead,
    reverseClip,
    matchClipDuration,
    batchApplyTransition,
    saveEffectPreset,
    applyEffectPreset,
    savedEffectPresets,
    createCompoundClip,
    addOverlay,
    currentTime,
    project,
  } = useProject();
  const [presetName, setPresetName] = useState('');
  if (!project) return null;
  const hasSelection = !!selectedClipId;
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-[#0e0e10] border-b border-[#27272a] overflow-x-auto no-scrollbar text-[11px]">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Advanced</span>
      <button onClick={() => hasSelection && rollTrim(selectedClipId!, 0.2)} disabled={!hasSelection} className="px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300 hover:text-white disabled:opacity-30">Roll +0.2</button>
      <button onClick={() => hasSelection && slipTrim(selectedClipId!, 0.2)} disabled={!hasSelection} className="px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300 hover:text-white disabled:opacity-30">Slip</button>
      <button onClick={() => hasSelection && slideTrim(selectedClipId!, 0.3)} disabled={!hasSelection} className="px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300 hover:text-white disabled:opacity-30">Slide</button>
      <div className="w-[1px] h-4 bg-[#27272a] mx-1" />
      <button onClick={() => freezeFrameAtPlayhead(1.2)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/40"><Snowflake className="w-3 h-3" />Freeze</button>
      <button onClick={() => hasSelection && reverseClip(selectedClipId!)} disabled={!hasSelection} className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300 hover:text-white disabled:opacity-30"><RotateCcw className="w-3 h-3" />Reverse</button>
      <button onClick={() => {
        const ids = project.clips.map((c) => c.id);
        if (ids.length >= 2) matchClipDuration(ids[0], ids[1]);
      }} className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300"><Timer className="w-3 h-3" />Match Dur</button>
      <div className="w-[1px] h-4 bg-[#27272a] mx-1" />
      <button onClick={() => batchApplyTransition('crossfade', 0.5)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/30 border border-amber-800 text-amber-300"><Film className="w-3 h-3" />Batch Fade</button>
      <button onClick={() => hasSelection && saveEffectPreset(presetName || 'My Preset', selectedClipId!)} disabled={!hasSelection} className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/30 border border-purple-800 text-purple-300 disabled:opacity-30"><Wand2 className="w-3 h-3" />Save FX</button>
      {savedEffectPresets.length > 0 && (
        <select onChange={(e) => { const v = e.target.value; if (v && hasSelection) applyEffectPreset(v, [selectedClipId!]); }} defaultValue="" className="px-1 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300 text-[11px]">
          <option value="">Apply FX Preset…</option>
          {savedEffectPresets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      )}
      <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" className="w-20 px-1 py-0.5 rounded bg-[#121214] border border-[#27272a] text-gray-300 text-[11px] placeholder-gray-600" />
      <div className="w-[1px] h-4 bg-[#27272a] mx-1" />
      <button onClick={() => addOverlay({ type: 'text' as any, name: 'Adjustment Layer', timelineStart: currentTime, timelineDuration: 3, x: 50, y: 50, scale: 1, opacity: 1 } as any)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300"><Layers className="w-3 h-3" />Adj Layer</button>
      <button onClick={() => {
        const allIds = project.clips.slice(0, 2).map((c) => c.id);
        if (allIds.length >= 2) createCompoundClip(allIds);
      }} className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#27272a] text-gray-300"><Package className="w-3 h-3" />Compound</button>
    </div>
  );
};
