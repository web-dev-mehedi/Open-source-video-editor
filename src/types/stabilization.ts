export type StabilizationMode = 'subtle' | 'smooth' | 'strong' | 'tripod';

export interface StabilizationConfig {
  isEnabled: boolean;
  mode: StabilizationMode;
  smoothness: number; // 0 to 100 (smoothing window size)
  cropMargin: number; // 0 to 25% (auto zoom compensation)
  tripodLock: boolean; // Lock camera static
  isAnalyzed?: boolean;
}

export const DEFAULT_STABILIZATION_CONFIG: StabilizationConfig = {
  isEnabled: false,
  mode: 'smooth',
  smoothness: 60,
  cropMargin: 8,
  tripodLock: false,
  isAnalyzed: false,
};
