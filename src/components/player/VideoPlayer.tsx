import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CaptionCanvasOverlay } from './CaptionCanvasOverlay';
import { PlayerControls } from './PlayerControls';
import { AspectRatio, VideoClip } from '../../types/project';
import { CAPTION_PRESET_STYLES } from '../../utils/presetStyles';
import { buildCssFilterString, renderCanvasPostEffects } from '../../utils/effectShaderEngine';
import { getActiveClipEffectsAtTime } from '../../utils/nleTimeline';
import { getActiveTransitionAtTime, renderTransitionOverlay } from '../../utils/transitionEngine';
import { buildColorGradingCssFilter, applyCanvasColorGrading } from '../../utils/colorGradingEngine';
import { getInterpolatedClipTransform } from '../../utils/keyframeEngine';
import { generateCssMaskStyle } from '../../utils/maskEngine';
import { extractSubjectMatteSync } from '../../utils/mattingEngine';
import { getStabilizationCssTransform } from '../../utils/stabilizationEngine';
import { getCameraShakeTransform } from '../../utils/cameraShakeEngine';
import { getAutoReframeTransform } from '../../utils/autoReframeEngine';
import { buildBeautyCssFilter } from '../../utils/beautyRetouchEngine';
import { renderCanvasParticles } from '../../utils/particleSystemEngine';
import { MotionGraphicRenderer } from './MotionGraphicRenderer';
import { AutoCaptionModal } from '../captions/AutoCaptionModal';
import { CropOverlay } from '../preview/CropOverlay';
import { RelinkModal } from '../modals/RelinkModal';
import {
  Smartphone,
  Monitor,
  Square,
  Film,
  Sparkles,
  Upload,
  X,
  Move,
  Check,
  AlignHorizontalJustifyCenter,
  Layers,
  Edit3,
  Palette,
  ChevronDown,
  Grid,
  Eye,
  Zap,
  Cpu,
  Activity,
} from 'lucide-react';
import { PreviewQuality, PREVIEW_QUALITY_ORDER, qualityToLabel, calculateDynamicQuality } from '../../utils/previewQualityEngine';
import { PerformanceHUD } from './PerformanceHUD';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { sanitizeTime } from '../../utils/timecode';
import { isImageFile } from '../../utils/mediaLoader';

const PLAYER_MOOD_COLORS = [
  { name: 'Blue', color: '#38BDF8', secondary: '#0284C7', glow: 'rgba(56, 189, 248, 0.55)', shadow: 'rgba(2, 132, 199, 0.95)', bg: 'bg-sky-400' },
  { name: 'Red', color: '#EF4444', secondary: '#991B1B', glow: 'rgba(239, 68, 68, 0.55)', shadow: 'rgba(220, 38, 38, 0.95)', bg: 'bg-red-500' },
  { name: 'Lime', color: '#84CC16', secondary: '#3F6212', glow: 'rgba(132, 204, 22, 0.55)', shadow: 'rgba(132, 204, 22, 0.95)', bg: 'bg-lime-500' },
  { name: 'Gold', color: '#FACC15', secondary: '#92400E', glow: 'rgba(250, 204, 21, 0.55)', shadow: 'rgba(250, 204, 21, 0.95)', bg: 'bg-amber-400' },
  { name: 'Purple', color: '#A855F2', secondary: '#6B21A8', glow: 'rgba(168, 85, 242, 0.55)', shadow: 'rgba(168, 85, 242, 0.95)', bg: 'bg-purple-500' },
  { name: 'White', color: '#FFFFFF', secondary: '#E2E8F0', glow: 'rgba(255, 255, 255, 0.35)', shadow: 'rgba(0, 0, 0, 0.95)', bg: 'bg-white' },
];

export const getAspectRatioClasses = (ratio: AspectRatio) => {
  switch (ratio) {
    case '9:16':
      return 'aspect-[9/16] h-full max-h-[calc(100vh-340px)] max-w-full';
    case '16:9':
      return 'aspect-[16/9] w-full max-w-[calc(100vw-680px)] max-h-[calc(100vh-340px)]';
    case '1:1':
      return 'aspect-[1/1] h-full max-h-[calc(100vh-340px)] max-w-full';
    case '4:5':
      return 'aspect-[4/5] h-full max-h-[calc(100vh-340px)] max-w-full';
    default:
      return 'aspect-[9/16] h-full max-h-[calc(100vh-340px)] max-w-full';
  }
};

export const getCanvasDimensions = (ratio: AspectRatio) => {
  switch (ratio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    default:
      return { width: 1080, height: 1920 };
  }
};

