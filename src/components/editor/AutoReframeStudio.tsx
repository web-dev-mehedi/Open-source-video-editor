import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { AutoReframeConfig, DEFAULT_AUTO_REFRAME_CONFIG } from '../../types/autoReframe';
import {
  Crop,
  Smartphone,
  Square,
  Film,
  RotateCcw,
  Sparkles,
  Layers,
  Sliders,
} from 'lucide-react';

export const AutoReframeStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Crop className="w-8 h-8 mb-2 opacity-40 text-forge-cyan" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to reframe aspect ratio</p>
      </div>
    );
  }

  const config: AutoReframeConfig = (activeClip as any).autoReframe || DEFAULT_AUTO_REFRAME_CONFIG;

  const handleUpdate = (updates: Partial<AutoReframeConfig>) => {
    const newConfig: AutoReframeConfig = { ...config, ...updates };
    updateClip(activeClip.id, { autoReframe: newConfig } as any);
  };

  const handleReset = () => {
    updateClip(activeClip.id, { autoReframe: DEFAULT_AUTO_REFRAME_CONFIG } as any);
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Crop className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Auto-Reframe & Smart Crop</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Convert 16:9 to 9:16 vertical with Kalman focal tracking
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Auto-Reframe"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f23] border border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forge-cyan/20 border border-forge-cyan/40 flex items-center justify-center text-forge-cyan">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-200 block">Smart Auto-Reframe</span>
              <span className="text-[10px] text-gray-400">
                Track focal action into vertical format
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.isEnabled}
            onChange={(e) => handleUpdate({ isEnabled: e.target.checked })}
            className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-cyan focus:ring-forge-cyan cursor-pointer"
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Target Aspect Ratio */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Target Format
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '9:16', label: '9:16 Vertical', icon: <Smartphone className="w-4 h-4 text-forge-purple" /> },
                  { id: '1:1', label: '1:1 Square', icon: <Square className="w-4 h-4 text-amber-400" /> },
                  { id: '4:5', label: '4:5 Portrait', icon: <Film className="w-4 h-4 text-sky-400" /> },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleUpdate({ targetAspectRatio: r.id as any })}
                    className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                      config.targetAspectRatio === r.id
                        ? 'border-forge-cyan bg-cyan-950/40 text-white ring-1 ring-forge-cyan'
                        : 'border-[#27272a] bg-[#1f1f23] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {r.icon}
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Fill Mode */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <span className="text-xs font-bold text-gray-200 block mb-1">Canvas Fill Mode</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'blur_background', label: 'Blurred BG' },
                  { id: 'crop_fit', label: 'Full Crop' },
                  { id: 'black_bars', label: 'Black Bars' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleUpdate({ fillMode: m.id as any })}
                    className={`py-1.5 px-2 rounded-md text-[10px] font-semibold border transition-all ${
                      config.fillMode === m.id
                        ? 'border-forge-purple bg-purple-950/40 text-white'
                        : 'border-[#27272a] bg-[#18181b] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Blur Strength */}
            {config.fillMode === 'blur_background' && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-semibold">Background Blur Radius</span>
                  <span className="font-mono text-forge-purple">{config.blurStrength}px</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="40"
                  value={config.blurStrength}
                  onChange={(e) => handleUpdate({ blurStrength: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>
            )}

            {/* Manual Focal Center Pan Offset */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Manual Center Pan Offset</span>
                <span className="font-mono text-forge-cyan">{config.manualOffsetPercent}%</span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                value={config.manualOffsetPercent}
                onChange={(e) => handleUpdate({ manualOffsetPercent: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
