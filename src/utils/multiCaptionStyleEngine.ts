import { CaptionStyleConfig, CaptionLine } from '../types/caption';
import { CAPTION_PRESET_STYLES } from './presetStyles';

export interface MultiStyleFlow {
  id: string;
  name: string;
  tag: string;
  description: string;
  badge: string;
  gradient: string;
  presetSequence: string[]; // List of preset keys to cycle through
}

export const MULTI_STYLE_FLOWS: MultiStyleFlow[] = [
  {
    id: 'viral-creator-master-mix',
    name: 'Viral Creator Master Mix',
    tag: '5-Style Multi Sequence',
    description: 'Dynamic sequence cycling all 5 viral styles: Neon Red Hook ➔ Violet Metallic 3D ➔ Electric Yellow Punch ➔ Crimson Script ➔ Gradient Badge.',
    badge: '🔥 ALL-IN-ONE VIRAL',
    gradient: 'from-rose-500 via-purple-500 to-amber-400',
    presetSequence: [
      'viral-hook-neon-red',
      'viral-hook-purple-metallic',
      'viral-fitness-electric-yellow',
      'viral-money-red-script',
      'viral-skip-badge-pill',
    ],
  },
  {
    id: 'premiere-pro-viral',
    name: 'Premiere Pro Viral Masterclass',
    tag: 'Dynamic Viral Sequence',
    description: 'Dynamic Premiere Pro viral flow: Phrase 1 Beast Yellow Pop ➔ Phrase 2 Neon Cyan Glow ➔ Phrase 3 Hormozi Box ➔ Phrase 4 Submagic Shimmer ➔ Phrase 5 Ali Abdaal Lilac.',
    badge: '👑 MASTERCLASS',
    gradient: 'from-amber-400 via-rose-500 to-cyan-400',
    presetSequence: [
      'mrbeast-bold',
      'neon-cyan',
      'hormozi-bold',
      'submagic-gradient',
      'ali-abdaal-clean',
      'glow-yellow',
      'bold-contrast-pill',
    ],
  },
  {
    id: 'submagic-ai-mix',
    name: 'Submagic AI Kinetic Mix',
    tag: 'Kinetic Gradient Flow',
    description: 'High-energy kinetic AI flow with glowing cyberpunk gradients, word pops, and animated pulse text.',
    badge: '⚡ AI VIRAL',
    gradient: 'from-cyan-400 via-fuchsia-500 to-emerald-400',
    presetSequence: [
      'submagic-gradient',
      'neon-cyan',
      'devin-neon-cyan',
      'karaoke-glow',
      'tiktok-glow',
      'glow-yellow',
    ],
  },
  {
    id: 'hormozi-retention-pro',
    name: 'Hormozi Retention Pro',
    tag: 'High Contrast Hook',
    description: 'Alex Hormozi signature high-contrast black pill boxes, saturated lime highlights, and punchy impact pops.',
    badge: '🔥 RETENTION',
    gradient: 'from-yellow-400 via-lime-500 to-emerald-600',
    presetSequence: [
      'hormozi-bold',
      'bold-contrast-pill',
      'mrbeast-bold',
      'clean-box-bottom',
      'bold-yellow-outline',
    ],
  },
  {
    id: 'cinematic-luxury',
    name: 'Cinematic Storyteller',
    tag: 'Documentary Gold Luxury',
    description: 'High-end documentary aesthetic alternating gold luxury, minimal white, dark emerald, and elegant serif.',
    badge: '🎬 CINEMATIC',
    gradient: 'from-amber-300 via-stone-200 to-yellow-600',
    presetSequence: [
      'cinema-sub',
      'ali-abdaal-clean',
      'minimal-clean',
      'bold-contrast-pill',
      'clean-box-bottom',
    ],
  },
  {
    id: 'rainbow-color-pop',
    name: 'Rainbow Color Wave',
    tag: 'Chromatic Shifting Flow',
    description: 'Vibrant contrasting colors and pill boxes that shift colors dynamically on every spoken phrase.',
    badge: '🌈 COLOR WAVE',
    gradient: 'from-pink-500 via-yellow-400 to-indigo-500',
    presetSequence: [
      'word-by-word-pop',
      'karaoke-glow',
      'dynamic-bounce',
      'bold-yellow-outline',
      'glow-yellow',
    ],
  },
  {
    id: 'kinetic-hook-exploder',
    name: 'Kinetic Hook Exploder',
    tag: 'Explosive Spring Zoom',
    description: 'Explosive scale-up animations on first phrase, followed by rapid bouncing karaoke highlights.',
    badge: '💥 EXPLODER',
    gradient: 'from-red-500 via-amber-400 to-violet-500',
    presetSequence: [
      'mrbeast-bold',
      'submagic-gradient',
      'devin-neon-cyan',
      'hormozi-bold',
      'neon-cyan',
    ],
  },
];

/**
 * Applies a sequenced Multi-Style Flow across all captions in a video
 */
export function generateMultiStyledCaptions(
  captions: CaptionLine[],
  flowId: string = 'premiere-pro-viral'
): CaptionLine[] {
  if (!captions || captions.length === 0) return [];

  const flow = MULTI_STYLE_FLOWS.find((f) => f.id === flowId) || MULTI_STYLE_FLOWS[0];
  const sequence = flow ? flow.presetSequence : ['mrbeast-bold', 'neon-cyan', 'hormozi-bold', 'submagic-gradient', 'ali-abdaal-clean'];

  const presetsMap = new Map<string, CaptionStyleConfig>();
  CAPTION_PRESET_STYLES.forEach((p) => {
    presetsMap.set(p.presetKey, p);
    presetsMap.set(p.id, p);
  });

  return captions.map((line, index) => {
    let presetKey: string;
    if (flowId === 'random') {
      const randomIdx = Math.floor(Math.random() * CAPTION_PRESET_STYLES.length);
      presetKey = CAPTION_PRESET_STYLES[randomIdx].presetKey;
    } else {
      presetKey = sequence[index % sequence.length];
    }

    const preset = presetsMap.get(presetKey) || CAPTION_PRESET_STYLES[0];

    const styleOverride: Partial<CaptionStyleConfig> = {
      ...preset,
      presetKey: preset.presetKey,
    };

    return {
      ...line,
      styleOverride,
    };
  });
}
