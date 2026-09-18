import { AspectRatio } from '../types/project';

export interface AutoRatioResult {
  ratio: AspectRatio;
  width: number;
  height: number;
}

export function calculateAutoAspectRatio(width: number, height: number): AutoRatioResult {
  if (!width || !height) return { ratio: '9:16', width: 1080, height: 1920 };
  const ratioVal = width / height;
  if (ratioVal >= 1.35) {
    // Landscape (16:9 YouTube / Desktop)
    return { ratio: '16:9', width: 1920, height: 1080 };
  } else if (ratioVal <= 0.68) {
    // Portrait (9:16 TikTok / Shorts / Reels)
    return { ratio: '9:16', width: 1080, height: 1920 };
  } else if (ratioVal >= 0.88 && ratioVal <= 1.15) {
    // Square (1:1 Instagram)
    return { ratio: '1:1', width: 1080, height: 1080 };
  } else {
    // Portrait feed (4:5)
    return { ratio: '4:5', width: 1080, height: 1350 };
  }
}
