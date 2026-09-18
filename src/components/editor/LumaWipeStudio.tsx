import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { LumaWipeConfig, LumaMattePresetType, DEFAULT_LUMA_WIPE_CONFIG } from '../../types/lumaWipe';
import {
  Layers,
  Sparkles,
  RotateCcw,
  Sliders,
  Flame,
  Clock,
  Paintbrush,
  CheckCircle2,
} from 'lucide-react';

export const LumaWipeStudio: React.FC = () => {
  const { project, addTransition } = useProject();
  const [config, setConfig] = useState<LumaWipeConfig>(DEFAULT_LUMA_WIPE_CONFIG);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  const presets: { id: LumaMattePresetType; label: string; icon: React.ReactNode }[] = [
    { id: 'ink_splash', label: 'Ink Splash', icon: <Paintbrush className="w-4 h-4 text-purple-400" /> },
    { id: 'linear_gradient', label: 'Gradient Wipe', icon: <Layers className="w-4 h-4 text-forge-cyan" /> },
    { id: 'radial_clock', label: 'Clock Wipe', icon: <Clock className="w-4 h-4 text-amber-400" /> },
    { id: 'light_leak_wipe', label: 'Light Leak', icon: <Sparkles className="w-4 h-4 text-yellow-300" /> },
    { id: 'burn_dissolve', label: 'Film Burn', icon: <Flame className="w-4 h-4 text-orange-400" /> },
  ];

  const handleApplyToTimeline = () => {
    const clips = project?.clips || [];
    if (clips.length < 2) return;

    // Apply between first and second clip
    const c1 = clips[0];
    const c2 = clips[1];

    addTransition({
      type: 'luma-wipe',
      name: `Luma ${config.preset.replace('_', ' ')}`,
      duration: config.duration,
      alignment: 'center',
      fromClipId: c1.id,
      toClipId: c2.id,
      timelineStart: c1.timelineStart + c1.timelineDuration - config.duration / 2,
      softness: config.softness,
      reverse: config.isInverted,
      params: { preset: config.preset, softness: config.softness },
    });

    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 1200);
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Luma Matte & Gradient Wipe Transitions</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Grayscale texture mask wipe transitions
          </p>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Presets Grid */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
            Luma Matte Style
          </span>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => {
              const isSelected = config.preset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setConfig({ ...config, preset: p.id })}
                  className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'border-purple-400 bg-purple-950/40 text-white ring-1 ring-purple-400'
                      : 'border-[#27272a] bg-[#1f1f23] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {p.icon}
                  <span className="text-xs font-bold">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Transition Duration Slider */}
        <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
          <div className="flex justify-between text-xs">
            <span className="text-gray-300 font-semibold">Transition Duration</span>
            <span className="font-mono text-purple-400">{config.duration.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.1"
            value={config.duration}
            onChange={(e) => setConfig({ ...config, duration: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-purple-400"
          />
        </div>

        {/* Softness Edge Feather Slider */}
        <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
          <div className="flex justify-between text-xs">
            <span className="text-gray-300 font-semibold">Edge Softness (Feather)</span>
            <span className="font-mono text-forge-cyan">{config.softness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            value={config.softness}
            onChange={(e) => setConfig({ ...config, softness: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
          />
        </div>

        {/* Invert Wipe Toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
          <div>
            <span className="text-xs font-bold text-gray-200">Invert Wipe Direction</span>
            <p className="text-[10px] text-gray-400">Reverse luma threshold gradient</p>
          </div>
          <input
            type="checkbox"
            checked={config.isInverted}
            onChange={(e) => setConfig({ ...config, isInverted: e.target.checked })}
            className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-purple-400 focus:ring-purple-400 cursor-pointer"
          />
        </div>

        {/* Apply Button */}
        <button
          onClick={handleApplyToTimeline}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-forge-cyan text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-opacity cursor-pointer mt-2"
        >
          {addedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Applied Luma Wipe to Timeline!</span>
            </>
          ) : (
            <>
              <Layers className="w-4 h-4" />
              <span>Apply Luma Wipe Transition</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
