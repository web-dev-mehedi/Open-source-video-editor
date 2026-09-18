import React from 'react';
import { OverlayElement } from '../../types/project';
import { MotionGraphicParams } from '../../types/motionGraphics';
import {
  Bell,
  Heart,
  Share2,
  CheckCircle2,
  Sparkles,
  Flame,
  Radio,
  Star,
  Target,
  Zap,
} from 'lucide-react';

interface MotionGraphicRendererProps {
  overlay: OverlayElement;
  currentTime: number;
}

export const MotionGraphicRenderer: React.FC<MotionGraphicRendererProps> = ({ overlay, currentTime }) => {
  const p: Partial<MotionGraphicParams> = (overlay as any).motionParams || {
    title: overlay.title || overlay.text || overlay.name,
    subtitle: overlay.subtitle,
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

  const templateId = (overlay as any).templateId || 'lt-minimal-clean';
  const progress = (currentTime - overlay.timelineStart) / Math.max(0.1, overlay.timelineDuration);

  // Smooth in and out transitions
  const isEntering = progress < 0.15;
  const isExiting = progress > 0.85;

  const rotation = overlay.rotation || 0;

  return (
    <div
      style={{
        left: `${p.x}%`,
        top: `${p.y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${p.scale})`,
        opacity: isEntering ? progress / 0.15 : isExiting ? (1 - progress) / 0.15 : p.opacity,
        fontFamily: p.fontFamily,
      }}
      className={`absolute z-30 pointer-events-none select-none transition-all duration-150 ${
        isEntering ? 'animate-in fade-in zoom-in-95 duration-200' : ''
      }`}
    >
      {/* 1. Lower Third: Minimal Modern Split */}
      {templateId === 'lt-minimal-clean' && (
        <div
          style={{ backgroundColor: p.backgroundColor }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/10 shadow-2xl backdrop-blur-md"
        >
          <div
            style={{ backgroundColor: p.accentColor }}
            className="w-1.5 h-10 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.6)]"
          />
          <div className="flex flex-col">
            <span
              style={{ color: p.textColor, fontSize: `${p.fontSize}px` }}
              className="font-black tracking-wide leading-tight"
            >
              {p.title}
            </span>
            {p.subtitle && (
              <span
                style={{ color: p.accentColor, fontSize: `${Math.max(12, (p.fontSize || 22) * 0.65)}px` }}
                className="font-semibold tracking-wider opacity-90 uppercase text-[11px]"
              >
                {p.subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2. Lower Third: Broadcast News Bar */}
      {templateId === 'lt-broadcast-news' && (
        <div className="flex items-stretch rounded-lg overflow-hidden shadow-2xl border border-red-500/30">
          <div
            style={{ backgroundColor: p.accentColor }}
            className="px-3 flex items-center justify-center font-black text-white text-xs tracking-wider uppercase animate-pulse"
          >
            {p.handle || 'LIVE'}
          </div>
          <div
            style={{ backgroundColor: p.backgroundColor }}
            className="px-4 py-2 flex flex-col justify-center backdrop-blur-md"
          >
            <span
              style={{ color: p.textColor, fontSize: `${p.fontSize}px` }}
              className="font-black uppercase tracking-tight"
            >
              {p.title}
            </span>
            {p.subtitle && (
              <span className="text-[12px] font-medium text-gray-300">
                {p.subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Lower Third: Cyberpunk HUD */}
      {templateId === 'lt-cyber-hud' && (
        <div
          style={{ backgroundColor: p.backgroundColor }}
          className="px-4 py-2.5 rounded-lg border-2 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex flex-col relative overflow-hidden backdrop-blur-lg font-mono"
        >
          {/* Animated Cyan Scanline */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-pulse" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span
              style={{ color: p.accentColor, fontSize: `${p.fontSize}px` }}
              className="font-black tracking-widest uppercase"
            >
              {p.title}
            </span>
          </div>
          {p.subtitle && (
            <span className="text-[11px] text-gray-400 tracking-wider">
              {p.subtitle}
            </span>
          )}
        </div>
      )}

      {/* 4. Lower Third: Luxury Editorial Gold */}
      {templateId === 'lt-luxury-serif' && (
        <div
          style={{ backgroundColor: p.backgroundColor }}
          className="px-6 py-3 rounded-none border-y-2 border-amber-400/80 shadow-2xl flex flex-col items-center text-center backdrop-blur-md"
        >
          <span
            style={{ color: p.textColor, fontSize: `${p.fontSize}px` }}
            className="font-serif font-bold tracking-widest uppercase"
          >
            {p.title}
          </span>
          {p.subtitle && (
            <span
              style={{ color: p.accentColor }}
              className="text-[10px] tracking-[0.25em] uppercase mt-0.5 opacity-90"
            >
              {p.subtitle}
            </span>
          )}
        </div>
      )}

      {/* 5. Lower Third: Social Handle Creator Pill */}
      {templateId === 'lt-social-handle' && (
        <div
          style={{ backgroundColor: p.backgroundColor }}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-sky-500/40 shadow-xl backdrop-blur-md"
        >
          <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[11px] shadow">
            ✓
          </div>
          <div className="flex flex-col">
            <span
              style={{ color: p.textColor, fontSize: `${p.fontSize}px` }}
              className="font-black"
            >
              {p.title}
            </span>
            {p.subtitle && (
              <span className="text-[10px] text-sky-400 font-semibold">
                {p.subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 6. Title: Cinematic Kinetic Glitch */}
      {templateId === 'title-cinematic-glitch' && (
        <div className="flex flex-col items-center text-center">
          <span
            style={{
              color: p.textColor,
              fontSize: `${p.fontSize}px`,
              textShadow: `3px 3px 0px ${p.accentColor}, -3px -3px 0px ${p.secondaryColor || '#06B6D4'}`,
            }}
            className="font-black uppercase tracking-wider scale-110 drop-shadow-2xl"
          >
            {p.title}
          </span>
          {p.subtitle && (
            <span
              style={{ color: p.accentColor }}
              className="text-xs font-bold uppercase tracking-[0.2em] bg-black/80 px-3 py-1 rounded mt-2 border border-white/10"
            >
              {p.subtitle}
            </span>
          )}
        </div>
      )}

      {/* 7. Title: Modern Staggered Box */}
      {templateId === 'title-stagger-bold' && (
        <div className="flex flex-col items-center">
          <div
            style={{ backgroundColor: p.accentColor }}
            className="px-5 py-2 rounded-xl shadow-2xl transform -rotate-1"
          >
            <span
              style={{ color: p.textColor, fontSize: `${p.fontSize}px` }}
              className="font-black tracking-tight uppercase"
            >
              {p.title}
            </span>
          </div>
          {p.subtitle && (
            <span className="text-xs font-bold text-gray-200 bg-black/85 px-3 py-1 rounded-md mt-1.5 shadow border border-white/10">
              {p.subtitle}
            </span>
          )}
        </div>
      )}

      {/* 8. Callout: Tech Target Pointer */}
      {templateId === 'callout-tech-pointer' && (
        <div className="flex items-center gap-2 font-mono">
          <div className="relative flex items-center justify-center">
            <div
              style={{ borderColor: p.accentColor }}
              className="w-6 h-6 rounded-full border-2 animate-ping opacity-75"
            />
            <div
              style={{ backgroundColor: p.accentColor }}
              className="w-2.5 h-2.5 rounded-full absolute shadow-[0_0_10px_currentColor]"
            />
          </div>
          <div
            style={{ borderColor: p.accentColor }}
            className="w-8 h-[2px] bg-cyan-400"
          />
          <div
            style={{ backgroundColor: p.backgroundColor }}
            className="px-3.5 py-2 rounded-xl border border-cyan-500/40 shadow-xl backdrop-blur-md flex flex-col"
          >
            <span
              style={{ color: p.accentColor, fontSize: `${p.fontSize}px` }}
              className="font-bold tracking-wider"
            >
              {p.title}
            </span>
            {p.subtitle && (
              <span className="text-[10px] text-gray-300 font-mono">
                {p.subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 9. Social CTA: YouTube Subscribe & Bell */}
      {templateId === 'social-yt-subscribe' && (
        <div
          style={{ backgroundColor: p.backgroundColor }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-lg"
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">{p.handle || 'CaptionForge'}</span>
            <span className="text-[10px] text-gray-400">{p.subtitle || 'Subscribe'}</span>
          </div>
          <div
            style={{ backgroundColor: p.accentColor }}
            className="px-3.5 py-1.5 rounded-full text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 animate-bounce"
          >
            <span>{p.title}</span>
            <Bell className="w-3.5 h-3.5 fill-current" />
          </div>
        </div>
      )}

      {/* 10. Social CTA: TikTok Neon Follow */}
      {templateId === 'social-tiktok-follow' && (
        <div
          style={{ backgroundColor: p.backgroundColor }}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-fuchsia-500/50 shadow-[0_0_20px_rgba(236,72,153,0.4)] backdrop-blur-lg"
        >
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse" />
          <div className="flex flex-col">
            <span
              style={{ color: p.textColor, fontSize: `${p.fontSize}px` }}
              className="font-black"
            >
              {p.title}
            </span>
            {p.subtitle && (
              <span className="text-[10px] text-fuchsia-400 font-bold">
                {p.subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 11. Generic fallback for custom text, titles, stickers, and element overlays */}
      {!templateId.startsWith('lt-') && !templateId.startsWith('title-') && !templateId.startsWith('callout-') && !templateId.startsWith('social-') && (
        <div
          style={{
            backgroundColor: overlay.backgroundColor,
            color: overlay.textColor || p.textColor,
            fontFamily: overlay.fontFamily || p.fontFamily,
            fontSize: `${overlay.fontSize || p.fontSize}px`,
            fontWeight: (overlay.fontWeight as any) || '700',
            textAlign: overlay.alignment || 'center',
            padding: overlay.backgroundPadding ? `${overlay.backgroundPadding * 0.4}px ${overlay.backgroundPadding * 0.8}px` : overlay.backgroundColor ? '8px 16px' : undefined,
            borderRadius: overlay.backgroundRadius !== undefined ? `${overlay.backgroundRadius}px` : overlay.backgroundColor ? '12px' : undefined,
            WebkitTextStroke: overlay.strokeWidth ? `${overlay.strokeWidth}px ${overlay.strokeColor || '#000000'}` : undefined,
            textShadow: overlay.shadowColor
              ? `${overlay.shadowOffsetX || 0}px ${overlay.shadowOffsetY || 2}px ${overlay.shadowBlur || 8}px ${overlay.shadowColor}`
              : undefined,
          }}
          className={`select-none whitespace-pre-wrap leading-tight ${overlay.backgroundColor ? 'shadow-2xl backdrop-blur-sm' : ''}`}
        >
          <span>{overlay.text || p.title}</span>
          {p.subtitle && (
            <div className="text-xs font-normal opacity-80 mt-1">{p.subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
};
