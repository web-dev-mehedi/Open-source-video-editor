import { AspectRatio, DEFAULT_IMAGE_DURATION } from '../types/project';
import { calculateAutoAspectRatio } from './aspectRatio';

export { DEFAULT_IMAGE_DURATION } from '../types/project';

export interface ExtractedMediaInfo {
  url: string;
  filePath: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  aspectRatio: AspectRatio;
  thumbnailUrl: string;
  waveformPeaks: number[];
  mediaType: 'video' | 'image' | 'audio';
}

// ---- type helpers ----
export function isImageFile(nameOrPath: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|bmp|avif|heic|svg)$/i.test(nameOrPath);
}
export function isAudioFile(nameOrPath: string): boolean {
  return /\.(mp3|wav|aac|m4a|ogg|flac|wma|opus)$/i.test(nameOrPath);
}
export function getDefaultImageDuration(): number {
  try {
    const raw = localStorage.getItem('cf_default_image_duration');
    if (raw) {
      const v = parseFloat(raw);
      if (isFinite(v) && v >= 1 && v <= 30) return Math.round(v * 100) / 100;
    }
  } catch {}
  return DEFAULT_IMAGE_DURATION;
}

/**
 * Get displayable / playable media URL from File object or string path
 */
export function getPlayableMediaUrl(fileOrPath: File | string): { url: string; filePath: string; name: string } {
  if (typeof fileOrPath === 'string') {
    const fileName = fileOrPath.split(/[\/\\]/).pop() || 'Video Clip';
    if (fileOrPath.startsWith('blob:') || fileOrPath.startsWith('http') || fileOrPath.startsWith('data:')) {
      return { url: fileOrPath, filePath: fileOrPath, name: fileName };
    }
    const fileUrl = fileOrPath.startsWith('file://') ? fileOrPath : `file://${fileOrPath.replace(/\\/g, '/')}`;
    return { url: fileUrl, filePath: fileOrPath, name: fileName };
  }
  const blobUrl = URL.createObjectURL(fileOrPath);
  let resolvedFilePath = fileOrPath.name;
  if ((window as any).captionForgeAPI?.getPathForFile) {
    try {
      resolvedFilePath = (window as any).captionForgeAPI.getPathForFile(fileOrPath) || resolvedFilePath;
    } catch {}
  } else if ((fileOrPath as any).path) {
    resolvedFilePath = (fileOrPath as any).path;
  }
  return { url: blobUrl, filePath: resolvedFilePath, name: fileOrPath.name };
}

import { mediaDerivedCache, computeMediaFingerprint } from '../services/storage/mediaDerivedCache';

/**
 * Main entry — routes to correct extractor by file type.
 * Checks persistent derived cache first for 0ms lookup.
 * Single source of truth for duration: images use DEFAULT_IMAGE_DURATION.
 */
export async function extractMediaMetadata(fileOrPath: File | string): Promise<ExtractedMediaInfo> {
  const { url, filePath, name } = getPlayableMediaUrl(fileOrPath);
  const size = fileOrPath instanceof File ? fileOrPath.size : undefined;
  const lastMod = fileOrPath instanceof File ? fileOrPath.lastModified : undefined;
  const fingerprint = computeMediaFingerprint(filePath, size, lastMod);

  // Fast cache hit check (<0.5ms)
  try {
    const cached = await mediaDerivedCache.getDerivedAsset(fingerprint);
    if (cached.metadata) {
      const isImg = isImageFile(name);
      const isAud = isAudioFile(name);
      const mediaType = isImg ? 'image' : isAud ? 'audio' : 'video';
      return {
        url,
        filePath,
        name,
        duration: cached.metadata.duration,
        width: cached.metadata.width,
        height: cached.metadata.height,
        fps: cached.metadata.fps || 30,
        aspectRatio: cached.metadata.aspectRatio as any || '16:9',
        thumbnailUrl: cached.thumbnailUrl || (isImg ? url : ''),
        waveformPeaks: cached.waveformPeaks || [],
        mediaType,
      };
    }
  } catch {}

  let res: ExtractedMediaInfo;
  if (isImageFile(name)) res = await extractImageMetadata(fileOrPath);
  else if (isAudioFile(name)) res = await extractAudioMetadata(fileOrPath);
  else res = await extractVideoMetadata(fileOrPath);

  // Cache extracted info for subsequent instant re-imports & project reopen
  try {
    if (res.duration > 0) {
      await mediaDerivedCache.setMetadata(fingerprint, {
        duration: res.duration,
        width: res.width,
        height: res.height,
        fps: res.fps,
        aspectRatio: res.aspectRatio,
        cachedAt: Date.now(),
      });
      if (res.thumbnailUrl && !res.thumbnailUrl.startsWith('blob:')) {
        await mediaDerivedCache.setThumbnail(fingerprint, res.thumbnailUrl);
      }
      if (res.waveformPeaks && res.waveformPeaks.length > 0) {
        await mediaDerivedCache.setWaveform(fingerprint, res.waveformPeaks, res.duration);
      }
    }
  } catch {}

  return res;
}

