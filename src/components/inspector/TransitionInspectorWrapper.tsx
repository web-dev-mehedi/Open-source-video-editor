import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Section } from './shared/Section';
import { NumberControl } from './shared/NumberControl';
import { QuickActions } from './shared/QuickActions';
import { Search } from 'lucide-react';
import { TransitionInspector } from '../editor/TransitionInspector';

export const TransitionInspectorWrapper: React.FC = () => {
  const { selectedTransitionId, project, updateTransition } = useProject();
  const [search, setSearch] = useState('');
  const trans = project?.transitions?.find((t) => t.id === selectedTransitionId);
  const matches = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase());
  if (!trans) return <div className="p-4 text-xs text-gray-500">Select a transition on the timeline. Only transition controls appear.</div>;
  return (
    <div className="flex flex-col h-full bg-[#121214]">
      <div className="p-2 border-b border-[#27272a]">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search — duration, direction, easing" className="w-full pl-7 pr-2 py-1 text-xs bg-[#18181c] border border-[#27272a] rounded text-gray-200" />
        </div>
      </div>
      <QuickActions actions={[{ label: 'Preview', onClick: () => {} }]} />
      <div className="flex-1 overflow-y-auto">
        {matches('transition') && (
          <Section title="Transition" defaultOpen storageKey="trans_main">
            <div className="text-[11px] text-gray-400">Type: <span className="text-white font-bold">{trans.type}</span></div>
            <NumberControl label="Duration" value={trans.duration} min={0.1} max={3} step={0.1} onChange={(v) => updateTransition(trans.id, { duration: v })} unit="s" />
            <div className="text-[11px] text-gray-500">Direction, intensity etc. via preset.</div>
            <TransitionInspector />
          </Section>
        )}
        {matches('advanced') && (
          <Section title="Advanced" storageKey="trans_adv">
            <div className="text-[11px] text-gray-500">Easing: {trans.easing || 'easeInOut'}</div>
          </Section>
        )}
      </div>
    </div>
  );
};
