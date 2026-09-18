export type AnimationCategory = 'in' | 'out' | 'loop';

export type InAnimationPreset =
  | 'none'
  | 'fade-in'
  | 'pop-in'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'bounce-in'
  | 'typewriter'
  | 'blur-in'
  | 'flip-in'
  | 'drop-in'
  | 'rise-up';

export type OutAnimationPreset =
  | 'none'
  | 'fade-out'
  | 'pop-out'
  | 'slide-down'
  | 'slide-up'
  | 'slide-left'
  | 'slide-right'
  | 'blur-out'
  | 'drop-out';

export type LoopAnimationPreset =
  | 'none'
  | 'pulse'
  | 'bounce-loop'
  | 'floating'
  | 'shake'
  | 'glow-pulse'
  | 'heartbeat';

export type AnimationEasing =
  | 'linear'
  | 'ease-out'
  | 'ease-in-out'
  | 'back-out'
  | 'elastic-out'
  | 'bounce';

export interface CaptionAnimationConfig {
  // IN Animation
  inPreset: InAnimationPreset;
  inDuration: number; // in seconds (0.1s to 2.0s, default 0.35)
  inDelay?: number; // in seconds
  inEasing?: AnimationEasing;

  // OUT Animation
  outPreset: OutAnimationPreset;
  outDuration: number; // in seconds (0.1s to 2.0s, default 0.35)
  outDelay?: number;
  outEasing?: AnimationEasing;

  // LOOP Animation
  loopPreset: LoopAnimationPreset;
  loopSpeed?: number; // 0.5 to 3.0 (default 1.0)
  loopIntensity?: number; // 0.5 to 3.0 (default 1.0)
}

export interface AnimationDefinition {
  id: string;
  name: string;
  category: AnimationCategory;
  description: string;
  defaultDuration: number;
  iconName: string;
}

export const DEFAULT_ANIMATION_CONFIG: CaptionAnimationConfig = {
  inPreset: 'pop-in',
  inDuration: 0.35,
  inEasing: 'back-out',
  outPreset: 'none',
  outDuration: 0.3,
  outEasing: 'ease-out',
  loopPreset: 'none',
  loopSpeed: 1.0,
  loopIntensity: 1.0,
};
