import { ClipAudioFiltersState } from '../types/audioFilters';

/**
 * Compile Audio Filters to FFmpeg audio filter chain (-af)
 */
export function compileAudioFiltersToFfmpeg(filters?: ClipAudioFiltersState): string[] {
  if (!filters) return [];

  const af: string[] = [];

  // 1. Parametric 5-Band Equalizer (EQ)
  if (filters.eqBands && filters.eqBands.length > 0) {
    for (const band of filters.eqBands) {
      if (Math.abs(band.gain) > 0.2) {
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

  // 2. Vocal Enhancer (High-pass 80Hz rumble cut + 3kHz presence lift)
  if (filters.vocalEnhancer && filters.vocalEnhancer.enabled) {
    const { presence, warmth, clarity, rumbleCut } = filters.vocalEnhancer;
    if (rumbleCut) {
      af.push('highpass=f=80');
    }
    if (presence > 0) {
      af.push(`equalizer=f=3200:t=q:w=1.4:g=${((presence / 100) * 4.5).toFixed(1)}`);
    }
    if (clarity > 0) {
      af.push(`equalizer=f=6500:t=q:w=1.2:g=${((clarity / 100) * 3.5).toFixed(1)}`);
    }
    if (warmth > 0) {
      af.push(`equalizer=f=250:t=q:w=1.2:g=${((warmth / 100) * 3.0).toFixed(1)}`);
    }
  }

  // 3. Studio Dynamic Compressor
  if (filters.compressor && filters.compressor.enabled) {
    const { threshold, ratio, attack, release, makeupGain } = filters.compressor;
    const atkMs = Math.max(1, attack * 1000);
    const relMs = Math.max(10, release * 1000);
    af.push(`acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${atkMs}:release=${relMs}:makeup=${makeupGain}dB`);
  }

  // 4. De-Esser (Sibilance Reducer)
  if (filters.deEsser && filters.deEsser.enabled) {
    const { frequency, reduction } = filters.deEsser;
    const gainDb = -((reduction / 100) * 12);
    af.push(`equalizer=f=${frequency}:t=q:w=2.5:g=${gainDb.toFixed(1)}`);
  }

  // 5. Pitch Shifter / Voice Transformer
  if (filters.pitchShift && filters.pitchShift.enabled && filters.pitchShift.semitones !== 0) {
    const semitones = filters.pitchShift.semitones;
    const scale = Math.pow(2, semitones / 12);
    af.push(`asetrate=44100*${scale.toFixed(4)},aresample=44100`);
  }

  // 6. Reverb & Spatializer
  if (filters.reverb && filters.reverb.enabled && filters.reverb.wetDry > 0) {
    const wet = (filters.reverb.wetDry / 100) * 0.4;
    af.push(`aecho=0.8:0.88:60|120:${wet.toFixed(2)}|${(wet * 0.7).toFixed(2)}`);
  }

  return af;
}
