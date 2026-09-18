import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  StabilizationConfig,
  StabilizationMode,
  DEFAULT_STABILIZATION_CONFIG,
} from '../../types/stabilization';
import {
  Activity,
  Compass,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';

export const StabilizationStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Activity className="w-8 h-8 mb-2 opacity-40 text-forge-cyan" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to reduce camera shake</p>
      </div>
    );
  }

  const stabilization: StabilizationConfig =
    activeClip.stabilization || DEFAULT_STABILIZATION_CONFIG;

  const handleUpdate = (updates: Partial<StabilizationConfig>) => {
    const newConfig: StabilizationConfig = { ...stabilization, ...updates };
    updateClip(activeClip.id, { stabilization: newConfig });
  };

  const handleReset = () => {
    updateClip(activeClip.id, { stabilization: DEFAULT_STABILIZATION_CONFIG });
  };

  const handleAnalyzeMotion = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          handleUpdate({ isEnabled: true, isAnalyzed: true });
          return 100;
        }
        return prev + 25;
      });
    }, 180);
  };

  const modes: { id: StabilizationMode; label: string; desc: string }[] = [
    { id: 'subtle', label: 'Subtle', desc: 'Mild walking shake' },
    { id: 'smooth', label: 'Smooth', desc: 'Handheld vlog motion' },
    { id: 'strong', label: 'Strong', desc: 'Heavy action & running' },
    { id: 'tripod', label: 'Tripod Lock', desc: 'Locked static shot' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Video Stabilization</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Camera shake reduction & trajectory smoothing
          </p>
        </div>

        {stabilization.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Stabilization"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Analyze & Enable Banner */}
        <div className="p-3 rounded-xl bg-[#1f1f23] border border-[#27272a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-forge-cyan" />
              <div>
                <span className="text-xs font-bold text-white">Motion Compensation</span>
                <p className="text-[10px] text-gray-400">
                  {stabilization.isAnalyzed ? 'Motion path tracked & smoothed' : 'Ready to analyze camera motion'}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={stabilization.isEnabled}
              onChange={(e) => handleUpdate({ isEnabled: e.target.checked })}
              className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-cyan focus:ring-forge-cyan cursor-pointer"
            />
          </div>

          <button
            onClick={handleAnalyzeMotion}
            disabled={isAnalyzing}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-forge-purple to-forge-cyan text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing Optical Flow ({analysisProgress}%)...</span>
              </>
            ) : stabilization.isAnalyzed ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Re-Analyze Camera Path</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Analyze & Stabilize Footage</span>
              </>
            )}
          </button>
        </div>

        {stabilization.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Stabilization Modes Grid */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-gray-300 block mb-1">Stabilization Level</span>
              <div className="grid grid-cols-2 gap-2">
                {modes.map((m) => {
                  const isSelected = stabilization.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleUpdate({ mode: m.id, tripodLock: m.id === 'tripod' })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-forge-cyan bg-cyan-950/40 text-white ring-1 ring-forge-cyan'
                          : 'border-[#27272a] bg-[#1f1f23] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-xs font-bold block">{m.label}</span>
                      <span className="text-[9px] text-gray-500 mt-0.5 block">{m.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smoothness Window Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Smoothing Strength</span>
                <span className="font-mono text-forge-cyan">{stabilization.smoothness}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={stabilization.smoothness}
                onChange={(e) => handleUpdate({ smoothness: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
              />
            </div>

            {/* Crop Margin & Auto Zoom Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Auto-Crop Margin (Zoom)</span>
                <span className="font-mono text-amber-400">{stabilization.cropMargin}%</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                value={stabilization.cropMargin}
                onChange={(e) => handleUpdate({ cropMargin: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <p className="text-[10px] text-gray-500">
                Prevents black border margins during counter-jitter compensation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
