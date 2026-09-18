import { ProjectData, ProjectMetadata, VideoClip, AudioClip, MediaAsset, OverlayElement } from '../../types/project';
import { dbService } from './db';
import { assetStore } from './assetStore';

/**
 * Captures a live snapshot thumbnail from the active editor video/canvas.
 */
export function captureProjectThumbnail(canvasOrVideo?: HTMLCanvasElement | HTMLVideoElement | null): string {
  if (!canvasOrVideo) return '';
  try {
    if (canvasOrVideo instanceof HTMLCanvasElement) {
      return canvasOrVideo.toDataURL('image/jpeg', 0.85);
    }
    if (canvasOrVideo instanceof HTMLVideoElement && canvasOrVideo.videoWidth > 0) {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = Math.min(320, canvasOrVideo.videoWidth);
      snapCanvas.height = Math.round((snapCanvas.width / canvasOrVideo.videoWidth) * canvasOrVideo.videoHeight);
      const ctx = snapCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvasOrVideo, 0, 0, snapCanvas.width, snapCanvas.height);
        return snapCanvas.toDataURL('image/jpeg', 0.85);
      }
    }
  } catch (e) {
    console.warn('[ProjectStorage] Failed to capture live thumbnail:', e);
  }
  return '';
}

/**
 * Saves a media file or blob internally into the persistent offline asset storage.
 */
export async function backupMediaAsset(
  projectId: string,
  assetId: string,
  fileOrBlob: File | Blob,
  fileName?: string
): Promise<{ blobKey: string; blobUrl: string }> {
  // 1. Store in pure binary assetStore by assetId
  const liveUrl = await assetStore.storeMediaBlob(assetId, fileOrBlob, fileName, projectId);

  // 2. Also mirror to dbService under project-keyed store
  let blobKey = `${projectId}_${assetId}`;
  try {
    blobKey = await dbService.saveAssetBlob(projectId, assetId, fileOrBlob, fileName);
  } catch (err) {
    console.warn('[ProjectStorage] dbService mirror save warning:', err);
  }

  return { blobKey, blobUrl: liveUrl };
}

/**
 * A `blob:` object URL is only valid inside the browsing session that created
 * it. Any `blob:` URL found in persisted project JSON is stale by definition
 * and must never be handed to the player after a reopen.
 */
export function isStaleBlobUrl(url?: string | null): boolean {
  return !!url && url.startsWith('blob:');
}

/**
 * True when the path can be turned back into a playable source without any
 * in-memory state (absolute disk path or an already-protocolized URL).
 */
export function isAbsoluteMediaPath(p?: string | null): boolean {
  if (!p) return false;
  return (
    /^[a-zA-Z]:[\\/]/.test(p) ||
    p.startsWith('/') ||
    p.startsWith('file://') ||
    p.startsWith('captionforge-media://')
  );
}

/**
 * Rebuilds a playable `captionforge-media://` URL from a persisted absolute
 * path. Returns '' for anything that cannot be resolved without runtime state.
 */