/**
 * Image metadata extractor — uses HTMLImageElement, assigns default still duration.
 * Generates persistent data URL thumbnail (P53) instead of blob: for project save
 */
async function extractImageMetadata(fileOrPath: File | string): Promise<ExtractedMediaInfo> {
  const { url, filePath, name } = getPlayableMediaUrl(fileOrPath);
  const duration = getDefaultImageDuration();

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const finish = (w: number, h: number, dataUrl?: string) => {
      if (done) return;
      done = true;
      const width = w || 1920;
      const height = h || 1080;
      const autoRatio = calculateAutoAspectRatio(width, height);
      // Generate persistent thumbnail as data URL (320px) instead of blob: for save (P3, P53)
      let thumb = dataUrl || '';
      if (!thumb && url.startsWith('data:')) thumb = url;
      if (!thumb) {
        // Fallback: try to create data URL via canvas if image loaded
        try {
          if (img.naturalWidth > 0) {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 320 / (img.naturalWidth || 320));
            canvas.width = Math.round((img.naturalWidth || 320) * scale);
            canvas.height = Math.round((img.naturalHeight || 320) * scale);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              thumb = canvas.toDataURL('image/jpeg', 0.7);
            }
          }
        } catch {}
      }
      resolve({
        url,
        filePath,
        name,
        duration,
        width,
        height,
        fps: 30,
        aspectRatio: autoRatio.ratio,
        thumbnailUrl: thumb || url, // fallback to blob for session, but will be regenerated on load via filePath
        waveformPeaks: [],
        mediaType: 'image',
      });
    };

    img.onload = () => {
      // Try to generate data URL thumb
      let dataUrl = '';
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 320 / (img.naturalWidth || 320));
        canvas.width = Math.round((img.naturalWidth || 320) * scale);
        canvas.height = Math.round((img.naturalHeight || 320) * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        }
      } catch {}
      finish(img.naturalWidth, img.naturalHeight, dataUrl);
    };
    img.onerror = () => {
      finish(1920, 1080);
    };

    setTimeout(() => finish(1920, 1080), 4000);
    img.src = url;
  });
}

/**
 * Audio metadata extractor — uses HTMLAudioElement
 */
async function extractAudioMetadata(fileOrPath: File | string): Promise<ExtractedMediaInfo> {
  const { url, filePath, name } = getPlayableMediaUrl(fileOrPath);
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    let timeoutId: any;
    const cleanup = () => {
      clearTimeout(timeoutId);
      try { audio.pause(); } catch {}
      audio.removeAttribute('src');
    };
    audio.onloadedmetadata = async () => {
      const duration = Math.max(0.5, audio.duration || 10);
      let waveformPeaks: number[] = [];
      try {
        waveformPeaks = await extractAudioPeaksFromMedia(fileOrPath, duration);
      } catch {
        waveformPeaks = generateRealisticWaveform(Math.min(300, Math.round(duration * 10)));
      }
      cleanup();
      resolve({
        url,
        filePath,
        name,
        duration,
        width: 0,
        height: 0,
        fps: 30,
        aspectRatio: '16:9',
        thumbnailUrl: '',
        waveformPeaks,
        mediaType: 'audio',
      });
    };
    audio.onerror = () => {
      cleanup();
      resolve({
        url,
        filePath,
        name,
        duration: 10,
        width: 0,
        height: 0,
        fps: 30,
        aspectRatio: '16:9',
        thumbnailUrl: '',
        waveformPeaks: generateRealisticWaveform(150),
        mediaType: 'audio',
      });
    };
    timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        url,
        filePath,
        name,
        duration: 10,
        width: 0,
        height: 0,
        fps: 30,
        aspectRatio: '16:9',
        thumbnailUrl: '',
        waveformPeaks: generateRealisticWaveform(150),
        mediaType: 'audio',
      });
    }, 5000);
    audio.src = url;
  });
}

/**
 * Video metadata extractor — HTMLVideo element with thumbnail + waveform
 */
