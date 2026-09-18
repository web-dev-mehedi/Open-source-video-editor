import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ColorGradingConfig, DEFAULT_COLOR_GRADING, CurvePoint, ColorWheelValue } from '../../types/colorGrading';
import { Slider } from '../common/Slider';
import {
  Palette,
  Sun,
  Moon,
  Sparkles,
  Sliders,
  RotateCcw,
  Check,
  Eye,
  EyeOff,
  Flame,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../common/Button';

export const ColorGradingStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();
  const activeClip = project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  const [config, setConfig] = useState<ColorGradingConfig>(() => {
    return (activeClip as any)?.colorGrading || { ...DEFAULT_COLOR_GRADING };
  });

  const [activeCurveChannel, setActiveCurveChannel] = useState<'master' | 'red' | 'green' | 'blue'>('master');
  const [activeSubTab, setActiveSubTab] = useState<'wheels' | 'curves' | 'basics'>('wheels');

  useEffect(() => {
    if ((activeClip as any)?.colorGrading) {
      setConfig((activeClip as any).colorGrading);
    }
  }, [activeClip?.id]);

  const updateGrading = (updates: Partial<ColorGradingConfig>) => {
    const next = { ...config, ...updates };
    setConfig(next);
    if (activeClip) {
      updateClip(activeClip.id, { colorGrading: next } as any);
    }
  };

  const handleResetAll = () => {
    setConfig({ ...DEFAULT_COLOR_GRADING });
    if (activeClip) {
      updateClip(activeClip.id, { colorGrading: { ...DEFAULT_COLOR_GRADING } } as any);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-hidden text-xs">
      {/* Sub-Header Workspace Tabs */}
      <div className="h-10 bg-[#121214] border-b border-[#27272a] px-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('wheels')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'wheels'
                ? 'bg-forge-purple text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e1e22]'
            }`}
          >
            3-Way Wheels
          </button>
          <button
            onClick={() => setActiveSubTab('curves')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'curves'
                ? 'bg-forge-purple text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e1e22]'
            }`}
          >
            RGB Curves
          </button>
          <button
            onClick={() => setActiveSubTab('basics')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'basics'
                ? 'bg-forge-purple text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e1e22]'
            }`}
          >
            Basic Tones
          </button>
        </div>

        <button
          onClick={handleResetAll}
          className="p-1 rounded text-gray-400 hover:text-red-400 transition-colors"
          title="Reset All Color Grading"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
        {/* 1. 3-Way Color Wheels (Lift, Gamma, Gain) */}
        {activeSubTab === 'wheels' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <ColorWheel
                title="Lift (Shadows)"
                value={config.lift}
                color="#38BDF8"
                onChange={(val) => updateGrading({ lift: val })}
              />
              <ColorWheel
                title="Gamma (Mids)"
                value={config.gamma}
                color="#818CF8"
                onChange={(val) => updateGrading({ gamma: val })}
              />
              <ColorWheel
                title="Gain (Highs)"
                value={config.gain}
                color="#F59E0B"
                onChange={(val) => updateGrading({ gain: val })}
              />
            </div>

            {/* Master Offset Wheel */}
            <div className="p-3 rounded-xl bg-[#141416] border border-[#27272a] flex items-center justify-between">
              <div className="w-32">
                <ColorWheel
                  title="Offset (Global)"
                  value={config.offset}
                  color="#A855F7"
                  size={90}
                  onChange={(val) => updateGrading({ offset: val })}
                />
              </div>
              <div className="flex-1 pl-4 space-y-2">
                <Slider
                  label="Temperature"
                  value={config.temperature}
                  min={-100}
                  max={100}
                  unit=""
                  onChange={(v) => updateGrading({ temperature: v })}
                />
                <Slider
                  label="Tint"
                  value={config.tint}
                  min={-100}
                  max={100}
                  unit=""
                  onChange={(v) => updateGrading({ tint: v })}
                />
                <Slider
                  label="Saturation"
                  value={config.saturation}
                  min={0}
                  max={200}
                  unit="%"
                  onChange={(v) => updateGrading({ saturation: v })}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Interactive RGB Curves Editor */}
        {activeSubTab === 'curves' && (
          <div className="space-y-3">
            {/* Channel Selector */}
            <div className="flex items-center justify-center gap-1 bg-[#121214] p-1 rounded-xl border border-[#27272a]">
              {(['master', 'red', 'green', 'blue'] as const).map((ch) => {
                const isSelected = activeCurveChannel === ch;
                const bg =
                  ch === 'red'
                    ? 'text-red-400'
                    : ch === 'green'
                    ? 'text-green-400'
                    : ch === 'blue'
                    ? 'text-blue-400'
                    : 'text-white';

                return (
                  <button
                    key={ch}
                    onClick={() => setActiveCurveChannel(ch)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                      isSelected
                        ? 'bg-[#27272a] ' + bg + ' border border-white/20 shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>

            {/* Interactive Spline Curve Box */}
            <div className="bg-[#121214] p-2 rounded-2xl border border-[#27272a] shadow-inner flex flex-col items-center">
              <InteractiveCurveEditor
                points={config.curves[activeCurveChannel]}
                channel={activeCurveChannel}
                onChange={(newPoints) => {
                  const updatedCurves = {
                    ...config.curves,
                    [activeCurveChannel]: newPoints,
                  };
                  updateGrading({ curves: updatedCurves });
                }}
              />
              <div className="text-[10px] text-gray-500 mt-2">
                Click line to add point • Drag points to shape curve
              </div>
            </div>
          </div>
        )}

        {/* 3. Basic Color & Exposure Tones */}
        {activeSubTab === 'basics' && (
          <div className="space-y-3 p-3 rounded-2xl bg-[#141416] border border-[#27272a]">
            <Slider
              label="Contrast"
              value={config.contrast}
              min={-100}
              max={100}
              unit="%"
              onChange={(v) => updateGrading({ contrast: v })}
            />
            <Slider
              label="Highlights"
              value={config.highlights}
              min={-100}
              max={100}
              unit="%"
              onChange={(v) => updateGrading({ highlights: v })}
            />
            <Slider
              label="Shadows"
              value={config.shadows}
              min={-100}
              max={100}
              unit="%"
              onChange={(v) => updateGrading({ shadows: v })}
            />
            <Slider
              label="Whites"
              value={config.whites}
              min={-100}
              max={100}
              unit="%"
              onChange={(v) => updateGrading({ whites: v })}
            />
            <Slider
              label="Blacks"
              value={config.blacks}
              min={-100}
              max={100}
              unit="%"
              onChange={(v) => updateGrading({ blacks: v })}
            />
            <Slider
              label="Vibrance"
              value={config.vibrance}
              min={-100}
              max={100}
              unit="%"
              onChange={(v) => updateGrading({ vibrance: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Interactive 2D Color Wheel Component with Draggable Puck
// -------------------------------------------------------------
const ColorWheel: React.FC<{
  title: string;
  value: ColorWheelValue;
  color: string;
  size?: number;
  onChange: (val: ColorWheelValue) => void;
}> = ({ title, value, color, size = 95, onChange }) => {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const radius = size / 2;

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = wheelRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + radius;
    const cy = rect.top + radius;

    const onMove = (me: MouseEvent) => {
      const dx = (me.clientX - cx) / radius;
      const dy = (me.clientY - cy) / radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(1, dist);
      const angleRad = Math.atan2(dy, dx);

      const clampedX = Math.cos(angleRad) * clampedDist;
      const clampedY = Math.sin(angleRad) * clampedDist;
      const hue = Math.round(((angleRad * 180) / Math.PI + 360) % 360);
      const saturation = Math.round(clampedDist * 100);

      onChange({
        ...value,
        x: Math.round(clampedX * 100) / 100,
        y: Math.round(clampedY * 100) / 100,
        hue,
        saturation,
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const puckX = radius + value.x * (radius - 6);
  const puckY = radius + value.y * (radius - 6);

  return (
    <div className="flex flex-col items-center bg-[#121214] p-2 rounded-2xl border border-[#27272a] select-none">
      <span className="text-[11px] font-bold text-gray-300 mb-1">{title}</span>

      {/* 2D Color Spectrum Disc */}
      <div
        ref={wheelRef}
        onMouseDown={handleMouseDown}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="relative rounded-full cursor-crosshair overflow-hidden shadow-inner border border-white/10"
      >
        {/* Conic Gradient Color Spectrum */}
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] opacity-75" />
        {/* Radial Center Desaturation & Shadow */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,white_0%,transparent_75%,rgba(0,0,0,0.6)_100%)] opacity-80" />

        {/* Center Crosshair */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/20 -translate-x-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/20 -translate-y-1/2 pointer-events-none" />

        {/* Draggable Puck Indicator */}
        <div
          style={{ left: `${puckX}px`, top: `${puckY}px` }}
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white bg-black/80 shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        />
      </div>

      {/* Luminance Level Slider */}
      <div className="w-full mt-2">
        <input
          type="range"
          min={-100}
          max={100}
          value={value.luma}
          onChange={(e) => onChange({ ...value, luma: parseInt(e.target.value) })}
          className="w-full h-1 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
        />
        <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 mt-0.5">
          <span>Luma</span>
          <span className={value.luma !== 0 ? 'text-forge-cyan font-bold' : ''}>{value.luma}</span>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Interactive SVG Spline Curve Editor
// -------------------------------------------------------------
const InteractiveCurveEditor: React.FC<{
  points: CurvePoint[];
  channel: 'master' | 'red' | 'green' | 'blue';
  onChange: (pts: CurvePoint[]) => void;
}> = ({ points, channel, onChange }) => {
  const svgSize = 190;
  const strokeColor =
    channel === 'red'
      ? '#EF4444'
      : channel === 'green'
      ? '#22C55E'
      : channel === 'blue'
      ? '#3B82F6'
      : '#FFFFFF';

  const sortedPoints = [...points].sort((a, b) => a.x - b.x);

  // Generate SVG path command
  const pathD = sortedPoints.reduce((acc, pt, idx) => {
    const px = pt.x * svgSize;
    const py = (1 - pt.y) * svgSize;
    return idx === 0 ? `M ${px} ${py}` : `${acc} L ${px} ${py}`;
  }, '');

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(1, (e.clientX - rect.left) / svgSize));
    const clickY = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / svgSize));

    const newPts = [...points, { x: Math.round(clickX * 100) / 100, y: Math.round(clickY * 100) / 100 }].sort(
      (a, b) => a.x - b.x
    );
    onChange(newPts);
  };

  const handlePointDrag = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const svgEl = (e.currentTarget.parentNode as Element).getBoundingClientRect();

    const onMove = (me: MouseEvent) => {
      const curX = Math.max(0, Math.min(1, (me.clientX - svgEl.left) / svgSize));
      const curY = Math.max(0, Math.min(1, 1 - (me.clientY - svgEl.top) / svgSize));

      const updated = points.map((p, idx) => {
        if (idx === index) {
          return {
            x: idx === 0 ? 0 : idx === points.length - 1 ? 1 : Math.round(curX * 100) / 100,
            y: Math.round(curY * 100) / 100,
          };
        }
        return p;
      });
      onChange(updated);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <svg
      width={svgSize}
      height={svgSize}
      onClick={handleSvgClick}
      className="bg-[#0b0b0d] rounded-xl border border-white/10 cursor-crosshair select-none"
    >
      {/* Background Grid Lines */}
      <line x1={0} y1={svgSize * 0.25} x2={svgSize} y2={svgSize * 0.25} stroke="#27272a" strokeDasharray="3 3" />
      <line x1={0} y1={svgSize * 0.5} x2={svgSize} y2={svgSize * 0.5} stroke="#3f3f46" strokeDasharray="2 2" />
      <line x1={0} y1={svgSize * 0.75} x2={svgSize} y2={svgSize * 0.75} stroke="#27272a" strokeDasharray="3 3" />
      <line x1={svgSize * 0.25} y1={0} x2={svgSize * 0.25} y2={svgSize} stroke="#27272a" strokeDasharray="3 3" />
      <line x1={svgSize * 0.5} y1={0} x2={svgSize * 0.5} y2={svgSize} stroke="#3f3f46" strokeDasharray="2 2" />
      <line x1={svgSize * 0.75} y1={0} x2={svgSize * 0.75} y2={svgSize} stroke="#27272a" strokeDasharray="3 3" />

      {/* 45-degree diagonal reference line */}
      <line x1={0} y1={svgSize} x2={svgSize} y2={0} stroke="#3f3f46" strokeDasharray="4 4" opacity={0.4} />

      {/* Spline Path */}
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={2.5} className="transition-all" />

      {/* Draggable Control Points */}
      {points.map((pt, idx) => (
        <circle
          key={idx}
          cx={pt.x * svgSize}
          cy={(1 - pt.y) * svgSize}
          r={5}
          fill={strokeColor}
          stroke="#000000"
          strokeWidth={2}
          onMouseDown={(e) => handlePointDrag(e, idx)}
          className="cursor-pointer hover:scale-125 transition-transform"
        />
      ))}
    </svg>
  );
};
