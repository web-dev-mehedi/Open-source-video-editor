export type VoicePresetType =
  | 'none'
  | 'chipmunk'
  | 'deep_voice'
  | 'robot'
  | 'megaphone'
  | 'studio_reverb'
  | 'telephone'
  | 'monster';

export interface VoiceChangerConfig {
  isEnabled: boolean;
  preset: VoicePresetType;
  pitchSemitones: number; // -12 to +12 semitones
  formantPreservation: boolean;
  reverbMix: number; // 0 to 100%
  robotCarrierFreq: number; // 30 to 120Hz
}

export const DEFAULT_VOICE_CHANGER_CONFIG: VoiceChangerConfig = {
  isEnabled: false,
  preset: 'none',
  pitchSemitones: 0,
  formantPreservation: true,
  reverbMix: 0,
  robotCarrierFreq: 50,
};
