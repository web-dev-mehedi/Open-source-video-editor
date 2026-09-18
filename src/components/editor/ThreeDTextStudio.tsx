import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { ThreeDTextConfig, DEFAULT_3D_TEXT_CONFIG } from '../../types/threeDText';
import {
  Box,
  RotateCcw,
  Sparkles,
  Sun,
  Layers,
  Sliders,
} from 'lucide-react';

export const ThreeDTextStudio: React.FC = () => {
  const { project, updateActiveStyle } = useProject();

  const config: ThreeDTextConfig = (project?.activeStyle as any)?.threeDText || DEFAULT_3D_TEXT_CONFIG;

  const handleUpdate = (updates: Partial<ThreeDTextConfig>) => {
    const newConfig: ThreeDTextConfig = { ...config, ...updates };
    updateActiveStyle({ threeDText: newConfig } as any);
  };

  const handleReset = () => {
    updateActiveStyle({ threeDText: DEFAULT_3D_TEXT_CONFIG } as any);
  };

  const materials: { id: ThreeDTextConfig['material']; label: string; desc: string }[] = [
    { id: 'glossy', label: 'Glossy', desc: 'Specular sheen highlight' },
    { id: 'metallic', label: 'Metallic', desc: 'Brushed chrome gradient' },
    { id: 'neon_glow', label: 'Neon 3D', desc: 'Glowing extruded edges' },
    { id: 'matte', label: 'Matte', desc: 'Flat solid depth' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-amber-400" />
            <span>3D Text & Extrusion Studio</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Volumetric depth, Blinn-Phong lighting & bevels
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset 3D Text"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f23] border border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-200 block">3D Volumetric Depth</span>
              <span className="text-[10px] text-gray-400">
                Extrude caption letters with 3D geometry
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.isEnabled}
            onChange={(e) => handleUpdate({ isEnabled: e.target.checked })}
            className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-amber-400 focus:ring-amber-400 cursor-pointer"
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Materials Selection */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Material Finish
              </span>
              <div className="grid grid-cols-2 gap-2">
                {materials.map((m) => {
                  const isSelected = config.material === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleUpdate({ material: m.id })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/40 text-white ring-1 ring-amber-400 shadow-sm'
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

            {/* Extrusion Depth Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Extrusion Depth</span>
                <span className="font-mono text-amber-400">{config.depth}px</span>
              </div>
              <input
                type="range"
                min="2"
                max="35"
                value={config.depth}
                onChange={(e) => handleUpdate({ depth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Light Direction Angle Slider */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Lighting & Shadow Angle</span>
                <span className="font-mono text-forge-cyan">{config.angle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={config.angle}
                onChange={(e) => handleUpdate({ angle: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
              />
            </div>

            {/* Specular Highlight Shine */}
            {config.material === 'glossy' && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-semibold">Specular Shine Gloss</span>
                  <span className="font-mono text-forge-purple">{config.specularShine}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.specularShine}
                  onChange={(e) => handleUpdate({ specularShine: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>
            )}

            {/* Extrusion Color */}
            <div className="p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-200 block">Extrusion Base Color</span>
                <span className="text-[10px] text-gray-400">Color of side wall depth slices</span>
              </div>
              <input
                type="color"
                value={config.extrusionColor || '#0f172a'}
                onChange={(e) => handleUpdate({ extrusionColor: e.target.value })}
                className="w-8 h-8 rounded border border-[#3f3f46] bg-[#121214] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
