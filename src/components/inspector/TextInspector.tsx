import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { OverlayElement } from '../../types/project';
import {
  Type,
  Sliders,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Trash2,
  Layers,
  Copy,
  RotateCw,
  Eye,
  Box,
  Wand2,
} from 'lucide-react';

const FONT_FAMILIES = [
  'Inter',
  'Montserrat',
  'Roboto',
  'Poppins',
  'Impact',
  'Arial',
  'Oswald',
  'Cinzel',
  'Courier New',
  'Georgia',
];

const FONT_WEIGHTS = [
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'SemiBold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Black', value: '900' },
];

export const TextInspector: React.FC = () => {
  const {
    project,
    selectedOverlayId,
    updateOverlay,
    deleteOverlay,
    setSelectedOverlayId,
  } = useProject();

  const [activeTab, setActiveTab] = useState<'text' | 'style' | 'transform' | 'animation'>('text');

  const overlay = project?.overlays?.find((ov) => ov.id === selectedOverlayId);

  if (!overlay) {
    return (
      <div className="p-4 text-xs text-neutral-500 text-center flex flex-col items-center justify-center h-full space-y-2">
        <Type className="w-8 h-8 text-neutral-600" />
        <p className="font-semibold text-neutral-400">Select a text layer on timeline</p>
        <p className="text-[11px] text-neutral-600">Typography, colors, stroke, shadow, and animations will appear here.</p>
      </div>
    );
  }

  const handleUpdate = (updates: Partial<OverlayElement>) => {
    updateOverlay(overlay.id, updates);
  };

  return (
    <div className="flex flex-col h-full bg-[#121214] text-gray-200 select-none overflow-hidden font-sans">
      {/* Header */}
      <div className="h-10 border-b border-[#27272a] bg-[#18181c] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-forge-cyan" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            {overlay.type === 'element' ? 'Element Properties' : 'Text Inspector'}
          </span>
        </div>
        <button
          onClick={() => deleteOverlay(overlay.id)}
          className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition-colors"
          title="Delete layer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="h-9 border-b border-[#27272a] bg-[#121214] flex items-center px-2 gap-1 flex-shrink-0">
        {[
          { id: 'text', label: 'Content' },
          { id: 'style', label: 'Style & Color' },
          { id: 'transform', label: 'Transform' },
          { id: 'animation', label: 'Animation' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#27272a] text-forge-cyan shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {/* TAB 1: TEXT CONTENT & TYPOGRAPHY */}
        {activeTab === 'text' && (
          <div className="space-y-3">
            {/* Text Input */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Text Content</label>
              <textarea
                value={overlay.text || overlay.title || ''}
                onChange={(e) => handleUpdate({ text: e.target.value, title: e.target.value, name: e.target.value.slice(0, 20) })}
                rows={3}
                placeholder="Enter text..."
                className="w-full px-2.5 py-1.5 bg-[#18181c] border border-[#27272a] rounded-lg text-white font-medium focus:outline-none focus:border-forge-cyan resize-none"
              />
            </div>

            {/* Subtitle / Description (optional) */}
            {overlay.subtitle !== undefined && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">Subtitle / Tagline</label>
                <input
                  type="text"
                  value={overlay.subtitle || ''}
                  onChange={(e) => handleUpdate({ subtitle: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[#18181c] border border-[#27272a] rounded-lg text-white font-medium focus:outline-none focus:border-forge-cyan"
                />
              </div>
            )}

            {/* Font Family */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Font Family</label>
              <select
                value={overlay.fontFamily || 'Inter'}
                onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
                className="w-full px-2 py-1.5 bg-[#18181c] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-forge-cyan"
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Weight & Size */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">Weight</label>
                <select
                  value={overlay.fontWeight || '700'}
                  onChange={(e) => handleUpdate({ fontWeight: e.target.value })}
                  className="w-full px-2 py-1.5 bg-[#18181c] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-forge-cyan"
                >
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Size</label>
                  <span className="text-[10px] font-mono text-gray-400">{overlay.fontSize || 40}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="120"
                  value={overlay.fontSize || 40}
                  onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value, 10) })}
                  className="w-full accent-forge-cyan"
                />
              </div>
            </div>

            {/* Alignment */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Alignment</label>
              <div className="grid grid-cols-3 gap-1 bg-[#18181c] border border-[#27272a] p-1 rounded-lg">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => handleUpdate({ alignment: align })}
                    className={`py-1 rounded flex items-center justify-center transition-all ${
                      (overlay.alignment || 'center') === align
                        ? 'bg-forge-cyan text-black font-bold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                    {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                    {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STYLE, COLOR, STROKE, SHADOW */}
        {activeTab === 'style' && (
          <div className="space-y-3">
            {/* Text Color */}
            <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">Text Color</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={overlay.textColor?.startsWith('#') ? overlay.textColor : '#FFFFFF'}
                    onChange={(e) => handleUpdate({ textColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-[10px] text-gray-400">{overlay.textColor || '#FFFFFF'}</span>
                </div>
              </div>
            </div>

            {/* Stroke / Outline */}
            <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">Stroke / Outline</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={overlay.strokeColor?.startsWith('#') ? overlay.strokeColor : '#000000'}
                    onChange={(e) => handleUpdate({ strokeColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Width</span>
                  <span>{overlay.strokeWidth || 0}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  value={overlay.strokeWidth || 0}
                  onChange={(e) => handleUpdate({ strokeWidth: parseInt(e.target.value, 10) })}
                  className="w-full accent-forge-cyan"
                />
              </div>
            </div>

            {/* Shadow */}
            <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">Shadow / Glow</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={overlay.shadowColor?.startsWith('#') ? overlay.shadowColor : '#000000'}
                    onChange={(e) => handleUpdate({ shadowColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Blur Radius</span>
                  <span>{overlay.shadowBlur || 0}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={overlay.shadowBlur || 0}
                  onChange={(e) => handleUpdate({ shadowBlur: parseInt(e.target.value, 10) })}
                  className="w-full accent-forge-cyan"
                />
              </div>
            </div>

            {/* Background Box */}
            <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">Background Pill / Box</span>
                {overlay.backgroundColor ? (
                  <button
                    onClick={() => handleUpdate({ backgroundColor: undefined })}
                    className="text-[10px] text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdate({ backgroundColor: 'rgba(0,0,0,0.7)', backgroundPadding: 16, backgroundRadius: 8 })}
                    className="text-[10px] text-forge-cyan hover:underline"
                  >
                    Enable
                  </button>
                )}
              </div>

              {overlay.backgroundColor && (
                <div className="space-y-2 pt-1 border-t border-[#27272a]">
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>Corner Radius</span>
                    <span>{overlay.backgroundRadius || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={overlay.backgroundRadius || 0}
                    onChange={(e) => handleUpdate({ backgroundRadius: parseInt(e.target.value, 10) })}
                    className="w-full accent-forge-cyan"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRANSFORM */}
        {activeTab === 'transform' && (
          <div className="space-y-3">
            {/* Position X / Y */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Position X</span>
                  <span>{Math.round(overlay.x)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(overlay.x)}
                  onChange={(e) => handleUpdate({ x: parseFloat(e.target.value) })}
                  className="w-full accent-forge-cyan"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Position Y</span>
                  <span>{Math.round(overlay.y)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(overlay.y)}
                  onChange={(e) => handleUpdate({ y: parseFloat(e.target.value) })}
                  className="w-full accent-forge-cyan"
                />
              </div>
            </div>

            {/* Scale */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>Scale</span>
                <span>{Math.round((overlay.scale || 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.05"
                value={overlay.scale || 1}
                onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) })}
                className="w-full accent-forge-cyan"
              />
            </div>

            {/* Rotation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>Rotation</span>
                <span>{Math.round(overlay.rotation || 0)}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={overlay.rotation || 0}
                onChange={(e) => handleUpdate({ rotation: parseInt(e.target.value, 10) })}
                className="w-full accent-forge-cyan"
              />
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>Opacity</span>
                <span>{Math.round((overlay.opacity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={overlay.opacity ?? 1}
                onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-forge-cyan"
              />
            </div>

            {/* Quick Reset */}
            <button
              onClick={() => handleUpdate({ x: 50, y: 50, scale: 1.0, rotation: 0, opacity: 1.0 })}
              className="w-full py-1.5 rounded-lg bg-[#18181c] hover:bg-[#202024] border border-[#27272a] text-gray-400 hover:text-white text-[11px] font-bold transition-colors"
            >
              Reset Transform to Center
            </button>
          </div>
        )}

        {/* TAB 4: ANIMATION */}
        {activeTab === 'animation' && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-gray-400">Entry Animation</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'none', label: 'None' },
                { id: 'fade', label: 'Fade In' },
                { id: 'zoom', label: 'Zoom Pop' },
                { id: 'slide', label: 'Slide Up' },
                { id: 'pop', label: 'Bouncy Pop' },
                { id: 'typewriter', label: 'Typewriter' },
              ].map((anim) => (
                <button
                  key={anim.id}
                  onClick={() => handleUpdate({ animationStyle: anim.id as any })}
                  className={`p-2 rounded-lg border text-left text-xs font-bold transition-all ${
                    (overlay.animationStyle || 'fade') === anim.id
                      ? 'bg-[#27272a] border-forge-cyan text-white shadow-sm'
                      : 'bg-[#18181c] border-[#27272a] text-gray-400 hover:text-white'
                  }`}
                >
                  {anim.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TextInspector;
