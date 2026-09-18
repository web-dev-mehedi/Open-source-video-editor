import { VocalIsolationConfig } from '../types/vocalIsolation';

/**
 * Build FFmpeg stem isolation filter graph for audio export
 */
export function buildFFmpegVocalFilter(config: VocalIsolationConfig): string {
  if (!config.isEnabled) return '';

  if (config.isolationMode === 'isolate_vocals') {
    // Center channel extraction + vocal formant bandpass filter (250Hz - 4kHz)
    return 'pan="stereo|c0=c0-c1|c1=c0-c1",highpass=f=200,lowpass=f=4500';
  }

  if (config.isolationMode === 'remove_vocals') {
    // Vocal elimination via out-of-phase stereo cancellation
    return 'pan="stereo|c0=c0-c1|c1=c1-c0"';
  }

  return '';
}
