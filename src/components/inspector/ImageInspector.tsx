import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Section } from './shared/Section';
import { NumberControl } from './shared/NumberControl';
import { QuickActions } from './shared/QuickActions';
import { Search, Crop, Layers, Sparkles, Move } from 'lucide-react';
import { ClipEffectsInspector } from '../editor/ClipEffectsInspector';

export const ImageInspector: React.FC = () => {
  const { project, selectedOverlayId, selectedClipId, updateClipTransform, updateOverlay } = useProject();
  const overlay = project?.overlays.find((o) => o.id === selectedOverlayId);
  const clip = project?.clips.find((c) => c.id === selectedClipId);
  const target = overlay || clip;
  const [search, setSearch] = useState('');
  const matches = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase());
  if (!target) return <div className="p-4 text-xs text-gray-500">Select an image. Only image controls appear.</div>;
  const isOverlay = !!overlay;
  const transform = (target as any).transform || { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 };
  const handleTransform = (updates: any) => {
    if (isOverlay) updateOverlay(overlay!.id, { ...overlay!, ...updates } as any);
    else updateClipTransform((target as any).id, updates);
  };
  return (
    <div className="flex flex-col h-full bg-[#121214]">
      <div className="p-2 border-b border-[#27272a]">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search — transform, crop, opacity" className="w-full pl-7 pr-2 py-1 text-xs bg-[#18181c] border border-[#27272a] rounded text-gray-200" />
        </div>
      </div>
      <QuickActions actions={[{ label: 'Transform', icon: Move, onClick: () => {} }, { label: 'Crop', icon: Crop, onClick: () => {} }, { label: 'Effects', icon: Sparkles, onClick: () => {} }]} />
      <div className="flex-1 overflow-y-auto">
        {matches('transform') && (
          <Section title="Transform" defaultOpen storageKey="image_transform">
            <NumberControl label="X" value={transform.xPercent ?? 0} min={-100} max={100} onChange={(v) => handleTransform({ xPercent: v })} unit="%" />
            <NumberControl label="Y" value={transform.yPercent ?? 0} min={-100} max={100} onChange={(v) => handleTransform({ yPercent: v })} unit="%" />
            <NumberControl label="Scale" value={Math.round((transform.scale ?? 1) * 100)} min={10} max={300} onChange={(v) => handleTransform({ scale: v / 100 })} unit="%" />
            <NumberControl label="Rotation" value={transform.rotation ?? 0} min={-180} max={180} onChange={(v) => handleTransform({ rotation: v })} unit="°" />
          </Section>
        )}
        {matches('crop') && (
          <Section title="Crop" storageKey="image_crop">
            <div className="text-[11px] text-gray-500">Fit/Fill via Scale. Use Mask for precise crop.</div>
          </Section>
        )}
        {matches('opacity') && (
          <Section title="Opacity" storageKey="image_opacity">
            <NumberControl label="Opacity" value={Math.round((transform.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => handleTransform({ opacity: v / 100 })} unit="%" />
          </Section>
        )}
        {matches('effects') && (
          <Section title="Effects" storageKey="image_effects">
            <ClipEffectsInspector />
          </Section>
        )}
        {matches('animation') && (
          <Section title="Animation" storageKey="image_anim">
            <div className="text-[11px] text-gray-500">Entrance/Exit via Motion Graphics. Select overlay to animate.</div>
          </Section>
        )}
      </div>
    </div>
  );
};
