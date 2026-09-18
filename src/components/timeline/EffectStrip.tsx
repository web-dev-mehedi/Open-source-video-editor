import React, { useState } from 'react';
import { VideoClip } from '../../types/project';
import { ClipEffect } from '../../types/effects';
import { useProject } from '../../context/ProjectContext';
import { getEffectBounds } from '../../utils/nleTimeline';
import { sanitizeTime } from '../../utils/timecode';
import { Sparkles, Eye, EyeOff, Copy, Trash2, SlidersHorizontal } from 'lucide-react';

/**
 * EffectStrip — CapCut-style timed effect bars attached to a timeline clip.
 *
 * Each bar IS the effect's real timing (startTime/duration on the ClipEffect
 * object): dragging the bar moves the effect, edge-drag resizes it, and both
 * preview + export gate through the same bounds. No visual-only state.
 */
interface EffectStripProps {
  clip: VideoClip;
  pixelsPerSecond: number;
  isLocked?: boolean;
  onSelectClip: (id: string) => void;
}

const FX_COLORS = [
  'bg-purple-500/80 border-purple-300',
  'bg-cyan-500/80 border-cyan-300',
  'bg-amber-500/80 border-amber-300',
  'bg-emerald-500/80 border-emerald-300',
  'bg-rose-500/80 border-rose-300',
  'bg-indigo-500/80 border-indigo-300',
];

