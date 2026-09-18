import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { CameraShakeConfig, ShakePresetType, DEFAULT_CAMERA_SHAKE_CONFIG } from '../../types/cameraShake';
import {
  Vibrate,
  RotateCcw,
  Sparkles,
  Zap,
  Sliders,
  Compass,
} from 'lucide-react';

export const CameraShakeStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Vibrate className="w-8 h-8 mb-2 opacity-40 text-forge-purple" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip to add camera shake</p>
      </div>
    );
  }

  const config: CameraShakeConfig = (activeClip as any).cameraShake || DEFAULT_CAMERA_SHAKE_CONFIG;

  const handleUpdate = (updates: Partial<CameraShakeConfig>) => {
    const newConfig: CameraShakeConfig = { ...config, ...updates };
    updateClip(activeClip.id, { cameraShake: newConfig } as any);
  };

  const handleReset = () => {
    updateClip(activeClip.id, { cameraShake: DEFAULT_CAMERA_SHAKE_CONFIG } as any);
  };

  const presets: { id: ShakePresetType; label: string; desc: string }[] = [
    { id: 'subtle_handheld', label: 'Handheld', desc: 'Natural organic sway' },
    { id: 'action_cam', label: 'Action Cam', desc: 'Fast running shake' },
    { id: 'earthquake', label: 'Earthquake', desc: 'Heavy jolt impact' },
    { id: 'cinematic_drift', label: 'Drift', desc: 'Smooth floating drone' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Vibrate className="w-3.5 h-3.5 text-forge-purple" />
            <span>Camera Shake & Drift Engine</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Fractional Brownian Motion (fBm) organic camera movement
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Shake"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f23] border border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forge-purple/20 border border-forge-purple/40 flex items-center justify-center text-forge-purple">
              <Vibrate className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-200 block">Synthetic Camera Shake</span>
              <span className="text-[10px] text-gray-400">
                Add handheld movement to static shots
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.isEnabled}
            onChange={(e) => handleUpdate({ isEnabled: e.target.checked })}
            className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-purple focus:ring-forge-purple cursor-pointer"
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Presets Grid */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Shake Pattern
              </span>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => {
                  const isSelected = config.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleUpdate({ preset: p.id })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-forge-purple bg-purple-950/40 text-white ring-1 ring-forge-purple shadow-sm'
                          : 'border-[#27272a] bg-[#1f1f23] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-xs font-bold block">{p.label}</span>
                      <span className="text-[9px] text-gray-500 mt-0.5 block">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intensity Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Shake Amplitude (Intensity)</span>
                <span className="font-mono text-forge-purple">{config.intensity}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={config.intensity}
                onChange={(e) => handleUpdate({ intensity: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
              />
            </div>

            {/* Frequency Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Shake Speed (Frequency)</span>
                <span className="font-mono text-forge-cyan">{config.frequency.toFixed(1)} Hz</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={config.frequency}
                onChange={(e) => handleUpdate({ frequency: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
              />
            </div>

            {/* Auto-Zoom Margin */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div>
                <span className="text-xs font-bold text-gray-200">Auto-Zoom Compensation</span>
                <p className="text-[10px] text-gray-400">Eliminates black border margins during shake</p>
              </div>
              <input
                type="checkbox"
                checked={config.autoZoom}
                onChange={(e) => handleUpdate({ autoZoom: e.target.checked })}
                className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-purple focus:ring-forge-purple cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
