export interface MotionBlurConfig {
  isEnabled: boolean;
  shutterAngle: number; // 0 to 360 degrees (default 180)
  samples: 8 | 16 | 24 | 32;
  sensitivity: number; // 0 to 100%
  blurDynamicOverlaysOnly?: boolean;
}

export const DEFAULT_MOTION_BLUR_CONFIG: MotionBlurConfig = {
  isEnabled: false,
  shutterAngle: 180,
  samples: 16,
  sensitivity: 65,
  blurDynamicOverlaysOnly: false,
};
