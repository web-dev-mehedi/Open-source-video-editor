/**
 * Preset Bridge — single source of truth mapping CapCut-style UI library
 * preset IDs (EFFECT_PRESETS / FILTER_PRESETS / TRANSITION_PRESETS in
 * src/data/effectsPresets.ts) to real render-engine types
 * (EffectType / TransitionType in src/types/*).
 *
 * WHY THIS EXISTS (bug fix):
 * The library cards used raw preset.id values such as 'shake', 'edge-glow',
 * 'zoom-in', 'whip-left' directly as engine types. Those IDs have no
 * EFFECT_DEFINITIONS / TRANSITION_DEFINITIONS entry, so addEffectToClip
 * silently early-returned (fake drag-and-drop: UI toast said "applied" but
 * nothing changed in project state, preview, or export) and unknown
 * transition types rendered nothing in FrameCompositor. Every library
 * entry now resolves through this bridge, so click-apply AND drag-drop
 * always produce a real engine-backed timeline object that previews,
 * persists, and exports identically.
 */

import { EffectType } from '../types/effects';
import { TransitionType, TransitionDirection } from '../types/transitions';
import { getEffectDefinition } from './effectPresets';
import { getTransitionDefinition } from './transitionPresets';
import { EFFECT_PRESETS, FILTER_PRESETS, TRANSITION_PRESETS } from '../data/effectsPresets';

export interface ResolvedEffect {
  engineType: EffectType;
  name: string;
  params: Record<string, any>;
}

export interface ResolvedTransition {
  engineType: TransitionType;
  name: string;
  direction?: TransitionDirection;
  duration: number;
  params: Record<string, any>;
}

/** UI effect preset id -> real engine effect + sensible default params. */
const EFFECT_ALIASES: Record<string, { engine: EffectType; params?: Record<string, any>; name?: string }> = {
  shake: { engine: 'motion-blur', params: { amount: 18, angle: 0 }, name: 'Camera Shake' },
  'edge-glow': { engine: 'glow', params: { intensity: 65, radius: 24, threshold: 55 }, name: 'Edge Glow' },
  'rgb-split': { engine: 'chromatic-aberration', params: { offset: 10, angle: 0, channel: 'red-cyan' }, name: 'RGB Chromatic Split' },
  scanlines: { engine: 'glitch', params: { intensity: 40, frequency: 5, rgbSplit: 6, scanlines: 70 }, name: 'Retro CRT Scanlines' },
  'prism-blur': { engine: 'gaussian-blur', params: { radius: 14 }, name: 'Prism Blur Refraction' },
  strobe: { engine: 'glow', params: { intensity: 80, radius: 12, threshold: 40 }, name: 'Strobe Flash' },
  'vhs-glitch': { engine: 'glitch', params: { intensity: 65, frequency: 7, rgbSplit: 18, scanlines: 45 }, name: 'VHS 1986 Tape' },
  'film-grain': { engine: 'film-grain', params: { amount: 35, size: 1.5, speed: 1.0 }, name: '35mm Film Grain' },
  vignette: { engine: 'vignette', params: { amount: 55, size: 0.65, feather: 60 }, name: 'Cinematic Vignette' },
  mirror: { engine: 'chromatic-aberration', params: { offset: 6, angle: 45, channel: 'red-cyan' }, name: 'Kaleidoscope Mirror' },
};

/** UI filter preset id -> engine effect + color-grading patch (both applied together). */
const FILTER_ALIASES: Record<string, { engine: EffectType; engineParams?: Record<string, any>; grading?: Record<string, any> }> = {
  'teal-orange': { engine: 'temperature', engineParams: { temperature: 15, tint: -10 }, grading: { temperature: 15, tint: -10, contrast: 1.25, saturation: 1.2 } },
  'moody-cinema': { engine: 'vignette', engineParams: { amount: 45, size: 0.6, feather: 55 }, grading: { contrast: 1.35, saturation: 0.8, brightness: -0.08 } },
  'cyberpunk-neon': { engine: 'vibrance', engineParams: { vibrance: 60 }, grading: { temperature: -20, tint: 40, contrast: 1.4, saturation: 2.1 } },
  'vintage-90s': { engine: 'sepia', engineParams: { intensity: 45, warmth: 30, vintageFade: 20 }, grading: { temperature: 30, tint: 12, contrast: 1.1, saturation: 1.1 } },
  'bw-high-contrast': { engine: 'black-white', engineParams: { amount: 100, contrastBoost: 30 }, grading: { contrast: 1.55, saturation: 0 } },
  'warm-sunset': { engine: 'temperature', engineParams: { temperature: 45, tint: 15 }, grading: { temperature: 45, tint: 15, contrast: 1.15, saturation: 1.4 } },
  'emerald-cold': { engine: 'temperature', engineParams: { temperature: -35, tint: -15 }, grading: { temperature: -35, tint: -15, contrast: 1.25, saturation: 0.95 } },
  'pastel-dream': { engine: 'vibrance', engineParams: { vibrance: 25 }, grading: { brightness: 0.15, contrast: 0.9, saturation: 1.25 } },
  'bleach-bypass': { engine: 'black-white', engineParams: { amount: 35, contrastBoost: 45 }, grading: { contrast: 1.6, saturation: 0.4 } },
};

