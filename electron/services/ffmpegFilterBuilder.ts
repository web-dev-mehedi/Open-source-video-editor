export interface ClipEffectExport {
  type: string;
  enabled: boolean;
  params: Record<string, any>;
}

export interface TransitionExport {
  id: string;
  type: string;
  fromClipId: string;
  toClipId: string;
  duration: number;
  direction?: string;
  color?: string;
  params?: Record<string, any>;
}

/**
 * Translate clip effect stack into FFmpeg video filter strings
 */
export function compileClipEffectsToFfmpeg(effects?: ClipEffectExport[], width: number = 1080, height: number = 1920): string[] {
  if (!effects || effects.length === 0) return [];

  const filters: string[] = [];

  for (const eff of effects) {
    if (!eff.enabled) continue;
    const p = eff.params || {};

    switch (eff.type) {
      // 1. Brightness & Contrast
      case 'brightness-contrast': {
        const b = (p.brightness || 0) / 100; // -1.0 to 1.0
        const c = 1 + (p.contrast || 0) / 100; // 0.0 to 2.0
        filters.push(`eq=brightness=${b.toFixed(2)}:contrast=${c.toFixed(2)}`);
        break;
      }

      // 2. Exposure
      case 'exposure': {
        const gamma = p.gamma || 1.0;
        const exp = (p.exposure || 0) * 0.2;
        filters.push(`eq=gamma=${gamma.toFixed(2)}:brightness=${exp.toFixed(2)}`);
        break;
      }

      // 3. Saturation
      case 'saturation': {
        const s = (p.saturation ?? 100) / 100;
        filters.push(`eq=saturation=${s.toFixed(2)}`);
        break;
      }

      // 4. Temperature / White Balance
      case 'temperature': {
        const temp = (p.temperature || 0) / 100; // -1.0 to 1.0
        const tint = (p.tint || 0) / 100;
        const rs = temp > 0 ? temp * 0.4 : 0;
        const bs = temp < 0 ? Math.abs(temp) * 0.4 : 0;
        const gm = tint < 0 ? Math.abs(tint) * 0.3 : 0;
        const rm = tint > 0 ? tint * 0.3 : 0;
        filters.push(`colorbalance=rs=${rs.toFixed(2)}:bs=${bs.toFixed(2)}:rm=${rm.toFixed(2)}:gm=${gm.toFixed(2)}`);
        break;
      }

      // 5. Tint
      case 'tint': {
        const amount = (p.amount ?? 30) / 100;
        filters.push(`colorbalance=rs=${(amount * 0.3).toFixed(2)}:bs=${(amount * 0.3).toFixed(2)}`);
        break;
      }

      // 6. Hue Shift
      case 'hue': {
        const h = p.hueShift || 0;
        filters.push(`hue=h=${h}`);
        break;
      }

      // 7. Vibrance
      case 'vibrance': {
        const v = 1 + (p.vibrance || 0) / 150;
        filters.push(`eq=saturation=${v.toFixed(2)}`);
        break;
      }

      // 8. Sharpen
      case 'sharpen': {
        const amount = ((p.amount ?? 35) / 100) * 2.5;
        filters.push(`unsharp=5:5:${amount.toFixed(2)}:5:5:0.0`);
        break;
      }

      // 9. Gaussian Blur
      case 'gaussian-blur': {
        const r = Math.max(1, Math.round((p.radius || 10) * 0.6));
        filters.push(`boxblur=${r}:${r}`);
        break;
      }

      // 10. Motion Blur
      case 'motion-blur': {
        const amt = Math.max(1, Math.round((p.amount || 15) * 0.4));
        filters.push(`boxblur=${amt}:1`);
        break;
      }

      // 11. Vignette
      case 'vignette': {
        const amt = (p.amount ?? 50) / 100;
        filters.push(`vignette=PI/${(3.5 - amt * 1.5).toFixed(2)}`);
        break;
      }

      // 12. Film Grain / Noise
      case 'film-grain':
      case 'noise': {
        const intensity = Math.round(((p.amount ?? p.intensity ?? 30) / 100) * 25);
        filters.push(`noise=alls=${intensity}:allf=t+u`);
        break;
      }

      // 13. Chromatic Aberration / RGB Shift
      case 'chromatic-aberration': {
        const off = Math.round(p.offset || 8);
        filters.push(`rgbashift=rh=${off}:bh=-${off}`);
        break;
      }

      // 14. Glow / Bloom
      case 'glow': {
        filters.push(`eq=contrast=1.15:brightness=0.08`);
        break;
      }

      // 15. Glitch
      case 'glitch': {
        const rgb = Math.round(p.rgbSplit || 12);
        filters.push(`rgbashift=rh=${rgb}:gh=-${Math.round(rgb / 2)}:bv=${rgb}`);
        break;
      }

      // 16. Pixelate / Mosaic
      case 'pixelate': {
        const b = Math.max(2, Math.round(p.blockSize || 16));
        filters.push(`scale=iw/${b}:ih/${b},scale=${width}:${height}:flags=neighbor`);
        break;
      }

      // 17. Black & White
      case 'black-white': {
        filters.push(`format=gray,format=yuv420p,eq=contrast=1.15`);
        break;
      }

      // 18. Sepia
      case 'sepia': {
        filters.push(`colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`);
        break;
      }
    }
  }

  return filters;
}

