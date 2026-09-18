import { VoiceChangerConfig } from '../types/voiceChanger';

/**
 * Build FFmpeg audio filter chain for voice changer effects
 */
export function buildFFmpegVoiceFilter(config: VoiceChangerConfig): string {
  if (!config.isEnabled || config.preset === 'none') return '';

  if (config.preset === 'chipmunk') {
    return 'asetrate=44100*1.5,aresample=44100,atempo=1/1.5';
  }

  if (config.preset === 'deep_voice' || config.preset === 'monster') {
    return 'asetrate=44100*0.72,aresample=44100,atempo=1/0.72';
  }

  if (config.preset === 'robot') {
    return 'aeval=val(0)*sin(2*PI*50*t):c=same';
  }

  if (config.preset === 'megaphone' || config.preset === 'telephone') {
    return 'highpass=f=350,lowpass=f=3400,volume=1.5';
  }

  if (config.preset === 'studio_reverb') {
    return 'aecho=0.8:0.88:40:0.4';
  }

  if (config.pitchSemitones !== 0) {
    const rateFactor = Math.pow(2, config.pitchSemitones / 12);
    return `asetrate=44100*${rateFactor.toFixed(3)},aresample=44100,atempo=${(1 / rateFactor).toFixed(3)}`;
  }

  return '';
}
