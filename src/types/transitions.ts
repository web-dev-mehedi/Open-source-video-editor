export type TransitionType =
  | 'cut'
  | 'crossfade'
  | 'fade-in'
  | 'fade-out'
  | 'dip-black'
  | 'dip-white'
  | 'fade-color'
  | 'push'
  | 'slide'
  | 'wipe'
  | 'iris'
  | 'zoom'
  | 'whip-pan'
  | 'spin'
  | 'flash'
  | 'glitch'
  | 'light-leak'
  | 'film-burn'
  | 'luma-wipe'
  | 'morph';

export type TransitionCategory = 'basic' | 'fade' | 'slide' | 'wipe' | 'zoom' | 'motion' | 'cinematic' | 'creative';

export type TransitionDirection =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'diagonal-tl'
  | 'diagonal-tr'
  | 'clockwise'
  | 'counter-clockwise';

export type TransitionAlignment = 'center' | 'start' | 'end';

export type TransitionEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface TransitionParameterSchema {
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

export interface TransitionDefinition {
  type: TransitionType;
  name: string;
  category: TransitionCategory;
  description: string;
  icon: string;
  defaultDuration: number; // in seconds, e.g. 0.75
  supportedDirections?: TransitionDirection[];
  parameters: TransitionParameterSchema[];
  defaultParams: Record<string, any>;
}

export interface TransitionConfig {
  id: string;
  type: TransitionType;
  name: string;
  fromClipId: string;
  toClipId: string;
  timelineStart: number; // Edit point position on timeline
  duration: number; // Duration in seconds (e.g. 0.5 to 2.0)
  alignment: TransitionAlignment; // 'center' | 'start' | 'end'
  direction?: TransitionDirection;
  easing?: TransitionEasing;
  color?: string; // For fade through color, flash, etc.
  intensity?: number; // 0 to 100
  blur?: number; // 0 to 100
  softness?: number; // 0 to 100
  reverse?: boolean;
  params: Record<string, any>;
}
