export interface BeautyRetouchConfig {
  isEnabled: boolean;
  skinSmoothing: number; // 0 to 100% (Guided Filter blemish smoothing)
  skinToneWarmth: number; // -50 to 50 (Rosy / Golden warmth)
  teethWhitening: number; // 0 to 100%
  eyeBrightening: number; // 0 to 100%
  faceSlimming: number; // 0 to 100%
  blemishRemoval: boolean;
}

export const DEFAULT_BEAUTY_CONFIG: BeautyRetouchConfig = {
  isEnabled: false,
  skinSmoothing: 50,
  skinToneWarmth: 15,
  teethWhitening: 45,
  eyeBrightening: 35,
  faceSlimming: 20,
  blemishRemoval: true,
};
