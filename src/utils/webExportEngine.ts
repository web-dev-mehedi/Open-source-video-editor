import { ProjectData } from '../types/project';
import { ExportSettings, ExportProgress } from '../types/export';
import { ExportManager } from '../services/export/exportManager';

/**
 * Triggers a real browser file download from Blob or text string
 */
export function triggerBrowserDownload(
  blobOrString: Blob | string,
  fileName: string,
  mimeType = 'text/plain'
): string {
  const blob =
    typeof blobOrString === 'string'
      ? new Blob([blobOrString], { type: mimeType })
      : blobOrString;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    try {
      document.body.removeChild(anchor);
    } catch {}
    // Keep URL alive for preview for 60s, then revoke to avoid memory leak
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 60000);
  }, 1000);
  return url;
}

/**
 * Robust Client-Side Offline Frame-by-Frame Video & Subtitle Export Engine.
 * Powered by WebCodecs, MP4/WebM Muxer, and OfflineAudioContext.
 */
export async function executeWebExport(
  project: ProjectData,
  settings: ExportSettings,
  onProgress: (progress: ExportProgress) => void
): Promise<{ outputFilePath: string; blobUrl?: string }> {
  return await ExportManager.executeExport(project, settings, onProgress);
}

/**
 * Cancels the currently running export job.
 */
export function cancelWebExport(): void {
  ExportManager.cancelExport();
}
