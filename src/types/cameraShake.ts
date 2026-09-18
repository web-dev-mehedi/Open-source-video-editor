export type ShakePresetType =
  | 'none'
  | 'subtle_handheld'
  | 'action_cam'
  | 'earthquake'
  | 'camera_bump'
  | 'cinematic_drift';

export interface CameraShakeConfig {
  isEnabled: boolean;
  preset: ShakePresetType;
  intensity: number; // 0 to 100%
  frequency: number; // 0.5 to 5.0 Hz
  autoZoom: boolean; // Auto-zoom to prevent black edges
  zoomFactor: number; // 1.0 to 1.25x
}

export const DEFAULT_CAMERA_SHAKE_CONFIG: CameraShakeConfig = {
  isEnabled: false,
  preset: 'subtle_handheld',
  intensity: 40,
  frequency: 2.0,
  autoZoom: true,
  zoomFactor: 1.08,
};
