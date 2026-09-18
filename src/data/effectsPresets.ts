export interface EffectPreset {
  id: string;
  name: string;
  type: 'transition' | 'effect' | 'filter';
  category: string;
  subCategory: string;
  previewUrl?: string;
  staticPosterUrl?: string;
  defaultDuration?: number;
  params: Record<string, any>;
  badge?: 'PRO' | 'HOT' | 'NEW' | 'TRENDING';
  description?: string;
  bgGradient: string;
  accentColor: string;
  animationType:
    | 'dissolve'
    | 'flash-zoom'
    | 'whip-left'
    | 'whip-right'
    | 'glitch'
    | 'blur-push'
    | 'page-curl'
    | 'light-leak'
    | 'shake'
    | 'edge-glow'
    | 'rgb-split'
    | 'scanlines'
    | 'prism'
    | 'strobe'
    | 'teal-orange'
    | 'vintage'
    | 'neon'
    | 'cinema'
    | 'bw'
    | 'sunset'
    | 'mirror'
    | 'vignette'
    | 'spin'
    | 'fade-black'
    | 'fade-white'
    | 'zoom-in'
    | 'zoom-out'
    | 'slide-left'
    | 'slide-right'
    | 'push-up'
    | 'film-burn'
    | 'cyberpunk';
  cssFilter?: string;
}

// -------------------------------------------------------------
// 1. TRANSITIONS REGISTRY (CapCut Style)
// -------------------------------------------------------------
export const TRANSITION_PRESETS: EffectPreset[] = [
  {
    id: 'crossfade',
    name: 'Cross Dissolve',
    type: 'transition',
    category: 'Trending',
    subCategory: 'Basic',
    badge: 'TRENDING',
    description: 'Smooth organic dissolve blending outgoing and incoming footage.',
    defaultDuration: 0.6,
    bgGradient: 'from-blue-950 via-indigo-900 to-purple-950',
    accentColor: '#38BDF8',
    animationType: 'dissolve',
    params: { easing: 'easeInOutQuad' },
  },
  {
    id: 'zoom-in',
    name: 'Flash Zoom',
    type: 'transition',
    category: 'Trending',
    subCategory: 'Motion',
    badge: 'HOT',
    description: 'Dynamic forward optical zoom with intense exposure flash.',
    defaultDuration: 0.5,
    bgGradient: 'from-fuchsia-950 via-pink-900 to-rose-950',
    accentColor: '#EC4899',
    animationType: 'flash-zoom',
    params: { maxScale: 1.8, flashBrightness: 1.6 },
  },
  {
    id: 'whip-left',
    name: 'Whip Pan Left',
    type: 'transition',
    category: 'Motion',
    subCategory: 'Motion',
    badge: 'HOT',
    description: 'High-speed horizontal camera whip with directional motion blur.',
    defaultDuration: 0.45,
    bgGradient: 'from-cyan-950 via-teal-900 to-slate-900',
    accentColor: '#06B6D4',
    animationType: 'whip-left',
    params: { direction: 'left', blurIntensity: 12 },
  },
  {
    id: 'whip-right',
    name: 'Whip Pan Right',
    type: 'transition',
    category: 'Motion',
    subCategory: 'Motion',
    badge: 'HOT',
    description: 'High-speed rightward camera whip with cinematic blur streaks.',
    defaultDuration: 0.45,
    bgGradient: 'from-teal-950 via-cyan-900 to-slate-900',
    accentColor: '#14B8A6',
    animationType: 'whip-right',
    params: { direction: 'right', blurIntensity: 12 },
  },
  {
    id: 'glitch',
    name: 'Glitch Transition',
    type: 'transition',
    category: 'Glitch',
    subCategory: 'Glitch',
    badge: 'NEW',
    description: 'Digital signal artifacting with horizontal line tear and chromatic split.',
    defaultDuration: 0.4,
    bgGradient: 'from-emerald-950 via-cyan-950 to-slate-950',
    accentColor: '#10B981',
    animationType: 'glitch',
    params: { rgbSplit: 18, slices: 10, jitter: 1.5 },
  },
  {
    id: 'blur-push',
    name: 'Blur Push',
    type: 'transition',
    category: 'Motion',
    subCategory: 'Blur',
    badge: 'TRENDING',
    description: 'Kinetic push transition with heavy dynamic Gaussian blur.',
    defaultDuration: 0.5,
    bgGradient: 'from-indigo-950 via-purple-900 to-slate-900',
    accentColor: '#818CF8',
    animationType: 'blur-push',
    params: { blurRadius: 20, direction: 'up' },
  },
  {
    id: 'page-curl',
    name: 'Page Curl',
    type: 'transition',
    category: 'Classic',
    subCategory: 'Retro',
    badge: 'PRO',
    description: '3D geometric page curl revealing underlying clip with realistic shadow.',
    defaultDuration: 0.7,
    bgGradient: 'from-amber-950 via-orange-900 to-stone-900',
    accentColor: '#F59E0B',
    animationType: 'page-curl',
    params: { shadowIntensity: 0.8, curlAngle: 45 },
  },
  {
    id: 'light-leak',
    name: 'Light Leak Flare',
    type: 'transition',
    category: 'Light',
    subCategory: 'Cinematic',
    badge: 'PRO',
    description: 'Warm organic 35mm film flash with chromatic prism refraction.',
    defaultDuration: 0.6,
    bgGradient: 'from-amber-900 via-rose-900 to-orange-950',
    accentColor: '#FBBF24',
    animationType: 'light-leak',
    params: { warmth: 1.4, flareScale: 1.8 },
  },
  {
    id: 'dip-black',
    name: 'Dip to Black',
    type: 'transition',
    category: 'Classic',
    subCategory: 'Basic',
    description: 'Classic dramatic fade to pitch black before transitioning in.',
    defaultDuration: 0.5,
    bgGradient: 'from-neutral-950 via-black to-neutral-900',
    accentColor: '#94A3B8',
    animationType: 'fade-black',
    params: { dipColor: '#000000' },
  },
  {
    id: 'dip-white',
    name: 'Dip to White',
    type: 'transition',
    category: 'Light',
    subCategory: 'Light',
    badge: 'HOT',
    description: 'Blinding overexposure flash transition for high energy scenes.',
    defaultDuration: 0.45,
    bgGradient: 'from-slate-800 via-amber-100/30 to-slate-900',
    accentColor: '#FDE047',
    animationType: 'fade-white',
    params: { dipColor: '#FFFFFF' },
  },
  {
    id: 'slide-left',
    name: 'Slide Left',
    type: 'transition',
    category: 'Motion',
    subCategory: 'Basic',
    description: 'Clean horizontal slide pushing next scene into frame.',
    defaultDuration: 0.5,
    bgGradient: 'from-blue-900 via-sky-950 to-slate-900',
    accentColor: '#60A5FA',
    animationType: 'slide-left',
    params: { direction: 'left' },
  },
  {
    id: 'spin-cw',
    name: 'Spin CW',
    type: 'transition',
    category: 'Motion',
    subCategory: 'Motion',
    badge: 'HOT',
    description: '360-degree clockwise optical spin with radial motion blur.',
    defaultDuration: 0.5,
    bgGradient: 'from-purple-950 via-violet-900 to-slate-900',
    accentColor: '#C084FC',
    animationType: 'spin',
    params: { rotationDegrees: 360, zoomPulse: 1.4 },
  },
];

