import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { VoiceChangerConfig, VoicePresetType, DEFAULT_VOICE_CHANGER_CONFIG } from '../../types/voiceChanger';
import {
  Mic2,
  Bot,
  Volume2,
  Sparkles,
  RotateCcw,
  Radio,
  Sliders,
  AudioWaveform,
} from 'lucide-react';

export const VoiceChangerStudio: React.FC = () => {
  const { project, selectedAudioClipId, selectedClipId, updateClip } = useProject();

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Mic2 className="w-8 h-8 mb-2 opacity-40 text-amber-400" />
        <p className="font-semibold text-gray-300">No Audio/Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip to apply voice effects</p>
      </div>
    );
  }

  const config: VoiceChangerConfig = (activeClip as any).voiceChanger || DEFAULT_VOICE_CHANGER_CONFIG;

  const handleUpdate = (updates: Partial<VoiceChangerConfig>) => {
    const newConfig: VoiceChangerConfig = { ...config, ...updates };
    updateClip(activeClip.id, { voiceChanger: newConfig } as any);
  };

  const handleReset = () => {
    updateClip(activeClip.id, { voiceChanger: DEFAULT_VOICE_CHANGER_CONFIG } as any);
  };

  const presets: { id: VoicePresetType; label: string; icon: React.ReactNode }[] = [
    { id: 'none', label: 'Original', icon: <Volume2 className="w-4 h-4 opacity-40" /> },
    { id: 'chipmunk', label: 'Chipmunk', icon: <span className="text-xs">🐿️</span> },
    { id: 'deep_voice', label: 'Deep Voice', icon: <span className="text-xs">🎙️</span> },
    { id: 'robot', label: 'Robot', icon: <Bot className="w-4 h-4 text-forge-cyan" /> },
    { id: 'megaphone', label: 'Megaphone', icon: <Radio className="w-4 h-4 text-amber-400" /> },
    { id: 'studio_reverb', label: 'Studio Reverb', icon: <AudioWaveform className="w-4 h-4 text-emerald-400" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Mic2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Voice Changer & FX</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Pitch scaling, robot modulation & space reverb
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Voice FX"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f23] border border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Mic2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-200 block">Voice Effect</span>
              <span className="text-[10px] text-gray-400">
                Transform vocal tone and pitch
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.isEnabled}
            onChange={(e) => handleUpdate({ isEnabled: e.target.checked })}
            className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-amber-400 focus:ring-amber-400 cursor-pointer"
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Presets Grid */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Voice Presets
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {presets.map((p) => {
                  const isSelected = config.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleUpdate({ preset: p.id })}
                      className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/40 text-white ring-1 ring-amber-400 shadow-sm'
                          : 'border-[#27272a] bg-[#1f1f23] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                    >
                      {p.icon}
                      <span className="truncate w-full text-center">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pitch Shift Semitones Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Pitch Shift (Semitones)</span>
                <span className="font-mono text-amber-400">
                  {config.pitchSemitones > 0 ? `+${config.pitchSemitones}` : config.pitchSemitones} st
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                value={config.pitchSemitones}
                onChange={(e) => handleUpdate({ pitchSemitones: parseInt(e.target.value, 10), preset: 'none' })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Reverb Mix Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Space Reverb Mix</span>
                <span className="font-mono text-forge-purple">{config.reverbMix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.reverbMix}
                onChange={(e) => handleUpdate({ reverbMix: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
