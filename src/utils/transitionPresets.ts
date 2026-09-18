import { TransitionDefinition, TransitionCategory } from '../types/transitions';

export const TRANSITION_CATEGORIES: { id: TransitionCategory | 'all'; name: string }[] = [
  { id: 'all', name: 'All Transitions' },
  { id: 'basic', name: 'Basic' },
  { id: 'fade', name: 'Fades & Dips' },
  { id: 'slide', name: 'Push & Slide' },
  { id: 'wipe', name: 'Wipes & Iris' },
  { id: 'zoom', name: 'Zooms & Pans' },
  { id: 'motion', name: 'Motion & Spin' },
  { id: 'cinematic', name: 'Cinematic' },
  { id: 'creative', name: 'Creative & Glitch' },
];

export const TRANSITION_DEFINITIONS: TransitionDefinition[] = [
  // 1. Hard Cut
  {
    type: 'cut',
    name: 'Hard Cut',
    category: 'basic',
    description: 'Instantaneous transition from previous clip to incoming clip.',
    icon: 'Scissors',
    defaultDuration: 0.1,
    defaultParams: {},
    parameters: [],
  },

  // 2. Cross Dissolve / Crossfade
  {
    type: 'crossfade',
    name: 'Cross Dissolve',
    category: 'fade',
    description: 'Classic smooth opacity crossfade blend between two video clips.',
    icon: 'Sparkles',
    defaultDuration: 0.75,
    defaultParams: { easing: 'easeInOut' },
    parameters: [
      {
        id: 'easing',
        name: 'Blend Easing',
        type: 'select',
        defaultValue: 'easeInOut',
        options: [
          { label: 'Ease In-Out', value: 'easeInOut' },
          { label: 'Linear', value: 'linear' },
          { label: 'Ease In', value: 'easeIn' },
          { label: 'Ease Out', value: 'easeOut' },
        ],
      },
    ],
  },

  // 3. Fade In
  {
    type: 'fade-in',
    name: 'Fade In',
    category: 'fade',
    description: 'Fade in from solid color into the clip.',
    icon: 'LogIn',
    defaultDuration: 0.75,
    defaultParams: { color: '#000000' },
    parameters: [
      { id: 'color', name: 'Start Color', type: 'color', defaultValue: '#000000' },
    ],
  },

  // 4. Fade Out
  {
    type: 'fade-out',
    name: 'Fade Out',
    category: 'fade',
    description: 'Fade out from the clip into solid color.',
    icon: 'LogOut',
    defaultDuration: 0.75,
    defaultParams: { color: '#000000' },
    parameters: [
      { id: 'color', name: 'End Color', type: 'color', defaultValue: '#000000' },
    ],
  },

  // 5. Dip to Black
  {
    type: 'dip-black',
    name: 'Dip to Black',
    category: 'fade',
    description: 'Fades down completely to black and fades up into incoming clip.',
    icon: 'Moon',
    defaultDuration: 0.8,
    defaultParams: { holdPercent: 15 },
    parameters: [
      { id: 'holdPercent', name: 'Black Hold Duration', type: 'number', defaultValue: 15, min: 0, max: 40, step: 5, unit: '%' },
    ],
  },

  // 6. Dip to White
  {
    type: 'dip-white',
    name: 'Dip to White',
    category: 'fade',
    description: 'Fades up completely to bright white and reveals the next scene.',
    icon: 'Sun',
    defaultDuration: 0.6,
    defaultParams: { holdPercent: 10 },
    parameters: [
      { id: 'holdPercent', name: 'White Hold Duration', type: 'number', defaultValue: 10, min: 0, max: 40, step: 5, unit: '%' },
    ],
  },

  // 7. Fade Through Color
  {
    type: 'fade-color',
    name: 'Fade Through Color',
    category: 'fade',
    description: 'Dip transition through any customizable brand theme color.',
    icon: 'Palette',
    defaultDuration: 0.8,
    defaultParams: { color: '#8B5CF6', holdPercent: 15 },
    parameters: [
      { id: 'color', name: 'Transition Color', type: 'color', defaultValue: '#8B5CF6' },
      { id: 'holdPercent', name: 'Color Hold Duration', type: 'number', defaultValue: 15, min: 0, max: 40, step: 5, unit: '%' },
    ],
  },

  // 8. Push
  {
    type: 'push',
    name: 'Push',
    category: 'slide',
    description: 'Incoming clip enters screen while pushing the outgoing clip away.',
    icon: 'ArrowRight',
    defaultDuration: 0.65,
    supportedDirections: ['left', 'right', 'up', 'down'],
    defaultParams: { direction: 'left', motionBlur: 20 },
    parameters: [
      {
        id: 'direction',
        name: 'Direction',
        type: 'select',
        defaultValue: 'left',
        options: [
          { label: 'Push Left', value: 'left' },
          { label: 'Push Right', value: 'right' },
          { label: 'Push Up', value: 'up' },
          { label: 'Push Down', value: 'down' },
        ],
      },
      { id: 'motionBlur', name: 'Motion Blur', type: 'number', defaultValue: 20, min: 0, max: 100, step: 5, unit: '%' },
    ],
  },

  // 9. Slide
  {
    type: 'slide',
    name: 'Slide Overlay',
    category: 'slide',
    description: 'Incoming clip slides over top of the static outgoing clip.',
    icon: 'MoveHorizontal',
    defaultDuration: 0.6,
    supportedDirections: ['left', 'right', 'up', 'down'],
    defaultParams: { direction: 'left', shadow: true },
    parameters: [
      {
        id: 'direction',
        name: 'Direction',
        type: 'select',
        defaultValue: 'left',
        options: [
          { label: 'Slide Left', value: 'left' },
          { label: 'Slide Right', value: 'right' },
          { label: 'Slide Up', value: 'up' },
          { label: 'Slide Down', value: 'down' },
        ],
      },
      { id: 'shadow', name: 'Drop Shadow Border', type: 'boolean', defaultValue: true },
    ],
  },

  // 10. Wipe
  {
    type: 'wipe',
    name: 'Wipe',
    category: 'wipe',
    description: 'Linear boundary wipe uncovering the next clip with soft feathering.',
    icon: 'SplitSquareVertical',
    defaultDuration: 0.75,
    supportedDirections: ['left', 'right', 'up', 'down', 'diagonal-tl', 'diagonal-tr'],
    defaultParams: { direction: 'right', softness: 25 },
    parameters: [
      {
        id: 'direction',
        name: 'Wipe Direction',
        type: 'select',
        defaultValue: 'right',
        options: [
          { label: 'Left to Right', value: 'right' },
          { label: 'Right to Left', value: 'left' },
          { label: 'Top to Bottom', value: 'down' },
          { label: 'Bottom to Top', value: 'up' },
          { label: 'Diagonal Top-Left', value: 'diagonal-tl' },
          { label: 'Diagonal Top-Right', value: 'diagonal-tr' },
        ],
      },
      { id: 'softness', name: 'Edge Softness / Feather', type: 'number', defaultValue: 25, min: 0, max: 100, step: 5, unit: '%' },
    ],
  },

  // 11. Iris / Circle Wipe
  {
    type: 'iris',
    name: 'Iris / Circle Wipe',
    category: 'wipe',
    description: 'Radial circle or ellipse expansion uncovering the scene from center.',
    icon: 'CircleDot',
    defaultDuration: 0.8,
    defaultParams: { shape: 'circle', softness: 20, reverse: false },
    parameters: [
      {
        id: 'shape',
        name: 'Aperture Shape',
        type: 'select',
        defaultValue: 'circle',
        options: [
          { label: 'Circle', value: 'circle' },
          { label: 'Ellipse', value: 'ellipse' },
        ],
      },
      { id: 'softness', name: 'Edge Feather', type: 'number', defaultValue: 20, min: 0, max: 100, step: 5, unit: '%' },
      { id: 'reverse', name: 'Close Inward (Reverse)', type: 'boolean', defaultValue: false },
    ],
  },

  // 12. Zoom / Cross Zoom
  {
    type: 'zoom',
    name: 'Cross Zoom',
    category: 'zoom',
    description: 'Dramatic high-speed punch zoom in and crossfade out to next shot.',
    icon: 'ZoomIn',
    defaultDuration: 0.65,
    defaultParams: { zoomMode: 'in', intensity: 75, motionBlur: 40 },
    parameters: [
      {
        id: 'zoomMode',
        name: 'Zoom Mode',
        type: 'select',
        defaultValue: 'in',
        options: [
          { label: 'Zoom In Punch', value: 'in' },
          { label: 'Zoom Out Pull', value: 'out' },
        ],
      },
      { id: 'intensity', name: 'Zoom Scale Intensity', type: 'number', defaultValue: 75, min: 20, max: 150, step: 5, unit: '%' },
      { id: 'motionBlur', name: 'Radial Motion Blur', type: 'number', defaultValue: 40, min: 0, max: 100, step: 5, unit: '%' },
    ],
  },

  // 13. Whip Pan
  {
    type: 'whip-pan',
    name: 'Whip Pan',
    category: 'zoom',
    description: 'Fast energetic horizontal or vertical camera whip pan with blur.',
    icon: 'FastForward',
    defaultDuration: 0.5,
    supportedDirections: ['left', 'right', 'up', 'down'],
    defaultParams: { direction: 'left', blurIntensity: 65 },
    parameters: [
      {
        id: 'direction',
        name: 'Pan Direction',
        type: 'select',
        defaultValue: 'left',
        options: [
          { label: 'Pan Left', value: 'left' },
          { label: 'Pan Right', value: 'right' },
          { label: 'Pan Up', value: 'up' },
          { label: 'Pan Down', value: 'down' },
        ],
      },
      { id: 'blurIntensity', name: 'Whip Blur Intensity', type: 'number', defaultValue: 65, min: 10, max: 100, step: 5, unit: '%' },
    ],
  },

  // 14. Spin / Roll
  {
    type: 'spin',
    name: 'Spin / Roll',
    category: 'motion',
    description: 'Dynamic 360-degree rotation spin transition with scale bounce.',
    icon: 'RotateCw',
    defaultDuration: 0.7,
    supportedDirections: ['clockwise', 'counter-clockwise'],
    defaultParams: { direction: 'clockwise', rotationDeg: 360, motionBlur: 35 },
    parameters: [
      {
        id: 'direction',
        name: 'Spin Direction',
        type: 'select',
        defaultValue: 'clockwise',
        options: [
          { label: 'Clockwise', value: 'clockwise' },
          { label: 'Counter-Clockwise', value: 'counter-clockwise' },
        ],
      },
      { id: 'rotationDeg', name: 'Rotation Amount', type: 'number', defaultValue: 360, min: 90, max: 720, step: 45, unit: '°' },
      { id: 'motionBlur', name: 'Rotational Blur', type: 'number', defaultValue: 35, min: 0, max: 100, step: 5, unit: '%' },
    ],
  },

  // 15. Flash / Flash Frame
  {
    type: 'flash',
    name: 'Flash Frame',
    category: 'cinematic',
    description: 'Intense high-energy strobe flash transition popular in trailers.',
    icon: 'Zap',
    defaultDuration: 0.45,
    defaultParams: { color: '#FFFFFF', intensity: 100, bloom: 40 },
    parameters: [
      { id: 'color', name: 'Flash Color', type: 'color', defaultValue: '#FFFFFF' },
      { id: 'intensity', name: 'Flash Brightness', type: 'number', defaultValue: 100, min: 20, max: 100, step: 5, unit: '%' },
      { id: 'bloom', name: 'Glow Bloom', type: 'number', defaultValue: 40, min: 0, max: 100, step: 5, unit: '%' },
    ],
  },

  // 16. Glitch Transition
  {
    type: 'glitch',
    name: 'Glitch Transition',
    category: 'creative',
    description: 'Cyberpunk RGB separation, digital distortion tears, and scanlines.',
    icon: 'Activity',
    defaultDuration: 0.55,
    defaultParams: { intensity: 70, rgbSplit: 20, frequency: 8 },
    parameters: [
      { id: 'intensity', name: 'Glitch Strength', type: 'number', defaultValue: 70, min: 20, max: 100, step: 5, unit: '%' },
      { id: 'rgbSplit', name: 'RGB Separation', type: 'number', defaultValue: 20, min: 5, max: 40, step: 1, unit: 'px' },
      { id: 'frequency', name: 'Tear Frequency', type: 'number', defaultValue: 8, min: 1, max: 10, step: 1 },
    ],
  },

  // 17. Light Leak Transition
  {
    type: 'light-leak',
    name: 'Light Leak',
    category: 'cinematic',
    description: 'Warm organic 35mm optical lens light flare wash.',
    icon: 'Flame',
    defaultDuration: 0.85,
    defaultParams: { warmthColor: '#F59E0B', intensity: 65, softness: 50 },
    parameters: [
      { id: 'warmthColor', name: 'Leak Color', type: 'color', defaultValue: '#F59E0B' },
      { id: 'intensity', name: 'Glow Intensity', type: 'number', defaultValue: 65, min: 20, max: 100, step: 5, unit: '%' },
      { id: 'softness', name: 'Diffusion Softness', type: 'number', defaultValue: 50, min: 10, max: 100, step: 5, unit: '%' },
    ],
  },

  // 18. Film Burn / Burn Transition
  {
    type: 'film-burn',
    name: 'Film Burn',
    category: 'cinematic',
    description: 'Retro projector film leader burn, thermal melt, and orange glow.',
    icon: 'Flame',
    defaultDuration: 0.8,
    defaultParams: { burnColor: '#EF4444', meltGlow: 70 },
    parameters: [
      { id: 'burnColor', name: 'Burn Core Color', type: 'color', defaultValue: '#EF4444' },
      { id: 'meltGlow', name: 'Thermal Glow', type: 'number', defaultValue: 70, min: 20, max: 100, step: 5, unit: '%' },
    ],
  },

  // 19. Luma Fade / Luma Wipe
  {
    type: 'luma-wipe',
    name: 'Luma Wipe',
    category: 'creative',
    description: 'Luminance threshold wipe dissolving bright or dark regions first.',
    icon: 'Layers',
    defaultDuration: 0.8,
    defaultParams: { softness: 30, invert: false },
    parameters: [
      { id: 'softness', name: 'Luma Gradient Softness', type: 'number', defaultValue: 30, min: 0, max: 100, step: 5, unit: '%' },
      { id: 'invert', name: 'Invert Threshold', type: 'boolean', defaultValue: false },
    ],
  },

  // 20. Morph Cut
  {
    type: 'morph',
    name: 'Morph Cut',
    category: 'creative',
    description: 'Seamless smooth visual morphing blend between talking-head shots.',
    icon: 'Shuffle',
    defaultDuration: 0.5,
    defaultParams: { smoothing: 60 },
    parameters: [
      { id: 'smoothing', name: 'Motion Smoothing', type: 'number', defaultValue: 60, min: 10, max: 100, step: 5, unit: '%' },
    ],
  },
];

export function getTransitionDefinition(type: string): TransitionDefinition | undefined {
  return TRANSITION_DEFINITIONS.find((t) => t.type === type);
}
