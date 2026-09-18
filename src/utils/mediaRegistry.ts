import { MediaAsset, VideoClip, AudioClip, MediaType } from '../types/project';
import { ExtractedMediaInfo } from './mediaLoader';
import { assetStore } from '../services/storage/assetStore';

/**
 * Media Registry — stable identity, fingerprint, and runtime URL recreation
 */

export function generateMediaId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createFingerprint(fileName: string, fileSize?: number, lastModified?: number): string {
  const size = fileSize ?? 0;
  const lm = lastModified ?? 0;
  return `${fileName}_${size}_${lm}`.toLowerCase();
}

export function createMediaAsset(
  meta: ExtractedMediaInfo,
  fileOrPath: File | string,
  existingId?: string
): MediaAsset {
  const isFile = fileOrPath instanceof File;
  const fileName = meta.name || (isFile ? (fileOrPath as File).name : String(fileOrPath).split(/[\/\\]/).pop() || 'media');
  const filePath = meta.filePath;
  const fileSize = isFile ? (fileOrPath as File).size : undefined;
  const lastModified = isFile ? (fileOrPath as File).lastModified : undefined;
  const mimeType = isFile ? (fileOrPath as File).type : undefined;

  let thumb = meta.thumbnailUrl || '';

  const asset: MediaAsset = {
    id: existingId || generateMediaId(),
    fileName,
    filePath,
    fileSize,
    lastModified,
    mimeType,
    mediaType: meta.mediaType,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    fps: meta.fps,
    thumbnailUrl: thumb,
    waveformPeaks: meta.waveformPeaks || [],
    hash: createFingerprint(fileName, fileSize, lastModified),
    importDate: new Date().toISOString(),
    originalFilePath: filePath,
    mediaBlobUrl: meta.url || '',
  };
  return asset;
}

/**
 * Recreate runtime URL for an asset
 * - If asset has an active mediaBlobUrl, return it directly
 * - Electron: captionforge-media:// absolute path
 * - Data URL thumbnails/images remain valid
 */
export function resolveMediaUrl(asset: MediaAsset): string {
  if (asset.mediaBlobUrl) return asset.mediaBlobUrl;
  if (!asset.filePath) return '';

  const isAbsolute =
    /^[a-zA-Z]:[\\/]/.test(asset.filePath) ||
    asset.filePath.startsWith('/') ||
    asset.filePath.startsWith('captionforge-media://') ||
    asset.filePath.startsWith('file://');

  if (isAbsolute) {
    const clean = asset.filePath.replace(/^file:\/\//, '').replace(/^captionforge-media:\/\//, '');
    if (clean.startsWith('blob:')) return clean;
    return `captionforge-media://${clean.replace(/\\/g, '/')}`;
  }

  if (asset.filePath.startsWith('blob:') || asset.filePath.startsWith('data:')) {
    return asset.filePath;
  }

  return '';
}

/**
 * Check if media file still exists
 * Uses Electron probe if available, otherwise checks IndexedDB assetStore and type-safe DOM element probes (Image, Audio, Video).
 */
export async function checkMediaExists(asset: MediaAsset): Promise<boolean> {
  // 1. Check persistent IndexedDB binary assetStore
  if (asset.id && (await assetStore.hasMediaBlob(asset.id))) {
    return true;
  }

  // 2. Try Electron native check first
  const api: any = (window as any).captionForgeAPI;
  if (api?.probeMedia && asset.filePath && !asset.filePath.startsWith('blob:') && !asset.filePath.startsWith('data:')) {
    try {
      const probe = await api.probeMedia(asset.filePath);
      if (probe && (probe.duration > 0 || probe.hasAudio !== undefined)) return true;
      return true;
    } catch {}
  }

  // 3. Web probe for active URLs
  const url = resolveMediaUrl(asset);
  if (!url) return false;
  if (url.startsWith('data:')) return true;

  const isImage =
    asset.mediaType === 'image' ||
    /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(asset.fileName || asset.filePath);

  const isAudio =
    asset.mediaType === 'audio' ||
    /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(asset.fileName || asset.filePath);

  // Type-specific element probes so images/audio don't fail video HTML elements
  if (isImage) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = (exists: boolean) => {
        if (done) return;
        done = true;
        resolve(exists);
      };
      const timer = setTimeout(() => finish(false), 2500);
      img.onload = () => {
        clearTimeout(timer);
        finish(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        finish(false);
      };
      img.src = url;
    });
  }

  if (isAudio) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      let done = false;
      const finish = (exists: boolean) => {
        if (done) return;
        done = true;
        try {
          audio.pause();
          audio.removeAttribute('src');
        } catch {}
        resolve(exists);
      };
      const timer = setTimeout(() => finish(false), 2500);
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        finish(true);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        finish(false);
      };
      audio.src = url;
    });
  }

  // Video probe
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.crossOrigin = 'anonymous';
    let done = false;
    const finish = (exists: boolean) => {
      if (done) return;
      done = true;
      try {
        v.pause();
        v.removeAttribute('src');
      } catch {}
      resolve(exists);
    };
    const timer = setTimeout(() => finish(false), 2500);
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(true);
    };
    v.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
    v.src = url;
  });
}

