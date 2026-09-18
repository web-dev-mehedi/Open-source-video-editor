import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { MaskConfig, MaskShapeType, DEFAULT_MASK_CONFIG } from '../../types/masking';
import {
  Square,
  Circle,
  Film,
  SplitSquareVertical,
  FlipHorizontal,
  RotateCcw,
  Sparkles,
  Sliders,
  Eye,
  EyeOff,
  Heart,
} from 'lucide-react';

export const MaskStudio: React.FC = () => {
  const { project, selectedClipId, updateClip } = useProject();

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Film className="w-8 h-8 mb-2 opacity-40 text-forge-purple" />
        <p className="font-semibold text-gray-300">No Video Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to apply shape masks</p>
      </div>
    );
  }

  const mask: MaskConfig = activeClip.mask || DEFAULT_MASK_CONFIG;

  const handleUpdateMask = (updates: Partial<MaskConfig>) => {
    const newMask: MaskConfig = { ...mask, ...updates };
    updateClip(activeClip.id, { mask: newMask });
  };

  const handleSelectShape = (type: MaskShapeType) => {
    handleUpdateMask({ type });
  };

  const handleResetMask = () => {
    updateClip(activeClip.id, { mask: DEFAULT_MASK_CONFIG });
  };

  const maskShapes: { type: MaskShapeType; label: string; icon: React.ReactNode }[] = [
    { type: 'none', label: 'None', icon: <Square className="w-4 h-4 opacity-30" /> },
    { type: 'linear', label: 'Linear Split', icon: <SplitSquareVertical className="w-4 h-4 text-forge-cyan" /> },
    { type: 'mirror', label: 'Mirror', icon: <FlipHorizontal className="w-4 h-4 text-forge-purple" /> },
    { type: 'radial', label: 'Radial', icon: <Circle className="w-4 h-4 text-amber-400" /> },
    { type: 'rectangle', label: 'Rectangle', icon: <Square className="w-4 h-4 text-emerald-400" /> },
    { type: 'filmstrip', label: 'Filmstrip', icon: <Film className="w-4 h-4 text-sky-400" /> },
    { type: 'heart', label: 'Heart', icon: <Heart className="w-4 h-4 text-pink-400" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Geometric & Path Masking</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Shape masks, cinematic letterbox & feathered split screens
          </p>
        </div>

        {mask.type !== 'none' && (
          <button
            onClick={handleResetMask}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Mask"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Shape Preset Selection Cards */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
            Mask Shape
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {maskShapes.map((shape) => {
              const isSelected = mask.type === shape.type;
              return (
                <button
                  key={shape.type}
                  onClick={() => handleSelectShape(shape.type)}
                  className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                    isSelected
                      ? 'border-forge-purple bg-purple-950/40 text-white ring-1 ring-forge-purple shadow-sm'
                      : 'border-[#27272a] bg-[#1f1f23] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {shape.icon}
                  <span className="truncate w-full text-center">{shape.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {mask.type !== 'none' && (
          <div className="space-y-3.5 pt-2 border-t border-[#27272a]">
            {/* Invert Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex items-center gap-2">
                {mask.isInverted ? (
                  <EyeOff className="w-4 h-4 text-forge-purple" />
                ) : (
                  <Eye className="w-4 h-4 text-forge-cyan" />
                )}
                <div>
                  <span className="text-xs font-bold text-gray-200">Invert Mask</span>
                  <p className="text-[10px] text-gray-400">
                    {mask.isInverted ? 'Hiding area inside shape' : 'Showing area inside shape'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={mask.isInverted}
                onChange={(e) => handleUpdateMask({ isInverted: e.target.checked })}
                className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-purple focus:ring-forge-purple cursor-pointer"
              />
            </div>

            {/* Filmstrip Bar Height */}
            {mask.type === 'filmstrip' && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-semibold">Letterbox Black Bars</span>
                  <span className="font-mono text-forge-cyan">{mask.filmstripBarHeight || 12}%</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="35"
                  step="1"
                  value={mask.filmstripBarHeight || 12}
                  onChange={(e) => handleUpdateMask({ filmstripBarHeight: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
                />
                <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                  <span>2.35:1 Cinematic</span>
                  <span>Classic 16:9</span>
                  <span>Ultra-Wide</span>
                </div>
              </div>
            )}

            {/* Position Center X / Y */}
            {mask.type !== 'filmstrip' && (
              <div className="space-y-2 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <span className="text-xs font-bold text-gray-200 block">Center Position</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>X</span>
                      <span className="font-mono text-forge-cyan">{mask.centerX}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={mask.centerX}
                      onChange={(e) => handleUpdateMask({ centerX: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Y</span>
                      <span className="font-mono text-forge-cyan">{mask.centerY}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={mask.centerY}
                      onChange={(e) => handleUpdateMask({ centerY: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Size Width / Height */}
            {(mask.type === 'radial' || mask.type === 'rectangle' || mask.type === 'mirror') && (
              <div className="space-y-2 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <span className="text-xs font-bold text-gray-200 block">Mask Scale & Dimensions</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Width</span>
                      <span className="font-mono text-forge-purple">{mask.width}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={mask.width}
                      onChange={(e) => handleUpdateMask({ width: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Height</span>
                      <span className="font-mono text-forge-purple">{mask.height}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={mask.height}
                      onChange={(e) => handleUpdateMask({ height: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rotation Angle */}
            {(mask.type === 'linear' || mask.type === 'mirror' || mask.type === 'rectangle' || mask.type === 'radial') && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-semibold">Rotation Angle</span>
                  <span className="font-mono text-forge-cyan">{mask.rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={mask.rotation}
                  onChange={(e) => handleUpdateMask({ rotation: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
                />
              </div>
            )}

            {/* Feathering (Soft Edges) */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-semibold">Edge Feathering (Softness)</span>
                <span className="font-mono text-amber-400">{mask.feather}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={mask.feather}
                onChange={(e) => handleUpdateMask({ feather: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <p className="text-[10px] text-gray-500">
                Smooth antialiased edge transition gradient
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
