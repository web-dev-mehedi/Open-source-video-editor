export type AnimationCategory = 'in' | 'out' | 'combo';

export type AnimationType =
  // In Animations
  | 'fade-in'
  | 'zoom-in'
  | 'zoom-out'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'pop'
  | 'spin'
  // Out Animations
  | 'fade-out'
  | 'zoom-in-out'
  | 'zoom-out-out'
  | 'slide-left-out'
  | 'slide-right-out'
  | 'slide-up-out'
  | 'slide-down-out'
  | 'shrink'
  | 'spin-out'
  // Combo Animations
  | 'pulse'
  | 'pendulum'
  | 'float'
  | 'zoom-combo';

export interface ClipAnimationConfig {
  id?: string;
  category: AnimationCategory;
  type: AnimationType | string;
  name: string;
  duration: number; // Duration in seconds (0.1 to clip duration)
  delay?: number; // Optional delay before start in seconds
  intensity?: number; // 0 to 100%
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
}

export interface AnimationPreset {
  type: AnimationType;
  category: AnimationCategory;
  name: string;
  description: string;
  defaultDuration: number;
  iconName: string;
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  // --- IN ANIMATIONS ---
  {
    type: 'fade-in',
    category: 'in',
    name: 'Fade In',
    description: 'Smooth opacity dissolve from transparent',
    defaultDuration: 0.6,
    iconName: 'Eye',
  },
  {
    type: 'zoom-in',
    category: 'in',
    name: 'Zoom In',
    description: 'Scales up smoothly from distance into frame',
    defaultDuration: 0.6,
    iconName: 'Maximize2',
  },
  {
    type: 'zoom-out',
    category: 'in',
    name: 'Zoom Out',
    description: 'Settles into frame from large scale',
    defaultDuration: 0.6,
    iconName: 'Minimize2',
  },
  {
    type: 'slide-right',
    category: 'in',
    name: 'Slide Right',
    description: 'Glides smoothly into frame from the left',
    defaultDuration: 0.6,
    iconName: 'ArrowRight',
  },
  {
    type: 'slide-left',
    category: 'in',
    name: 'Slide Left',
    description: 'Glides smoothly into frame from the right',
    defaultDuration: 0.6,
    iconName: 'ArrowLeft',
  },
  {
    type: 'slide-up',
    category: 'in',
    name: 'Slide Up',
    description: 'Rises into view from bottom',
    defaultDuration: 0.6,
    iconName: 'ArrowUp',
  },
  {
    type: 'slide-down',
    category: 'in',
    name: 'Slide Down',
    description: 'Drops into view from top',
    defaultDuration: 0.6,
    iconName: 'ArrowDown',
  },
  {
    type: 'pop',
    category: 'in',
    name: 'Pop / Bounce',
    description: 'Punchy elastic pop with natural spring bounce',
    defaultDuration: 0.5,
    iconName: 'Sparkles',
  },
  {
    type: 'spin',
    category: 'in',
    name: 'Spin In',
    description: 'Rotates 180 degrees into place while fading in',
    defaultDuration: 0.7,
    iconName: 'RotateCw',
  },

  // --- OUT ANIMATIONS ---
  {
    type: 'fade-out',
    category: 'out',
    name: 'Fade Out',
    description: 'Smooth opacity dissolve to transparent',
    defaultDuration: 0.6,
    iconName: 'EyeOff',
  },
  {
    type: 'zoom-out-out',
    category: 'out',
    name: 'Zoom Out',
    description: 'Shrinks into distance and fades away',
    defaultDuration: 0.6,
    iconName: 'Minimize2',
  },
  {
    type: 'zoom-in-out',
    category: 'out',
    name: 'Zoom In',
    description: 'Expands past camera while dissolving',
    defaultDuration: 0.6,
    iconName: 'Maximize2',
  },
  {
    type: 'slide-left-out',
    category: 'out',
    name: 'Slide Left',
    description: 'Exits frame smoothly towards the left',
    defaultDuration: 0.6,
    iconName: 'ArrowLeft',
  },
  {
    type: 'slide-right-out',
    category: 'out',
    name: 'Slide Right',
    description: 'Exits frame smoothly towards the right',
    defaultDuration: 0.6,
    iconName: 'ArrowRight',
  },
  {
    type: 'slide-up-out',
    category: 'out',
    name: 'Slide Up',
    description: 'Exits upwards past top edge',
    defaultDuration: 0.6,
    iconName: 'ArrowUp',
  },
  {
    type: 'slide-down-out',
    category: 'out',
    name: 'Slide Down',
    description: 'Exits downwards past bottom edge',
    defaultDuration: 0.6,
    iconName: 'ArrowDown',
  },
  {
    type: 'shrink',
    category: 'out',
    name: 'Shrink Out',
    description: 'Rapid spring contraction into center point',
    defaultDuration: 0.5,
    iconName: 'Minimize',
  },
  {
    type: 'spin-out',
    category: 'out',
    name: 'Spin Out',
    description: 'Rotates 180 degrees away while fading out',
    defaultDuration: 0.7,
    iconName: 'RotateCcw',
  },

  // --- COMBO ANIMATIONS ---
  {
    type: 'pulse',
    category: 'combo',
    name: 'Rhythmic Pulse',
    description: 'Gentle heartbeat scale modulation',
    defaultDuration: 1.2,
    iconName: 'Activity',
  },
  {
    type: 'pendulum',
    category: 'combo',
    name: 'Pendulum Swing',
    description: 'Subtle rotational sway like a clock pendulum',
    defaultDuration: 2.0,
    iconName: 'Radio',
  },
  {
    type: 'float',
    category: 'combo',
    name: 'Floating Hover',
    description: 'Weightless organic vertical drifting',
    defaultDuration: 2.4,
    iconName: 'Waves',
  },
  {
    type: 'zoom-combo',
    category: 'combo',
    name: 'Slow Push (Ken Burns)',
    description: 'Cinematic continuous slow push-in',
    defaultDuration: 3.0,
    iconName: 'ZoomIn',
  },
];
