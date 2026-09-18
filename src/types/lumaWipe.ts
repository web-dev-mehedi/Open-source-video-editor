export type LumaMattePresetType =
  | 'linear_gradient'
  | 'radial_clock'
  | 'ink_splash'
  | 'brush_stroke'
  | 'light_leak_wipe'
  | 'burn_dissolve';

export interface LumaWipeConfig {
  preset: LumaMattePresetType;
  duration: number; // 0.2 to 2.0s
  softness: number; // 0 to 50% (edge feather)
  isInverted: boolean;
}

export const DEFAULT_LUMA_WIPE_CONFIG: LumaWipeConfig = {
  preset: 'ink_splash',
  duration: 0.8,
  softness: 20,
  isInverted: false,
};
