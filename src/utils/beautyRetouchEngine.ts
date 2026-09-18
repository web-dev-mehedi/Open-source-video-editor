import { BeautyRetouchConfig } from '../types/beautyRetouch';

/**
 * Generate CSS Filter string for real-time beauty skin glow & tone enhancements
 */
export function buildBeautyCssFilter(config?: BeautyRetouchConfig): string {
  if (!config || !config.isEnabled) return '';

  const smoothFactor = config.skinSmoothing / 100;
  const warmth = config.skinToneWarmth;
  const brightness = 1.0 + (config.eyeBrightening / 100) * 0.08;
  const contrast = 1.0 - smoothFactor * 0.05;
  const sepia = warmth > 0 ? (warmth / 100) * 0.15 : 0;
  const hueRotate = warmth < 0 ? `${(warmth * 0.2).toFixed(1)}deg` : '0deg';

  return `brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(2)}) sepia(${sepia.toFixed(2)}) hue-rotate(${hueRotate})`;
}
