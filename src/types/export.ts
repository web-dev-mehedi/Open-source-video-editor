export type ExportCategory = 'video' | 'audio' | 'subtitle' | 'gif';
export type ExportFormat = 'mp4' | 'mov' | 'webm' | 'gif' | 'mp3' | 'wav' | 'aac' | 'flac' | 'srt' | 'vtt' | 'txt' | 'json';
export type ExportResolution = '240p' | '360p' | '480p' | '720p' | '1080p' | '2k' | '4k' | 'original';
export type VideoCodec = 'h264' | 'hevc' | 'prores' | 'av1';
export type HardwareEncoder = 'auto' | 'nvenc' | 'qsv' | 'amf' | 'cpu';

export interface ExportSettings {
  category: ExportCategory;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number; // 10, 15, 24, 25, 30, 50, 60
  codec?: VideoCodec;
  bitrateKbps: number; // e.g. 8000 for 1080p, 25000 for 4k
  bitratePreset?: 'lower' | 'recommended' | 'higher' | 'custom';
  hardwareEncoder: HardwareEncoder;
  burnCaptions: boolean;
  burnOverlays: boolean;
  outputPath: string;
  outputFolder?: string;
  projectName: string;
  qualityPreset?: 'high' | 'medium' | 'low';
  
  // Audio specific
  audioSampleRate?: 44100 | 48000;
  audioChannels?: 'stereo' | 'mono';
  audioBitrate?: number; // in kbps (e.g. 96, 128, 160, 192, 256, 320) or bps
  audioBitrateKbps?: number;
  audioBitrateBps?: number;
  // Subtitle specific
  subtitleScope?: 'all' | 'selected';

  // Multi-Export Bundle Options
  alsoExportSubtitles?: boolean;
  alsoExportAudio?: boolean;

  // GIF specific
  gifLoop?: 'infinite' | 'once';
  gifDithering?: boolean;
}

export interface ExportProgress {
  jobId: string;
  projectId: string;
  status: 'pending' | 'extracting' | 'transcribing' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  percent: number; // 0 - 100
  fps?: number;
  currentFrame?: number;
  totalFrames?: number;
  speed?: string;
  timeRemaining?: string;
  elapsedSeconds?: number;
  etaSeconds?: number;
  error?: string;
  outputFilePath?: string;
  outputBlobUrl?: string;
  previewFrameDataUrl?: string;
  fileSizeFormatted?: string;
}

export interface ExportJobHistoryItem {
  id: string;
  projectId: string;
  projectName: string;
  outputPath: string;
  format: ExportFormat;
  resolution: string;
  fileSizeMb?: number;
  durationSeconds: number;
  createdAt: string;
  status: 'completed' | 'failed';
}
