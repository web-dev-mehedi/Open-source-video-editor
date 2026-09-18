export interface ColorMatchConfig {
  isEnabled: boolean;
  referenceClipId?: string;
  referenceThumbnailUrl?: string;
  strength: number; // 0 to 100%
  matchLuminance: boolean;
  matchSkinTones: boolean;
  isMatched?: boolean;
}

export const DEFAULT_COLOR_MATCH_CONFIG: ColorMatchConfig = {
  isEnabled: false,
  strength: 80,
  matchLuminance: true,
  matchSkinTones: true,
  isMatched: false,
};