async function extractVideoMetadata(fileOrPath: File | string): Promise<ExtractedMediaInfo> {
  const { url, filePath, name } = getPlayableMediaUrl(fileOrPath);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    let isDone = false;

    const timeoutId = setTimeout(() => {
      if (isDone) return;
      isDone = true;
      cleanup();
      console.warn(`[mediaLoader] Video metadata timeout for ${name}, returning fallback.`);
      resolve({
        url,
        filePath,
        name,
        duration: 30,
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        thumbnailUrl: url,
        waveformPeaks: generateRealisticWaveform(150),
        mediaType: 'video',
      });
    }, 12000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    video.onloadedmetadata = async () => {
      if (isDone) return;

      let duration = video.duration;

      // Fix WebM / Chromium / Electron Infinity / NaN duration bug
      if (duration === Infinity || isNaN(duration) || duration <= 0) {
        try {
          video.currentTime = Number.MAX_SAFE_INTEGER;
          await new Promise<void>((r) => {
            const onTime = () => {
              video.removeEventListener('timeupdate', onTime);
              video.removeEventListener('seeked', onTime);
              r();
            };
            video.addEventListener('timeupdate', onTime);
            video.addEventListener('seeked', onTime);
            setTimeout(r, 1200);
          });
          if (isFinite(video.duration) && video.duration > 0) {
            duration = video.duration;
          }
        } catch {}
        try {
          video.currentTime = 0.1;
        } catch {}
      }

      const validDuration = isFinite(duration) && duration > 0.05 ? duration : 15;
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      const autoRatio = calculateAutoAspectRatio(width, height);

      let thumbnailUrl = '';
      try {
        thumbnailUrl = await captureFrameThumbnail(video, Math.min(1.0, Math.max(0.1, validDuration * 0.1)));
      } catch {}

      let waveformPeaks: number[] = [];
      try {
        waveformPeaks = await extractAudioPeaksFromMedia(fileOrPath, validDuration);
      } catch {
        waveformPeaks = generateRealisticWaveform(Math.min(300, Math.round(validDuration * 10)));
      }

      isDone = true;
      cleanup();
      resolve({
        url,
        filePath,
        name,
        duration: validDuration,
        width,
        height,
        fps: 30,
        aspectRatio: autoRatio.ratio,
        thumbnailUrl: thumbnailUrl || url,
        waveformPeaks,
        mediaType: 'video',
      });
    };

    video.onerror = () => {
      if (isDone) return;
      isDone = true;
      cleanup();
      resolve({
        url,
        filePath,
        name,
        duration: 30,
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        thumbnailUrl: url,
        waveformPeaks: generateRealisticWaveform(150),
        mediaType: 'video',
      });
    };

    video.src = url;
  });
}

/**
 * Capture single frame thumbnail using HTML5 Canvas
 */
export async function captureFrameThumbnail(videoElement: HTMLVideoElement, timestampSec: number): Promise<string> {
  return new Promise((resolve) => {
    const snapCanvas = () => {
      try {
        const canvas = document.createElement('canvas');
        const vw = videoElement.videoWidth || 320;
        const vh = videoElement.videoHeight || 180;
        const scale = Math.min(1, 320 / vw);
        canvas.width = Math.round(vw * scale);
        canvas.height = Math.round(vh * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.8);
        }
      } catch {}
      return '';
    };

    const targetTime = Math.max(0, timestampSec);
    if (Math.abs(videoElement.currentTime - targetTime) < 0.05 && videoElement.readyState >= 2) {
      return resolve(snapCanvas());
    }

    let isDone = false;
    let timer: any = null;

    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      if (timer) clearTimeout(timer);
      videoElement.removeEventListener('seeked', handleSeeked);
      videoElement.removeEventListener('error', handleError);
    };

    const handleSeeked = () => {
      cleanup();
      resolve(snapCanvas());
    };

    const handleError = () => {
      cleanup();
      resolve('');
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(snapCanvas());
    }, 1500);

    videoElement.addEventListener('seeked', handleSeeked, { once: true });
    videoElement.addEventListener('error', handleError, { once: true });

    try {
      videoElement.currentTime = targetTime;
    } catch {
      cleanup();
      resolve('');
    }
  });
}

/**
 * Extract audio amplitude waveform peaks using Web Audio API
 */
export async function extractAudioPeaksFromMedia(fileOrPath: File | string, duration: number): Promise<number[]> {
  try {
    let arrayBuffer: ArrayBuffer | null = null;
    if (fileOrPath instanceof File) {
      arrayBuffer = await fileOrPath.arrayBuffer();
    } else if (typeof fileOrPath === 'string' && (fileOrPath.startsWith('http') || fileOrPath.startsWith('blob:'))) {
      const response = await fetch(fileOrPath);
      arrayBuffer = await response.arrayBuffer();
    }
    if (arrayBuffer) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const rawData = decodedBuffer.getChannelData(0);
      const totalPeaks = Math.min(400, Math.max(80, Math.round(duration * 12)));
      const blockSize = Math.floor(rawData.length / totalPeaks);
      const peaks: number[] = [];
      for (let i = 0; i < totalPeaks; i++) {
        let max = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j += 4) {
          const val = Math.abs(rawData[start + j]);
          if (val > max) max = val;
        }
        peaks.push(Math.round(Math.min(1.0, max * 1.4) * 100) / 100);
      }
      await audioCtx.close();
      return peaks;
    }
  } catch {}
  return generateRealisticWaveform(Math.min(300, Math.round(duration * 10)));
}

export function generateRealisticWaveform(length: number): number[] {
  const peaks: number[] = [];
  let prev = 0.3;
  for (let i = 0; i < length; i++) {
    const isPause = i % 18 === 0 || (i % 25 === 0 && Math.random() > 0.4);
    if (isPause) prev = 0.08 + Math.random() * 0.1;
    else {
      const target = 0.35 + Math.sin(i * 0.4) * 0.25 + Math.random() * 0.35;
      prev = prev * 0.4 + target * 0.6;
    }
    peaks.push(Math.round(Math.max(0.08, Math.min(1.0, prev)) * 100) / 100);
  }
  return peaks;
}
