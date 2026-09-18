export interface ThreeDTextConfig {
  isEnabled: boolean;
  depth: number; // 0 to 40px (extrusion length)
  bevelRadius: number; // 0 to 10px (chamfer)
  angle: number; // -180 to 180 degrees (extrusion light direction)
  pitch: number; // -45 to 45 degrees (3D tilt X)
  yaw: number; // -45 to 45 degrees (3D tilt Y)
  extrusionColor: string; // Darker gradient or metallic color
  specularShine: number; // 0 to 100 (Blinn-Phong highlight)
  ambientLight: number; // 0 to 100
  material: 'matte' | 'glossy' | 'metallic' | 'neon_glow';
}

export const DEFAULT_3D_TEXT_CONFIG: ThreeDTextConfig = {
  isEnabled: false,
  depth: 12,
  bevelRadius: 3,
  angle: 45,
  pitch: 8,
  yaw: -12,
  extrusionColor: '#0f172a',
  specularShine: 60,
  ambientLight: 40,
  material: 'glossy',
};
