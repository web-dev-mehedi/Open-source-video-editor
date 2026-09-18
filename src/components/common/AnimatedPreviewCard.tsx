import React, { useState, useRef, useEffect } from 'react';
import { EffectPreset } from '../../data/effectsPresets';
import { setDragPayload } from '../../utils/nleDnD';
import { Plus, Check, Star, Sparkles, Film, Sun, Palette, Zap } from 'lucide-react';

interface AnimatedPreviewCardProps {
  preset: EffectPreset;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onApply: (preset: EffectPreset) => void;
  isSelected?: boolean;
}

export const AnimatedPreviewCard: React.FC<AnimatedPreviewCardProps> = ({
  preset,
  isFavorite,
  onToggleFavorite,
  onApply,
  isSelected = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Lazy loading observer for high-performance viewport rendering
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { rootMargin: '100px' }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApply(preset);
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 1400);
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Unified DnD bus: dataTransfer + window slot so track dragover ghosts
    // work in every browser. Consumers resolve presetId via presetBridge —
    // the raw preset.id is NOT an engine type (e.g. 'shake', 'zoom-in').
    setDragPayload(e as any, {
      type: preset.type as any,
      presetId: preset.id,
      id: preset.id,
      name: preset.name,
      params: preset.params,
      duration: preset.defaultDuration,
      effectType: preset.type === 'effect' ? preset.id : undefined,
      transitionType: preset.type === 'transition' ? preset.id : undefined,
      filterId: preset.type === 'filter' ? preset.id : undefined,
    } as any);
  };

  const handleDragEnd = () => {
    // Keep the slot until the drop handler clears it (drop fires after
    // dragend in some browsers), so do NOT clear here.
  };

  // Determine animation CSS class based on animationType
  const getAnimationClass = () => {
    if (!isHovered && !isSelected) return '';
    switch (preset.animationType) {
      case 'dissolve': return 'anim-dissolve';
      case 'flash-zoom': return 'anim-flash-zoom';
      case 'whip-left': return 'anim-whip-left';
      case 'whip-right': return 'anim-whip-right';
      case 'glitch': return 'anim-glitch';
      case 'shake': return 'anim-shake';
      case 'edge-glow': return 'anim-edge-glow';
      case 'rgb-split': return 'anim-rgb-split';
      case 'scanlines': return 'anim-scanlines';
      case 'prism': return 'anim-prism';
      case 'strobe': return 'anim-strobe';
      case 'page-curl': return 'anim-page-curl';
      case 'blur-push': return 'anim-blur-push';
      case 'spin': return 'anim-spin';
      case 'cyberpunk': return 'anim-cyberpunk';
      case 'sunset': return 'anim-sunset';
      default: return 'anim-flash-zoom';
    }
  };

  const badgeColor =
    preset.badge === 'HOT'
      ? 'bg-red-500/90 text-white'
      : preset.badge === 'PRO'
      ? 'bg-amber-400 text-black font-extrabold'
      : preset.badge === 'NEW'
      ? 'bg-emerald-500/90 text-white'
      : preset.badge === 'TRENDING'
      ? 'bg-cyan-500/90 text-black font-extrabold'
      : '';

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onApply(preset)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-200 border ${
        isSelected
          ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.35)] scale-[1.02]'
          : 'border-[#27272a] hover:border-cyan-500/60 bg-[#161618] hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-[1.02]'
      }`}
      title={`Click or drag to apply ${preset.name} (${preset.category})`}
    >
      {/* Aspect Ratio 1:1 Visual Preview Area */}
      <div className="w-full aspect-square relative overflow-hidden bg-black/40 flex items-center justify-center">
        {/* Animated Background Simulation Container */}
        <div
          className={`w-full h-full bg-gradient-to-br ${preset.bgGradient} flex items-center justify-center transition-all duration-300 relative ${
            isVisible ? getAnimationClass() : ''
          }`}
          style={{
            filter: isHovered && preset.cssFilter ? preset.cssFilter : undefined,
          }}
        >
          {/* Simulated Visual Scene (CapCut Subject Silhouette & Graphics) */}
          <div className="relative flex flex-col items-center justify-center space-y-1">
            {/* Center Visual Glyph / Emblem */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-md transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${preset.accentColor}25` }}
            >
              {preset.type === 'transition' ? (
                <Film className="w-5 h-5" style={{ color: preset.accentColor }} />
              ) : preset.type === 'effect' ? (
                <Sparkles className="w-5 h-5" style={{ color: preset.accentColor }} />
              ) : (
                <Palette className="w-5 h-5" style={{ color: preset.accentColor }} />
              )}
            </div>

            {/* Subtle Horizon / Frame Preview Lines */}
            <div className="w-12 h-0.5 rounded-full bg-white/25" />
          </div>

          {/* Glitch / Scanline Texture Overlay */}
          {preset.animationType === 'scanlines' && (
            <div className="absolute inset-0 anim-scanlines pointer-events-none opacity-60" />
          )}

          {/* Flash Zoom / Light Flare Pulse */}
          {isHovered && (preset.animationType === 'flash-zoom' || preset.animationType === 'strobe') && (
            <div className="absolute inset-0 bg-white/20 pointer-events-none mix-blend-overlay" />
          )}
        </div>

        {/* Top-Right Favorite Star Button */}
        <button
          onClick={(e) => onToggleFavorite(preset.id, e)}
          className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-20 ${
            isFavorite
              ? 'bg-amber-400/90 text-black shadow-xs opacity-100'
              : 'bg-black/60 text-white/70 hover:text-white hover:bg-black/90 opacity-0 group-hover:opacity-100'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Pin to favorites'}
        >
          <Star
            className={`w-3 h-3 ${isFavorite ? 'fill-current text-black' : ''}`}
          />
        </button>

        {/* Top-Left Category Badge (e.g. HOT, PRO, NEW) */}
        {preset.badge && (
          <div
            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8.5px] tracking-wider uppercase shadow-xs z-20 ${badgeColor}`}
          >
            {preset.badge}
          </div>
        )}

        {/* Hover Quick Apply Plus Button (Bottom Right) */}
        <button
          onClick={handleApplyClick}
          className={`absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md z-20 ${
            isApplied
              ? 'bg-emerald-500 text-white opacity-100 scale-110'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
          }`}
          title={`Quick Apply ${preset.name}`}
        >
          {isApplied ? (
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          ) : (
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          )}
        </button>
      </div>

      {/* Card Bottom Label */}
      <div className="px-2 py-1.5 bg-[#121214] border-t border-[#27272a]/70 flex items-center justify-between min-h-[30px]">
        <span
          className={`text-[11px] font-semibold truncate transition-colors ${
            isSelected || isHovered ? 'text-cyan-300' : 'text-gray-300'
          }`}
        >
          {preset.name}
        </span>
        {preset.defaultDuration && (
          <span className="text-[9.5px] font-mono text-gray-500 flex-shrink-0 ml-1">
            {preset.defaultDuration}s
          </span>
        )}
      </div>
    </div>
  );
};
