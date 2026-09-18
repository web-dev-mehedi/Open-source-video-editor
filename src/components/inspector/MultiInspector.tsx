import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Section } from './shared/Section';
import { NumberControl } from './shared/NumberControl';
import { Search } from 'lucide-react';

export const MultiInspector: React.FC = () => {
  const { project, batchUpdateClips, batchSetSpeed } = useProject();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const h = (e: any) => setIds(e.detail?.clipIds || []);
    window.addEventListener('cf_smart_select' as any, h);
    return () => window.removeEventListener('cf_smart_select' as any, h);
  }, []);
  const clips = (project?.clips || []).filter((c) => ids.includes(c.id));
  if (clips.length < 2) return <div className="p-4 text-xs text-gray-500">Select 2+ clips (Ctrl/Cmd+drag or Timeline marquee). Only shared properties will appear.</div>;
  const mixedOpacity = new Set(clips.map((c) => (c.transform?.opacity ?? 1))).size > 1;
  const mixedScale = new Set(clips.map((c) => (c.transform?.scale ?? 1))).size > 1;
  const mixedSpeed = new Set(clips.map((c) => c.speed)).size > 1;
  const [search, setSearch] = useState('');
  const matches = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase());
  return (
    <div className="flex flex-col h-full bg-[#121214]">
      <div className="p-2 border-b border-[#27272a]">
        <div className="text-xs font-bold text-white">{clips.length} clips selected</div>
        <div className="relative mt-1">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shared properties" className="w-full pl-7 pr-2 py-1 text-xs bg-[#18181c] border border-[#27272a] rounded text-gray-200" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {matches('transform') && (
          <Section title="Transform (Shared)" defaultOpen storageKey="multi_transform">
            <NumberControl label="Opacity" value={100} mixed={mixedOpacity} min={0} max={100} onChange={(v) => batchUpdateClips(ids, { transform: { opacity: v / 100 } } as any)} unit="%" />
            <NumberControl label="Scale" value={100} mixed={mixedScale} min={10} max={300} onChange={(v) => batchUpdateClips(ids, { transform: { scale: v / 100 } } as any)} unit="%" />
          </Section>
        )}
        {matches('speed') && (
          <Section title="Speed" storageKey="multi_speed">
            <NumberControl label="Speed" value={1} mixed={mixedSpeed} min={0.25} max={4} step={0.25} onChange={(v) => batchSetSpeed(ids, v)} unit="x" />
            <div className="text-[11px] text-gray-500">Use Batch bar for speed/volume.</div>
          </Section>
        )}
      </div>
    </div>
  );
};
