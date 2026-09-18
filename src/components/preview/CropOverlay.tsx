import React, { useState, useRef, useEffect } from 'react';
import { CropRect } from '../../services/renderer/canvasRenderer';
import { RotateCcw, Check, X, Crop, Smartphone, Monitor, Square, Film } from 'lucide-react';

interface CropOverlayProps {
  isOpen: boolean;
  crop: CropRect;
  onChangeCrop: (newCrop: CropRect) => void;
  onClose: () => void;
  containerWidth: number;
  containerHeight: number;
}

type HandleType =
  | 'tl'
  | 't'
  | 'tr'
  | 'r'
  | 'br'
  | 'b'
  | 'bl'
  | 'l';

export const CropOverlay: React.FC<CropOverlayProps> = ({
  isOpen,
  crop,
  onChangeCrop,
  onClose,
  containerWidth,
  containerHeight,
}) => {
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialCrop: CropRect } | null>(null);

  if (!isOpen || containerWidth <= 0 || containerHeight <= 0) return null;

  // Convert percentage crop to container pixel bounds
  const leftPx = (crop.left / 100) * containerWidth;
  const topPx = (crop.top / 100) * containerHeight;
  const rightPx = (crop.right / 100) * containerWidth;
  const bottomPx = (crop.bottom / 100) * containerHeight;

  const widthPx = Math.max(20, containerWidth - leftPx - rightPx);
  const heightPx = Math.max(20, containerHeight - topPx - bottomPx);

  const handleMouseDown = (e: React.MouseEvent, handle: HandleType) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialCrop: { ...crop },
    };
  };

  useEffect(() => {
    if (!activeHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { clientX, clientY, initialCrop } = dragStartRef.current;
      const deltaX = e.clientX - clientX;
      const deltaY = e.clientY - clientY;

      const deltaLeftPercent = (deltaX / containerWidth) * 100;
      const deltaRightPercent = -(deltaX / containerWidth) * 100;
      const deltaTopPercent = (deltaY / containerHeight) * 100;
      const deltaBottomPercent = -(deltaY / containerHeight) * 100;

      let nextTop = initialCrop.top;
      let nextBottom = initialCrop.bottom;
      let nextLeft = initialCrop.left;
      let nextRight = initialCrop.right;

      if (activeHandle.includes('t')) {
        nextTop = Math.max(0, Math.min(100 - initialCrop.bottom - 5, initialCrop.top + deltaTopPercent));
      }
      if (activeHandle.includes('b')) {
        nextBottom = Math.max(0, Math.min(100 - initialCrop.top - 5, initialCrop.bottom + deltaBottomPercent));
      }
      if (activeHandle.includes('l')) {
        nextLeft = Math.max(0, Math.min(100 - initialCrop.right - 5, initialCrop.left + deltaLeftPercent));
      }
      if (activeHandle.includes('r')) {
        nextRight = Math.max(0, Math.min(100 - initialCrop.left - 5, initialCrop.right + deltaRightPercent));
      }

      onChangeCrop({
        top: Math.round(nextTop * 10) / 10,
        bottom: Math.round(nextBottom * 10) / 10,
        left: Math.round(nextLeft * 10) / 10,
        right: Math.round(nextRight * 10) / 10,
      });
    };

    const handleMouseUp = () => {
      setActiveHandle(null);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeHandle, containerWidth, containerHeight, onChangeCrop]);

  const applyPreset = (ratio: '16:9' | '9:16' | '1:1' | 'free' | 'reset') => {
    if (ratio === 'reset' || ratio === 'free') {
      onChangeCrop({ top: 0, bottom: 0, left: 0, right: 0 });
      return;
    }

    let targetRatio = 16 / 9;
    if (ratio === '9:16') targetRatio = 9 / 16;
    if (ratio === '1:1') targetRatio = 1;

    const currentAspect = containerWidth / containerHeight;
    let newCrop: CropRect = { top: 0, bottom: 0, left: 0, right: 0 };

    if (targetRatio < currentAspect) {
      // Need to crop left & right
      const targetW = containerHeight * targetRatio;
      const totalCropWidth = containerWidth - targetW;
      const sidePercent = ((totalCropWidth / 2) / containerWidth) * 100;
      newCrop = { top: 0, bottom: 0, left: Math.round(sidePercent * 10) / 10, right: Math.round(sidePercent * 10) / 10 };
    } else {
      // Need to crop top & bottom
      const targetH = containerWidth / targetRatio;
      const totalCropHeight = containerHeight - targetH;
      const vertPercent = ((totalCropHeight / 2) / containerHeight) * 100;
      newCrop = { top: Math.round(vertPercent * 10) / 10, bottom: Math.round(vertPercent * 10) / 10, left: 0, right: 0 };
    }

    onChangeCrop(newCrop);
  };

  return (
    <div className="absolute inset-0 pointer-events-auto z-40 select-none overflow-hidden">
      {/* 4 Darkened Outside Mask Regions */}
      {/* Top Mask */}
      <div
        style={{ top: 0, left: 0, right: 0, height: `${topPx}px` }}
        className="absolute bg-black/70 backdrop-blur-2xs pointer-events-none"
      />
      {/* Bottom Mask */}
      <div
        style={{ bottom: 0, left: 0, right: 0, height: `${bottomPx}px` }}
        className="absolute bg-black/70 backdrop-blur-2xs pointer-events-none"
      />
      {/* Left Mask */}
      <div
        style={{ top: `${topPx}px`, bottom: `${bottomPx}px`, left: 0, width: `${leftPx}px` }}
        className="absolute bg-black/70 backdrop-blur-2xs pointer-events-none"
      />
      {/* Right Mask */}
      <div
        style={{ top: `${topPx}px`, bottom: `${bottomPx}px`, right: 0, width: `${rightPx}px` }}
        className="absolute bg-black/70 backdrop-blur-2xs pointer-events-none"
      />

      {/* Active Crop Box */}
      <div
        style={{
          top: `${topPx}px`,
          left: `${leftPx}px`,
          width: `${widthPx}px`,
          height: `${heightPx}px`,
        }}
        className="absolute border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)] box-border"
      >
        {/* Rule-of-Thirds Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
          <div className="border-r border-b border-white/25" />
          <div className="border-r border-b border-white/25" />
          <div className="border-b border-white/25" />
          <div className="border-r border-b border-white/25" />
          <div className="border-r border-b border-white/25" />
          <div className="border-b border-white/25" />
          <div className="border-r border-white/25" />
          <div className="border-r border-white/25" />
          <div />
        </div>

        {/* 8 Anchor Handles */}
        {/* Top-Left */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'tl')}
          className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-cyan-500 rounded-xs cursor-nwse-resize shadow-md"
        />
        {/* Top */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 't')}
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-cyan-500 rounded-xs cursor-ns-resize shadow-md"
        />
        {/* Top-Right */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'tr')}
          className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-cyan-500 rounded-xs cursor-nesw-resize shadow-md"
        />
        {/* Right */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'r')}
          className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 bg-white border-2 border-cyan-500 rounded-xs cursor-ew-resize shadow-md"
        />
        {/* Bottom-Right */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'br')}
          className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-cyan-500 rounded-xs cursor-nwse-resize shadow-md"
        />
        {/* Bottom */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'b')}
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-cyan-500 rounded-xs cursor-ns-resize shadow-md"
        />
        {/* Bottom-Left */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'bl')}
          className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-cyan-500 rounded-xs cursor-nesw-resize shadow-md"
        />
        {/* Left */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'l')}
          className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-6 bg-white border-2 border-cyan-500 rounded-xs cursor-ew-resize shadow-md"
        />
      </div>

      {/* Floating Crop Action Toolbar at Top */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-full bg-[#121214]/95 border border-[#27272a] shadow-2xl backdrop-blur-md z-50 text-xs text-white">
        <div className="flex items-center gap-1 px-2 border-r border-[#27272a]">
          <Crop className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-[11px] text-gray-200">Crop Tool</span>
        </div>

        <button
          onClick={() => applyPreset('free')}
          className="px-2.5 py-1 rounded-full hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-semibold transition-colors"
        >
          Freeform
        </button>

        <button
          onClick={() => applyPreset('16:9')}
          className="px-2.5 py-1 rounded-full hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <Monitor className="w-3 h-3" /> 16:9
        </button>

        <button
          onClick={() => applyPreset('9:16')}
          className="px-2.5 py-1 rounded-full hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <Smartphone className="w-3 h-3" /> 9:16
        </button>

        <button
          onClick={() => applyPreset('1:1')}
          className="px-2.5 py-1 rounded-full hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <Square className="w-3 h-3" /> 1:1
        </button>

        <button
          onClick={() => applyPreset('reset')}
          className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="Reset Crop to Original"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-[#27272a] mx-0.5" />

        <button
          onClick={onClose}
          className="px-3 py-1 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all"
        >
          <Check className="w-3 h-3 stroke-[3]" /> Done
        </button>
      </div>
    </div>
  );
};
