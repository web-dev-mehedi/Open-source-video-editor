import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { CurvedTextConfig, CurvePathPreset, DEFAULT_CURVED_TEXT_CONFIG } from '../../types/curvedText';
import {
  CircleDot,
  RotateCcw,
  Sparkles,
  Waves,
  CornerDownRight,
  TrendingUp,
  FlipVertical,
} from 'lucide-react';

export const CurvedTextStudio: React.FC = () => {
  const { project, updateActiveStyle } = useProject();

  const config: CurvedTextConfig = (project?.activeStyle as any)?.curvedText || DEFAULT_CURVED_TEXT_CONFIG;

  const handleUpdate = (updates: Partial<CurvedTextConfig>) => {
    const newConfig: CurvedTextConfig = { ...config, ...updates };
    updateActiveStyle({ curvedText: newConfig } as any);
  };

  const handleReset = () => {
    updateActiveStyle({ curvedText: DEFAULT_CURVED_TEXT_CONFIG } as any);
  };

  const presets: { id: CurvePathPreset; label: string; icon: React.ReactNode }[] = [
    { id: 'none', label: 'Straight', icon: <span className="font-mono font-bold text-xs">—</span> },
    { id: 'arc_top', label: 'Arc Top', icon: <TrendingUp className="w-4 h-4 text-forge-cyan" /> },
    { id: 'arc_bottom', label: 'Arc Bottom', icon: <TrendingUp className="w-4 h-4 text-forge-purple rotate-180" /> },
    { id: 'circle_360', label: 'Circle 360°', icon: <CircleDot className="w-4 h-4 text-amber-400" /> },
    { id: 'wave_sine', label: 'Wave Sine', icon: <Waves className="w-4 h-4 text-emerald-400" /> },
    { id: 's_curve', label: 'S-Curve', icon: <CornerDownRight className="w-4 h-4 text-sky-400" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <CircleDot className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Curved & Circular Text</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Arc-length path distribution & 360° circular kerning
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Curved Text"
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
              <CircleDot className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-200 block">Curve Path Text</span>
              <span className="text-[10px] text-gray-400">
                Bend caption typography along custom curves
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.isEnabled}
            onChange={(e) => handleUpdate({ isEnabled: e.target.checked, preset: e.target.checked && config.preset === 'none' ? 'arc_top' : config.preset })}
            className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-cyan focus:ring-forge-cyan cursor-pointer"
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Presets Grid */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Curve Preset
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
                          ? 'border-forge-cyan bg-cyan-950/40 text-white ring-1 ring-forge-cyan shadow-sm'
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

            {/* Radius Slider */}
            {(config.preset === 'circle_360' || config.preset === 'arc_top' || config.preset === 'arc_bottom') && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-semibold">Curve Radius</span>
                  <span className="font-mono text-forge-cyan">{config.radius}px</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="400"
                  value={config.radius}
                  onChange={(e) => handleUpdate({ radius: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
                />
              </div>
            )}

            {/* Arc Angle Slider */}
            {(config.preset === 'arc_top' || config.preset === 'arc_bottom') && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-semibold">Arc Span Angle</span>
                  <span className="font-mono text-forge-purple">{config.arcAngle}°</span>
                </div>
                <input
                  type="range"
                  min="45"
                  max="360"
                  value={config.arcAngle}
                  onChange={(e) => handleUpdate({ arcAngle: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>
            )}

            {/* Curvature Slider for Waves */}
            {(config.preset === 'wave_sine' || config.preset === 's_curve') && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-semibold">Wave Curvature Amplitude</span>
                  <span className="font-mono text-emerald-400">{config.curvature}%</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={config.curvature}
                  onChange={(e) => handleUpdate({ curvature: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            )}

            {/* Invert Orientation Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex items-center gap-2">
                <FlipVertical className="w-4 h-4 text-forge-cyan" />
                <div>
                  <span className="text-xs font-bold text-gray-200">Flip Text Orientation</span>
                  <p className="text-[10px] text-gray-400">Invert glyph baseline tangent</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.inwardFacing}
                onChange={(e) => handleUpdate({ inwardFacing: e.target.checked })}
                className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-cyan focus:ring-forge-cyan cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
