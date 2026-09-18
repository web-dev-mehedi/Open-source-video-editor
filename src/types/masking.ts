export type MaskShapeType =
  | 'none'
  | 'linear'
  | 'mirror'
  | 'radial'
  | 'rectangle'
  | 'filmstrip'
  | 'heart'
  | 'star';

export interface MaskConfig {
  type: MaskShapeType;
  centerX: number; // 0 to 100% (default 50)
  centerY: number; // 0 to 100% (default 50)
  width: number; // 0 to 100% (default 50)
  height: number; // 0 to 100% (default 50)
  rotation: number; // -180 to 180 deg (default 0)
  feather: number; // 0 to 100px (default 0)
  isInverted: boolean;
  opacity: number; // 0 to 1 (default 1)
  filmstripBarHeight?: number; // 0 to 50% for cinematic letterbox
}

export const DEFAULT_MASK_CONFIG: MaskConfig = {
  type: 'none',
  centerX: 50,
  centerY: 50,
  width: 60,
  height: 60,
  rotation: 0,
  feather: 0,
  isInverted: false,
  opacity: 1,
  filmstripBarHeight: 12,
};
