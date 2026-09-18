/**
 * NLE Timeline Core — single source of truth for timeline ↔ preview ↔ export.
 *
 * Every timeline mutation (UI drag, inspector edit, keyboard op) AND every
 * render path (VideoPlayer preview, FrameCompositor export) goes through
 * these pure helpers, so TIMELINE === PREVIEW === SAVE === EXPORT by
 * construction. All functions are pure + frame-quantized + NaN-safe and
 * covered by nleCapcutParity tests.
 */

import { VideoClip, ProjectData } from '../types/project';
import { ClipEffect } from '../types/effects';
import { TransitionConfig } from '../types/transitions';
import { syncTransitionsWithClips } from './transitionEngine';

// ---------------------------------------------------------------------------
// Time hygiene: every timestamp in the NLE is finite, >= 0, frame-quantized.
// ---------------------------------------------------------------------------

export function sanitizeT(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n)) return fallback;
  return n;
}

export function quantizeT(t: number, fps = 30): number {
  const f = sanitizeT(fps, 30) || 30;
  const frame = 1 / f;
  const q = Math.round(sanitizeT(t, 0) / frame) * frame;
  return Math.max(0, Math.round(q * 1000) / 1000);
}

export function clampT(t: number, min: number, max: number): number {
  const v = sanitizeT(t, min);
  return Math.min(Math.max(v, min), Math.max(min, max));
}

// ---------------------------------------------------------------------------
// Timed clip effects — the heart of the "effects are real timeline objects"
// requirement. An effect WITHOUT explicit timing behaves exactly like the
// legacy whole-clip effect (backward compatible). An effect WITH timing is
// active only inside [startTime, startTime + duration), clamped to its host
// clip. Preview and export MUST both gate through these helpers.
// ---------------------------------------------------------------------------

/** Absolute-timeline bounds of an effect on its host clip. */
export function getEffectBounds(
  effect: ClipEffect,
  hostClip: VideoClip,
  fps = 30
): { start: number; end: number; duration: number } {
  const clipStart = sanitizeT(hostClip.timelineStart, 0);
  const clipDur = Math.max(0.1, sanitizeT(hostClip.timelineDuration, 1));
  const clipEnd = clipStart + clipDur;
  const rawStart = effect.startTime === undefined ? clipStart : sanitizeT(effect.startTime, clipStart);
  const rawDur = effect.duration === undefined ? clipEnd - rawStart : sanitizeT(effect.duration, clipEnd - rawStart);
  const start = quantizeT(clampT(rawStart, clipStart, clipEnd), fps);
  const end = quantizeT(clampT(start + Math.max(0.1, rawDur), start + 0.1, clipEnd), fps);
  return { start, end, duration: Math.max(0.1, end - start) };
}

/** Is this single effect active at absolute timeline time t? */
export function isEffectActiveAtTime(effect: ClipEffect, hostClip: VideoClip, t: number, fps = 30): boolean {
  if (!effect.enabled) return false;
  const { start, end } = getEffectBounds(effect, hostClip, fps);
  return t >= start && t < end;
}

/**
 * Active, enabled, time-gated effects for a clip at time t — in stack order.
 * THIS is what preview AND export render. Never render clip.effects raw.
 */
export function getActiveClipEffectsAtTime(clip: VideoClip, t: number, fps = 30): ClipEffect[] {
  if (!clip.effects || clip.effects.length === 0) return [];
  return clip.effects.filter((e) => isEffectActiveAtTime(e, clip, t, fps));
}

