import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { Slider } from '../common/Slider';
import {
  Type,
  Palette,
  Sparkles,
  Layers,
  Trash2,
  Move,
  RotateCcw,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../common/Button';

const FONT_OPTIONS = [
  'Outfit',
  'Montserrat',
  'Inter',
  'Syne',
  'Oswald',
  'Playfair Display',
  'Roboto',
  'Bangers',
];

const PRESET_COLORS = [
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#FFFFFF', // White
  '#FACC15', // Yellow
];

export const MotionGraphicsInspector: React.FC = () => {
  const {
    project,
    selectedOverlayId,
    updateOverlay,
    deleteOverlay,
  } = useProject();

  const overlay = project?.overlays.find((o) => o.id === selectedOverlayId);
  if (!overlay) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500 space-y-2">
        <Sparkles className="w-10 h-10 text-gray-600" />
        <span className="text-xs font-bold text-gray-400">No Motion Graphic Selected</span>
        <span className="text-[11px] text-gray-500">
          Click an overlay on the timeline to customize its typography, colors, and scale.
        </span>
      </div>
    );
  }

  const p = (overlay as any).motionParams || {
    title: overlay.title || overlay.text || overlay.name,
    subtitle: overlay.subtitle,
    handle: (overlay as any).handle,
    accentColor: '#06B6D4',
    secondaryColor: '#3B82F6',
    backgroundColor: overlay.backgroundColor || 'rgba(12, 12, 16, 0.9)',
    textColor: overlay.textColor || '#FFFFFF',
    fontFamily: overlay.fontFamily || 'Outfit',
    fontSize: overlay.fontSize || 22,
    scale: overlay.scale || 1.0,
    x: overlay.x ?? 50,
    y: overlay.y ?? 80,
    opacity: overlay.opacity ?? 1.0,
    animationStyle: overlay.animationStyle || 'slide',
  };

  const handleUpdateParams = (updates: Record<string, any>) => {
    const nextParams = { ...p, ...updates };
    updateOverlay(overlay.id, {
      title: nextParams.title,
      subtitle: nextParams.subtitle,
      textColor: nextParams.textColor,
      backgroundColor: nextParams.backgroundColor,
      fontFamily: nextParams.fontFamily,
      fontSize: nextParams.fontSize,
      scale: nextParams.scale,
      x: nextParams.x,
      y: nextParams.y,
      opacity: nextParams.opacity,
      animationStyle: nextParams.animationStyle,
      motionParams: nextParams,
    } as any);
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto p-3 space-y-4 text-xs no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-forge-cyan" />
          <span className="font-bold text-white text-xs truncate max-w-[150px]">
            {overlay.name || 'Motion Graphic'}
          </span>
        </div>
        <button
          onClick={() => deleteOverlay(overlay.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete Template"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Text Inputs */}
      <div className="space-y-2.5 p-3 rounded-2xl bg-[#141416] border border-[#27272a]">
        <div className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-forge-cyan" />
          <span>Content & Typography</span>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 font-medium">Main Title / Headline</label>
          <input
            type="text"
            value={p.title || ''}
            onChange={(e) => handleUpdateParams({ title: e.target.value })}
            className="w-full px-3 py-1.5 bg-[#202024] border border-[#3f3f46] rounded-xl text-white font-bold text-xs focus:outline-none focus:border-forge-cyan"
            placeholder="Main Title..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 font-medium">Subtitle / Secondary Text</label>
          <input
            type="text"
            value={p.subtitle || ''}
            onChange={(e) => handleUpdateParams({ subtitle: e.target.value })}
            className="w-full px-3 py-1.5 bg-[#202024] border border-[#3f3f46] rounded-xl text-gray-200 text-xs focus:outline-none focus:border-forge-cyan"
            placeholder="Subtitle..."
          />
        </div>

        {/* Font Family Picker */}
        <div className="space-y-1 pt-1">
          <label className="text-[10px] text-gray-400 font-medium">Font Family</label>
          <div className="grid grid-cols-2 gap-1.5">
            {FONT_OPTIONS.map((font) => (
              <button
                key={font}
                onClick={() => handleUpdateParams({ fontFamily: font })}
                style={{ fontFamily: font }}
                className={`px-2 py-1.5 rounded-xl border text-center transition-all ${
                  p.fontFamily === font
                    ? 'bg-forge-cyan text-black font-bold border-forge-cyan shadow-sm'
                    : 'bg-[#202024] text-gray-300 border-white/5 hover:border-gray-500'
                }`}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        <Slider
          label="Font Size"
          value={p.fontSize || 22}
          min={12}
          max={72}
          unit="px"
          onChange={(v) => handleUpdateParams({ fontSize: v })}
        />
      </div>

      {/* 2. Color Palette & Styles */}
      <div className="space-y-3 p-3 rounded-2xl bg-[#141416] border border-[#27272a]">
        <div className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-forge-purple" />
          <span>Color & Accent Palette</span>
        </div>

        {/* Quick Accent Color Swatches */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {PRESET_COLORS.map((col) => (
            <button
              key={col}
              onClick={() => handleUpdateParams({ accentColor: col })}
              style={{ backgroundColor: col }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                p.accentColor === col ? 'scale-125 border-white shadow-lg' : 'border-black/50 hover:scale-110'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400">Accent Color</label>
            <div className="flex items-center gap-2 bg-[#202024] p-1.5 rounded-xl border border-[#3f3f46]">
              <input
                type="color"
                value={p.accentColor || '#06B6D4'}
                onChange={(e) => handleUpdateParams({ accentColor: e.target.value })}
                className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
              />
              <span className="font-mono text-[10px] text-gray-300">{p.accentColor}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400">Text Color</label>
            <div className="flex items-center gap-2 bg-[#202024] p-1.5 rounded-xl border border-[#3f3f46]">
              <input
                type="color"
                value={p.textColor || '#FFFFFF'}
                onChange={(e) => handleUpdateParams({ textColor: e.target.value })}
                className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
              />
              <span className="font-mono text-[10px] text-gray-300">{p.textColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Transform, Scale & Coordinates */}
      <div className="space-y-3 p-3 rounded-2xl bg-[#141416] border border-[#27272a]">
        <div className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5 text-forge-amber" />
          <span>Scale & Positioning</span>
        </div>

        <Slider
          label="Overall Scale"
          value={Math.round((p.scale || 1.0) * 100)}
          min={30}
          max={250}
          unit="%"
          onChange={(v) => handleUpdateParams({ scale: v / 100 })}
        />

        <Slider
          label="Horizontal Position (X)"
          value={Math.round(p.x ?? 50)}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => handleUpdateParams({ x: v })}
        />

        <Slider
          label="Vertical Position (Y)"
          value={Math.round(p.y ?? 80)}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => handleUpdateParams({ y: v })}
        />

        <Slider
          label="Opacity"
          value={Math.round((p.opacity ?? 1.0) * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => handleUpdateParams({ opacity: v / 100 })}
        />
      </div>
    </div>
  );
};
