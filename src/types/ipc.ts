import { ProjectData, ProjectMetadata } from './project';
import { CaptionLine, CaptionStyleConfig } from './caption';
import { ExportSettings, ExportProgress, ExportJobHistoryItem } from './export';

export interface AppSettings {
  geminiApiKey: string;
  defaultLanguage: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  defaultExportFormat: string;
  defaultResolution: string;
  hardwareAcceleration: boolean;
  theme: 'dark' | 'light' | 'system';
  projectsDirectory: string;
  exportDirectory: string;
  defaultImageDuration?: number; // seconds, 1-30, default 5
}

export interface MediaProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codecName: string;
  hasAudio: boolean;
  audioCodec?: string;
  sampleRate?: number;
}

export interface ICaptionForgeAPI {
  // File dialogs & System
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  saveFileDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  selectFolderDialog: (options?: { defaultPath?: string; title?: string }) => Promise<string | null>;
  validateExportFolder: (folderPath: string) => Promise<{ valid: boolean; resolvedPath?: string; error?: string }>;
  getNextExportFileName: (options?: { folder?: string; projectName?: string; format?: string }) => Promise<{ fileName: string; fullPath: string; folder: string }>;
  getDefaultExportPath: (options?: { projectName?: string; format?: string; defaultPath?: string }) => Promise<string>;
  openFolderInExplorer: (path: string) => Promise<boolean>;
  openFile: (path: string) => Promise<boolean>;
  writeExportFile: (filePath: string, buffer: ArrayBuffer) => Promise<{ success: boolean; filePath: string; size: number }>;
  
  // Media Inspection & Audio Extraction
  probeMedia: (filePath: string) => Promise<MediaProbeResult>;
  getPreviewProxy: (filePath: string) => Promise<string>;
  generateThumbnail: (filePath: string, timestampSeconds: number) => Promise<string>;
  extractAudioWaveform: (filePath: string) => Promise<{ waveformPeaks: number[]; audioFilePath: string; duration: number }>;
  
  // AI Speech to Text & Translation
  transcribeAudio: (audioPath: string, apiKey: string, language?: string, model?: string) => Promise<CaptionLine[]>;
  translateCaptions: (captions: CaptionLine[], targetLangCode: string, apiKey: string) => Promise<CaptionLine[]>;
  
  // Projects Database & Storage
  getRecentProjects: () => Promise<ProjectMetadata[]>;
  saveProject: (project: ProjectData) => Promise<boolean>;
  loadProject: (projectId: string) => Promise<ProjectData | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  
  // Export & Video Rendering Engine
  startExport: (project: ProjectData, settings: ExportSettings) => Promise<{ jobId: string }>;
  cancelExport: (jobId: string) => Promise<boolean>;
  onExportProgress: (callback: (progress: ExportProgress) => void) => () => void;
  getExportHistory: () => Promise<ExportJobHistoryItem[]>;
  
  // Subtitle File Generator
  generateSubtitleFile: (captions: CaptionLine[], style: CaptionStyleConfig, format: 'srt' | 'vtt' | 'ass', outputPath: string) => Promise<string>;
  
  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  checkFFmpegStatus: () => Promise<{ available: boolean; version?: string; encoders?: string[] }>;
}

declare global {
  interface Window {
    captionForgeAPI?: ICaptionForgeAPI;
  }
}