/**
 * Attempt to find moved file by fingerprint in a selected folder (batch relink)
 */
export async function findMediaInFolder(missingAsset: MediaAsset, folderFiles: File[]): Promise<File | null> {
  const targetHash = missingAsset.hash;
  const targetName = missingAsset.fileName.toLowerCase();
  for (const f of folderFiles) {
    if (createFingerprint(f.name, f.size, f.lastModified) === targetHash) return f;
    if (f.name.toLowerCase() === targetName && Math.abs((f.size || 0) - (missingAsset.fileSize || 0)) < 1024) return f;
  }
  for (const f of folderFiles) {
    if (f.name.toLowerCase() === targetName) return f;
  }
  return null;
}

/**
 * Relink a single asset to a new File/path
 */
export async function relinkMediaAsset(asset: MediaAsset, newFileOrPath: File | string): Promise<MediaAsset> {
  const isFile = newFileOrPath instanceof File;
  let newPath = '';
  let newSize: number | undefined;
  let newLm: number | undefined;
  let mime: string | undefined;
  let newUrl = '';

  if (isFile) {
    const f = newFileOrPath as File;
    newSize = f.size;
    newLm = f.lastModified;
    mime = f.type;
    newUrl = await assetStore.storeMediaBlob(asset.id, f, f.name);

    const api: any = (window as any).captionForgeAPI;
    if (api?.getPathForFile) {
      try {
        newPath = api.getPathForFile(f) || f.name;
      } catch {
        newPath = f.name;
      }
    } else {
      newPath = f.name;
    }
  } else {
    newPath = String(newFileOrPath);
  }

  const updated: MediaAsset = {
    ...asset,
    filePath: newPath,
    fileName: isFile ? (newFileOrPath as File).name : newPath.split(/[\/\\]/).pop() || asset.fileName,
    fileSize: newSize ?? asset.fileSize,
    lastModified: newLm ?? asset.lastModified,
    mimeType: mime ?? asset.mimeType,
    hash: createFingerprint(
      isFile ? (newFileOrPath as File).name : newPath.split(/[\/\\]/).pop() || '',
      newSize,
      newLm
    ),
    originalFilePath: newPath,
    mediaBlobUrl: newUrl || asset.mediaBlobUrl,
  };
  return updated;
}

/**
 * Upgrade legacy project: ensure every clip/footage has mediaId and registry entry
 */
