import { CaptionLine, CaptionStyleConfig } from './caption';
import { ClipEffect } from './effects';
import { TransitionConfig } from './transitions';
import { ClipKeyframeState } from './keyframes';
import { MaskConfig } from './masking';
import { BackgroundMattingConfig } from './matting';
import { StabilizationConfig } from './stabilization';
import { AutoReframeConfig } from './autoReframe';
import { BeautyRetouchConfig } from './beautyRetouch';
import { VocalIsolationConfig } from './vocalIsolation';
import { VoiceChangerConfig } from './voiceChanger';
import { ColorMatchConfig } from './colorMatch';
import { ParticleSystemConfig } from './particleSystem';
import { CameraShakeConfig } from './cameraShake';
import { ColorGradingConfig } from './colorGrading';
import { ClipAnimationConfig } from './animation';
import { ClipAudioFiltersState } from './audioFilters';

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '21:9';

export const DEFAULT_IMAGE_DURATION = 5; // seconds — single source of truth for still images

export type MediaType = 'video' | 'image' | 'audio';

export interface MediaAsset {
  id: string; // stable media ID
  fileName: string;
  filePath: string; // absolute path (Electron) or file.name (web)
  fileSize?: number;
  lastModified?: number;
  mimeType?: string;
  mediaType: MediaType;
  duration: number;
  width: number;
  height: number;
  fps: number;
  thumbnailUrl?: string; // data URL persistent (never blob:)
  waveformPeaks?: number[];
  hash?: string; // fingerprint: `${fileName}_${fileSize}_${lastModified}`
  importDate: string;
  originalFilePath?: string;
  mediaBlobUrl?: string;
  processingStatus?: 'instant' | 'probing' | 'metadata_ready' | 'thumbnailing' | 'thumbnail_ready' | 'waveform' | 'ready' | 'error';
  proxyUrl?: string;
}

export interface VideoClip {
  id: string;
  mediaId?: string; // stable reference to MediaAsset
  name: string;
  filePath: string;
  originalFilePath?: string; // for relink fingerprint
  duration: number; // original duration in seconds (for images: DEFAULT_IMAGE_DURATION)
  startOffset: number; // trim start in source video (seconds)
  endOffset: number; // trim end in source video (seconds)
  timelineStart: number; // position on project timeline (seconds)
  timelineDuration: number; // duration on timeline (seconds) after speed adjustment
  speed: number; // 0.25 to 4.0
  volume: number; // 0 to 2.0
  isMuted: boolean;
  width: number;
  height: number;
  fps: number;
  thumbnailUrl?: string;
  waveformPeaks?: number[];
  mediaBlobUrl?: string;
  effects?: ClipEffect[];
  trackIndex?: number; // 1 for V1, 2 for V2 (B-roll/Overlay), etc.
  mediaType?: MediaType; // 'video' | 'image' | 'audio' — unified clip discriminator
  transform?: {
    xPercent?: number; // -100 to 100
    yPercent?: number; // -100 to 100
    scale?: number; // 0.1 to 3.0
    rotation?: number; // -360 to 360 degrees
    opacity?: number; // 0 to 1.0
  };
  crop?: {
    top: number; // percent 0-100
    bottom: number; // percent 0-100
    left: number; // percent 0-100
    right: number; // percent 0-100
  };
  keyframes?: ClipKeyframeState;
  mask?: MaskConfig;
  matting?: BackgroundMattingConfig;
  stabilization?: StabilizationConfig;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'difference' | 'soft-light';
  autoReframe?: AutoReframeConfig;
  beautyRetouch?: BeautyRetouchConfig;
  vocalIsolation?: VocalIsolationConfig;
  voiceChanger?: VoiceChangerConfig;
  colorMatch?: ColorMatchConfig;
  particles?: ParticleSystemConfig;
  cameraShake?: CameraShakeConfig;
  colorGrading?: ColorGradingConfig;
  animation?: ClipAnimationConfig;
  audioFilters?: ClipAudioFiltersState;
  denoise?: { enabled: boolean; strength: number; processedBlobUrl?: string; originalBlobUrl?: string };
}

export interface AudioClip {
  id: string;
  mediaId?: string; // stable reference to MediaAsset
  name: string;
  sourceClipId?: string; // Linked video clip ID if extracted from video
  filePath: string;
  originalFilePath?: string;
  duration: number; // original duration in seconds
  startOffset: number; // trim start in source audio (seconds)
  endOffset: number; // trim end in source audio (seconds)
  timelineStart: number; // position on project timeline (seconds)
  timelineDuration: number; // duration on timeline (seconds)
  speed?: number; // playback rate multiplier (e.g. 0.25 to 4.0)
  volume: number; // 0 to 2.0 (1.0 = 100% / 0dB)
  isMuted: boolean;
  fadeIn?: number; // seconds
  fadeOut?: number; // seconds
  trackIndex?: number; // 1 for A1, 2 for A2
  waveformPeaks?: number[];
  mediaBlobUrl?: string;
  audioFilters?: ClipAudioFiltersState;
  vocalIsolation?: VocalIsolationConfig;
  denoise?: { enabled: boolean; strength: number; processedBlobUrl?: string; originalBlobUrl?: string };
}

