export interface VocalIsolationConfig {
  isEnabled: boolean;
  isolationMode: 'isolate_vocals' | 'remove_vocals' | 'split_stems';
  vocalGain: number; // 0 to 2.0 (1.0 = 100%)
  instrumentalGain: number; // 0 to 2.0
  isVocalMuted: boolean;
  isInstrumentalMuted: boolean;
  bleedReduction: number; // 0 to 100%
  isProcessed?: boolean;
  vocalsBlobUrl?: string;
  instrumentalBlobUrl?: string;
}

export const DEFAULT_VOCAL_ISOLATION_CONFIG: VocalIsolationConfig = {
  isEnabled: false,
  isolationMode: 'isolate_vocals',
  vocalGain: 1.0,
  instrumentalGain: 1.0,
  isVocalMuted: false,
  isInstrumentalMuted: false,
  bleedReduction: 50,
  isProcessed: false,
};
