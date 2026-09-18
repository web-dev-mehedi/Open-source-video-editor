import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { FFmpegService } from './services/ffmpeg.service';
import { GeminiService } from './services/gemini.service';
import { StorageService } from './services/storage.service';
import { DBService } from './services/db.service';
import { generateAssSubtitle, generateSrtSubtitle, generateVttSubtitle } from './services/assGenerator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

// Register custom media scheme as privileged for smooth 206 streaming and CORS-free video playback
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'captionforge-media',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
const storageService = new StorageService();
const dbService = new DBService(storageService);
const initialSettings = dbService.getSettings();
const ffmpegService = new FFmpegService(initialSettings.ffmpegPath, initialSettings.ffprobePath);
const geminiService = new GeminiService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0A0A0F',
    show: false,
    title: 'CaptionForge — AI Captions & Video Editor',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Enables local file and custom protocol video playback
    },
  });

  // Remove default menu for sleek app look
  mainWindow.setMenuBarVisibility(false);

  // Show window smoothly once DOM is rendered and ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // Fallback to guarantee window visibility even on slow assets
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1200);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(process.env.DIST || path.join(__dirname, '../dist'), 'index.html'));
  }
}

// Disable HTTP disk caching in development to prevent Chromium block file map corruption during HMR, and silence demuxer noise
if (!app.isPackaged || process.env.VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('disable-http-cache');
  app.commandLine.appendSwitch('log-level', '3');
}

