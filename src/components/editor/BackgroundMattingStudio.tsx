import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BackgroundMattingConfig, DEFAULT_MATTING_CONFIG } from '../../types/matting';
import {
  UserCheck,
  Scissors,
  Layers,
  Sparkles,
  RotateCcw,
  Check,
  Activity,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export const BackgroundMattingStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <UserCheck className="w-8 h-8 mb-2 opacity-40 text-forge-cyan" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to remove its background</p>
      </div>
    );
  }

  const matting: BackgroundMattingConfig = activeClip.matting || DEFAULT_MATTING_CONFIG;

  const handleUpdateMatting = (updates: Partial<BackgroundMattingConfig>) => {
    const newMatting: BackgroundMattingConfig = { ...matting, ...updates };
    updateClip(activeClip.id, { matting: newMatting });
  };

  const handleTogglePrimaryAction = () => {
    handleUpdateMatting({ isEnabled: !matting.isEnabled });
  };

  const handleReset = () => {
    updateClip(activeClip.id, { matting: DEFAULT_MATTING_CONFIG });
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto font-sans">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-forge-cyan" />
            <span>AI Background Removal</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            100% Local Neural Human Cutout & Foreground Extraction
          </p>
        </div>

        {matting.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset to Defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* 1. SINGLE PROMINENT PRIMARY ACTION (CapCut / Creator-Friendly) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-[#1e1e24] border border-[#27272a] shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  matting.isEnabled
                    ? 'bg-forge-cyan/20 border border-forge-cyan/40 text-forge-cyan'
                    : 'bg-neutral-800 border border-neutral-700 text-gray-400'
                }`}
              >
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Auto Human Cutout</span>
                <span className="text-[11px] text-gray-400">
                  {matting.isEnabled
                    ? 'Background removed • Real-time preview active'
                    : 'Extract person & isolate background locally'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleTogglePrimaryAction}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
              matting.isEnabled
                ? 'bg-neutral-800 border border-forge-cyan/50 text-forge-cyan hover:bg-neutral-700 hover:border-forge-cyan'
                : 'bg-gradient-to-r from-forge-cyan to-forge-purple text-white hover:opacity-95'
            }`}
          >
            {matting.isEnabled ? (
              <>
                <Check className="w-4 h-4 text-forge-cyan" />
                <span>Background Removed (Click to Restore)</span>
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                <span>Remove Background</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400 border-t border-neutral-800">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Local Processing • 0 Cloud Data Sent</span>
            </span>
            <span className="flex items-center gap-1 font-mono text-gray-500">
              <Cpu className="w-3 h-3 text-forge-cyan" />
              <span>GPU / Neural Engine</span>
            </span>
          </div>
        </div>

        {/* 2. CREATIVE VIRAL PRESETS (Quick Toggles) */}
        {matting.isEnabled && (
          <div className="space-y-2">
            {/* Place Captions Behind Subject Toggle */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-950/40 to-cyan-950/40 border border-forge-purple/40 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-forge-cyan" />
                <div>
                  <span className="text-xs font-bold text-white block">Text Behind Person</span>
                  <span className="text-[10px] text-gray-300">
                    Renders subtitles & overlays behind the cutout subject
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={matting.placeCaptionsBehindSubject}
                onChange={(e) => handleUpdateMatting({ placeCaptionsBehindSubject: e.target.checked })}
                className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-cyan focus:ring-forge-cyan cursor-pointer"
              />
            </div>

            {/* Cutout Stroke Outline Toggle */}
            <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-gray-200">Cutout Stroke Outline</span>
                </div>
                <input
                  type="checkbox"
                  checked={matting.strokeBorder}
                  onChange={(e) => handleUpdateMatting({ strokeBorder: e.target.checked })}
                  className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-amber-400 focus:ring-amber-400 cursor-pointer"
                />
              </div>

              {matting.strokeBorder && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-1">Color</span>
                    <input
                      type="color"
                      value={matting.strokeColor || '#FFFFFF'}
                      onChange={(e) => handleUpdateMatting({ strokeColor: e.target.value })}
                      className="w-full h-7 rounded border border-[#3f3f46] bg-[#121214] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Width</span>
                      <span className="font-mono text-amber-400">{matting.strokeWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={matting.strokeWidth || 4}
                      onChange={(e) => handleUpdateMatting({ strokeWidth: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-amber-400 mt-2"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. COLLAPSIBLE ADVANCED SETTINGS ACCORDION */}
        {matting.isEnabled && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-300">Advanced Matte Controls</span>
                <span className="text-[10px] text-gray-500 font-mono">(Edge, Despill, Smoothing)</span>
              </div>
              {showAdvanced ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-3 pt-1 border-t border-neutral-800/80 space-y-3">
                {/* Edge Softness (Feather) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-300">Edge Feather (Softness)</span>
                    <span className="font-mono text-forge-cyan">{matting.feather}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={matting.feather}
                    onChange={(e) => handleUpdateMatting({ feather: parseInt(e.target.value, 10) })}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-forge-cyan"
                  />
                </div>

                {/* Edge Refinement */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-300">Edge Sharpening</span>
                    <span className="font-mono text-forge-purple">{matting.edgeRefinement}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={matting.edgeRefinement}
                    onChange={(e) => handleUpdateMatting({ edgeRefinement: parseInt(e.target.value, 10) })}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-forge-purple"
                  />
                </div>

                {/* Temporal Video Anti-Flicker */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-300 flex items-center gap-1">
                      <Activity className="w-3 h-3 text-emerald-400" />
                      <span>Temporal Anti-Flicker</span>
                    </span>
                    <span className="font-mono text-emerald-400">{matting.temporalSmoothing}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={matting.temporalSmoothing}
                    onChange={(e) => handleUpdateMatting({ temporalSmoothing: parseInt(e.target.value, 10) })}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                {/* Despill */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-300">Spill Suppression (Fringe Cleanup)</span>
                    <span className="font-mono text-cyan-400">{matting.despill}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={matting.despill}
                    onChange={(e) => handleUpdateMatting({ despill: parseInt(e.target.value, 10) })}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
