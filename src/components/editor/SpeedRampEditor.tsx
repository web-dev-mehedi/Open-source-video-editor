import React from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  SpeedRampConfig,
  SpeedRampPreset,
  SPEED_RAMP_PRESETS,
  SpeedKeyframe,
} from '../../types/speedRamp';
import { interpolateRampSpeed } from '../../utils/speedRampEngine';
import { Gauge, Zap, Activity, RefreshCw, Sparkles, Check } from 'lucide-react';
import { Slider } from '../common/Slider';

const PRESET_OPTIONS: { id: SpeedRampPreset; name: string; desc: string }[] = [
  { id: 'montage', name: 'Montage', desc: 'Rhythmic fast-slow-fast beat sync' },
  { id: 'hero-in', name: 'Hero In', desc: 'Fast whip zoom into bullet-time slow-mo' },
  { id: 'bullet-time', name: 'Bullet Time', desc: 'Matrix-style deep slow-motion focus' },
  { id: 'flash-out', name: 'Flash Out', desc: 'Build up into high velocity warp' },
  { id: 'jump-cut', name: 'Jump Cut', desc: 'Stepped speed shifts' },
  { id: 'custom', name: 'Custom', desc: 'Fully manual keyframed velocity curve' },
];

export const SpeedRampEditor: React.FC = () => {
  const { project, selectedClipId, currentTime, updateClip } = useProject();

  const clip = project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  const config: SpeedRampConfig = (clip as any)?.speedRamp || {
    enabled: false,
    preset: 'montage',
    keyframes: SPEED_RAMP_PRESETS.montage,
    maintainPitch: true,
  };

  const clipRelativeTime = clip ? Math.max(0, currentTime - clip.timelineStart) : 0;
  const progress = clip ? clipRelativeTime / Math.max(0.1, clip.timelineDuration) : 0;
  const currentSpeed = interpolateRampSpeed(config, progress);

  const handleUpdateConfig = (updates: Partial<SpeedRampConfig>) => {
    if (!clip) return;
    const nextConfig = { ...config, ...updates };
    updateClip(clip.id, { speedRamp: nextConfig } as any);
  };

  const handleSelectPreset = (preset: SpeedRampPreset) => {
    handleUpdateConfig({
      enabled: true,
      preset,
      keyframes: SPEED_RAMP_PRESETS[preset] || SPEED_RAMP_PRESETS.custom,
    });
  };

  const width = 240;
  const height = 110;
  const padding = 12;

  // Generate SVG curve points
  const steps = 40;
  const points: { x: number; y: number }[] = [];
  const maxSpeedVal = 6.0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const spd = interpolateRampSpeed(config, t);
    const x = padding + t * (width - 2 * padding);
    const normSpd = Math.min(1.0, spd / maxSpeedVal);
    const y = height - padding - normSpd * (height - 2 * padding);
    points.push({ x, y });
  }

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const playheadX = padding + progress * (width - 2 * padding);

  return (
    <div className="space-y-4 p-4 bg-[#141416] rounded-2xl border border-[#27272a] text-gray-200 select-none text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-forge-cyan/20 border border-forge-cyan/40 flex items-center justify-center text-forge-cyan">
            <Gauge className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-white text-xs block">Speed Ramping & Curves</span>
            <span className="text-[10px] text-gray-400 block">Dynamic variable time remapping</span>
          </div>
        </div>

        <button
          onClick={() => handleUpdateConfig({ enabled: !config.enabled })}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow-sm ${
            config.enabled
              ? 'bg-forge-cyan text-black font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]'
              : 'bg-[#202024] text-gray-400 border border-white/5'
          }`}
        >
          {config.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Interactive Velocity Curve Graph */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-forge-cyan" />
                <span>Velocity Spline Profile</span>
              </span>
              <span className="font-mono text-forge-cyan font-bold text-xs">
                {currentSpeed.toFixed(2)}x Speed
              </span>
            </div>

            <div className="relative flex flex-col items-center">
              <svg width={width} height={height} className="bg-[#0b0b0d] rounded-xl border border-white/10 shadow-inner">
                {/* Reference 1.0x baseline */}
                <line
                  x1={padding}
                  y1={height - padding - (1.0 / maxSpeedVal) * (height - 2 * padding)}
                  x2={width - padding}
                  y2={height - padding - (1.0 / maxSpeedVal) * (height - 2 * padding)}
                  stroke="#3f3f46"
                  strokeDasharray="3 3"
                />

                {/* Velocity Curve Spline */}
                <path d={pathD} fill="none" stroke="#06B6D4" strokeWidth={2.5} />

                {/* Keyframe Nodes */}
                {config.keyframes.map((kf, kfIdx) => {
                  const nodeX = padding + kf.time * (width - 2 * padding);
                  const nodeY = height - padding - Math.min(1.0, kf.speed / maxSpeedVal) * (height - 2 * padding);
                  return (
                    <circle
                      key={kf.id || kfIdx}
                      cx={nodeX}
                      cy={nodeY}
                      r={4.5}
                      fill="#06B6D4"
                      stroke="#000"
                      strokeWidth={1.5}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    />
                  );
                })}

                {/* Playhead indicator line */}
                <line
                  x1={playheadX}
                  y1={padding}
                  x2={playheadX}
                  y2={height - padding}
                  stroke="#EF4444"
                  strokeWidth={2}
                />
              </svg>
            </div>
          </div>

          {/* Speed Presets Grid */}
          <div className="space-y-2 pt-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Speed Curve Presets
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = config.preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectPreset(opt.id)}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-forge-cyan text-black font-bold border-forge-cyan shadow'
                        : 'bg-[#202024] text-gray-300 border-white/5 hover:border-gray-500'
                    }`}
                    title={opt.desc}
                  >
                    <span className="block text-[11px] truncate font-semibold">{opt.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
