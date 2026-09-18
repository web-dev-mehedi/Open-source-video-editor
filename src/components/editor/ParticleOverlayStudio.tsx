import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { ParticleSystemConfig, ParticlePresetType, DEFAULT_PARTICLE_CONFIG } from '../../types/particleSystem';
import {
  Sparkles,
  Snowflake,
  Sun,
  Flame,
  RotateCcw,
  Sliders,
  Layers,
} from 'lucide-react';

export const ParticleOverlayStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Sparkles className="w-8 h-8 mb-2 opacity-40 text-amber-400" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip to add particle overlays</p>
      </div>
    );
  }

  const config: ParticleSystemConfig = (activeClip as any).particles || DEFAULT_PARTICLE_CONFIG;

  const handleUpdate = (updates: Partial<ParticleSystemConfig>) => {
    const newConfig: ParticleSystemConfig = { ...config, ...updates };
    updateClip(activeClip.id, { particles: newConfig } as any);
  };

  const handleReset = () => {
    updateClip(activeClip.id, { particles: DEFAULT_PARTICLE_CONFIG } as any);
  };

  const presets: { id: ParticlePresetType; label: string; icon: React.ReactNode }[] = [
    { id: 'dust_particles', label: 'Dust Motes', icon: <Sparkles className="w-4 h-4 text-amber-200" /> },
    { id: 'falling_snow', label: 'Snowfall', icon: <Snowflake className="w-4 h-4 text-sky-200" /> },
    { id: 'bokeh_orbs', label: 'Bokeh Orbs', icon: <Sun className="w-4 h-4 text-amber-400" /> },
    { id: 'golden_sparkles', label: 'Golden Glitter', icon: <Sparkles className="w-4 h-4 text-yellow-400" /> },
    { id: 'embers_fire', label: 'Fire Embers', icon: <Flame className="w-4 h-4 text-orange-500" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>GPU Particle Overlays</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Cinematic atmospheric dust, falling snow & bokeh
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Particles"
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
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-200 block">Particle Generator</span>
              <span className="text-[10px] text-gray-400">
                Overlay procedural particles in real time
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
                Particle Preset
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {presets.map((p) => {
                  const isSelected = config.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleUpdate({ preset: p.id })}
                      className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
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

            {/* Density Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Particle Count</span>
                <span className="font-mono text-amber-400">{config.density}</span>
              </div>
              <input
                type="range"
                min="10"
                max="250"
                value={config.density}
                onChange={(e) => handleUpdate({ density: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Speed Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Motion Speed</span>
                <span className="font-mono text-forge-cyan">{config.speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={config.speed}
                onChange={(e) => handleUpdate({ speed: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
              />
            </div>

            {/* Particle Color */}
            <div className="p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-200 block">Particle Color</span>
                <span className="text-[10px] text-gray-400">Glow & tint color</span>
              </div>
              <input
                type="color"
                value={config.color || '#FFFFFF'}
                onChange={(e) => handleUpdate({ color: e.target.value })}
                className="w-8 h-8 rounded border border-[#3f3f46] bg-[#121214] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