export function buildProtocolUrl(filePath: string): string {
  if (!filePath) return '';
  if (
    filePath.startsWith('blob:') ||
    filePath.startsWith('data:') ||
    filePath.startsWith('http://') ||
    filePath.startsWith('https://')
  ) {
    return filePath.startsWith('http') ? filePath : '';
  }
  const clean = filePath
    .replace(/^captionforge-media:\/\//, '')
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/');
  if (!clean) return '';
  return `captionforge-media://${clean}`;
}

/**
 * Helper to resolve an active working object URL for an asset by trying multiple store keys.
 * Never throws: storage backends may be unavailable (e.g. unit tests, private
 * mode) and that must degrade to "not found", not a failed project open.
 */
async function resolveWorkingUrl(
  projectId: string,
  assetId?: string,
  fallbackId?: string
): Promise<string | null> {
  const idsToTry = [assetId, fallbackId].filter(Boolean) as string[];

  for (const id of idsToTry) {
    try {
      // 1. Check assetStore
      const urlFromAssetStore = await assetStore.getMediaBlobUrl(id);
      if (urlFromAssetStore) return urlFromAssetStore;
    } catch (err) {
      console.warn(`[ProjectStorage] assetStore lookup failed for ${id}:`, err);
    }

    try {
      // 2. Check dbService project-keyed
      const blobKey = `${projectId}_${id}`;
      const urlFromDbService = await dbService.getAssetBlobUrl(blobKey);
      if (urlFromDbService) return urlFromDbService;
    } catch (err) {
      console.warn(`[ProjectStorage] dbService lookup failed for ${projectId}_${id}:`, err);
    }
  }

  return null;
}

export type MediaRestoreStatus = 'blob' | 'path' | 'missing';

export interface ResolvedMediaUrl {
  url: string;
  status: MediaRestoreStatus;
}

/**
 * Single decision point for turning persisted references back into a playable
 * URL. Priority: fresh offline blob > absolute-path protocol URL > missing.
 * Stale `blob:` URLs are never returned — they are the black-screen cause.
 */
async function resolveRestorableUrl(
  projectId: string,
  opts: { mediaId?: string; fallbackId?: string; filePath?: string; staleUrl?: string }
): Promise<ResolvedMediaUrl> {
  const liveUrl = await resolveWorkingUrl(projectId, opts.mediaId, opts.fallbackId);
  if (liveUrl) return { url: liveUrl, status: 'blob' };

  if (isAbsoluteMediaPath(opts.filePath)) {
    return { url: buildProtocolUrl(opts.filePath as string), status: 'path' };
  }

  if (opts.staleUrl && !isStaleBlobUrl(opts.staleUrl)) {
    // A persisted non-blob URL (http/data) can still be used as-is.
    return { url: opts.staleUrl, status: 'path' };
  }

  return { url: '', status: 'missing' };
}

function logRestoreResult(
  kind: string,
  id: string,
  savedPath: string | undefined,
  resolved: ResolvedMediaUrl
): void {
  if (resolved.status === 'missing') {
    console.warn(
      `[ProjectStorage] media unrestorable kind=${kind} id=${id} savedPath=${savedPath || '(none)'} ` +
        `resolvedPath=(none) exists=false status=missing`
    );
  } else {
    console.info(
      `[ProjectStorage] media restored kind=${kind} id=${id} savedPath=${savedPath || '(none)'} ` +
        `resolvedPath=${resolved.url.slice(0, 80)} status=${resolved.status}`
    );
  }
}

/**
 * Rehydrates all media URLs across a ProjectData object using persistent IndexedDB binary blobs.
 *
 * Guarantees after this function returns:
 * - No `mediaBlobUrl` anywhere starts with `blob:` unless it was freshly
 *   created in this session from a stored binary.
 * - Clips whose source can be rebuilt from an absolute path carry a
 *   `captionforge-media://` URL and are playable without manual relinking.
 * - Everything else carries `mediaBlobUrl: ''` and is listed in
 *   `missingMedia`, so the UI shows OFFLINE/relink instead of a black screen.
 */
export async function rehydrateProjectMedia(project: ProjectData): Promise<ProjectData> {
  const projectId = project.metadata.id;
  const assetUrlMap = new Map<string, string>();
  const missing: string[] = [];

  const trackMissing = (label: string) => {
    if (label && !missing.includes(label)) missing.push(label);
  };

  // 1. Rehydrate Media Registry Assets
  const registry: MediaAsset[] = [];
  for (const asset of (project as any).mediaRegistry || []) {
    const resolved = await resolveRestorableUrl(projectId, {
      mediaId: asset.id,
      filePath: asset.filePath,
      staleUrl: asset.mediaBlobUrl,
    });
    logRestoreResult('asset', asset.id, asset.filePath, resolved);

    if (resolved.status !== 'missing') {
      assetUrlMap.set(asset.id, resolved.url);
      if (asset.filePath) assetUrlMap.set(asset.filePath, resolved.url);
      if (asset.fileName) assetUrlMap.set(asset.fileName, resolved.url);
    } else {
      trackMissing(asset.filePath || asset.fileName || asset.id);
    }

    registry.push({
      ...asset,
      mediaBlobUrl: resolved.url,
    });
  }

  const rehydrateClipList = async <T extends { mediaId?: string; id: string; filePath?: string; mediaBlobUrl?: string }>(
    kind: string,
    list: T[] | undefined
  ): Promise<T[]> => {
    const out: T[] = [];
    for (const clip of list || []) {
      const cached =
        (clip.mediaId && assetUrlMap.get(clip.mediaId)) ||
        (clip.filePath && assetUrlMap.get(clip.filePath));
      if (cached) {
        out.push({ ...clip, mediaBlobUrl: cached });
        continue;
      }
      const resolved = await resolveRestorableUrl(projectId, {
        mediaId: clip.mediaId,
        fallbackId: clip.id,
        filePath: clip.filePath,
        staleUrl: clip.mediaBlobUrl,
      });
      logRestoreResult(kind, clip.mediaId || clip.id, clip.filePath, resolved);
      if (resolved.status === 'missing') {
        trackMissing(clip.filePath || clip.mediaId || clip.id);
      } else if (clip.mediaId) {
        assetUrlMap.set(clip.mediaId, resolved.url);
      }
      out.push({ ...clip, mediaBlobUrl: resolved.url });
    }
    return out;
  };

  // 2-4. Rehydrate Video / Audio / Footage clips
  const clips = await rehydrateClipList<VideoClip>('clip', project.clips || []);
  const audioClips = await rehydrateClipList<AudioClip>('audio', project.audioClips || []);
  const footageLibrary = await rehydrateClipList<VideoClip>('footage', project.footageLibrary || []);

  // 5. Rehydrate Overlays (Image / Watermark). Text-only overlays have no file.
  const overlays: OverlayElement[] = [];
  for (const ov of project.overlays || []) {
    if (!ov.filePath && !ov.mediaId && !ov.mediaBlobUrl) {
      overlays.push(ov);
      continue;
    }
    const cached =
      (ov.mediaId && assetUrlMap.get(ov.mediaId)) ||
      (ov.filePath && assetUrlMap.get(ov.filePath));
    if (cached) {
      overlays.push({ ...ov, mediaBlobUrl: cached });
      continue;
    }
    const resolved = await resolveRestorableUrl(projectId, {
      mediaId: ov.mediaId,
      fallbackId: ov.id,
      filePath: ov.filePath,
      staleUrl: ov.mediaBlobUrl,
    });
    logRestoreResult('overlay', ov.mediaId || ov.id, ov.filePath, resolved);
    if (resolved.status === 'missing') {
      trackMissing(ov.filePath || ov.mediaId || ov.id);
    }
    overlays.push({ ...ov, mediaBlobUrl: resolved.url });
  }

  // 6. Merge freshly detected missing entries with any previously stored ones
  // that are still unresolvable.
  const currentMissing: string[] = (project as any).missingMedia || [];
  for (const p of currentMissing) {
    if (!assetUrlMap.has(p) && !missing.includes(p)) missing.push(p);
  }
  const remainingMissing = missing.filter((p) => !assetUrlMap.has(p));

  console.info(
    `[ProjectStorage] rehydrate complete project=${projectId} ` +
      `clips=${clips.length} audio=${audioClips.length} footage=${footageLibrary.length} ` +
      `overlays=${overlays.length} missing=${remainingMissing.length}`
  );

  return {
    ...project,
    clips,
    audioClips,
    footageLibrary,
    overlays,
    mediaRegistry: registry,
    missingMedia: remainingMissing,
  } as ProjectData;
}

/**
 * Strips session-only URLs from a project before it touches any persistent
 * store (IndexedDB, Electron JSON, localStorage). `blob:` object URLs and
 * `blob:` thumbnails cannot survive a restart; persisting them is what caused
 * reopened projects to reference dead sources. The in-memory project is left
 * untouched — callers must save the returned copy.
 */
export function sanitizeProjectForPersistence(project: ProjectData): ProjectData {
  const stripUrl = (url?: string): string => {
    if (!url) return '';
    // http(s) and data: URLs stay valid across restarts; blob: does not.
    if (url.startsWith('blob:')) return '';
    return url;
  };
  const stripThumb = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('blob:')) return '';
    return url;
  };

  return {
    ...project,
    clips: (project.clips || []).map((c) => ({
      ...c,
      mediaBlobUrl: stripUrl(c.mediaBlobUrl),
      thumbnailUrl: stripThumb(c.thumbnailUrl),
    })),
    audioClips: (project.audioClips || []).map((a) => ({ ...a, mediaBlobUrl: stripUrl(a.mediaBlobUrl) })),
    footageLibrary: (project.footageLibrary || []).map((f) => ({
      ...f,
      mediaBlobUrl: stripUrl(f.mediaBlobUrl),
      thumbnailUrl: stripThumb(f.thumbnailUrl),
    })),
    overlays: (project.overlays || []).map((o) => ({ ...o, mediaBlobUrl: stripUrl(o.mediaBlobUrl) })),
    mediaRegistry: ((project as any).mediaRegistry || []).map((a: MediaAsset) => ({
      ...a,
      mediaBlobUrl: stripUrl(a.mediaBlobUrl),
      thumbnailUrl: stripThumb(a.thumbnailUrl),
    })),
  } as ProjectData;
}

