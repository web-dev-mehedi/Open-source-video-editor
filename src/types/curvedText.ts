export type CurvePathPreset =
  | 'none'
  | 'circle_360'
  | 'arc_top'
  | 'arc_bottom'
  | 'wave_sine'
  | 's_curve'
  | 'arch_bridge';

export interface CurvedTextConfig {
  isEnabled: boolean;
  preset: CurvePathPreset;
  radius: number; // 50 to 500px
  arcAngle: number; // 30 to 360 degrees
  curvature: number; // -100 to 100
  letterSpacing: number; // in px
  inwardFacing: boolean; // Flip glyph normal orientation
}

export const DEFAULT_CURVED_TEXT_CONFIG: CurvedTextConfig = {
  isEnabled: false,
  preset: 'none',
  radius: 180,
  arcAngle: 180,
  curvature: 50,
  letterSpacing: 2,
  inwardFacing: false,
};
