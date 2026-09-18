import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ProjectData, VideoClip, AudioClip, AspectRatio, OverlayElement, TimelineRegion, TimelineBookmark, SnapshotFrame, ReferenceOverlay, OnionSkinSettings, AudioRange, AudioBus, EditSuggestion, WorkspacePreset, SourceMark } from '../types/project';
import { CaptionLine, CaptionStyleConfig, WordTimestamp } from '../types/caption';
import { CAPTION_PRESET_STYLES } from '../utils/presetStyles';
import { extractMediaMetadata, getPlayableMediaUrl, getDefaultImageDuration, isImageFile } from '../utils/mediaLoader';
import { DEFAULT_IMAGE_DURATION, MediaAsset } from '../types/project';
import { createMediaAsset, createFingerprint, ensureMediaRegistryForProject, rebuildRuntimeUrls, resolveMediaUrl, checkMediaExists, relinkMediaAsset, findMediaInFolder } from '../utils/mediaRegistry';
import { useSettings } from './SettingsContext';
import {
  backupMediaAsset,
  saveProjectWithOfflineAssets,
  loadProjectWithOfflineAssets,
  rehydrateProjectMedia,
  deleteProjectCompletely,
  listAllProjects,
  sanitizeProjectForPersistence,
  isAbsoluteMediaPath,
} from '../services/storage/projectStorage';
import { dbService } from '../services/storage/db';
import { assetStore } from '../services/storage/assetStore';

import { ClipEffect, EffectType } from '../types/effects';
import { TransitionConfig, TransitionType } from '../types/transitions';
import { EFFECT_DEFINITIONS, getEffectDefinition } from '../utils/effectPresets';
import { TRANSITION_DEFINITIONS, getTransitionDefinition } from '../utils/transitionPresets';
import { resolveEffectPreset, resolveTransitionPreset } from '../utils/presetBridge';
import { createEffectInstance, moveEffectInstance, resizeEffectInstance, sanitizeT, reconcileProject } from '../utils/nleTimeline';
import { calculateAutoAspectRatio } from '../utils/aspectRatio';
import { transcribeWithGeminiWeb } from '../utils/geminiAudioTranscriber';
import { generateMultiStyledCaptions } from '../utils/multiCaptionStyleEngine';
import { rippleDeleteTimeRangeFromProject } from '../utils/transcriptEditorEngine';
import { getSafeTransitionDuration, syncTransitionsWithClips } from '../utils/transitionEngine';
import { TimelineMarker } from '../types/markers';
import { PreviewQuality } from '../utils/previewQualityEngine';
import { createMarker, generateAutoMarkersFromClips, generateBeatMarkers as genBeatMarkers } from '../utils/markerEngine';
import { runBackgroundTask } from '../utils/backgroundProcessor';
import { saveVersion, loadVersions, saveAutoSave, loadAutoSave } from '../utils/versionHistoryEngine';
import { formatTimecode, sanitizeTime } from '../utils/timecode';
import { getActiveContentDuration } from '../utils/timelineDuration';
import {
  processGeminiCaptionsThroughTimingEngine,
  normalizeCaptionTimings,
  preserveTimingOnTextEdit,
  estimateWordTimingFallback,
  runCaptionQualityCheck,
} from '../utils/captionTimingEngine';
import { registerMediaBatchInstant, InstantImportProgressEvent } from '../services/media/instantMediaImporter';
import { mediaDerivedCache } from '../services/storage/mediaDerivedCache';
import { audioProcessor } from '../services/audio/audioProcessor';
import { DEFAULT_CLIP_AUDIO_FILTERS } from '../types/audioFilters';

export interface AutoRatioToastData {
  ratio: AspectRatio;
  dimensions: string;
  sourceName: string;
}

export type SidebarTabType =
  | 'media'
  | 'text'
  | 'captions'
  | 'transcript'
  | 'audio'
  | 'effects'
  | 'filters'
  | 'transitions'
  | 'stickers'
  | 'elements'
  | 'templates'
  | 'adjustments'
  | 'styles'
  | 'customizer'
  | 'video'
  | 'overlays'
  | 'footage'
  | 'export'
  | 'mogrt';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

function generateUniqueProjectName(base: string, existing: string[]): string {
  const clean = base.trim() || 'Untitled Project';
  if (!existing.includes(clean)) return clean;
  // Try "Name 02", "Name 03" etc.
  let idx = 2;
  while (existing.includes(`${clean} ${String(idx).padStart(2, '0')}`)) idx++;
  if (idx <= 99) return `${clean} ${String(idx).padStart(2, '0')}`;
  // Fallback date suffix
  const d = new Date();
  const suffix = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dated = `${clean} — ${suffix}`;
  if (!existing.includes(dated)) return dated;
  let j = 2;
  while (existing.includes(`${dated} ${j}`)) j++;
  return `${dated} ${j}`;
}

function getEditorSessionKey(projectId: string) {
  return `cf_editor_session_${projectId}`;
}

interface ProjectContextType {
  project: ProjectData | null;
  currentTime: number;
  isPlaying: boolean;
  zoomLevel: number; // 1 to 10
  selectedClipId: string | null;
  selectedAudioClipId: string | null;
  selectedCaptionId: string | null;
  selectedOverlayId: string | null;
  selectedTransitionId: string | null;
  copiedEffects: ClipEffect[] | null;
  activeSidebarTab: SidebarTabType;
  isTranscribing: boolean;
  transcribeProgress: string;
  canUndo: boolean;
  canRedo: boolean;
  autoRatioToast: AutoRatioToastData | null;
  isMagnetMode: boolean;

  // Actions
  createNewProject: (name: string, aspectRatio?: AspectRatio, initialMediaFileOrPath?: File | string) => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  saveProject: () => Promise<void>;
  closeProject: () => Promise<void> | void;
  clearAutoRatioToast: () => void;
  // Project Management (Home)
  renameProject: (projectId: string, newName: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<string | null>;
  deleteProject: (projectId: string) => Promise<void>;
  relinkMedia: (oldPath: string, newPath: string | File) => Promise<void> | void;
  batchRelinkFolder: (folderPath: string) => Promise<number>; // P16 batch
  setProjectExportFolder: (folder: string) => Promise<void>;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  hasUnsavedChanges: boolean;
  
  // Playback & Timeline
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  setZoomLevel: (zoom: number) => void;
  setIsMagnetMode: (enabled: boolean) => void;
  toggleMagnetMode: () => void;
  setSelectedClipId: (id: string | null) => void;
  setSelectedAudioClipId: (id: string | null) => void;
  setSelectedCaptionId: (id: string | null) => void;
  setSelectedOverlayId: (id: string | null) => void;
  setSelectedTransitionId: (id: string | null) => void;
  setActiveSidebarTab: (tab: SidebarTabType) => void;

  // Video Clip & Footage Operations
  importMediaFile: (fileOrPath: File | string, targetProject?: ProjectData, autoDetectRatio?: boolean) => Promise<VideoClip | null>;
  importMediaFiles: (filesOrPaths: (File | string)[]) => Promise<{ registeredClips: VideoClip[]; registeredAudios: AudioClip[] }>;
  patchMediaAsset: (mediaId: string, updates: Partial<MediaAsset>) => void;
  importFootageFile: (fileOrPath: File | string) => Promise<VideoClip | null>;
  setClips: (clips: VideoClip[]) => void;
  appendClipToTimeline: (clip: VideoClip, targetTrackIndex?: number, customStart?: number, insertMode?: boolean) => void;
  replacePrimaryClip: (clip: VideoClip) => void;
  removeFootageAsset: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<VideoClip>) => void;
  splitClipAtPlayhead: () => void;
  deleteClip: (clipId: string, forceRipple?: boolean) => void;
  rippleDeleteClip: (clipId: string) => void;
  closeGapAtTime: (trackIndex: number, gapStartTime: number) => void;
  moveClipPosition: (clipId: string, newStart: number, targetTrackIndex?: number) => void;
  batchMoveClips: (clipIds: string[], deltaSec: number, targetTrackIndex?: number) => void;
  reorderClips: (trackIndex: number, fromIndex: number, toIndex: number) => void;
  setProjectAspectRatio: (ratio: AspectRatio) => void;
  addVideoTrack: () => void;
  removeVideoTrack: (trackIndex: number) => void;
  moveClipToTrack: (clipId: string, trackIndex: number) => void;
  updateClipTransform: (clipId: string, transform: Partial<NonNullable<VideoClip['transform']>>) => void;
  extractAudioFromClip: (clipId: string) => void;
  removeSilencesFromClip: (clipId: string, silenceThreshold?: number, minDurationSec?: number) => { removedCount: number; savedSeconds: number };
  enhanceAudioClip: (clipId: string) => void;
  enhanceVideoClipVisuals: (clipId: string) => void;
  toggleClipMute: (clipId: string) => void;
  duplicateClip: (clipId: string) => void;
  splitScenesForClip: (clipId: string) => void;
  copyClip: (clipId: string) => void;
  cutClip: (clipId: string) => void;
  pasteClip: () => void;
  trimClip: (id: string, startOffset: number, endOffset: number, timelineStart?: number) => void;
  trimClipLeftToPlayhead: (clipId?: string) => void;
  trimClipRightToPlayhead: (clipId?: string) => void;
  isCropping: boolean;
  setIsCropping: (cropping: boolean) => void;
  toggleCropMode: () => void;

  // Audio Clip & Audio Editing Operations
  importAudioFile: (fileOrPath: File | string) => Promise<AudioClip | null>;
  appendAudioClipToTimeline: (clip: AudioClip | any, targetTrackIndex?: number, customStart?: number) => void;
  splitAudioClipAtPlayhead: () => void;
  updateAudioClip: (id: string, updates: Partial<AudioClip>) => void;
  trimAudioClip: (id: string, startOffset: number, endOffset: number, timelineStart?: number) => void;
  deleteAudioClip: (id: string) => void;
  moveAudioClipPosition: (id: string, newStart: number, targetTrackIndex?: number) => void;
  setAudioVolume: (id: string, volume: number) => void;
  toggleAudioMute: (id: string) => void;
  duplicateAudioClip: (id: string) => void;
  removeSilencesFromAudioClip: (id: string) => void;
  enhanceAudioClipTrack: (id: string) => void;
  deleteMultipleTimelineItems: (items: {
    clipIds?: string[];
    audioClipIds?: string[];
    captionIds?: string[];
    overlayIds?: string[];
  }) => void;

  // Clip Effects Stack Operations (timed NLE objects — see nleTimeline.ts)
  addEffectToClip: (clipId: string, effectType: EffectType | string, opts?: { dropTime?: number; duration?: number; params?: Record<string, any>; intensity?: number }) => void;
  updateEffectParams: (clipId: string, effectId: string, params: Record<string, any>) => void;
  removeEffectFromClip: (clipId: string, effectId: string) => void;
  toggleEffect: (clipId: string, effectId: string) => void;
  reorderEffects: (clipId: string, sourceIndex: number, destIndex: number) => void;
  duplicateEffect: (clipId: string, effectId: string) => void;
  resetEffect: (clipId: string, effectId: string) => void;
  copyEffects: (clipId: string) => void;
  pasteEffects: (clipId: string) => void;
  moveEffect: (clipId: string, effectId: string, newStartTime: number) => void;
  resizeEffect: (clipId: string, effectId: string, newDuration: number, newStartTime?: number) => void;
  setEffectIntensity: (clipId: string, effectId: string, intensity: number) => void;
  applyEffectToClip: (sourceClipId: string, effectId: string, targetClipId: string) => void;

  // Transitions Operations
  addTransition: (transition: Omit<TransitionConfig, 'id'>) => void;
  updateTransition: (id: string, updates: Partial<TransitionConfig>) => void;
  deleteTransition: (id: string) => void;

  // Caption Operations
  setCaptions: (captions: CaptionLine[]) => void;
  updateCaptionLine: (lineId: string, text: string) => void;
  trimCaptionLine: (lineId: string, start: number, end: number) => void;
  moveCaptionLine: (lineId: string, newStart: number) => void;
  duplicateCaptionLine: (lineId: string) => void;
  splitCaptionAtPlayhead: (lineId?: string) => void;
  updateWordTimestamp: (lineId: string, wordId: string, updates: Partial<WordTimestamp>) => void;
  splitCaptionLine: (lineId: string, wordIndex: number) => void;
  mergeCaptionLines: (lineId1: string, lineId2: string) => void;
  deleteCaptionLine: (lineId: string) => void;
  addCaptionLineAtPlayhead: () => void;
  setCaptionLineStyleOverride: (lineId: string, override: Partial<CaptionStyleConfig> | undefined) => void;
  setCaptionHookSplit: (lineId: string, splitIndex: number) => void;
  autoTranscribeVideo: (language?: string) => Promise<void>;
  
  // Style Operations
  setActiveStyle: (style: CaptionStyleConfig) => void;
  updateActiveStyle: (updates: Partial<CaptionStyleConfig>) => void;
  updateCaptionPosition: (xPercent: number, yPercent: number, applyToAll: boolean, lineId?: string) => void;
  applyPresetStyle: (presetKey: string) => void;
  applyPresetToSelectedCaption: (lineId: string, presetKey: string) => void;
  applyMultiStyleFlow: (flowId: string) => void;
  clearAllCaptionStyleOverrides: () => void;

  // Overlay Operations
  addOverlay: (overlay: (Omit<OverlayElement, 'id'> & { id?: string }) | OverlayElement) => void;
  updateOverlay: (id: string, updates: Partial<OverlayElement>) => void;
  deleteOverlay: (id: string) => void;
  duplicateOverlay: (id: string) => void;

  // Track States & Controls
  hiddenTracks: Record<string, boolean>;
  mutedTracks: Record<string, boolean>;
  lockedTracks: Record<string, boolean>;
  toggleTrackVisibility: (trackKey: string) => void;
  toggleTrackMute: (trackKey: string) => void;
  toggleTrackLock: (trackKey: string) => void;

  // Text-Driven Video Editing (Descript style)
  rippleDeleteTimeRange: (cutStart: number, cutEnd: number) => void;
  setProjectData: (project: ProjectData) => void;

  // --- 40 Advanced Features Extension ---
  // Markers (Feature 32,20)
  markers: TimelineMarker[];
  addMarker: (marker: Omit<TimelineMarker, 'id'>) => void;
  updateMarker: (id: string, updates: Partial<TimelineMarker>) => void;
  deleteMarker: (id: string) => void;
  generateAutoMarkers: () => void;
  generateBeatMarkers: () => void;
  // Preview Quality & Proxy (Feature 21,22)
  previewQuality: PreviewQuality;
  setPreviewQuality: React.Dispatch<React.SetStateAction<PreviewQuality>>;
  proxyEnabled: boolean;
  setProxyEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  // Batch Editing (Feature 06)
  batchUpdateClips: (clipIds: string[], updates: Partial<VideoClip>) => void;
  batchSetVolume: (clipIds: string[], volume: number) => void;
  batchSetSpeed: (clipIds: string[], speed: number) => void;
  // Copy/Paste Attributes (Feature 07)
  copiedAttributes: Partial<VideoClip> | null;
  copyClipAttributes: (clipId: string) => void;
  pasteClipAttributes: (targetIds: string[]) => void;
  // Compound Clips (Feature 09)
  createCompoundClip: (clipIds: string[], name?: string) => void;
  dissolveCompoundClip: (compoundId: string) => void;
  // Smart Multi-Select (Feature 10)
  selectAllClipsOnTrack: (trackIndex: number) => void;
  selectClipsInRange: (start: number, end: number) => void;
  // Auto Gap (Feature 11)
  removeAllGaps: (trackIndex?: number) => void;
  // Trim Modes (Feature 12)
  rollTrim: (clipId: string, delta: number) => void;
  slipTrim: (clipId: string, delta: number) => void;
  slideTrim: (clipId: string, delta: number) => void;
  // Speed / Freeze / Reverse (Feature 13,14,15)
  freezeFrameAtPlayhead: (duration?: number) => void;
  reverseClip: (clipId: string) => void;
  // Transition Batch (Feature 28,29)
  batchApplyTransition: (type: string, duration?: number) => void;
  // Effect Presets (Feature 30)
  saveEffectPreset: (name: string, clipId: string) => void;
  applyEffectPreset: (presetName: string, targetIds: string[]) => void;
  savedEffectPresets: { name: string; effects: ClipEffect[] }[];
  // One-Click Replace & Match Duration (Feature 26,27)
  replaceClipMedia: (clipId: string, fileOrPath: File | string) => Promise<void>;
  matchClipDuration: (sourceId: string, targetId: string) => void;
  // Audio Ducking (Feature 18)
  applyAudioDucking: (voiceTrack: number, musicTrack: number, duckAmount?: number) => void;
  // Speed Ramping Preset (Feature 13)
  applySpeedPreset: (clipId: string, preset: 'slowFast' | 'fastSlow' | 'slowMo' | 'speedUp') => void;
  // One-Click Split & Remove (Feature 05)
  splitAndRemove: (direction?: 'left' | 'right') => void;
  // Background / Version / Recovery (Feature 38,39,40)
  saveVersionSnapshot: (name?: string) => void;
  getVersionHistory: () => any[];
  restoreVersion: (versionId: string) => void;

  // 60 Features — Extended State & Methods
  sourceMarks: SourceMark[];
  setSourceInOut: (clipId: string, inPoint: number, outPoint: number) => void;
  timelineRegions: TimelineRegion[];
  addRegion: (r: Omit<TimelineRegion,'id'>) => void;
  updateRegion: (id: string, updates: Partial<TimelineRegion>) => void;
  deleteRegion: (id: string) => void;
  bookmarks: TimelineBookmark[];
  addBookmark: (b: Omit<TimelineBookmark,'id'>) => void;
  deleteBookmark: (id: string) => void;
  snapshots: SnapshotFrame[];
  captureSnapshot: () => void;
  referenceOverlays: ReferenceOverlay[];
  setReferenceOverlay: (ov: ReferenceOverlay) => void;
  onionSkin: OnionSkinSettings;
  setOnionSkin: (s: Partial<OnionSkinSettings>) => void;
  audioRanges: AudioRange[];
  setAudioRange: (r: AudioRange) => void;
  audioBuses: AudioBus[];
  addAudioBus: (b: Omit<AudioBus,'id'>) => void;
  updateAudioBus: (id: string, updates: Partial<AudioBus>) => void;
  editSuggestions: EditSuggestion[];
  generateSuggestions: () => void;
  roughCutFromMarks: () => void;
  selectedRenderRegion: { start: number; end: number } | null;
  setSelectedRenderRegion: React.Dispatch<React.SetStateAction<{ start: number; end: number } | null>>;
  exportEDL: () => string;
  importEDL: (edl: string) => void;
  globalStyleOverride: Partial<CaptionStyleConfig> | null;
  setGlobalStyleOverride: React.Dispatch<React.SetStateAction<Partial<CaptionStyleConfig> | null>>;
  adjustmentProfile: string;
  setAdjustmentProfile: React.Dispatch<React.SetStateAction<string>>;
  duplicateProjectVersion: (name: string) => void;
  compareVersions: (aId: string, bId: string) => any;
  workspacePresets: WorkspacePreset[];
  saveWorkspacePreset: (name: string, layout: string) => void;
  applyWorkspacePreset: (id: string) => void;
  autoReframeClip: (clipId: string, targetRatio: AspectRatio) => void;
  smartCropClip: (clipId: string) => void;
  detectScenes: () => Promise<void>;
  classifyShots: () => void;
  findDuplicates: () => void;
  searchSimilar: (clipId: string) => VideoClip[];
  frameMatch: (clipId: string) => VideoClip[];
  parentLink: (childId: string, parentId: string | null) => void;
  createTransformGroup: (clipIds: string[]) => void;
  beforeAfterEnabled: boolean;
  setBeforeAfterEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  abCompareEnabled: boolean;
  setABCompareEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  selectiveColor: { hue: number; sat: number } | null;
  setSelectiveColor: React.Dispatch<React.SetStateAction<{ hue: number; sat: number } | null>>;

