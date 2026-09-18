import { AspectRatio } from '../../types/project';
import { ExportResolution, ExportFormat, VideoCodec, ExportSettings } from '../../types/export';
import { validateAudioBitrate, toBitrateBps } from './bitrateHelper';
import { sanitizeFileName } from './destinationService';

export interface ExportOptions {
  format: ExportFormat;
  codec?: VideoCodec;
  resolution: { width: number; height: number };
  fps: number;
  bitrate: number; // in bps (e.g. 8_000_000 for 1080p)
  audioBitrate: number; // in bps (e.g. 192_000 for AAC)
  sampleRate: number; // 48000 or 44100
  fileName: string;
  outputPath?: string;
  burnCaptions?: boolean;
  category?: 'video' | 'audio' | 'subtitle' | 'gif';
  alsoExportSubtitles?: boolean;
  alsoExportAudio?: boolean;
}

/**
 * Sanitizes dimensions to ensure width and height are even integers (divisible by 2).
 * Required by H.264 / MP4 / VP9 encoders to prevent codec initialization errors.
 */
export function sanitizeExportDimensions(width: number, height: number): { width: number; height: number } {
  const safeW = Math.max(2, Math.floor(Math.round(width) / 2) * 2);
  const safeH = Math.max(2, Math.floor(Math.round(height) / 2) * 2);
  return { width: safeW, height: safeH };
}

/**
 * Resolves standard resolution preset and aspect ratio to concrete pixel dimensions.
 */
export function resolveExportResolution(
  aspectRatio: AspectRatio = '9:16',
  resolutionPreset: ExportResolution = '1080p'
): { width: number; height: number } {
  let w = 1080;
  let h = 1920;

  if (aspectRatio === '16:9') {
    if (resolutionPreset === '4k') { w = 3840; h = 2160; }
    else if (resolutionPreset === '720p') { w = 1280; h = 720; }
    else if (resolutionPreset === '480p') { w = 854; h = 480; }
    else { w = 1920; h = 1080; }
  } else if (aspectRatio === '1:1') {
    if (resolutionPreset === '4k') { w = 2160; h = 2160; }
    else if (resolutionPreset === '720p') { w = 720; h = 720; }
    else { w = 1080; h = 1080; }
  } else if (aspectRatio === '4:5') {
    if (resolutionPreset === '4k') { w = 2160; h = 2700; }
    else if (resolutionPreset === '720p') { w = 720; h = 900; }
    else { w = 1080; h = 1350; }
  } else if (aspectRatio === '21:9') {
    if (resolutionPreset === '4k') { w = 3840; h = 1620; }
    else { w = 2560; h = 1080; }
  } else {
    // 9:16 Vertical
    if (resolutionPreset === '4k') { w = 2160; h = 3840; }
    else if (resolutionPreset === '720p') { w = 720; h = 1280; }
    else if (resolutionPreset === '480p') { w = 480; h = 854; }
    else { w = 1080; h = 1920; }
  }

  return sanitizeExportDimensions(w, h);
}

/**
 * Builds normalized ExportOptions from Project and user ExportSettings.
 */
export function buildExportOptions(
  projectName: string,
  aspectRatio: AspectRatio,
  settings: ExportSettings
): ExportOptions {
  const format = settings.format || 'mp4';
  const fileName = sanitizeFileName(projectName || 'Video', format);
  const res = resolveExportResolution(aspectRatio, settings.resolution || '1080p');
  const fps = settings.fps || 30;

  // Video bitrate strictly in bps (settings.bitrateKbps is in kbps, e.g. 12000 kbps -> 12,000,000 bps)
  const rawVideo = settings.bitrateKbps || 8000;
  const bitrate = rawVideo >= 500000 ? Math.round(rawVideo) : Math.round(rawVideo * 1000);

  // Audio bitrate: validate and clamp against target codec/format capabilities
  const audioValidation = validateAudioBitrate(
    format,
    settings.audioBitrateBps || settings.audioBitrate || settings.audioBitrateKbps || 192
  );
  const audioBitrate = audioValidation.clampedBps;

  return {
    format,
    codec: settings.codec || 'h264',
    resolution: res,
    fps,
    bitrate,
    audioBitrate,
    sampleRate: settings.audioSampleRate || 48000,
    fileName,
    outputPath: settings.outputPath,
    burnCaptions: settings.burnCaptions ?? true,
    category: settings.category || 'video',
    alsoExportSubtitles: settings.alsoExportSubtitles,
    alsoExportAudio: settings.alsoExportAudio,
  };
}