app.whenReady().then(() => {
  // Handle captionforge-media:// streaming requests
  protocol.handle('captionforge-media', async (request) => {
    try {
      const rawPath = decodeURIComponent(request.url.replace(/^captionforge-media:\/\//, ''));
      let filePath = rawPath;
      if (process.platform === 'win32') {
        filePath = filePath.replace(/^\/+/, '');
      }
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response(null, { status: 404, statusText: 'Not Found' });
      }
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch (e) {
      console.error('Failed to stream media via protocol:', e);
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==========================================
// IPC HANDLERS
// ==========================================

// File Dialogs
ipcMain.handle('dialog:openFile', async (_event, options) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] },
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_event, options) => {
  if (!mainWindow) return null;
  const defaultDir = app.getPath('videos') || app.getPath('downloads') || app.getPath('desktop');
  let defaultPath = options?.defaultPath;
  if (!defaultPath) {
    defaultPath = path.join(defaultDir, 'Video_CaptionForge.mp4');
  } else if (!path.isAbsolute(defaultPath)) {
    defaultPath = path.join(defaultDir, defaultPath);
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: options?.filters || [
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'Subtitles', extensions: ['srt', 'vtt', 'ass'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle('dialog:selectFolder', async (_event, options) => {
  const parentWin = BrowserWindow.fromWebContents(_event.sender) || mainWindow;
  if (!parentWin) return null;
  const settings = dbService.getSettings();
  let defaultDir = options?.defaultPath;
  if (!defaultDir || !path.isAbsolute(defaultDir) || !fs.existsSync(defaultDir)) {
    defaultDir = settings.exportDirectory || dbService.resolveDefaultExportDir();
  }
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch {}
  }
  const result = await dialog.showOpenDialog(parentWin, {
    title: options?.title || 'Select Export Destination Folder',
    defaultPath: defaultDir,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const chosen = result.filePaths[0];
  dbService.saveSettings({ exportDirectory: chosen });
  return chosen;
});

ipcMain.handle('system:validateExportFolder', async (_event, folderPath: string) => {
  if (!folderPath || typeof folderPath !== 'string') {
    return { valid: false, error: 'Export folder path is empty.' };
  }
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const testFile = path.join(folderPath, `.cf_test_${Date.now()}`);
    fs.writeFileSync(testFile, '1', 'utf-8');
    fs.unlinkSync(testFile);
    return { valid: true, resolvedPath: folderPath };
  } catch (e: any) {
    return { valid: false, error: e?.message || 'Folder is not writable or inaccessible.' };
  }
});

ipcMain.handle('system:writeExportFile', async (_event, { filePath, buffer }: { filePath: string; buffer: ArrayBuffer }) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Destination file path is required.');
  }
  if (!buffer) {
    throw new Error('Export data buffer is required.');
  }
  const targetDir = path.dirname(filePath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const tempPath = `${filePath}.cf_tmp_${Date.now()}`;
  const nodeBuf = Buffer.from(buffer);
  fs.writeFileSync(tempPath, nodeBuf);

  // Validate atomic written file
  const stat = fs.statSync(tempPath);
  if (stat.size === 0) {
    try { fs.unlinkSync(tempPath); } catch {}
    throw new Error('Exported media file is empty (0 bytes).');
  }

  // Atomic rename to final path
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  fs.renameSync(tempPath, filePath);

  return { success: true, filePath, size: stat.size };
});

ipcMain.handle('system:getNextExportFileName', async (_event, options: { folder?: string; projectName?: string; format?: string }) => {
  const settings = dbService.getSettings();
  const targetDir = options?.folder || settings.exportDirectory || dbService.resolveDefaultExportDir();
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const safeName = (options?.projectName || 'Video').replace(/[\\/:*?"<>|]/g, '_');
  const fmt = (options?.format || 'mp4').toLowerCase().replace(/^\./, '');

  let candidateName = `${safeName}_CaptionForge.${fmt}`;
  let candidatePath = path.join(targetDir, candidateName);
  let counter = 2;
  while (fs.existsSync(candidatePath)) {
    candidateName = `${safeName}_CaptionForge-${counter}.${fmt}`;
    candidatePath = path.join(targetDir, candidateName);
    counter++;
  }
  return { fileName: candidateName, fullPath: candidatePath, folder: targetDir };
});

ipcMain.handle('system:getDefaultExportPath', async (_event, options) => {
  const settings = dbService.getSettings();
  const defaultDir = options?.defaultPath || settings.exportDirectory || dbService.resolveDefaultExportDir();
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  const safeName = (options?.projectName || 'Video').replace(/[\\/:*?"<>|]/g, '_');
  const fmt = (options?.format || 'mp4').toLowerCase().replace(/^\./, '');

  let candidate = path.join(defaultDir, `${safeName}_CaptionForge.${fmt}`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(defaultDir, `${safeName}_CaptionForge-${counter}.${fmt}`);
    counter++;
  }
  return candidate;
});

ipcMain.handle('system:openFolder', async (_event, folderPath) => {
  if (!folderPath) return false;
  try {
    if (fs.existsSync(folderPath)) {
      const isDir = fs.lstatSync(folderPath).isDirectory();
      if (isDir) {
        await shell.openPath(folderPath);
      } else {
        shell.showItemInFolder(folderPath);
      }
      return true;
    }
    const dir = path.dirname(folderPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await shell.openPath(dir);
    return true;
  } catch (e) {
    console.error('Error opening folder:', e);
    return false;
  }
});

ipcMain.handle('system:openFile', async (_event, filePath) => {
  if (!filePath) return false;
  try {
    if (fs.existsSync(filePath)) {
      const res = await shell.openPath(filePath);
      return res === '';
    }
    return false;
  } catch (e) {
    console.error('Error playing file:', e);
    return false;
  }
});

// Media Probing & Waveform
ipcMain.handle('media:probe', async (_event, filePath) => {
  return await ffmpegService.probeMedia(filePath);
});

ipcMain.handle('media:getPreviewProxy', async (_event, filePath) => {
  return await ffmpegService.getOrCreatePreviewProxy(filePath);
});

ipcMain.handle('media:thumbnail', async (_event, { filePath, timestampSeconds }) => {
  return await ffmpegService.generateThumbnail(filePath, timestampSeconds);
});

ipcMain.handle('media:waveform', async (_event, filePath) => {
  return await ffmpegService.extractWaveformPeaks(filePath);
});

// AI Transcription & Translation
ipcMain.handle('ai:transcribe', async (_event, { audioPath, apiKey, language, model }) => {
  try {
    if (!apiKey) {
      throw new Error('Gemini API Key is required for speech-to-text transcription. Please enter your Gemini API key in Settings or in the Auto-Caption modal.');
    }
    // Extract clean 16kHz speech stream to optimize token payload and acoustic accuracy
    const speechAudioPath = await ffmpegService.extractAudioForTranscription(audioPath).catch(() => audioPath);
    return await geminiService.transcribeAudio(speechAudioPath, apiKey, language, model);
  } catch (err: any) {
    console.error('AI Transcription Error:', err);
    throw err;
  }
});

ipcMain.handle('ai:translate', async (_event, { captions, targetLangCode, apiKey }) => {
  return await geminiService.translateCaptions(captions, targetLangCode, apiKey);
});

// Projects Database & Local Storage
ipcMain.handle('project:getRecent', async () => {
  return dbService.getRecentProjects();
});

ipcMain.handle('project:save', async (_event, project) => {
  try {
    // Defense in depth: blob: object URLs are session-only. If any renderer
    // call site persists one, strip it here so project.json never references
    // a dead source after a restart (reopened project would show black).
    const stripUrl = (u: any) => (typeof u === 'string' && u.startsWith('blob:') ? '' : u);
    const sanitized = {
      ...project,
      clips: (project.clips || []).map((c: any) => ({ ...c, mediaBlobUrl: stripUrl(c.mediaBlobUrl), thumbnailUrl: c.thumbnailUrl?.startsWith?.('blob:') ? '' : c.thumbnailUrl })),
      audioClips: (project.audioClips || []).map((a: any) => ({ ...a, mediaBlobUrl: stripUrl(a.mediaBlobUrl) })),
      footageLibrary: (project.footageLibrary || []).map((f: any) => ({ ...f, mediaBlobUrl: stripUrl(f.mediaBlobUrl), thumbnailUrl: f.thumbnailUrl?.startsWith?.('blob:') ? '' : f.thumbnailUrl })),
      overlays: (project.overlays || []).map((o: any) => ({ ...o, mediaBlobUrl: stripUrl(o.mediaBlobUrl) })),
      mediaRegistry: (project.mediaRegistry || []).map((m: any) => ({ ...m, mediaBlobUrl: stripUrl(m.mediaBlobUrl), thumbnailUrl: m.thumbnailUrl?.startsWith?.('blob:') ? '' : m.thumbnailUrl })),
    };
    storageService.writeProjectJson(sanitized.metadata.id, sanitized);
    dbService.saveProjectIndex(sanitized.metadata);
    return true;
  } catch (e) {
    console.error('Error saving project:', e);
    return false;
  }
});

ipcMain.handle('project:load', async (_event, projectId) => {
  return storageService.readProjectJson(projectId);
});

ipcMain.handle('project:delete', async (_event, projectId) => {
  storageService.deleteProjectFolder(projectId);
  dbService.deleteProjectIndex(projectId);
  return true;
});

// Video Export Engine
ipcMain.handle('export:start', async (_event, { project, settings }) => {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // 1. SUBTITLE ONLY EXPORT
  if (settings.category === 'subtitle') {
    try {
      const outPath = settings.outputPath;
      const targetDir = path.dirname(outPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      let subContent = '';
      const fmt = settings.format || 'srt';
      if (fmt === 'vtt') {
        subContent = generateVttSubtitle(project.captions);
      } else if (fmt === 'ass') {
        subContent = generateAssSubtitle(project.captions, project.activeStyle, project.metadata.width || 1080, project.metadata.height || 1920);
      } else {
        subContent = generateSrtSubtitle(project.captions);
      }

      fs.writeFileSync(outPath, subContent, 'utf-8');

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('export:progress', {
          jobId,
          projectId: project.metadata?.id || '',
          status: 'completed',
          percent: 100,
          currentFrame: 1,
          totalFrames: 1,
          outputFilePath: outPath,
          speed: 'Instant',
        });
      }
      return outPath;
    } catch (err: any) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('export:progress', {
          jobId,
          projectId: project.metadata?.id || '',
          status: 'failed',
          percent: 0,
          error: err.message || 'Subtitle export error',
        });
      }
      throw err;
    }
  }

  // 2. VIDEO / AUDIO / GIF EXPORT
  let assSubtitlePath: string | undefined;
  if (settings.burnCaptions && project.captions && project.captions.length > 0) {
    const assContent = generateAssSubtitle(
      project.captions,
      project.activeStyle,
      project.metadata.width || 1080,
      project.metadata.height || 1920
    );
    assSubtitlePath = storageService.writeSubtitleTempFile(project.metadata.id, assContent, 'ass');
  }

  // Run full project timeline render in background with progress events to renderer
  ffmpegService.renderProjectTimeline(
    jobId,
    project,
    settings,
    assSubtitlePath,
    (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('export:progress', progress);
      }

      if (progress.status === 'completed') {
        // If Multi-Export was selected (Also Export Subtitles)
        if (settings.alsoExportSubtitles && project.captions && project.captions.length > 0) {
          try {
            const parsed = path.parse(settings.outputPath);
            const srtPath = path.join(parsed.dir, `${parsed.name}.srt`);
            const srtContent = generateSrtSubtitle(project.captions);
            fs.writeFileSync(srtPath, srtContent, 'utf-8');
          } catch (e) {}
        }

        dbService.addExportJob({
          id: jobId,
          projectId: project.metadata.id,
          projectName: project.metadata.name,
          outputPath: settings.outputPath,
          format: settings.format,
          resolution: settings.resolution,
          durationSeconds: project.metadata.duration,
          createdAt: new Date().toISOString(),
          status: 'completed'
        });

        if (settings.outputPath) {
          try {
            dbService.saveSettings({ exportDirectory: path.dirname(settings.outputPath) });
          } catch {}
        }
      }
    }
  ).catch((err) => {
    console.error('Rendering error:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('export:progress', {
        jobId,
        projectId: project.metadata?.id || '',
        status: 'failed',
        percent: 0,
        error: err.message || 'Export error'
      });
    }
  });

  return { jobId };
});

ipcMain.handle('export:cancel', async (_event, jobId) => {
  return ffmpegService.cancelJob(jobId);
});

ipcMain.handle('export:getHistory', async () => {
  return dbService.getExportHistory();
});

// Subtitle Generator
ipcMain.handle('subtitles:generate', async (_event, { captions, style, format, outputPath }) => {
  let content = '';
  if (format === 'ass') {
    content = generateAssSubtitle(captions, style || {});
  } else if (format === 'vtt') {
    content = generateVttSubtitle(captions);
  } else {
    content = generateSrtSubtitle(captions, style?.casing || 'preserve');
  }

  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
});

// Settings & System
ipcMain.handle('settings:get', async () => {
  return dbService.getSettings();
});

ipcMain.handle('settings:save', async (_event, updated) => {
  return dbService.saveSettings(updated);
});

ipcMain.handle('system:checkFFmpeg', async () => {
  return await ffmpegService.checkStatus();
});

ipcMain.handle('system:checkFileExists', async (_event, filePath: string) => {
  try {
    if (!filePath) return false;
    if (filePath.startsWith('blob:') || filePath.startsWith('data:')) return true;
    let clean = filePath.replace(/^captionforge-media:\/\//, '').replace(/^file:\/\//, '');
    if (process.platform === 'win32') clean = clean.replace(/^\/+/, '');
    try { if (fs.existsSync(clean)) return true; } catch {}
    try { if (fs.existsSync(filePath)) return true; } catch {}
    return false;
  } catch { return false; }
});