export function ensureMediaRegistryForProject(project: any): {
  registry: MediaAsset[];
  clips: VideoClip[];
  audioClips: AudioClip[];
  footage: VideoClip[];
} {
  const registry: MediaAsset[] = Array.isArray(project.mediaRegistry) ? [...project.mediaRegistry] : [];
  const registryByPath = new Map<string, MediaAsset>();
  registry.forEach((a) => registryByPath.set(a.filePath, a));

  const ensureClip = (clip: any): any => {
    if (clip.mediaId && registry.find((a) => a.id === clip.mediaId)) return clip;
    const existing = registryByPath.get(clip.filePath) || registry.find((a) => a.fileName === clip.name);
    if (existing) {
      return {
        ...clip,
        mediaId: existing.id,
        originalFilePath: clip.filePath,
        mediaBlobUrl: clip.mediaBlobUrl || existing.mediaBlobUrl,
      };
    }
    const asset: MediaAsset = {
      id: generateMediaId(),
      fileName: clip.name || clip.filePath?.split(/[\/\\]/).pop() || 'media',
      filePath: clip.filePath || '',
      mediaType:
        clip.mediaType ||
        (clip.filePath?.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)
          ? 'image'
          : clip.filePath?.match(/\.(mp3|wav|aac|m4a|ogg)$/i)
          ? 'audio'
          : 'video'),
      duration: clip.duration || 5,
      width: clip.width || 1080,
      height: clip.height || 1920,
      fps: clip.fps || 30,
      thumbnailUrl: clip.thumbnailUrl || '',
      waveformPeaks: clip.waveformPeaks || [],
      hash: createFingerprint(clip.name || '', clip.fileSize, clip.lastModified),
      importDate: new Date().toISOString(),
      originalFilePath: clip.filePath,
      mediaBlobUrl: clip.mediaBlobUrl || '',
    };
    registry.push(asset);
    registryByPath.set(asset.filePath, asset);
    return { ...clip, mediaId: asset.id, originalFilePath: clip.filePath };
  };

  const newClips = (project.clips || []).map(ensureClip);
  const newAudio = (project.audioClips || []).map(ensureClip);
  const newFootage = (project.footageLibrary || []).map(ensureClip);

  const deduped = Array.from(new Map(registry.map((a) => [a.id, a])).values());

  return { registry: deduped, clips: newClips, audioClips: newAudio, footage: newFootage };
}

/**
 * Rebuild runtime URLs for all clips from registry
 */
export function rebuildRuntimeUrls(project: any): any {
  const registry: MediaAsset[] = project.mediaRegistry || [];
  const regMap = new Map(registry.map((a) => [a.id, a]));

  const rebuildClip = (clip: any) => {
    const asset = clip.mediaId ? regMap.get(clip.mediaId) : null;
    if (asset) {
      const url = resolveMediaUrl(asset);
      let thumb = clip.thumbnailUrl;
      if (!thumb || thumb.startsWith('blob:')) {
        thumb = asset.thumbnailUrl || thumb;
      }
      return {
        ...clip,
        filePath: asset.filePath,
        thumbnailUrl: thumb,
        mediaBlobUrl: url || clip.mediaBlobUrl,
        width: asset.width || clip.width,
        height: asset.height || clip.height,
        duration: asset.duration || clip.duration,
      };
    }

    if (clip.filePath && /^[a-zA-Z]:[\\/]/.test(clip.filePath)) {
      return {
        ...clip,
        mediaBlobUrl: clip.mediaBlobUrl || `captionforge-media://${clip.filePath.replace(/\\/g, '/')}`,
      };
    }
    return clip;
  };

  const newClips = (project.clips || []).map(rebuildClip);
  const newAudio = (project.audioClips || []).map(rebuildClip);
  const newFootage = (project.footageLibrary || []).map(rebuildClip);

  const newOverlays = (project.overlays || []).map((ov: any) => {
    if (ov.mediaId) {
      const asset = regMap.get(ov.mediaId);
      if (asset) {
        return {
          ...ov,
          filePath: asset.filePath,
          mediaBlobUrl: resolveMediaUrl(asset) || ov.mediaBlobUrl,
        };
      }
    }
    return ov;
  });

  return {
    ...project,
    clips: newClips,
    audioClips: newAudio,
    footageLibrary: newFootage,
    overlays: newOverlays,
  };
}
