import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Section } from './shared/Section';
import { NumberControl } from './shared/NumberControl';
import { ToggleControl } from './shared/ToggleControl';
import { QuickActions } from './shared/QuickActions';
import { Search, Volume2, Gauge, Sparkles, Activity } from 'lucide-react';
import { AudioFilterStudio } from '../audio/AudioFilterStudio';

export const AudioInspector: React.FC = () => {
  const { project, selectedAudioClipId, updateAudioClip, deleteAudioClip, setAudioVolume, toggleAudioMute } = useProject();
  const [search, setSearch] = useState('');
  const clip = project?.audioClips?.find((c) => c.id === selectedAudioClipId) || project?.clips.find((c) => c.id === selectedAudioClipId) as any;
  const matches = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase());
  if (!clip) return <div className="p-4 text-xs text-gray-500">Select an audio clip. Only audio controls will appear.</div>;
  return (
    <div className="flex flex-col h-full bg-[#121214]">
      <div className="p-2 border-b border-[#27272a]">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search — volume, fade, ducking" className="w-full pl-7 pr-2 py-1 text-xs bg-[#18181c] border border-[#27272a] rounded text-gray-200" />
        </div>
      </div>
      <QuickActions actions={[
        { label: 'Volume', icon: Volume2, onClick: () => {} },
        { label: 'Fade', icon: Activity, onClick: () => {} },
        { label: 'Enhance', icon: Sparkles, onClick: () => {} },
      ]} />
      <div className="flex-1 overflow-y-auto">
        {matches('audio') && (
          <Section title="Audio" defaultOpen storageKey="audio_main">
            <NumberControl label="Volume" value={Math.round((clip.volume ?? 1) * 100)} min={0} max={200} onChange={(v) => setAudioVolume ? setAudioVolume(clip.id, v / 100) : updateAudioClip(clip.id, { volume: v / 100 } as any)} unit="%" />
            <ToggleControl label="Mute" value={!!clip.isMuted} onChange={() => toggleAudioMute ? toggleAudioMute(clip.id) : updateAudioClip(clip.id, { isMuted: !clip.isMuted } as any)} />
          </Section>
        )}
        {matches('fade') && (
          <Section title="Fade" storageKey="audio_fade">
            <NumberControl label="Fade in" value={(clip as any).fadeIn ?? 0} min={0} max={5} step={0.1} onChange={(v) => updateAudioClip(clip.id, { fadeIn: v } as any)} unit="s" />
            <NumberControl label="Fade out" value={(clip as any).fadeOut ?? 0} min={0} max={5} step={0.1} onChange={(v) => updateAudioClip(clip.id, { fadeOut: v } as any)} unit="s" />
          </Section>
        )}
        {matches('speed') && (
          <Section title="Speed" storageKey="audio_speed">
            <NumberControl label="Speed" value={clip.speed ?? 1} min={0.25} max={4} step={0.25} onChange={(v) => updateAudioClip(clip.id, { speed: v } as any)} unit="x" />
          </Section>
        )}
        {matches('enhancement') && (
          <Section title="Enhancement" storageKey="audio_enh">
            <AudioFilterStudio />
          </Section>
        )}
        {matches('ducking') && (
          <Section title="Ducking" storageKey="audio_duck">
            <div className="text-[11px] text-gray-500">Auto ducking lowers music when voice is active. Use Audio → Ducking controls.</div>
          </Section>
        )}
        {matches('waveform') && (
          <Section title="Waveform" storageKey="audio_wave">
            <ToggleControl label="Show waveform" value={true} onChange={() => {}} description="Waveform visibility is always on for selected audio." />
          </Section>
        )}
        <div className="p-2">
          <button onClick={() => deleteAudioClip(clip.id)} className="w-full px-2 py-1 rounded bg-red-950/40 border border-red-900 text-xs text-red-300">Delete Audio Clip</button>
        </div>
      </div>
    </div>
  );
};