/** UI transition preset id -> real engine transition + direction. */
const TRANSITION_ALIASES: Record<string, { engine: TransitionType; direction?: TransitionDirection; name?: string }> = {
  crossfade: { engine: 'crossfade' },
  'zoom-in': { engine: 'zoom', name: 'Flash Zoom' },
  'whip-left': { engine: 'whip-pan', direction: 'left', name: 'Whip Pan Left' },
  'whip-right': { engine: 'whip-pan', direction: 'right', name: 'Whip Pan Right' },
  glitch: { engine: 'glitch' },
  'blur-push': { engine: 'push', direction: 'up', name: 'Blur Push' },
  'page-curl': { engine: 'wipe', direction: 'right', name: 'Page Curl' },
  'light-leak': { engine: 'light-leak' },
  'dip-black': { engine: 'dip-black' },
  'dip-white': { engine: 'dip-white' },
  'slide-left': { engine: 'slide', direction: 'left', name: 'Slide Left' },
  'spin-cw': { engine: 'spin', direction: 'clockwise', name: 'Spin CW' },
};

function findUiPreset(id: string) {
  return (
    EFFECT_PRESETS.find((p) => p.id === id) ||
    FILTER_PRESETS.find((p) => p.id === id) ||
    TRANSITION_PRESETS.find((p) => p.id === id)
  );
}

/**
 * Resolve any effect/filter UI preset id (or a raw engine EffectType) to a
 * real engine-backed effect. Never returns undefined for known library ids.
 */
export function resolveEffectPreset(presetId: string): ResolvedEffect | null {
  // 1. Direct engine type (already valid) — pass through with definition defaults.
  const direct = getEffectDefinition(presetId);
  if (direct) {
    const ui = findUiPreset(presetId);
    return {
      engineType: direct.type,
      name: ui?.name || direct.name,
      params: { ...direct.defaultParams, ...(ui?.params || {}) },
    };
  }
  // 2. UI effect alias.
  const alias = EFFECT_ALIASES[presetId];
  if (alias) {
    const def = getEffectDefinition(alias.engine);
    const ui = findUiPreset(presetId);
    return {
      engineType: alias.engine,
      name: alias.name || ui?.name || def?.name || presetId,
      params: { ...(def?.defaultParams || {}), ...(ui?.params || {}), ...(alias.params || {}) },
    };
  }
  // 3. UI filter alias (filters also produce a real engine effect).
  const filter = FILTER_ALIASES[presetId];
  if (filter) {
    const def = getEffectDefinition(filter.engine);
    const ui = findUiPreset(presetId);
    return {
      engineType: filter.engine,
      name: ui?.name || def?.name || presetId,
      params: { ...(def?.defaultParams || {}), ...(ui?.params || {}), ...(filter.engineParams || {}) },
    };
  }
  return null;
}

/** Color-grading patch for a filter preset id (empty object when none). */
export function resolveFilterGrading(presetId: string): Record<string, any> {
  const ui = FILTER_PRESETS.find((p) => p.id === presetId);
  const alias = FILTER_ALIASES[presetId];
  if (!ui && !alias) return {};
  return {
    temperature: ui?.params.temperature ?? alias?.grading?.temperature ?? 0,
    tint: ui?.params.tint ?? alias?.grading?.tint ?? 0,
    contrast: ui?.params.contrast ?? alias?.grading?.contrast ?? 1,
    saturation: ui?.params.saturation ?? alias?.grading?.saturation ?? 1,
    brightness: ui?.params.brightness ?? alias?.grading?.brightness ?? 0,
    shadowColor: ui?.params.shadowColor ?? alias?.grading?.shadowColor,
    highlightColor: ui?.params.highlightColor ?? alias?.grading?.highlightColor,
  };
}

/**
 * Resolve any transition UI preset id (or raw engine TransitionType) to a
 * real engine-backed transition. Never returns undefined for known ids.
 */
export function resolveTransitionPreset(presetId: string): ResolvedTransition | null {
  const direct = getTransitionDefinition(presetId);
  if (direct) {
    const ui = findUiPreset(presetId);
    return {
      engineType: direct.type,
      name: ui?.name || direct.name,
      duration: ui?.defaultDuration || direct.defaultDuration,
      params: { ...direct.defaultParams, ...(ui?.params || {}) },
    };
  }
  const alias = TRANSITION_ALIASES[presetId];
  if (alias) {
    const def = getTransitionDefinition(alias.engine);
    const ui = findUiPreset(presetId);
    const duration = ui?.defaultDuration || def?.defaultDuration || 0.6;
    // Direction: UI param wins, else alias default, else engine default.
    const uiDir = (ui?.params?.direction as TransitionDirection | undefined) || alias.direction || (def?.defaultParams?.direction as TransitionDirection | undefined);
    return {
      engineType: alias.engine,
      name: alias.name || ui?.name || def?.name || presetId,
      direction: uiDir,
      duration,
      params: { ...(def?.defaultParams || {}), ...(ui?.params || {}), ...(uiDir ? { direction: uiDir } : {}) },
    };
  }
  return null;
}

/** True when the id is a known library preset OR a valid engine type. */
export function isKnownEffectId(id: string): boolean {
  return resolveEffectPreset(id) !== null;
}

export function isKnownTransitionId(id: string): boolean {
  return resolveTransitionPreset(id) !== null;
}