/** Create a timed effect instance bound to a host clip. */
export function createEffectInstance(
  base: Omit<ClipEffect, 'id'> & { id?: string },
  hostClip: VideoClip,
  opts: { dropTime?: number; duration?: number; fps?: number } = {}
): ClipEffect {
  const fps = opts.fps || 30;
  const clipStart = sanitizeT(hostClip.timelineStart, 0);
  const clipDur = Math.max(0.1, sanitizeT(hostClip.timelineDuration, 1));
  const clipEnd = clipStart + clipDur;
  // Default: whole clip (CapCut behavior on drop). When a dropTime inside the
  // clip is provided, anchor a 3s window there — still fully editable after.
  let start = clipStart;
  let dur = clipDur;
  if (opts.dropTime !== undefined && isFinite(opts.dropTime)) {
    const dt = clampT(opts.dropTime, clipStart, clipEnd - 0.1);
    if (opts.duration !== undefined && isFinite(opts.duration)) {
      dur = clampT(opts.duration, 0.2, clipEnd - dt);
      start = dt;
    } else if (clipDur > 3.2) {
      // Anchor a 3s editable window around the drop point for long clips.
      start = clampT(dt - 0.5, clipStart, clipEnd - 0.2);
      dur = Math.min(3, clipEnd - start);
    }
  } else if (opts.duration !== undefined && isFinite(opts.duration)) {
    dur = clampT(opts.duration, 0.2, clipDur);
  }
  return {
    ...base,
    id: base.id || `eff_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    enabled: base.enabled ?? true,
    params: { ...(base.params || {}) },
    intensity: base.intensity ?? 100,
    startTime: quantizeT(start, fps),
    duration: quantizeT(Math.max(0.2, dur), fps),
  };
}

/** Move an effect along the timeline, clamped to host clip bounds. */
export function moveEffectInstance(
  effect: ClipEffect,
  hostClip: VideoClip,
  newStartTime: number,
  fps = 30
): ClipEffect {
  const clipStart = sanitizeT(hostClip.timelineStart, 0);
  const clipDur = Math.max(0.1, sanitizeT(hostClip.timelineDuration, 1));
  const dur = effect.duration ?? clipDur;
  const start = quantizeT(clampT(newStartTime, clipStart, clipStart + clipDur - 0.1), fps);
  const maxDur = Math.max(0.1, clipStart + clipDur - start);
  return { ...effect, startTime: start, duration: quantizeT(Math.min(sanitizeT(dur, maxDur), maxDur), fps) };
}

/** Resize an effect's duration (optionally also its start), clamped to host. */
export function resizeEffectInstance(
  effect: ClipEffect,
  hostClip: VideoClip,
  newDuration: number,
  newStartTime?: number,
  fps = 30
): ClipEffect {
  const clipStart = sanitizeT(hostClip.timelineStart, 0);
  const clipDur = Math.max(0.1, sanitizeT(hostClip.timelineDuration, 1));
  const clipEnd = clipStart + clipDur;
  const start = newStartTime === undefined
    ? (effect.startTime ?? clipStart)
    : clampT(newStartTime, clipStart, clipEnd - 0.1);
  const maxDur = Math.max(0.1, clipEnd - start);
  const dur = quantizeT(clampT(newDuration, 0.2, maxDur), fps);
  return { ...effect, startTime: quantizeT(start, fps), duration: dur };
}

/** Normalize legacy effects (no timing) to explicit whole-clip timing. */
export function normalizeClipEffects(clip: VideoClip, fps = 30): VideoClip {
  if (!clip.effects || clip.effects.length === 0) return clip;
  let changed = false;
  const effects = clip.effects.map((e) => {
    if (e.startTime === undefined || e.duration === undefined) {
      changed = true;
      return createEffectInstance(e, clip, { fps });
    }
    // Re-clamp in case the clip was trimmed/moved since.
    const { start, duration } = getEffectBounds(e, clip, fps);
    if (Math.abs((e.startTime ?? start) - start) > 0.005 || Math.abs((e.duration ?? duration) - duration) > 0.005) {
      // Only rewrite when out of bounds — preserve intentional sub-clip timing.
      const b = getEffectBounds({ ...e, startTime: e.startTime, duration: e.duration }, clip, fps);
      if (b.start !== e.startTime || b.duration !== e.duration) {
        changed = true;
        return { ...e, startTime: b.start, duration: b.duration };
      }
    }
    return e;
  });
  return changed ? { ...clip, effects } : clip;
}

// ---------------------------------------------------------------------------
// Clip lookup / transition placement (shared by DnD, panels, keyboard).
// ---------------------------------------------------------------------------

export function findClipAtTime(clips: VideoClip[], t: number, trackIndex?: number): VideoClip | undefined {
  const list = (trackIndex === undefined ? clips : clips.filter((c) => (c.trackIndex || 1) === trackIndex))
    .slice()
    .sort((a, b) => a.timelineStart - b.timelineStart);
  return list.find((c) => t >= c.timelineStart && t < c.timelineStart + c.timelineDuration);
}

/** Nearest edit point (cut) on a track to time t. */
export function findNearestCut(
  clips: VideoClip[],
  t: number,
  trackIndex = 1
): { fromClip: VideoClip; toClip: VideoClip; cutPoint: number; distance: number } | null {
  const sorted = clips.filter((c) => (c.trackIndex || 1) === trackIndex).sort((a, b) => a.timelineStart - b.timelineStart);
  if (sorted.length < 2) return null;
  let best: { fromClip: VideoClip; toClip: VideoClip; cutPoint: number; distance: number } | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cut = sorted[i].timelineStart + sorted[i].timelineDuration;
    const d = Math.abs(t - cut);
    if (!best || d < best.distance) best = { fromClip: sorted[i], toClip: sorted[i + 1], cutPoint: cut, distance: d };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Snapping — one implementation for every drag surface.
// ---------------------------------------------------------------------------

export function snapTime(
  rawTime: number,
  candidates: number[],
  opts: { threshold?: number; enabled?: boolean; bypass?: boolean } = {}
): { time: number; snapped: boolean; snapPoint: number | null } {
  const { threshold = 0.15, enabled = true, bypass = false } = opts;
  const raw = sanitizeT(rawTime, 0);
  if (!enabled || bypass || !isFinite(raw)) return { time: Math.max(0, raw), snapped: false, snapPoint: null };
  let best = raw;
  let bestDist = threshold + 1e-9;
  for (const c of candidates) {
    if (!isFinite(c)) continue;
    const d = Math.abs(raw - c);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  if (bestDist <= threshold) return { time: Math.max(0, best), snapped: true, snapPoint: best };
  return { time: Math.max(0, raw), snapped: false, snapPoint: null };
}

/** Standard snap candidate set: zero, playhead, clip edges, transitions, markers. */
export function collectSnapCandidates(project: ProjectData, currentTime: number, excludeClipIds: string[] = []): number[] {
  const out: number[] = [0];
  if (isFinite(currentTime)) out.push(currentTime);
  for (const c of project.clips || []) {
    if (excludeClipIds.includes(c.id)) continue;
    out.push(sanitizeT(c.timelineStart, 0));
    out.push(sanitizeT(c.timelineStart, 0) + sanitizeT(c.timelineDuration, 0));
  }
  for (const t of project.transitions || []) {
    if (isFinite((t as TransitionConfig).timelineStart)) out.push((t as TransitionConfig).timelineStart);
  }
  for (const m of (project as any).markers || []) {
    if (isFinite(m.time)) out.push(m.time);
  }
  if (isFinite(project.metadata.duration)) out.push(sanitizeT(project.metadata.duration, 0));
  return out;
}

// ---------------------------------------------------------------------------
// Project-wide integrity: orphans, clamping, NaN guards. Run after EVERY
// structural mutation (move/trim/split/delete/duplicate) before pushState.
// ---------------------------------------------------------------------------

export function reconcileProject(project: ProjectData, fps = 30): ProjectData {
  const f = sanitizeT(fps, 30) || 30;
  const clips = (project.clips || []).map((c) => {
    const clean: VideoClip = {
      ...c,
      timelineStart: quantizeT(Math.max(0, sanitizeT(c.timelineStart, 0)), f),
      timelineDuration: Math.max(1 / f, sanitizeT(c.timelineDuration, 1)),
      startOffset: Math.max(0, sanitizeT(c.startOffset, 0)),
      endOffset: Math.max(0.1, sanitizeT(c.endOffset, sanitizeT(c.duration, 1))),
    };
    return normalizeClipEffects(clean, f);
  });
  const transitions = syncTransitionsWithClips(project.transitions, clips);
  return { ...project, clips, transitions };
}

/** Dependent-object-safe delete set: clip ids -> transition ids that must go. */
export function dependentTransitionsForClips(transitions: TransitionConfig[] | undefined, clipIds: string[]): string[] {
  if (!transitions) return [];
  const set = new Set(clipIds);
  return transitions.filter((t) => set.has(t.fromClipId) || set.has(t.toClipId)).map((t) => t.id);
}
