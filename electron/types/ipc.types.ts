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

export interface WordTimestamp {
  id: string;
  word: string;
  start: number;
  end: number;
  confidence?: number;
  highlightColor?: string;
  isCustomEdited?: boolean;
}

export interface CaptionLine {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
  splitHookIndex?: number;
  styleOverride?: any;
}

export interface ExportProgressPayload {
  jobId: string;
  projectId: string;
  status: 'pending' | 'extracting' | 'transcribing' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  percent: number;
  fps?: number;
  currentFrame?: number;
  totalFrames?: number;
  speed?: string;
  timeRemaining?: string;
  error?: string;
  outputFilePath?: string;
}