/**
 * Map high-level transition type to native FFmpeg xfade transition name
 */
export function mapTransitionToFfmpegXfade(type: string, direction?: string): string {
  switch (type) {
    case 'crossfade':
    case 'morph':
      return 'fade';
    case 'dip-black':
      return 'fadeblack';
    case 'dip-white':
      return 'fadewhite';
    case 'wipe': {
      if (direction === 'left') return 'wipeleft';
      if (direction === 'up') return 'wipeup';
      if (direction === 'down') return 'wipedown';
      if (direction === 'diagonal-tl') return 'wipetl';
      if (direction === 'diagonal-tr') return 'wipetr';
      return 'wiperight';
    }
    case 'slide': {
      if (direction === 'right') return 'slideright';
      if (direction === 'up') return 'slideup';
      if (direction === 'down') return 'slidedown';
      return 'slideleft';
    }
    case 'push': {
      if (direction === 'right') return 'smoothright';
      if (direction === 'up') return 'smoothup';
      if (direction === 'down') return 'smoothdown';
      return 'smoothleft';
    }
    case 'iris':
      return 'circlecrop';
    case 'zoom':
    case 'whip-pan':
      return 'zoomin';
    case 'glitch':
      return 'pixelize';
    case 'flash':
      return 'fadewhite';
    case 'light-leak':
    case 'film-burn':
      return 'radial';
    case 'luma-wipe':
      return 'dissolve';
    case 'spin':
      return 'circleopen';
    case 'cut':
    default:
      return 'fade';
  }
}

/**
 * Compile 3-Way Color Wheels and Curves to FFmpeg filters
 */
export function compileColorGradingToFfmpeg(config?: any): string[] {
  if (!config) return [];
  const filters: string[] = [];

  const c = 1 + (config.contrast || 0) / 100;
  const b = ((config.gain?.luma || 0) + (config.offset?.luma || 0) + (config.highlights || 0) * 0.5) / 100;
  const s = (config.saturation || 100) / 100;

  if (config.contrast !== 0 || b !== 0 || config.saturation !== 100) {
    filters.push(`eq=contrast=${c.toFixed(2)}:brightness=${b.toFixed(2)}:saturation=${s.toFixed(2)}`);
  }

  if (config.lift || config.gamma || config.gain) {
    const rs = ((config.lift?.x || 0) * 0.6).toFixed(2);
    const gs = ((config.lift?.y || 0) * 0.6).toFixed(2);
    const rm = ((config.gamma?.x || 0) * 0.6).toFixed(2);
    const gm = ((config.gamma?.y || 0) * 0.6).toFixed(2);
    const rh = ((config.gain?.x || 0) * 0.6).toFixed(2);
    const gh = ((config.gain?.y || 0) * 0.6).toFixed(2);
    filters.push(`colorbalance=rs=${rs}:gs=${gs}:rm=${rm}:gm=${gm}:rh=${rh}:gh=${gh}`);
  }

  return filters;
}

/**
 * Compile Parametric EQ, Compressor, Vocal Boost to FFmpeg -af filters
 */
