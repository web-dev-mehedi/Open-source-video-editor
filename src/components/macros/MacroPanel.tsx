import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Play, Plus, Trash2, Zap } from 'lucide-react';

interface Macro { id: string; name: string; steps: string[]; }

const PRESET_MACROS: Macro[] = [
  { id: 'm1', name: 'Shorts Cleanup', steps: ['removeAllGaps', 'generateAutoMarkers', 'batchApplyTransition'] },
  { id: 'm2', name: 'Podcast Clip', steps: ['removeSilence', 'addMarker', 'saveVersion'] },
];

export const MacroPanel: React.FC = () => {
  const { removeAllGaps, generateAutoMarkers, batchApplyTransition, saveVersionSnapshot, project } = useProject();
  const [macros, setMacros] = useState<Macro[]>(() => {
    try { const raw = localStorage.getItem('cf_macros'); return raw ? JSON.parse(raw) : PRESET_MACROS; } catch { return PRESET_MACROS; }
  });
  const [newName, setNewName] = useState('');
  useEffect(() => { try { localStorage.setItem('cf_macros', JSON.stringify(macros)); } catch {} }, [macros]);

  const runMacro = (m: Macro) => {
    for (const step of m.steps) {
      if (step === 'removeAllGaps') removeAllGaps();
      if (step === 'generateAutoMarkers') generateAutoMarkers();
      if (step === 'batchApplyTransition') batchApplyTransition('crossfade', 0.4);
      if (step === 'saveVersion') saveVersionSnapshot(`Macro: ${m.name}`);
    }
  };

  return (
    <div className="p-2 space-y-2 bg-[#121214] border border-[#27272a] rounded-lg">
      <div className="flex items-center gap-1 text-xs font-bold text-white"><Zap className="w-3.5 h-3.5 text-amber-400" />Macros — one-click workflows</div>
      <div className="space-y-1 max-h-[180px] overflow-y-auto">
        {macros.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-1.5 rounded bg-[#18181c] border border-[#27272a] text-xs">
            <div>
              <div className="font-bold text-gray-200">{m.name}</div>
              <div className="text-[10px] text-gray-500">{m.steps.join(' → ')}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => runMacro(m)} className="p-1 rounded bg-forge-cyan text-black hover:brightness-110"><Play className="w-3 h-3" /></button>
              <button onClick={() => setMacros((prev) => prev.filter((x) => x.id !== m.id))} className="p-1 rounded hover:bg-red-950/40 text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New macro name" className="flex-1 px-2 py-1 text-xs bg-[#1a1a1e] border border-[#27272a] rounded text-gray-200" />
        <button onClick={() => { if (!newName.trim()) return; setMacros((prev) => [...prev, { id: `m_${Date.now()}`, name: newName.trim(), steps: ['removeAllGaps', 'generateAutoMarkers'] }]); setNewName(''); }} className="px-2 py-1 rounded bg-[#27272a] text-xs text-gray-200 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
      </div>
      <p className="text-[10px] text-gray-500">Macros are non-destructive and use undo history — safe to run.</p>
    </div>
  );
};
