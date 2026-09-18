import { ModelTier } from './aiModel';

export interface BackgroundMattingConfig {
  isEnabled: boolean;
  mattingMode: 'auto_human' | 'edge_guided' | 'luma_key';
  modelTier: ModelTier; // 'fast' | 'balanced' | 'ultra'
  
  // Core Matting Parameters
  threshold: number; // 0 to 100 (sensitivity)
  feather: number; // 0 to 50px (soft edge)
  smoothness: number; // 0 to 100 (temporal consistency across frames)
  despill: number; // 0 to 100 (fringe cleanup / green/blue despill)
  
  // Professional Refinement Pipeline Controls
  edgeRefinement: number; // 0 to 100 (guided filter edge sharpening)
  hairDetail: number; // 0 to 100 (sub-pixel hair strands preservation)
  maskExpansion: number; // -20 to +20 px (dilation > 0, erosion < 0)
  foregroundProtection: number; // 0 to 100 (prevents inner body clipping)
  backgroundSuppression: number; // 0 to 100 (removes leftover background noise)
  temporalSmoothing: number; // 0 to 100 (exponential moving average anti-flicker)
  holeFilling: boolean; // fills internal shadow cavities inside clothing/hair
  
  // Creative & Viral Layering Effects
  placeCaptionsBehindSubject: boolean; // Render animated subtitles behind person
  strokeBorder: boolean; // Add viral white/colored glow outline around cutout person
  strokeColor: string; // e.g. '#FFFFFF' or '#38BDF8'
  strokeWidth: number; // 0 to 20px
  
  // Processing Cache & State
  isProcessing?: boolean;
  processingProgress?: number; // 0 to 100%
  processedFrames?: number;
  totalFrames?: number;
  cachedMaskKey?: string;
}

export const DEFAULT_MATTING_CONFIG: BackgroundMattingConfig = {
  isEnabled: false,
  mattingMode: 'auto_human',
  modelTier: 'balanced',
  threshold: 50,
  feather: 6,
  smoothness: 70,
  despill: 45,
  edgeRefinement: 65,
  hairDetail: 80,
  maskExpansion: 0,
  foregroundProtection: 75,
  backgroundSuppression: 60,
  temporalSmoothing: 75,
  holeFilling: true,
  placeCaptionsBehindSubject: false,
  strokeBorder: false,
  strokeColor: '#FFFFFF',
  strokeWidth: 4,
};
