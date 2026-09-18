/**
 * Bitrate Architecture & Codec Validation Helper
 * 
 * Provides a single source of truth for:
 * 1. Bitrate units: Internal representation (bps) vs display/preset representation (kbps).
 * 2. Codec-specific capabilities (Chromium WebCodecs AAC, Opus, MP3, etc.).
 * 3. Video bitrate vs Audio bitrate isolation.
 * 4. Pre-flight encoder configuration validation and safe fallback clamping.
 */

export interface BitrateValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: 'ERR_UNSUPPORTED_BITRATE' | 'ERR_INVALID_BITRATE_VALUE' | 'ERR_CODEC_MISMATCH';
  requestedBps: number;
  supportedBps: number[];
  clampedBps: number;
  clampedKbps: number;
  suggestion?: string;
}

/**
 * Chromium WebCodecs AudioEncoder strictly restricts AAC-LC ('mp4a.40.2') to these exact bitrates (in bps).
 * Any other value (e.g. 320,000 or 256,000) causes an immediate fatal DOMException.
 */
export const AAC_SUPPORTED_BITRATES_BPS = [96000, 128000, 160000, 192000] as const;
export const AAC_SUPPORTED_BITRATES_KBPS = [96, 128, 160, 192] as const;

/**
 * Opus supported bitrates (WebM container) in bps.
 */
export const OPUS_SUPPORTED_BITRATES_BPS = [64000, 96000, 128000, 160000, 192000, 256000, 320000] as const;
export const OPUS_SUPPORTED_BITRATES_KBPS = [64, 96, 128, 160, 192, 256, 320] as const;

/**
 * MP3 supported bitrates (libmp3lame / audio-only export) in bps.
 */
export const MP3_SUPPORTED_BITRATES_BPS = [64000, 96000, 128000, 160000, 192000, 256000, 320000] as const;
export const MP3_SUPPORTED_BITRATES_KBPS = [64, 96, 128, 160, 192, 256, 320] as const;

/**
 * Converts a raw bitrate value (which may be in kbps or bps) to canonical numeric bps.
 * Rule: If value < 1000, it is treated as kbps (e.g. 192 -> 192,000).
 * If value >= 1000, it is treated as already in bps (e.g. 192000 -> 192,000).
 */
export function toBitrateBps(value: number | undefined | null, fallbackBps = 192000): number {
  if (value === undefined || value === null || !isFinite(value) || value <= 0) {
    return fallbackBps;
  }
  return value < 1000 ? Math.round(value * 1000) : Math.round(value);
}

/**
 * Converts a raw bitrate value (which may be in kbps or bps) to display/preset kbps.
 */
export function toBitrateKbps(value: number | undefined | null, fallbackKbps = 192): number {
  if (value === undefined || value === null || !isFinite(value) || value <= 0) {
    return fallbackKbps;
  }
  return value >= 1000 ? Math.round(value / 1000) : Math.round(value);
}

/**
 * Returns supported bitrates for a given codec or container format.
 */
export function getSupportedAudioBitrates(formatOrCodec: string): {
  supportedBps: readonly number[];
  supportedKbps: readonly number[];
  defaultBps: number;
} {
  const norm = (formatOrCodec || '').toLowerCase();
  if (norm === 'mp3' || norm === 'libmp3lame') {
    return {
      supportedBps: MP3_SUPPORTED_BITRATES_BPS,
      supportedKbps: MP3_SUPPORTED_BITRATES_KBPS,
      defaultBps: 320000,
    };
  }
  if (norm === 'webm' || norm === 'opus' || norm === 'a_opus') {
    return {
      supportedBps: OPUS_SUPPORTED_BITRATES_BPS,
      supportedKbps: OPUS_SUPPORTED_BITRATES_KBPS,
      defaultBps: 128000,
    };
  }
  // Default to AAC (MP4 / MOV standard)
  return {
    supportedBps: AAC_SUPPORTED_BITRATES_BPS,
    supportedKbps: AAC_SUPPORTED_BITRATES_KBPS,
    defaultBps: 192000,
  };
}