export const EffectStrip: React.FC<EffectStripProps> = ({ clip, pixelsPerSecond, isLocked = false, onSelectClip }) => {
  const {
    moveEffect,
    resizeEffect,
    removeEffectFromClip,
    toggleEffect,
    duplicateEffect,
    applyEffectToClip,
    setEffectIntensity,
    project,
    setActiveSidebarTab,
  } = useProject() as any;

  const [dragPreview, setDragPreview] = useState<Record<string, { start: number; duration: number }>>({});
  const [menu, setMenu] = useState<{ x: number; y: number; clipId: string; effect: ClipEffect } | null>(null);

  const effects = clip.effects || [];
  if (effects.length === 0) return null;

  const fps = project?.metadata?.fps || 30;

  const handleBarMouseDown = (eff: ClipEffect, e: React.MouseEvent) => {
    if (e.button !== 0 || isLocked) return;
    e.stopPropagation();
    onSelectClip(clip.id);
    const startX = e.clientX;
    const { start: initialStart, duration: initialDur } = getEffectBounds(eff, clip, fps);
    let latestStart = initialStart;

    const onMove = (me: MouseEvent) => {
      const pps = sanitizeTime(pixelsPerSecond, 40);
      if (!isFinite(pps) || pps <= 0.5) return;
      const deltaSec = (me.clientX - startX) / pps;
      if (!isFinite(deltaSec)) return;
      const clipStart = clip.timelineStart;
      const clipEnd = clip.timelineStart + clip.timelineDuration;
      let ns = Math.max(clipStart, Math.min(clipEnd - 0.2, initialStart + deltaSec));
      // Snap bar edges to clip edges + playhead
      const snapThreshold = 6 / pps;
      const cands = [clipStart, clipEnd - initialDur, (project as any)?.__playhead ?? -1];
      for (const c of cands) {
        if (c >= 0 && Math.abs(ns - c) < snapThreshold) { ns = c; break; }
      }
      latestStart = Math.round(ns * 100) / 100;
      setDragPreview((p) => ({ ...p, [eff.id]: { start: latestStart, duration: initialDur } }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragPreview((p) => {
        const { [eff.id]: _, ...rest } = p;
        return rest;
      });
      if (Math.abs(latestStart - initialStart) > 0.015) {
        moveEffect(clip.id, eff.id, latestStart);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleEdgeMouseDown = (eff: ClipEffect, edge: 'left' | 'right', e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectClip(clip.id);
    const startX = e.clientX;
    const { start: initialStart, duration: initialDur } = getEffectBounds(eff, clip, fps);
    let latestStart = initialStart;
    let latestDur = initialDur;

    const onMove = (me: MouseEvent) => {
      const pps = sanitizeTime(pixelsPerSecond, 40);
      if (!isFinite(pps) || pps <= 0.5) return;
      const deltaSec = (me.clientX - startX) / pps;
      if (!isFinite(deltaSec)) return;
      if (edge === 'right') {
        latestDur = Math.max(0.2, Math.min(clip.timelineStart + clip.timelineDuration - initialStart, initialDur + deltaSec));
      } else {
        latestStart = Math.max(clip.timelineStart, Math.min(initialStart + initialDur - 0.2, initialStart + deltaSec));
        latestDur = Math.max(0.2, initialDur - (latestStart - initialStart));
      }
      latestStart = Math.round(latestStart * 100) / 100;
      latestDur = Math.round(latestDur * 100) / 100;
      setDragPreview((p) => ({ ...p, [eff.id]: { start: latestStart, duration: latestDur } }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragPreview((p) => {
        const { [eff.id]: _, ...rest } = p;
        return rest;
      });
      if (Math.abs(latestDur - initialDur) > 0.015 || Math.abs(latestStart - initialStart) > 0.015) {
        resizeEffect(clip.id, eff.id, latestDur, latestStart);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <>
      <div className="relative z-10 w-full flex items-center gap-1 px-1 pb-0.5 pointer-events-none">
        <div className="flex items-center gap-1 overflow-x-auto pointer-events-auto max-w-full">
          {effects.map((eff, idx) => {
            const bounds = getEffectBounds(eff, clip, fps);
            const preview = dragPreview[eff.id];
            const relStart = ((preview ? preview.start : bounds.start) - clip.timelineStart) * pixelsPerSecond;
            const barW = Math.max(26, (preview ? preview.duration : bounds.duration) * pixelsPerSecond);
            const color = FX_COLORS[idx % FX_COLORS.length];
            return (
              <div
                key={eff.id}
                onMouseDown={(e) => handleBarMouseDown(eff, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelectClip(clip.id);
                  setActiveSidebarTab('effects');
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectClip(clip.id);
                  setMenu({ x: e.clientX, y: e.clientY, clipId: clip.id, effect: eff });
                }}
                title={`${eff.name} • ${bounds.duration.toFixed(2)}s @ ${bounds.start.toFixed(2)}s — drag to move, edges to resize, right-click for options`}
                style={{ width: `${barW}px`, marginLeft: idx === 0 ? `${Math.max(0, relStart)}px` : undefined }}
                className={`relative h-4 rounded border text-[8px] font-mono font-bold text-white flex items-center justify-between px-1 overflow-hidden select-none flex-shrink-0 shadow ${
                  isLocked ? 'cursor-default opacity-70' : 'cursor-grab active:cursor-grabbing'
                } ${color} ${eff.enabled ? '' : 'opacity-40 grayscale'}`}
              >
                <div
                  onMouseDown={(e) => handleEdgeMouseDown(eff, 'left', e)}
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/50 hover:bg-white z-10 rounded-l"
                  title="Resize effect start"
                />
                <span className="truncate flex items-center gap-0.5 pointer-events-none">
                  <Sparkles className="w-2 h-2 flex-shrink-0" />
                  <span className="truncate">{eff.name}</span>
                </span>
                <span className="pointer-events-none opacity-80">{(preview ? preview.duration : bounds.duration).toFixed(1)}s</span>
                <div
                  onMouseDown={(e) => handleEdgeMouseDown(eff, 'right', e)}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/50 hover:bg-white z-10 rounded-r"
                  title="Resize effect duration"
                />
              </div>
            );
          })}
        </div>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div
            className="fixed z-50 bg-[#1e1e24] border border-[#3f3f46] rounded-xl shadow-2xl p-2 text-xs text-gray-200 w-60"
            style={{ top: `${Math.min(window.innerHeight - 320, menu.y)}px`, left: `${Math.min(window.innerWidth - 250, menu.x)}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1.5 font-bold text-white truncate border-b border-[#3f3f46] mb-1">{menu.effect.name}</div>
            <label className="px-2 py-1 flex items-center gap-2 text-gray-300">
              <SlidersHorizontal className="w-3.5 h-3.5 text-forge-cyan" />
              <span className="w-14">Strength</span>
              <input
                type="range"
                min={0}
                max={100}
                value={menu.effect.intensity ?? 100}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setEffectIntensity(menu.clipId, menu.effect.id, v);
                  setMenu((m) => (m ? { ...m, effect: { ...m.effect, intensity: v } } : m));
                }}
                className="flex-1 accent-cyan-400"
              />
              <span className="font-mono w-9 text-right">{menu.effect.intensity ?? 100}%</span>
            </label>
            <button
              onClick={() => { toggleEffect(menu.clipId, menu.effect.id); setMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-left"
            >
              {menu.effect.enabled ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{menu.effect.enabled ? 'Disable effect' : 'Enable effect'}</span>
            </button>
            <button
              onClick={() => { duplicateEffect(menu.clipId, menu.effect.id); setMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-left"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Duplicate effect</span>
            </button>
            {(project?.clips || []).filter((c: any) => c.id !== menu.clipId).slice(0, 5).map((c: any) => (
              <button
                key={c.id}
                onClick={() => { applyEffectToClip(menu.clipId, menu.effect.id, c.id); setMenu(null); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-left truncate"
                title={`Apply to ${c.name}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className="truncate">Apply to {c.name}</span>
              </button>
            ))}
            <button
              onClick={() => { removeEffectFromClip(menu.clipId, menu.effect.id); setMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-950/60 text-red-400 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove effect</span>
            </button>
          </div>
        </>
      )}
    </>
  );
};