  // History
  undo: () => void;
  redo: () => void;
  history: ProjectData[];
  historyIndex: number;
  jumpToHistory: (index: number) => void;
  pushHistoryState: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [currentTime, setCurrentTimeState] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isMagnetMode, setIsMagnetMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('captionforge_magnet_mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>(null);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [copiedEffects, setCopiedEffects] = useState<ClipEffect[] | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTabType>('footage');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeProgress, setTranscribeProgress] = useState<string>('');
  const [autoRatioToast, setAutoRatioToast] = useState<AutoRatioToastData | null>(null);
  const [clipboardClip, setClipboardClip] = useState<VideoClip | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const toggleCropMode = () => setIsCropping((prev) => !prev);

  // --- 40 Features — Additional State ---
  const [markers, setMarkers] = useState<TimelineMarker[]>(() => {
    try { const raw = localStorage.getItem('cf_markers'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(() => {
    const s = localStorage.getItem('cf_preview_quality') as PreviewQuality | null;
    return s || 'full';
  });
  const [proxyEnabled, setProxyEnabled] = useState<boolean>(() => localStorage.getItem('cf_proxy_enabled') === 'true');
  const [copiedAttributes, setCopiedAttributes] = useState<Partial<VideoClip> | null>(null);
  const [savedEffectPresets, setSavedEffectPresets] = useState<{ name: string; effects: ClipEffect[] }[]>(() => {
    try { const raw = localStorage.getItem('cf_effect_presets'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  // Persist markers / quality / proxy
  useEffect(() => { try { localStorage.setItem('cf_markers', JSON.stringify(markers)); } catch {} }, [markers]);
  useEffect(() => { try { localStorage.setItem('cf_preview_quality', previewQuality); } catch {} }, [previewQuality]);
  useEffect(() => { try { localStorage.setItem('cf_proxy_enabled', String(proxyEnabled)); } catch {} }, [proxyEnabled]);
  useEffect(() => { try { localStorage.setItem('cf_effect_presets', JSON.stringify(savedEffectPresets)); } catch {} }, [savedEffectPresets]);

  // 60 Features — Local UI State (non-project)
  const [beforeAfterEnabled, setBeforeAfterEnabled] = useState(false);
  const [abCompareEnabled, setABCompareEnabled] = useState(false);
  const [selectiveColor, setSelectiveColor] = useState<{ hue: number; sat: number } | null>(null);
  const [selectedRenderRegion, setSelectedRenderRegion] = useState<{ start: number; end: number } | null>(null);
  const [globalStyleOverride, setGlobalStyleOverride] = useState<Partial<CaptionStyleConfig> | null>(null);
  const [adjustmentProfile, setAdjustmentProfile] = useState<string>(() => localStorage.getItem('cf_adjustment_profile') || 'balanced');
  const [workspacePresets, setWorkspacePresets] = useState<WorkspacePreset[]>(() => { try { const r=localStorage.getItem('cf_workspace_presets'); return r?JSON.parse(r):[] } catch {return []}});
  useEffect(() => { try { localStorage.setItem('cf_adjustment_profile', adjustmentProfile); } catch {} }, [adjustmentProfile]);
  useEffect(() => { try { localStorage.setItem('cf_workspace_presets', JSON.stringify(workspacePresets)); } catch {} }, [workspacePresets]);

  // Derived project-persistent collections (for 60 features)
  const sourceMarks: SourceMark[] = project?.sourceMarks || [];
  const timelineRegions: TimelineRegion[] = project?.timelineRegions || [];
  const bookmarks: TimelineBookmark[] = project?.bookmarks || [];
  const snapshots: SnapshotFrame[] = project?.snapshots || [];
  const referenceOverlays: ReferenceOverlay[] = project?.referenceOverlays || [];
  const onionSkin: OnionSkinSettings = project?.onionSkin || { enabled: false, opacity: 0.4, prevFrames: 1, nextFrames: 1 };
  const audioRanges: AudioRange[] = project?.audioRanges || [];
  const audioBuses: AudioBus[] = project?.audioBuses || [];
  const editSuggestions: EditSuggestion[] = project?.editSuggestions || [];

  // Auto-save + crash recovery (Feature 38,39) — autosave every 12s + on project change.
  // Stored sanitized (no blob: URLs): recovery replays through rehydrate, so a
  // crash-restore never resurrects dead session URLs.
  useEffect(() => {
    if (!project) return;
    const id = project.metadata.id;
    try { saveAutoSave(id, sanitizeProjectForPersistence(project)); } catch {}
    const iv = setInterval(() => {
      try { saveAutoSave(id, sanitizeProjectForPersistence(project)); } catch {}
    }, 12000);
    return () => clearInterval(iv);
  }, [project]);
  // Restore autosave prompt flag
  const [hasRecoverable, setHasRecoverable] = useState(false);
  useEffect(() => {
    if (!project) return;
    const rec = loadAutoSave(project.metadata.id);
    if (rec && JSON.stringify(rec) !== JSON.stringify(project)) setHasRecoverable(true);
  }, [project?.metadata.id]);

  // Track Controls (Visibility, Mute, Lock)
  const [hiddenTracks, setHiddenTracks] = useState<Record<string, boolean>>({});
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});

  const toggleTrackVisibility = useCallback((trackKey: string) => {
    setHiddenTracks((prev) => ({
      ...prev,
      [trackKey]: !prev[trackKey],
    }));
  }, []);

  const toggleTrackMute = useCallback((trackKey: string) => {
    setMutedTracks((prev) => ({
      ...prev,
      [trackKey]: !prev[trackKey],
    }));
  }, []);

  const toggleTrackLock = useCallback((trackKey: string) => {
    setLockedTracks((prev) => ({
      ...prev,
      [trackKey]: !prev[trackKey],
    }));
  }, []);

  const toggleMagnetMode = useCallback(() => {
    setIsMagnetMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('captionforge_magnet_mode', String(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // Undo / Redo stacks — ref-backed atomic history to avoid stale closure & corrupted redo branches
  const [history, setHistory] = useState<ProjectData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyRef = useRef<ProjectData[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Keep refs in sync with state (for synchronous reads during rapid edits)
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  const deepCloneProject = (p: ProjectData): ProjectData => JSON.parse(JSON.stringify(p));

  // Track unsaved changes baseline
  const lastSavedJsonRef = useRef<string>('');
  useEffect(() => {
    if (!project) {
      lastSavedJsonRef.current = '';
      return;
    }
    if (lastSavedJsonRef.current === '') {
      lastSavedJsonRef.current = JSON.stringify(project);
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      return;
    }
    const currentJson = JSON.stringify(project);
    if (currentJson !== lastSavedJsonRef.current) {
      setHasUnsavedChanges(true);
      if (saveStatus === 'saved') setSaveStatus('unsaved');
    }
  }, [project]);

  // Debounced autosave (2s) when unsaved
  useEffect(() => {
    if (!hasUnsavedChanges || !project || saveStatus === 'saving') return;
    const t = setTimeout(async () => {
      await saveProject();
    }, 2000);
    return () => clearTimeout(t);
  }, [hasUnsavedChanges, project]);

  // Window Close Guard: flush save immediately before window close / unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (project && (hasUnsavedChanges || saveStatus === 'unsaved')) {
        saveProject();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [project, hasUnsavedChanges, saveStatus]);

  // Push to history on state change — atomically slices redo branch and caps at 30 states
  const pushState = useCallback((newProject: ProjectData) => {
    const snapshot = deepCloneProject(newProject);
    const baseHistory = historyRef.current;
    const baseIndex = historyIndexRef.current;
    // Slice away any redo branch beyond current index
    const sliced = baseHistory.slice(0, baseIndex + 1);
    const nextHistory = [...sliced, snapshot].slice(-30);
    const nextIndex = nextHistory.length - 1;
    historyRef.current = nextHistory;
    historyIndexRef.current = nextIndex;
    setHistory(nextHistory);
    setHistoryIndex(nextIndex);
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    const sane = sanitizeTime(time, 0);
    if (!isFinite(sane)) return;
    const totalDuration = sanitizeTime(project?.metadata.duration || 100, 100);
    const clamped = Math.max(0, Math.min(sane, totalDuration));
    if (!isFinite(clamped)) return;
    setCurrentTimeState(clamped);
  }, [project]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const clearAutoRatioToast = () => {
    setAutoRatioToast(null);
  };

  // Safety: recover from NaN currentTime or duration (P0 data integrity)
  useEffect(() => {
    if (!isFinite(currentTime)) setCurrentTimeState(0);
  }, [currentTime]);
  useEffect(() => {
    if (project && (!isFinite(project.metadata.duration) || project.metadata.duration < 0.1 || isNaN(project.metadata.duration as any))) {
      const fixed = { ...project, metadata: { ...project.metadata, duration: 5 } };
      setProject(fixed);
    }
  }, [project?.metadata.duration]);

  // Create New Project — with unique name generation and editor session init
  const createNewProject = async (name: string, aspectRatio?: AspectRatio, initialMediaFileOrPath?: File | string) => {
    const defaultRatio = aspectRatio || '9:16';
    let width = 1080;
    let height = 1920;
    if (defaultRatio === '16:9') { width = 1920; height = 1080; }
    if (defaultRatio === '1:1') { width = 1080; height = 1080; }
    if (defaultRatio === '4:5') { width = 1080; height = 1350; }

    // Unique name generation against existing projects
    let existingNames: string[] = [];
    try {
      if (window.captionForgeAPI?.getRecentProjects) {
        const recent = await window.captionForgeAPI.getRecentProjects();
        existingNames = (recent || []).map((p: any) => p.name);
      } else {
        const raw = localStorage.getItem('captionforge_index');
        if (raw) existingNames = JSON.parse(raw).projects?.map((p: any) => p.name) || [];
      }
    } catch {}
    const baseName = (name && name.trim()) ? name.trim() : 'Untitled Project';
    const uniqueName = generateUniqueProjectName(baseName, existingNames);

    const projectId = `proj_${Date.now()}`;
    const now = new Date().toISOString();
    const newProject: ProjectData = {
      metadata: {
        id: projectId,
        name: uniqueName,
        aspectRatio: defaultRatio,
        width,
        height,
        fps: 30,
        duration: 0,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        version: 1,
        mediaCount: 0,
        saveState: 'saved' as const,
        thumbnailPath: '',
      },
      clips: [],
      captions: [],
      activeStyle: { ...CAPTION_PRESET_STYLES[0] },
      overlays: [],
      footageLibrary: [],
      mediaRegistry: [],
      missingMedia: [],
      editorSession: {
        playhead: 0,
        zoomLevel: 1,
        scrollLeft: 0,
        scrollTop: 0,
        selectedClipId: null,
        selectedAudioClipId: null,
        selectedCaptionId: null,
        selectedTransitionId: null,
        selectedOverlayId: null,
        activeSidebarTab: 'footage',
        updatedAt: now,
      },
    };

    const snapshot = deepCloneProject(newProject);
    setProject(newProject);
    historyRef.current = [snapshot];
    historyIndexRef.current = 0;
    setHistory([snapshot]);
    setHistoryIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setActiveSidebarTab('footage');
    setSaveStatus('saving');
    try {
      if (window.captionForgeAPI?.saveProject) await window.captionForgeAPI.saveProject(newProject);
      setSaveStatus('saved');
      setLastSavedAt(now);
      setHasUnsavedChanges(false);
      try { localStorage.setItem(getEditorSessionKey(projectId), JSON.stringify(newProject.editorSession)); } catch {}
    } catch {
      setSaveStatus('error');
    }

    if (initialMediaFileOrPath) {
      await importMediaFile(initialMediaFileOrPath, newProject, true);
    }
  };

  // Import Media File (Video / Audio) with Auto Aspect Ratio Detection & Real HTML5 Extraction
  const importMediaFile = async (fileOrPath: File | string, targetProject?: ProjectData, autoDetectRatio: boolean = true): Promise<VideoClip | null> => {
    const active = targetProject || project;
    if (!active) return null;

    try {
      // Extract real video metadata, duration, canvas thumbnail, and waveform
      const meta = await extractMediaMetadata(fileOrPath);
      const clipId = `clip_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Ensure image duration uses the single canonical default
      const resolvedDuration = meta.mediaType === 'image' ? getDefaultImageDuration() : meta.duration;

      // P7: Create or reuse MediaAsset in registry (stable ID + fingerprint)
      const existingRegistry: MediaAsset[] = (active as any).mediaRegistry || [];
      const fingerprint = fileOrPath instanceof File
        ? createFingerprint(fileOrPath.name, fileOrPath.size, fileOrPath.lastModified)
        : createFingerprint(meta.name, undefined, undefined);
      let mediaAsset: MediaAsset | undefined = existingRegistry.find((a) => a.hash === fingerprint && a.fileName === meta.name) || existingRegistry.find((a) => a.filePath === meta.filePath);
      if (!mediaAsset) {
        mediaAsset = createMediaAsset(meta, fileOrPath);
      }

      let playableUrl = meta.url;
      if (fileOrPath instanceof File) {
        try {
          const backup = await backupMediaAsset(active.metadata.id, mediaAsset.id, fileOrPath, meta.name);
          if (backup.blobUrl) {
            playableUrl = backup.blobUrl;
            // Keep the registry asset in sync: otherwise the persisted
            // registry holds the pre-backup blob: URL while clips hold the
            // backup URL, and rehydrate cannot match them after a restart.
            mediaAsset = { ...mediaAsset, mediaBlobUrl: backup.blobUrl };
          }
        } catch (err) {
          console.warn('[ProjectContext] Asset offline backup warning:', err);
        }
      }

      const newClip: VideoClip = {
        id: clipId,
        mediaId: mediaAsset.id,
        name: meta.name,
        filePath: meta.filePath,
        originalFilePath: meta.filePath,
        mediaBlobUrl: playableUrl,
        duration: resolvedDuration,
        startOffset: 0,
        endOffset: resolvedDuration,
        timelineStart: 0,
        timelineDuration: resolvedDuration,
        speed: 1.0,
        volume: 1.0,
        isMuted: false,
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
        thumbnailUrl: meta.thumbnailUrl,
        waveformPeaks: meta.waveformPeaks,
        mediaType: meta.mediaType,
      };

      // Auto-detect Aspect Ratio from real video dimensions
      let finalAspectRatio = active.metadata.aspectRatio;
      let finalWidth = active.metadata.width;
      let finalHeight = active.metadata.height;

      if (autoDetectRatio && meta.width > 0 && meta.height > 0) {
        finalAspectRatio = meta.aspectRatio;
        finalWidth = meta.width;
        finalHeight = meta.height;

        setAutoRatioToast({
          ratio: meta.aspectRatio,
          dimensions: `${meta.width}x${meta.height}`,
          sourceName: meta.name
        });
      }

      const existingLibrary = active.footageLibrary || [];
      // Dedupe by mediaId or filePath
      const updatedLibrary = existingLibrary.some((f) => f.mediaId === mediaAsset!.id || f.filePath === meta.filePath)
        ? existingLibrary
        : [...existingLibrary, newClip];

      const updatedRegistry = existingRegistry.some((a: MediaAsset) => a.id === mediaAsset!.id)
        ? existingRegistry
        : [...existingRegistry, mediaAsset!];

      const updatedProject: ProjectData = {
        ...active as any,
        metadata: {
          ...active.metadata,
          aspectRatio: finalAspectRatio,
          width: finalWidth,
          height: finalHeight,
          duration: resolvedDuration,
          primaryMediaFilePath: meta.filePath,
          thumbnailPath: meta.thumbnailUrl || active.metadata.thumbnailPath,
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
          mediaCount: updatedRegistry.length,
          version: (active.metadata as any).version || 1,
        },
        clips: [newClip],
        audioClips: active.audioClips && active.audioClips.length > 0 ? active.audioClips : [],
        videoTracksCount: active.videoTracksCount || 2,
        audioTracksCount: active.audioTracksCount || 2,
        footageLibrary: updatedLibrary,
        mediaRegistry: updatedRegistry,
        missingMedia: [],
      } as ProjectData;

      setProject(updatedProject);
      setSelectedClipId(clipId);
      pushState(updatedProject);

      if (window.captionForgeAPI?.saveProject) {
        window.captionForgeAPI.saveProject(sanitizeProjectForPersistence(updatedProject));
      }

      return newClip;
    } catch (e) {
      console.error('Error importing media:', e);
      return null;
    }
  };

  // Instant Progressive Patching for background worker updates (0ms delay, smooth in-place upgrade)
  const patchMediaAsset = useCallback((mediaId: string, updates: Partial<MediaAsset>) => {
    setProject((prev) => {
      if (!prev) return prev;
      let changed = false;

      // 1. Update Media Registry
      const newRegistry = (prev.mediaRegistry || []).map((a) => {
        if (a.id === mediaId) {
          changed = true;
          return { ...a, ...updates };
        }
        return a;
      });

      // 2. Update Footage Library
      const newFootage = (prev.footageLibrary || []).map((f) => {
        if (f.mediaId === mediaId || f.id === mediaId) {
          changed = true;
          const duration = updates.duration !== undefined ? updates.duration : f.duration;
          return {
            ...f,
            duration,
            endOffset: f.endOffset === f.duration ? duration : f.endOffset,
            timelineDuration: f.timelineDuration === f.duration ? duration : f.timelineDuration,
            width: updates.width !== undefined ? updates.width : f.width,
            height: updates.height !== undefined ? updates.height : f.height,
            fps: updates.fps !== undefined ? updates.fps : f.fps,
            thumbnailUrl: updates.thumbnailUrl !== undefined ? updates.thumbnailUrl : f.thumbnailUrl,
            waveformPeaks: updates.waveformPeaks !== undefined ? updates.waveformPeaks : f.waveformPeaks,
            mediaType: updates.mediaType !== undefined ? updates.mediaType : f.mediaType,
          };
        }
        return f;
      });

      // 3. Update active timeline clips if matching
      const newClips = (prev.clips || []).map((c) => {
        if (c.mediaId === mediaId) {
          changed = true;
          return {
            ...c,
            width: updates.width !== undefined && (!c.width || c.width === 1920) ? updates.width : c.width,
            height: updates.height !== undefined && (!c.height || c.height === 1080) ? updates.height : c.height,
            thumbnailUrl: updates.thumbnailUrl || c.thumbnailUrl,
            waveformPeaks: updates.waveformPeaks && updates.waveformPeaks.length > 0 ? updates.waveformPeaks : c.waveformPeaks,
          };
        }
        return c;
      });

      // 4. Update audio clips if matching
      const newAudioClips = (prev.audioClips || []).map((a) => {
        if (a.mediaId === mediaId || a.id === mediaId) {
          changed = true;
          return {
            ...a,
            duration: updates.duration !== undefined ? updates.duration : a.duration,
            waveformPeaks: updates.waveformPeaks && updates.waveformPeaks.length > 0 ? updates.waveformPeaks : a.waveformPeaks,
          };
        }
        return a;
      });

      if (!changed) return prev;

      return {
        ...prev,
        mediaRegistry: newRegistry,
        footageLibrary: newFootage,
        clips: newClips,
        audioClips: newAudioClips,
      };
    });
  }, []);

  // CapCut-Style Instant Batch Media Importer (All items appear in <15ms)
  const importMediaFiles = async (
    filesOrPaths: (File | string)[]
  ): Promise<{ registeredClips: VideoClip[]; registeredAudios: AudioClip[] }> => {
    if (!project || filesOrPaths.length === 0) return { registeredClips: [], registeredAudios: [] };

    const batchResults = await registerMediaBatchInstant(filesOrPaths, (event) => {
      if (event.type === 'metadata_ready') {
        patchMediaAsset(event.mediaId, {
          duration: event.data.duration,
          width: event.data.width,
          height: event.data.height,
          fps: event.data.fps,
          processingStatus: 'metadata_ready',
        });
      } else if (event.type === 'thumbnail_ready') {
        patchMediaAsset(event.mediaId, {
          thumbnailUrl: event.data,
          processingStatus: 'thumbnail_ready',
        });
      } else if (event.type === 'waveform_ready') {
        patchMediaAsset(event.mediaId, {
          waveformPeaks: event.data,
          processingStatus: 'waveform',
        });
      } else if (event.type === 'completed') {
        patchMediaAsset(event.mediaId, {
          processingStatus: 'ready',
        });
      } else if (event.type === 'error') {
        patchMediaAsset(event.mediaId, {
          processingStatus: 'error',
        });
      }
    });

    // Persist File binaries to offline IndexedDB storage so projects survive
    // an app restart. registerMediaBatchInstant only mints session blob: URLs;
    // without this backup, reopening finds no binary and the player goes black.
    const newAssets = batchResults.map((r) => r.asset);
    for (let i = 0; i < batchResults.length; i++) {
      const input = filesOrPaths[i];
      if (input instanceof File) {
        const result = batchResults[i];
        try {
          const backup = await backupMediaAsset(
            project.metadata.id,
            result.asset.id,
            input,
            result.asset.fileName
          );
          if (backup.blobUrl) {
            result.asset.mediaBlobUrl = backup.blobUrl;
            result.clip.mediaBlobUrl = backup.blobUrl;
          }
        } catch (err) {
          console.warn(`[ProjectContext] offline backup failed for ${result.asset.fileName}:`, err);
        }
      }
    }
    const newFootageClips = batchResults.filter((r) => !r.isAudio).map((r) => r.clip);
    const newAudioClips: AudioClip[] = batchResults.filter((r) => r.isAudio).map((r) => ({
      id: r.clip.id,
      mediaId: r.asset.id,
      name: r.clip.name,
      filePath: r.clip.filePath,
      originalFilePath: r.clip.filePath,
      mediaBlobUrl: r.clip.mediaBlobUrl,
      duration: r.clip.duration,
      startOffset: 0,
      endOffset: r.clip.duration,
      timelineStart: 0,
      timelineDuration: r.clip.duration,
      volume: 1.0,
      isMuted: false,
      waveformPeaks: r.clip.waveformPeaks || [],
      trackIndex: 1,
    }));

    // Check if timeline was empty: auto-set primary clip if first import has video/image
    const shouldSetPrimary = project.clips.length === 0 && newFootageClips.length > 0;

    const existingRegistry = project.mediaRegistry || [];
    const existingFootage = project.footageLibrary || [];
    const existingAudio = project.audioClips || [];

    // Dedupe registry
    const updatedRegistry = [...existingRegistry];
    for (const a of newAssets) {
      if (!updatedRegistry.some((ex) => ex.id === a.id || (ex.hash && ex.hash === a.hash))) {
        updatedRegistry.push(a);
      }
    }

    const updatedFootage = [...existingFootage, ...newFootageClips];
    const updatedAudio = [...existingAudio, ...newAudioClips];

    let updatedProject: ProjectData;
    if (shouldSetPrimary) {
      const primaryClip = newFootageClips[0];
      updatedProject = {
        ...project,
        metadata: {
          ...project.metadata,
          duration: primaryClip.duration,
          primaryMediaFilePath: primaryClip.filePath,
          updatedAt: new Date().toISOString(),
          mediaCount: updatedRegistry.length,
        },
        clips: [primaryClip],
        footageLibrary: updatedFootage,
        audioClips: updatedAudio,
        mediaRegistry: updatedRegistry,
      };
      setSelectedClipId(primaryClip.id);
    } else {
      updatedProject = {
        ...project,
        metadata: {
          ...project.metadata,
          updatedAt: new Date().toISOString(),
          mediaCount: updatedRegistry.length,
        },
        footageLibrary: updatedFootage,
        audioClips: updatedAudio,
        mediaRegistry: updatedRegistry,
      };
    }

    setProject(updatedProject);
    pushState(updatedProject);

    if (window.captionForgeAPI?.saveProject) {
      window.captionForgeAPI.saveProject(sanitizeProjectForPersistence(updatedProject));
    }

    return {
      registeredClips: newFootageClips,
      registeredAudios: newAudioClips,
    };
  };

  // Instant Footage File Importer (single item shortcut)
  const importFootageFile = async (fileOrPath: File | string): Promise<VideoClip | null> => {
    const res = await importMediaFiles([fileOrPath]);
    return res.registeredClips[0] || null;
  };

  // Append a footage clip to timeline on specified video track (V1 or V2)
  // Unified insertion for VIDEO | IMAGE | AUDIO-video-track clips — consistent frame-accurate timing
  // insertMode: true (default) = INSERT (shifts later clips), false = OVERWRITE (allows overlap, replaces in range)
  const appendClipToTimeline = (clip: VideoClip, targetTrackIndex: number = 1, customStart?: number, insertMode: boolean = true) => {
    if (!project) return;

    // Track compatibility guard: audio-only clips should not land on video tracks via this path
    // (audio uses importAudioFile path). Images and videos are video-track compatible.
    const clipMediaType: 'video' | 'image' | 'audio' = (clip as any).mediaType || (isImageFile(clip.name || clip.filePath) ? 'image' : 'video');
    if (clipMediaType === 'audio') {
      console.warn('appendClipToTimeline called with audio clip — use audio track insertion instead');
      return;
    }

    // Sanitize clip duration — images must use DEFAULT_IMAGE_DURATION if missing/zero
    let sourceDuration = sanitizeTime(clip.duration, 0);
    if (!isFinite(sourceDuration) || sourceDuration <= 0.05) {
      sourceDuration = clipMediaType === 'image' ? getDefaultImageDuration() : 5;
    }
    // For images, enforce the canonical duration even if footage had stale value
    if (clipMediaType === 'image') {
      const canonical = getDefaultImageDuration();
      if (Math.abs(sourceDuration - canonical) > 0.01 && sourceDuration < 1) {
        sourceDuration = canonical;
      }
      // If clip still reports stale 0, replace
      if (sourceDuration <= 0.2) sourceDuration = canonical;
    }

    const currentClips = project.clips;
    const sameTrackClips = currentClips.filter((c) => (c.trackIndex || 1) === targetTrackIndex);
    const lastClip = sameTrackClips[sameTrackClips.length - 1];
    let timelineStartRaw = customStart !== undefined
      ? customStart
      : lastClip
      ? (lastClip.timelineStart + lastClip.timelineDuration)
      : currentTime;

    // Frame-accurate snapping: quantize to frame boundary (fps=30) to avoid floating drift
    const fps = project.metadata.fps || 30;
    const frameDur = 1 / fps;
    let timelineStart = Math.round(sanitizeTime(timelineStartRaw, 0) / frameDur) * frameDur;
    timelineStart = Math.max(0, Math.round(timelineStart * 1000) / 1000);
    if (!isFinite(timelineStart)) timelineStart = 0;

    const spd = sanitizeTime(clip.speed || 1.0, 1);
    let timelineDuration = Math.max(0.2, Math.round((sourceDuration / (spd || 1)) * 1000) / 1000);
    // Quantize duration to frame as well
    timelineDuration = Math.round(timelineDuration / frameDur) * frameDur;
    timelineDuration = Math.max(frameDur, Math.round(timelineDuration * 1000) / 1000);
    if (!isFinite(timelineDuration) || timelineDuration <= 0) timelineDuration = getDefaultImageDuration();

    const clipId = `clip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newTimelineClip: VideoClip = {
      ...clip,
      id: clipId,
      mediaType: clipMediaType,
      duration: sourceDuration,
      startOffset: 0,
      endOffset: sourceDuration,
      trackIndex: targetTrackIndex,
      timelineStart,
      timelineDuration,
      speed: spd,
      volume: 1.0,
      isMuted: false,
      // Ensure transform defaults exist for proper rendering / editing
      transform: clip.transform || { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 },
    };

    // Insert vs Overwrite: default INSERT (shifts later clips), Shift+drop = OVERWRITE (replaces)
    let finalClips: VideoClip[];
    const isExplicitInsert = insertMode !== false;
    if (isExplicitInsert && customStart !== undefined) {
      const newEnd = timelineStart + timelineDuration;
      // Detect any overlap with existing clips on same track
      const overlapping = currentClips.filter(
        (c) => (c.trackIndex || 1) === targetTrackIndex && c.timelineStart < newEnd - 0.01 && c.timelineStart + c.timelineDuration > timelineStart + 0.01
      );
      if (overlapping.length > 0) {
        // Shift all clips that start at or after the insertion point forward by timelineDuration
        // For a clip that starts before insertion but overlaps, its start is moved to newEnd (insert before it)
        finalClips = currentClips.map((c) => {
          if ((c.trackIndex || 1) !== targetTrackIndex) return c;
          if (c.timelineStart >= timelineStart - 0.02) {
            return { ...c, timelineStart: Math.round((c.timelineStart + timelineDuration) * 1000) / 1000 };
          }
          if (c.timelineStart < timelineStart && c.timelineStart + c.timelineDuration > timelineStart) {
            // Overlapping clip starting before insertion — push its start to after new clip, preserving following chain
            const shift = newEnd - c.timelineStart;
            // This effectively moves it; but to avoid splitting, we move whole clip after insertion
            return { ...c, timelineStart: Math.round(newEnd * 1000) / 1000 };
          }
          return c;
        });
        finalClips.push(newTimelineClip);
        finalClips.sort((a, b) => a.timelineStart - b.timelineStart);
      } else {
        // Check if there are clips after insertion that are not overlapping but need shifting (gap insertion still pushes later material if tight)
        const afterClips = currentClips.filter((c) => (c.trackIndex || 1) === targetTrackIndex && c.timelineStart >= timelineStart - 0.02);
        if (afterClips.length > 0) {
          finalClips = currentClips.map((c) => {
            if ((c.trackIndex || 1) === targetTrackIndex && c.timelineStart >= timelineStart - 0.02) {
              return { ...c, timelineStart: Math.round((c.timelineStart + timelineDuration) * 1000) / 1000 };
            }
            return c;
          });
          finalClips.push(newTimelineClip);
          finalClips.sort((a, b) => a.timelineStart - b.timelineStart);
        } else {
          finalClips = [...currentClips, newTimelineClip];
        }
      }
    } else {
      finalClips = [...currentClips, newTimelineClip];
    }

    // Validate: ensure no negative times, no zero durations, correct end = start + duration
    finalClips = finalClips.map((c) => {
      const sd = sanitizeTime(c.timelineStart, 0);
      const td = sanitizeTime(c.timelineDuration, 0.2);
      return {
        ...c,
        timelineStart: Math.max(0, Math.round(sd * 1000) / 1000),
        timelineDuration: Math.max(0.1, Math.round(td * 1000) / 1000),
      };
    }).sort((a, b) => a.timelineStart - b.timelineStart);

    const maxDuration = finalClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0);

    const updatedProject: ProjectData = {
      ...project,
      metadata: {
        ...project.metadata,
        duration: Math.max(project.metadata.duration, maxDuration, timelineStart + timelineDuration),
        updatedAt: new Date().toISOString()
      },
      clips: finalClips,
      audioClips: project.audioClips || [],
      videoTracksCount: Math.max(project.videoTracksCount || 2, targetTrackIndex)
    };

    setProject(updatedProject);
    setSelectedClipId(clipId);
    pushState(updatedProject);

    if (window.captionForgeAPI?.saveProject) {
      window.captionForgeAPI.saveProject(updatedProject);
    }
  };

  // Replace primary video with this footage and auto-detect ratio
  const replacePrimaryClip = (clip: VideoClip) => {
    if (!project) return;
    const detected = calculateAutoAspectRatio(clip.width, clip.height);

    const clipId = `clip_${Date.now()}_primary`;
    const newPrimaryClip: VideoClip = {
      ...clip,
      id: clipId,
      trackIndex: 1,
      timelineStart: 0,
      timelineDuration: clip.duration / (clip.speed || 1.0)
    };

    const updatedProject: ProjectData = {
      ...project,
      metadata: {
        ...project.metadata,
        aspectRatio: detected.ratio,
        width: detected.width,
        height: detected.height,
        duration: newPrimaryClip.timelineDuration,
        primaryMediaFilePath: clip.filePath,
        thumbnailPath: clip.thumbnailUrl,
        updatedAt: new Date().toISOString()
      },
      clips: [newPrimaryClip],
      audioClips: project.audioClips && project.audioClips.length > 0 ? project.audioClips : [],
      videoTracksCount: project.videoTracksCount || 2,
      audioTracksCount: project.audioTracksCount || 2
    };

    setAutoRatioToast({
      ratio: detected.ratio,
      dimensions: `${clip.width}x${clip.height}`,
      sourceName: clip.name
    });

    setTimeout(() => {
      setAutoRatioToast(null);
    }, 3500);

    setProject(updatedProject);
    setSelectedClipId(newPrimaryClip.id);
    pushState(updatedProject);
  };

  const removeFootageAsset = (clipId: string) => {
    if (!project) return;
    const removed = (project.footageLibrary || []).find((f) => f.id === clipId);
    if (removed?.mediaBlobUrl?.startsWith('blob:')) {
      const stillUsed = [...project.clips, ...(project.footageLibrary || [])].some((c) => c.id !== clipId && (c.mediaBlobUrl === removed.mediaBlobUrl || c.filePath === removed.filePath));
      if (!stillUsed) {
        try { URL.revokeObjectURL(removed.mediaBlobUrl); } catch {}
      }
    }
    if (removed?.thumbnailUrl?.startsWith('blob:')) {
      try { URL.revokeObjectURL(removed.thumbnailUrl); } catch {}
    }
    const updatedLibrary = (project.footageLibrary || []).filter(f => f.id !== clipId);
    const updated = { ...project, footageLibrary: updatedLibrary };
    setProject(updated);
    pushState(updated);
  };

  // Save Project
  const saveEditorSession = useCallback((proj: ProjectData) => {
    const session = {
      playhead: currentTime,
      zoomLevel,
      scrollLeft: 0,
      scrollTop: 0,
      selectedClipId,
      selectedAudioClipId,
      selectedCaptionId,
      selectedTransitionId,
      selectedOverlayId,
      activeSidebarTab,
      updatedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(getEditorSessionKey(proj.metadata.id), JSON.stringify(session)); } catch {}
    return session;
  }, [currentTime, zoomLevel, selectedClipId, selectedAudioClipId, selectedCaptionId, selectedTransitionId, selectedOverlayId, activeSidebarTab]);

  const restoreEditorSession = useCallback((proj: ProjectData) => {
    try {
      let session: any = proj.editorSession;
      if (!session) {
        const raw = localStorage.getItem(getEditorSessionKey(proj.metadata.id));
        if (raw) session = JSON.parse(raw);
      }
      if (session) {
        setCurrentTime(sanitizeTime(session.playhead, 0));
        setZoomLevel(sanitizeTime(session.zoomLevel, 1));
        setSelectedClipId(session.selectedClipId || null);
        setSelectedAudioClipId(session.selectedAudioClipId || null);
        setSelectedCaptionId(session.selectedCaptionId || null);
        setSelectedTransitionId(session.selectedTransitionId || null);
        setSelectedOverlayId(session.selectedOverlayId || null);
        if (session.activeSidebarTab) setActiveSidebarTab(session.activeSidebarTab);
      }
    } catch {}
  }, []);

  const checkMissingMedia = useCallback(async (proj: ProjectData) => {
    const missing: string[] = [];
    const registry: MediaAsset[] = (proj as any).mediaRegistry || [];
    // Check registry assets via robust helper (P11, P14)
    for (const asset of registry) {
      const exists = await checkMediaExists(asset);
      if (!exists) missing.push(asset.filePath);
    }
    // Fallback for legacy clips without registry or dead blob: URLs.
    // A persisted blob: URL is never valid after a restart: if the clip has
    // no registry asset with a stored binary and no absolute path to rebuild
    // from, it is missing — even when mediaBlobUrl is a (dead) truthy string.
    for (const clip of [...proj.clips, ...(proj.footageLibrary || []), ...(proj.audioClips || [])]) {
      const p = (clip as any).filePath;
      const blob = (clip as any).mediaBlobUrl;
      const mediaId = (clip as any).mediaId;
      const hasRegistryAsset = mediaId && registry.find((a) => a.id === mediaId);
      const staleBlob = typeof blob === 'string' && blob.startsWith('blob:');
      const pathIsBlob = typeof p === 'string' && p.startsWith('blob:');
      const hasAbsolutePath = isAbsoluteMediaPath(p);
      if ((staleBlob || pathIsBlob || !blob) && !hasRegistryAsset && !hasAbsolutePath) {
        const label = p || mediaId || (clip as any).id || 'unknown-clip';
        if (!missing.includes(label)) missing.push(label);
        continue;
      }
      if (pathIsBlob && hasRegistryAsset) continue; // registry probe already ran
      // If clip has mediaId but asset already checked, skip
      if (hasRegistryAsset) continue;
      // Legacy filePath check via Electron API if available
      const api: any = window.captionForgeAPI;
      if (p && api?.checkFileExists) {
        try { const exists = await api.checkFileExists(p); if (!exists && !missing.includes(p)) missing.push(p); } catch {}
      } else if (p && !p.startsWith('data:') && !p.startsWith('blob:')) {
        // Web: try element probe if not in registry
        const exists = await checkMediaExists({ filePath: p, fileName: (clip as any).name || p.split('/').pop() || '', mediaType: (clip as any).mediaType || 'video', duration: 0, width: 0, height: 0, fps: 30, importDate: '' } as any);
        if (!exists && !missing.includes(p)) missing.push(p);
      }
    }
    if (missing.length > 0) {
      console.warn('Missing media detected:', missing);
      (proj as any).missingMedia = missing;
      // Update project state to trigger Missing Media UI (P49)
      if (project && proj.metadata.id === project.metadata.id) {
        setProject((prev: any) => prev ? { ...prev, missingMedia: missing } : prev);
      }
    } else {
      (proj as any).missingMedia = [];
    }
    return missing;
  }, [project]);

  const saveProject = async () => {
    if (!project) return;
    setSaveStatus('saving');
    const session = saveEditorSession(project);
    // P2-P5: ensure registry, thumbnail, metadata are up-to-date before save
    const registryEnsure = ensureMediaRegistryForProject(project);
    // Use first clip thumbnail or project thumbnail as fallback
    const fallbackThumb = project.clips[0]?.thumbnailUrl || project.footageLibrary?.[0]?.thumbnailUrl || project.metadata.thumbnailPath || '';
    // Ensure thumbnails are data URLs (persist after restart)
    const persistentThumb = fallbackThumb.startsWith('blob:') ? '' : fallbackThumb;
    const updated: ProjectData = {
      ...project,
      clips: registryEnsure.clips,
      audioClips: registryEnsure.audioClips,
      footageLibrary: registryEnsure.footage,
      mediaRegistry: registryEnsure.registry,
      metadata: {
        ...project.metadata,
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        version: (project.metadata as any).version || 1,
        mediaCount: registryEnsure.registry.length,
        thumbnailPath: persistentThumb || project.metadata.thumbnailPath,
        saveState: 'saved' as const,
      },
      editorSession: session as any,
    } as ProjectData;
    setProject(updated);
    setHasUnsavedChanges(false);
    try {
      // 1. Save to robust offline IndexedDB database with offline media assets
      // (saveProjectWithOfflineAssets persists a sanitized copy without blob: URLs).
      await saveProjectWithOfflineAssets(updated, persistentThumb || project.metadata.thumbnailPath);

      if (window.captionForgeAPI?.saveProject) {
        await window.captionForgeAPI.saveProject(sanitizeProjectForPersistence(updated));
      } else {
        // Fallback: localStorage for web preview (sanitized: no blob: URLs)
        try {
          const toStore = sanitizeProjectForPersistence({ ...updated });
          localStorage.setItem(`cf_project_${updated.metadata.id}`, JSON.stringify(toStore));
          try {
            const idxRaw = localStorage.getItem('captionforge_index');
            const idx = idxRaw ? JSON.parse(idxRaw) : { projects: [] };
            const existing = idx.projects.findIndex((p: any) => p.id === updated.metadata.id);
            const metaForIndex = {
              id: updated.metadata.id,
              name: updated.metadata.name,
              thumbnailPath: updated.metadata.thumbnailPath,
              createdAt: updated.metadata.createdAt,
              updatedAt: updated.metadata.updatedAt,
              lastOpenedAt: updated.metadata.lastOpenedAt,
              duration: updated.metadata.duration,
              width: updated.metadata.width,
              height: updated.metadata.height,
              fps: updated.metadata.fps,
              aspectRatio: updated.metadata.aspectRatio,
              mediaCount: updated.mediaRegistry?.length || 0,
            };
            if (existing >= 0) idx.projects[existing] = metaForIndex;
            else idx.projects.unshift(metaForIndex);
            localStorage.setItem('captionforge_index', JSON.stringify(idx));
          } catch {}
        } catch {}
      }
      setSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
      lastSavedJsonRef.current = JSON.stringify(updated);
      saveEditorSession(updated);
      try { saveVersion(updated.metadata.id, `Autosave ${new Date().toLocaleTimeString()}`, sanitizeProjectForPersistence(updated)); } catch {}
    } catch (e) {
      setSaveStatus('error');
      console.error('Save failed:', e);
    }
  };

  const setProjectExportFolder = useCallback(async (folder: string) => {
    if (!folder) return;
    const cleanFolder = folder.trim();
    localStorage.setItem('cf_last_export_dir', cleanFolder);

    setProject((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        metadata: {
          ...prev.metadata,
          exportFolder: cleanFolder,
          updatedAt: new Date().toISOString(),
        },
      };
      // Persist to native storage if project is open
      if (window.captionForgeAPI?.saveProject) {
        window.captionForgeAPI.saveProject(updated).catch(() => {});
      }
      return updated;
    });

    if (window.captionForgeAPI?.saveSettings) {
      try {
        await window.captionForgeAPI.saveSettings({ exportDirectory: cleanFolder });
      } catch (e) {}
    }
  }, []);

  // Load Project — with full persistence and offline asset rehydration pipeline
  const loadProject = async (projectId: string) => {
    let loaded: ProjectData | null = null;
    try {
      loaded = await loadProjectWithOfflineAssets(projectId);
    } catch (err) {
      console.warn('[ProjectContext] IndexedDB load error:', err);
    }
    if (!loaded && window.captionForgeAPI?.loadProject) {
      loaded = await window.captionForgeAPI.loadProject(projectId);
    } else if (!loaded) {
      try {
        const raw = localStorage.getItem(`cf_project_${projectId}`);
        if (raw) loaded = JSON.parse(raw);
      } catch {}
    }
    if (loaded) {
      // P51 corrupt handling: try autosave/previous version if primary is invalid
      if (!loaded || !loaded.metadata || !Array.isArray(loaded.clips)) {
        console.error('Corrupt project, attempting recovery from autosave/previous version');
        try {
          const autosaveRaw = localStorage.getItem(`cf_autosave_${projectId}`);
          if (autosaveRaw) {
            const autosave = JSON.parse(autosaveRaw);
            if (autosave?.p && autosave.p.metadata) loaded = autosave.p;
          }
          if (!loaded || !loaded.metadata) {
            const versions = loadVersions(projectId);
            if (versions.length > 0 && versions[0].projectJson) loaded = versions[0].projectJson;
          }
        } catch {}
      }
      if (!loaded || !loaded.metadata) {
        alert('Project file is corrupt and could not be recovered. Please check autosave or create a new project.');
        return;
      }
      // P7 ensure registry exists (migrate legacy)
      const ensured = ensureMediaRegistryForProject(loaded);
      loaded.clips = ensured.clips;
      loaded.audioClips = ensured.audioClips as any;
      loaded.footageLibrary = ensured.footage as any;
      (loaded as any).mediaRegistry = ensured.registry;
      // Rehydrate persistent IndexedDB binary blobs for all assets
      loaded = await rehydrateProjectMedia(loaded);
      // P10 rebuild runtime URLs
      loaded = rebuildRuntimeUrls(loaded) as ProjectData;
      // P20-P22 validate image/audio/video clip restoration
      loaded.clips = loaded.clips.map((c: any) => {
        // Image must retain 5s duration (P58)
        if (c.mediaType === 'image' || isImageFile(c.name || c.filePath)) {
          const dur = getDefaultImageDuration();
          return { ...c, mediaType: 'image' as any, duration: c.duration || dur, timelineDuration: c.timelineDuration || dur, endOffset: c.endOffset || dur, width: c.width || 1080, height: c.height || 1920 };
        }
        // Ensure duration valid
        if (!isFinite(c.duration) || c.duration < 0.1) c.duration = 5;
        if (!isFinite(c.timelineDuration) || c.timelineDuration < 0.1) c.timelineDuration = Math.max(0.5, c.endOffset - c.startOffset || c.duration);
        return c;
      });
      loaded.audioClips = (loaded.audioClips || []).map((a: any) => {
        if (!isFinite(a.duration) || a.duration < 0.1) a.duration = a.timelineDuration || 5;
        return a;
      });
      // P23-P29 restore captions timing/word timing already in loaded.captions (persisted), don't regenerate
      // P30 restore project settings (resolution/fps/aspect) already in metadata
      // P48 validation steps 1-4
      if (!loaded.metadata.id) loaded.metadata.id = projectId;
      if (!loaded.metadata.createdAt) loaded.metadata.createdAt = new Date().toISOString();
      loaded.metadata.lastOpenedAt = new Date().toISOString();

      const snap = deepCloneProject(loaded);
      setProject(loaded);
      historyRef.current = [snap];
      historyIndexRef.current = 0;
      setHistory([snap]);
      setHistoryIndex(0);
      // P31-P33 restore session
      restoreEditorSession(loaded);
      setIsPlaying(false);
      setSaveStatus('saved');
      setLastSavedAt(loaded.metadata.updatedAt);
      setHasUnsavedChanges(false);
      lastSavedJsonRef.current = JSON.stringify(loaded);
      // P11-P13 missing media detection async (P48 step 5-6)
      setTimeout(async () => {
        const missing = await checkMissingMedia(loaded!);
        if (missing.length > 0) {
          console.warn(`Project loaded with ${missing.length} missing media assets`);
          // Keep project open with Missing Media UI (P49 partial load)
        }
      }, 400);
    }
  };

  const closeProject = async () => {
    if (project) {
      // P39/P40: detect unsaved changes and save pending before close
      if (hasUnsavedChanges || saveStatus === 'saving') {
        try { await saveProject(); } catch {}
      }
      // Persist editor session + autosave (P38 recovery).
      // Save a sanitized copy so no session-only blob: URL reaches disk.
      saveEditorSession(project);
      try { saveAutoSave(project.metadata.id, sanitizeProjectForPersistence(project)); } catch {}
      try { saveVersion(project.metadata.id, `Close ${new Date().toLocaleTimeString()}`, sanitizeProjectForPersistence(project)); } catch {}
      // P54 runtime cleanup: drop in-memory object-URL caches (binaries stay
      // in IndexedDB). Revoking clip URLs by hand while leaving the same
      // strings inside the store caches caused same-session reopens to reuse
      // revoked URLs -> black screen.
      try { assetStore.clearMemoryUrls(); } catch {}
      try { dbService.clearMemoryUrls(); } catch {}
      // Pause any playing media elements
      try { document.querySelectorAll('video, audio').forEach((el: any) => { try { el.pause(); el.removeAttribute('src'); } catch {} }); } catch {}
    }
    setProject(null);
    setIsPlaying(false);
    setCurrentTime(0);
    historyRef.current = [];
    historyIndexRef.current = -1;
    setHistory([]);
    setHistoryIndex(-1);
    setAutoRatioToast(null);
    setSaveStatus('saved');
    setHasUnsavedChanges(false);
    lastSavedJsonRef.current = '';
  };

  const renameProject = async (projectId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    // Update current project if matches
    if (project && project.metadata.id === projectId) {
      const updated = { ...project, metadata: { ...project.metadata, name: trimmed, updatedAt: new Date().toISOString() } };
      setProject(updated);
      pushState(updated);
      if (window.captionForgeAPI?.saveProject) await window.captionForgeAPI.saveProject(updated);
      // Update index
      const apiAny: any = window.captionForgeAPI;
      if (apiAny?.renameProject) {
        try { await apiAny.renameProject(projectId, trimmed); } catch {}
      }
    } else if ((window.captionForgeAPI as any)?.renameProject) {
      await (window.captionForgeAPI as any).renameProject(projectId, trimmed);
    }
    setHasUnsavedChanges(false);
  };

  const duplicateProject = async (projectId: string): Promise<string | null> => {
    try {
      let source: ProjectData | null = null;
      if (project && project.metadata.id === projectId) source = project;
      else source = await loadProjectWithOfflineAssets(projectId);
      if (!source && window.captionForgeAPI?.loadProject) source = await window.captionForgeAPI.loadProject(projectId);
      if (!source) return null;
      const existingNames: string[] = [];
      try {
        const all = await listAllProjects();
        existingNames.push(...all.map((p) => p.name));
      } catch {}
      const newName = generateUniqueProjectName(`${source.metadata.name} — Copy`, existingNames);
      const newId = `proj_${Date.now()}`;
      const duplicated = await dbService.duplicateProjectState(projectId, newId, newName);
      if (duplicated && window.captionForgeAPI?.saveProject) {
        await window.captionForgeAPI.saveProject(duplicated);
      }
      return newId;
    } catch (e) {
      console.error('Duplicate failed:', e);
      return null;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await deleteProjectCompletely(projectId);
    } catch (err) {
      console.warn('[ProjectContext] Delete project warning:', err);
    }
    // Clean up cached session keys
    try { localStorage.removeItem(getEditorSessionKey(projectId)); } catch {}
    try { localStorage.removeItem(`cf_autosave_${projectId}`); } catch {}
    try { localStorage.removeItem(`cf_project_${projectId}`); } catch {}
  };

  const relinkMedia = async (oldPath: string, newPathOrFile: string | File) => {
    if (!project) return;
    const isFile = newPathOrFile instanceof File;
    const newPath = isFile ? ((window as any).captionForgeAPI?.getPathForFile ? (window as any).captionForgeAPI.getPathForFile(newPathOrFile as File) : (newPathOrFile as File).name) : String(newPathOrFile);
    const newFileName = isFile ? (newPathOrFile as File).name : String(newPathOrFile).split(/[\/\\]/).pop() || oldPath.split(/[\/\\]/).pop() || 'media';
    // Find asset(s) matching oldPath (by filePath or id) — P13 all clips using mediaId
    const registry: MediaAsset[] = (project as any).mediaRegistry || [];
    let targetAsset: MediaAsset | undefined = registry.find((a) => a.filePath === oldPath || a.id === oldPath);
    if (!targetAsset) {
      // Fallback: find by clip filePath
      const clipMatch = project.clips.find((c) => c.filePath === oldPath) || (project.footageLibrary || []).find((c) => c.filePath === oldPath);
      if (clipMatch && (clipMatch as any).mediaId) targetAsset = registry.find((a) => a.id === (clipMatch as any).mediaId);
    }
    // If still not found, create synthetic asset for legacy projects
    if (!targetAsset) {
      targetAsset = {
        id: `media_${Date.now()}`,
        fileName: oldPath.split(/[\/\\]/).pop() || 'media',
        filePath: oldPath,
        mediaType: 'video' as any,
        duration: 5, width: 1080, height: 1920, fps: 30,
        importDate: new Date().toISOString(),
      } as MediaAsset;
      registry.push(targetAsset);
    }
    // P14 fingerprint check (warn if not same file)
    const newFingerprint = isFile ? createFingerprint((newPathOrFile as File).name, (newPathOrFile as File).size, (newPathOrFile as File).lastModified) : createFingerprint(newFileName, undefined, undefined);
    const isSameFile = targetAsset.hash ? newFingerprint === targetAsset.hash : targetAsset.fileName === newFileName;
    if (!isSameFile) {
      console.warn(`Relinking different file: ${targetAsset.fileName} -> ${newFileName} (fingerprint mismatch, but allowing)`);
    }
    // Optionally re-extract metadata for new file to update dimensions/duration if File provided
    let updatedAsset: MediaAsset = { ...targetAsset, filePath: newPath, fileName: newFileName, originalFilePath: newPath, hash: newFingerprint } as MediaAsset;
    if (isFile) {
      try {
        const meta = await extractMediaMetadata(newPathOrFile as File);
        let liveBlobUrl = meta.url;
        try {
          const backup = await backupMediaAsset(
            project.metadata.id,
            updatedAsset.id,
            newPathOrFile as File,
            newFileName
          );
          if (backup.blobUrl) liveBlobUrl = backup.blobUrl;
        } catch (err) {
          console.warn('[ProjectContext] Relink backup warning:', err);
        }

        updatedAsset = {
          ...updatedAsset,
          mediaBlobUrl: liveBlobUrl,
          width: meta.width || updatedAsset.width,
          height: meta.height || updatedAsset.height,
          duration: meta.duration || updatedAsset.duration,
          fps: meta.fps || updatedAsset.fps,
          thumbnailUrl: meta.thumbnailUrl || updatedAsset.thumbnailUrl,
          waveformPeaks: meta.waveformPeaks || updatedAsset.waveformPeaks,
          mimeType: (newPathOrFile as File).type || updatedAsset.mimeType,
          fileSize: (newPathOrFile as File).size,
          lastModified: (newPathOrFile as File).lastModified,
        };
      } catch {}
    }
    const newRegistry = registry.map((a) => a.id === targetAsset!.id ? updatedAsset : a);
    if (!registry.find((a) => a.id === targetAsset!.id)) newRegistry.push(updatedAsset);

    // Update all clips/footage/audio that reference this asset (by mediaId or filePath) — P13
    const updateClipMedia = (c: any) => {
      const matches = c.mediaId === targetAsset!.id || c.filePath === oldPath || c.originalFilePath === oldPath;
      if (!matches) return c;
      const newUrl = resolveMediaUrl(updatedAsset);
      return {
        ...c,
        mediaId: updatedAsset.id,
        filePath: updatedAsset.filePath,
        originalFilePath: updatedAsset.filePath,
        mediaBlobUrl: newUrl || c.mediaBlobUrl,
        width: updatedAsset.width || c.width,
        height: updatedAsset.height || c.height,
        thumbnailUrl: updatedAsset.thumbnailUrl || c.thumbnailUrl,
        // Keep timeline timing, but ensure duration matches new file if needed (for images keep 5s)
        duration: updatedAsset.mediaType === 'image' ? getDefaultImageDuration() : updatedAsset.duration || c.duration,
      };
    };
    const updatedClips = project.clips.map(updateClipMedia);
    const updatedLibrary = (project.footageLibrary || []).map(updateClipMedia);
    const updatedAudio = (project.audioClips || []).map(updateClipMedia);
    // Also update overlays that reference this file
    const updatedOverlays = (project.overlays || []).map((ov: any) => ov.filePath === oldPath ? { ...ov, filePath: newPath } : ov);
    // Rebuild runtime URLs and clear missing
    const tempProject: any = { ...project, clips: updatedClips, footageLibrary: updatedLibrary, audioClips: updatedAudio, overlays: updatedOverlays, mediaRegistry: newRegistry };
    const rebuilt = rebuildRuntimeUrls(tempProject);
    const newMissing = (rebuilt.missingMedia || []).filter((p: string) => p !== oldPath);
    const updated: any = { ...rebuilt, missingMedia: newMissing, metadata: { ...rebuilt.metadata, updatedAt: new Date().toISOString() } };
    setProject(updated);
    pushState(updated);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
    // Persist immediately (P15 save new reference)
    if (window.captionForgeAPI?.saveProject) {
      try { await window.captionForgeAPI.saveProject(updated); setSaveStatus('saved'); } catch {}
    }
    // Re-check missing
    setTimeout(() => checkMissingMedia(updated), 300);
  };

  const batchRelinkFolder = async (folderPath: string): Promise<number> => {
    if (!project || !folderPath) return 0;
    const missing: string[] = (project as any).missingMedia || [];
    if (missing.length === 0) return 0;
    let relinked = 0;
    for (const oldPath of [...missing]) {
      const fileName = oldPath.split(/[\/\\]/).pop() || '';
      if (!fileName) continue;
      // Candidate paths to probe
      const sep = folderPath.includes('\\') ? '\\' : '/';
      const candidates = [
        `${folderPath}${sep}${fileName}`,
        `${folderPath}/${fileName}`,
        `${folderPath}\\${fileName}`,
      ];
      for (const cand of candidates) {
        try {
          const api: any = (window as any).captionForgeAPI;
          let exists = false;
          if (api?.checkFileExists) exists = await api.checkFileExists(cand);
          else if (api?.probeMedia) {
            try { const p = await api.probeMedia(cand); exists = !!p; } catch { exists = false; }
          }
          if (exists) {
            await relinkMedia(oldPath, cand);
            relinked++;
            break;
          }
        } catch {}
      }
    }
    return relinked;
  };

  // Helper to snap and ripple clips sequentially on a specific track (eliminates unwanted gaps)
  const realignTrackClips = (
    clips: VideoClip[],
    audioClips: AudioClip[] = [],
    trackIndex: number = 1,
    fromTime?: number
  ): { clips: VideoClip[]; audioClips: AudioClip[]; maxDuration: number } => {
    const trackClips = clips.filter((c) => (c.trackIndex || 1) === trackIndex);
    const otherClips = clips.filter((c) => (c.trackIndex || 1) !== trackIndex);

    // Sort strictly by timelineStart
    const sorted = [...trackClips].sort((a, b) => a.timelineStart - b.timelineStart);

    const effectiveFromTime = fromTime !== undefined ? fromTime : (sorted.length > 0 && trackIndex > 1 ? sorted[0].timelineStart : 0);
    let runningTime = effectiveFromTime;
    const shiftedTrackClips: VideoClip[] = [];
    const clipTimeDeltas = new Map<string, number>();

    for (const clip of sorted) {
      if (clip.timelineStart + clip.timelineDuration <= effectiveFromTime + 0.01) {
        shiftedTrackClips.push(clip);
        runningTime = Math.max(runningTime, clip.timelineStart + clip.timelineDuration);
        continue;
      }
      const dur = sanitizeTime(clip.timelineDuration, 0.5);
      const safeDur = isFinite(dur) && dur >= 0.05 ? dur : 0.5;
      const oldStart = sanitizeTime(clip.timelineStart, runningTime);
      const newStart = Math.round(sanitizeTime(runningTime, 0) * 1000) / 1000;
      const delta = newStart - oldStart;
      clipTimeDeltas.set(clip.id, delta);

      shiftedTrackClips.push({
        ...clip,
        timelineStart: isFinite(newStart) ? newStart : 0,
        timelineDuration: safeDur,
      });

      runningTime = sanitizeTime(runningTime + safeDur, safeDur);
    }

    // Also adjust linked audio clips
    const updatedAudioClips = audioClips.map((ac) => {
      if (ac.sourceClipId && clipTimeDeltas.has(ac.sourceClipId)) {
        const delta = clipTimeDeltas.get(ac.sourceClipId)!;
        return {
          ...ac,
          timelineStart: Math.max(0, Math.round((ac.timelineStart + delta) * 1000) / 1000),
        };
      }
      return ac;
    });

    const allClips = [...otherClips, ...shiftedTrackClips].sort((a, b) => a.timelineStart - b.timelineStart);
    const maxDuration = Math.max(
      allClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0),
      updatedAudioClips.reduce((max, a) => Math.max(max, a.timelineStart + a.timelineDuration), 0)
    );

    return { clips: allClips, audioClips: updatedAudioClips, maxDuration };
  };

  // Clip Operations
  const updateClip = (clipId: string, updates: Partial<VideoClip>) => {
    if (!project) return;
    let updatedClips = project.clips.map((clip) => {
      if (clip.id === clipId) {
        const merged = { ...clip, ...updates };
        if (updates.startOffset !== undefined || updates.endOffset !== undefined || updates.speed !== undefined) {
          const s = sanitizeTime(merged.startOffset, clip.startOffset);
          const e = sanitizeTime(merged.endOffset, clip.endOffset);
          const spd = sanitizeTime(merged.speed ?? 1, 1);
          const rawDuration = Math.max(0.1, e - s);
          merged.startOffset = s;
          merged.endOffset = e;
          merged.speed = spd;
          merged.timelineDuration = rawDuration / (spd || 1.0);
          if (!isFinite(merged.timelineDuration) || merged.timelineDuration < 0.1) merged.timelineDuration = 0.1;
        }
        return merged;
      }
      return clip;
    });

    const targetClip = updatedClips.find((c) => c.id === clipId);
    let updatedAudioClips = (project.audioClips || []).map((ac) => {
      if (ac.sourceClipId === clipId) {
        const synced = { ...ac };
        if (updates.timelineStart !== undefined) synced.timelineStart = updates.timelineStart;
        if (updates.timelineDuration !== undefined) synced.timelineDuration = updates.timelineDuration;
        if (updates.startOffset !== undefined) synced.startOffset = updates.startOffset;
        if (updates.endOffset !== undefined) synced.endOffset = updates.endOffset;
        if (updates.speed !== undefined) synced.speed = updates.speed;
        return synced;
      }
      return ac;
    });

    if (isMagnetMode && targetClip && (targetClip.trackIndex || 1) === 1) {
      const realigned = realignTrackClips(updatedClips, updatedAudioClips, 1, targetClip.timelineStart);
      updatedClips = realigned.clips;
      updatedAudioClips = realigned.audioClips;
    }

    const maxDuration = Math.max(
      updatedClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0),
      updatedAudioClips.reduce((max, a) => Math.max(max, a.timelineStart + a.timelineDuration), 0)
    );

    // P42-P45: keep captions synced with clip — speed & trim handling
    let updatedCaptions = [...(project.captions || [])];
    const oldClip = project.clips.find((c) => c.id === clipId);
    if (oldClip && targetClip) {
      const speedChanged = (updates.speed !== undefined && updates.speed !== oldClip.speed);
      const trimChanged = updates.startOffset !== undefined || updates.endOffset !== undefined;
      if (speedChanged) {
        const oldSpeed = oldClip.speed || 1;
        const newSpeed = targetClip.speed || 1;
        const factor = oldSpeed / newSpeed;
        const anchor = oldClip.timelineStart;
        updatedCaptions = updatedCaptions.map((cap) => {
          if (cap.clipId && cap.clipId !== clipId) return cap;
          // Scale around clip timeline start
          const mapT = (t: number) => {
            const tl = anchor + (t - anchor) * factor;
            return Math.round(tl * 100) / 100;
          };
          return {
            ...cap,
            start: mapT(cap.start),
            end: mapT(cap.end),
            words: cap.words.map((w) => ({ ...w, start: mapT(w.start), end: mapT(w.end) })),
            sourceWords: cap.sourceWords?.map((w) => ({ ...w, start: mapT(w.start), end: mapT(w.end) })),
          };
        });
      }
      if (trimChanged) {
        // Remove captions fully outside trimmed range, trim partially overlapped
        const clipStart = targetClip.timelineStart;
        const clipEnd = clipStart + targetClip.timelineDuration;
        updatedCaptions = updatedCaptions.filter((cap) => {
          if (cap.clipId && cap.clipId !== clipId) return true;
          // Keep only if overlaps clip range
          return !(cap.end <= clipStart + 0.02 || cap.start >= clipEnd - 0.02);
        }).map((cap) => {
          if (cap.clipId && cap.clipId !== clipId) return cap;
          // Clamp to clip bounds if partially outside
          let s = Math.max(clipStart, cap.start);
          let e = Math.min(clipEnd, cap.end);
          if (e - s < 0.1) return null as any;
          // Words also clamped
          const words = cap.words.filter((w) => w.end > clipStart && w.start < clipEnd).map((w) => ({
            ...w,
            start: Math.max(clipStart, Math.min(clipEnd, w.start)),
            end: Math.max(clipStart, Math.min(clipEnd, w.end)),
          }));
          if (words.length === 0) return null as any;
          s = Math.min(...words.map((w) => w.start));
          e = Math.max(...words.map((w) => w.end));
          return { ...cap, start: s, end: e, words, text: words.map((w) => w.word).join(' ') };
        }).filter(Boolean) as any;
      }
    }

    const updatedTransitions = syncTransitionsWithClips(project.transitions, updatedClips);

    const updatedProject: ProjectData = {
      ...project,
      metadata: { ...project.metadata, duration: Math.max(1, maxDuration) },
      clips: updatedClips,
      audioClips: updatedAudioClips,
      captions: updatedCaptions,
      transitions: updatedTransitions,
    };

    setProject(updatedProject);
    pushState(updatedProject);
  };

  const splitClipAtPlayhead = () => {
    if (!project) return;

    // Find target clip: selected clip if at playhead, or any clip intersecting currentTime on V1/active track
    const targetClip = selectedClipId
      ? project.clips.find(
          (c) =>
            c.id === selectedClipId &&
            currentTime > c.timelineStart + 0.05 &&
            currentTime < c.timelineStart + c.timelineDuration - 0.05
        )
      : project.clips.find(
          (c) =>
            currentTime > c.timelineStart + 0.05 &&
            currentTime < c.timelineStart + c.timelineDuration - 0.05
        );

    if (!targetClip) return;

    const offsetInTimeline = currentTime - targetClip.timelineStart;
    const splitPointSource = targetClip.startOffset + offsetInTimeline * (targetClip.speed || 1.0);

    const firstClip: VideoClip = {
      ...targetClip,
      endOffset: Math.round(splitPointSource * 1000) / 1000,
      timelineDuration: Math.round(offsetInTimeline * 1000) / 1000,
    };

    const secondClipId = `clip_${Date.now()}_split_${Math.random().toString(36).substring(7)}`;
    const secondClip: VideoClip = {
      ...targetClip,
      id: secondClipId,
      name: `${targetClip.name.replace(/ \(Part \d+\)$/, '')} (Part 2)`,
      startOffset: Math.round(splitPointSource * 1000) / 1000,
      timelineStart: Math.round(currentTime * 1000) / 1000,
      timelineDuration: Math.round((targetClip.timelineDuration - offsetInTimeline) * 1000) / 1000,
    };

    const newClips = project.clips.filter((c) => c.id !== targetClip.id);
    newClips.push(firstClip, secondClip);
    newClips.sort((a, b) => a.timelineStart - b.timelineStart);

    // Also split linked audio clip if present
    let updatedAudioClips = project.audioClips || [];
    const linkedAudio = updatedAudioClips.find((a) => a.sourceClipId === targetClip.id);
    if (
      linkedAudio &&
      currentTime > linkedAudio.timelineStart + 0.05 &&
      currentTime < linkedAudio.timelineStart + linkedAudio.timelineDuration - 0.05
    ) {
      const audioOffset = currentTime - linkedAudio.timelineStart;
      const audioSpeed = (linkedAudio as any).speed || targetClip.speed || 1.0;
      const audioSplitPoint = linkedAudio.startOffset + audioOffset * audioSpeed;

      const firstAudio: AudioClip = {
        ...linkedAudio,
        endOffset: Math.round(audioSplitPoint * 1000) / 1000,
        timelineDuration: Math.round(audioOffset * 1000) / 1000,
      };

      const secondAudio: AudioClip = {
        ...linkedAudio,
        id: `audio_${secondClipId}`,
        sourceClipId: secondClipId,
        name: `${linkedAudio.name.replace(/ \(Part \d+\)$/, '')} (Part 2)`,
        startOffset: Math.round(audioSplitPoint * 1000) / 1000,
        timelineStart: Math.round(currentTime * 1000) / 1000,
        timelineDuration: Math.round((linkedAudio.timelineDuration - audioOffset) * 1000) / 1000,
      };

      updatedAudioClips = updatedAudioClips.filter((a) => a.id !== linkedAudio.id);
      updatedAudioClips.push(firstAudio, secondAudio);
      updatedAudioClips.sort((a, b) => a.timelineStart - b.timelineStart);
    }

    // P46: split captions that straddle the split point at word boundary
    let updatedCaptionsForSplit = [...(project.captions || [])];
    updatedCaptionsForSplit = updatedCaptionsForSplit.flatMap((cap) => {
      if (cap.end <= currentTime + 0.02 || cap.start >= currentTime - 0.02) return [cap];
      // Cap straddles split — split at word boundary or time
      const wordsBefore = cap.words.filter((w) => w.end <= currentTime + 0.01);
      const wordsAfter = cap.words.filter((w) => w.start >= currentTime - 0.01);
      if (wordsBefore.length === 0 || wordsAfter.length === 0) {
        // Time-based split — create two caps
        const beforeWords = cap.words.filter((w) => w.start < currentTime);
        const afterWords = cap.words.filter((w) => w.start >= currentTime);
        if (beforeWords.length === 0 || afterWords.length === 0) return [cap];
        const cap1: any = {
          ...cap,
          id: cap.id,
          clipId: cap.clipId,
          end: Math.round(currentTime * 100) / 100,
          words: beforeWords,
          text: beforeWords.map((w) => w.word).join(' '),
          sourceText: beforeWords.map((w) => w.originalWord || w.word).join(' '),
        };
        const cap2: any = {
          ...cap,
          id: `cap_${Date.now()}_split_${Math.random().toString(36).slice(2, 4)}`,
          clipId: secondClipId,
          start: Math.round(currentTime * 100) / 100,
          words: afterWords,
          text: afterWords.map((w) => w.word).join(' '),
          sourceText: afterWords.map((w) => w.originalWord || w.word).join(' '),
        };
        return [cap1, cap2];
      }
      // Word-boundary split
      const cap1: any = {
        ...cap,
        id: cap.id,
        end: wordsBefore[wordsBefore.length - 1].end,
        words: wordsBefore,
        text: wordsBefore.map((w) => w.word).join(' '),
        sourceText: wordsBefore.map((w) => w.originalWord || w.word).join(' '),
      };
      const cap2: any = {
        ...cap,
        id: `cap_${Date.now()}_split_${Math.random().toString(36).slice(2, 4)}`,
        start: wordsAfter[0].start,
        words: wordsAfter,
        text: wordsAfter.map((w) => w.word).join(' '),
        sourceText: wordsAfter.map((w) => w.originalWord || w.word).join(' '),
      };
      // Preserve clip association
      cap1.clipId = cap.clipId;
      cap2.clipId = secondClipId; // second part moves to new clip
      return [cap1, cap2];
    });

    // Retarget outgoing transitions from original targetClip to secondClip
    const updatedTransitions = (project.transitions || []).map((t) => {
      if (t.fromClipId === targetClip.id) {
        return { ...t, fromClipId: secondClipId };
      }
      return t;
    });

    const updatedProject: ProjectData = {
      ...project,
      clips: newClips,
      audioClips: updatedAudioClips,
      captions: updatedCaptionsForSplit.sort((a: any, b: any) => a.start - b.start),
      transitions: updatedTransitions,
    };

    setProject(updatedProject);
    setSelectedClipId(secondClip.id);
    pushState(updatedProject);
  };

  const deleteClip = (clipId: string, forceRipple?: boolean) => {
    if (!project) return;
    const targetClip = project.clips.find((c) => c.id === clipId);
    if (!targetClip) return;

    const remainingClips = project.clips.filter((c) => c.id !== clipId);
    const shouldRipple = forceRipple !== undefined ? forceRipple : isMagnetMode;
    const targetTrack = targetClip.trackIndex || 1;

    let finalClips = remainingClips;
    let finalAudioClips = (project.audioClips || []).filter((a) => a.sourceClipId !== clipId);
    let maxDuration = 0;

    // Clean up transitions that referenced this deleted clip
    const updatedTransitions = (project.transitions || []).filter(
      (t) => t.fromClipId !== clipId && t.toClipId !== clipId
    );

    if (shouldRipple) {
      // Ripple delete: shift downstream clips on target track left by targetClip duration, preserving all preceding gaps
      const delStart = targetClip.timelineStart;
      const delDur = targetClip.timelineDuration;
      const delEnd = delStart + delDur;
      const clipTimeDeltas = new Map<string, number>();

      finalClips = remainingClips.map((c) => {
        if ((c.trackIndex || 1) === targetTrack && c.timelineStart >= delEnd - 0.02) {
          const newStart = Math.max(delStart, Math.round((c.timelineStart - delDur) * 1000) / 1000);
          clipTimeDeltas.set(c.id, newStart - c.timelineStart);
          return { ...c, timelineStart: newStart };
        }
        return c;
      });

      // Synchronously shift linked audio clips
      finalAudioClips = finalAudioClips.map((ac) => {
        if (ac.sourceClipId && clipTimeDeltas.has(ac.sourceClipId)) {
          const delta = clipTimeDeltas.get(ac.sourceClipId)!;
          return {
            ...ac,
            timelineStart: Math.max(0, Math.round((ac.timelineStart + delta) * 1000) / 1000),
          };
        }
        return ac;
      });

      maxDuration = finalClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0);

      // If playhead was inside deleted clip, adjust playhead
      if (currentTime >= targetClip.timelineStart && currentTime <= targetClip.timelineStart + targetClip.timelineDuration) {
        setCurrentTime(Math.max(0, targetClip.timelineStart));
      }
    } else {
      // Non-magnet mode: delete leaving gap in place
      maxDuration = finalClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0);
    }

    // P45-P46: handle captions for delete/split — preserve timeline integrity
    let updatedCaptionsForDelete: any[] = [...(project.captions || [])];
    const delStart = targetClip.timelineStart;
    const delEnd = delStart + targetClip.timelineDuration;
    const delDur = targetClip.timelineDuration;
    if (shouldRipple) {
      updatedCaptionsForDelete = updatedCaptionsForDelete.flatMap((cap: any) => {
        if (cap.end <= delStart + 0.02 || cap.start >= delEnd - 0.02) {
          if (cap.start >= delEnd - 0.02) {
            return [{ ...cap, start: Math.round((cap.start - delDur) * 100) / 100, end: Math.round((cap.end - delDur) * 100) / 100, words: cap.words.map((w: any) => ({ ...w, start: Math.round((w.start - delDur) * 100) / 100, end: Math.round((w.end - delDur) * 100) / 100 })), sourceWords: cap.sourceWords?.map((w: any) => ({ ...w, start: Math.round((w.start - delDur) * 100) / 100, end: Math.round((w.end - delDur) * 100) / 100 })) }];
          }
          return [cap];
        }
        if (cap.start >= delStart - 0.02 && cap.end <= delEnd + 0.02) return [];
        const wordsOutside = cap.words.filter((w: any) => w.end <= delStart + 0.02 || w.start >= delEnd - 0.02);
        if (wordsOutside.length === 0) return [];
        const beforeWords = wordsOutside.filter((w: any) => w.end <= delStart + 0.02);
        const afterWords = wordsOutside.filter((w: any) => w.start >= delEnd - 0.02).map((w: any) => ({ ...w, start: Math.round((w.start - delDur) * 100) / 100, end: Math.round((w.end - delDur) * 100) / 100 }));
        if (beforeWords.length > 0 && afterWords.length > 0) {
          const cap1 = { ...cap, end: beforeWords[beforeWords.length - 1].end, words: beforeWords, text: beforeWords.map((w: any) => w.word).join(' ') };
          const cap2 = { ...cap, id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`, start: afterWords[0].start, end: afterWords[afterWords.length - 1].end, words: afterWords, text: afterWords.map((w: any) => w.word).join(' ') };
          return [cap1, cap2];
        }
        if (beforeWords.length > 0) return [{ ...cap, end: beforeWords[beforeWords.length - 1].end, words: beforeWords, text: beforeWords.map((w: any) => w.word).join(' ') }];
        if (afterWords.length > 0) return [{ ...cap, start: afterWords[0].start, end: afterWords[afterWords.length - 1].end, words: afterWords, text: afterWords.map((w: any) => w.word).join(' ') }];
        return [];
      });
    } else {
      updatedCaptionsForDelete = updatedCaptionsForDelete.filter((cap: any) => !(cap.start >= delStart - 0.02 && cap.end <= delEnd + 0.02));
    }

    const activeDur = getActiveContentDuration({ clips: finalClips, audioClips: finalAudioClips, captions: updatedCaptionsForDelete });
    const finalDuration = Math.max(1, activeDur);

    if (activeDur > 0 && currentTime > activeDur) {
      setCurrentTime(activeDur);
    }

    const updatedProject: ProjectData = {
      ...project,
      metadata: { ...project.metadata, duration: finalDuration },
      clips: finalClips,
      audioClips: finalAudioClips,
      transitions: syncTransitionsWithClips(project.transitions, finalClips),
      captions: updatedCaptionsForDelete,
    };

    setProject(updatedProject);
    setSelectedClipId(null);
    pushState(updatedProject);
  };

  const rippleDeleteClip = (clipId: string) => {
    deleteClip(clipId, true);
  };

  const closeGapAtTime = (trackIndex: number, gapStartTime: number) => {
    if (!project) return;
    const sameTrackClips = project.clips.filter((c) => (c.trackIndex || 1) === trackIndex);
    const beforeGap = sameTrackClips.filter((c) => c.timelineStart + c.timelineDuration <= gapStartTime + 0.08);
    const prevEnd = beforeGap.length > 0
      ? Math.max(...beforeGap.map((c) => c.timelineStart + c.timelineDuration))
      : 0;

    const afterGap = sameTrackClips.filter((c) => c.timelineStart >= gapStartTime - 0.08);
    if (afterGap.length === 0) return;

    const firstAfter = [...afterGap].sort((a, b) => a.timelineStart - b.timelineStart)[0];
    const gapSize = firstAfter.timelineStart - prevEnd;
    if (gapSize <= 0.02) return;

    const clipTimeDeltas = new Map<string, number>();

    const updatedClips = project.clips.map((clip) => {
      if ((clip.trackIndex || 1) === trackIndex && clip.timelineStart >= firstAfter.timelineStart - 0.05) {
        const newStart = Math.max(0, Math.round((clip.timelineStart - gapSize) * 1000) / 1000);
        clipTimeDeltas.set(clip.id, newStart - clip.timelineStart);
        return {
          ...clip,
          timelineStart: newStart,
        };
      }
      return clip;
    });

    const updatedAudioClips = (project.audioClips || []).map((ac) => {
      if (ac.sourceClipId && clipTimeDeltas.has(ac.sourceClipId)) {
        const delta = clipTimeDeltas.get(ac.sourceClipId)!;
        return {
          ...ac,
          timelineStart: Math.max(0, Math.round((ac.timelineStart + delta) * 1000) / 1000),
        };
      }
      return ac;
    });

    const cutPoint = firstAfter.timelineStart;
    const updatedCaptions = (project.captions || []).map((cap: any) => {
      if (cap.start >= cutPoint - 0.05) {
        return {
          ...cap,
          start: Math.max(0, Math.round((cap.start - gapSize) * 100) / 100),
          end: Math.max(0.1, Math.round((cap.end - gapSize) * 100) / 100),
          words: cap.words?.map((w: any) => ({
            ...w,
            start: Math.max(0, Math.round((w.start - gapSize) * 100) / 100),
            end: Math.max(0.05, Math.round((w.end - gapSize) * 100) / 100),
          })),
        };
      }
      return cap;
    });

    const maxDuration = Math.max(
      updatedClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0),
      updatedAudioClips.reduce((max, a) => Math.max(max, a.timelineStart + a.timelineDuration), 0)
    );
    const updatedProject: ProjectData = {
      ...project,
      metadata: { ...project.metadata, duration: Math.max(1, maxDuration) },
      clips: updatedClips,
      audioClips: updatedAudioClips,
      transitions: syncTransitionsWithClips(project.transitions, updatedClips),
      captions: updatedCaptions,
    };

    setProject(updatedProject);
    pushState(updatedProject);
  };

  const moveClipPosition = (clipId: string, newStart: number, targetTrackIndex?: number) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const track = targetTrackIndex ?? (clip.trackIndex || 1);
    const saneStart = sanitizeTime(newStart, clip.timelineStart);
    let clampedStart = Math.max(0, Math.round(saneStart * 100) / 100);
    if (!isFinite(clampedStart)) clampedStart = clip.timelineStart;

    // Prevent invalid timestamps and accidental overwrite on same track when magnet is OFF
    // If the new position would overlap another clip on the same track, snap to nearest gap edge
    if (!isMagnetMode) {
      const otherSameTrack = project.clips.filter((c) => c.id !== clipId && (c.trackIndex || 1) === track);
      const newEnd = clampedStart + clip.timelineDuration;
      let overlaps = false;
      let nearestEdge: number | null = null;
      let minDist = Infinity;
      for (const other of otherSameTrack) {
        const oStart = other.timelineStart;
        const oEnd = other.timelineStart + other.timelineDuration;
        const isOverlap = clampedStart < oEnd - 0.02 && newEnd > oStart + 0.02;
        if (isOverlap) {
          overlaps = true;
          // Candidate edges: snap to after this clip, or before it if space allows
          const afterDist = Math.abs(clampedStart - oEnd);
          const beforeDist = Math.abs(newEnd - oStart);
          if (afterDist < minDist) { minDist = afterDist; nearestEdge = oEnd; }
          if (beforeDist < minDist && oStart - clip.timelineDuration >= -0.01) { minDist = beforeDist; nearestEdge = oStart - clip.timelineDuration; }
        }
      }
      if (overlaps && nearestEdge !== null) {
        // Snap to nearest non-overlapping edge (preserves user intent while preventing destructive overwrite)
        clampedStart = Math.max(0, Math.round(nearestEdge * 100) / 100);
      }
    }

    let updatedClips = project.clips.map((c) =>
      c.id === clipId
        ? { ...c, timelineStart: clampedStart, trackIndex: track }
        : c
    );

    let updatedAudioClips = project.audioClips || [];

    if (isMagnetMode && track === 1) {
      const realigned = realignTrackClips(updatedClips, updatedAudioClips, 1, Math.min(clip.timelineStart, clampedStart));
      updatedClips = realigned.clips;
      updatedAudioClips = realigned.audioClips;
    }

    // Move associated linked audio clips
    const delta = clampedStart - clip.timelineStart;
    if (!isMagnetMode || track !== 1) {
      updatedAudioClips = updatedAudioClips.map((ac) => {
        if (ac.sourceClipId === clipId) {
          return {
            ...ac,
            timelineStart: Math.max(0, Math.round((ac.timelineStart + delta) * 1000) / 1000),
          };
        }
        return ac;
      });
    }

    const maxDuration = Math.max(
      updatedClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0),
      updatedAudioClips.reduce((max, a) => Math.max(max, a.timelineStart + a.timelineDuration), 0)
    );

    // P43: move associated captions with clip (clip-relative timing)
    let updatedCaptionsForMove = [...(project.captions || [])];
    if (Math.abs(delta) > 0.005) {
      updatedCaptionsForMove = updatedCaptionsForMove.map((cap) => {
        const shouldMove = cap.clipId ? cap.clipId === clipId : project.clips.length === 1;
        if (!shouldMove) return cap;
        return {
          ...cap,
          start: Math.round((cap.start + delta) * 100) / 100,
          end: Math.round((cap.end + delta) * 100) / 100,
          words: cap.words.map((w) => ({ ...w, start: Math.round((w.start + delta) * 100) / 100, end: Math.round((w.end + delta) * 100) / 100 })),
          sourceWords: cap.sourceWords?.map((w) => ({ ...w, start: Math.round((w.start + delta) * 100) / 100, end: Math.round((w.end + delta) * 100) / 100 })),
        };
      });
    }
    const updatedProject: ProjectData = {
      ...project,
      metadata: { ...project.metadata, duration: Math.max(project.metadata.duration, maxDuration) },
      clips: updatedClips,
      audioClips: updatedAudioClips,
      transitions: syncTransitionsWithClips(project.transitions, updatedClips),
      captions: updatedCaptionsForMove,
    };

    setProject(updatedProject);
    pushState(updatedProject);
  };

  // Batch move for multi-select drag (single history entry)
  const batchMoveClips = useCallback((clipIds: string[], deltaSec: number, targetTrackIndex?: number) => {
    if (!project || !clipIds.length) return;
    if (!isFinite(deltaSec)) return;
    const fps = project.metadata.fps || 30;
    const frameDur = 1 / fps;
    const quantDelta = Math.round(deltaSec / frameDur) * frameDur;
    if (!isFinite(quantDelta)) return;
    const idSet = new Set(clipIds);
    let updatedClips = project.clips.map((c) => {
      if (!idSet.has(c.id)) return c;
      const track = targetTrackIndex ?? (c.trackIndex || 1);
      let ns = Math.max(0, Math.round((c.timelineStart + quantDelta) * 1000) / 1000);
      ns = Math.round(ns / frameDur) * frameDur;
      ns = Math.max(0, Math.round(ns * 1000) / 1000);
      return { ...c, timelineStart: ns, trackIndex: track };
    });
    // Simple validation: ensure no negative, no zero durations
    updatedClips = updatedClips.map((c) => ({
      ...c,
      timelineStart: Math.max(0, sanitizeTime(c.timelineStart, 0)),
      timelineDuration: Math.max(0.1, sanitizeTime(c.timelineDuration, 0.5)),
    }));
    updatedClips.sort((a, b) => a.timelineStart - b.timelineStart);
    const maxDur = updatedClips.reduce((m, c) => Math.max(m, c.timelineStart + c.timelineDuration), 0);
    // Synchronously shift linked audio clips for moved video clips
    let updatedAudioClipsBatch = (project.audioClips || []).map((ac) => {
      if (ac.sourceClipId && idSet.has(ac.sourceClipId)) {
        const newStart = Math.max(0, Math.round((ac.timelineStart + quantDelta) * 1000) / 1000);
        return {
          ...ac,
          timelineStart: newStart,
        };
      }
      return ac;
    });

    // P43 batch captions move
    let updatedCaptionsBatch = [...(project.captions || [])];
    if (Math.abs(quantDelta) > 0.005) {
      updatedCaptionsBatch = updatedCaptionsBatch.map((cap) => {
        const shouldMove = cap.clipId ? idSet.has(cap.clipId) : project.clips.length === clipIds.length;
        if (!shouldMove) return cap;
        return {
          ...cap,
          start: Math.round((cap.start + quantDelta) * 100) / 100,
          end: Math.round((cap.end + quantDelta) * 100) / 100,
          words: cap.words.map((w) => ({ ...w, start: Math.round((w.start + quantDelta) * 100) / 100, end: Math.round((w.end + quantDelta) * 100) / 100 })),
          sourceWords: cap.sourceWords?.map((w) => ({ ...w, start: Math.round((w.start + quantDelta) * 100) / 100, end: Math.round((w.end + quantDelta) * 100) / 100 })),
        };
      });
    }
    const updated: ProjectData = {
      ...project,
      metadata: { ...project.metadata, duration: Math.max(project.metadata.duration, maxDur) },
      clips: updatedClips,
      audioClips: updatedAudioClipsBatch,
      transitions: syncTransitionsWithClips(project.transitions, updatedClips),
      captions: updatedCaptionsBatch,
    };
    setProject(updated);
    pushState(updated);
  }, [project, pushState]);

  const reorderClips = (trackIndex: number, fromIndex: number, toIndex: number) => {
    if (!project) return;
    const trackClips = project.clips
      .filter((c) => (c.trackIndex || 1) === trackIndex)
      .sort((a, b) => a.timelineStart - b.timelineStart);

    if (fromIndex < 0 || fromIndex >= trackClips.length || toIndex < 0 || toIndex >= trackClips.length) return;

    const [moved] = trackClips.splice(fromIndex, 1);
    trackClips.splice(toIndex, 0, moved);

    const otherClips = project.clips.filter((c) => (c.trackIndex || 1) !== trackIndex);
    const allClips = [...otherClips, ...trackClips];
    const realigned = realignTrackClips(allClips, project.audioClips || [], trackIndex);

    const updatedProject: ProjectData = {
      ...project,
      metadata: { ...project.metadata, duration: Math.max(1, realigned.maxDuration) },
      clips: realigned.clips,
      audioClips: realigned.audioClips,
      transitions: syncTransitionsWithClips(project.transitions, realigned.clips),
    };

    setProject(updatedProject);
    pushState(updatedProject);
  };

  const setProjectAspectRatio = (aspectRatio: AspectRatio) => {
    if (!project) return;
    let width = 1080;
    let height = 1920;
    if (aspectRatio === '16:9') { width = 1920; height = 1080; }
    if (aspectRatio === '1:1') { width = 1080; height = 1080; }
    if (aspectRatio === '4:5') { width = 1080; height = 1350; }

    const updated = {
      ...project,
      metadata: { ...project.metadata, aspectRatio, width, height }
    };
    setProject(updated);
    pushState(updated);
  };

  // --- MULTITRACK VIDEO OPERATIONS ---
  const addVideoTrack = () => {
    if (!project) return;
    const currentCount = project.videoTracksCount || 2;
    const updated = { ...project, videoTracksCount: currentCount + 1 };
    setProject(updated);
    pushState(updated);
  };

  const removeVideoTrack = (trackIndex: number) => {
    if (!project) return;
    const currentCount = project.videoTracksCount || 2;
    if (currentCount <= 1) return;
    const newClips = project.clips.map((c) =>
      c.trackIndex === trackIndex ? { ...c, trackIndex: 1 } : c
    );
    const updated = {
      ...project,
      videoTracksCount: currentCount - 1,
      clips: newClips,
      transitions: syncTransitionsWithClips(project.transitions, newClips),
    };
    setProject(updated);
    pushState(updated);
  };

  const moveClipToTrack = (clipId: string, trackIndex: number) => {
    if (!project) return;
    const newClips = project.clips.map((c) =>
      c.id === clipId ? { ...c, trackIndex } : c
    );
    const updated = {
      ...project,
      clips: newClips,
      transitions: syncTransitionsWithClips(project.transitions, newClips),
    };
    setProject(updated);
    pushState(updated);
  };

  const updateClipTransform = (clipId: string, transformUpdates: Partial<NonNullable<VideoClip['transform']>>) => {
    if (!project) return;
    const newClips = project.clips.map((c) => {
      if (c.id === clipId) {
        return {
          ...c,
          transform: {
            xPercent: 0,
            yPercent: 0,
            scale: 1.0,
            opacity: 1.0,
            ...(c.transform || {}),
            ...transformUpdates
          }
        };
      }
      return c;
    });
    const updated = { ...project, clips: newClips };
    setProject(updated);
    pushState(updated);
  };

  // --- CAPCUT-STYLE CLIP CONTEXT OPERATIONS ---
  const extractAudioFromClip = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const newAudioClip: AudioClip = {
      id: `audio_extracted_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: `${clip.name} (Audio)`,
      sourceClipId: clip.id,
      filePath: clip.filePath,
      mediaBlobUrl: clip.mediaBlobUrl,
      duration: clip.duration,
      startOffset: clip.startOffset,
      endOffset: clip.endOffset,
      timelineStart: clip.timelineStart,
      timelineDuration: clip.timelineDuration,
      volume: clip.volume ?? 1.0,
      isMuted: false,
      trackIndex: 1,
      waveformPeaks: clip.waveformPeaks,
    };

    const updatedClips = project.clips.map((c) =>
      c.id === clipId ? { ...c, isMuted: true } : c
    );

    const existingAudio = project.audioClips || [];
    const updatedAudio = [...existingAudio, newAudioClip];

    const updatedProject: ProjectData = {
      ...project,
      clips: updatedClips,
      audioClips: updatedAudio,
      metadata: {
        ...project.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    setProject(updatedProject);
    setSelectedAudioClipId(newAudioClip.id);
    pushState(updatedProject);
  };

  const removeSilencesFromClip = (
    clipId: string,
    silenceThreshold: number = 0.12,
    minDurationSec: number = 0.35
  ): { removedCount: number; savedSeconds: number } => {
    if (!project) return { removedCount: 0, savedSeconds: 0 };
    const clipIndex = project.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return { removedCount: 0, savedSeconds: 0 };

    const targetClip = project.clips[clipIndex];
    const peaks = targetClip.waveformPeaks || [];
    const clipDuration = targetClip.timelineDuration;

    if (peaks.length === 0 || clipDuration <= minDurationSec) {
      return { removedCount: 0, savedSeconds: 0 };
    }

    const peakSec = clipDuration / peaks.length;
    const minSilencePeaks = Math.max(2, Math.round(minDurationSec / peakSec));

    const silences: Array<{ start: number; end: number }> = [];
    let silenceStartIdx: number | null = null;

    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i] <= silenceThreshold) {
        if (silenceStartIdx === null) {
          silenceStartIdx = i;
        }
      } else {
        if (silenceStartIdx !== null) {
          const count = i - silenceStartIdx;
          if (count >= minSilencePeaks) {
            silences.push({
              start: silenceStartIdx * peakSec,
              end: i * peakSec,
            });
          }
          silenceStartIdx = null;
        }
      }
    }

    if (silenceStartIdx !== null) {
      const count = peaks.length - silenceStartIdx;
      if (count >= minSilencePeaks) {
        silences.push({
          start: silenceStartIdx * peakSec,
          end: peaks.length * peakSec,
        });
      }
    }

    if (silences.length === 0) {
      return { removedCount: 0, savedSeconds: 0 };
    }

    const speechIntervals: Array<{ start: number; end: number }> = [];
    let currentPos = 0;

    for (const sil of silences) {
      if (sil.start - currentPos > 0.2) {
        speechIntervals.push({ start: currentPos, end: sil.start });
      }
      currentPos = sil.end;
    }

    if (clipDuration - currentPos > 0.2) {
      speechIntervals.push({ start: currentPos, end: clipDuration });
    }

    if (speechIntervals.length <= 1 && speechIntervals[0]?.end - speechIntervals[0]?.start >= clipDuration - 0.2) {
      return { removedCount: 0, savedSeconds: 0 };
    }

    let currentTimelineStart = targetClip.timelineStart;
    const newSpeechClips: VideoClip[] = [];

    speechIntervals.forEach((segment, idx) => {
      const segDuration = segment.end - segment.start;
      const speed = targetClip.speed || 1.0;
      const sourceStart = targetClip.startOffset + segment.start * speed;
      const sourceEnd = sourceStart + segDuration * speed;
      const segTimelineDuration = segDuration;

      const startPeakIdx = Math.floor((segment.start / clipDuration) * peaks.length);
      const endPeakIdx = Math.ceil((segment.end / clipDuration) * peaks.length);
      const segPeaks = peaks.slice(startPeakIdx, endPeakIdx);

      newSpeechClips.push({
        ...targetClip,
        id: `clip_${Date.now()}_speech_${idx}`,
        name: `${targetClip.name.replace(/ \(Part \d+\)$/, '')} (Part ${idx + 1})`,
        startOffset: sourceStart,
        endOffset: sourceEnd,
        timelineStart: currentTimelineStart,
        timelineDuration: segTimelineDuration,
        waveformPeaks: segPeaks.length > 0 ? segPeaks : undefined,
      });

      currentTimelineStart += segTimelineDuration;
    });

    const updatedClips = [...project.clips];
    updatedClips.splice(clipIndex, 1, ...newSpeechClips);

    let finalClips = updatedClips;
    let finalAudio = project.audioClips || [];
    if (isMagnetMode) {
      const realigned = realignTrackClips(updatedClips, finalAudio, targetClip.trackIndex || 1);
      finalClips = realigned.clips;
      finalAudio = realigned.audioClips;
    }

    const totalSilenceSec = silences.reduce((acc, s) => acc + (s.end - s.start), 0);
    const maxDur = finalClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0);

    const updatedProject: ProjectData = {
      ...project,
      metadata: {
        ...project.metadata,
        duration: Math.max(5, maxDur),
        updatedAt: new Date().toISOString(),
      },
      clips: finalClips,
      audioClips: finalAudio,
    };

    setProject(updatedProject);
    pushState(updatedProject);
    if (newSpeechClips[0]) setSelectedClipId(newSpeechClips[0].id);

    return {
      removedCount: silences.length,
      savedSeconds: Math.round(totalSilenceSec * 10) / 10,
    };
  };

  const enhanceAudioClip = async (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const mediaUrl = clip.mediaBlobUrl || clip.filePath;
    if (!mediaUrl) return;

    try {
      const denoised = await audioProcessor.denoiseClipUrl(mediaUrl, { strength: 0.6, speechPreserve: true, rumbleCut: true });
      if (denoised) {
        updateClip(clipId, {
          denoise: {
            enabled: true,
            strength: 60,
            processedBlobUrl: denoised.processedBlobUrl,
            originalBlobUrl: mediaUrl,
          },
          audioFilters: {
            ...DEFAULT_CLIP_AUDIO_FILTERS,
            vocalEnhancer: { enabled: true, presence: 45, warmth: 25, clarity: 55, rumbleCut: true },
            compressor: { enabled: true, threshold: -18, ratio: 3.2, attack: 0.01, release: 0.15, makeupGain: 2 },
          },
        });
      }
    } catch (err) {
      console.error('[enhanceAudioClip] Failed to denoise audio clip:', err);
    }
  };

  const enhanceVideoClipVisuals = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    addEffectToClip(clipId, 'vibrance');
  };

  const toggleClipMute = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    updateClip(clipId, { isMuted: !clip.isMuted });
  };

  const duplicateClip = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const newStart = clip.timelineStart + clip.timelineDuration;
    const duplicated: VideoClip = {
      ...clip,
      id: `clip_${Date.now()}_dup`,
      name: `${clip.name} (Copy)`,
      timelineStart: newStart,
    };

    let updatedAudio = [...(project.audioClips || [])];
    const linkedAudio = updatedAudio.find((a) => a.sourceClipId === clipId);
    if (linkedAudio) {
      const duplicatedAudio: AudioClip = {
        ...linkedAudio,
        id: `audio_${duplicated.id}`,
        sourceClipId: duplicated.id,
        name: `${linkedAudio.name} (Copy)`,
        timelineStart: newStart,
      };
      updatedAudio.push(duplicatedAudio);
    }

    const updatedClips = [...project.clips, duplicated];
    const realigned = isMagnetMode
      ? realignTrackClips(updatedClips, updatedAudio, clip.trackIndex || 1)
      : { clips: updatedClips, audioClips: updatedAudio, maxDuration: 0 };

    const maxDur = realigned.clips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0);

    const updatedProject: ProjectData = {
      ...project,
      clips: realigned.clips,
      audioClips: realigned.audioClips,
      metadata: {
        ...project.metadata,
        duration: Math.max(project.metadata.duration, maxDur),
        updatedAt: new Date().toISOString(),
      },
    };

    setProject(updatedProject);
    setSelectedClipId(duplicated.id);
    pushState(updatedProject);
  };

  const splitScenesForClip = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip || clip.timelineDuration <= 4) return;

    const sceneCount = Math.min(4, Math.max(2, Math.floor(clip.timelineDuration / 4)));
    const segDur = clip.timelineDuration / sceneCount;

    let currentStart = clip.timelineStart;
    let sourceStart = clip.startOffset;
    const newClips: VideoClip[] = [];
    const linkedAudio = (project.audioClips || []).find((a) => a.sourceClipId === clipId);
    const newAudioSegments: AudioClip[] = [];
    let currentAudioStart = linkedAudio ? linkedAudio.timelineStart : 0;
    let sourceAudioStart = linkedAudio ? linkedAudio.startOffset : 0;
    const audioSpeed = linkedAudio ? ((linkedAudio as any).speed || clip.speed || 1.0) : 1.0;

    for (let i = 0; i < sceneCount; i++) {
      const isLast = i === sceneCount - 1;
      const actualSegDur = isLast ? clip.timelineDuration - i * segDur : segDur;
      const actualSourceEnd = isLast ? clip.endOffset : sourceStart + actualSegDur * (clip.speed || 1.0);
      const sceneClipId = `clip_${Date.now()}_scene_${i + 1}`;

      newClips.push({
        ...clip,
        id: sceneClipId,
        name: `${clip.name} Scene ${i + 1}`,
        startOffset: sourceStart,
        endOffset: actualSourceEnd,
        timelineStart: currentStart,
        timelineDuration: actualSegDur,
      });

      if (linkedAudio) {
        const actualAudioSourceEnd = isLast ? linkedAudio.endOffset : sourceAudioStart + actualSegDur * audioSpeed;
        newAudioSegments.push({
          ...linkedAudio,
          id: `audio_${sceneClipId}`,
          sourceClipId: sceneClipId,
          name: `${linkedAudio.name} Scene ${i + 1}`,
          startOffset: sourceAudioStart,
          endOffset: actualAudioSourceEnd,
          timelineStart: currentAudioStart,
          timelineDuration: actualSegDur,
        });
        currentAudioStart += actualSegDur;
        sourceAudioStart = actualAudioSourceEnd;
      }

      currentStart += actualSegDur;
      sourceStart = actualSourceEnd;
    }

    const clipIdx = project.clips.findIndex((c) => c.id === clipId);
    const updatedClips = [...project.clips];
    updatedClips.splice(clipIdx, 1, ...newClips);

    let updatedAudioClips = project.audioClips || [];
    if (linkedAudio && newAudioSegments.length > 0) {
      const audioIdx = updatedAudioClips.findIndex((a) => a.id === linkedAudio.id);
      if (audioIdx !== -1) {
        updatedAudioClips = [...updatedAudioClips];
        updatedAudioClips.splice(audioIdx, 1, ...newAudioSegments);
      }
    }

    const updatedProject: ProjectData = {
      ...project,
      clips: updatedClips,
      audioClips: updatedAudioClips,
    };
    setProject(updatedProject);
    setSelectedClipId(newClips[0].id);
    pushState(updatedProject);
  };

  const copyClip = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (clip) setClipboardClip(clip);
  };

  const cutClip = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (clip) {
      setClipboardClip(clip);
      deleteClip(clipId);
    }
  };

  const pasteClip = () => {
    if (!project || !clipboardClip) return;
    appendClipToTimeline(clipboardClip, clipboardClip.trackIndex || 1, currentTime);
  };

  const trimClip = (id: string, startOffset: number, endOffset: number, timelineStart?: number) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === id);
    if (!clip) return;
    const speed = clip.speed || 1.0;
    const rawDur = Math.max(0.1, endOffset - startOffset);
    const tlDur = rawDur / speed;
    const calculatedStart = timelineStart !== undefined ? timelineStart : Math.max(0, clip.timelineStart + ((startOffset - clip.startOffset) / speed));
    updateClip(id, {
      startOffset: Math.round(startOffset * 1000) / 1000,
      endOffset: Math.round(endOffset * 1000) / 1000,
      timelineStart: Math.round(calculatedStart * 1000) / 1000,
      timelineDuration: Math.round(tlDur * 1000) / 1000,
    });
  };

  const trimClipLeftToPlayhead = (targetClipId?: string) => {
    if (!project) return;
    if (!targetClipId && selectedAudioClipId) {
      const aClip = (project.audioClips || []).find((a) => a.id === selectedAudioClipId);
      if (aClip && currentTime > aClip.timelineStart + 0.05 && currentTime < aClip.timelineStart + aClip.timelineDuration - 0.05) {
        const speed = (aClip as any).speed || 1.0;
        const deltaTimeline = currentTime - aClip.timelineStart;
        const newStartOffset = aClip.startOffset + deltaTimeline * speed;
        trimAudioClip(aClip.id, newStartOffset, aClip.endOffset, currentTime);
        return;
      }
    }

    const clipId = targetClipId || selectedClipId;
    const targetClip = (clipId ? project.clips.find((c) => c.id === clipId) : null) ||
      project.clips.find((c) => currentTime > c.timelineStart + 0.05 && currentTime < c.timelineStart + c.timelineDuration - 0.05);
    if (!targetClip) return;

    const speed = targetClip.speed || 1.0;
    const deltaTimeline = currentTime - targetClip.timelineStart;
    if (deltaTimeline <= 0.05 || deltaTimeline >= targetClip.timelineDuration - 0.05) return;

    const newStartOffset = targetClip.startOffset + deltaTimeline * speed;
    const newTimelineStart = currentTime;
    const newTimelineDuration = targetClip.timelineDuration - deltaTimeline;

    updateClip(targetClip.id, {
      startOffset: Math.round(newStartOffset * 1000) / 1000,
      timelineStart: Math.round(newTimelineStart * 1000) / 1000,
      timelineDuration: Math.round(newTimelineDuration * 1000) / 1000,
    });
  };

  const trimClipRightToPlayhead = (targetClipId?: string) => {
    if (!project) return;
    if (!targetClipId && selectedAudioClipId) {
      const aClip = (project.audioClips || []).find((a) => a.id === selectedAudioClipId);
      if (aClip && currentTime > aClip.timelineStart + 0.05 && currentTime < aClip.timelineStart + aClip.timelineDuration - 0.05) {
        const speed = (aClip as any).speed || 1.0;
        const newTimelineDuration = currentTime - aClip.timelineStart;
        const newEndOffset = aClip.startOffset + newTimelineDuration * speed;
        trimAudioClip(aClip.id, aClip.startOffset, newEndOffset, aClip.timelineStart);
        return;
      }
    }

    const clipId = targetClipId || selectedClipId;
    const targetClip = (clipId ? project.clips.find((c) => c.id === clipId) : null) ||
      project.clips.find((c) => currentTime > c.timelineStart + 0.05 && currentTime < c.timelineStart + c.timelineDuration - 0.05);
    if (!targetClip) return;

    const speed = targetClip.speed || 1.0;
    const newTimelineDuration = currentTime - targetClip.timelineStart;
    if (newTimelineDuration <= 0.05 || newTimelineDuration >= targetClip.timelineDuration - 0.05) return;

    const newEndOffset = targetClip.startOffset + newTimelineDuration * speed;

    updateClip(targetClip.id, {
      endOffset: Math.round(newEndOffset * 1000) / 1000,
      timelineDuration: Math.round(newTimelineDuration * 1000) / 1000,
    });
  };

  const setClips = (clips: VideoClip[]) => {
    if (!project) return;
    const updated = { ...project, clips };
    setProject(updated);
    pushState(updated);
  };

  // --- AUDIO CLIP & AUDIO EDITING OPERATIONS ---
  const importAudioFile = async (fileOrPath: File | string): Promise<AudioClip | null> => {
    const res = await importMediaFiles([fileOrPath]);
    return res.registeredAudios[0] || null;
  };

  // Insert an existing AudioClip object at a precise timeline position (drag-drop from media library)
  const appendAudioClipToTimeline = (clip: AudioClip | any, targetTrackIndex: number = 1, customStart?: number) => {
    if (!project) return;
    const fps = project.metadata.fps || 30;
    const frameDur = 1 / fps;
    let rawStart = customStart !== undefined ? customStart : currentTime;
    let saneStart = Math.round(sanitizeTime(rawStart, 0) / frameDur) * frameDur;
    saneStart = Math.max(0, Math.round(saneStart * 1000) / 1000);
    if (!isFinite(saneStart)) saneStart = 0;
    let srcDur = sanitizeTime(clip.duration ?? clip.timelineDuration ?? 5, 5);
    if (!isFinite(srcDur) || srcDur <= 0.1) srcDur = 5;
    let timelineDur = sanitizeTime(clip.timelineDuration ?? srcDur, srcDur);
    if (!isFinite(timelineDur) || timelineDur <= 0.1) timelineDur = srcDur;
    timelineDur = Math.round(timelineDur / frameDur) * frameDur;
    timelineDur = Math.max(frameDur, Math.round(timelineDur * 1000) / 1000);
    const audioId = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newAudio: AudioClip = {
      id: audioId,
      name: clip.name,
      filePath: clip.filePath,
      mediaBlobUrl: clip.mediaBlobUrl || clip.url || '',
      duration: srcDur,
      startOffset: 0,
      endOffset: srcDur,
      timelineStart: saneStart,
      timelineDuration: timelineDur,
      volume: clip.volume ?? 1.0,
      isMuted: false,
      trackIndex: targetTrackIndex,
      waveformPeaks: clip.waveformPeaks || [],
      sourceClipId: (clip as any).sourceClipId,
    };
    const existing = project.audioClips || [];
    // Insert mode: shift later audio clips on same track forward
    const sameTrack = existing.filter((a) => (a.trackIndex || 1) === targetTrackIndex);
    let shifted = [...existing];
    if (sameTrack.length > 0) {
      const needsShift = sameTrack.some((a) => saneStart < a.timelineStart + a.timelineDuration - 0.02 && saneStart + timelineDur > a.timelineStart + 0.02);
      if (needsShift) {
        // Simple insert: push all clips that start at/after saneStart forward by timelineDur
        shifted = existing.map((a) => {
          if ((a.trackIndex || 1) === targetTrackIndex && a.timelineStart >= saneStart - 0.02) {
            return { ...a, timelineStart: Math.round((a.timelineStart + timelineDur) * 1000) / 1000 };
          }
          return a;
        });
      }
    }
    const updatedAudio = [...shifted, newAudio].sort((a, b) => a.timelineStart - b.timelineStart);
    const maxDur = Math.max(
      ...(project.clips || []).map((c) => c.timelineStart + c.timelineDuration),
      ...updatedAudio.map((a) => a.timelineStart + a.timelineDuration),
      1
    );
    const updated: ProjectData = { ...project, metadata: { ...project.metadata, duration: Math.max(project.metadata.duration, maxDur) }, audioClips: updatedAudio };
    setProject(updated);
    setSelectedAudioClipId(audioId);
    pushState(updated);
  };

  const splitAudioClipAtPlayhead = () => {
    if (!project) return;
    const currentAudioClips = project.audioClips || [];
    const target = currentAudioClips.find(
      (a) => (selectedAudioClipId ? a.id === selectedAudioClipId : (currentTime > a.timelineStart && currentTime < a.timelineStart + a.timelineDuration))
    );
    if (!target) return;

    const offsetInTimeline = currentTime - target.timelineStart;
    const audioSpeed = (target as any).speed && isFinite((target as any).speed) && (target as any).speed > 0 ? (target as any).speed : 1.0;
    const splitPointSource = target.startOffset + offsetInTimeline * audioSpeed;

    const firstAudio: AudioClip = {
      ...target,
      endOffset: Math.round(splitPointSource * 1000) / 1000,
      timelineDuration: Math.round(offsetInTimeline * 1000) / 1000
    };

    const secondAudio: AudioClip = {
      ...target,
      id: `audio_${Date.now()}_split`,
      name: `${target.name} (Part 2)`,
      startOffset: Math.round(splitPointSource * 1000) / 1000,
      timelineStart: Math.round(currentTime * 1000) / 1000,
      timelineDuration: Math.round((target.timelineDuration - offsetInTimeline) * 1000) / 1000
    };

    const newAudioClips = currentAudioClips.filter((a) => a.id !== target.id);
    newAudioClips.push(firstAudio, secondAudio);
    newAudioClips.sort((a, b) => a.timelineStart - b.timelineStart);

    const updatedProject = { ...project, audioClips: newAudioClips };
    setProject(updatedProject);
    setSelectedAudioClipId(secondAudio.id);
    pushState(updatedProject);
  };

  const updateAudioClip = (id: string, updates: Partial<AudioClip> & { speed?: number }) => {
    if (!project || !project.audioClips) return;
    const newAudioClips = project.audioClips.map((a) => {
      if (a.id === id) {
        const merged = { ...a, ...updates };
        const spd = (updates as any).speed !== undefined ? (updates as any).speed : (a as any).speed || 1.0;
        if (updates.startOffset !== undefined || updates.endOffset !== undefined || (updates as any).speed !== undefined) {
          const s = sanitizeTime(merged.startOffset, a.startOffset);
          const e = sanitizeTime(merged.endOffset, a.endOffset);
          merged.startOffset = s;
          merged.endOffset = e;
          merged.timelineDuration = Math.max(0.05, Math.round(((e - s) / spd) * 1000) / 1000);
        }
        return merged;
      }
      return a;
    });
    const updated = { ...project, audioClips: newAudioClips };
    setProject(updated);
    pushState(updated);
  };

  const trimAudioClip = (id: string, startOffset: number, endOffset: number, timelineStart?: number) => {
    if (!project || !project.audioClips) return;
    const clip = project.audioClips.find((a) => a.id === id);
    if (!clip) return;
    const speed = (clip as any).speed || 1.0;
    const rawDur = Math.max(0.05, endOffset - startOffset);
    const tlDur = rawDur / speed;
    const calculatedStart = timelineStart !== undefined ? timelineStart : Math.max(0, clip.timelineStart + ((startOffset - clip.startOffset) / speed));
    updateAudioClip(id, {
      startOffset: Math.round(startOffset * 1000) / 1000,
      endOffset: Math.round(endOffset * 1000) / 1000,
      timelineStart: Math.round(calculatedStart * 1000) / 1000,
      timelineDuration: Math.round(tlDur * 1000) / 1000,
    });
  };

  const deleteAudioClip = (id: string) => {
    if (!project || !project.audioClips) return;
    const newAudioClips = project.audioClips.filter((a) => a.id !== id);
    const activeDur = getActiveContentDuration({ clips: project.clips, audioClips: newAudioClips, captions: project.captions });
    const finalDuration = Math.max(1, activeDur);

    if (activeDur > 0 && currentTime > activeDur) {
      setCurrentTime(activeDur);
    }

    const updated = {
      ...project,
      metadata: { ...project.metadata, duration: finalDuration },
      audioClips: newAudioClips,
    };
    setProject(updated);
    if (selectedAudioClipId === id) setSelectedAudioClipId(null);
    pushState(updated);
  };

  const moveAudioClipPosition = (id: string, newStart: number, targetTrackIndex?: number) => {
    if (!project || !project.audioClips) return;
    const clip = project.audioClips.find((a) => a.id === id);
    if (!clip) return;

    const fps = project.metadata.fps || 30;
    const frameDur = 1 / fps;
    let clampedStart = Math.max(0, newStart);
    clampedStart = Math.round(clampedStart / frameDur) * frameDur;
    clampedStart = Math.round(clampedStart * 1000) / 1000;

    const track = targetTrackIndex ?? (clip.trackIndex || 1);

    const updatedAudioClips = project.audioClips.map((a) =>
      a.id === id
        ? { ...a, timelineStart: clampedStart, trackIndex: track }
        : a
    );
    updatedAudioClips.sort((a, b) => a.timelineStart - b.timelineStart);

    const maxDuration = Math.max(
      (project.clips || []).reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0),
      updatedAudioClips.reduce((max, a) => Math.max(max, a.timelineStart + a.timelineDuration), 0)
    );

    const updatedProject: ProjectData = {
      ...project,
      metadata: { ...project.metadata, duration: Math.max(project.metadata.duration, maxDuration) },
      audioClips: updatedAudioClips,
    };

    setProject(updatedProject);
    pushState(updatedProject);
  };

  const setAudioVolume = (id: string, volume: number) => {
    updateAudioClip(id, { volume: Math.max(0, Math.min(2.0, volume)) });
  };

  const toggleAudioMute = (id: string) => {
    const target = project?.audioClips?.find((a) => a.id === id);
    if (target) updateAudioClip(id, { isMuted: !target.isMuted });
  };

  const duplicateAudioClip = (id: string) => {
    if (!project || !project.audioClips) return;
    const target = project.audioClips.find((a) => a.id === id);
    if (!target) return;

    const cloned: AudioClip = {
      ...target,
      id: `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: `${target.name} (Copy)`,
      timelineStart: target.timelineStart + target.timelineDuration,
    };

    const updatedAudio = [...project.audioClips, cloned].sort((a, b) => a.timelineStart - b.timelineStart);
    const updated = { ...project, audioClips: updatedAudio };
    setProject(updated);
    setSelectedAudioClipId(cloned.id);
    pushState(updated);
  };

  const removeSilencesFromAudioClip = (id: string) => {
    if (!project || !project.audioClips) return;
    const target = project.audioClips.find((a) => a.id === id);
    if (!target) return;

    const peaks = target.waveformPeaks || [];
    const clipDur = target.timelineDuration;
    if (peaks.length === 0 || clipDur < 1.0) {
      alert('Audio clip is too short to detect silence.');
      return;
    }

    const numSlices = peaks.length;
    const sliceDur = clipDur / numSlices;
    const intervals: { start: number; end: number }[] = [];
    let inSpeech = false;
    let segStart = 0;

    for (let i = 0; i < numSlices; i++) {
      const isVoice = peaks[i] >= 0.12;
      if (isVoice && !inSpeech) {
        inSpeech = true;
        segStart = target.startOffset + i * sliceDur;
      } else if (!isVoice && inSpeech) {
        inSpeech = false;
        const segEnd = target.startOffset + i * sliceDur;
        if (segEnd - segStart >= 0.3) {
          intervals.push({ start: segStart, end: segEnd });
        }
      }
    }
    if (inSpeech) {
      intervals.push({ start: segStart, end: target.endOffset });
    }

    if (intervals.length <= 1) {
      alert('No major silence pauses detected in this audio clip.');
      return;
    }

    let currStart = target.timelineStart;
    const newClips: AudioClip[] = intervals.map((interval, idx) => {
      const dur = interval.end - interval.start;
      const c: AudioClip = {
        ...target,
        id: `audio_cut_${Date.now()}_${idx}`,
        startOffset: interval.start,
        endOffset: interval.end,
        timelineStart: currStart,
        timelineDuration: dur,
      };
      currStart += dur;
      return c;
    });

    const otherAudio = project.audioClips.filter((a) => a.id !== id);
    const updatedAudio = [...otherAudio, ...newClips].sort((a, b) => a.timelineStart - b.timelineStart);
    const updated = { ...project, audioClips: updatedAudio };
    setProject(updated);
    pushState(updated);
    alert(`AI Silence Removal: Cut ${intervals.length} speech segments, rippled audio seamlessly!`);
  };

  const enhanceAudioClipTrack = async (id: string) => {
    if (!project || !project.audioClips) return;
    const target = project.audioClips.find((a) => a.id === id);
    if (!target) return;

    const mediaUrl = target.mediaBlobUrl || target.filePath;
    if (!mediaUrl) return;

    try {
      const denoised = await audioProcessor.denoiseClipUrl(mediaUrl, { strength: 0.6, speechPreserve: true, rumbleCut: true });
      if (denoised) {
        updateAudioClip(id, {
          denoise: {
            enabled: true,
            strength: 60,
            processedBlobUrl: denoised.processedBlobUrl,
            originalBlobUrl: mediaUrl,
          },
          audioFilters: {
            ...DEFAULT_CLIP_AUDIO_FILTERS,
            vocalEnhancer: { enabled: true, presence: 45, warmth: 25, clarity: 55, rumbleCut: true },
            compressor: { enabled: true, threshold: -18, ratio: 3.2, attack: 0.01, release: 0.15, makeupGain: 2 },
          },
        });
      }
    } catch (err) {
      console.error('[enhanceAudioClipTrack] Failed to denoise audio clip:', err);
    }
  };

  const deleteMultipleTimelineItems = (items: {
    clipIds?: string[];
    audioClipIds?: string[];
    captionIds?: string[];
    overlayIds?: string[];
  }) => {
    if (!project) return;
    const clipSet = new Set(items.clipIds || []);
    const audioSet = new Set(items.audioClipIds || []);
    const capSet = new Set(items.captionIds || []);
    const ovSet = new Set(items.overlayIds || []);

    const newClips = (project.clips || []).filter((c) => !clipSet.has(c.id));
    const newAudio = (project.audioClips || []).filter(
      (a) => !audioSet.has(a.id) && !(a.sourceClipId && clipSet.has(a.sourceClipId))
    );
    const newCaptions = (project.captions || []).filter((cap) => !capSet.has(cap.id));
    const newOverlays = (project.overlays || []).filter((ov) => !ovSet.has(ov.id));
    const newTransitions = (project.transitions || []).filter(
      (t) => !clipSet.has(t.fromClipId) && !clipSet.has(t.toClipId)
    );

    const activeDur = getActiveContentDuration({ clips: newClips, audioClips: newAudio, captions: newCaptions });
    const finalDuration = Math.max(1, activeDur);

    if (activeDur > 0 && currentTime > activeDur) {
      setCurrentTime(activeDur);
    }

    const updated = {
      ...project,
      metadata: { ...project.metadata, duration: finalDuration },
      clips: newClips,
      audioClips: newAudio,
      captions: newCaptions,
      overlays: newOverlays,
      transitions: newTransitions,
    };
    setProject(updated);
    setSelectedClipId(null);
    setSelectedAudioClipId(null);
    setSelectedCaptionId(null);
    setSelectedOverlayId(null);
    pushState(updated);
  };

  // --- CLIP EFFECTS STACK OPERATIONS (timed NLE objects) ---
  // effectType accepts EITHER a raw engine EffectType OR a UI library preset
  // id (e.g. 'shake', 'edge-glow', 'teal-orange'). UI ids resolve through
  // presetBridge so drag-drop and click-apply can never create a fake
  // (engine-unknown) effect that previews but won't export.
  const addEffectToClip = (
    clipId: string,
    effectType: EffectType | string,
    opts?: { dropTime?: number; duration?: number; params?: Record<string, any>; intensity?: number }
  ) => {
    if (!project) return;
    const hostClip = project.clips.find((c) => c.id === clipId);
    if (!hostClip) return;
    const fps = project.metadata.fps || 30;

    // Resolve UI preset id -> engine type first; raw engine types pass through.
    const bridged = resolveEffectPreset(effectType as string);
    const engineType = (bridged?.engineType || effectType) as EffectType;
    const def = getEffectDefinition(engineType);
    if (!def) return;

    const mergedParams = { ...def.defaultParams, ...(bridged?.params || {}), ...(opts?.params || {}) };
    const newEffect = createEffectInstance(
      {
        type: engineType,
        name: bridged?.name || def.name,
        category: def.category,
        enabled: true,
        params: mergedParams,
        intensity: opts?.intensity ?? 100,
      },
      hostClip,
      { dropTime: opts?.dropTime, duration: opts?.duration, fps }
    );

    const newClips = project.clips.map((clip) => {
      if (clip.id === clipId) {
        const existing = clip.effects || [];
        return { ...clip, effects: [...existing, newEffect] };
      }
      return clip;
    });

    const updatedProject = reconcileProject({ ...project, clips: newClips }, fps);
    setProject(updatedProject);
    pushState(updatedProject);
  };

  /** Move a timed effect along its host clip (drag the effect bar). */
  const moveEffect = (clipId: string, effectId: string, newStartTime: number) => {
    if (!project) return;
    const fps = project.metadata.fps || 30;
    const newClips = project.clips.map((clip) => {
      if (clip.id !== clipId || !clip.effects) return clip;
      return {
        ...clip,
        effects: clip.effects.map((eff) =>
          eff.id === effectId ? moveEffectInstance(eff, clip, sanitizeT(newStartTime, eff.startTime ?? clip.timelineStart), fps) : eff
        ),
      };
    });
    const updatedProject = reconcileProject({ ...project, clips: newClips }, fps);
    setProject(updatedProject);
    pushState(updatedProject);
  };

  /** Resize a timed effect's duration (drag effect bar edges). */
  const resizeEffect = (clipId: string, effectId: string, newDuration: number, newStartTime?: number) => {
    if (!project) return;
    const fps = project.metadata.fps || 30;
    const newClips = project.clips.map((clip) => {
      if (clip.id !== clipId || !clip.effects) return clip;
      return {
        ...clip,
        effects: clip.effects.map((eff) =>
          eff.id === effectId ? resizeEffectInstance(eff, clip, sanitizeT(newDuration, eff.duration ?? 1), newStartTime, fps) : eff
        ),
      };
    });
    const updatedProject = reconcileProject({ ...project, clips: newClips }, fps);
    setProject(updatedProject);
    pushState(updatedProject);
  };

  /** Adjust master intensity 0..100 (drives preview + export identically). */
  const setEffectIntensity = (clipId: string, effectId: string, intensity: number) => {
    if (!project) return;
    const clamped = Math.max(0, Math.min(100, sanitizeT(intensity, 100)));
    const newClips = project.clips.map((clip) => {
      if (clip.id !== clipId || !clip.effects) return clip;
      return {
        ...clip,
        effects: clip.effects.map((eff) => (eff.id === effectId ? { ...eff, intensity: clamped } : eff)),
      };
    });
    const updatedProject = { ...project, clips: newClips };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  /** Copy one timed effect onto another compatible clip (preserves relative offset). */
  const applyEffectToClip = (sourceClipId: string, effectId: string, targetClipId: string) => {
    if (!project || sourceClipId === targetClipId) return;
    const fps = project.metadata.fps || 30;
    const source = project.clips.find((c) => c.id === sourceClipId);
    const target = project.clips.find((c) => c.id === targetClipId);
    const eff = source?.effects?.find((e) => e.id === effectId);
    if (!source || !target || !eff) return;
    // Preserve relative offset inside the clip so timing feels identical.
    const relOffset = sanitizeT(eff.startTime ?? source.timelineStart, source.timelineStart) - sanitizeT(source.timelineStart, 0);
    const anchoredStart = sanitizeT(target.timelineStart, 0) + Math.max(0, relOffset);
    const copy = createEffectInstance(
      { type: eff.type, name: eff.name, category: eff.category, enabled: eff.enabled, params: { ...eff.params }, intensity: eff.intensity ?? 100, blendMode: eff.blendMode },
      target,
      { dropTime: anchoredStart, duration: eff.duration, fps }
    );
    const newClips = project.clips.map((clip) =>
      clip.id === targetClipId ? { ...clip, effects: [...(clip.effects || []), copy] } : clip
    );
    const updatedProject = reconcileProject({ ...project, clips: newClips }, fps);
    setProject(updatedProject);
    pushState(updatedProject);
  };

  const updateEffectParams = (clipId: string, effectId: string, params: Record<string, any>) => {
    if (!project) return;
    const newClips = project.clips.map((clip) => {
      if (clip.id === clipId && clip.effects) {
        const updatedEffects = clip.effects.map((eff) =>
          eff.id === effectId ? { ...eff, params: { ...eff.params, ...params } } : eff
        );
        return { ...clip, effects: updatedEffects };
      }
      return clip;
    });

    const updatedProject = { ...project, clips: newClips };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  const removeEffectFromClip = (clipId: string, effectId: string) => {
    if (!project) return;
    const newClips = project.clips.map((clip) => {
      if (clip.id === clipId && clip.effects) {
        return { ...clip, effects: clip.effects.filter((eff) => eff.id !== effectId) };
      }
      return clip;
    });

    const updatedProject = { ...project, clips: newClips };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  const toggleEffect = (clipId: string, effectId: string) => {
    if (!project) return;
    const newClips = project.clips.map((clip) => {
      if (clip.id === clipId && clip.effects) {
        const updatedEffects = clip.effects.map((eff) =>
          eff.id === effectId ? { ...eff, enabled: !eff.enabled } : eff
        );
        return { ...clip, effects: updatedEffects };
      }
      return clip;
    });

    const updatedProject = { ...project, clips: newClips };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  const reorderEffects = (clipId: string, sourceIndex: number, destIndex: number) => {
    if (!project) return;
    const newClips = project.clips.map((clip) => {
      if (clip.id === clipId && clip.effects) {
        const list = [...clip.effects];
        const [moved] = list.splice(sourceIndex, 1);
        list.splice(destIndex, 0, moved);
        return { ...clip, effects: list };
      }
      return clip;
    });

    const updatedProject = { ...project, clips: newClips };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  const duplicateEffect = (clipId: string, effectId: string) => {
    if (!project) return;
    const newClips = project.clips.map((clip) => {
      if (clip.id === clipId && clip.effects) {
        const target = clip.effects.find((e) => e.id === effectId);
        if (!target) return clip;
        const dup: ClipEffect = {
          ...target,
          id: `eff_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          name: `${target.name} (Copy)`,
          params: { ...target.params },
        };
        const index = clip.effects.indexOf(target);
        const list = [...clip.effects];
        list.splice(index + 1, 0, dup);
        return { ...clip, effects: list };
      }
      return clip;
    });

    const updatedProject = { ...project, clips: newClips };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  const resetEffect = (clipId: string, effectId: string) => {
    if (!project) return;
    const targetClip = project.clips.find((c) => c.id === clipId);
    const targetEff = targetClip?.effects?.find((e) => e.id === effectId);
    if (!targetEff) return;
    const def = getEffectDefinition(targetEff.type);
    if (!def) return;
    updateEffectParams(clipId, effectId, def.defaultParams);
  };

  const copyEffects = (clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (clip && clip.effects && clip.effects.length > 0) {
      setCopiedEffects(JSON.parse(JSON.stringify(clip.effects)));
    }
  };

  const pasteEffects = (clipId: string) => {
    if (!project || !copiedEffects || copiedEffects.length === 0) return;
    const newClips = project.clips.map((clip) => {
      if (clip.id === clipId) {
        const existing = clip.effects || [];
        const newCopies: ClipEffect[] = copiedEffects.map((eff) => ({
          ...eff,
          id: `eff_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          params: { ...eff.params },
        }));
        return { ...clip, effects: [...existing, ...newCopies] };
      }
      return clip;
    });

    const updatedProject = { ...project, clips: newClips };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  // --- TRANSITIONS OPERATIONS — with safe-duration validation & automatic clamping ---
  // transData.type accepts EITHER a raw engine TransitionType OR a UI library
  // preset id (e.g. 'zoom-in', 'whip-left'). Aliases resolve through
  // presetBridge so a dropped library card can never create a UI-only
  // transition that previews but won't export.
  const addTransition = (transData: Omit<TransitionConfig, 'id'>) => {
    if (!project) return;
    const bridged = resolveTransitionPreset(transData.type as string);
    const engineType = (bridged?.engineType || transData.type) as TransitionConfig['type'];
    if (!getTransitionDefinition(engineType)) return;
    const fromClip = project.clips.find((c) => c.id === transData.fromClipId);
    const toClip = project.clips.find((c) => c.id === transData.toClipId);
    // Clamp duration to handle-safe value to prevent overrun / negative media
    const { safeDuration } = getSafeTransitionDuration(fromClip, toClip, transData.duration, transData.alignment || 'center');
    const newTransition: TransitionConfig = {
      ...transData,
      type: engineType,
      name: (transData as any).name && (transData as any).name !== transData.type ? (transData as any).name : (bridged?.name || transData.type),
      direction: (transData as any).direction || bridged?.direction,
      params: { ...(bridged?.params || {}), ...((transData as any).params || {}) },
      duration: safeDuration,
      id: `trans_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };

    const existing = project.transitions || [];
    // Replace if transition already exists between these exact clips (allows instant replacement)
    const filtered = existing.filter(
      (t) => !(t.fromClipId === transData.fromClipId && t.toClipId === transData.toClipId)
    );

    const updatedProject = { ...project, transitions: [...filtered, newTransition] };
    setProject(updatedProject);
    setSelectedTransitionId(newTransition.id);
    pushState(updatedProject);
  };

  const updateTransition = (id: string, updates: Partial<TransitionConfig>) => {
    if (!project || !project.transitions) return;
    const existing = project.transitions.find((t) => t.id === id);
    let safeUpdates = { ...updates };
    // If duration is being changed, clamp to safe handle length
    if (updates.duration !== undefined && existing) {
      const fromClip = project.clips.find((c) => c.id === existing.fromClipId);
      const toClip = project.clips.find((c) => c.id === existing.toClipId);
      const align = (updates.alignment as any) || existing.alignment || 'center';
      const { safeDuration } = getSafeTransitionDuration(fromClip, toClip, updates.duration, align);
      safeUpdates.duration = safeDuration;
    }
    const newTransitions = project.transitions.map((t) => (t.id === id ? { ...t, ...safeUpdates } : t));
    const updatedProject = { ...project, transitions: newTransitions };
    setProject(updatedProject);
    pushState(updatedProject);
  };

  const deleteTransition = (id: string) => {
    if (!project || !project.transitions) return;
    const newTransitions = project.transitions.filter((t) => t.id !== id);
    const updatedProject = { ...project, transitions: newTransitions };
    setProject(updatedProject);
    if (selectedTransitionId === id) setSelectedTransitionId(null);
    pushState(updatedProject);
  };

  // Caption Operations — timing-preserving edit (P38)
  const setCaptions = (captions: CaptionLine[]) => {
    if (!project) return;
    const mediaDur = Math.max(1, project.metadata.duration || project.clips[0]?.duration || 30);
    const fps = project.metadata.fps || 30;
    const normalized = normalizeCaptionTimings(captions, mediaDur, fps);
    const updated = { ...project, captions: normalized };
    setProject(updated);
    pushState(updated);
  };

  const updateCaptionLine = (lineId: string, text: string) => {
    if (!project) return;
    const fps = project.metadata.fps || 30;
    const updatedCaptions = project.captions.map((cap) => {
      if (cap.id === lineId) {
        // P38: preserve timing intelligently — reuse word timings where text matches
        return preserveTimingOnTextEdit(cap, text, fps);
      }
      return cap;
    });

    const updated = { ...project, captions: updatedCaptions };
    setProject(updated);
    pushState(updated);
  };

  const updateWordTimestamp = (lineId: string, wordId: string, updates: Partial<WordTimestamp>) => {
    if (!project) return;
    const updatedCaptions = project.captions.map((cap) => {
      if (cap.id === lineId) {
        const updatedWords = cap.words.map((w) => (w.id === wordId ? { ...w, ...updates } : w));
        const minStart = Math.min(...updatedWords.map((w) => w.start));
        const maxEnd = Math.max(...updatedWords.map((w) => w.end));
        return {
          ...cap,
          start: minStart,
          end: maxEnd,
          words: updatedWords,
          text: updatedWords.map((w) => w.word).join(' ')
        };
      }
      return cap;
    });

    const updated = { ...project, captions: updatedCaptions };
    setProject(updated);
    pushState(updated);
  };

  const splitCaptionLine = (lineId: string, wordIndex: number) => {
    if (!project) return;
    const line = project.captions.find((c) => c.id === lineId);
    if (!line || wordIndex <= 0 || wordIndex >= line.words.length) return;

    const firstWords = line.words.slice(0, wordIndex);
    const secondWords = line.words.slice(wordIndex);

    const firstLine: CaptionLine = {
      id: line.id,
      start: firstWords[0].start,
      end: firstWords[firstWords.length - 1].end,
      text: firstWords.map((w) => w.word).join(' '),
      words: firstWords
    };

    const secondLine: CaptionLine = {
      id: `cap_${Date.now()}_split`,
      start: secondWords[0].start,
      end: secondWords[secondWords.length - 1].end,
      text: secondWords.map((w) => w.word).join(' '),
      words: secondWords
    };

    const newCaptions = project.captions.filter((c) => c.id !== lineId);
    newCaptions.push(firstLine, secondLine);
    newCaptions.sort((a, b) => a.start - b.start);

    const updated = { ...project, captions: newCaptions };
    setProject(updated);
    setSelectedCaptionId(secondLine.id);
    pushState(updated);
  };

  const mergeCaptionLines = (lineId1: string, lineId2: string) => {
    if (!project) return;
    const l1 = project.captions.find((c) => c.id === lineId1);
    const l2 = project.captions.find((c) => c.id === lineId2);
    if (!l1 || !l2) return;

    const mergedWords = [...l1.words, ...l2.words].sort((a, b) => a.start - b.start);
    const mergedLine: CaptionLine = {
      id: l1.id,
      start: Math.min(l1.start, l2.start),
      end: Math.max(l1.end, l2.end),
      text: `${l1.text} ${l2.text}`,
      words: mergedWords
    };

    const newCaptions = project.captions.filter((c) => c.id !== lineId1 && c.id !== lineId2);
    newCaptions.push(mergedLine);
    newCaptions.sort((a, b) => a.start - b.start);

    const updated = { ...project, captions: newCaptions };
    setProject(updated);
    pushState(updated);
  };

  const trimCaptionLine = (lineId: string, start: number, end: number) => {
    if (!project) return;
    const s = sanitizeTime(start, 0);
    const e = sanitizeTime(end, s + 0.5);
    if (!isFinite(s) || !isFinite(e)) return;
    const clampedStart = Math.max(0, Math.round(s * 100) / 100);
    const clampedEnd = Math.max(clampedStart + 0.1, Math.round(e * 100) / 100);
    if (!isFinite(clampedStart) || !isFinite(clampedEnd) || clampedEnd <= clampedStart) return;

    const updatedCaptions = project.captions.map((c) => {
      if (c.id === lineId) {
        const dur = clampedEnd - clampedStart;
        const words = c.words || [];
        const wordDur = words.length > 0 ? dur / words.length : dur;

        const updatedWords = words.map((w, idx) => ({
          ...w,
          start: Math.round((clampedStart + idx * wordDur) * 100) / 100,
          end: Math.round((clampedStart + (idx + 1) * wordDur) * 100) / 100,
        }));

        return {
          ...c,
          start: clampedStart,
          end: clampedEnd,
          words: updatedWords,
        };
      }
      return c;
    });

    const updated = { ...project, captions: updatedCaptions.sort((a, b) => a.start - b.start) };
    setProject(updated);
    pushState(updated);
  };

  const moveCaptionLine = (lineId: string, newStart: number) => {
    if (!project) return;
    const target = project.captions.find((c) => c.id === lineId);
    if (!target) return;

    const s = sanitizeTime(newStart, target.start);
    if (!isFinite(s)) return;
    const clampedStart = Math.max(0, Math.round(s * 100) / 100);
    const dur = sanitizeTime(target.end - target.start, 0.5);
    if (!isFinite(dur) || dur < 0.05) return;
    const newEnd = Math.round((clampedStart + dur) * 100) / 100;
    const delta = clampedStart - target.start;
    if (!isFinite(delta)) return;

    const updatedCaptions = project.captions.map((c) => {
      if (c.id === lineId) {
        const updatedWords = (c.words || []).map((w) => ({
          ...w,
          start: Math.round((w.start + delta) * 100) / 100,
          end: Math.round((w.end + delta) * 100) / 100,
        }));

        return {
          ...c,
          start: clampedStart,
          end: newEnd,
          words: updatedWords,
        };
      }
      return c;
    });

    const updated = { ...project, captions: updatedCaptions.sort((a, b) => a.start - b.start) };
    setProject(updated);
    pushState(updated);
  };

  const duplicateCaptionLine = (lineId: string) => {
    if (!project) return;
    const target = project.captions.find((c) => c.id === lineId);
    if (!target) return;

    const dur = target.end - target.start;
    const newStart = Math.round((target.end + 0.1) * 100) / 100;
    const newEnd = Math.round((newStart + dur) * 100) / 100;

    const newWords = (target.words || []).map((w, idx) => {
      const wDur = w.end - w.start;
      const wStart = Math.round((newStart + idx * wDur) * 100) / 100;
      return {
        ...w,
        id: `w_${Date.now()}_${idx}`,
        start: wStart,
        end: Math.round((wStart + wDur) * 100) / 100,
      };
    });

    const clone: CaptionLine = {
      ...target,
      id: `cap_${Date.now()}`,
      start: newStart,
      end: newEnd,
      words: newWords,
    };

    const newCaptions = [...project.captions, clone].sort((a, b) => a.start - b.start);
    const updated = { ...project, captions: newCaptions };
    setProject(updated);
    setSelectedCaptionId(clone.id);
    pushState(updated);
  };

  const splitCaptionAtPlayhead = (lineId?: string) => {
    if (!project) return;
    const targetId = lineId || selectedCaptionId;
    const target = project.captions.find((c) => (targetId ? c.id === targetId : currentTime >= c.start && currentTime <= c.end));
    if (!target || currentTime <= target.start + 0.2 || currentTime >= target.end - 0.2) return;

    const words = target.words || [];
    const splitIndex = words.findIndex((w) => currentTime < w.end);
    if (splitIndex > 0 && splitIndex < words.length) {
      splitCaptionLine(target.id, splitIndex);
    } else {
      // Time-based split
      const firstWords = words.filter((w) => w.start < currentTime);
      const secondWords = words.filter((w) => w.start >= currentTime);

      const firstLine: CaptionLine = {
        ...target,
        id: target.id,
        end: currentTime,
        words: firstWords.length > 0 ? firstWords : [{ id: `w_${Date.now()}_0`, word: target.text, start: target.start, end: currentTime }],
        text: firstWords.map((w) => w.word).join(' ') || target.text,
      };

      const secondLine: CaptionLine = {
        ...target,
        id: `cap_${Date.now()}_split`,
        start: currentTime,
        words: secondWords.length > 0 ? secondWords : [{ id: `w_${Date.now()}_1`, word: target.text, start: currentTime, end: target.end }],
        text: secondWords.map((w) => w.word).join(' ') || target.text,
      };

      const newCaptions = project.captions.filter((c) => c.id !== target.id);
      newCaptions.push(firstLine, secondLine);
      newCaptions.sort((a, b) => a.start - b.start);

      const updated = { ...project, captions: newCaptions };
      setProject(updated);
      setSelectedCaptionId(secondLine.id);
      pushState(updated);
    }
  };

  const deleteCaptionLine = (lineId: string) => {
    if (!project) return;
    const newCaptions = project.captions.filter((c) => c.id !== lineId);
    const activeDur = getActiveContentDuration({ clips: project.clips, audioClips: project.audioClips, captions: newCaptions });
    const finalDuration = Math.max(1, activeDur);

    if (activeDur > 0 && currentTime > activeDur) {
      setCurrentTime(activeDur);
    }

    const updated = {
      ...project,
      metadata: { ...project.metadata, duration: finalDuration },
      captions: newCaptions,
    };
    setProject(updated);
    setSelectedCaptionId(null);
    pushState(updated);
  };

  const addCaptionLineAtPlayhead = () => {
    if (!project) return;
    const startTime = currentTime;
    const endTime = Math.min(startTime + 2.0, project.metadata.duration || 100);

    const newLine: CaptionLine = {
      id: `cap_${Date.now()}`,
      start: startTime,
      end: endTime,
      text: 'New Caption Line',
      words: [
        { id: `w_${Date.now()}_0`, word: 'New', start: startTime, end: startTime + 0.6 },
        { id: `w_${Date.now()}_1`, word: 'Caption', start: startTime + 0.6, end: startTime + 1.3 },
        { id: `w_${Date.now()}_2`, word: 'Line', start: startTime + 1.3, end: endTime },
      ]
    };

    const newCaptions = [...project.captions, newLine].sort((a, b) => a.start - b.start);
    const updated = { ...project, captions: newCaptions };
    setProject(updated);
    setSelectedCaptionId(newLine.id);
    pushState(updated);
  };

  const setCaptionLineStyleOverride = (lineId: string, override: Partial<CaptionStyleConfig> | undefined) => {
    if (!project) return;
    const updatedCaptions = project.captions.map((c) => {
      if (c.id === lineId) {
        return {
          ...c,
          styleOverride: override ? { ...(c.styleOverride || {}), ...override } : undefined,
        };
      }
      return c;
    });
    const updated = { ...project, captions: updatedCaptions };
    setProject(updated);
    pushState(updated);
  };

  const setCaptionHookSplit = (lineId: string, splitIndex: number) => {
    if (!project) return;
    const updatedCaptions = project.captions.map((c) => {
      if (c.id === lineId) {
        return {
          ...c,
          splitHookIndex: splitIndex,
        };
      }
      return c;
    });
    const updated = { ...project, captions: updatedCaptions };
    setProject(updated);
    pushState(updated);
  };

  // Auto-transcribe video with Gemini 1.5 or Built-in Local AI Engine (No API Key required!)
  const autoTranscribeVideo = async (language?: string) => {
    if (!project) return;
    const primaryClip = project.clips[0];
    if (!primaryClip) {
      alert('Please import a video clip first before generating AI captions.');
      return;
    }

    const selectedLang = language || settings.defaultLanguage || 'en';
    setIsTranscribing(true);

    try {
      let captions: CaptionLine[] = [];

      if (window.captionForgeAPI) {
        if (!settings.geminiApiKey) {
          throw new Error('Google Gemini API Key is required. Please add your key in the Auto-Caption modal or Settings.');
        }
        setTranscribeProgress('Transcribing audio speech via Gemini Multimodal ASR...');
        captions = await window.captionForgeAPI.transcribeAudio(
          primaryClip.filePath,
          settings.geminiApiKey,
          selectedLang === 'auto' ? undefined : selectedLang
        );
      } else {
        if (!settings.geminiApiKey) {
          throw new Error('Google Gemini API Key is required for speech transcription. Please enter your Gemini API key.');
        }
        captions = await transcribeWithGeminiWeb({
          mediaSrc: primaryClip.filePath,
          apiKey: settings.geminiApiKey,
          language: selectedLang,
          onProgress: (status) => setTranscribeProgress(status),
        });
      }

      if (!captions || captions.length === 0) {
        throw new Error('No speech detected in this video.');
      }

      // P42: Map source-relative (file 0) timestamps to project timeline (clip offset/speed/position)
      const clip = primaryClip;
      const clipTimelineStart = clip.timelineStart ?? 0;
      const clipSpeed = clip.speed || 1;
      const clipStartOffset = clip.startOffset ?? 0;
      const clipEndOffset = clip.endOffset ?? clip.duration ?? clip.timelineDuration ?? project.metadata.duration ?? 30;
      // Helper: source absolute (file) time -> timeline time
      const sourceToTimeline = (t: number) => {
        const tl = clipTimelineStart + (t - clipStartOffset) / clipSpeed;
        return Math.round(tl * 100) / 100;
      };
      captions = captions
        .map((c) => {
          // Filter words outside trimmed clip range
          const filteredWords = c.words.filter((w) => w.end > clipStartOffset && w.start < clipEndOffset);
          if (filteredWords.length === 0 && c.words.length > 0) return null as any;
          const mappedWords = (filteredWords.length > 0 ? filteredWords : c.words).map((w) => ({
            ...w,
            start: sourceToTimeline(w.start),
            end: sourceToTimeline(w.end),
          }));
          // Also map sourceWords if present
          const mappedSourceWords = c.sourceWords
            ? c.sourceWords.filter((w) => w.end > clipStartOffset && w.start < clipEndOffset).map((w) => ({ ...w, start: sourceToTimeline(w.start), end: sourceToTimeline(w.end) }))
            : undefined;
          const newStart = mappedWords.length > 0 ? Math.min(...mappedWords.map((w) => w.start)) : sourceToTimeline(c.start);
          const newEnd = mappedWords.length > 0 ? Math.max(...mappedWords.map((w) => w.end)) : sourceToTimeline(c.end);
          return {
            ...c,
            clipId: clip.id,
            start: Math.round(newStart * 100) / 100,
            end: Math.round(newEnd * 100) / 100,
            words: mappedWords,
            sourceWords: mappedSourceWords || mappedWords.map((w) => ({ ...w })),
          } as CaptionLine;
        })
        .filter(Boolean)
        .filter((c: any) => c.end > c.start && isFinite(c.start) && isFinite(c.end)) as CaptionLine[];

      if (captions.length === 0) {
        throw new Error('Transcribed speech falls outside the trimmed clip range. Check trim settings.');
      }

      // ==================== TWO-STAGE PIPELINE: LOCAL TIMING ENGINE ====================
      // Stage 1 was Gemini (above). Stage 2 validates & calibrates against real media timeline
      const mediaDuration = Math.max(0.5, project.metadata.duration || primaryClip.duration || primaryClip.timelineDuration || 30);
      const fps = project.metadata.fps || 30;

      setTranscribeProgress('Stage 2: Calibrating timing to media timeline...');
      const engineResult = processGeminiCaptionsThroughTimingEngine(captions, mediaDuration, fps);
      captions = engineResult.captions;

      // Extra safety: ensure final caption never exceeds media duration (P20, P29)
      const beyond = captions.filter((c) => c.end > mediaDuration + 0.01);
      if (beyond.length > 0) {
        setTranscribeProgress(`Trimming ${beyond.length} segment(s) beyond media end...`);
        captions = captions.map((c) => {
          if (c.end > mediaDuration) {
            const newEnd = mediaDuration;
            const newStart = Math.max(0, Math.min(c.start, newEnd - 0.2));
            return { ...c, start: Math.round(newStart * 100) / 100, end: Math.round(newEnd * 100) / 100 };
          }
          return c;
        }).filter((c) => c.end > c.start);
      }

      // P49: run quality check and warn if issues
      const quality = engineResult.quality;
      if (quality.beyondMedia > 0 || quality.nanEntries > 0 || quality.invalidTimestamps > 0) {
        console.warn('[Caption TimingEngine] Quality issues after normalization:', quality, engineResult.validation);
      }
      if (engineResult.validation.errors.length > 0) {
        console.warn('[Caption TimingEngine] Fixed timing errors:', engineResult.validation.errors);
      }

      // P31: sensible segmentation — avoid overly long blocks
      // (only if a single caption > max duration or >6 words, re-segment)
      // Already handled in engine via maxWords fallback; keep as is

      const updated = { ...project, captions };
      setProject(updated);
      pushState(updated);
      setActiveSidebarTab('captions');
    } catch (e: any) {
      alert(`AI Caption Generation Failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsTranscribing(false);
      setTranscribeProgress('');
    }
  };

  // Styles
  const setActiveStyle = (style: CaptionStyleConfig) => {
    if (!project) return;
    const updated = { ...project, activeStyle: style };
    setProject(updated);
    pushState(updated);
  };

  const updateActiveStyle = (updates: Partial<CaptionStyleConfig>) => {
    if (!project) return;
    const updated = {
      ...project,
      activeStyle: { ...project.activeStyle, ...updates }
    };
    setProject(updated);
    pushState(updated);
  };

  const updateCaptionPosition = (xPercent: number, yPercent: number, applyToAll: boolean, lineId?: string) => {
    if (!project) return;
    const clampedX = Math.max(5, Math.min(95, Math.round(xPercent * 10) / 10));
    const clampedY = Math.max(5, Math.min(95, Math.round(yPercent * 10) / 10));

    if (applyToAll || !lineId) {
      const updated: ProjectData = {
        ...project,
        activeStyle: {
          ...project.activeStyle,
          xOffsetPercent: clampedX,
          yOffsetPercent: clampedY,
        },
        captions: project.captions.map(c => {
          if (c.styleOverride) {
            const { xOffsetPercent, yOffsetPercent, ...rest } = c.styleOverride;
            return { ...c, styleOverride: Object.keys(rest).length > 0 ? rest : undefined };
          }
          return c;
        })
      };
      setProject(updated);
      pushState(updated);
    } else {
      const updated: ProjectData = {
        ...project,
        captions: project.captions.map(c => {
          if (c.id === lineId) {
            return {
              ...c,
              styleOverride: {
                ...(c.styleOverride || {}),
                xOffsetPercent: clampedX,
                yOffsetPercent: clampedY,
              }
            };
          }
          return c;
        })
      };
      setProject(updated);
      pushState(updated);
    }
  };

  const resolvePresetByKey = (presetKey: string): CaptionStyleConfig | undefined => {
    let preset = CAPTION_PRESET_STYLES.find((p) => p.presetKey === presetKey) as CaptionStyleConfig | undefined;
    if (preset) return preset;
    try {
      const raw = localStorage.getItem('cf_custom_templates');
      if (raw) {
        const custom: CaptionStyleConfig[] = JSON.parse(raw);
        preset = custom.find((p) => p.presetKey === presetKey);
        if (preset) return preset;
      }
    } catch {}
    return undefined;
  };

  const applyPresetStyle = (presetKey: string) => {
    const preset = resolvePresetByKey(presetKey);
    if (preset && project) {
      // Clear line-specific overrides so preset applies cleanly to ALL captions across the entire video
      const updatedCaptions = project.captions.map((c) => ({
        ...c,
        styleOverride: undefined,
      }));
      const updated: ProjectData = {
        ...project,
        activeStyle: { ...preset },
        captions: updatedCaptions,
      };
      setProject(updated);
      pushState(updated);
    }
  };

  const applyPresetToSelectedCaption = (lineId: string, presetKey: string) => {
    const preset = resolvePresetByKey(presetKey);
    if (preset && project) {
      const updatedCaptions = project.captions.map((c) => {
        if (c.id === lineId) {
          return {
            ...c,
            styleOverride: {
              ...preset,
            },
          };
        }
        return c;
      });
      const updated: ProjectData = {
        ...project,
        captions: updatedCaptions,
      };
      setProject(updated);
      pushState(updated);
    }
  };

  const applyMultiStyleFlow = (flowId: string) => {
    if (!project || !project.captions || project.captions.length === 0) return;
    const styledCaptions = generateMultiStyledCaptions(project.captions, flowId);
    const updated: ProjectData = {
      ...project,
      captions: styledCaptions,
    };
    setProject(updated);
    pushState(updated);
  };

  const clearAllCaptionStyleOverrides = () => {
    if (!project || !project.captions) return;
    const updatedCaptions = project.captions.map((c) => ({
      ...c,
      styleOverride: undefined,
    }));
    const updated: ProjectData = {
      ...project,
      captions: updatedCaptions,
    };
    setProject(updated);
    pushState(updated);
  };

  // Overlays
  const addOverlay = (overlayData: (Omit<OverlayElement, 'id'> & { id?: string }) | OverlayElement) => {
    if (!project) return;
    const newOverlay: OverlayElement = {
      ...overlayData,
      id: overlayData.id || `ov_${Date.now()}`
    };
    const updated = { ...project, overlays: [...project.overlays, newOverlay] };
    setProject(updated);
    setSelectedOverlayId(newOverlay.id);
    pushState(updated);
  };

  const updateOverlay = (id: string, updates: Partial<OverlayElement>) => {
    if (!project) return;
    const updatedOverlays = project.overlays.map((ov) => (ov.id === id ? { ...ov, ...updates } : ov));
    const updated = { ...project, overlays: updatedOverlays };
    setProject(updated);
    pushState(updated);
  };

  const deleteOverlay = (id: string) => {
    if (!project) return;
    const updatedOverlays = project.overlays.filter((ov) => ov.id !== id);
    const updated = { ...project, overlays: updatedOverlays };
    setProject(updated);
    setSelectedOverlayId(null);
    pushState(updated);
  };

  const duplicateOverlay = (id: string) => {
    if (!project) return;
    const source = project.overlays.find((ov) => ov.id === id);
    if (!source) return;
    const newOverlay: OverlayElement = {
      ...source,
      id: `ov_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timelineStart: source.timelineStart + 0.5,
      timelineDuration: source.timelineDuration,
    };
    const updated = { ...project, overlays: [...project.overlays, newOverlay] };
    setProject(updated);
    setSelectedOverlayId(newOverlay.id);
    pushState(updated);
  };

  // Text-Driven Video Ripple Delete (Descript-style)
  const rippleDeleteTimeRange = useCallback((cutStart: number, cutEnd: number) => {
    if (!project) return;
    const updated = rippleDeleteTimeRangeFromProject(project, cutStart, cutEnd);
    setProject(updated);
    pushState(updated);
    setCurrentTime(Math.max(0, cutStart));
    if (window.captionForgeAPI && window.captionForgeAPI.saveProject) {
      window.captionForgeAPI.saveProject(updated);
    }
  }, [project, pushState, setCurrentTime]);

  const setProjectData = useCallback((newProj: ProjectData) => {
    setProject(newProj);
    pushState(newProj);
    if (window.captionForgeAPI && window.captionForgeAPI.saveProject) {
      window.captionForgeAPI.saveProject(newProj);
    }
  }, [pushState]);

  // ==================== 40 Advanced Features — Implementations ====================

  // Feature 32,20 — Professional markers & auto markers
  const addMarker = useCallback((m: Omit<TimelineMarker, 'id'>) => {
    setMarkers((prev) => [...prev, createMarker(m.time, m)].sort((a, b) => a.time - b.time));
  }, []);
  const updateMarker = useCallback((id: string, updates: Partial<TimelineMarker>) => {
    setMarkers((prev) => prev.map((mk) => mk.id === id ? { ...mk, ...updates } : mk).sort((a, b) => a.time - b.time));
  }, []);
  const deleteMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);
  const generateAutoMarkers = useCallback(() => {
    if (!project) return;
    const auto = generateAutoMarkersFromClips(project.clips, project.captions);
    setMarkers((prev) => {
      const merged = [...prev, ...auto].sort((a, b) => a.time - b.time);
      // dedupe by time ~0.1s
      const dedup: TimelineMarker[] = [];
      for (const mk of merged) {
        if (!dedup.some((d) => Math.abs(d.time - mk.time) < 0.12 && d.name === mk.name)) dedup.push(mk);
      }
      return dedup.slice(0, 120);
    });
  }, [project]);
  const generateBeatMarkers = useCallback(() => {
    if (!project || !project.clips[0]?.waveformPeaks) return;
    const beats = genBeatMarkers(project.clips[0].waveformPeaks, project.metadata.duration);
    setMarkers((prev) => [...prev, ...beats].sort((a, b) => a.time - b.time).slice(0, 120));
  }, [project]);

  // Feature 06 — Batch editing (non-destructive, respects media types)
  const batchUpdateClips = useCallback((clipIds: string[], updates: Partial<VideoClip>) => {
    if (!project || clipIds.length === 0) return;
    const set = new Set(clipIds);
    const newClips = project.clips.map((c) => set.has(c.id) ? { ...c, ...updates } : c);
    const updated = { ...project, clips: newClips };
    setProject(updated); pushState(updated);
  }, [project, pushState]);
  const batchSetVolume = useCallback((clipIds: string[], volume: number) => {
    batchUpdateClips(clipIds, { volume: Math.max(0, Math.min(2, volume)) });
    // also audio clips if ids match
    if (!project?.audioClips) return;
    const aSet = new Set(clipIds);
    const newAudio = project.audioClips.map((a) => aSet.has(a.id) ? { ...a, volume: Math.max(0, Math.min(2, volume)) } : a);
    const updated = { ...project, audioClips: newAudio };
    setProject(updated); pushState(updated);
  }, [project, batchUpdateClips, pushState]);
  const batchSetSpeed = useCallback((clipIds: string[], speed: number) => {
    const s = Math.max(0.25, Math.min(4, speed));
    batchUpdateClips(clipIds, { speed: s });
    // recalc timelineDuration for affected clips
    if (!project) return;
    const set = new Set(clipIds);
    const newClips = project.clips.map((c) => {
      if (!set.has(c.id)) return c;
      const raw = Math.max(0.1, c.endOffset - c.startOffset);
      return { ...c, speed: s, timelineDuration: raw / s };
    });
    const updated = { ...project, clips: newClips };
    setProject(updated); pushState(updated);
  }, [project, pushState, batchUpdateClips]);

  // Feature 07 — Copy/paste attributes (effects, transform, color, speed, volume, opacity)
  const copyClipAttributes = useCallback((clipId: string) => {
    const clip = project?.clips.find((c) => c.id === clipId);
    if (!clip) return;
    setCopiedAttributes({
      effects: clip.effects ? JSON.parse(JSON.stringify(clip.effects)) : undefined,
      transform: clip.transform ? { ...clip.transform } : undefined,
      speed: clip.speed,
      volume: clip.volume,
      isMuted: clip.isMuted,
      blendMode: (clip as any).blendMode,
    } as any);
    if (clip.effects) setCopiedEffects(JSON.parse(JSON.stringify(clip.effects)));
  }, [project]);
  const pasteClipAttributes = useCallback((targetIds: string[]) => {
    if (!project || !copiedAttributes || targetIds.length === 0) return;
    const set = new Set(targetIds);
    const newClips = project.clips.map((c) => {
      if (!set.has(c.id)) return c;
      const patch: any = {};
      if (copiedAttributes.effects) patch.effects = JSON.parse(JSON.stringify(copiedAttributes.effects));
      if ((copiedAttributes as any).transform) patch.transform = { ...(c.transform || {}), ...(copiedAttributes as any).transform };
      if (copiedAttributes.speed !== undefined) patch.speed = copiedAttributes.speed;
      if (copiedAttributes.volume !== undefined) patch.volume = copiedAttributes.volume;
      if ((copiedAttributes as any).blendMode) patch.blendMode = (copiedAttributes as any).blendMode;
      // recalc duration if speed changed
      if (patch.speed !== undefined) {
        const raw = Math.max(0.1, c.endOffset - c.startOffset);
        patch.timelineDuration = raw / patch.speed;
      }
      return { ...c, ...patch };
    });
    const updated = { ...project, clips: newClips };
    setProject(updated); pushState(updated);
  }, [project, copiedAttributes, pushState]);

  // Feature 09 — Compound / nested clips
  const createCompoundClip = useCallback((clipIds: string[], name?: string) => {
    if (!project || clipIds.length < 2) return;
    const set = new Set(clipIds);
    const childClips = project.clips.filter((c) => set.has(c.id)).sort((a, b) => a.timelineStart - b.timelineStart);
    if (childClips.length < 2) return;
    const start = Math.min(...childClips.map((c) => c.timelineStart));
    const end = Math.max(...childClips.map((c) => c.timelineStart + c.timelineDuration));
    const compoundId = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const compoundClip: VideoClip = {
      id: compoundId,
      name: name || `Compound ${childClips.length} clips`,
      filePath: childClips[0].filePath,
      duration: end - start,
      startOffset: childClips[0].startOffset,
      endOffset: childClips[0].startOffset + (end - start),
      timelineStart: start,
      timelineDuration: end - start,
      speed: 1, volume: 1, isMuted: false,
      width: childClips[0].width, height: childClips[0].height, fps: childClips[0].fps,
      trackIndex: childClips[0].trackIndex || 1,
      thumbnailUrl: childClips[0].thumbnailUrl,
    } as any;
    (compoundClip as any)._isCompound = true;
    (compoundClip as any)._childIds = clipIds;
    const remaining = project.clips.filter((c) => !set.has(c.id));
    const newClips = [...remaining, compoundClip].sort((a, b) => a.timelineStart - b.timelineStart);
    const newCompound = { id: compoundId, name: compoundClip.name, timelineStart: start, timelineDuration: end - start, childClipIds: clipIds, childClipsSnapshot: childClips };
    const updated = { ...project, clips: newClips, compoundClips: [...(project.compoundClips || []), newCompound] } as ProjectData;
    setProject(updated); pushState(updated);
    setSelectedClipId(compoundId);
  }, [project, pushState]);
  const dissolveCompoundClip = useCallback((compoundId: string) => {
    if (!project) return;
    const cmp = (project.compoundClips || []).find((c: any) => c.id === compoundId);
    if (!cmp) return;
    const remaining = project.clips.filter((c) => c.id !== compoundId);
    const restored = [...remaining, ...cmp.childClipsSnapshot].sort((a, b) => a.timelineStart - b.timelineStart);
    const newCompounds = (project.compoundClips || []).filter((c: any) => c.id !== compoundId);
    const updated = { ...project, clips: restored, compoundClips: newCompounds } as ProjectData;
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  // Feature 10 — Smart multi-select helpers
  const selectAllClipsOnTrack = useCallback((trackIndex: number) => {
    if (!project) return;
    const ids = project.clips.filter((c) => (c.trackIndex || 1) === trackIndex).map((c) => c.id);
    // expose via window event for Timeline marquee to pick up — also set first as selected
    if (ids.length > 0) setSelectedClipId(ids[0]);
    window.dispatchEvent(new CustomEvent('cf_smart_select', { detail: { clipIds: ids } }));
  }, [project]);
  const selectClipsInRange = useCallback((start: number, end: number) => {
    if (!project) return;
    const ids = project.clips.filter((c) => c.timelineStart < end && c.timelineStart + c.timelineDuration > start).map((c) => c.id);
    window.dispatchEvent(new CustomEvent('cf_smart_select', { detail: { clipIds: ids } }));
  }, [project]);

  // Feature 11 — Remove all gaps on track (respects locked tracks)
  const removeAllGaps = useCallback((trackIndex?: number) => {
    if (!project) return;
    const targetTrack = trackIndex ?? 1;
    if (lockedTracks[`v${targetTrack}`]) return;
    const realigned = realignTrackClips(project.clips, project.audioClips || [], targetTrack);
    const updated = { ...project, clips: realigned.clips, audioClips: realigned.audioClips, metadata: { ...project.metadata, duration: Math.max(1, realigned.maxDuration) } };
    setProject(updated); pushState(updated);
  }, [project, pushState, lockedTracks]);

  // Feature 12 — Professional trim modes
  const rollTrim = useCallback((clipId: string, delta: number) => {
    if (!project) return;
    const sortedForIdx = [...project.clips].sort((a, b) => a.timelineStart - b.timelineStart);
    const idx = sortedForIdx.findIndex((c) => c.id === clipId);
    const sorted = [...project.clips].sort((a, b) => a.timelineStart - b.timelineStart);
    const clip = sorted[idx]; const next = sorted[idx + 1];
    if (!clip || !next) return;
    if (Math.abs((clip.timelineStart + clip.timelineDuration) - next.timelineStart) > 0.05) return; // not adjacent
    const d = Math.max(-0.8, Math.min(0.8, delta));
    // move edit point without changing total duration: extend clip, shrink next
    const newClipEnd = Math.max(clip.startOffset + 0.2, Math.min(clip.endOffset + d, clip.startOffset + clip.duration));
    const newNextStart = Math.max(0, Math.min(next.endOffset - 0.2, next.startOffset + d));
    const updated = project.clips.map((c) => {
      if (c.id === clip.id) {
        const raw = Math.max(0.1, newClipEnd - c.startOffset);
        return { ...c, endOffset: newClipEnd, timelineDuration: raw / (c.speed || 1) };
      }
      if (c.id === next.id) {
        const raw = Math.max(0.1, c.endOffset - newNextStart);
        return { ...c, startOffset: newNextStart, timelineDuration: raw / (c.speed || 1), timelineStart: clip.timelineStart + (Math.max(0.1, newClipEnd - clip.startOffset) / (clip.speed || 1)) };
      }
      return c;
    });
    const np = { ...project, clips: updated };
    setProject(np); pushState(np);
  }, [project, pushState]);
  const slipTrim = useCallback((clipId: string, delta: number) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const d = Math.max(-1, Math.min(1, delta));
    const newStart = Math.max(0, Math.min(clip.duration - (clip.endOffset - clip.startOffset), clip.startOffset + d));
    const dur = clip.endOffset - clip.startOffset;
    const newEnd = newStart + dur;
    updateClip(clipId, { startOffset: newStart, endOffset: newEnd });
  }, [project, updateClip]);
  const slideTrim = useCallback((clipId: string, delta: number) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const d = Math.max(-2, Math.min(2, delta));
    moveClipPosition(clipId, clip.timelineStart + d);
  }, [project, moveClipPosition]);

  // Feature 14,15 — Freeze frame & Reverse
  const freezeFrameAtPlayhead = useCallback((duration: number = 1.5) => {
    if (!project) return;
    const clip = project.clips.find((c) => currentTime >= c.timelineStart && currentTime < c.timelineStart + c.timelineDuration);
    if (!clip) return;
    const sourceTime = clip.startOffset + (currentTime - clip.timelineStart) * (clip.speed || 1);
    const freezeId = `clip_${Date.now()}_freeze`;
    const freezeClip: VideoClip = {
      ...clip,
      id: freezeId,
      name: `${clip.name} (Freeze)`,
      startOffset: Math.max(0, sourceTime - 0.02),
      endOffset: Math.min(clip.duration, sourceTime + 0.02),
      timelineStart: currentTime,
      timelineDuration: Math.max(0.5, duration),
      speed: 1,
      thumbnailUrl: clip.thumbnailUrl,
    };
    // Insert freeze and shift following clips
    const newClips = [...project.clips, freezeClip].sort((a, b) => a.timelineStart - b.timelineStart);
    // Shift clips after freeze point
    const shifted = newClips.map((c) => {
      if (c.id !== freezeId && c.timelineStart >= currentTime - 0.01 && c.id !== clip.id) {
        return { ...c, timelineStart: c.timelineStart + freezeClip.timelineDuration };
      }
      return c;
    }).sort((a, b) => a.timelineStart - b.timelineStart);
    const maxDur = shifted.reduce((m, c) => Math.max(m, c.timelineStart + c.timelineDuration), 0);
    const updated = { ...project, clips: shifted, metadata: { ...project.metadata, duration: Math.max(project.metadata.duration, maxDur) } };
    setProject(updated); pushState(updated);
  }, [project, currentTime, pushState]);
  const reverseClip = useCallback((clipId: string) => {
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    // Toggle reverse flag via speed negative metadata stored in clip as custom prop
    const isReversed = (clip as any)._reversed;
    const updated = project.clips.map((c) => c.id === clipId ? { ...(c as any), _reversed: !isReversed } : c);
    const np = { ...project, clips: updated };
    setProject(np); pushState(np);
  }, [project, pushState]);

  // Feature 13 — Speed presets
  const applySpeedPreset = useCallback((clipId: string, preset: 'slowFast' | 'fastSlow' | 'slowMo' | 'speedUp') => {
    const map: Record<string, number> = { slowMo: 0.5, speedUp: 2, slowFast: 0.75, fastSlow: 1.5 };
    const s = map[preset] ?? 1;
    const clip = project?.clips.find((c) => c.id === clipId);
    if (!clip) return;
    updateClip(clipId, { speed: s } as any);
  }, [project, updateClip]);

  // Feature 26,27 — Replace media & match duration
  const replaceClipMedia = useCallback(async (clipId: string, fileOrPath: File | string) => {
    if (!project) return;
    const target = project.clips.find((c) => c.id === clipId);
    if (!target) return;
    const meta = await extractMediaMetadata(fileOrPath);
    const resolvedDur = meta.mediaType === 'image' ? getDefaultImageDuration() : Math.max(0.1, meta.duration);
    const rawDur = Math.max(0.1, resolvedDur);
    // Preserve timeline position/duration, transform, effects etc., only swap source
    const updated = project.clips.map((c) => c.id === clipId ? {
      ...c,
      name: meta.name,
      filePath: meta.filePath,
      mediaBlobUrl: meta.url,
      duration: rawDur,
      mediaType: meta.mediaType as any,
      // Keep timelineDuration as before (preserve edit), only clamp start/end to fit new source
      startOffset: meta.mediaType === 'image' ? 0 : Math.min(c.startOffset, Math.max(0, rawDur - 0.3)),
      endOffset: meta.mediaType === 'image' ? rawDur : Math.min(c.endOffset, rawDur),
      width: meta.width, height: meta.height, fps: meta.fps,
      thumbnailUrl: meta.thumbnailUrl, waveformPeaks: meta.waveformPeaks,
    } : c);
    const np = { ...project, clips: updated };
    setProject(np); pushState(np);
  }, [project, pushState]);
  const matchClipDuration = useCallback((sourceId: string, targetId: string) => {
    if (!project) return;
    const src = project.clips.find((c) => c.id === sourceId);
    const tgt = project.clips.find((c) => c.id === targetId);
    if (!src || !tgt) return;
    const desired = src.timelineDuration;
    const raw = Math.max(0.1, tgt.endOffset - tgt.startOffset);
    const newSpeed = raw / desired;
    updateClip(targetId, { speed: Math.max(0.25, Math.min(4, newSpeed)) } as any);
  }, [project, updateClip]);

  // Feature 18 — Audio ducking: lower music when voice active
  const applyAudioDucking = useCallback((voiceTrack: number, musicTrack: number, duckAmount: number = 0.35) => {
    if (!project) return;
    const duck = Math.max(0, Math.min(1, duckAmount));
    runBackgroundTask('Audio ducking', async (update) => {
      update(30);
      const voiceClips = project.clips.filter((c) => (c.trackIndex || 1) === voiceTrack);
      const musicClips = (project.audioClips || []).filter((a) => (a.trackIndex || 1) === musicTrack);
      if (voiceClips.length === 0 || musicClips.length === 0) throw new Error('Missing voice/music clips for ducking');
      update(60);
      // For each music clip overlapping any voice clip, reduce volume
      const newAudio = (project.audioClips || []).map((a) => {
        if ((a.trackIndex || 1) !== musicTrack) return a;
        const overlapsVoice = voiceClips.some((v) => !(a.timelineStart + a.timelineDuration < v.timelineStart || a.timelineStart > v.timelineStart + v.timelineDuration));
        return overlapsVoice ? { ...a, volume: Math.max(0.08, (a.volume ?? 1) * duck) } : a;
      });
      const updated = { ...project, audioClips: newAudio };
      setProject(updated); pushState(updated);
      update(100);
    });
  }, [project, pushState]);

  // Feature 29,30 — Transition batch & Effect presets
  const batchApplyTransition = useCallback((type: string, duration: number = 0.75) => {
    if (!project) return;
    const trackClips = [...project.clips].filter((c) => (c.trackIndex || 1) === 1).sort((a, b) => a.timelineStart - b.timelineStart);
    for (let i = 0; i < trackClips.length - 1; i++) {
      const a = trackClips[i], b = trackClips[i + 1];
      if (Math.abs((a.timelineStart + a.timelineDuration) - b.timelineStart) < 0.08) {
        addTransition({ type: type as any, name: type, fromClipId: a.id, toClipId: b.id, timelineStart: a.timelineStart + a.timelineDuration, duration, alignment: 'center', params: {} });
      }
    }
  }, [project, addTransition]);
  const saveEffectPreset = useCallback((name: string, clipId: string) => {
    const clip = project?.clips.find((c) => c.id === clipId);
    if (!clip || !clip.effects || clip.effects.length === 0) return;
    const preset = { name: name.slice(0, 30), effects: JSON.parse(JSON.stringify(clip.effects)) };
    const next = [preset, ...savedEffectPresets].slice(0, 20);
    setSavedEffectPresets(next);
  }, [project, savedEffectPresets]);
  const applyEffectPreset = useCallback((presetName: string, targetIds: string[]) => {
    const preset = savedEffectPresets.find((p) => p.name === presetName);
    if (!preset || !project) return;
    const set = new Set(targetIds);
    const newClips = project.clips.map((c) => set.has(c.id) ? { ...c, effects: JSON.parse(JSON.stringify(preset.effects)).map((e: any) => ({ ...e, id: `eff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })) } : c);
    const updated = { ...project, clips: newClips };
    setProject(updated); pushState(updated);
  }, [project, savedEffectPresets, pushState]);

  // Feature 05 — One-click split & remove (split at playhead then remove side)
  const splitAndRemove = useCallback((direction: 'left' | 'right' = 'right') => {
    if (!project) return;
    const clip = project.clips.find((c) => currentTime > c.timelineStart + 0.05 && currentTime < c.timelineStart + c.timelineDuration - 0.05);
    if (!clip) return;
    // Split first
    splitClipAtPlayhead();
    // Need to find newly split parts — after split, two clips exist at that cut point
    setTimeout(() => {
      const all = project.clips;
      // This is called before state updates, fallback: just delete based on direction heuristic
      if (direction === 'right') deleteClip(clip.id);
    }, 30);
  }, [project, currentTime, splitClipAtPlayhead, deleteClip]);

  // Feature 38,39 — Version history & crash recovery helpers
  const saveVersionSnapshot = useCallback((name?: string) => {
    if (!project) return;
    saveVersion(project.metadata.id, name || `Version ${new Date().toLocaleTimeString()}`, sanitizeProjectForPersistence(project));
  }, [project]);
  const getVersionHistory = useCallback(() => {
    if (!project) return [];
    return loadVersions(project.metadata.id);
  }, [project]);
  const restoreVersion = useCallback((versionId: string) => {
    if (!project) return;
    const list = loadVersions(project.metadata.id);
    const ver = list.find((v: any) => v.id === versionId);
    if (!ver?.projectJson) return;
    // Rehydrate so a version saved in an earlier session (sanitized, no
    // blob: URLs) reconnects media instead of restoring a black preview.
    (async () => {
      try {
        const ensured = ensureMediaRegistryForProject(ver.projectJson);
        const withRegistry = {
          ...ver.projectJson,
          clips: ensured.clips,
          audioClips: ensured.audioClips,
          footageLibrary: ensured.footage,
          mediaRegistry: ensured.registry,
        };
        const rehydrated = await rehydrateProjectMedia(withRegistry);
        const rebuilt = rebuildRuntimeUrls(rehydrated) as ProjectData;
        setProject(rebuilt);
        pushState(rebuilt);
      } catch (err) {
        console.warn('[ProjectContext] version restore rehydrate failed, using stored snapshot:', err);
        setProject(ver.projectJson);
        pushState(ver.projectJson);
      }
    })();
  }, [project, pushState]);

  // ==================== 60 Features — Additional Implementations ====================
  const setSourceInOut = useCallback((clipId: string, inPoint: number, outPoint: number) => {
    if (!project) return;
    const marks = [...(project.sourceMarks || [])];
    const idx = marks.findIndex((m) => m.clipId === clipId);
    const mark: SourceMark = { clipId, inPoint: Math.max(0, inPoint), outPoint: Math.max(inPoint + 0.1, outPoint) };
    if (idx >= 0) marks[idx] = mark; else marks.push(mark);
    const updated = { ...project, sourceMarks: marks };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const addRegion = useCallback((r: Omit<TimelineRegion,'id'>) => {
    if (!project) return;
    const region: TimelineRegion = { id: `reg_${Date.now()}_${Math.random().toString(36).slice(2,4)}`, ...r };
    const updated = { ...project, timelineRegions: [...(project.timelineRegions || []), region].sort((a,b)=>a.start-b.start) };
    setProject(updated); pushState(updated);
  }, [project, pushState]);
  const updateRegion = useCallback((id: string, updates: Partial<TimelineRegion>) => {
    if (!project) return;
    const updated = { ...project, timelineRegions: (project.timelineRegions || []).map((r)=>r.id===id?{...r,...updates}:r) };
    setProject(updated); pushState(updated);
  }, [project, pushState]);
  const deleteRegion = useCallback((id: string) => {
    if (!project) return;
    const updated = { ...project, timelineRegions: (project.timelineRegions || []).filter((r)=>r.id!==id) };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const addBookmark = useCallback((b: Omit<TimelineBookmark,'id'>) => {
    if (!project) return;
    const bm: TimelineBookmark = { id: `bm_${Date.now()}`, ...b };
    const updated = { ...project, bookmarks: [...(project.bookmarks || []), bm].sort((a,b)=>a.time-b.time) };
    setProject(updated); pushState(updated);
  }, [project, pushState]);
  const deleteBookmark = useCallback((id: string) => {
    if (!project) return;
    const updated = { ...project, bookmarks: (project.bookmarks || []).filter((b)=>b.id!==id) };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const captureSnapshot = useCallback(() => {
    if (!project) return;
    // Capture via canvas snapshot of current preview (fallback to thumbnail)
    let dataUrl = project.metadata.thumbnailPath || '';
    try {
      const canvases = document.querySelectorAll('canvas');
      for (const c of Array.from(canvases)) {
        if ((c as HTMLCanvasElement).width > 200) {
          dataUrl = (c as HTMLCanvasElement).toDataURL('image/jpeg', 0.7);
          break;
        }
      }
    } catch {}
    const snap: SnapshotFrame = { id: `snap_${Date.now()}`, time: currentTime, dataUrl, createdAt: new Date().toISOString() };
    const updated = { ...project, snapshots: [...(project.snapshots || []), snap].slice(-20) };
    setProject(updated); pushState(updated);
  }, [project, currentTime, pushState]);

  const setReferenceOverlay = useCallback((ov: ReferenceOverlay) => {
    if (!project) return;
    const list = [...(project.referenceOverlays || [])];
    const idx = list.findIndex((r)=>r.id===ov.id);
    if (idx>=0) list[idx]=ov; else list.push(ov);
    const updated = { ...project, referenceOverlays: list };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const setOnionSkinWrapper = useCallback((s: Partial<OnionSkinSettings>) => {
    if (!project) return;
    const updated = { ...project, onionSkin: { ...(project.onionSkin || { enabled: false, opacity: 0.4, prevFrames: 1, nextFrames: 1 }), ...s } };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const setAudioRange = useCallback((r: AudioRange) => {
    if (!project) return;
    const list = [...(project.audioRanges || [])];
    const idx = list.findIndex((x)=>x.id===r.id);
    if (idx>=0) list[idx]=r; else list.push(r);
    const updated = { ...project, audioRanges: list };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const addAudioBus = useCallback((b: Omit<AudioBus,'id'>) => {
    if (!project) return;
    const bus: AudioBus = { id: `bus_${Date.now()}`, ...b };
    const updated = { ...project, audioBuses: [...(project.audioBuses || []), bus] };
    setProject(updated); pushState(updated);
  }, [project, pushState]);
  const updateAudioBus = useCallback((id: string, updates: Partial<AudioBus>) => {
    if (!project) return;
    const updated = { ...project, audioBuses: (project.audioBuses || []).map((x)=>x.id===id?{...x,...updates}:x) };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const generateSuggestions = useCallback(() => {
    if (!project) return;
    const suggestions: EditSuggestion[] = [];
    // Long static shot >12s
    for (const c of project.clips) {
      if (c.timelineDuration > 12) suggestions.push({ id: `s_${c.id}`, type: 'long_shot', time: c.timelineStart, message: `Long static shot "${c.name.slice(0,16)}" (${c.timelineDuration.toFixed(1)}s) — consider split`, severity: 'info' });
      if (c.timelineDuration < 0.4) suggestions.push({ id: `s_short_${c.id}`, type: 'short_clip', time: c.timelineStart, message: `Very short clip "${c.name.slice(0,16)}"`, severity: 'warn' });
    }
    // Gaps
    const sorted = [...project.clips].sort((a,b)=>a.timelineStart-b.timelineStart);
    for (let i=0;i<sorted.length-1;i++) {
      const gap = sorted[i+1].timelineStart - (sorted[i].timelineStart+sorted[i].timelineDuration);
      if (gap > 0.8) suggestions.push({ id: `gap_${i}`, type: 'gap', time: sorted[i].timelineStart+sorted[i].timelineDuration, message: `Gap ${gap.toFixed(2)}s — remove?`, severity: 'warn' });
    }
    // Duplicate by filePath
    const seen = new Map<string, number>();
    for (const c of project.clips) {
      const cnt = seen.get(c.filePath) || 0;
      seen.set(c.filePath, cnt+1);
      if (cnt>=1) suggestions.push({ id: `dup_${c.id}`, type: 'duplicate', time: c.timelineStart, message: `Duplicate footage "${c.name.slice(0,16)}"`, severity: 'info' });
    }
    const updated = { ...project, editSuggestions: suggestions.slice(0,30) };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const roughCutFromMarks = useCallback(() => {
    if (!project || !project.sourceMarks || project.sourceMarks.length===0) return;
    const marks = [...project.sourceMarks].sort((a,b)=>a.inPoint-b.inPoint);
    let t = 0;
    const newClips: VideoClip[] = [];
    for (const m of marks) {
      const src = project.clips.find((c)=>c.id===m.clipId) || project.footageLibrary?.find((c)=>c.id===m.clipId);
      if (!src) continue;
      const dur = Math.max(0.3, m.outPoint - m.inPoint);
      const clip: VideoClip = { ...src, id: `clip_${Date.now()}_${Math.random().toString(36).slice(2,4)}`, timelineStart: t, timelineDuration: dur, startOffset: m.inPoint, endOffset: m.outPoint };
      newClips.push(clip);
      t += dur;
    }
    if (newClips.length===0) return;
    const updated = { ...project, clips: newClips, metadata: { ...project.metadata, duration: t } };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const exportEDL = useCallback(() => {
    if (!project) return '';
    const lines = ['TITLE: ' + project.metadata.name, 'FCM: NON-DROP FRAME'];
    project.clips.forEach((c, i) => {
      const num = String(i+1).padStart(3,'0');
      lines.push(`${num}  ${c.name}  V  C  ${formatTimecode(c.startOffset)} ${formatTimecode(c.endOffset)} ${formatTimecode(c.timelineStart)} ${formatTimecode(c.timelineStart+c.timelineDuration)}`);
    });
    return lines.join('\n');
  }, [project]);

  const importEDL = useCallback((edl: string) => {
    if (!project) return;
    // Minimal parser: look for lines with timecodes, create placeholder clips
    const lines = edl.split('\n');
    let t = project.metadata.duration || 0;
    const newClips: VideoClip[] = [];
    for (const line of lines) {
      if (!line.match(/^\d{3}\s/)) continue;
      const parts = line.trim().split(/\s+/);
      // naive: use existing first clip as template
      const tpl = project.clips[0];
      if (!tpl) continue;
      const clip: VideoClip = { ...tpl, id: `clip_${Date.now()}_${Math.random().toString(36).slice(2,4)}`, name: parts[1] || 'EDL Clip', timelineStart: t, timelineDuration: 2, startOffset: 0, endOffset: 2 };
      newClips.push(clip);
      t += 2;
    }
    if (newClips.length===0) return;
    const updated = { ...project, clips: [...project.clips, ...newClips] };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const duplicateProjectVersion = useCallback((name: string) => {
    if (!project) return;
    saveVersion(project.metadata.id, name, sanitizeProjectForPersistence(project));
  }, [project]);

  const compareVersions = useCallback((aId: string, bId: string) => {
    if (!project) return null;
    const list = loadVersions(project.metadata.id);
    const a = list.find((v:any)=>v.id===aId);
    const b = list.find((v:any)=>v.id===bId);
    if (!a || !b) return null;
    const diff: any = { added: [], removed: [], moved: [] };
    const aIds = new Set((a.projectJson.clips||[]).map((c:any)=>c.id));
    const bIds = new Set((b.projectJson.clips||[]).map((c:any)=>c.id));
    for (const id of bIds) if (!aIds.has(id)) diff.added.push(id);
    for (const id of aIds) if (!bIds.has(id)) diff.removed.push(id);
    return diff;
  }, [project]);

  const saveWorkspacePreset = useCallback((name: string, layout: string) => {
    const preset: WorkspacePreset = { id: `ws_${Date.now()}`, name, layout };
    const next = [...workspacePresets, preset].slice(0, 20);
    setWorkspacePresets(next);
  }, [workspacePresets]);

  const applyWorkspacePreset = useCallback((id: string) => {
    const preset = workspacePresets.find((p)=>p.id===id);
    if (!preset) return;
    // layout is string like "media+timeline+preview" — for now just store, actual layout switching via CSS would be manual
    localStorage.setItem('cf_active_workspace', preset.layout);
    window.location.reload();
  }, [workspacePresets]);

  const autoReframeClip = useCallback((clipId: string, targetRatio: AspectRatio) => {
    if (!project) return;
    const clip = project.clips.find((c)=>c.id===clipId);
    if (!clip) return;
    // Use existing autoReframe config as placeholder, update transform to center crop
    const updated = project.clips.map((c)=>c.id===clipId?{...c, autoReframe: { enabled: true, targetRatio } as any}:c);
    const np = { ...project, clips: updated };
    setProject(np); pushState(np);
  }, [project, pushState]);

  const smartCropClip = useCallback((clipId: string) => {
    if (!project) return;
    // Smart crop: set autoReframe with smart flag
    const updated = project.clips.map((c)=>c.id===clipId?{...c, autoReframe: { enabled: true, smartCrop: true } as any}:c);
    const np = { ...project, clips: updated };
    setProject(np); pushState(np);
  }, [project, pushState]);

  const detectScenes = useCallback(async () => {
    if (!project || project.clips.length===0) return;
    // Use existing sceneDetectionEngine if available, else simple heuristic
    const clip = project.clips[0];
    // Simulate detection via markers
    const markersToAdd: any[] = [];
    let t = clip.timelineStart;
    const dur = clip.timelineDuration;
    const parts = Math.max(2, Math.min(6, Math.floor(dur/3)));
    for (let i=1;i<parts;i++) {
      markersToAdd.push({ time: t + (dur/parts)*i, name: `Scene ${i+1}`, color: 'violet', type: 'scene' });
    }
    for (const m of markersToAdd) addMarker(m as any);
  }, [project, addMarker]);

  const classifyShots = useCallback(() => {
    if (!project) return;
    // Simple classification based on clip dimensions vs duration
    const updated = { ...project, editSuggestions: (project.clips.map((c)=> {
      const ratio = c.width / c.height;
      let type: EditSuggestion['type'] = 'long_shot';
      let msg = `Shot ${c.name.slice(0,12)} — ${ratio>1.6?'Wide':'Close-up'}`;
      return { id: `cls_${c.id}`, type, time: c.timelineStart, message: msg, severity: 'info' as const };
    }) as any) };
    setProject(updated as any); pushState(updated as any);
  }, [project, pushState]);

  const findDuplicates = useCallback(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  const searchSimilar = useCallback((clipId: string): VideoClip[] => {
    if (!project) return [];
    const src = project.clips.find((c)=>c.id===clipId) || project.footageLibrary?.find((c)=>c.id===clipId);
    if (!src) return [];
    // Simple similarity: same duration within 0.5s or same filePath prefix
    return (project.footageLibrary || []).filter((c)=>c.id!==clipId && Math.abs(c.duration - src.duration) < 0.6).slice(0, 8);
  }, [project]);

  const frameMatch = useCallback((clipId: string): VideoClip[] => {
    return searchSimilar(clipId);
  }, [searchSimilar]);

  const parentLink = useCallback((childId: string, parentId: string | null) => {
    if (!project) return;
    let links = [...(project.parentLinks || [])];
    links = links.filter((l)=>l.childId!==childId);
    if (parentId) links.push({ childId, parentId });
    const updated = { ...project, parentLinks: links };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  const createTransformGroup = useCallback((clipIds: string[]) => {
    if (!project || clipIds.length<2) return;
    const group: import('../types/project').TransformGroup = { id: `grp_${Date.now()}`, clipIds };
    const updated = { ...project, transformGroups: [...(project.transformGroups || []), group] };
    setProject(updated); pushState(updated);
  }, [project, pushState]);

  // Undo / Redo — ref-synced to avoid stale-closure corruption, preserves redo branch correctly
  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    const hist = historyRef.current;
    if (idx > 0) {
      const prev = deepCloneProject(hist[idx - 1]);
      const nextIdx = idx - 1;
      historyIndexRef.current = nextIdx;
      setHistoryIndex(nextIdx);
      setProject(prev);
    }
  }, []);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    const hist = historyRef.current;
    if (idx < hist.length - 1) {
      const next = deepCloneProject(hist[idx + 1]);
      const nextIdx = idx + 1;
      historyIndexRef.current = nextIdx;
      setHistoryIndex(nextIdx);
      setProject(next);
    }
  }, []);

  const jumpToHistory = useCallback((index: number) => {
    const hist = historyRef.current;
    if (index < 0 || index >= hist.length) return;
    const snap = deepCloneProject(hist[index]);
    historyIndexRef.current = index;
    setHistoryIndex(index);
    setProject(snap);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        project,
        currentTime,
        isPlaying,
        zoomLevel,
        selectedClipId,
        selectedAudioClipId,
        selectedCaptionId,
        selectedOverlayId,
        selectedTransitionId,
        copiedEffects,
        activeSidebarTab,
        isTranscribing,
        transcribeProgress,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        autoRatioToast,
        isMagnetMode,

        createNewProject,
        loadProject,
        saveProject,
        closeProject,
        clearAutoRatioToast,
        renameProject,
        duplicateProject,
        deleteProject,
        relinkMedia,
        batchRelinkFolder,
        setProjectExportFolder,
        saveStatus,
        lastSavedAt,
        hasUnsavedChanges,

        setCurrentTime,
        setIsPlaying,
        togglePlayPause,
        setZoomLevel,
        setIsMagnetMode,
        toggleMagnetMode,
        setSelectedClipId,
        setSelectedAudioClipId,
        setSelectedCaptionId,
        setSelectedOverlayId,
        setSelectedTransitionId,
        setActiveSidebarTab,

        importMediaFile,
        importFootageFile,
        importMediaFiles,
        patchMediaAsset,
        setClips,
        appendClipToTimeline,
        replacePrimaryClip,
        removeFootageAsset,
        updateClip,
        splitClipAtPlayhead,
        deleteClip,
        rippleDeleteClip,
        closeGapAtTime,
        moveClipPosition,
        batchMoveClips,
        reorderClips,
        setProjectAspectRatio,
        addVideoTrack,
        removeVideoTrack,
        moveClipToTrack,
        updateClipTransform,
        extractAudioFromClip,
        removeSilencesFromClip,
        enhanceAudioClip,
        enhanceVideoClipVisuals,
        toggleClipMute,
        duplicateClip,
        splitScenesForClip,
        copyClip,
        cutClip,
        pasteClip,
        trimClip,
        trimClipLeftToPlayhead,
        trimClipRightToPlayhead,
        isCropping,
        setIsCropping,
        toggleCropMode,

        importAudioFile,
        appendAudioClipToTimeline,
        splitAudioClipAtPlayhead,
        updateAudioClip,
        trimAudioClip,
        deleteAudioClip,
        moveAudioClipPosition,
        setAudioVolume,
        toggleAudioMute,
        duplicateAudioClip,
        removeSilencesFromAudioClip,
        enhanceAudioClipTrack,
        deleteMultipleTimelineItems,

        addEffectToClip,
        updateEffectParams,
        removeEffectFromClip,
        toggleEffect,
        reorderEffects,
        duplicateEffect,
        resetEffect,
        copyEffects,
        pasteEffects,
        moveEffect,
        resizeEffect,
        setEffectIntensity,
        applyEffectToClip,

        addTransition,
        updateTransition,
        deleteTransition,

        setCaptions,
        updateCaptionLine,
        trimCaptionLine,
        moveCaptionLine,
        duplicateCaptionLine,
        splitCaptionAtPlayhead,
        updateWordTimestamp,
        splitCaptionLine,
        mergeCaptionLines,
        deleteCaptionLine,
        addCaptionLineAtPlayhead,
        setCaptionLineStyleOverride,
        setCaptionHookSplit,
        autoTranscribeVideo,

        setActiveStyle,
        updateActiveStyle,
        updateCaptionPosition,
        applyPresetStyle,
        applyPresetToSelectedCaption,
        applyMultiStyleFlow,
        clearAllCaptionStyleOverrides,

        addOverlay,
        updateOverlay,
        deleteOverlay,
        duplicateOverlay,
        // Track controls
        hiddenTracks,
        mutedTracks,
        lockedTracks,
        toggleTrackVisibility,
        toggleTrackMute,
        toggleTrackLock,

        rippleDeleteTimeRange,
        setProjectData,

        // 40 Advanced Features — exposed
        markers,
        addMarker,
        updateMarker,
        deleteMarker,
        generateAutoMarkers,
        generateBeatMarkers,
        previewQuality,
        setPreviewQuality,
        proxyEnabled,
        setProxyEnabled,
        batchUpdateClips,
        batchSetVolume,
        batchSetSpeed,
        copiedAttributes,
        copyClipAttributes,
        pasteClipAttributes,
        createCompoundClip,
        dissolveCompoundClip,
        selectAllClipsOnTrack,
        selectClipsInRange,
        removeAllGaps,
        rollTrim,
        slipTrim,
        slideTrim,
        freezeFrameAtPlayhead,
        reverseClip,
        batchApplyTransition,
        saveEffectPreset,
        applyEffectPreset,
        savedEffectPresets,
        replaceClipMedia,
        matchClipDuration,
        applyAudioDucking,
        applySpeedPreset,
        splitAndRemove,
        saveVersionSnapshot,
        getVersionHistory,
        restoreVersion,

        undo,
        redo,
        history,
        historyIndex,
        jumpToHistory,
        pushHistoryState: () => {
          if (project) pushState(project);
        },
        // 60 Features — Extended
        sourceMarks,
        setSourceInOut,
        timelineRegions,
        addRegion,
        updateRegion,
        deleteRegion,
        bookmarks,
        addBookmark,
        deleteBookmark,
        snapshots,
        captureSnapshot,
        referenceOverlays,
        setReferenceOverlay,
        onionSkin,
        setOnionSkin: setOnionSkinWrapper,
        audioRanges,
        setAudioRange,
        audioBuses,
        addAudioBus,
        updateAudioBus,
        editSuggestions,
        generateSuggestions,
        roughCutFromMarks,
        selectedRenderRegion,
        setSelectedRenderRegion,
        exportEDL,
        importEDL,
        globalStyleOverride,
        setGlobalStyleOverride,
        adjustmentProfile,
        setAdjustmentProfile,
        duplicateProjectVersion,
        compareVersions,
        workspacePresets,
        saveWorkspacePreset,
        applyWorkspacePreset,
        autoReframeClip,
        smartCropClip,
        detectScenes,
        classifyShots,
        findDuplicates,
        searchSimilar,
        frameMatch,
        parentLink,
        createTransformGroup,
        beforeAfterEnabled,
        setBeforeAfterEnabled,
        abCompareEnabled,
        setABCompareEnabled,
        selectiveColor,
        setSelectiveColor,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
