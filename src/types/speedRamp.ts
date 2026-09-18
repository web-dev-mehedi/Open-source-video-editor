export type SpeedRampPreset =
  | 'custom'
  | 'montage'
  | 'hero-in'
  | 'bullet-time'
  | 'flash-out'
  | 'jump-cut';

export interface SpeedKeyframe {
  id: string;
  time: number; // 0.0 to 1.0 (normalized progress through clip)
  speed: number; // 0.1x to 10.0x
  easing?: 'linear' | 'smooth' | 'bezier';
}

export interface SpeedRampConfig {
  enabled: boolean;
  preset: SpeedRampPreset;
  keyframes: SpeedKeyframe[];
  maintainPitch: boolean;
}

export const SPEED_RAMP_PRESETS: Record<SpeedRampPreset, SpeedKeyframe[]> = {
  custom: [
    { id: 'k1', time: 0.0, speed: 1.0 },
    { id: 'k2', time: 0.3, speed: 3.0 },
    { id: 'k3', time: 0.7, speed: 0.3 },
    { id: 'k4', time: 1.0, speed: 1.0 },
  ],
  montage: [
    { id: 'k1', time: 0.0, speed: 0.5 },
    { id: 'k2', time: 0.25, speed: 4.0 },
    { id: 'k3', time: 0.5, speed: 0.5 },
    { id: 'k4', time: 0.75, speed: 3.5 },
    { id: 'k5', time: 1.0, speed: 1.0 },
  ],
  'hero-in': [
    { id: 'k1', time: 0.0, speed: 5.0 },
    { id: 'k2', time: 0.35, speed: 0.2 },
    { id: 'k3', time: 0.65, speed: 0.2 },
    { id: 'k4', time: 1.0, speed: 1.0 },
  ],
  'bullet-time': [
    { id: 'k1', time: 0.0, speed: 1.0 },
    { id: 'k2', time: 0.2, speed: 1.0 },
    { id: 'k3', time: 0.4, speed: 0.15 },
    { id: 'k4', time: 0.7, speed: 0.15 },
    { id: 'k5', time: 0.9, speed: 1.0 },
    { id: 'k6', time: 1.0, speed: 1.0 },
  ],
  'flash-out': [
    { id: 'k1', time: 0.0, speed: 1.0 },
    { id: 'k2', time: 0.6, speed: 0.4 },
    { id: 'k3', time: 0.85, speed: 6.0 },
    { id: 'k4', time: 1.0, speed: 8.0 },
  ],
  'jump-cut': [
    { id: 'k1', time: 0.0, speed: 3.0 },
    { id: 'k2', time: 0.3, speed: 3.0 },
    { id: 'k3', time: 0.31, speed: 0.5 },
    { id: 'k4', time: 0.7, speed: 0.5 },
    { id: 'k5', time: 0.71, speed: 3.0 },
    { id: 'k6', time: 1.0, speed: 3.0 },
  ],
};
