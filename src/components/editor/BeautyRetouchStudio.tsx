import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { BeautyRetouchConfig, DEFAULT_BEAUTY_CONFIG } from '../../types/beautyRetouch';
import {
  Sparkles,
  RotateCcw,
  Smile,
  Eye,
  Sliders,
  Sun,
  ShieldCheck,
} from 'lucide-react';

export const BeautyRetouchStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Sparkles className="w-8 h-8 mb-2 opacity-40 text-pink-400" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to retouch face & skin</p>
      </div>
    );
  }

  const config: BeautyRetouchConfig = (activeClip as any).beautyRetouch || DEFAULT_BEAUTY_CONFIG;

  const handleUpdate = (updates: Partial<BeautyRetouchConfig>) => {
    const newConfig: BeautyRetouchConfig = { ...config, ...updates };
    updateClip(activeClip.id, { beautyRetouch: newConfig } as any);
  };

  const handleReset = () => {
    updateClip(activeClip.id, { beautyRetouch: DEFAULT_BEAUTY_CONFIG } as any);
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Face Retouching & Beautification</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Guided filter skin smoothing, teeth whitening & facial sculpting
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Beautification"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f23] border border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-400/20 border border-pink-400/40 flex items-center justify-center text-pink-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-200 block">AI Face Retouch</span>
              <span className="text-[10px] text-gray-400">
                Smooth blemishes & enhance facial features
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.isEnabled}
            onChange={(e) => handleUpdate({ isEnabled: e.target.checked })}
            className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-pink-400 focus:ring-pink-400 cursor-pointer"
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Skin Smoothing Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Skin Smoothing (Blemish Filter)</span>
                <span className="font-mono text-pink-400">{config.skinSmoothing}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.skinSmoothing}
                onChange={(e) => handleUpdate({ skinSmoothing: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-pink-400"
              />
            </div>

            {/* Teeth Whitening Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Teeth Whitening</span>
                <span className="font-mono text-forge-cyan">{config.teethWhitening}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.teethWhitening}
                onChange={(e) => handleUpdate({ teethWhitening: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
              />
            </div>

            {/* Eye Brightening Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Eye Clarity & Brightening</span>
                <span className="font-mono text-amber-400">{config.eyeBrightening}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.eyeBrightening}
                onChange={(e) => handleUpdate({ eyeBrightening: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Face Slimming Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Jawline & Face Slimming</span>
                <span className="font-mono text-purple-400">{config.faceSlimming}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.faceSlimming}
                onChange={(e) => handleUpdate({ faceSlimming: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