// -------------------------------------------------------------
// 2. VIDEO EFFECTS REGISTRY (CapCut Style)
// -------------------------------------------------------------
export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: 'shake',
    name: 'Camera Shake',
    type: 'effect',
    category: 'Trending',
    subCategory: 'Motion',
    badge: 'TRENDING',
    description: 'Dynamic handheld camera rumble with adjustable amplitude and frequency.',
    bgGradient: 'from-purple-950 via-red-950 to-slate-900',
    accentColor: '#F87171',
    animationType: 'shake',
    params: { intensity: 0.6, frequency: 12, decay: false },
  },
  {
    id: 'edge-glow',
    name: 'Edge Glow',
    type: 'effect',
    category: 'Light',
    subCategory: 'Light',
    badge: 'HOT',
    description: 'Luminous neon edge aura illuminating contrast lines.',
    bgGradient: 'from-cyan-950 via-blue-900 to-indigo-950',
    accentColor: '#38BDF8',
    animationType: 'edge-glow',
    params: { glowRadius: 8, threshold: 0.4, glowColor: '#00F0FF' },
  },
  {
    id: 'rgb-split',
    name: 'RGB Chromatic Split',
    type: 'effect',
    category: 'Glitch',
    subCategory: 'Glitch',
    badge: 'HOT',
    description: 'Split red, green, and blue color channels for optic chromatic aberration.',
    bgGradient: 'from-rose-950 via-purple-950 to-blue-950',
    accentColor: '#FB7185',
    animationType: 'rgb-split',
    params: { redOffsetX: 6, blueOffsetX: -6, blurSpread: 2 },
  },
  {
    id: 'scanlines',
    name: 'Retro CRT Scanlines',
    type: 'effect',
    category: 'Retro',
    subCategory: 'Retro',
    badge: 'NEW',
    description: 'Vintage cathode ray tube raster scanlines with phosphorescent bloom.',
    bgGradient: 'from-stone-950 via-zinc-900 to-slate-950',
    accentColor: '#34D399',
    animationType: 'scanlines',
    params: { lineDensity: 120, curvature: 0.1, flicker: 0.05 },
  },
  {
    id: 'prism-blur',
    name: 'Prism Blur Refraction',
    type: 'effect',
    category: 'Trending',
    subCategory: 'Blur',
    badge: 'PRO',
    description: 'Prismatic crystal lens refraction dispersing light into rainbow spectral halos.',
    bgGradient: 'from-fuchsia-950 via-purple-900 to-cyan-950',
    accentColor: '#E879F9',
    animationType: 'prism',
    params: { refractionPower: 1.5, dispersion: 0.8 },
  },
  {
    id: 'strobe',
    name: 'Strobe Flash',
    type: 'effect',
    category: 'Light',
    subCategory: 'Light',
    badge: 'HOT',
    description: 'Rhythmic strobe exposure pulse synchronized to music beats.',
    bgGradient: 'from-amber-950 via-yellow-900 to-slate-900',
    accentColor: '#FBBF24',
    animationType: 'strobe',
    params: { frequencyHz: 8, intensity: 0.8 },
  },
  {
    id: 'vhs-glitch',
    name: 'VHS 1986 Tape',
    type: 'effect',
    category: 'Retro',
    subCategory: 'Retro',
    badge: 'PRO',
    description: 'Analog magnetic tape noise with tracking distortion and vintage timecode stamp.',
    bgGradient: 'from-slate-950 via-emerald-950 to-teal-950',
    accentColor: '#2DD4BF',
    animationType: 'glitch',
    params: { trackingNoise: 0.4, colorBleed: 0.7, tapeRoll: 0.2 },
  },
  {
    id: 'film-grain',
    name: '35mm Film Grain',
    type: 'effect',
    category: 'Cinematic',
    subCategory: 'Cinematic',
    description: 'Organic silver halide film grain adding texture and cinematic grit.',
    bgGradient: 'from-neutral-900 via-stone-900 to-zinc-950',
    accentColor: '#D4D4D8',
    animationType: 'vintage',
    params: { grainAmount: 0.25, grainSize: 1.2 },
  },
  {
    id: 'vignette',
    name: 'Cinematic Vignette',
    type: 'effect',
    category: 'Basic',
    subCategory: 'Basic',
    description: 'Darkened border perimeter directing viewer focus toward subject center.',
    bgGradient: 'from-stone-950 via-black to-neutral-950',
    accentColor: '#A1A1AA',
    animationType: 'vignette',
    params: { darkness: 0.65, radius: 0.75, smoothness: 0.5 },
  },
  {
    id: 'mirror',
    name: 'Kaleidoscope Mirror',
    type: 'effect',
    category: 'Distort',
    subCategory: 'Distort',
    description: 'Symmetrical 4-quadrant reflection creating psychedelic patterns.',
    bgGradient: 'from-purple-950 via-indigo-950 to-cyan-950',
    accentColor: '#A78BFA',
    animationType: 'mirror',
    params: { segments: 4, rotation: 0 },
  },
];

