export type AnimatableProperty =
  | 'positionX'
  | 'positionY'
  | 'scale'
  | 'rotation'
  | 'opacity';

export type KeyframeEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bezier'
  | 'spring'
  | 'hold';

export interface BezierControlPoints {
  cp1x: number; // 0 to 1
  cp1y: number;
  cp2x: number; // 0 to 1
  cp2y: number;
}

export interface KeyframePoint {
  id: string;
  time: number; // Clip-relative time in seconds (0 to timelineDuration)
  value: number;
  easing: KeyframeEasing;
  controlPoints?: BezierControlPoints;
}

export interface PropertyTrack {
  property: AnimatableProperty;
  name: string;
  enabled: boolean;
  min: number;
  max: number;
  defaultValue: number;
  unit: string;
  keyframes: KeyframePoint[];
}

export interface ClipKeyframeState {
  tracks: Record<AnimatableProperty, PropertyTrack>;
}

export const DEFAULT_KEYFRAME_TRACKS: Record<AnimatableProperty, PropertyTrack> = {
  positionX: {
    property: 'positionX',
    name: 'Position X',
    enabled: true,
    min: -100,
    max: 100,
    defaultValue: 0,
    unit: '%',
    keyframes: [],
  },
  positionY: {
    property: 'positionY',
    name: 'Position Y',
    enabled: true,
    min: -100,
    max: 100,
    defaultValue: 0,
    unit: '%',
    keyframes: [],
  },
  scale: {
    property: 'scale',
    name: 'Scale',
    enabled: true,
    min: 0.1,
    max: 3.0,
    defaultValue: 1.0,
    unit: 'x',
    keyframes: [],
  },
  rotation: {
    property: 'rotation',
    name: 'Rotation',
    enabled: true,
    min: -360,
    max: 360,
    defaultValue: 0,
    unit: '°',
    keyframes: [],
  },
  opacity: {
    property: 'opacity',
    name: 'Opacity',
    enabled: true,
    min: 0,
    max: 1.0,
    defaultValue: 1.0,
    unit: '',
    keyframes: [],
  },
};
