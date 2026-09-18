import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Search, X } from 'lucide-react';

export const TimelineSearch: React.FC<{ onNavigate: (time: number) => void }> = ({ onNavigate }) => {
  const { project } = useProject();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim() || !project) return [];
    const s = q.toLowerCase();
    const clips = project.clips.filter((c) => c.name.toLowerCase().includes(s)).map((c) => ({ type: 'Clip', name: c.name, time: c.timelineStart }));
    const caps = project.captions.filter((c) => c.text.toLowerCase().includes(s)).map((c) => ({ type: 'Caption', name: c.text.slice(0, 30), time: c.start }));
    const markers = (project.markers || []).filter((m) => m.name.toLowerCase().includes(s) || m.type.toLowerCase().includes(s)).map((m) => ({ type: 'Marker', name: m.name, time: m.time }));
    return [...clips, ...caps, ...markers].slice(0, 12);
  }, [q, project]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1 bg-[#121214] border border-[#27272a] rounded-lg px-2 py-1">
        <Search className="w-3.5 h-3.5 text-gray-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search timeline — clip, caption, marker..." className="bg-transparent text-xs text-gray-200 placeholder-gray-500 focus:outline-none w-40 sm:w-56" />
        {q && <button onClick={() => setQ('')} className="text-gray-500 hover:text-white"><X className="w-3 h-3" /></button>}
      </div>
      {q && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 w-72 bg-[#18181c] border border-[#27272a] rounded-lg shadow-2xl z-20 max-h-56 overflow-y-auto">
          {results.map((r, i) => (
            <button key={i} onClick={() => { onNavigate(r.time); setQ(''); }} className="w-full text-left px-2.5 py-1.5 hover:bg-white/5 flex items-center justify-between text-xs">
              <span><span className="text-[10px] font-mono text-gray-500 mr-1">[{r.type}]</span>{r.name}</span>
              <span className="text-[10px] font-mono text-gray-500">{r.time.toFixed(2)}s</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