// -------------------------------------------------------------
// 3. COLOR FILTERS & LUTS REGISTRY (CapCut Style)
// -------------------------------------------------------------
export const FILTER_PRESETS: EffectPreset[] = [
  {
    id: 'teal-orange',
    name: 'Teal & Orange',
    type: 'filter',
    category: 'Trending',
    subCategory: 'Cinematic',
    badge: 'TRENDING',
    description: 'Hollywood blockbuster color grade: lush cyan shadows and warm skin tones.',
    bgGradient: 'from-teal-900 via-cyan-950 to-orange-950',
    accentColor: '#06B6D4',
    animationType: 'teal-orange',
    cssFilter: 'contrast(1.2) saturate(1.25) hue-rotate(-12deg)',
    params: {
      shadowColor: '#004050',
      highlightColor: '#FF9944',
      temperature: 15,
      tint: -10,
      contrast: 1.25,
      saturation: 1.2,
    },
  },
  {
    id: 'moody-cinema',
    name: 'Moody Cinema',
    type: 'filter',
    category: 'Cinematic',
    subCategory: 'Cinematic',
    badge: 'HOT',
    description: 'Deep crushed blacks, subtle green tint, and desaturated midtones.',
    bgGradient: 'from-emerald-950 via-slate-900 to-neutral-950',
    accentColor: '#10B981',
    animationType: 'cinema',
    cssFilter: 'contrast(1.3) saturate(0.85) brightness(0.92)',
    params: {
      shadowColor: '#051810',
      contrast: 1.35,
      saturation: 0.8,
      brightness: -0.08,
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    type: 'filter',
    category: 'Glitch',
    subCategory: 'Trending',
    badge: 'NEW',
    description: 'Hyper-vibrant magenta highlights and electrified ultraviolet shadows.',
    bgGradient: 'from-fuchsia-950 via-purple-900 to-cyan-950',
    accentColor: '#F43F5E',
    animationType: 'cyberpunk',
    cssFilter: 'saturate(2.2) contrast(1.35) hue-rotate(290deg)',
    params: {
      temperature: -20,
      tint: 40,
      contrast: 1.4,
      saturation: 2.1,
    },
  },
  {
    id: 'vintage-90s',
    name: 'Vintage 90s Film',
    type: 'filter',
    category: 'Retro',
    subCategory: 'Retro',
    badge: 'PRO',
    description: 'Warm nostalgic disposable camera look with faded blacks and yellow cast.',
    bgGradient: 'from-amber-950 via-orange-900 to-yellow-950',
    accentColor: '#F59E0B',
    animationType: 'vintage',
    cssFilter: 'sepia(0.35) contrast(1.1) brightness(1.08) saturate(1.15)',
    params: {
      temperature: 30,
      tint: 12,
      contrast: 1.1,
      saturation: 1.1,
      fadeShadows: 0.15,
    },
  },
  {
    id: 'bw-high-contrast',
    name: 'Noir High Contrast B&W',
    type: 'filter',
    category: 'Classic',
    subCategory: 'Basic',
    description: 'Dramatic black & white with punchy highlights and deep shadows.',
    bgGradient: 'from-black via-zinc-800 to-neutral-950',
    accentColor: '#E4E4E7',
    animationType: 'bw',
    cssFilter: 'grayscale(1) contrast(1.55) brightness(1.02)',
    params: {
      grayscale: true,
      contrast: 1.55,
      highlights: 25,
      shadows: -20,
    },
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset Glow',
    type: 'filter',
    category: 'Trending',
    subCategory: 'Light',
    badge: 'HOT',
    description: 'Rich golden hour amber glow with soft diffused highlights.',
    bgGradient: 'from-orange-950 via-amber-900 to-rose-950',
    accentColor: '#FB923C',
    animationType: 'sunset',
    cssFilter: 'sepia(0.2) saturate(1.4) contrast(1.15) brightness(1.06)',
    params: {
      temperature: 45,
      tint: 15,
      contrast: 1.15,
      saturation: 1.4,
    },
  },
  {
    id: 'emerald-cold',
    name: 'Emerald Arctic',
    type: 'filter',
    category: 'Cinematic',
    subCategory: 'Cinematic',
    description: 'Cold Scandinavian thriller palette with crisp emerald and teal tones.',
    bgGradient: 'from-cyan-950 via-teal-950 to-slate-900',
    accentColor: '#2DD4BF',
    animationType: 'cinema',
    cssFilter: 'hue-rotate(160deg) saturate(0.9) contrast(1.25)',
    params: {
      temperature: -35,
      tint: -15,
      contrast: 1.25,
      saturation: 0.95,
    },
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    type: 'filter',
    category: 'Retro',
    subCategory: 'Retro',
    badge: 'NEW',
    description: 'Soft dreamy pastel palette with reduced contrast and candy hues.',
    bgGradient: 'from-pink-900 via-purple-900 to-sky-900',
    accentColor: '#F472B6',
    animationType: 'vintage',
    cssFilter: 'brightness(1.15) contrast(0.9) saturate(1.25)',
    params: {
      brightness: 0.15,
      contrast: 0.9,
      saturation: 1.25,
      highlights: -15,
    },
  },
  {
    id: 'bleach-bypass',
    name: 'Bleach Bypass',
    type: 'filter',
    category: 'Cinematic',
    subCategory: 'Cinematic',
    badge: 'PRO',
    description: 'Silver retention emulation yielding gritty high contrast with low saturation.',
    bgGradient: 'from-stone-900 via-zinc-800 to-slate-950',
    accentColor: '#CBD5E1',
    animationType: 'cinema',
    cssFilter: 'contrast(1.6) saturate(0.4) brightness(0.95)',
    params: {
      contrast: 1.6,
      saturation: 0.4,
      highlights: 30,
      shadows: -15,
    },
  },
];

// -------------------------------------------------------------
// UNIFIED MASTER PRESET FINDER HELPER
// -------------------------------------------------------------
export const ALL_PRESETS: EffectPreset[] = [
  ...TRANSITION_PRESETS,
  ...EFFECT_PRESETS,
  ...FILTER_PRESETS,
];

export const getPresetById = (id: string): EffectPreset | undefined => {
  return ALL_PRESETS.find((p) => p.id === id);
};
