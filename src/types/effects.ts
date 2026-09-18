export type EffectType =
  | 'brightness-contrast'
  | 'exposure'
  | 'saturation'
  | 'temperature'
  | 'tint'
  | 'hue'
  | 'vibrance'
  | 'sharpen'
  | 'gaussian-blur'
  | 'motion-blur'
  | 'vignette'
  | 'film-grain'
  | 'noise'
  | 'chromatic-aberration'
  | 'glow'
  | 'lens-flare'
  | 'glitch'
  | 'pixelate'
  | 'black-white'
  | 'sepia';

export type EffectCategory = 'basic' | 'color' | 'cinematic' | 'blur' | 'distortion' | 'creative';

export interface EffectParameterSchema {
  id: string;
  name: string;
  type: 'number' | 'color' | 'boolean' | 'select';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { label: string; value: any }[];
  description?: string;
}

export interface EffectDefinition {
  type: EffectType;
  name: string;
  category: EffectCategory;
  description: string;
  icon: string;
  parameters: EffectParameterSchema[];
  defaultParams: Record<string, any>;
}

export interface ClipEffect {
  id: string;
  type: EffectType;
  name: string;
  category: EffectCategory;
  enabled: boolean;
  params: Record<string, any>;
  /**
   * NLE timeline placement (absolute project-timeline seconds).
   * - startTime: when the effect becomes active. Defaults to the host clip's
   *   timelineStart when undefined (whole-clip effect, backward compatible).
   * - duration: how long the effect stays active. Defaults to the host clip's
   *   remaining duration when undefined.
   * Both are clamped to the host clip bounds on every mutation so preview,
   * save/reopen and export always agree on exact timing.
   */
  startTime?: number;
  duration?: number;
  /** 0..100 master strength. Multiplies effect-specific intensity params where applicable. */
  intensity?: number;
  /** Compositing blend mode for canvas post-effects where applicable. */
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'difference' | 'soft-light';
}
