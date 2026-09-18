import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ColorMatchConfig, DEFAULT_COLOR_MATCH_CONFIG } from '../../types/colorMatch';
import {
  Palette,
  Pipette,
  Sparkles,
  RotateCcw,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Layers,
} from 'lucide-react';

export const ColorMatchStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();
  const [isMatching, setIsMatching] = useState<boolean>(false);

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Palette className="w-8 h-8 mb-2 opacity-40 text-forge-purple" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to match color palette</p>
      </div>
    );
  }

  const config: ColorMatchConfig = (activeClip as any).colorMatch || DEFAULT_COLOR_MATCH_CONFIG;
  const otherClips = (project?.clips || []).filter((c) => c.id !== activeClip.id);

  const handleUpdate = (updates: Partial<ColorMatchConfig>) => {
    const newConfig: ColorMatchConfig = { ...config, ...updates };
    updateClip(activeClip.id, { colorMatch: newConfig } as any);
  };

  const handleReset = () => {
    updateClip(activeClip.id, { colorMatch: DEFAULT_COLOR_MATCH_CONFIG } as any);
  };

  const handleApplyColorMatch = () => {
    setIsMatching(true);
    handleUpdate({ isEnabled: true, isMatched: true });
    setIsMatching(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span>Shot-to-Shot Color Match</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Reinhard CIE Lab palette & exposure harmonization
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Color Match"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Reference Selection Banner */}
        <div className="p-3 rounded-xl bg-[#1f1f23] border border-[#27272a] space-y-3">
          <span className="text-xs font-bold text-gray-200 block">
            Select Reference Shot
          </span>

          {otherClips.length === 0 ? (
            <p className="text-[10px] text-gray-400">
              Import a second footage clip to use as a color grading reference.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {otherClips.map((c) => {
                const isSelected = config.referenceClipId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleUpdate({ referenceClipId: c.id, referenceThumbnailUrl: c.thumbnailUrl })}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-950/40 text-white ring-1 ring-emerald-400'
                        : 'border-[#27272a] bg-[#18181b] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} className="w-9 h-7 object-cover rounded" />
                    ) : (
                      <div className="w-9 h-7 bg-black/50 rounded flex items-center justify-center text-[9px] font-mono">
                        REF
                      </div>
                    )}
                    <span className="text-[10px] font-bold truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={handleApplyColorMatch}
            disabled={isMatching}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-forge-cyan text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isMatching ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Transferring Color Palette...</span>
              </>
            ) : config.isMatched ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                <span>Colors Matched Successfully</span>
              </>
            ) : (
              <>
                <Pipette className="w-3.5 h-3.5" />
                <span>Match Colors from Reference</span>
              </>
            )}
          </button>
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Match Strength Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Match Intensity</span>
                <span className="font-mono text-emerald-400">{config.strength}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={config.strength}
                onChange={(e) => handleUpdate({ strength: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
