import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('captionForgeAPI', {
  // Path resolver for dropped/selected files
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (e) {
      return (file as any).path || file.name;
    }
  },

  // File dialogs
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  selectFolderDialog: (options?: { defaultPath?: string; title?: string }) =>
    ipcRenderer.invoke('dialog:selectFolder', options),
  validateExportFolder: (folderPath: string) =>
    ipcRenderer.invoke('system:validateExportFolder', folderPath),
  getNextExportFileName: (options?: { folder?: string; projectName?: string; format?: string }) =>
    ipcRenderer.invoke('system:getNextExportFileName', options),
  getDefaultExportPath: (options?: { projectName?: string; format?: string; defaultPath?: string }) =>
    ipcRenderer.invoke('system:getDefaultExportPath', options),
  openFolderInExplorer: (folderPath: string) =>
    ipcRenderer.invoke('system:openFolder', folderPath),
  openFile: (filePath: string) =>
    ipcRenderer.invoke('system:openFile', filePath),
  writeExportFile: (filePath: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('system:writeExportFile', { filePath, buffer }),

  // Media Inspection & Waveform
  probeMedia: (filePath: string) =>
    ipcRenderer.invoke('media:probe', filePath),
  getPreviewProxy: (filePath: string) =>
    ipcRenderer.invoke('media:getPreviewProxy', filePath),
  generateThumbnail: (filePath: string, timestampSeconds: number) =>
    ipcRenderer.invoke('media:thumbnail', { filePath, timestampSeconds }),
  extractAudioWaveform: (filePath: string) =>
    ipcRenderer.invoke('media:waveform', filePath),
  checkFileExists: (filePath: string) =>
    ipcRenderer.invoke('system:checkFileExists', filePath),

  // AI Speech-to-Text & Translation
  transcribeAudio: (audioPath: string, apiKey: string, language?: string, model?: string) =>
    ipcRenderer.invoke('ai:transcribe', { audioPath, apiKey, language, model }),
  translateCaptions: (captions: any[], targetLangCode: string, apiKey: string) =>
    ipcRenderer.invoke('ai:translate', { captions, targetLangCode, apiKey }),

  // Projects Database & Local Storage
  getRecentProjects: () =>
    ipcRenderer.invoke('project:getRecent'),
  saveProject: (project: any) =>
    ipcRenderer.invoke('project:save', project),
  loadProject: (projectId: string) =>
    ipcRenderer.invoke('project:load', projectId),
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke('project:delete', projectId),

  // Export Engine
  startExport: (project: any, settings: any) =>
    ipcRenderer.invoke('export:start', { project, settings }),
  cancelExport: (jobId: string) =>
    ipcRenderer.invoke('export:cancel', jobId),
  onExportProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('export:progress', subscription);
    return () => {
      ipcRenderer.removeListener('export:progress', subscription);
    };
  },
  getExportHistory: () =>
    ipcRenderer.invoke('export:getHistory'),

  // Subtitle File Generator
  generateSubtitleFile: (captions: any[], style: any, format: string, outputPath: string) =>
    ipcRenderer.invoke('subtitles:generate', { captions, style, format, outputPath }),

  // App Settings
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) =>
    ipcRenderer.invoke('settings:save', settings),
  checkFFmpegStatus: () =>
    ipcRenderer.invoke('system:checkFFmpeg'),
});
