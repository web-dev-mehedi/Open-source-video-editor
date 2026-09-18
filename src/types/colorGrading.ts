export interface ColorWheelValue {
  x: number; // -1 to 1 (Hue & Saturation puck position)
  y: number; // -1 to 1
  luma: number; // -100 to 100 (Luminance slider)
  hue: number; // 0 to 360
  saturation: number; // 0 to 100
}

export interface CurvePoint {
  x: number; // 0 to 1
  y: number; // 0 to 1
}

export interface RGBCurvesData {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface ColorGradingConfig {
  lift: ColorWheelValue; // Shadows
  gamma: ColorWheelValue; // Midtones
  gain: ColorWheelValue; // Highlights
  offset: ColorWheelValue; // Global Master
  curves: RGBCurvesData;
  temperature: number; // -100 to 100
  tint: number; // -100 to 100
  vibrance: number; // -100 to 100
  saturation: number; // 0 to 200
  contrast: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  whites: number; // -100 to 100
  blacks: number; // -100 to 100
}

export const DEFAULT_COLOR_WHEEL_VALUE: ColorWheelValue = {
  x: 0,
  y: 0,
  luma: 0,
  hue: 0,
  saturation: 0,
};

export const DEFAULT_CURVE_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0.25 },
  { x: 0.75, y: 0.75 },
  { x: 1, y: 1 },
];

export const DEFAULT_COLOR_GRADING: ColorGradingConfig = {
  lift: { ...DEFAULT_COLOR_WHEEL_VALUE },
  gamma: { ...DEFAULT_COLOR_WHEEL_VALUE },
  gain: { ...DEFAULT_COLOR_WHEEL_VALUE },
  offset: { ...DEFAULT_COLOR_WHEEL_VALUE },
  curves: {
    master: [...DEFAULT_CURVE_POINTS],
    red: [...DEFAULT_CURVE_POINTS],
    green: [...DEFAULT_CURVE_POINTS],
    blue: [...DEFAULT_CURVE_POINTS],
  },
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 100,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
};
