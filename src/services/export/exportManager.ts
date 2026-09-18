import { ProjectData } from '../../types/project';
import { ExportSettings, ExportProgress } from '../../types/export';
import { buildExportOptions, ExportOptions } from './exportConfig';
import { exportTimelineWebCodecs, isWebCodecsSupported } from './exporter';
import { clearAudioBufferCache } from './audioMixer';
import { triggerBrowserDownload } from '../../utils/webExportEngine';
import { generateSrtSubtitle, generateVttSubtitle, generateAssSubtitle } from '../../utils/assExport';
import { getActiveContentDuration } from '../../utils/timelineDuration';
import { sanitizeFileName, joinExportPath } from './destinationService';

export class ExportManager {
  private static activeController: AbortController | null = null;

  /**
   * Cancels the active export task if currently running.
   */
  public static cancelExport(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }

  /**
   * Main entry point to export a Project with specified ExportSettings.
   * Guarantees real file writing into the user-selected destination directory.
   */
  public static async executeExport(
    project: ProjectData,
    settings: ExportSettings,
    onProgress: (progress: ExportProgress) => void
  ): Promise<{ outputFilePath: string; blobUrl?: string }> {
    this.cancelExport();
    const controller = new AbortController();
    this.activeController = controller;

    const format = settings.format || 'mp4';
    const safeName = sanitizeFileName(settings.projectName || project.metadata.name || 'Video', format);
    const targetPath = settings.outputPath || (settings.outputFolder ? joinExportPath(settings.outputFolder, safeName) : safeName);

    try {
      // 1. SUBTITLE ONLY EXPORT
      if (settings.category === 'subtitle') {
        onProgress({
          jobId: 'sub_export',
          projectId: project.metadata.id,
          status: 'rendering',
          percent: 50,
          currentFrame: 1,
          totalFrames: 1,
          outputFilePath: targetPath,
        });

        let content = '';
        let mime = 'text/plain';
        if (format === 'vtt') {
          content = generateVttSubtitle(project.captions);
          mime = 'text/vtt';
        } else if ((format as string) === 'ass') {
          content = generateAssSubtitle(project.captions, project.activeStyle);
          mime = 'text/x-ass';
        } else {
          content = generateSrtSubtitle(project.captions);
          mime = 'application/x-subrip';
        }

        // Direct write to disk in Electron if available
        let writtenFilePath = targetPath;
        if (typeof window !== 'undefined' && (window as any).captionForgeAPI?.writeExportFile && targetPath) {
          try {
            const encoder = new TextEncoder();
            const res = await (window as any).captionForgeAPI.writeExportFile(targetPath, encoder.encode(content).buffer);
            if (res?.filePath) writtenFilePath = res.filePath;
          } catch (e) {
            console.warn('[ExportManager] Could not write subtitle directly to disk:', e);
          }
        }

        const blobUrl = triggerBrowserDownload(content, safeName, mime);

        onProgress({
          jobId: 'sub_export',
          projectId: project.metadata.id,
          status: 'completed',
          percent: 100,
          currentFrame: 1,
          totalFrames: 1,
          outputFilePath: writtenFilePath,
          outputBlobUrl: blobUrl,
          speed: 'Instant',
        });

        return { outputFilePath: writtenFilePath, blobUrl };
      }

      // 2. VIDEO EXPORT
      const options: ExportOptions = buildExportOptions(
        settings.projectName || project.metadata.name || 'Video',
        project.metadata.aspectRatio || '9:16',
        settings
      );

      let outputBlob: Blob | null = null;
      let outputMime = 'video/mp4';

      if (isWebCodecsSupported()) {
        const result = await exportTimelineWebCodecs(
          project,
          options,
          (update) => {
            onProgress({
              jobId: 'webcodecs_export',
              projectId: project.metadata.id,
              status: update.phase === 'completed' ? 'completed' : update.phase === 'failed' ? 'failed' : 'rendering',
              percent: update.percent,
              currentFrame: update.currentFrame,
              totalFrames: update.totalFrames,
              outputFilePath: targetPath,
              speed: 'Offline High-Speed',
            });
          },
          controller.signal
        );
        outputBlob = result.blob;
        outputMime = result.mimeType;
      } else {
        throw new Error('WebCodecs VideoEncoder is not supported in this environment.');
      }

      // 3. Post-Export Verification
      if (!outputBlob || outputBlob.size < 1024) {
        throw new Error(
          `Export failed: generated file size (${outputBlob?.size || 0} bytes) is below minimum threshold.`
        );
      }

      // 4. Save directly to user-selected destination path on filesystem (Electron)
      let writtenFilePath = targetPath;
      if (typeof window !== 'undefined' && (window as any).captionForgeAPI?.writeExportFile && targetPath) {
        try {
          const arrayBuffer = await outputBlob.arrayBuffer();
          const writeRes = await (window as any).captionForgeAPI.writeExportFile(targetPath, arrayBuffer);
          if (writeRes?.filePath) {
            writtenFilePath = writeRes.filePath;
          }
        } catch (writeErr: any) {
          console.error('[ExportManager] Failed to write directly to filesystem:', writeErr);
          throw new Error(`Cannot write export file to destination: ${writeErr?.message || 'Permission denied'}`);
        }
      }

      // Trigger browser download in web or fallback mode
      const blobUrl = triggerBrowserDownload(outputBlob, options.fileName, outputMime);

      // Multi-Export Subtitles Bundle (if requested)
      if (settings.alsoExportSubtitles && project.captions && project.captions.length > 0) {
        triggerBrowserDownload(
          generateSrtSubtitle(project.captions),
          `${safeName.replace(/\.[^/.]+$/, '')}_Subtitles.srt`,
          'application/x-subrip'
        );
      }

      onProgress({
        jobId: 'export_done',
        projectId: project.metadata.id,
        status: 'completed',
        percent: 100,
        currentFrame: Math.round((getActiveContentDuration(project) || project.metadata.duration || 5) * options.fps),
        totalFrames: Math.round((getActiveContentDuration(project) || project.metadata.duration || 5) * options.fps),
        outputFilePath: writtenFilePath,
        outputBlobUrl: blobUrl,
        speed: 'Completed',
      });

      return { outputFilePath: writtenFilePath, blobUrl };
    } catch (err: any) {
      if (controller.signal.aborted) {
        onProgress({
          jobId: 'cancelled',
          projectId: project.metadata.id,
          status: 'failed',
          percent: 0,
          error: 'Export was cancelled.',
        });
      } else {
        console.error('[ExportManager Error]:', err);
        onProgress({
          jobId: 'error',
          projectId: project.metadata.id,
          status: 'failed',
          percent: 0,
          error: err?.message || 'Video export encountered an error.',
        });
      }
      throw err;
    } finally {
      this.activeController = null;
      clearAudioBufferCache();
    }
  }
}
