import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  AudioDuckingConfig,
  DEFAULT_AUDIO_DUCKING,
  calculateMusicDuckingGain,
} from '../../utils/audioDuckingEngine';
import { Slider } from '../common/Slider';
import { Volume2, VolumeX, Mic, Music, Sparkles, Activity, ShieldCheck } from 'lucide-react';

export const AudioDuckingPanel: React.FC = () => {
  const { project, currentTime, updateAudioClip } = useProject();

  const [duckingConfig, setDuckingConfig] = useState<AudioDuckingConfig>(DEFAULT_AUDIO_DUCKING);

  // Compute live ducking gain for preview meter
  const liveGain = calculateMusicDuckingGain(project, currentTime, duckingConfig);
  const liveGainPercent = Math.round(liveGain * 100);
  const isDuckingActive = liveGain < 0.95;

  const handleUpdate = (updates: Partial<AudioDuckingConfig>) => {
    setDuckingConfig((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="space-y-4 p-4 bg-[#141416] rounded-2xl border border-[#27272a] text-gray-200 select-none text-xs">
      {/* Header with Enable Switch */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Music className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-white text-xs block">Automatic Audio Ducking</span>
            <span className="text-[10px] text-gray-400 block">Lowers BGM volume when voice speaks</span>
          </div>
        </div>

        <button
          onClick={() => handleUpdate({ enabled: !duckingConfig.enabled })}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow-sm ${
            duckingConfig.enabled
              ? 'bg-emerald-500 text-black font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)]'
              : 'bg-[#202024] text-gray-400 border border-white/5'
          }`}
        >
          {duckingConfig.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Live Ducking Status & Meter HUD */}
      {duckingConfig.enabled && (
        <div className="p-3 bg-[#0d0d10] rounded-xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-forge-cyan" />
              <span>Live Music Level</span>
            </span>
            <span className={`font-mono font-bold ${isDuckingActive ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isDuckingActive ? `Ducking (${liveGainPercent}%)` : '100% (Full Volume)'}
            </span>
          </div>

          {/* Dynamic Meter Bar */}
          <div className="h-2 bg-[#202024] rounded-full overflow-hidden flex items-center">
            <div
              style={{ width: `${liveGainPercent}%` }}
              className={`h-full rounded-full transition-all duration-150 ${
                isDuckingActive ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </div>
        </div>
      )}

      {/* Ducking Controls */}
      {duckingConfig.enabled && (
        <div className="space-y-3 pt-1">
          <Slider
            label="Ducking Depth (Music Reduction)"
            value={duckingConfig.duckAmountDb}
            min={-30}
            max={-6}
            step={1}
            unit=" dB"
            onChange={(v) => handleUpdate({ duckAmountDb: v })}
          />

          <Slider
            label="Attack (Fade Down Speed)"
            value={duckingConfig.attackMs}
            min={50}
            max={500}
            step={10}
            unit=" ms"
            onChange={(v) => handleUpdate({ attackMs: v })}
          />

          <Slider
            label="Release (Fade Up Speed)"
            value={duckingConfig.releaseMs}
            min={200}
            max={2000}
            step={50}
            unit=" ms"
            onChange={(v) => handleUpdate({ releaseMs: v })}
          />
        </div>
      )}
    </div>
  );
};
