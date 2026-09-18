import { AspectRatio } from './project';

export interface AutoReframeConfig {
  isEnabled: boolean;
  targetAspectRatio: AspectRatio; // '9:16' | '1:1' | '4:5'
  trackingSpeed: 'slow' | 'default' | 'fast'; // Kalman filter inertia
  fillMode: 'blur_background' | 'crop_fit' | 'black_bars';
  blurStrength: number; // 0 to 40px
  manualOffsetPercent: number; // -50 to 50%
}

export const DEFAULT_AUTO_REFRAME_CONFIG: AutoReframeConfig = {
  isEnabled: false,
  targetAspectRatio: '9:16',
  trackingSpeed: 'default',
  fillMode: 'blur_background',
  blurStrength: 20,
  manualOffsetPercent: 0,
};
