import { EffectDefinition, EffectCategory } from '../types/effects';

export const EFFECT_CATEGORIES: { id: EffectCategory | 'all'; name: string }[] = [
  { id: 'all', name: 'All Effects' },
  { id: 'basic', name: 'Basic' },
  { id: 'color', name: 'Color & Tone' },
  { id: 'cinematic', name: 'Cinematic' },
  { id: 'blur', name: 'Blur & Focus' },
  { id: 'distortion', name: 'Distortion' },
  { id: 'creative', name: 'Creative' },
];

export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  // 1. Brightness & Contrast
  {
    type: 'brightness-contrast',
    name: 'Brightness & Contrast',
    category: 'basic',
    description: 'Adjust overall luminance and contrast ratio of the footage.',
    icon: 'SunMedium',
    defaultParams: { brightness: 0, contrast: 0 },
    parameters: [
      { id: 'brightness', name: 'Brightness', type: 'number', defaultValue: 0, min: -100, max: 100, step: 1, unit: '%' },
      { id: 'contrast', name: 'Contrast', type: 'number', defaultValue: 0, min: -100, max: 100, step: 1, unit: '%' },
    ],
  },

  // 2. Exposure
  {
    type: 'exposure',
    name: 'Exposure',
    category: 'basic',
    description: 'Control photographic exposure level, gamma, and tonal highlights.',
    icon: 'Sun',
    defaultParams: { exposure: 0, gamma: 1.0, highlights: 0, shadows: 0 },
    parameters: [
      { id: 'exposure', name: 'Exposure (EV)', type: 'number', defaultValue: 0, min: -3, max: 3, step: 0.1, unit: 'EV' },
      { id: 'gamma', name: 'Gamma', type: 'number', defaultValue: 1.0, min: 0.2, max: 2.5, step: 0.05 },
      { id: 'highlights', name: 'Highlights', type: 'number', defaultValue: 0, min: -100, max: 100, step: 1, unit: '%' },
      { id: 'shadows', name: 'Shadows', type: 'number', defaultValue: 0, min: -100, max: 100, step: 1, unit: '%' },
    ],
  },

  // 3. Saturation
  {
    type: 'saturation',
    name: 'Saturation',
    category: 'color',
    description: 'Boost or desaturate color intensity across all channels.',
    icon: 'Droplets',
    defaultParams: { saturation: 100 },
    parameters: [
      { id: 'saturation', name: 'Saturation', type: 'number', defaultValue: 100, min: 0, max: 300, step: 1, unit: '%' },
    ],
  },

  // 4. Temperature / White Balance
  {
    type: 'temperature',
    name: 'Temperature',
    category: 'color',
    description: 'Warm up or cool down footage with green/magenta tint correction.',
    icon: 'Thermometer',
    defaultParams: { temperature: 0, tint: 0 },
    parameters: [
      { id: 'temperature', name: 'Warmth / Coolness', type: 'number', defaultValue: 0, min: -100, max: 100, step: 1, unit: '' },
      { id: 'tint', name: 'Tint (Green / Magenta)', type: 'number', defaultValue: 0, min: -100, max: 100, step: 1, unit: '' },
    ],
  },

  // 5. Tint
  {
    type: 'tint',
    name: 'Tint & Color Wash',
    category: 'color',
    description: 'Blend a solid color wash into the image with adjustable opacity.',
    icon: 'Paintbrush',
    defaultParams: { color: '#8B5CF6', amount: 30 },
    parameters: [
      { id: 'color', name: 'Tint Color', type: 'color', defaultValue: '#8B5CF6' },
      { id: 'amount', name: 'Blend Amount', type: 'number', defaultValue: 30, min: 0, max: 100, step: 1, unit: '%' },
    ],
  },

  // 6. Hue
  {
    type: 'hue',
    name: 'Hue Shift',
    category: 'color',
    description: 'Rotate color spectrum around the color wheel.',
    icon: 'Disc',
    defaultParams: { hueShift: 0 },
    parameters: [
      { id: 'hueShift', name: 'Hue Shift', type: 'number', defaultValue: 0, min: -180, max: 180, step: 1, unit: '°' },
    ],
  },

  // 7. Vibrance
  {
    type: 'vibrance',
    name: 'Vibrance',
    category: 'color',
    description: 'Smart saturation adjustment that prevents skin tone over-saturation.',
    icon: 'Sparkles',
    defaultParams: { vibrance: 25 },
    parameters: [
      { id: 'vibrance', name: 'Vibrance Amount', type: 'number', defaultValue: 25, min: -100, max: 100, step: 1, unit: '%' },
    ],
  },

  // 8. Sharpen
  {
    type: 'sharpen',
    name: 'Sharpen',
    category: 'blur',
    description: 'Enhance high-frequency edge definition and clarity.',
    icon: 'Zap',
    defaultParams: { amount: 35, radius: 1.5 },
    parameters: [
      { id: 'amount', name: 'Sharpen Amount', type: 'number', defaultValue: 35, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'radius', name: 'Radius', type: 'number', defaultValue: 1.5, min: 0.5, max: 5.0, step: 0.1, unit: 'px' },
    ],
  },

  // 9. Gaussian Blur
  {
    type: 'gaussian-blur',
    name: 'Gaussian Blur',
    category: 'blur',
    description: 'Smooth, cinematic gaussian optical defocusing.',
    icon: 'EyeOff',
    defaultParams: { radius: 10 },
    parameters: [
      { id: 'radius', name: 'Blur Radius', type: 'number', defaultValue: 10, min: 0, max: 50, step: 1, unit: 'px' },
    ],
  },

  // 10. Motion Blur
  {
    type: 'motion-blur',
    name: 'Motion Blur',
    category: 'blur',
    description: 'Directional velocity blur for high-speed dynamic movement.',
    icon: 'Wind',
    defaultParams: { amount: 15, angle: 0 },
    parameters: [
      { id: 'amount', name: 'Blur Distance', type: 'number', defaultValue: 15, min: 0, max: 50, step: 1, unit: 'px' },
      { id: 'angle', name: 'Direction Angle', type: 'number', defaultValue: 0, min: 0, max: 360, step: 5, unit: '°' },
    ],
  },

  // 11. Vignette
  {
    type: 'vignette',
    name: 'Vignette',
    category: 'cinematic',
    description: 'Darken or lighten frame edges to guide viewer eye to center.',
    icon: 'CircleDot',
    defaultParams: { amount: 50, size: 0.65, feather: 60, roundness: 50 },
    parameters: [
      { id: 'amount', name: 'Vignette Amount', type: 'number', defaultValue: 50, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'size', name: 'Radius / Size', type: 'number', defaultValue: 0.65, min: 0.1, max: 1.0, step: 0.05 },
      { id: 'feather', name: 'Feather', type: 'number', defaultValue: 60, min: 10, max: 100, step: 1, unit: '%' },
      { id: 'roundness', name: 'Roundness', type: 'number', defaultValue: 50, min: 0, max: 100, step: 1, unit: '%' },
    ],
  },

  // 12. Film Grain
  {
    type: 'film-grain',
    name: 'Film Grain',
    category: 'cinematic',
    description: 'Authentic 35mm analogue film grain simulation.',
    icon: 'Film',
    defaultParams: { amount: 35, size: 1.5, speed: 1.0 },
    parameters: [
      { id: 'amount', name: 'Grain Amount', type: 'number', defaultValue: 35, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'size', name: 'Grain Size', type: 'number', defaultValue: 1.5, min: 0.8, max: 4.0, step: 0.1, unit: 'px' },
      { id: 'speed', name: 'Dynamic Speed', type: 'number', defaultValue: 1.0, min: 0, max: 2.0, step: 0.1 },
    ],
  },

  // 13. Noise / Grain
  {
    type: 'noise',
    name: 'Noise',
    category: 'cinematic',
    description: 'Digital sensor noise overlay with monochrome option.',
    icon: 'Grid',
    defaultParams: { intensity: 25, monochrome: true },
    parameters: [
      { id: 'intensity', name: 'Noise Intensity', type: 'number', defaultValue: 25, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'monochrome', name: 'Monochromatic', type: 'boolean', defaultValue: true },
    ],
  },

  // 14. Chromatic Aberration / RGB Shift
  {
    type: 'chromatic-aberration',
    name: 'Chromatic Aberration',
    category: 'distortion',
    description: 'RGB color channel displacement for vintage lens / sci-fi distortion.',
    icon: 'Layers',
    defaultParams: { offset: 8, angle: 45, channel: 'red-cyan' },
    parameters: [
      { id: 'offset', name: 'RGB Shift Amount', type: 'number', defaultValue: 8, min: 0, max: 30, step: 1, unit: 'px' },
      { id: 'angle', name: 'Displacement Angle', type: 'number', defaultValue: 45, min: 0, max: 360, step: 5, unit: '°' },
      {
        id: 'channel',
        name: 'Channel Pair',
        type: 'select',
        defaultValue: 'red-cyan',
        options: [
          { label: 'Red / Cyan', value: 'red-cyan' },
          { label: 'Blue / Yellow', value: 'blue-yellow' },
          { label: 'Green / Magenta', value: 'green-magenta' },
        ],
      },
    ],
  },

  // 15. Glow / Bloom
  {
    type: 'glow',
    name: 'Glow / Bloom',
    category: 'cinematic',
    description: 'Ethereal highlight diffusion and luminous light bleed.',
    icon: 'Flame',
    defaultParams: { threshold: 60, intensity: 45, radius: 20 },
    parameters: [
      { id: 'threshold', name: 'Luminance Threshold', type: 'number', defaultValue: 60, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'intensity', name: 'Glow Intensity', type: 'number', defaultValue: 45, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'radius', name: 'Diffusion Radius', type: 'number', defaultValue: 20, min: 5, max: 60, step: 1, unit: 'px' },
    ],
  },

  // 16. Lens Flare
  {
    type: 'lens-flare',
    name: 'Anamorphic Lens Flare',
    category: 'cinematic',
    description: 'Cinematic optical flare streak overlay across bright highlights.',
    icon: 'Sparkle',
    defaultParams: { posX: 50, posY: 35, intensity: 60, size: 1.0, color: '#38BDF8' },
    parameters: [
      { id: 'posX', name: 'Light Origin X', type: 'number', defaultValue: 50, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'posY', name: 'Light Origin Y', type: 'number', defaultValue: 35, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'intensity', name: 'Flare Intensity', type: 'number', defaultValue: 60, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'size', name: 'Streak Size', type: 'number', defaultValue: 1.0, min: 0.2, max: 3.0, step: 0.1 },
      { id: 'color', name: 'Flare Color', type: 'color', defaultValue: '#38BDF8' },
    ],
  },

  // 17. Glitch
  {
    type: 'glitch',
    name: 'Glitch / CRT Scan',
    category: 'distortion',
    description: 'Digital block artifacting, horizontal slice displacement, and CRT scanlines.',
    icon: 'Activity',
    defaultParams: { intensity: 45, frequency: 5, rgbSplit: 12, scanlines: 30 },
    parameters: [
      { id: 'intensity', name: 'Glitch Intensity', type: 'number', defaultValue: 45, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'frequency', name: 'Glitch Rate', type: 'number', defaultValue: 5, min: 1, max: 10, step: 1 },
      { id: 'rgbSplit', name: 'RGB Separation', type: 'number', defaultValue: 12, min: 0, max: 30, step: 1, unit: 'px' },
      { id: 'scanlines', name: 'Scanline Amount', type: 'number', defaultValue: 30, min: 0, max: 100, step: 1, unit: '%' },
    ],
  },

  // 18. Pixelate / Mosaic
  {
    type: 'pixelate',
    name: 'Pixelate / Mosaic',
    category: 'distortion',
    description: 'Pixel block mosaic censorship and retro 8-bit aesthetic.',
    icon: 'Boxes',
    defaultParams: { blockSize: 16 },
    parameters: [
      { id: 'blockSize', name: 'Pixel Block Size', type: 'number', defaultValue: 16, min: 2, max: 64, step: 2, unit: 'px' },
    ],
  },

  // 19. Black & White / Grayscale
  {
    type: 'black-white',
    name: 'Black & White',
    category: 'creative',
    description: 'High contrast monochrome grayscale with punchy tonal curves.',
    icon: 'Moon',
    defaultParams: { amount: 100, contrastBoost: 20 },
    parameters: [
      { id: 'amount', name: 'Grayscale Amount', type: 'number', defaultValue: 100, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'contrastBoost', name: 'Contrast Boost', type: 'number', defaultValue: 20, min: 0, max: 100, step: 1, unit: '%' },
    ],
  },

  // 20. Sepia / Vintage
  {
    type: 'sepia',
    name: 'Sepia / Vintage Nostalgia',
    category: 'creative',
    description: 'Warm antique sepia toning with vintage film fade.',
    icon: 'Camera',
    defaultParams: { intensity: 80, warmth: 30, vintageFade: 20 },
    parameters: [
      { id: 'intensity', name: 'Sepia Intensity', type: 'number', defaultValue: 80, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'warmth', name: 'Golden Warmth', type: 'number', defaultValue: 30, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'vintageFade', name: 'Matte Black Fade', type: 'number', defaultValue: 20, min: 0, max: 100, step: 1, unit: '%' },
    ],
  },
];

export function getEffectDefinition(type: string): EffectDefinition | undefined {
  return EFFECT_DEFINITIONS.find((e) => e.type === type);
}
