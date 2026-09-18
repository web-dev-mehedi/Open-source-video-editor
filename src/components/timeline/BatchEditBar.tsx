import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Layers, Volume2, Gauge, Copy, Trash2 } from 'lucide-react';

export const BatchEditBar: React.FC<{ selectedIds: string[]; onClear: () => void }> = ({ selectedIds, onClear }) => {
  const { batchSetVolume, batchSetSpeed, pasteClipAttributes, copiedAttributes, deleteMultipleTimelineItems } = useProject();
  const [vol, setVol] = useState(1);
  const [speed, setSpeed] = useState(1);
  if (selectedIds.length < 2) return null;
  return (
    <div className="flex items-center gap-2 bg-[#1e1e22] border border-[#27272a] rounded-lg px-2 py-1 text-xs">
      <span className="flex items-center gap-1 font-bold text-white"><Layers className="w-3 h-3 text-forge-cyan" />{selectedIds.length} selected</span>
      <div className="h-4 w-[1px] bg-[#27272a]" />
      <div className="flex items-center gap-1">
        <Volume2 className="w-3 h-3 text-gray-400" />
        <input type="range" min={0} max={2} step={0.1} value={vol} onChange={(e) => setVol(parseFloat(e.target.value))} className="w-16 accent-forge-cyan" />
        <button onClick={() => batchSetVolume(selectedIds, vol)} className="px-1.5 py-0.5 rounded bg-[#27272a] hover:bg-white/10 text-gray-200">Apply</button>
      </div>
      <div className="flex items-center gap-1">
        <Gauge className="w-3 h-3 text-gray-400" />
        <input type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-16 accent-forge-purple" />
        <button onClick={() => batchSetSpeed(selectedIds, speed)} className="px-1.5 py-0.5 rounded bg-[#27272a] hover:bg-white/10 text-gray-200">Apply</button>
      </div>
      {copiedAttributes && <button onClick={() => pasteClipAttributes(selectedIds)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-forge-purple text-white font-bold"><Copy className="w-3 h-3" />Paste Attr</button>}
      <button onClick={() => { deleteMultipleTimelineItems({ clipIds: selectedIds }); onClear(); }} className="p-1 rounded hover:bg-red-950/40 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
      <button onClick={onClear} className="text-gray-500 hover:text-white text-[10px]">Clear</button>
    </div>
  );
};