/**
 * Saves full project state to IndexedDB (and Electron storage if available).
 */
export async function saveProjectWithOfflineAssets(
  project: ProjectData,
  thumbnailDataUrl?: string
): Promise<void> {
  const finalThumb = thumbnailDataUrl || project.metadata.thumbnailPath;
  // Persist a sanitized copy: session-only blob: URLs must never reach disk.
  const persistable = sanitizeProjectForPersistence(project);
  console.info(
    `[ProjectStorage] saving project=${project.metadata.id} clips=${persistable.clips.length} ` +
      `registry=${(persistable as any).mediaRegistry?.length || 0} missing=${(persistable as any).missingMedia?.length || 0}`
  );
  await dbService.saveProjectState(persistable, finalThumb);

  // If running in Electron, also mirror to desktop storage
  if (window.captionForgeAPI?.saveProject) {
    try {
      await window.captionForgeAPI.saveProject(persistable);
    } catch (err) {
      console.warn('[ProjectStorage] Electron mirror save warning:', err);
    }
  }
}

/**
 * Loads a project and rehydrates all media URLs from internal offline storage
 * so missing/deleted files on the user's hard drive load seamlessly.
 */
export async function loadProjectWithOfflineAssets(projectId: string): Promise<ProjectData | null> {
  // 1. Fetch project record from IndexedDB (or fallback to Electron)
  let project: ProjectData | null = await dbService.getProjectState(projectId);

  if (!project && window.captionForgeAPI?.loadProject) {
    try {
      project = await window.captionForgeAPI.loadProject(projectId);
    } catch {}
  }

  if (!project) return null;

  // 2. Rehydrate all project media from binary IndexedDB storage
  return await rehydrateProjectMedia(project);
}

/**
 * Permanently deletes a project, all its offline media assets, thumbnails, and index records.
 */
export async function deleteProjectCompletely(projectId: string): Promise<void> {
  await assetStore.deleteProjectAssets(projectId);
  await dbService.deleteProjectCompletely(projectId);

  if (window.captionForgeAPI?.deleteProject) {
    try {
      await window.captionForgeAPI.deleteProject(projectId);
    } catch {}
  }
}

/**
 * Lists all recent projects from IndexedDB index.
 */
export async function listAllProjects(): Promise<ProjectMetadata[]> {
  const localList = await dbService.listRecentProjects();

  // If Electron has extra projects, merge and deduplicate
  if (window.captionForgeAPI?.getRecentProjects) {
    try {
      const electronList = (await window.captionForgeAPI.getRecentProjects()) || [];
      const map = new Map<string, ProjectMetadata>();
      for (const p of localList) map.set(p.id, p);
      for (const p of electronList) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
      return Array.from(map.values()).sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    } catch {}
  }

  return localList;
}
