export type CaptionAnimationType =
  | 'mrbeast'
  | 'hormozi'
  | 'bold-pop'
  | 'punch'
  | 'color-emphasis'
  | 'word-pop'
  | 'bounce'
  | 'slide-up'
  | 'slide-in'
  | 'dynamic-scale'
  | 'shake'
  | 'pop-blur'
  | 'karaoke'
  | 'word-highlight'
  | 'highlight-box'
  | 'active-color'
  | 'cinematic'
  | 'clean-sub'
  | 'typewriter'
  | 'uppercase-punch'
  | '3d'
  | 'neon'
  | 'glitch'
  | 'multiline'
  | 'pop'
  | 'fade'
  | 'glow'
  | 'slide'
  | 'wave'
  | 'none';

export type CaptionCategory =
  | 'VIRAL'
  | 'ANIMATED'
  | 'HIGHLIGHT'
  | 'CLASSIC'
  | 'CREATIVE'
  | 'Premiere Pro'
  | 'Viral Shorts'
  | 'Highlighter'
  | 'Luxury & Script'
  | 'Neon & Gaming'
  | 'Minimalist'
  // Premium Kinetic Library categories (additive — existing categories preserved)
  | 'Dynamic'
  | 'Viral'
  | 'Podcast'
  | 'Cinematic'
  | 'Business'
  | 'Educational'
  | 'Minimal';

export type CaptionPosition = 'top' | 'middle' | 'bottom' | 'lower-third' | 'custom';
export type TextAlignment = 'left' | 'center' | 'right';
export type TextCasing = 'uppercase' | 'lowercase' | 'titlecase' | 'preserve';

export interface WordTimestamp {
  id: string;
  word: string; // display word
  start: number; // in seconds canonical
  end: number;   // in seconds canonical
  confidence?: number;
  highlightColor?: string;
  isCustomEdited?: boolean;
  // Ultra-accurate two-layer model (P4-P6)
  normalizedText?: string; // display-normalized (e.g. uppercased)
  originalWord?: string; // verbatim source as recognized
  sourceIndex?: number; // index in source transcript
  displayIndex?: number; // index in display caption
  speaker?: string; // diarization label if available
  accuracyStatus?: 'exact' | 'estimated'; // P33-P34 status per word
}

export interface SourceWordTiming extends WordTimestamp {
  sourceIndex: number;
  verbatimText: string;
}

export interface CaptionLine {
  id: string;
  start: number; // canonical seconds (timeline global)
  end: number;   // canonical seconds
  text: string; // display text
  words: WordTimestamp[];
  splitHookIndex?: number; // Word index where bottom punch line begins in dual-tier hook
  styleOverride?: Partial<CaptionStyleConfig>;
  // Two-layer model (P4)
  sourceText?: string; // verbatim source text
  sourceWords?: WordTimestamp[]; // original verbatim words with exact timing
  accuracyStatus?: 'exact' | 'estimated' | 'partial';
  speaker?: string;
  clipId?: string; // associated clip for timeline offset handling (P42-P46)
  captionId?: string; // alias for legacy systems
}

export interface CaptionStyleConfig {
  id: string;
  name: string;
  presetKey: string;
  category?: CaptionCategory;
  description?: string;

  // Font & Typography
  fontFamily: string;
  fontSize: number; // in px at 1080p scale
  fontWeight: 'normal' | 'bold' | '600' | '700' | '800' | '900' | string;
  letterSpacing: number; // in px
  lineHeight: number;
  casing: TextCasing;

  // Colors
  textColor: string;          // Hex or RGBA for main text
  activeWordColor: string;    // Highlight color for currently active spoken word
  secondaryColor?: string;    // Secondary/gradient or inactive text color
  inactiveWordOpacity?: number; // 0.2 to 1.0 (for karaoke / dimmed base text)

  // Outline / Stroke
  strokeColor: string;
  strokeWidth: number; // in px

  // Shadow
  hasShadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;

  // Background Box / Pill / Marker
  hasBackgroundPill: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPaddingX: number;
  backgroundPaddingY: number;
  backgroundBorderRadius: number;

  // Highlight Box (Marker under active word)
  hasHighlightBox?: boolean;
  highlightBoxColor?: string;
  highlightBoxTextColor?: string;
  highlightBoxPaddingX?: number;
  highlightBoxPaddingY?: number;
  highlightBoxRadius?: number;
  highlightBoxOpacity?: number;

  // Position & Layout
  position: CaptionPosition;
  xOffsetPercent?: number; // 0 to 100 from left (default 50 for center)
  yOffsetPercent: number; // 0 to 100 from top
  alignment: TextAlignment;
  maxWordsPerLine: number; // 1, 2, 3, 4, 5, etc.
  lineMode?: 'single' | 'two-line' | 'auto'; // Force 1-line, 2-lines stacked, or auto-wrapped

  // Advanced Layout Styles
  layoutStyle?:
    | 'standard'
    | 'stacked-hierarchy'
    | 'highlighter-bar'
    | 'multi-font-script'
    | 'dual-tier-hook'
    | 'dynamic-multiline'
    | 'neon-red-hook'
    | 'violet-metallic-3d'
    | 'fitness-yellow-punch'
    | 'money-crimson-script'
    | 'skip-badge-pill';
  secondaryFontFamily?: string;
  highlightBarColor?: string;
  highlightBarTextColor?: string;
  highlightScale?: number; // e.g. 1.2 to 1.6

  // Lighting & Glow (Neon)
  hasLightingGlow?: boolean;
  lightingGlowColor?: string;
  lightingGlowRadius?: number;
  lightingGlowIntensity?: number;

  // 3D Extrusion
  has3DExtrusion?: boolean;
  depth3D?: number;
  depthColor?: string;

  // Glitch Effect
  glitchIntensity?: number;

  // Motion Blur
  hasMotionBlur?: boolean;

  // Shake / Jitter
  shakeIntensity?: number;

  // Typewriter
  typewriterSpeed?: number;
  typewriterShowCursor?: boolean;

  // Animation
  animation: CaptionAnimationType;
  animationIntensity: number; // 1 to 5

  // Manual Canvas Transform Overrides (P5-P8, P12, P44)
  rotation?: number; // degrees, -180 to 180
  scale?: number; // 0.5 to 2.0 uniform scale
  maxWidthPercent?: number; // 30 to 95 % of canvas width
  maxLines?: number; // 1 to 4
  anchorX?: number; // transform origin x 0-1
  anchorY?: number; // transform origin y 0-1

  // Advanced Layout Engines (Modules 16 & 17)
  curvedText?: import('./curvedText').CurvedTextConfig;
  threeDText?: import('./threeDText').ThreeDTextConfig;
}

export interface TranslationLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}
