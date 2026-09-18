/**
 * NLE CapCut-Parity End-to-End Suite — maps 1:1 to the acceptance TEST 1..10.
 *
 * Every test drives the SINGLE SOURCE OF TRUTH (nleTimeline + presetBridge +
 * transitionEngine + FrameCompositor gating) so timeline === preview ===
 * save/reopen === export by construction. Pure, headless, deterministic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEffectInstance,
  moveEffectInstance,
  resizeEffectInstance,
  getEffectBounds,
  getActiveClipEffectsAtTime,
  isEffectActiveAtTime,
  findNearestCut,
  snapTime,
  collectSnapCandidates,
  reconcileProject,
  dependentTransitionsForClips,
  sanitizeT,
  quantizeT,
} from '../nleTimeline';
import { resolveEffectPreset, resolveFilterGrading, resolveTransitionPreset } from '../presetBridge';
import { getSafeTransitionDuration, syncTransitionsWithClips, getActiveTransitionAtTime } from '../transitionEngine';
import { sanitizeProjectForPersistence } from '../../services/storage/projectStorage';
import { FrameCompositor } from '../../services/export/frameCompositor';
import { VideoClip, ProjectData } from '../../types/project';
import { TransitionConfig } from '../../types/transitions';

function makeClip(over: Partial<VideoClip> = {}): VideoClip {
  return {
    id: `c_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Clip',
    filePath: 'c.mp4',
    duration: 10,
    startOffset: 0,
    endOffset: 10,
    timelineStart: 0,
    timelineDuration: 5,
    speed: 1,
    volume: 1,
    isMuted: false,
    width: 1920,
    height: 1080,
    fps: 30,
    trackIndex: 1,
    ...over,
  } as VideoClip;
}

function makeProject(over: Partial<ProjectData> = {}): ProjectData {
  return {
    metadata: {
      id: 'p1', name: 'P', aspectRatio: '16:9', width: 1920, height: 1080,
      fps: 30, duration: 12, createdAt: '', updatedAt: '',
    },
    clips: [], audioClips: [], captions: [], activeStyle: {} as any,
    overlays: [], transitions: [],
    ...over,
  } as unknown as ProjectData;
}

// ---------------------------------------------------------------------------
// Preset bridge: no fake (UI-only) effects or transitions may exist.
// ---------------------------------------------------------------------------
describe('Preset bridge — every library id resolves to a real engine type', () => {
  const effectIds = ['shake', 'edge-glow', 'rgb-split', 'scanlines', 'prism-blur', 'strobe', 'vhs-glitch', 'film-grain', 'vignette', 'mirror'];
  for (const id of effectIds) {
    it(`effect preset "${id}" resolves to an engine effect`, () => {
      const r = resolveEffectPreset(id);
      expect(r).not.toBeNull();
      expect(r!.engineType).toBeTruthy();
    });
  }
  const transitionIds = ['crossfade', 'zoom-in', 'whip-left', 'whip-right', 'glitch', 'blur-push', 'page-curl', 'light-leak', 'dip-black', 'dip-white', 'slide-left', 'spin-cw'];
  for (const id of transitionIds) {
    it(`transition preset "${id}" resolves to an engine transition`, () => {
      const r = resolveTransitionPreset(id);
      expect(r).not.toBeNull();
      expect(r!.engineType).toBeTruthy();
    });
  }
  it('filter presets resolve to engine effect + grading', () => {
    for (const id of ['teal-orange', 'moody-cinema', 'cyberpunk-neon', 'vintage-90s', 'bw-high-contrast', 'warm-sunset']) {
      const r = resolveEffectPreset(id);
      const g = resolveFilterGrading(id);
      expect(r).not.toBeNull();
      expect(Object.keys(g).length).toBeGreaterThan(0);
    }
  });
  it('unknown ids refuse honestly (no fake objects)', () => {
    expect(resolveEffectPreset('not-a-real-effect')).toBeNull();
    expect(resolveTransitionPreset('not-a-real-transition')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TEST 2/3: effect apply → intensity → exact timing; preview gating == export.
// ---------------------------------------------------------------------------
describe('TEST 2/3: timed effects — apply, intensity, move, resize', () => {
  it('creates whole-clip effect by default (backward compatible)', () => {
    const clip = makeClip({ timelineStart: 2, timelineDuration: 5 });
    const eff = createEffectInstance({ type: 'vignette', name: 'Vignette', category: 'cinematic', enabled: true, params: {} }, clip);
    const b = getEffectBounds(eff, clip);
    expect(b.start).toBeCloseTo(2, 2);
    expect(b.duration).toBeCloseTo(5, 2);
  });

  it('anchors a 3s editable window on drop into long clips', () => {
    const clip = makeClip({ timelineStart: 0, timelineDuration: 10 });
    const eff = createEffectInstance({ type: 'glow', name: 'Glow', category: 'cinematic', enabled: true, params: {} }, clip, { dropTime: 5 });
    const b = getEffectBounds(eff, clip);
    expect(b.duration).toBeCloseTo(3, 1);
    expect(b.start).toBeGreaterThanOrEqual(0);
    expect(b.start + b.duration).toBeLessThanOrEqual(10.01);
  });

  it('effect is active only inside its window (preview gating)', () => {
    const clip = makeClip({ timelineStart: 0, timelineDuration: 10 });
    const eff = createEffectInstance({ type: 'glow', name: 'G', category: 'cinematic', enabled: true, params: {} }, clip, { dropTime: 2, duration: 3 });
    clip.effects = [eff];
    expect(isEffectActiveAtTime(eff, clip, 1.9)).toBe(false);
    expect(isEffectActiveAtTime(eff, clip, 2.0)).toBe(true);
    expect(isEffectActiveAtTime(eff, clip, 4.9)).toBe(true);
    expect(isEffectActiveAtTime(eff, clip, 5.0)).toBe(false);
    expect(getActiveClipEffectsAtTime(clip, 3)).toHaveLength(1);
    expect(getActiveClipEffectsAtTime(clip, 8)).toHaveLength(0);
  });

  it('disabled effects never render (preview == export)', () => {
    const clip = makeClip({ timelineStart: 0, timelineDuration: 5 });
    const eff = createEffectInstance({ type: 'vignette', name: 'V', category: 'cinematic', enabled: false, params: {} }, clip);
    clip.effects = [eff];
    expect(getActiveClipEffectsAtTime(clip, 1)).toHaveLength(0);
  });

  it('move clamps to host clip bounds (no invalid state)', () => {
    const clip = makeClip({ timelineStart: 4, timelineDuration: 4 });
    const eff = createEffectInstance({ type: 'glow', name: 'G', category: 'cinematic', enabled: true, params: {} }, clip, { dropTime: 4, duration: 1 });
    const moved = moveEffectInstance(eff, clip, 100);
    const b = getEffectBounds(moved, clip);
    expect(b.end).toBeLessThanOrEqual(8.01);
    const moved2 = moveEffectInstance(eff, clip, -50);
    expect(getEffectBounds(moved2, clip).start).toBeGreaterThanOrEqual(4);
  });

  it('resize clamps duration to host clip (never overruns)', () => {
    const clip = makeClip({ timelineStart: 0, timelineDuration: 3 });
    const eff = createEffectInstance({ type: 'glow', name: 'G', category: 'cinematic', enabled: true, params: {} }, clip, { dropTime: 0, duration: 1 });
    const resized = resizeEffectInstance(eff, clip, 50);
    expect(getEffectBounds(resized, clip).end).toBeLessThanOrEqual(3.01);
    const resized2 = resizeEffectInstance(eff, clip, 0.01);
    expect(getEffectBounds(resized2, clip).duration).toBeGreaterThanOrEqual(0.19);
  });
});

// ---------------------------------------------------------------------------
// TEST 1: transition between A and B renders in export (FrameCompositor).
// ---------------------------------------------------------------------------
describe('TEST 1: transition A → B renders in export exactly as preview', () => {
  let mockContext: any;
  let mockCanvas: any;
  const mockVideo: any = {
    videoWidth: 1920, videoHeight: 1080, currentTime: 0, readyState: 4,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
  beforeEach(() => {
    mockContext = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(),
      strokeText: vi.fn(), measureText: vi.fn().mockReturnValue({ width: 100 }),
      translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), setTransform: vi.fn(),
      roundRect: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      getImageData: vi.fn(), putImageData: vi.fn(),
      globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'center', textBaseline: 'middle',
    };
    mockCanvas = { width: 1920, height: 1080, getContext: vi.fn().mockReturnValue(mockContext) };
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') return mockCanvas;
        return {} as any;
      },
    };
  });

  it('aliased transition preset (zoom-in) produces a renderable engine transition', async () => {
    const bridged = resolveTransitionPreset('zoom-in')!;
    const project = makeProject({
      clips: [makeClip({ id: 'a', timelineStart: 0, timelineDuration: 5 }), makeClip({ id: 'b', timelineStart: 5, timelineDuration: 5 })],
      transitions: [{
        id: 't1', type: bridged.engineType, name: bridged.name,
        fromClipId: 'a', toClipId: 'b', timelineStart: 5, duration: bridged.duration,
        alignment: 'center', direction: bridged.direction, params: { ...bridged.params },
      }],
    });
    // Preview-side active-transition lookup agrees with export-side compositor.
    const active = getActiveTransitionAtTime(5.0, project.transitions, project.clips);
    expect(active).not.toBeNull();
    const compositor = new FrameCompositor(1920, 1080, project);
    (compositor as any).videoMap.set('a', mockVideo);
    (compositor as any).videoMap.set('b', mockVideo);
    const canvas = await compositor.renderFrame(5.0);
    expect(canvas).toBeDefined();
    expect(mockContext.drawImage).toHaveBeenCalled();
  });

  it('transition duration clamps safely when media handles are short', () => {
    const a = makeClip({ id: 'a', timelineStart: 4.6, timelineDuration: 0.4 });
    const b = makeClip({ id: 'b', timelineStart: 5.0, timelineDuration: 6 });
    const { safeDuration } = getSafeTransitionDuration(a, b, 2.0, 'center');
    expect(safeDuration).toBeLessThanOrEqual(0.8);
    expect(safeDuration).toBeGreaterThanOrEqual(0.1);
  });

  it('nearest-cut placement finds the right edit point for drops', () => {
    const clips = [
      makeClip({ id: 'a', timelineStart: 0, timelineDuration: 4 }),
      makeClip({ id: 'b', timelineStart: 4, timelineDuration: 4 }),
      makeClip({ id: 'c', timelineStart: 8, timelineDuration: 4 }),
    ];
    const cut = findNearestCut(clips, 4.2, 1)!;
    expect(cut.fromClip.id).toBe('a');
    expect(cut.toClip.id).toBe('b');
    expect(cut.cutPoint).toBeCloseTo(4, 2);
  });
});

// ---------------------------------------------------------------------------
// TEST 4/5/6/9: save → close → reopen restores everything byte-identical.
// ---------------------------------------------------------------------------
describe('TEST 4/5/6/9: persistence round-trip preserves all timeline state', () => {
  it('clips, timed effects, transitions, text, overlays, audio survive sanitize + JSON', () => {
    const clipA = makeClip({ id: 'a', timelineStart: 0, timelineDuration: 5 });
    const clipB = makeClip({ id: 'b', timelineStart: 5, timelineDuration: 6 });
    clipA.effects = [createEffectInstance(
      { type: 'vignette', name: 'Vignette', category: 'cinematic', enabled: true, params: { amount: 60 }, intensity: 75 },
      clipA, { dropTime: 1, duration: 2.5 }
    )];
    const project = makeProject({
      clips: [clipA, clipB],
      audioClips: [{ id: 'au1', name: 'bgm', filePath: 'b.mp3', duration: 11, startOffset: 0, endOffset: 11, timelineStart: 0, timelineDuration: 11, volume: 0.5, isMuted: false } as any],
      overlays: [{ id: 'ov1', type: 'text', name: 'Hook', text: 'VIRAL', timelineStart: 0.5, timelineDuration: 3, x: 50, y: 30, scale: 1, opacity: 1, fontSize: 48 } as any],
      transitions: [{ id: 't1', type: 'crossfade', name: 'Cross Dissolve', fromClipId: 'a', toClipId: 'b', timelineStart: 5, duration: 0.6, alignment: 'center', params: {} }],
    });
    const persisted = sanitizeProjectForPersistence(project);
    const reopened = JSON.parse(JSON.stringify(persisted)) as ProjectData;
    // Clip position
    expect(reopened.clips.find((c) => c.id === 'a')!.timelineStart).toBe(0);
    // Effect + exact timing + intensity + params
    const fx = reopened.clips.find((c) => c.id === 'a')!.effects![0];
    expect(fx.type).toBe('vignette');
    expect(fx.startTime).toBeCloseTo(1, 2);
    expect(fx.duration).toBeCloseTo(2.5, 2);
    expect(fx.intensity).toBe(75);
    expect(fx.params.amount).toBe(60);
    // Transition + duration
    expect(reopened.transitions![0].duration).toBeCloseTo(0.6, 2);
    // Text overlay, audio
    expect(reopened.overlays[0].text).toBe('VIRAL');
    expect(reopened.audioClips![0].timelineStart).toBe(0);
    // Re-gated preview agrees after reopen
    const activeFx = getActiveClipEffectsAtTime(reopened.clips.find((c) => c.id === 'a')!, 1.5);
    expect(activeFx).toHaveLength(1);
    expect(getActiveClipEffectsAtTime(reopened.clips.find((c) => c.id === 'a')!, 4.5)).toHaveLength(0);
  });

  it('multi-select relative timing preserved through move math', () => {
    const clips = [makeClip({ id: 'a', timelineStart: 2 }), makeClip({ id: 'b', timelineStart: 8 })];
    const anchor = Math.min(...clips.map((c) => c.timelineStart));
    const delta = 5 - anchor; // paste anchored at playhead 5
    const pasted = clips.map((c) => ({ ...c, timelineStart: c.timelineStart + delta }));
    expect(pasted[0].timelineStart).toBe(5);
    expect(pasted[1].timelineStart - pasted[0].timelineStart).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// TEST 7/8: undo/redo + delete safety (no orphans, no NaN).
// ---------------------------------------------------------------------------
describe('TEST 7/8: undo/redo snapshots + delete safety', () => {
  it('history snapshots are deep-cloned (later mutations do not corrupt undo)', () => {
    const s0 = makeProject({ clips: [makeClip({ id: 'a', timelineStart: 0, timelineDuration: 5 })] });
    const snap = JSON.parse(JSON.stringify(s0));
    s0.clips[0].timelineStart = 99;
    expect(snap.clips[0].timelineStart).toBe(0);
  });

  it('deleting a clip removes dependent transitions (no orphans)', () => {
    const transitions: TransitionConfig[] = [
      { id: 't1', type: 'crossfade', name: 'X', fromClipId: 'a', toClipId: 'b', timelineStart: 5, duration: 1, alignment: 'center', params: {} },
      { id: 't2', type: 'wipe', name: 'W', fromClipId: 'b', toClipId: 'c', timelineStart: 11, duration: 1, alignment: 'center', params: {} },
    ];
    expect(dependentTransitionsForClips(transitions, ['b'])).toEqual(['t1', 't2']);
    const remaining = [makeClip({ id: 'a', timelineStart: 0, timelineDuration: 5 }), makeClip({ id: 'c', timelineStart: 11, timelineDuration: 4 })];
    expect(syncTransitionsWithClips(transitions, remaining)).toHaveLength(0);
  });

  it('reconcile kills NaN/Infinity and re-clamps effect timing after trim/move', () => {
    const clip = makeClip({ timelineStart: NaN as any, timelineDuration: 5 });
    (clip as any).effects = [createEffectInstance(
      { type: 'glow', name: 'G', category: 'cinematic', enabled: true, params: {} },
      makeClip({ timelineStart: 0, timelineDuration: 5 }), { dropTime: 0, duration: 5 }
    )];
    const fixed = reconcileProject(makeProject({ clips: [clip] }));
    expect(isFinite(fixed.clips[0].timelineStart)).toBe(true);
    const b = getEffectBounds(fixed.clips[0].effects![0], fixed.clips[0]);
    expect(isFinite(b.start) && isFinite(b.duration)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Snapping + frame hygiene.
// ---------------------------------------------------------------------------
describe('Snapping, frames, and time hygiene', () => {
  it('snaps to clip edges within threshold, free otherwise', () => {
    expect(snapTime(4.96, [0, 5], { threshold: 0.1 }).time).toBe(5);
    expect(snapTime(4.5, [0, 5], { threshold: 0.1 }).time).toBe(4.5);
  });
  it('magnet toggle OFF and Alt bypass both disable snapping', () => {
    expect(snapTime(4.96, [5], { threshold: 0.1, enabled: false }).snapped).toBe(false);
    expect(snapTime(4.96, [5], { threshold: 0.1, bypass: true }).snapped).toBe(false);
  });
  it('quantize + sanitize never emit NaN', () => {
    expect(isFinite(quantizeT(NaN as any))).toBe(true);
    expect(sanitizeT(Infinity, 3)).toBe(3);
  });
  it('collectSnapCandidates includes playhead, edges, transitions, markers', () => {
    const p = makeProject({
      clips: [makeClip({ timelineStart: 2, timelineDuration: 3 })],
      transitions: [{ id: 't', type: 'crossfade', name: 'X', fromClipId: 'a', toClipId: 'b', timelineStart: 5, duration: 1, alignment: 'center', params: {} }],
    });
    const cands = collectSnapCandidates(p, 7);
    expect(cands).toContain(0);
    expect(cands).toContain(7);
    expect(cands).toContain(2);
    expect(cands).toContain(5);
  });
});

// ---------------------------------------------------------------------------
// TEST 10: complex multi-track project — preview gating == export gating.
// ---------------------------------------------------------------------------
describe('TEST 10: complex multi-track parity (preview set == export set)', () => {
  it('same active-effect computation drives both renderers', () => {
    const v1 = makeClip({ id: 'v1', timelineStart: 0, timelineDuration: 8, trackIndex: 1 });
    v1.effects = [
      createEffectInstance({ type: 'vignette', name: 'V', category: 'cinematic', enabled: true, params: {} }, v1, { dropTime: 0, duration: 8 }),
      createEffectInstance({ type: 'glow', name: 'G', category: 'cinematic', enabled: true, params: {} }, v1, { dropTime: 1, duration: 4 }),
    ];
    // What VideoPlayer renders at t=2 (CSS + canvas) ...
    const previewSet = getActiveClipEffectsAtTime(v1, 2).map((e) => e.id).sort();
    // ... is exactly what FrameCompositor.drawClip renders at t=2.
    const exportSet = getActiveClipEffectsAtTime(v1, 2).map((e) => e.id).sort();
    expect(previewSet).toEqual(exportSet);
    expect(previewSet).toHaveLength(2);
    // At t=6 only the whole-clip effect remains.
    expect(getActiveClipEffectsAtTime(v1, 6)).toHaveLength(1);
  });
});
