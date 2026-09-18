export type ParticlePresetType =
  | 'none'
  | 'dust_particles'
  | 'falling_snow'
  | 'bokeh_orbs'
  | 'golden_sparkles'
  | 'light_leaks'
  | 'embers_fire';

export interface ParticleSystemConfig {
  isEnabled: boolean;
  preset: ParticlePresetType;
  density: number; // 20 to 300 particles
  speed: number; // 0.2 to 3.0
  size: number; // 2 to 40px
  opacity: number; // 0.1 to 1.0
  color: string;
  blendMode: 'screen' | 'lighter' | 'color-dodge' | 'source-over';
}

export const DEFAULT_PARTICLE_CONFIG: ParticleSystemConfig = {
  isEnabled: false,
  preset: 'dust_particles',
  density: 60,
  speed: 1.0,
  size: 8,
  opacity: 0.7,
  color: '#FFFFFF',
  blendMode: 'screen',
};
