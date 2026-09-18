import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { TimelineMarker } from '../../types/markers';

export const MarkerTrack: React.FC<{ pixelsPerSecond: number; totalWidth: number }> = ({ pixelsPerSecond, totalWidth }) => {
  const { markers, setCurrentTime, deleteMarker } = useProject();
  if (markers.length === 0) return null;
  return (
    <div style={{ width: totalWidth }} className="h-6 bg-[#18181c] border-b border-[#27272a] relative flex-shrink-0">
      <div className="absolute left-2 top-0 bottom-0 flex items-center text-[9px] font-mono text-gray-500">MARKERS</div>
      {markers.map((m: TimelineMarker) => (
        <div
          key={m.id}
          style={{ left: m.time * pixelsPerSecond }}
          className="absolute top-1 bottom-1 flex items-center group cursor-pointer"
          onClick={() => setCurrentTime(m.time)}
          onDoubleClick={() => deleteMarker(m.id)}
          title={`${m.name} @ ${m.time.toFixed(2)}s • ${m.type} • double-click to delete`}
        >
          <div className={`w-3 h-3 rotate-45 border ${m.color === 'red' ? 'bg-red-500 border-red-300' : m.color === 'amber' ? 'bg-amber-400 border-amber-200' : m.color === 'emerald' ? 'bg-emerald-500 border-emerald-300' : m.color === 'violet' ? 'bg-violet-500 border-violet-300' : 'bg-cyan-400 border-cyan-200'} shadow`} />
          <span className="ml-1 text-[9px] font-bold text-gray-300 bg-black/60 px-1 rounded hidden group-hover:block whitespace-nowrap">{m.name}</span>
        </div>
      ))}
    </div>
  );
};
