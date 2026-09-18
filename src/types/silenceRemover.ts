export interface SilenceInterval {
  id: string;
  start: number; // in seconds
  end: number;
  duration: number;
  isSelected: boolean;
}

export interface SilenceRemoverSettings {
  minDuration: number; // minimum pause duration to remove (e.g. 0.3s)
  dbThreshold: number; // dBFS threshold (e.g. -35 dBFS)
  safetyPadding: number; // pre/post margin in seconds (e.g. 0.1s)
}

export const DEFAULT_SILENCE_SETTINGS: SilenceRemoverSettings = {
  minDuration: 0.35,
  dbThreshold: -35,
  safetyPadding: 0.08,
};
