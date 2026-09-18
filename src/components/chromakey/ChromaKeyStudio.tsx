import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { ChromaKeyConfig, DEFAULT_CHROMA_KEY } from '../../types/chromaKey';
import { Slider } from '../common/Slider';
import {
  Pipette,
  Sparkles,
  Eye,
  Sliders,
  Layers,
  Palette,
  ShieldAlert,
} from 'lucide-react';

const COMMON_KEY_COLORS = [
  { name: 'Green Screen', hex: '#00FF00', bg: 'bg-[#00FF00]' },
  { name: 'Blue Screen', hex: '#0000FF', bg: 'bg-[#0000FF]' },
  { name: 'Pure White', hex: '#FFFFFF', bg: 'bg-[#FFFFFF]' },
  { name: 'Pure Black', hex: '#000000', bg: 'bg-[#000000]' },
];

export const ChromaKeyStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();

  const clip = project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  const config: ChromaKeyConfig = (clip as any)?.chromaKey || DEFAULT_CHROMA_KEY;

  const handleUpdate = (updates: Partial<ChromaKeyConfig>) => {
    if (!clip) return;
    const nextConfig = { ...config, ...updates };
    updateClip(clip.id, { chromaKey: nextConfig } as any);
  };

  return (
    <div className="space-y-4 p-4 bg-[#141416] rounded-2xl border border-[#27272a] text-gray-200 select-none text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400">
            <Palette className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-white text-xs block">Chroma Key / Green Screen</span>
            <span className="text-[10px] text-gray-400 block">Manual background color removal</span>
          </div>
        </div>

        <button
          onClick={() => handleUpdate({ enabled: !config.enabled })}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow-sm ${
            config.enabled
              ? 'bg-green-500 text-black font-bold shadow-[0_0_10px_rgba(34,197,94,0.5)]'
              : 'bg-[#202024] text-gray-400 border border-white/5'
          }`}
        >
          {config.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {config.enabled && (
        <div className="space-y-3.5">
          {/* Key Color Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Sampled Key Color
              </span>
              <span className="font-mono text-forge-cyan text-[11px] font-bold">{config.keyColor}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#202024] p-1.5 rounded-xl border border-[#3f3f46] flex-1">
                <input
                  type="color"
                  value={config.keyColor || '#00FF00'}
                  onChange={(e) => handleUpdate({ keyColor: e.target.value })}
                  className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <span className="text-xs text-gray-300 font-semibold">Custom Key Color</span>
              </div>

              {/* Color Presets */}
              <div className="flex items-center gap-1.5">
                {COMMON_KEY_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => handleUpdate({ keyColor: col.hex })}
                    style={{ backgroundColor: col.hex }}
                    className={`w-7 h-7 rounded-lg border transition-transform ${
                      config.keyColor === col.hex ? 'scale-110 border-white shadow-lg' : 'border-black/50 hover:scale-105'
                    }`}
                    title={col.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sliders */}
          <Slider
            label="Tolerance / Similarity"
            value={config.similarity}
            min={1}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => handleUpdate({ similarity: v })}
          />

          <Slider
            label="Edge Softness / Smoothness"
            value={config.smoothness}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => handleUpdate({ smoothness: v })}
          />

          <Slider
            label="Spill Suppression (Defringe)"
            value={config.spillReduction}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => handleUpdate({ spillReduction: v })}
          />

          {/* Matte Only View Toggle */}
          <div className="pt-2 border-t border-[#27272a] flex items-center justify-between">
            <span className="text-xs text-gray-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-gray-400" />
              <span>Show Alpha Matte (B&W Mask)</span>
            </span>

            <button
              onClick={() => handleUpdate({ maskOnly: !config.maskOnly })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                config.maskOnly
                  ? 'bg-forge-cyan text-black font-bold'
                  : 'bg-[#202024] text-gray-400 hover:text-white'
              }`}
            >
              {config.maskOnly ? 'Matte Active' : 'Off'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