export function compileAudioFiltersToFfmpeg(filters?: any): string[] {
  if (!filters) return [];
  const af: string[] = [];

  if (filters.eqBands && Array.isArray(filters.eqBands)) {
    for (const band of filters.eqBands) {
      if (Math.abs(band.gain || 0) > 0.2) {
        if (band.type === 'lowshelf') {
          af.push(`lowshelf=f=${band.freq}:g=${band.gain.toFixed(1)}:w=${band.q || 1.0}`);
        } else if (band.type === 'highshelf') {
          af.push(`highshelf=f=${band.freq}:g=${band.gain.toFixed(1)}:w=${band.q || 1.0}`);
        } else {
          af.push(`equalizer=f=${band.freq}:t=q:w=${band.q || 1.2}:g=${band.gain.toFixed(1)}`);
        }
      }
    }
  }

  if (filters.vocalEnhancer && filters.vocalEnhancer.enabled) {
    if (filters.vocalEnhancer.rumbleCut) af.push('highpass=f=80');
    if (filters.vocalEnhancer.presence > 0) {
      af.push(`equalizer=f=3200:t=q:w=1.4:g=${((filters.vocalEnhancer.presence / 100) * 4.5).toFixed(1)}`);
    }
    if (filters.vocalEnhancer.clarity > 0) {
      af.push(`equalizer=f=6500:t=q:w=1.2:g=${((filters.vocalEnhancer.clarity / 100) * 3.5).toFixed(1)}`);
    }
  }

  if (filters.compressor && filters.compressor.enabled) {
    const { threshold = -20, ratio = 3.5, attack = 0.01, release = 0.15, makeupGain = 3 } = filters.compressor;
    const atkMs = Math.max(1, attack * 1000);
    const relMs = Math.max(10, release * 1000);
    af.push(`acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${atkMs}:release=${relMs}:makeup=${makeupGain}dB`);
  }

  return af;
}
export function compileChromaKeyToFfmpeg(chromaKey?: any): string[] {
  if (!chromaKey || !chromaKey.enabled) return [];
  const filters: string[] = [];

  let hex = (chromaKey.keyColor || '#00FF00').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c: string) => c + c).join('');
  const colHex = `0x${hex.toUpperCase()}`;

  const similarity = Math.max(0.01, Math.min(1.0, (chromaKey.similarity ?? 35) / 100));
  const blend = Math.max(0.0, Math.min(1.0, (chromaKey.smoothness ?? 15) / 100));

  filters.push(`chromakey=${colHex}:${similarity.toFixed(2)}:${blend.toFixed(2)}`);

  if (chromaKey.spillReduction && chromaKey.spillReduction > 0) {
    const isBlue = parseInt(hex.substring(4, 6), 16) > parseInt(hex.substring(2, 4), 16);
    filters.push(`despill=${isBlue ? 'blue' : 'green'}:type=matrix`);
  }

  return filters;
}

/**
 * Compile static or keyframed Transform (Scale, Position X/Y, Rotation, Opacity)
 */
export function compileTransformToFfmpeg(transform?: any, width: number = 1080, height: number = 1920): string[] {
  if (!transform) return [];
  const filters: string[] = [];

  const scale = transform.scale ?? 1.0;
  const rotation = transform.rotation ?? 0;
  const opacity = transform.opacity ?? 1.0;

  if (scale !== 1.0) {
    filters.push(`scale=w=iw*${scale.toFixed(3)}:h=ih*${scale.toFixed(3)}`);
  }

  if (rotation !== 0) {
    const rad = ((rotation * Math.PI) / 180).toFixed(4);
    filters.push(`rotate=${rad}:ow='rotw(iw)':oh='roth(ih)':c=none`);
  }

  if (opacity < 0.99) {
    filters.push(`colorchannelmixer=aa=${opacity.toFixed(2)}`);
  }

  return filters;
}

/**
 * Compile all visual filters (Effects, Color Grading, Chroma Key, Transform) for a clip
 */
export function compileAllClipFilters(clip: any, width: number = 1080, height: number = 1920): string[] {
  if (!clip) return [];
  const filters: string[] = [];

  // 1. Effects
  if (clip.effects && clip.effects.length > 0) {
    filters.push(...compileClipEffectsToFfmpeg(clip.effects, width, height));
  }

  // 2. Color Grading
  if (clip.colorGrading) {
    filters.push(...compileColorGradingToFfmpeg(clip.colorGrading));
  }

  // 3. Chroma Key
  if (clip.chromaKey && clip.chromaKey.enabled) {
    filters.push(...compileChromaKeyToFfmpeg(clip.chromaKey));
  }

  // 4. Transform
  if (clip.transform) {
    filters.push(...compileTransformToFfmpeg(clip.transform, width, height));
  }

  return filters;
}

