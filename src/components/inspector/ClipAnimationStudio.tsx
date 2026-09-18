import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  ClipAnimationConfig,
  AnimationCategory,
  AnimationPreset,
  ANIMATION_PRESETS,
} from '../../types/animation';
import {
  Sparkles,
  RotateCcw,
  Sliders,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Minimize,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Activity,
  Radio,
  Waves,
  ZoomIn,
  Play,
  X,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  Eye: <Eye className="w-4 h-4" />,
  EyeOff: <EyeOff className="w-4 h-4" />,
  Maximize2: <Maximize2 className="w-4 h-4" />,
  Minimize2: <Minimize2 className="w-4 h-4" />,
  Minimize: <Minimize className="w-4 h-4" />,
  ArrowRight: <ArrowRight className="w-4 h-4" />,
  ArrowLeft: <ArrowLeft className="w-4 h-4" />,
  ArrowUp: <ArrowUp className="w-4 h-4" />,
  ArrowDown: <ArrowDown className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  RotateCw: <RotateCw className="w-4 h-4" />,
  RotateCcw: <RotateCcw className="w-4 h-4" />,
  Activity: <Activity className="w-4 h-4" />,
  Radio: <Radio className="w-4 h-4" />,
  Waves: <Waves className="w-4 h-4" />,
  ZoomIn: <ZoomIn className="w-4 h-4" />,
};

export const ClipAnimationStudio: React.FC = () => {
  const { project, selectedClipId, updateClip, setCurrentTime } = useProject();
  const [activeCategory, setActiveCategory] = useState<AnimationCategory>('in');

  const activeClip = project?.clips.find((c) => c.id === selectedClipId);

  if (!activeClip) {
    return (
      <div className="p-4 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Sparkles className="w-8 h-8 mb-2 opacity-40 text-forge-cyan" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to configure animations</p>
      </div>
    );
  }

  const currentAnim = activeClip.animation;
  const maxDuration = Math.max(0.2, activeClip.timelineDuration);

  const handleSelectPreset = (preset: AnimationPreset) => {
    const defaultDur = Math.min(preset.defaultDuration, maxDuration);
    const newConfig: ClipAnimationConfig = {
      category: preset.category,
      type: preset.type,
      name: preset.name,
      duration: defaultDur,
      intensity: 100,
      delay: 0,
      easing: preset.type === 'pop' ? 'spring' : 'ease-out',
    };

    updateClip(activeClip.id, { animation: newConfig });

    // Scrub playhead to the beginning of the animation to immediately preview it
    if (preset.category === 'in') {
      setCurrentTime(activeClip.timelineStart);
    } else if (preset.category === 'out') {
      setCurrentTime(Math.max(activeClip.timelineStart, activeClip.timelineStart + activeClip.timelineDuration - defaultDur));
    }
  };

  const handleUpdateCurrentAnim = (updates: Partial<ClipAnimationConfig>) => {
    if (!currentAnim) return;
    const updated: ClipAnimationConfig = { ...currentAnim, ...updates };
    updateClip(activeClip.id, { animation: updated });
  };

  const handleRemoveAnimation = () => {
    updateClip(activeClip.id, { animation: undefined });
  };

  const categoryPresets = ANIMATION_PRESETS.filter((p) => p.category === activeCategory);

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-gray-200 select-none overflow-y-auto font-sans">
      {/* Category Tabs: In | Out | Combo */}
      <div className="h-9 border-b border-neutral-800 bg-neutral-950 flex items-center px-2 gap-1 flex-shrink-0">
        {(['in', 'out', 'combo'] as AnimationCategory[]).map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 py-1 rounded text-xs font-bold transition-all capitalize ${
                isActive
                  ? 'bg-neutral-800 text-forge-cyan shadow-xs border border-neutral-700/60'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="p-3 space-y-4">
        {/* Active Animation Status & Quick Reset */}
        {currentAnim ? (
          <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-forge-cyan/30 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-forge-cyan/20 border border-forge-cyan/40 flex items-center justify-center text-forge-cyan">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{currentAnim.name || currentAnim.type}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-700 font-mono text-forge-cyan uppercase">
                    {currentAnim.category}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {currentAnim.duration.toFixed(1)}s • {currentAnim.intensity ?? 100}% intensity
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (currentAnim.category === 'in') setCurrentTime(activeClip.timelineStart);
                  else if (currentAnim.category === 'out') setCurrentTime(Math.max(activeClip.timelineStart, activeClip.timelineStart + activeClip.timelineDuration - currentAnim.duration));
                  else setCurrentTime(activeClip.timelineStart);
                }}
                className="p-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-gray-200 hover:text-white transition-colors"
                title="Preview Animation"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRemoveAnimation}
                className="p-1.5 rounded-lg bg-neutral-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                title="Remove Animation"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
            <p className="text-[11px] text-gray-400">No animation applied to this clip.</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Click a preset below to animate this clip.</p>
          </div>
        )}

        {/* Animation Parameters (if active) */}
        {currentAnim && (
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-forge-cyan" />
                <span>Animation Properties</span>
              </span>
            </div>

            {/* Duration Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 font-semibold">Duration</span>
                <span className="font-mono text-forge-cyan text-xs">
                  {currentAnim.duration.toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={maxDuration}
                step={0.05}
                value={Math.min(currentAnim.duration, maxDuration)}
                onChange={(e) => handleUpdateCurrentAnim({ duration: parseFloat(e.target.value) })}
                className="w-full accent-forge-cyan h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Intensity Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 font-semibold">Intensity</span>
                <span className="font-mono text-amber-400 text-xs">
                  {currentAnim.intensity ?? 100}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={currentAnim.intensity ?? 100}
                onChange={(e) => handleUpdateCurrentAnim({ intensity: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Optional Delay for In Animations */}
            {currentAnim.category === 'in' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-semibold">Start Delay</span>
                  <span className="font-mono text-purple-400 text-xs">
                    {(currentAnim.delay || 0).toFixed(2)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, maxDuration - currentAnim.duration)}
                  step={0.05}
                  value={currentAnim.delay || 0}
                  onChange={(e) => handleUpdateCurrentAnim({ delay: parseFloat(e.target.value) })}
                  className="w-full accent-purple-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {/* Presets Grid */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            {activeCategory} Presets
          </span>

          <div className="grid grid-cols-3 gap-1.5">
            {categoryPresets.map((preset) => {
              const isSelected = currentAnim?.type === preset.type;
              return (
                <button
                  key={preset.type}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all group ${
                    isSelected
                      ? 'border-forge-cyan bg-cyan-950/30 text-white ring-1 ring-forge-cyan shadow-md'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-gray-300 hover:text-white'
                  }`}
                  title={preset.description}
                >
                  <div
                    className={`w-8 h-8 rounded-lg mb-1.5 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-forge-cyan text-black'
                        : 'bg-neutral-800 group-hover:bg-neutral-700 text-gray-300'
                    }`}
                  >
                    {ICON_MAP[preset.iconName] || <Sparkles className="w-4 h-4" />}
                  </div>
                  <span className="text-[11px] font-semibold leading-tight line-clamp-1">
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