export const VideoPlayer: React.FC = () => {
  const {
    project,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    togglePlayPause,
    splitClipAtPlayhead,
    autoTranscribeVideo,
    isTranscribing,
    setProjectAspectRatio,
    importMediaFile,
    autoRatioToast,
    clearAutoRatioToast,
    updateCaptionPosition,
    updateActiveStyle,
    applyPresetStyle,
    updateCaptionLine,
    setCaptionLineStyleOverride,
    selectedCaptionId,
    setSelectedCaptionId,
    addEffectToClip,
    addTransition,
    setActiveSidebarTab,
    hiddenTracks,
    mutedTracks,
    lockedTracks,
    previewQuality,
    setPreviewQuality,
    proxyEnabled,
    setProxyEnabled,
    relinkMedia,
    batchRelinkFolder,
    updateClip,
    deleteCaptionLine,
    pushHistoryState,
    isCropping,
    setIsCropping,
  } = useProject() as any;

  const currentRatio = project?.metadata.aspectRatio || '9:16';
  const canvasDims = getCanvasDimensions(currentRatio);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const v2VideoRef = useRef<HTMLVideoElement | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const effectsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mattingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenMattingSrcRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showSafeMargins, setShowSafeMargins] = useState<boolean>(false);
  const [showPerformanceHUD, setShowPerformanceHUD] = useState<boolean>(false);

  const activeEffectsCount = useMemo(() => {
    return (project?.clips || []).reduce((acc: number, c: any) => acc + (c.effects?.filter((e: any) => e.enabled).length || 0), 0);
  }, [project?.clips]);

  const dynamicQuality = useMemo(() => {
    const workload = {
      activeClipsCount: (project?.clips || []).length,
      activeEffectsCount,
      activeCaptionsCount: (project?.captions || []).length,
      hasMatting: (project?.clips || []).some((c: any) => (c.matting && c.matting.isEnabled) || (c.backgroundRemoval && c.backgroundRemoval.mode !== 'none')),
      is4KFootage: (project?.clips || []).some((c: any) => (c.width && c.width >= 3840) || (c.height && c.height >= 2160)),
      fps: project?.metadata?.fps || 30,
    };
    return calculateDynamicQuality(previewQuality || 'auto', workload, false, isPlaying);
  }, [previewQuality, project?.clips, project?.captions, activeEffectsCount, isPlaying]);

  // Synchronize audio clips playback on audio tracks with playhead
  useEffect(() => {
    const audioClips = project?.audioClips || [];
    audioClips.forEach((ac: any) => {
      const el = audioElementsRef.current.get(ac.id);
      if (!el) return;
      const isClipActive = currentTime >= ac.timelineStart && currentTime < ac.timelineStart + ac.timelineDuration && !ac.isMuted && !isMuted;
      if (isClipActive) {
        const expectedTime = Math.max(0, (ac.startOffset || 0) + (currentTime - ac.timelineStart) * (ac.speed || 1.0));
        if (Math.abs(el.currentTime - expectedTime) > 0.15) {
          el.currentTime = expectedTime;
        }
        el.volume = Math.min(1.0, Math.max(0, volume * (ac.volume ?? 1.0)));
        el.playbackRate = ac.speed || 1.0;
        if (isPlaying && el.paused) {
          el.play().catch(() => {});
        } else if (!isPlaying && !el.paused) {
          el.pause();
        }
      } else {
        if (!el.paused) {
          el.pause();
        }
      }
    });
  }, [currentTime, isPlaying, volume, isMuted, project?.audioClips]);

  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach((el) => el.pause());
    };
  }, []);

  // Caption Dragging, Resizing, Rotation & In-Place Text Editing State (P3-P15 premium)
  const [isDraggingCaption, setIsDraggingCaption] = useState<boolean>(false);
  const [isResizingHandle, setIsResizingHandle] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [resizeStart, setResizeStart] = useState<{ startX: number; startY: number; startFontSize: number; startMaxWidth?: number; startRotation?: number; startAngle?: number } | null>(null);
  const [isHoveringCaption, setIsHoveringCaption] = useState<boolean>(false);
  const [appliedAllToast, setAppliedAllToast] = useState<boolean>(false);
  const [isEditingText, setIsEditingText] = useState<boolean>(false);
  const [inlineEditText, setInlineEditText] = useState<string>('');
  const [showTemplateMenu, setShowTemplateMenu] = useState<boolean>(false);
  const [showAutoCaptionModal, setShowAutoCaptionModal] = useState<boolean>(false);
  const [activeGuides, setActiveGuides] = useState<{ vertical: boolean; horizontal: boolean; topSafe: boolean; bottomSafe: boolean }>({ vertical: false, horizontal: false, topSafe: false, bottomSafe: false });

  // Video Proxy state for unsupported formats (HEVC, MKV, 10-bit, etc.)
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [isGeneratingProxy, setIsGeneratingProxy] = useState<boolean>(false);
  // Tracks a source that failed to load even after fallbacks, so the UI can
  // show OFFLINE/relink instead of a silent black frame.
  const [videoError, setVideoError] = useState<{ clipId: string; src: string } | null>(null);

  const isImageClip = (c: any) => {
    if (!c) return false;
    if (c.mediaType === 'image') return true;
    const n = (c.name || c.filePath || '') as string;
    return isImageFile(n);
  };

  // Find active clips on V1 (main) and V2 (overlay/B-roll) at current timeline position — image clips are real timeline clips (duration >0)
  const activeClip = project?.clips?.find(
    (c: any) => (c.trackIndex || 1) === 1 && currentTime >= c.timelineStart && currentTime < c.timelineStart + c.timelineDuration
  ) || project?.clips?.find((c: any) => (c.trackIndex || 1) === 1 && currentTime >= c.timelineStart && currentTime < c.timelineStart + c.timelineDuration) || project?.clips?.[0];

  const activeV2Clip = project?.clips?.find(
    (c: any) => (c.trackIndex || 1) === 2 && currentTime >= c.timelineStart && currentTime < c.timelineStart + c.timelineDuration
  );

  const [isRelinkModalOpen, setIsRelinkModalOpen] = useState(false);
  const missingMedia: string[] | undefined = (project as any)?.missingMedia;
  const isMissingByRegistry = !!(
    activeClip &&
    !activeClip.mediaBlobUrl &&
    (missingMedia?.includes(activeClip.filePath) ||
      missingMedia?.includes(activeClip.name) ||
      (activeClip.mediaId && missingMedia?.includes(activeClip.mediaId)))
  );
  const isMissingByError = !!(
    activeClip &&
    videoError &&
    videoError.clipId === activeClip.id &&
    !proxyUrl
  );
  const isMissing = isMissingByRegistry || isMissingByError;

  // When the timeline moves to a different clip, drop per-clip fallback state
  // so a previous clip's proxy/error cannot leak into the new clip's playback.
  useEffect(() => {
    setProxyUrl(null);
    setVideoError(null);
  }, [activeClip?.id]);

  // Resolve playable video source with protocol support
  const getVideoSrc = (targetClip?: VideoClip) => {
    const c = targetClip || activeClip;
    if (!c) return '';
    if (proxyUrl && c === activeClip) return proxyUrl;
    if (c.mediaBlobUrl) return c.mediaBlobUrl;
    if (!c.filePath) return '';

    const p = c.filePath ? c.filePath.trim() : '';
    if (!p) return '';
    if (p.startsWith('blob:') || p.startsWith('http://') || p.startsWith('https://')) return p;

    const clean = p.replace(/\\/g, '/');
    if (!clean || clean === '/') return '';
    if (clean.startsWith('captionforge-media://')) return clean;
    if (clean.startsWith('file://')) {
      const withoutFile = clean.replace(/^file:\/\/\/?/, '');
      return withoutFile ? `captionforge-media://${withoutFile}` : '';
    }
    return `captionforge-media://${clean}`;
  };

  const videoSrc = getVideoSrc(activeClip);
  const v2VideoSrc = activeV2Clip ? getVideoSrc(activeV2Clip) : '';

  // Handle video element errors with a fallback chain before giving up:
  // 1. retry via absolute-path protocol URL (covers stale blob: sources),
  // 2. generate an ffmpeg preview proxy for unsupported codecs,
  // 3. otherwise flag OFFLINE so relink UI appears instead of black.
  const handleVideoError = async (e: any) => {
    const failedSrc = (e?.target as HTMLVideoElement)?.currentSrc || videoSrc;
    console.warn(
      `[VideoPlayer] source failed clip=${activeClip?.id || '(none)'} ` +
        `name=${activeClip?.name || '(none)'} src=${String(failedSrc).slice(0, 120)}`
    );
    if (!activeClip || isGeneratingProxy) return;

    // Step 1: stale blob: URL but absolute path on disk -> retry via protocol.
    const fp = activeClip.filePath || '';
    const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(fp) || fp.startsWith('/') || fp.startsWith('file://');
    const failedOnBlob = String(failedSrc).startsWith('blob:');
    if (failedOnBlob && isAbsolutePath && !proxyUrl) {
      const clean = fp.replace(/^file:\/\//, '').replace(/\\/g, '/');
      console.info(`[VideoPlayer] retrying via protocol URL for clip=${activeClip.id}`);
      setProxyUrl(`captionforge-media://${clean}`);
      return;
    }

    // Step 2: unsupported codec -> ffmpeg proxy.
    if (activeClip?.filePath && window.captionForgeAPI?.getPreviewProxy) {
      try {
        setIsGeneratingProxy(true);
        const proxyPath = await window.captionForgeAPI.getPreviewProxy(activeClip.filePath);
        if (proxyPath && proxyPath !== activeClip.filePath) {
          const clean = proxyPath.replace(/\\/g, '/');
          setProxyUrl(`captionforge-media://${clean}`);
          return;
        }
      } catch (err) {
        console.error('[VideoPlayer] preview proxy generation failed:', err);
      } finally {
        setIsGeneratingProxy(false);
      }
    }

    // Step 3: unrecoverable -> surface OFFLINE/relink UI.
    console.error(
      `[VideoPlayer] media unrestorable clip=${activeClip.id} path=${activeClip.filePath} ` +
        `mediaId=${activeClip.mediaId || '(none)'}`
    );
    setVideoError({ clipId: activeClip.id, src: String(failedSrc) });
  };

  // Active caption line at current playhead
  const activeCaptionLine = project?.captions.find(
    (c: any) => currentTime >= c.start && currentTime <= c.end
  ) || project?.captions.find((c: any) => c.id === selectedCaptionId) || project?.captions[0];

  // Current effective position, font size, rotation, scale, maxWidth (P5-P12)
  const currentX = activeCaptionLine?.styleOverride?.xOffsetPercent ?? project?.activeStyle.xOffsetPercent ?? 50;
  const currentY = activeCaptionLine?.styleOverride?.yOffsetPercent ?? project?.activeStyle.yOffsetPercent ?? 75;
  const currentFontSize = activeCaptionLine?.styleOverride?.fontSize ?? project?.activeStyle.fontSize ?? 54;
  const currentRotation = (activeCaptionLine?.styleOverride as any)?.rotation ?? (project?.activeStyle as any)?.rotation ?? 0;
  const currentScale = (activeCaptionLine?.styleOverride as any)?.scale ?? (project?.activeStyle as any)?.scale ?? 1;
  const currentMaxWidth = (activeCaptionLine?.styleOverride as any)?.maxWidthPercent ?? (project?.activeStyle as any)?.maxWidthPercent ?? 88;

  // Calculate corresponding source video timestamp — sanitized to prevent NaN propagation
  // For images, return 0 (static frame)
  const calculateSourceTime = (t: number) => {
    const saneT = sanitizeTime(t, 0);
    if (!isFinite(saneT)) return 0;
    if (!activeClip) return saneT;
    if (isImageClip(activeClip)) return 0;
    const start = sanitizeTime(activeClip.timelineStart, 0);
    const offsetInTimeline = Math.max(0, saneT - start);
    const dur = sanitizeTime(activeClip.duration, 5);
    const sOff = sanitizeTime(activeClip.startOffset, 0);
    const eOff = sanitizeTime(activeClip.endOffset, dur);
    const spd = sanitizeTime(activeClip.speed || 1.0, 1);
    const res = sOff + offsetInTimeline * spd;
    if (!isFinite(res)) return sOff;
    return Math.min(eOff, Math.min(dur, res));
  };

  // Synchronize HTML5 video element with context currentTime when paused or seeking — skip for image clips (static)
  useEffect(() => {
    if (isImageClip(activeClip)) return;
    const video = videoRef.current;
    if (!video || !activeClip) return;
    const targetSrcTime = calculateSourceTime(currentTime);
    if (isPlaying) {
      if (Math.abs(video.currentTime - targetSrcTime) > 0.85) {
        video.currentTime = targetSrcTime;
      }
      return;
    }
    if (!video.seeking && Math.abs(video.currentTime - targetSrcTime) > 0.02) {
      video.currentTime = targetSrcTime;
    }
  }, [currentTime, activeClip, isPlaying]);

  // Synchronize play / pause state — images have no video element to control
  useEffect(() => {
    if (isImageClip(activeClip)) return;
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying && video.paused) {
      video.play().catch(() => setIsPlaying(false));
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, setIsPlaying, activeClip]);

  // Real-time canvas post-effects and transition rendering function
  const renderEffectsAndTransitions = useCallback((time: number) => {
    const canvas = effectsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasDims.width, canvasDims.height);

    // 1. Render active clip post-processing effects — time-gated through the
    // shared NLE core so preview matches export exactly (timed effect bars).
    if (activeClip?.effects && activeClip.effects.length > 0) {
      const fps = project?.metadata?.fps || 30;
      renderCanvasPostEffects(ctx, canvasDims.width, canvasDims.height, getActiveClipEffectsAtTime(activeClip, time, fps), time);
    }

    // 1.5. Render active timeline adjustment layer / effect overlays
    const activeEffectOverlays = (project?.overlays || []).filter(
      (ov: any) =>
        ((ov.type as any) === 'effect' || (ov.type as any) === 'filter') &&
        time >= ov.timelineStart &&
        time <= ov.timelineStart + ov.timelineDuration
    );
    for (const effOv of activeEffectOverlays) {
      if (effOv.effectType) {
        renderCanvasPostEffects(
          ctx,
          canvasDims.width,
          canvasDims.height,
          [
            {
              id: effOv.id,
              type: effOv.effectType as any,
              name: effOv.name,
              category: 'creative',
              enabled: true,
              params: effOv.params || {},
            },
          ],
          time
        );
      }
    }

    // 2. Render real-time color grading (Lift, Gamma, Gain, Curves)
    if ((activeClip as any)?.colorGrading) {
      applyCanvasColorGrading(ctx, canvasDims.width, canvasDims.height, (activeClip as any).colorGrading);
    }

    // 3. Render active transition overlay at edit points
    const activeTrans = getActiveTransitionAtTime(time, project?.transitions, project?.clips);
    if (activeTrans) {
      renderTransitionOverlay(ctx, canvasDims.width, canvasDims.height, activeTrans);
    }

    // 4. Render procedural particle overlays
    if ((activeClip as any)?.particles?.isEnabled) {
      renderCanvasParticles(ctx, canvasDims.width, canvasDims.height, (activeClip as any).particles, time);
    }

    // 5. Render real-time AI background removal matte preview
    if (activeClip?.matting?.isEnabled) {
      renderMattingFrame();
    }
  }, [activeClip, project?.transitions, project?.clips, project?.overlays, canvasDims]);

  // Real-time AI background removal foreground cutout renderer
  const renderMattingFrame = useCallback(() => {
    if (!activeClip?.matting?.isEnabled) return;
    const targetCanvas = mattingCanvasRef.current;
    if (!targetCanvas) return;

    const v1IsImage = isImageClip(activeClip);
    let sourceEl: HTMLImageElement | HTMLVideoElement | null = null;
    let sWidth = 0;
    let sHeight = 0;

    if (v1IsImage) {
      const img = containerRef.current?.querySelector('img') as HTMLImageElement | null;
      if (img && img.complete && img.naturalWidth > 0) {
        sourceEl = img;
        sWidth = img.naturalWidth;
        sHeight = img.naturalHeight;
      }
    } else {
      const vid = videoRef.current;
      if (vid && vid.readyState >= 2) {
        sourceEl = vid;
        sWidth = vid.videoWidth;
        sHeight = vid.videoHeight;
      }
    }

    if (!sourceEl || sWidth === 0 || sHeight === 0) return;

    const renderWidth = Math.min(sWidth, canvasDims.width);
    const renderHeight = Math.min(sHeight, canvasDims.height);

    if (!offscreenMattingSrcRef.current) {
      offscreenMattingSrcRef.current = document.createElement('canvas');
    }
    const offSrc = offscreenMattingSrcRef.current;
    if (offSrc.width !== renderWidth || offSrc.height !== renderHeight) {
      offSrc.width = renderWidth;
      offSrc.height = renderHeight;
    }

    const offCtx = offSrc.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;
    offCtx.drawImage(sourceEl, 0, 0, renderWidth, renderHeight);

    if (targetCanvas.width !== renderWidth || targetCanvas.height !== renderHeight) {
      targetCanvas.width = renderWidth;
      targetCanvas.height = renderHeight;
    }

    extractSubjectMatteSync(offSrc, targetCanvas, activeClip.matting);
  }, [activeClip, canvasDims]);

  // High-precision, buttery-smooth 60fps playback animation loop without feedback hitching
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTimeAdvance = performance.now();

    const syncLoop = () => {
      const totalDur = project?.metadata.duration || 10;
      const isImage = isImageClip(activeClip);

      // Image clips and gaps: time-based advancement (static image holds for full duration)
      if (isImage || !activeClip) {
        const now = performance.now();
        const delta = (now - lastTimeAdvance) / 1000;
        lastTimeAdvance = now;
        if (delta > 0 && delta < 0.12) {
          const next = currentTime + delta;
          if (next >= totalDur) {
            setIsPlaying(false);
            setCurrentTime(totalDur);
            return;
          }
          // If at end of image clip, allow seamless continuation — no black gap
          setCurrentTime(Math.min(totalDur, next));
          renderEffectsAndTransitions(next);
        }
        animId = requestAnimationFrame(syncLoop);
        return;
      }

      const video = videoRef.current;
      if (video && activeClip && !video.paused) {
        const sourceCurrent = video.currentTime;
        const timelineOffset = (sourceCurrent - activeClip.startOffset) / (activeClip.speed || 1.0);
        const newTimelineTime = activeClip.timelineStart + timelineOffset;
        renderEffectsAndTransitions(newTimelineTime);
        const effectiveEnd = activeClip.endOffset || activeClip.duration;
        if (sourceCurrent >= effectiveEnd - 0.03) {
          const allV1Clips = (project?.clips || [])
            .filter((c: any) => (c.trackIndex || 1) === 1)
            .sort((a: any, b: any) => a.timelineStart - b.timelineStart);
          const nextClip = allV1Clips.find(
            (c: any) => c.timelineStart >= activeClip.timelineStart + activeClip.timelineDuration - 0.04
          );
          if (nextClip) {
            if (nextClip.filePath === activeClip.filePath) {
              video.currentTime = nextClip.startOffset;
            }
            setCurrentTime(nextClip.timelineStart);
          } else {
            video.pause();
            setIsPlaying(false);
            setCurrentTime(Math.min(totalDur, activeClip.timelineStart + activeClip.timelineDuration));
            return;
          }
        } else {
          setCurrentTime(Math.min(totalDur, newTimelineTime));
        }
      } else if (isPlaying) {
        const now = performance.now();
        const delta = (now - lastTimeAdvance) / 1000;
        lastTimeAdvance = now;
        if (delta > 0 && delta < 0.1) {
          if (currentTime + delta >= totalDur) {
            setIsPlaying(false);
            setCurrentTime(totalDur);
            return;
          } else {
            setCurrentTime(currentTime + delta);
            renderEffectsAndTransitions(currentTime + delta);
          }
        }
      }
      animId = requestAnimationFrame(syncLoop);
    };

    animId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, activeClip, project?.clips, project?.metadata.duration, currentTime, setCurrentTime, setIsPlaying, renderEffectsAndTransitions]);

  // Synchronize playback speed with activeClip and activeV2Clip
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const spd = Math.max(0.1, Math.min(16.0, activeClip?.speed || 1.0));
      if (video.playbackRate !== spd) {
        video.playbackRate = spd;
      }
    }
  }, [activeClip?.speed]);

  useEffect(() => {
    const v2Video = v2VideoRef.current;
    if (v2Video) {
      const spd = Math.max(0.1, Math.min(16.0, activeV2Clip?.speed || 1.0));
      if (v2Video.playbackRate !== spd) {
        v2Video.playbackRate = spd;
      }
    }
  }, [activeV2Clip?.speed]);

  // Real-time canvas post-effects and transition rendering loop when paused/scrubbing
  useEffect(() => {
    renderEffectsAndTransitions(currentTime);
  }, [currentTime, renderEffectsAndTransitions]);

  // Drag & Drop media file onto viewport
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setProxyUrl(null);
      await importMediaFile(file, undefined, true);
      return;
    }

    try {
      const { getDragPayload: getPayload, clearDragPayload: clearPayload } = await import('../../utils/nleDnD');
      const { resolveEffectPreset: resolveFx, resolveTransitionPreset: resolveTr } = await import('../../utils/presetBridge');
      const data = getPayload(e as any);
      clearPayload();
      if (data) {
        if (data.type === 'effect' && (data.effectType || (data as any).presetId) && activeClip) {
          const presetId = data.effectType || (data as any).presetId;
          const resolved = resolveFx(presetId);
          if (resolved) {
            addEffectToClip(activeClip.id, resolved.engineType as any, { dropTime: currentTime, params: { ...resolved.params, ...(data.params || {}) } });
            setActiveSidebarTab('effects');
          }
        } else if (data.type === 'filter' && activeClip) {
          const presetId = (data as any).filterId || (data as any).presetId || (data as any).id;
          const resolved = presetId ? resolveFx(presetId) : null;
          if (resolved) {
            addEffectToClip(activeClip.id, resolved.engineType as any, { dropTime: currentTime, params: { ...resolved.params, ...(data.params || {}) } });
            setActiveSidebarTab('effects');
          }
        } else if (data.type === 'transition' && (data.transitionType || (data as any).presetId) && activeClip) {
          const presetId = data.transitionType || (data as any).presetId;
          const resolved = resolveTr(presetId);
          if (resolved) {
            addTransition({
              type: resolved.engineType,
              name: resolved.name,
              fromClipId: activeClip.id,
              toClipId: activeClip.id,
              timelineStart: currentTime,
              duration: resolved.duration,
              alignment: 'center',
              direction: resolved.direction,
              params: { ...resolved.params },
            });
            setActiveSidebarTab('transitions');
          }
        } else if ((data as any).type === 'preset' && (data as any).presetKey) {
          applyPresetStyle((data as any).presetKey);
          setActiveSidebarTab('styles');
        }
      }
    } catch {
      // ignore
    }
  };

  // Interactive On-Canvas Caption Drag & Move Handlers
  const handleCaptionMouseDown = (e: React.MouseEvent) => {
    if (isResizingHandle || isEditingText) return;
    e.stopPropagation();
    setIsDraggingCaption(true);
    if (activeCaptionLine) {
      setSelectedCaptionId(activeCaptionLine.id);
    }
  };

  // In-Place Text Editing Handlers
  const handleStartEditText = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeCaptionLine) return;
    setInlineEditText(activeCaptionLine.text);
    setIsEditingText(true);
    setIsDraggingCaption(false);
    setTimeout(() => {
      textInputRef.current?.focus();
      textInputRef.current?.select();
    }, 60);
  };

  const handleFinishEditText = () => {
    if (activeCaptionLine && inlineEditText.trim()) {
      updateCaptionLine(activeCaptionLine.id, inlineEditText.trim());
    }
    setIsEditingText(false);
  };

  // Interactive On-Canvas Resize / Scale Handlers (Corner + Side + Rotation)
  const handleResizeHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingHandle(handle);
    setResizeStart({
      startX: e.clientX,
      startY: e.clientY,
      startFontSize: currentFontSize,
      startMaxWidth: currentMaxWidth,
      startRotation: currentRotation,
    });
    if (activeCaptionLine) {
      setSelectedCaptionId(activeCaptionLine.id);
    }
  };

  const handleRotationMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const centerX = rect.left + (currentX / 100) * rect.width;
    const centerY = rect.top + (currentY / 100) * rect.height;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    setIsRotating(true);
    setResizeStart({
      startX: e.clientX,
      startY: e.clientY,
      startFontSize: currentFontSize,
      startRotation: currentRotation,
      startAngle,
    });
    if (activeCaptionLine) setSelectedCaptionId(activeCaptionLine.id);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // ROTATION — P8 with snap to 0/45/90/180
      if (isRotating && resizeStart && viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        const centerX = rect.left + (currentX / 100) * rect.width;
        const centerY = rect.top + (currentY / 100) * rect.height;
        const curAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
        const deltaAngle = curAngle - (resizeStart.startAngle || 0);
        let newRot = (resizeStart.startRotation || 0) + deltaAngle;
        // Snap
        const snapAngles = [0, 45, 90, 180, -45, -90, -180];
        for (const sa of snapAngles) {
          if (Math.abs(newRot - sa) < 6) { newRot = sa; break; }
          if (Math.abs(newRot - (sa + 360)) < 6) { newRot = sa + 360; break; }
        }
        newRot = Math.max(-180, Math.min(180, Math.round(newRot)));
        // Store via styleOverride rotation
        if (activeCaptionLine) {
          setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), rotation: newRot } as any);
        } else {
          updateActiveStyle({ rotation: newRot } as any);
        }
        return;
      }

      if (isResizingHandle && resizeStart) {
        // Side handles: e/w adjust maxWidthPercent, n/s adjust fontSize vertical, corners adjust fontSize
        if (isResizingHandle === 'e' || isResizingHandle === 'w') {
          const deltaX = (e.clientX - resizeStart.startX) * (isResizingHandle === 'e' ? 1 : -1);
          const viewportW = viewportRef.current?.getBoundingClientRect().width || 400;
          const deltaPercent = (deltaX / viewportW) * 100 * 1.2;
          const newMaxW = Math.min(95, Math.max(30, Math.round((resizeStart.startMaxWidth || 88) + deltaPercent)));
          if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), maxWidthPercent: newMaxW } as any);
          else updateActiveStyle({ maxWidthPercent: newMaxW } as any);
          return;
        }
        if (isResizingHandle === 'n' || isResizingHandle === 's') {
          const deltaY = (e.clientY - resizeStart.startY) * (isResizingHandle === 's' ? 1 : -1);
          const newSize = Math.min(120, Math.max(16, Math.round((resizeStart.startFontSize || 54) + deltaY * 0.28)));
          if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), fontSize: newSize } as any);
          else updateActiveStyle({ fontSize: newSize });
          return;
        }
        // Corner handles: uniform font-size scaling (preserve glyph proportions P6)
        let delta = 0;
        if (isResizingHandle === 'se') delta = (e.clientX - resizeStart.startX) + (e.clientY - resizeStart.startY);
        else if (isResizingHandle === 'nw') delta = (resizeStart.startX - e.clientX) + (resizeStart.startY - e.clientY);
        else if (isResizingHandle === 'ne') delta = (e.clientX - resizeStart.startX) + (resizeStart.startY - e.clientY);
        else if (isResizingHandle === 'sw') delta = (resizeStart.startX - e.clientX) + (e.clientY - resizeStart.startY);
        const newSize = Math.min(120, Math.max(18, Math.round((resizeStart.startFontSize || 54) + delta * 0.35)));
        if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), fontSize: newSize } as any);
        else updateActiveStyle({ fontSize: newSize });
        return;
      }

      if (!isDraggingCaption || !viewportRef.current) return;

      const rect = viewportRef.current.getBoundingClientRect();
      let rawX = ((e.clientX - rect.left) / rect.width) * 100;
      let rawY = ((e.clientY - rect.top) / rect.height) * 100;

      // Smart guides & snapping (P9): center, edges, safe areas
      let snapV = false, snapH = false, snapTopSafe = false, snapBottomSafe = false;
      // Vertical center
      if (Math.abs(rawX - 50) < 2.8) { rawX = 50; snapV = true; }
      // Horizontal center
      if (Math.abs(rawY - 50) < 2.8) { rawY = 50; snapH = true; }
      // Canvas edges (5% / 95% with 2% snap)
      if (rawX < 7) { rawX = 5; snapV = true; } else if (rawX > 93) { rawX = 95; snapV = true; }
      if (rawY < 7) { rawY = 5; snapTopSafe = true; } else if (rawY > 93) { rawY = 95; snapBottomSafe = true; }
      // Safe area guides (10% action safe, 20% title safe) — snap to 10, 18, 80, 90
      if (Math.abs(rawX - 10) < 1.8) { rawX = 10; snapV = true; }
      if (Math.abs(rawX - 90) < 1.8) { rawX = 90; snapV = true; }
      if (Math.abs(rawY - 10) < 1.8) { rawY = 10; snapTopSafe = true; }
      if (Math.abs(rawY - 90) < 1.8) { rawY = 90; snapBottomSafe = true; }
      // Common caption positions (18 lower-third, 30 upper third, 76 bottom)
      if (Math.abs(rawY - 18) < 2.2) { rawY = 18; snapH = true; }
      if (Math.abs(rawY - 76) < 2.2) { rawY = 76; snapH = true; }
      if (Math.abs(rawY - 30) < 2.0) { rawY = 30; snapH = true; }
      if (Math.abs(rawY - 82) < 2.0) { rawY = 82; snapH = true; }

      setActiveGuides({ vertical: snapV, horizontal: snapH, topSafe: snapTopSafe, bottomSafe: snapBottomSafe });

      // Apply to styleOverride for per-caption persistence (P44)
      if (activeCaptionLine) {
        setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), xOffsetPercent: Math.round(rawX * 10) / 10, yOffsetPercent: Math.round(rawY * 10) / 10 } as any);
      } else {
        updateCaptionPosition(rawX, rawY, true);
      }
    },
    [isDraggingCaption, isResizingHandle, isRotating, resizeStart, currentX, currentY, activeCaptionLine, updateCaptionPosition, updateActiveStyle, setCaptionLineStyleOverride]
  );

  const handleMouseUp = useCallback(() => {
    let hadInteraction = false;
    if (isDraggingCaption) {
      setIsDraggingCaption(false);
      setActiveGuides({ vertical: false, horizontal: false, topSafe: false, bottomSafe: false });
      hadInteraction = true;
    }
    if (isResizingHandle) {
      setIsResizingHandle(null);
      setResizeStart(null);
      hadInteraction = true;
    }
    if (isRotating) {
      setIsRotating(false);
      setResizeStart(null);
      hadInteraction = true;
    }
    if (hadInteraction && typeof pushHistoryState === 'function') {
      pushHistoryState();
    }
  }, [isDraggingCaption, isResizingHandle, isRotating, pushHistoryState]);

  useEffect(() => {
    if (isDraggingCaption || isResizingHandle || isRotating) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingCaption, isResizingHandle, isRotating, handleMouseMove, handleMouseUp]);

  // Professional Keyboard Shortcuts for Active Caption (Nudge, Delete, Deselect)
  useEffect(() => {
    if (!selectedCaptionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const step = e.shiftKey ? 2.0 : 0.5; // fine vs coarse nudge

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newX = Math.max(0, Math.min(100, currentX - step));
        if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), xOffsetPercent: newX } as any);
        else updateCaptionPosition(newX, currentY, true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newX = Math.max(0, Math.min(100, currentX + step));
        if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), xOffsetPercent: newX } as any);
        else updateCaptionPosition(newX, currentY, true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newY = Math.max(0, Math.min(100, currentY - step));
        if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), yOffsetPercent: newY } as any);
        else updateCaptionPosition(currentX, newY, true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newY = Math.max(0, Math.min(100, currentY + step));
        if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), yOffsetPercent: newY } as any);
        else updateCaptionPosition(currentX, newY, true);
      } else if (e.key === 'Delete' || (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        if (selectedCaptionId && typeof deleteCaptionLine === 'function') {
          deleteCaptionLine(selectedCaptionId);
          setSelectedCaptionId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedCaptionId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCaptionId, currentX, currentY, activeCaptionLine, setCaptionLineStyleOverride, updateCaptionPosition, deleteCaptionLine, setSelectedCaptionId]);

  const handleApplyToAllCaptions = () => {
    updateCaptionPosition(currentX, currentY, true);
    updateActiveStyle({ fontSize: currentFontSize, rotation: currentRotation as any, maxWidthPercent: currentMaxWidth as any, scale: currentScale as any });
    // Also clear per-line overrides so global applies
    setAppliedAllToast(true);
    setTimeout(() => setAppliedAllToast(false), 2200);
  };

  const handlePositionPreset = (preset: 'top' | 'upper' | 'center' | 'lower' | 'bottom') => {
    const presetY: Record<string, number> = { top: 12, upper: 30, center: 50, lower: 75, bottom: 88 };
    const y = presetY[preset];
    const x = 50;
    if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride || {}), xOffsetPercent: x, yOffsetPercent: y, position: preset === 'top' ? 'top' : preset === 'bottom' ? 'bottom' : preset === 'center' ? 'middle' : 'custom' } as any);
    else updateCaptionPosition(x, y, true);
  };

  const textLen = activeCaptionLine?.text?.length || 10;
  // P13 responsive: respect maxWidthPercent and scale, prevent overflow
  const baseWidth = Math.max(220, Math.min(920, textLen * (currentFontSize * 0.42) * (currentScale || 1)));
  const viewportW = viewportRef.current?.getBoundingClientRect().width || 480;
  const maxWByPercent = (viewportW * (currentMaxWidth / 100));
  const computedBoxWidth = Math.max(200, Math.min(maxWByPercent, baseWidth, 900));
  const computedBoxHeight = Math.max(48, (activeCaptionLine?.words?.length || 1) > 3 ? currentFontSize * (currentScale || 1) * 2.4 : currentFontSize * (currentScale || 1) * 1.45);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col bg-canvas-dark relative overflow-hidden select-none min-w-0"
    >
      {/* Auto Ratio Notification Banner */}
      {autoRatioToast && (
        <div className="absolute top-12 right-4 z-50 bg-canvas-card border border-forge-cyan/50 text-white px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in pointer-events-auto text-xs">
          <Sparkles className="w-3.5 h-3.5 text-forge-cyan flex-shrink-0" />
          <div>
            <span className="font-bold block">
              Auto Aspect Ratio: <span className="text-forge-cyan font-mono">{autoRatioToast.ratio}</span>
            </span>
          </div>
          <button
            onClick={clearAutoRatioToast}
            className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Monitor Header Toolbar */}
      <div className="h-10 bg-canvas-dark border-b border-canvas-border px-3 flex items-center justify-between text-xs flex-shrink-0">
        {/* Left: Monitor Label & Aspect Ratio Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-mono text-[10px] uppercase font-bold tracking-wider">
            PROGRAM MONITOR
          </span>

          <div className="w-[1px] h-3.5 bg-canvas-border" />

          {/* Aspect Ratio Switcher */}
          <div className="flex bg-canvas-surface rounded-md p-0.5 border border-canvas-border">
            <button
              onClick={() => setProjectAspectRatio('9:16')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-all ${
                currentRatio === '9:16' ? 'bg-canvas-card text-white font-bold shadow-xs border border-canvas-border' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="9:16 (TikTok / Reels / Shorts)"
            >
              <Smartphone className="w-3 h-3" />
              9:16
            </button>
            <button
              onClick={() => setProjectAspectRatio('16:9')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-all ${
                currentRatio === '16:9' ? 'bg-canvas-card text-white font-bold shadow-xs border border-canvas-border' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="16:9 (YouTube / Landscape)"
            >
              <Monitor className="w-3 h-3" />
              16:9
            </button>
            <button
              onClick={() => setProjectAspectRatio('1:1')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-all ${
                currentRatio === '1:1' ? 'bg-canvas-card text-white font-bold shadow-xs border border-canvas-border' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="1:1 (Square)"
            >
              <Square className="w-3 h-3" />
              1:1
            </button>
            <button
              onClick={() => setProjectAspectRatio('4:5')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-all ${
                currentRatio === '4:5' ? 'bg-canvas-card text-white font-bold shadow-xs border border-canvas-border' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="4:5 (Portrait)"
            >
              <Film className="w-3 h-3" />
              4:5
            </button>
          </div>
        </div>

        {/* Right: Safe Margins Guide & Position HUD */}
        <div className="flex items-center gap-2 text-xs">
          {/* Safe Margins Toggle */}
          <button
            onClick={() => setShowSafeMargins(!showSafeMargins)}
            className={`p-1.5 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
              showSafeMargins
                ? 'bg-canvas-card border-forge-cyan text-forge-cyan'
                : 'border-canvas-border text-gray-400 hover:text-gray-200 hover:bg-canvas-surface'
            }`}
            title="Toggle Title & Action Safe Margin Guides"
          >
            <Grid className="w-3 h-3" />
            <span>Guides</span>
          </button>

          {/* Performance Diagnostics Monitor */}
          <button
            onClick={() => setShowPerformanceHUD(!showPerformanceHUD)}
            className={`p-1.5 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
              showPerformanceHUD
                ? 'bg-canvas-card border-forge-cyan text-forge-cyan ring-1 ring-forge-cyan'
                : 'border-canvas-border text-gray-400 hover:text-gray-200 hover:bg-canvas-surface'
            }`}
            title="Toggle Live Performance Diagnostics & Telemetry HUD (FPS, Latency, Cache Hit Rate)"
          >
            <Activity className="w-3 h-3 text-forge-cyan animate-pulse" />
            <span>Stats</span>
          </button>

          {/* Preview Quality (Feature 22) */}
          <div className="flex items-center bg-canvas-surface rounded-md border border-canvas-border p-0.5">
            {PREVIEW_QUALITY_ORDER.map((q) => (
              <button
                key={q}
                onClick={() => setPreviewQuality(q as PreviewQuality)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${previewQuality === q ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                title={`Preview Quality: ${qualityToLabel(q as PreviewQuality)} — export remains full/original quality`}
              >
                {qualityToLabel(q as PreviewQuality)}
              </button>
            ))}
          </div>

          {/* Proxy Mode (Feature 21) */}
          <button
            onClick={() => setProxyEnabled(!proxyEnabled)}
            className={`p-1.5 rounded-md border text-[10px] font-bold flex items-center gap-1 ${proxyEnabled ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-canvas-surface border-canvas-border text-gray-400 hover:text-white'}`}
            title={proxyEnabled ? 'Proxy ON — editing with lightweight proxies, export uses original' : 'Proxy OFF — click for smoother 4K editing'}
          >
            <Cpu className="w-3 h-3" />
            <span>Proxy</span>
          </button>

          {/* Position HUD */}
          <div className="flex items-center gap-1 text-gray-400 bg-canvas-surface px-2 py-0.5 rounded border border-canvas-border font-mono text-[10px]">
            <Move className="w-2.5 h-2.5 text-forge-purple" />
            <span>X: {Math.round(currentX)}%</span>
            <span>•</span>
            <span>Y: {Math.round(currentY)}%</span>
          </div>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-3 relative overflow-hidden bg-black/50"
      >
        {/* Real-time Performance Telemetry HUD */}
        <PerformanceHUD
          isOpen={showPerformanceHUD}
          onClose={() => setShowPerformanceHUD(false)}
          activeClipsCount={(project?.clips || []).length}
          activeTracksCount={2}
          activeEffectsCount={activeEffectsCount}
          previewScale={dynamicQuality.effectiveScale}
        />

        {/* Full-size Drag Over Overlay */}
        {isDragOver && (
          <div className="absolute inset-3 z-50 rounded-xl bg-canvas-surface/90 border-2 border-dashed border-forge-purple flex flex-col items-center justify-center text-white space-y-2 pointer-events-none animate-fade-in">
            <Upload className="w-10 h-10 text-forge-cyan animate-bounce" />
            <p className="text-xs font-bold">Drop video here to load footage</p>
          </div>
        )}

        <div
          ref={viewportRef}
          className={`relative rounded-lg overflow-hidden shadow-2xl border border-canvas-border bg-black flex items-center justify-center transition-all duration-200 ${getAspectRatioClasses(
            currentRatio
          )}`}
        >
          {videoSrc ? (
            <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
              {(() => {
                const v1Transform = getInterpolatedClipTransform(activeClip, currentTime);
                const v2Transform = getInterpolatedClipTransform(activeV2Clip, currentTime);
                const v1MaskStyle = generateCssMaskStyle(activeClip?.mask);
                const v2MaskStyle = generateCssMaskStyle(activeV2Clip?.mask);
                const v1Stabilization = getStabilizationCssTransform(currentTime, activeClip?.stabilization);
                const v1Shake = getCameraShakeTransform(currentTime, (activeClip as any)?.cameraShake);
                const v1Reframe = getAutoReframeTransform(currentTime, (activeClip as any)?.autoReframe);
                const v1Beauty = buildBeautyCssFilter((activeClip as any)?.beautyRetouch);

                // Global / Timeline Adjustment Layer Filter Overlays (CapCut style)
                const activeFilterOverlays = (project?.overlays || []).filter(
                  (ov: any) =>
                    ((ov.type as any) === 'effect' || (ov.type as any) === 'filter') &&
                    currentTime >= ov.timelineStart &&
                    currentTime <= ov.timelineStart + ov.timelineDuration
                );
                const overlayFilterString = activeFilterOverlays
                  .map((ov: any) => {
                    if (ov.effectType) {
                      return buildCssFilterString([
                        {
                          id: ov.id,
                          type: ov.effectType,
                          name: ov.name,
                          category: 'creative',
                          enabled: true,
                          params: ov.params || {},
                        },
                      ]);
                    }
                    return '';
                  })
                  .filter(Boolean)
                  .join(' ');

                const v1IsImage = isImageClip(activeClip);
                const v2IsImage = isImageClip(activeV2Clip);
                const v1CropStyle = activeClip?.crop ? { clipPath: `inset(${activeClip.crop.top}% ${activeClip.crop.right}% ${activeClip.crop.bottom}% ${activeClip.crop.left}%)` } : {};
                const v2CropStyle = activeV2Clip?.crop ? { clipPath: `inset(${activeV2Clip.crop.top}% ${activeV2Clip.crop.right}% ${activeV2Clip.crop.bottom}% ${activeV2Clip.crop.left}%)` } : {};

                const isMattingActive = !!activeClip?.matting?.isEnabled;
                const isBehindSubject = isMattingActive && !!activeClip?.matting?.placeCaptionsBehindSubject;
                const v1EffectiveOpacity = hiddenTracks['v1'] ? 0 : (isMattingActive && !isBehindSubject ? 0 : v1Transform.opacity);
                const v1MattingTransform = [
                  v1Reframe.transform,
                  v1Shake.transform,
                  v1Stabilization.transform,
                  `translate(${v1Transform.xPercent}%, ${v1Transform.yPercent}%) scale(${v1Transform.scale}) rotate(${v1Transform.rotation}deg)`,
                ].filter(Boolean).join(' ') || undefined;

                return (
                  <>
                    {v1IsImage ? (
                      <img
                        src={videoSrc}
                        alt={activeClip.name}
                        draggable={false}
                        style={{
                          transform: v1MattingTransform,
                          opacity: v1EffectiveOpacity,
                          filter: [
                            buildCssFilterString(getActiveClipEffectsAtTime(activeClip, currentTime, project?.metadata?.fps || 30)),
                            overlayFilterString,
                            buildColorGradingCssFilter((activeClip as any)?.colorGrading),
                            v1Beauty,
                          ].filter((f) => f && f !== 'none').join(' ') || 'none',
                          objectFit: 'contain',
                          ...v1MaskStyle,
                          ...v1CropStyle,
                        } as any}
                        className="w-full h-full object-contain select-none transition-[filter] duration-150"
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        src={videoSrc || undefined}
                        style={{
                          transform: v1MattingTransform,
                          opacity: v1EffectiveOpacity,
                          filter: [
                            buildCssFilterString(getActiveClipEffectsAtTime(activeClip, currentTime, project?.metadata?.fps || 30)),
                            overlayFilterString,
                            buildColorGradingCssFilter((activeClip as any)?.colorGrading),
                            v1Beauty,
                          ].filter((f) => f && f !== 'none').join(' ') || 'none',
                          ...v1MaskStyle,
                          ...v1CropStyle,
                        }}
                        className="w-full h-full object-contain select-none transition-[filter] duration-150"
                        onEnded={() => setIsPlaying(false)}
                        onError={handleVideoError}
                        playsInline
                        muted={isMuted || !!mutedTracks['v1'] || activeClip?.isMuted}
                      />
                    )}

                    {/* Real-time AI Background Removal Cutout Canvas Layer */}
                    {isMattingActive && (
                      <canvas
                        ref={mattingCanvasRef}
                        style={{
                          transform: v1MattingTransform,
                          opacity: hiddenTracks['v1'] ? 0 : v1Transform.opacity,
                          ...v1MaskStyle,
                          ...v1CropStyle,
                        }}
                        className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-[filter] duration-150 ${
                          isBehindSubject ? 'z-35' : 'z-5'
                        }`}
                      />
                    )}

                    {/* V2 Overlay Layer — supports both video and image */}
                    {activeV2Clip && v2VideoSrc && !hiddenTracks['v2'] && (
                      v2IsImage ? (
                        <img
                          src={v2VideoSrc}
                          alt={activeV2Clip.name}
                          draggable={false}
                          style={{
                            transform: `translate(${v2Transform.xPercent}%, ${v2Transform.yPercent}%) scale(${v2Transform.scale}) rotate(${v2Transform.rotation}deg)`,
                            opacity: v2Transform.opacity,
                            mixBlendMode: (activeV2Clip.blendMode as any) || 'normal',
                            filter: [
                              buildCssFilterString(getActiveClipEffectsAtTime(activeV2Clip, currentTime, project?.metadata?.fps || 30)),
                              buildColorGradingCssFilter((activeV2Clip as any)?.colorGrading),
                            ].filter((f) => f && f !== 'none').join(' ') || 'none',
                            objectFit: 'contain',
                            ...v2MaskStyle,
                            ...v2CropStyle,
                          } as any}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-5 transition-transform duration-150"
                        />
                      ) : (
                        <video
                          ref={v2VideoRef}
                          src={v2VideoSrc}
                          style={{
                            transform: `translate(${v2Transform.xPercent}%, ${v2Transform.yPercent}%) scale(${v2Transform.scale}) rotate(${v2Transform.rotation}deg)`,
                            opacity: v2Transform.opacity,
                            mixBlendMode: (activeV2Clip.blendMode as any) || 'normal',
                            filter: [
                              buildCssFilterString(getActiveClipEffectsAtTime(activeV2Clip, currentTime, project?.metadata?.fps || 30)),
                              buildColorGradingCssFilter((activeV2Clip as any)?.colorGrading),
                            ].filter((f) => f && f !== 'none').join(' ') || 'none',
                            ...v2MaskStyle,
                            ...v2CropStyle,
                          }}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-5 transition-transform duration-150"
                          playsInline
                          muted={!!mutedTracks['v2'] || activeV2Clip.isMuted}
                        />
                      )
                    )}
                  </>
                );
              })()}

              {/* Real-time Effects & Transitions Canvas Layer */}
              <canvas
                ref={effectsCanvasRef}
                width={canvasDims.width}
                height={canvasDims.height}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {isGeneratingProxy && (
                <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 text-white animate-fade-in">
                  <Sparkles className="w-5 h-5 text-forge-cyan animate-spin" />
                  <p className="text-xs font-semibold">Generating preview proxy...</p>
                </div>
              )}
              {isMissing && activeClip && (
                <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-4 text-center">
                  <div className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold uppercase">Missing Media</div>
                  <div className="text-xs font-bold text-white mt-2 truncate max-w-[80%]">{activeClip.name}</div>
                  <div className="text-[11px] text-gray-400 mt-1 truncate max-w-[80%]">{activeClip.filePath}</div>
                  <div className="text-[11px] text-amber-300 mt-1">{(project as any)?.missingMedia?.length > 1 ? `${(project as any).missingMedia.length} files missing` : ''}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setIsRelinkModalOpen(true)}
                      className="px-3 py-1 rounded-full bg-forge-cyan text-black text-xs font-bold shadow-md hover:bg-cyan-400 transition-colors"
                    >
                      Relink Media
                    </button>
                    {(project as any)?.missingMedia?.length > 1 && (
                      <button
                        onClick={async () => {
                          const api: any = window.captionForgeAPI;
                          if (api?.selectFolderDialog) {
                            const folder = await api.selectFolderDialog({ title: 'Select folder containing moved media' });
                            if (folder) {
                              const count = await batchRelinkFolder(folder);
                              if (count > 0) alert(`Relinked ${count} file(s)`);
                              else alert('No matching files found in selected folder. Try relinking individually.');
                            }
                          } else {
                            alert('Folder relink requires desktop app. Please relink files individually.');
                          }
                        }}
                        className="px-3 py-1 rounded-full bg-[#1e1e24] border border-[#3f3f46] text-xs text-gray-200"
                      >
                        Relink Folder
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-2">File was moved or deleted. Relink to continue editing.</div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-gray-500 space-y-2 bg-canvas-surface/40 select-none">
              <div className="w-12 h-12 rounded-xl bg-canvas-card border border-canvas-border flex items-center justify-center text-forge-purple">
                <Film className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-300">No Video Loaded</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Drag & drop footage here or import from Media Pool</p>
              </div>
            </div>
          )}

          {/* Safe Margins Overlay Guides — P10: per aspect ratio (9:16,16:9,1:1,4:5) */}
          {showSafeMargins && (
            <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
              {/* Action Safe 90% */}
              <div className="w-[90%] h-[90%] border border-dashed border-forge-cyan/35 rounded-sm pointer-events-none" />
              {/* Title Safe 80% */}
              <div className="absolute w-[80%] h-[80%] border border-dashed border-forge-amber/35 rounded-sm pointer-events-none" />
              {/* Aspect-aware inner safe for vertical */}
              {currentRatio === '9:16' && <div className="absolute w-[84%] h-[88%] border border-dotted border-white/15 rounded-sm pointer-events-none" />}
              {currentRatio === '16:9' && <div className="absolute w-[92%] h-[84%] border border-dotted border-white/15 rounded-sm pointer-events-none" />}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-black/70 text-[9px] font-mono text-white px-1.5 py-0.5 rounded border border-white/10">SAFE: 90% action • 80% title {currentRatio}</div>
            </div>
          )}

          {/* Alignment Guides — P9 smart snap lines */}
          {isDraggingCaption && (activeGuides.vertical || activeGuides.horizontal) && (
            <>
              {activeGuides.vertical && <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-forge-cyan shadow-[0_0_8px_#06B6D4] pointer-events-none z-30" />}
              {activeGuides.horizontal && <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-forge-cyan shadow-[0_0_8px_#06B6D4] pointer-events-none z-30" />}
            </>
          )}

          {/* Real-time Animated Captions Canvas */}
          {project && !hiddenTracks['captions'] && (
            <CaptionCanvasOverlay
              captions={project.captions}
              style={project.activeStyle}
              currentTime={currentTime}
              canvasWidth={canvasDims.width}
              canvasHeight={canvasDims.height}
            />
          )}

          {/* Active Motion Graphics & Animated Overlays */}
          {!hiddenTracks['overlay'] && project?.overlays?.map((ov: any) => {
            if (currentTime >= ov.timelineStart && currentTime <= ov.timelineStart + ov.timelineDuration) {
              return <MotionGraphicRenderer key={ov.id} overlay={ov} currentTime={currentTime} />;
            }
            return null;
          })}

          {/* INTERACTIVE DRAGGABLE & RESIZABLE CAPTION LAYER WITH DIRECT IN-PLACE EDITING */}
          {project && project.captions.length > 0 && !hiddenTracks['captions'] && !lockedTracks['captions'] && (
            <div
              onMouseEnter={() => setIsHoveringCaption(true)}
              onMouseLeave={() => !isDraggingCaption && !isResizingHandle && setIsHoveringCaption(false)}
              onMouseDown={handleCaptionMouseDown}
              onDoubleClick={handleStartEditText}
              style={{
                left: `${currentX}%`,
                top: `${currentY}%`,
                transform: `translate(-50%, -50%) rotate(${currentRotation}deg) scale(${currentScale})`,
                width: `${computedBoxWidth}px`,
                height: `${computedBoxHeight}px`,
                transformOrigin: 'center center',
              }}
              className={`absolute z-40 transition-all select-none group ${
                isEditingText
                  ? 'ring-2 ring-forge-purple bg-black/85 shadow-2xl rounded-lg'
                  : isDraggingCaption || isResizingHandle || isRotating
                  ? 'border-2 border-dashed border-forge-cyan bg-cyan-950/25 shadow-2xl ring-2 ring-forge-cyan/60 rounded-lg cursor-grabbing'
                  : isHoveringCaption
                  ? 'border-2 border-dashed border-forge-purple/90 bg-purple-950/20 shadow-lg rounded-lg cursor-grab'
                  : 'border border-dashed border-forge-purple/25 hover:border-forge-purple/70 rounded-lg cursor-grab'
              } p-2 flex items-center justify-center`}
              title="Drag to move • Corners to scale (preserve glyphs) • Sides to adjust width • Top handle to rotate • Double-click to edit text"
            >
              {/* Center Snapping Guide */}
              {isDraggingCaption && activeGuides.vertical && (
                <div className="absolute top-[-1000px] bottom-[-1000px] left-1/2 -translate-x-1/2 w-[1px] bg-forge-cyan shadow-[0_0_6px_#06B6D4] pointer-events-none z-50"></div>
              )}
              {isDraggingCaption && activeGuides.horizontal && (
                <div className="absolute left-[-1000px] right-[-1000px] top-1/2 -translate-y-1/2 h-[1px] bg-forge-cyan shadow-[0_0_6px_#06B6D4] pointer-events-none z-50"></div>
              )}

              {/* In-Place Text Editing Input */}
              {isEditingText ? (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full h-full flex items-center gap-1.5 bg-black/95 p-1.5 rounded-md border border-forge-purple shadow-2xl z-50"
                >
                  <input
                    ref={textInputRef}
                    type="text"
                    value={inlineEditText}
                    onChange={(e) => {
                      setInlineEditText(e.target.value);
                      if (activeCaptionLine) updateCaptionLine(activeCaptionLine.id, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishEditText();
                      if (e.key === 'Escape') setIsEditingText(false);
                    }}
                    onBlur={handleFinishEditText}
                    className="w-full bg-transparent text-xs font-bold text-white focus:outline-none text-center tracking-wider"
                    placeholder="Type caption text..."
                  />
                  <button
                    onClick={handleFinishEditText}
                    className="px-2 py-0.5 rounded bg-forge-purple hover:bg-purple-600 text-white text-[11px] font-bold shadow"
                  >
                    Done
                  </button>
                </div>
              ) : (
                (isHoveringCaption || isDraggingCaption || isResizingHandle) && (
                  <>
                    {/* 4 Corner Resize Handles — P4, P7 uniform scale preserve glyphs */}
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('nw', e)}
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-forge-cyan border-2 border-black shadow hover:scale-125 cursor-nwse-resize z-50"
                      title="Corner resize: preserve proportions (P7)"
                    />
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('ne', e)}
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-forge-cyan border-2 border-black shadow hover:scale-125 cursor-nesw-resize z-50"
                      title="Corner resize: preserve proportions (P7)"
                    />
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('sw', e)}
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-full bg-forge-cyan border-2 border-black shadow hover:scale-125 cursor-nesw-resize z-50"
                      title="Corner resize: preserve proportions (P7)"
                    />
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('se', e)}
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full bg-forge-cyan border-2 border-black shadow hover:scale-125 cursor-nwse-resize z-50"
                      title="Corner resize: preserve proportions (P7)"
                    />
                    {/* Side Handles — P4: left/right = width, top/bottom = height */}
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('n', e)}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-sm bg-white border-2 border-forge-cyan shadow hover:scale-125 cursor-ns-resize z-50"
                      title="Top resize: adjust height/font"
                    />
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('s', e)}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-sm bg-white border-2 border-forge-cyan shadow hover:scale-125 cursor-ns-resize z-50"
                      title="Bottom resize: adjust height/font"
                    />
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('w', e)}
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-sm bg-white border-2 border-forge-cyan shadow hover:scale-125 cursor-ew-resize z-50"
                      title="Left resize: adjust max width (P12)"
                    />
                    <div
                      onMouseDown={(e) => handleResizeHandleMouseDown('e', e)}
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-sm bg-white border-2 border-forge-cyan shadow hover:scale-125 cursor-ew-resize z-50"
                      title="Right resize: adjust max width (P12)"
                    />
                    {/* Rotation Handle — P8 */}
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
                      <div className="w-[1px] h-5 bg-forge-cyan/70" />
                      <div
                        onMouseDown={handleRotationMouseDown}
                        className={`w-5 h-5 rounded-full bg-white border-2 ${isRotating ? 'border-forge-cyan bg-forge-cyan scale-110' : 'border-forge-cyan'} shadow flex items-center justify-center cursor-grab hover:scale-110 transition-transform`}
                        title="Drag to rotate — snaps to 0°,45°,90°,180° (P8)"
                      >
                        <span className="text-[9px]">↻</span>
                      </div>
                    </div>

                    {/* Drag & Scale Coordinate Tooltip Badge — live HUD */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-canvas-card text-forge-cyan text-[10px] font-mono px-2 py-0.2 rounded border border-canvas-border shadow-md whitespace-nowrap flex items-center gap-1.5 pointer-events-none">
                      <Move className="w-2.5 h-2.5" />
                      <span>{currentFontSize}px</span><span className="text-gray-500">•</span><span>{Math.round(currentMaxWidth)}%W</span><span className="text-gray-500">•</span><span>{Math.round(currentRotation)}°</span><span className="text-gray-500">•</span><span className="text-white">Double-click to edit</span>
                    </div>

                    {/* Premium Floating Action Bar — P11 presets + P12 width + P15 styling */}
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-canvas-card/95 backdrop-blur-md text-white text-[11px] px-2 py-1 rounded-xl border border-canvas-border shadow-2xl flex flex-col gap-1 z-50 animate-fade-in min-w-[420px]"
                    >
                      {/* Row 1: Position Presets P11 */}
                      <div className="flex items-center justify-center gap-1">
                        {(['top','upper','center','lower','bottom'] as const).map((p) => {
                          const active = (p === 'top' && currentY < 18) || (p === 'upper' && currentY >= 18 && currentY < 35) || (p === 'center' && currentY >= 35 && currentY < 60) || (p === 'lower' && currentY >= 60 && currentY < 82) || (p === 'bottom' && currentY >= 82);
                          return (
                            <button key={p} onClick={() => handlePositionPreset(p)} className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize border ${active ? 'bg-forge-cyan text-black border-forge-cyan' : 'bg-canvas-surface border-canvas-border text-gray-300 hover:text-white hover:border-white/20'}`} title={`Position: ${p}`}>
                              {p}
                            </button>
                          );
                        })}
                        <span className="text-[9px] text-gray-500 ml-1 font-mono">X:{Math.round(currentX)}% Y:{Math.round(currentY)}%</span>
                      </div>
                      {/* Row 2: Edit + Font + Width + Rotation + Apply */}
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={handleStartEditText}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-canvas-surface hover:bg-canvas-hover text-forge-cyan border border-forge-cyan/40 text-[10px] font-bold"
                          title="Double-click to edit text (P14)"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Edit</span>
                        </button>
                        <div className="w-[1px] h-3 bg-canvas-border" />
                        {/* Font */}
                        <div className="flex items-center gap-0.5 bg-canvas-surface px-1 py-0.2 rounded border border-canvas-border font-mono text-[10px]">
                          <button onClick={() => { const v = Math.max(16, currentFontSize - 2); if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride||{}), fontSize: v } as any); else updateActiveStyle({ fontSize: v }); }} className="px-1 py-0.2 rounded hover:bg-canvas-hover text-gray-300 font-bold" title="Decrease font">-</button>
                          <span className="text-forge-cyan font-bold px-1">{currentFontSize}px</span>
                          <button onClick={() => { const v = Math.min(120, currentFontSize + 2); if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride||{}), fontSize: v } as any); else updateActiveStyle({ fontSize: v }); }} className="px-1 py-0.2 rounded hover:bg-canvas-hover text-gray-300 font-bold" title="Increase font">+</button>
                        </div>
                        {/* Width P12 */}
                        <div className="flex items-center gap-0.5 bg-canvas-surface px-1 py-0.2 rounded border border-canvas-border font-mono text-[10px]" title="Max width (P12)">
                          <span className="text-gray-500">W</span>
                          <button onClick={() => { const v = Math.max(30, currentMaxWidth - 5); if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride||{}), maxWidthPercent: v } as any); else updateActiveStyle({ maxWidthPercent: v } as any); }} className="px-1 hover:bg-canvas-hover rounded">-</button>
                          <span className="text-white font-bold">{Math.round(currentMaxWidth)}%</span>
                          <button onClick={() => { const v = Math.min(95, currentMaxWidth + 5); if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride||{}), maxWidthPercent: v } as any); else updateActiveStyle({ maxWidthPercent: v } as any); }} className="px-1 hover:bg-canvas-hover rounded">+</button>
                        </div>
                        {/* Rotation P8 */}
                        <div className="flex items-center gap-0.5 bg-canvas-surface px-1 py-0.2 rounded border border-canvas-border font-mono text-[10px]" title="Rotation (P8)">
                          <span>↻</span>
                          <span className="text-white font-bold">{Math.round(currentRotation)}°</span>
                          <button onClick={() => { if (activeCaptionLine) setCaptionLineStyleOverride(activeCaptionLine.id, { ...(activeCaptionLine.styleOverride||{}), rotation: 0 } as any); else updateActiveStyle({ rotation: 0 } as any); }} className="px-1 hover:bg-canvas-hover rounded text-gray-400" title="Reset rotation">⟲</button>
                        </div>
                        <div className="w-[1px] h-3 bg-canvas-border" />
                        <button onClick={handleApplyToAllCaptions} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-forge-purple hover:bg-purple-600 text-white font-semibold text-[10px] transition-all shadow-xs" title="Apply to all captions (P18)">
                          {appliedAllToast ? (<><Check className="w-2.5 h-2.5 text-white" /><span>Applied!</span></>) : (<><Layers className="w-2.5 h-2.5" /><span>Apply All</span></>)}
                        </button>
                      </div>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          {/* Overlays */}
          {project?.overlays.map((ov: any) => {
            const isVisible = currentTime >= ov.timelineStart && currentTime <= ov.timelineStart + ov.timelineDuration;
            if (!isVisible) return null;

            return (
              <div
                key={ov.id}
                style={{
                  left: `${ov.x}%`,
                  top: `${ov.y}%`,
                  transform: `scale(${ov.scale}) translate(-50%, -50%)`,
                  opacity: ov.opacity,
                }}
                className="absolute z-30 pointer-events-none transition-all duration-100"
              >
                {ov.type === 'image' && ov.filePath && (
                  <img
                    src={getVideoSrc({ filePath: ov.filePath, mediaBlobUrl: ov.mediaBlobUrl } as any) || ov.filePath}
                    alt={ov.name}
                    className="max-w-[140px] object-contain drop-shadow-lg"
                  />
                )}
                {ov.type === 'text' && (
                  <div
                    style={{
                      fontFamily: ov.fontFamily || 'Inter',
                      fontSize: `${ov.fontSize || 32}px`,
                      color: ov.textColor || '#FFFFFF',
                      backgroundColor: ov.backgroundColor || 'transparent',
                    }}
                    className="font-bold px-3 py-1 rounded drop-shadow-md"
                  >
                    {ov.text}
                  </div>
                )}
              </div>
            );
          })}

          {/* Interactive Visual Crop Tool Overlay */}
          {isCropping && (activeClip || activeV2Clip) && (
            <CropOverlay
              isOpen={isCropping}
              crop={(activeClip || activeV2Clip)?.crop || { top: 0, bottom: 0, left: 0, right: 0 }}
              onChangeCrop={(newCrop) => {
                const targetId = activeClip ? activeClip.id : activeV2Clip?.id;
                if (targetId) updateClip(targetId, { crop: newCrop });
              }}
              onClose={() => setIsCropping(false)}
              containerWidth={viewportRef.current?.clientWidth || 0}
              containerHeight={viewportRef.current?.clientHeight || 0}
            />
          )}
        </div>
      </div>

      {/* Hidden Synchronized Audio Track Elements */}
      <div className="hidden" aria-hidden="true">
        {project?.audioClips?.map((ac: any) => {
          const src = getVideoSrc({ filePath: ac.filePath, mediaBlobUrl: ac.mediaBlobUrl } as any) || ac.filePath;
          return (
            <audio
              key={ac.id}
              ref={(el) => {
                if (el) audioElementsRef.current.set(ac.id, el);
                else audioElementsRef.current.delete(ac.id);
              }}
              src={src}
              preload="auto"
            />
          );
        })}
      </div>

      {/* Built-in Bottom Player Transport Controls */}
      <PlayerControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        totalDuration={project?.metadata.duration || 15}
        volume={volume}
        isMuted={isMuted}
        onTogglePlay={togglePlayPause}
        onSeek={setCurrentTime}
        onVolumeChange={(v) => {
          setVolume(v);
          if (videoRef.current) videoRef.current.volume = v;
        }}
        onToggleMute={() => {
          setIsMuted(!isMuted);
          if (videoRef.current) videoRef.current.muted = !isMuted;
        }}
        onSplit={splitClipAtPlayhead}
        onAutoTranscribe={() => setShowAutoCaptionModal(true)}
        isTranscribing={isTranscribing}
      />

      {/* Multilingual AI Auto-Caption Modal */}
      <AutoCaptionModal
        isOpen={showAutoCaptionModal}
        onClose={() => setShowAutoCaptionModal(false)}
      />

      {/* Persistent Media Relinking Modal */}
      <RelinkModal
        isOpen={isRelinkModalOpen}
        onClose={() => setIsRelinkModalOpen(false)}
      />
    </div>
  );
};
