import React from 'react';
import { KeyframeEasing, BezierControlPoints } from '../../types/keyframes';
import { Sparkles, Zap, Activity } from 'lucide-react';

interface KeyframeCurveEditorProps {
  easing: KeyframeEasing;
  controlPoints?: BezierControlPoints;
  onChangeEasing: (easing: KeyframeEasing, cp?: BezierControlPoints) => void;
}

const EASING_PRESETS: { id: KeyframeEasing; name: string; icon: string; description: string }[] = [
  { id: 'linear', name: 'Linear', icon: '⎯', description: 'Constant uniform speed without acceleration' },
  { id: 'easeInOut', name: 'Ease In-Out', icon: '∿', description: 'Smooth cinematic acceleration & deceleration' },
  { id: 'easeOut', name: 'Fast Snap (Ease Out)', icon: '⤻', description: 'Snappy entry with gradual slowdown' },
  { id: 'easeIn', name: 'Slow Build (Ease In)', icon: '⤺', description: 'Gradual ramp up to high speed' },
  { id: 'spring', name: 'Spring / Bounce', icon: '⌇', description: 'Elastic spring overshoot and bounce back' },
  { id: 'hold', name: 'Hold / Step', icon: '⨅', description: 'Instant cut on final frame' },
];

export const KeyframeCurveEditor: React.FC<KeyframeCurveEditorProps> = ({
  easing,
  controlPoints,
  onChangeEasing,
}) => {
  const width = 230;
  const height = 90;
  const padding = 12;

  // Generate SVG spline preview for the active easing curve
  const steps = 30;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let val = t;

    if (easing === 'easeIn') val = t * t * t;
    else if (easing === 'easeOut') val = 1 - Math.pow(1 - t, 3);
    else if (easing === 'easeInOut') val = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    else if (easing === 'spring') {
      const s = 1.7;
      const t1 = t - 1;
      val = t1 * t1 * ((s + 1) * t1 + s) + 1;
    } else if (easing === 'hold') val = t >= 1 ? 1 : 0;

    const x = padding + t * (width - 2 * padding);
    const y = height - padding - Math.max(0, Math.min(1.2, val)) * (height - 2 * padding);
    points.push({ x, y });
  }

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  return (
    <div className="space-y-3 p-3 bg-[#121214] rounded-2xl border border-[#27272a] select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-forge-cyan" />
          <span>Velocity & Easing Curves</span>
        </span>
        <span className="text-[10px] font-mono text-forge-cyan capitalize">{easing}</span>
      </div>

      {/* Interactive Spline Graph Box */}
      <div className="relative flex flex-col items-center">
        <svg width={width} height={height} className="bg-[#0b0b0d] rounded-xl border border-white/10 shadow-inner">
          {/* Grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#27272a" />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#27272a" strokeDasharray="3 3" />

          {/* Reference 45-degree diagonal */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={padding}
            stroke="#3f3f46"
            strokeDasharray="4 4"
            opacity={0.3}
          />

          {/* Animated Curve Spline */}
          <path d={pathD} fill="none" stroke="#06B6D4" strokeWidth={2.5} className="transition-all duration-200" />

          {/* End Nodes */}
          <circle cx={padding} cy={height - padding} r={4} fill="#06B6D4" stroke="#000" strokeWidth={1.5} />
          <circle cx={width - padding} cy={padding} r={4} fill="#06B6D4" stroke="#000" strokeWidth={1.5} />
        </svg>
      </div>

      {/* Easing Preset Buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        {EASING_PRESETS.map((preset) => {
          const isSelected = easing === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onChangeEasing(preset.id)}
              className={`p-2 rounded-xl border text-center transition-all ${
                isSelected
                  ? 'bg-forge-cyan text-black font-bold border-forge-cyan shadow-md'
                  : 'bg-[#18181c] text-gray-300 border-white/5 hover:border-gray-500 hover:text-white'
              }`}
              title={preset.description}
            >
              <span className="block text-sm font-mono leading-none mb-1">{preset.icon}</span>
              <span className="block text-[10px] truncate">{preset.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