/**
 * Validates and clamps an audio bitrate for a specific codec or format.
 * Guarantees that an invalid or unsupported bitrate never reaches the native encoder.
 */
export function validateAudioBitrate(
  formatOrCodec: string,
  rawBitrate: number | undefined | null
): BitrateValidationResult {
  const { supportedBps, defaultBps } = getSupportedAudioBitrates(formatOrCodec);
  const requestedBps = toBitrateBps(rawBitrate, defaultBps);

  // Exact match with supported bitrates
  if (supportedBps.includes(requestedBps)) {
    return {
      valid: true,
      requestedBps,
      supportedBps: [...supportedBps],
      clampedBps: requestedBps,
      clampedKbps: Math.round(requestedBps / 1000),
    };
  }

  // Find nearest supported bitrate to clamp safely
  let nearest = supportedBps[0];
  let minDiff = Math.abs(requestedBps - nearest);
  for (const candidate of supportedBps) {
    const diff = Math.abs(requestedBps - candidate);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = candidate;
    }
  }

  const supportedStr = supportedBps.join(', ');
  const supportedKbpsStr = supportedBps.map((b) => `${b / 1000}k`).join(', ');

  return {
    valid: false,
    error: `Unsupported audio bitrate ${requestedBps} bps (${requestedBps / 1000} kbps) for ${formatOrCodec}. Supported values: ${supportedStr} (or ${supportedKbpsStr}).`,
    errorCode: 'ERR_UNSUPPORTED_BITRATE',
    requestedBps,
    supportedBps: [...supportedBps],
    clampedBps: nearest,
    clampedKbps: Math.round(nearest / 1000),
    suggestion: `Use ${nearest / 1000} kbps (${nearest} bps) instead.`,
  };
}

/**
 * Resolves the canonical audio bitrate (in bps) based on format and quality preset.
 */
export function resolvePresetAudioBitrate(
  format: string,
  qualityPreset: 'high' | 'medium' | 'low' = 'high'
): { bitrateBps: number; bitrateKbps: number } {
  const norm = (format || 'mp4').toLowerCase();
  if (norm === 'mp3') {
    if (qualityPreset === 'low') return { bitrateBps: 128000, bitrateKbps: 128 };
    if (qualityPreset === 'medium') return { bitrateBps: 192000, bitrateKbps: 192 };
    return { bitrateBps: 320000, bitrateKbps: 320 }; // High
  }
  if (norm === 'webm') {
    if (qualityPreset === 'low') return { bitrateBps: 96000, bitrateKbps: 96 };
    if (qualityPreset === 'medium') return { bitrateBps: 128000, bitrateKbps: 128 };
    return { bitrateBps: 160000, bitrateKbps: 160 }; // High
  }

  // MP4 / AAC (WebCodecs strict support: 96000, 128000, 160000, 192000)
  if (qualityPreset === 'low') return { bitrateBps: 96000, bitrateKbps: 96 };
  if (qualityPreset === 'medium') return { bitrateBps: 160000, bitrateKbps: 160 };
  return { bitrateBps: 192000, bitrateKbps: 192 }; // High - 192 kbps is the max supported by WebCodecs AAC
}

/**
 * Resolves canonical video bitrate (in kbps) based on resolution and quality preset.
 * Strictly isolated from audio bitrate calculations.
 */
export function resolveVideoBitrateKbps(
  resolution: string,
  qualityPreset: 'high' | 'medium' | 'low' = 'high'
): number {
  const is4k = resolution === '4k';
  const is2k = resolution === '2k';
  const is720p = resolution === '720p';

  if (qualityPreset === 'high') {
    if (is4k) return 35000;
    if (is2k) return 18000;
    if (is720p) return 6000;
    return 12000; // 1080p High
  }
  if (qualityPreset === 'medium') {
    if (is4k) return 22000;
    if (is2k) return 12000;
    if (is720p) return 4000;
    return 8000; // 1080p Medium
  }
  // Low
  if (is4k) return 14000;
  if (is2k) return 7000;
  if (is720p) return 2500;
  return 5000; // 1080p Low
}