export interface OverlayElement {
  id: string;
  type: 'image' | 'text' | 'intro' | 'outro' | 'watermark' | 'motion-graphic' | 'element' | 'effect';
  name: string;
  timelineStart: number;
  timelineDuration: number;
  x: number; // percent 0 - 100
  y: number; // percent 0 - 100
  scale: number; // 0.1 to 3.0
  opacity: number; // 0 to 1.0
  rotation?: number; // -360 to 360 degrees
  
  // For image/logo/watermark/sticker/element
  filePath?: string;
  mediaId?: string;
  mediaBlobUrl?: string;
  svgContent?: string;
  
  // For text overlay
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  backgroundColor?: string;
  backgroundPadding?: number;
  backgroundRadius?: number;
  alignment?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineHeight?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  
  // For intro/outro/motion-graphics/elements
  title?: string;
  subtitle?: string;
  logoPath?: string;
  animationStyle?: 'fade' | 'zoom' | 'slide' | 'pop' | 'typewriter' | 'none';
  templateId?: string;
  motionParams?: Record<string, any>;
  effectType?: string;
  params?: Record<string, any>;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: number;
  duration: number; // total duration in seconds
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  version?: number;
  mediaCount?: number;
  saveState?: 'saved' | 'saving' | 'unsaved';
  thumbnailPath?: string;
  primaryMediaFilePath?: string;
  exportFolder?: string;
  lastExportedFile?: string;
  exportSettings?: Record<string, any>;
}

export interface EditorSessionState {
  playhead: number;
  zoomLevel: number;
  scrollLeft: number;
  scrollTop: number;
  selectedClipId: string | null;
  selectedAudioClipId: string | null;
  selectedCaptionId: string | null;
  selectedTransitionId: string | null;
  selectedOverlayId: string | null;
  activeSidebarTab: string;
  inspectorTab?: string;
  timelineHeight?: number;
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  updatedAt: string;
}

export interface CompoundClip {
  id: string;
  name: string;
  timelineStart: number;
  timelineDuration: number;
  trackIndex?: number;
  childClipIds: string[];
  childClipsSnapshot: VideoClip[];
}

export interface SourceMark {
  clipId: string;
  inPoint: number;
  outPoint: number;
}

export interface TimelineRegion {
  id: string;
  name: string;
  start: number;
  end: number;
  color: string;
  note?: string;
}

export interface TimelineBookmark {
  id: string;
  time: number;
  name: string;
  category: string;
  note?: string;
}

export interface SnapshotFrame {
  id: string;
  time: number;
  dataUrl: string;
  createdAt: string;
}

export interface ReferenceOverlay {
  id: string;
  dataUrl: string;
  opacity: number;
  scale: number;
  x: number;
  y: number;
  enabled: boolean;
}

export interface OnionSkinSettings {
  enabled: boolean;
  opacity: number;
  prevFrames: number;
  nextFrames: number;
}

export interface AudioRange {
  id: string;
  clipId: string;
  start: number;
  end: number;
}

export interface AudioBus {
  id: string;
  name: string;
  trackIds: number[];
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface EditSuggestion {
  id: string;
  type: 'long_shot' | 'gap' | 'short_clip' | 'peak' | 'silence' | 'duplicate';
  time: number;
  message: string;
  severity: 'info' | 'warn';
}

export interface WorkspacePreset {
  id: string;
  name: string;
  layout: string;
}

export interface ParentLink {
  childId: string;
  parentId: string;
}

export interface TransformGroup {
  id: string;
  clipIds: string[];
}

export interface ProjectData {
  metadata: ProjectMetadata;
  clips: VideoClip[];
  audioClips?: AudioClip[];
  captions: CaptionLine[];
  activeStyle: CaptionStyleConfig;
  overlays: OverlayElement[];
  transitions?: TransitionConfig[];
  footageLibrary?: VideoClip[];
  mediaRegistry?: MediaAsset[]; // P7 stable registry
  missingMedia?: string[]; // filePaths that failed to resolve
  videoTracksCount?: number;
  audioTracksCount?: number;
  markers?: import('./markers').TimelineMarker[];
  compoundClips?: CompoundClip[];
  adjustmentLayers?: OverlayElement[];
  sourceMarks?: SourceMark[];
  timelineRegions?: TimelineRegion[];
  bookmarks?: TimelineBookmark[];
  snapshots?: SnapshotFrame[];
  referenceOverlays?: ReferenceOverlay[];
  onionSkin?: OnionSkinSettings;
  audioRanges?: AudioRange[];
  audioBuses?: AudioBus[];
  editSuggestions?: EditSuggestion[];
  workspacePresets?: WorkspacePreset[];
  parentLinks?: ParentLink[];
  transformGroups?: TransformGroup[];
  globalStyleOverride?: Partial<CaptionStyleConfig>;
  adjustmentProfile?: string;
  editorSession?: EditorSessionState;
}
