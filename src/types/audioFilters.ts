export type AudioFilterType =
  | 'parametric-eq'
  | 'vocal-enhancer'
  | 'compressor'
  | 'de-esser'
  | 'noise-gate'
  | 'reverb'
  | 'pitch-shift'
  | 'limiter';

export interface EQBand {
  id: string;
  name: string;
  freq: number; // Hz, e.g. 80, 250, 1000, 4000, 12000
  gain: number; // -12 to +12 dB
  type: 'lowshelf' | 'peaking' | 'highshelf';
  q: number;
}

export interface AudioFilterConfig {
  id: string;
  type: AudioFilterType;
  name: string;
  enabled: boolean;
  params: Record<string, any>;
}

export interface ClipAudioFiltersState {
  eqBands: EQBand[];
  compressor: {
    enabled: boolean;
    threshold: number; // -40 to 0 dB
    ratio: number; // 1 to 12
    attack: number; // 0.001 to 0.1 s
    release: number; // 0.01 to 0.5 s
    makeupGain: number; // 0 to 18 dB
  };
  vocalEnhancer: {
    enabled: boolean;
    presence: number; // 0 to 100%
    warmth: number; // 0 to 100%
    clarity: number; // 0 to 100%
    rumbleCut: boolean; // 80Hz high-pass filter
  };
  deEsser: {
    enabled: boolean;
    frequency: number; // 5000 to 9000 Hz
    reduction: number; // 0 to 100%
  };
  reverb: {
    enabled: boolean;
    preset: 'studio' | 'vocal-booth' | 'room' | 'hall' | 'cathedral';
    wetDry: number; // 0 to 100%
    decay: number; // 0.2 to 4.0s
  };
  pitchShift: {
    enabled: boolean;
    semitones: number; // -12 to +12
    preset: 'custom' | 'deep' | 'radio' | 'telephone' | 'helium' | 'robot';
  };
}

export const DEFAULT_EQ_BANDS: EQBand[] = [
  { id: 'b1', name: 'Low Bass (80Hz)', freq: 80, gain: 0, type: 'lowshelf', q: 1.0 },
  { id: 'b2', name: 'Low Mid (250Hz)', freq: 250, gain: 0, type: 'peaking', q: 1.2 },
  { id: 'b3', name: 'Mid Body (1kHz)', freq: 1000, gain: 0, type: 'peaking', q: 1.2 },
  { id: 'b4', name: 'Vocal Edge (4kHz)', freq: 4000, gain: 0, type: 'peaking', q: 1.2 },
  { id: 'b5', name: 'Air / Treble (12kHz)', freq: 12000, gain: 0, type: 'highshelf', q: 1.0 },
];

export const DEFAULT_CLIP_AUDIO_FILTERS: ClipAudioFiltersState = {
  eqBands: [...DEFAULT_EQ_BANDS],
  compressor: {
    enabled: false,
    threshold: -20,
    ratio: 3.5,
    attack: 0.01,
    release: 0.15,
    makeupGain: 3,
  },
  vocalEnhancer: {
    enabled: false,
    presence: 40,
    warmth: 20,
    clarity: 50,
    rumbleCut: true,
  },
  deEsser: {
    enabled: false,
    frequency: 6500,
    reduction: 35,
  },
  reverb: {
    enabled: false,
    preset: 'studio',
    wetDry: 15,
    decay: 1.2,
  },
  pitchShift: {
    enabled: false,
    semitones: 0,
    preset: 'custom',
  },
};
