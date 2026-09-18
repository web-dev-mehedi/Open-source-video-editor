import React, { useRef, useEffect, useState, useMemo } from 'react';
import { getDragPayload, clearDragPayload } from '../../utils/nleDnD';
import { useProject } from '../../context/ProjectContext';
import { TimelineRuler } from './TimelineRuler';
import { VideoTrack } from './VideoTrack';
import { AudioTrack } from './AudioTrack';
import { CaptionTrack } from './CaptionTrack';
import { OverlayTrack } from './OverlayTrack';
import { MarkerTrack } from '../markers/MarkerTrack';
import { BatchEditBar } from './BatchEditBar';
import { TimelineToolbar } from './TimelineToolbar';
import { HistoryPanel } from '../history/HistoryPanel';
import { MacroPanel } from '../macros/MacroPanel';
import { Modal } from '../common/Modal';
import {
  Scissors,
  Plus,
  Trash2,
  Film,
  MessageSquareText,
  Layers,
  Clock,
  Magnet,
  MousePointer,
  Maximize2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Undo2,
  Redo2,
  Sparkles,
  Eraser,
  History,
  Zap,
  Video,
  UploadCloud,
} from 'lucide-react';
import { formatTimecode, sanitizeTime } from '../../utils/timecode';
import { calculateFitZoom, ZOOM_CONFIG } from '../../hooks/useTimelineZoom';
import { getActiveContentDuration } from '../../utils/timelineDuration';
import { calculatePixelsPerSecond, calculateVisibleTimeWindow } from '../../utils/timelineMath';
import { MulticamStudio } from '../multicam/MulticamStudio';
import { SceneDetectionModal } from '../editor/SceneDetectionModal';

export interface TimelineProps {
  height?: number;
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ height = 230, className = '' }) => {
  const {
    project,
    currentTime,
    setCurrentTime,
    zoomLevel,
    setZoomLevel,
    isMagnetMode,
    toggleMagnetMode,
    selectedClipId,
    setSelectedClipId,
    selectedAudioClipId,
    setSelectedAudioClipId,
    selectedCaptionId,
    setSelectedCaptionId,
    selectedOverlayId,
    setSelectedOverlayId,
    selectedTransitionId,
    setSelectedTransitionId,
    updateClip,
    updateCaptionLine,
    updateTransition,
    splitClipAtPlayhead,
    splitAudioClipAtPlayhead,
    deleteClip,
    rippleDeleteClip,
    closeGapAtTime,
    moveClipPosition,
    reorderClips,
    deleteAudioClip,
    moveAudioClipPosition,
    deleteCaptionLine,
    trimCaptionLine,
    moveCaptionLine,
    duplicateCaptionLine,
    splitCaptionAtPlayhead,
    deleteOverlay,
    deleteTransition,
    trimAudioClip,
    duplicateAudioClip,
    removeSilencesFromAudioClip,
    enhanceAudioClipTrack,
    deleteMultipleTimelineItems,
    toggleAudioMute,
    setAudioVolume,
    addVideoTrack,
    addCaptionLineAtPlayhead,
    removeAllGaps,
    addMarker,
    markers,
    appendClipToTimeline,
    importFootageFile,
    importAudioFile,
    appendAudioClipToTimeline,
    hiddenTracks,
    mutedTracks,
    lockedTracks,
    toggleTrackVisibility,
    toggleTrackMute,
    toggleTrackLock,
    undo,
    redo,
    canUndo,
    canRedo,
    freezeFrameAtPlayhead,
    reverseClip,
    rollTrim,
    slipTrim,
    slideTrim,
    matchClipDuration,
    batchApplyTransition,
    createCompoundClip,
    addOverlay,
    duplicateOverlay,
    trimClip,
    trimClipLeftToPlayhead,
    trimClipRightToPlayhead,
    isCropping,
    toggleCropMode,
    setActiveSidebarTab,
    updateClipTransform,
    duplicateClip,
    copyClip,
    cutClip,
    pasteClip,
    addEffectToClip,
    addTransition,
  } = useProject();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'razor' | 'crop'>('select');

  // Multi-Selection State (Marquee Box Drag)
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectedAudioClipIds, setSelectedAudioClipIds] = useState<string[]>([]);
  const [selectedCaptionIds, setSelectedCaptionIds] = useState<string[]>([]);
  // Multi-select clipboard: preserves relative timing, pastes anchored at playhead.
  const multiClipboardRef = useRef<{ clips: any[]; audioClips: any[]; overlays: any[]; anchor: number } | null>(null);
  const [isMulticamOpen, setIsMulticamOpen] = useState<boolean>(false);
  const [isSceneDetectionOpen, setIsSceneDetectionOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isMacroOpen, setIsMacroOpen] = useState<boolean>(false);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const calculatedMaxDuration = useMemo(() => {
    const active = getActiveContentDuration(project);
    return Math.max(5, active || project?.metadata.duration || 15);
  }, [project?.clips, project?.audioClips, project?.captions, project?.metadata.duration]);

  const totalDuration = calculatedMaxDuration;
  // Base pixels per second scaled by zoom level (0.2px/s to 300px/s)
  const pixelsPerSecond = calculatePixelsPerSecond(zoomLevel);
  const tracksWidth = Math.max(1200, totalDuration * pixelsPerSecond + 300);

  // Viewport-based timeline virtualization for high performance with 1000+ clips
  const [viewportBounds, setViewportBounds] = useState<{ startSec: number; endSec: number }>({
    startSec: 0,
    endSec: 300,
  });

  const handleTimelineScroll = () => {
    const el = scrollContainerRef.current;
    if (!el || pixelsPerSecond <= 0) return;
    const windowBounds = calculateVisibleTimeWindow(el.scrollLeft, el.clientWidth, pixelsPerSecond, 15);
    setViewportBounds(windowBounds);
  };

  useEffect(() => {
    handleTimelineScroll();
  }, [pixelsPerSecond, zoomLevel]);

  // Smart multi-select event bridge (Feature 10)
  useEffect(() => {
    const h = (e: any) => {
      const ids: string[] = e.detail?.clipIds || [];
      setSelectedClipIds(ids);
    };
    window.addEventListener('cf_smart_select' as any, h);
    return () => window.removeEventListener('cf_smart_select' as any, h);
  }, []);

  // Global Keyboard Shortcuts — NLE standard set. All mutations funnel through
  // ProjectContext ops (single source of truth) so undo/redo + persistence hold.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;
      const mod = e.ctrlKey || e.metaKey;

      // Undo / Redo — every timeline mutation is undoable via history snapshots.
      if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
        return;
      }
      if ((mod && (e.key === 'y' || e.key === 'Y')) || (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault();
        redo();
        return;
      }
      // Copy / Cut / Paste / Duplicate (multi-select aware, relative timing preserved)
      if (mod && (e.key === 'c' || e.key === 'C')) {
        const hasMulti = selectedClipIds.length > 0 || selectedAudioClipIds.length > 0;
        if (hasMulti && project) {
          e.preventDefault();
          const clips = (project.clips || []).filter((c: any) => selectedClipIds.includes(c.id));
          const audioClips = (project.audioClips || []).filter((a: any) => selectedAudioClipIds.includes(a.id));
          const anchor = Math.min(
            ...[...clips.map((c: any) => c.timelineStart), ...audioClips.map((a: any) => a.timelineStart), currentTime]
          );
          multiClipboardRef.current = {
            clips: JSON.parse(JSON.stringify(clips)),
            audioClips: JSON.parse(JSON.stringify(audioClips)),
            overlays: [],
            anchor,
          };
          if (selectedClipId) copyClip(selectedClipId);
          return;
        }
        if (selectedClipId) {
          e.preventDefault();
          copyClip(selectedClipId);
          return;
        }
      }
      if (mod && (e.key === 'x' || e.key === 'X')) {
        const hasMulti = selectedClipIds.length > 0 || selectedAudioClipIds.length > 0;
        if (hasMulti && project) {
          e.preventDefault();
          const clips = (project.clips || []).filter((c: any) => selectedClipIds.includes(c.id));
          const audioClips = (project.audioClips || []).filter((a: any) => selectedAudioClipIds.includes(a.id));
          const anchor = Math.min(
            ...[...clips.map((c: any) => c.timelineStart), ...audioClips.map((a: any) => a.timelineStart), currentTime]
          );
          multiClipboardRef.current = {
            clips: JSON.parse(JSON.stringify(clips)),
            audioClips: JSON.parse(JSON.stringify(audioClips)),
            overlays: [],
            anchor,
          };
          deleteMultipleTimelineItems({ clipIds: selectedClipIds, audioClipIds: selectedAudioClipIds });
          setSelectedClipIds([]);
          setSelectedAudioClipIds([]);
          return;
        }
        if (selectedClipId) {
          e.preventDefault();
          cutClip(selectedClipId);
          setSelectedClipId(null);
          return;
        }
      }
      if (mod && (e.key === 'v' || e.key === 'V')) {
        const multi = multiClipboardRef.current;
        if (multi && (multi.clips.length > 0 || multi.audioClips.length > 0)) {
          e.preventDefault();
          const delta = currentTime - multi.anchor;
          for (const c of multi.clips) {
            appendClipToTimeline({ ...c }, c.trackIndex || 1, Math.max(0, c.timelineStart + delta), false);
          }
          for (const a of multi.audioClips) {
            appendAudioClipToTimeline({ ...a }, a.trackIndex || 1, Math.max(0, a.timelineStart + delta));
          }
          return;
        }
        e.preventDefault();
        pasteClip();
        return;
      }
      if (mod && (e.key === 'd' || e.key === 'D')) {
        // Duplicate: multi-select first, else single selections.
        if (selectedClipIds.length > 1) {
          e.preventDefault();
          for (const id of selectedClipIds) duplicateClip(id);
          return;
        }
        if (selectedClipId) {
          e.preventDefault();
          duplicateClip(selectedClipId);
          return;
        }
        if (selectedAudioClipId) {
          e.preventDefault();
          duplicateAudioClip(selectedAudioClipId);
          return;
        }
        if (selectedOverlayId) {
          e.preventDefault();
          duplicateOverlay(selectedOverlayId);
          return;
        }
        if (selectedCaptionId) {
          e.preventDefault();
          duplicateCaptionLine(selectedCaptionId);
          return;
        }
      }
      // Split at playhead (S or Ctrl+K, Premiere/CapCut convention)
      if ((e.key === 's' || e.key === 'S') && !mod) {
        e.preventDefault();
        if (selectedAudioClipId) splitAudioClipAtPlayhead();
        else splitClipAtPlayhead();
        return;
      }
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (selectedAudioClipId) splitAudioClipAtPlayhead();
        else splitClipAtPlayhead();
        return;
      }
      // Select all clips on V1 (Ctrl+A)
      if (mod && (e.key === 'a' || e.key === 'A')) {
        if (project?.clips && project.clips.length > 0) {
          e.preventDefault();
          setSelectedClipIds(project.clips.map((c: any) => c.id));
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasMulti = selectedClipIds.length > 0 || selectedAudioClipIds.length > 0 || selectedCaptionIds.length > 0;
        if (hasMulti) {
          e.preventDefault();
          deleteMultipleTimelineItems({
            clipIds: selectedClipIds,
            audioClipIds: selectedAudioClipIds,
            captionIds: selectedCaptionIds,
          });
          setSelectedClipIds([]);
          setSelectedAudioClipIds([]);
          setSelectedCaptionIds([]);
        } else if (selectedCaptionId) {
          e.preventDefault();
          deleteCaptionLine(selectedCaptionId);
        } else if (selectedAudioClipId) {
          e.preventDefault();
          deleteAudioClip(selectedAudioClipId);
        } else if (selectedOverlayId) {
          e.preventDefault();
          deleteOverlay(selectedOverlayId);
          setSelectedOverlayId(null);
        } else if (selectedTransitionId) {
          e.preventDefault();
          deleteTransition(selectedTransitionId);
          setSelectedTransitionId(null);
        } else if (selectedClipId) {
          e.preventDefault();
          deleteClip(selectedClipId);
          setSelectedClipId(null);
        }
      } else if (
        ((e.key === 'z' || e.key === 'Z') && e.shiftKey && !e.ctrlKey && !e.metaKey) ||
        (e.key === '0' && (e.ctrlKey || e.metaKey))
      ) {
        e.preventDefault();
        handleFitTimeline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedClipIds,
    selectedAudioClipIds,
    selectedCaptionIds,
    selectedAudioClipId,
    selectedClipId,
    selectedCaptionId,
    selectedOverlayId,
    selectedTransitionId,
    currentTime,
    project,
    deleteMultipleTimelineItems,
    deleteAudioClip,
    deleteClip,
    deleteCaptionLine,
    deleteOverlay,
    deleteTransition,
    undo,
    redo,
    copyClip,
    cutClip,
    pasteClip,
    duplicateClip,
    duplicateAudioClip,
    duplicateOverlay,
    duplicateCaptionLine,
    splitClipAtPlayhead,
    splitAudioClipAtPlayhead,
    appendClipToTimeline,
    appendAudioClipToTimeline,
  ]);

  // Marquee Box Selection on Timeline Canvas with Track-Aware Y Bounds & Instant Click-to-Seek
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX - rect.left + container.scrollLeft;
    const startY = e.clientY - rect.top;
    let didDrag = false;

    setMarquee({ startX, startY, currentX: startX, currentY: startY });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const curX = moveEvent.clientX - rect.left + container.scrollLeft;
      const curY = moveEvent.clientY - rect.top;
      setMarquee((prev) => (prev ? { ...prev, currentX: curX, currentY: curY } : null));

      // Calculate time range & vertical Y bounds
      const minX = Math.min(startX, curX);
      const maxX = Math.max(startX, curX);
      const minY = Math.min(startY, curY);
      const maxY = Math.max(startY, curY);
      const ppsMarquee = sanitizeTime(pixelsPerSecond, 40);
      if (!isFinite(ppsMarquee) || ppsMarquee <= 0.5) return;
      const startTime = minX / ppsMarquee;
      const endTime = maxX / ppsMarquee;
      if (!isFinite(startTime) || !isFinite(endTime)) return;

      if (maxX - minX > 5 || maxY - minY > 5) {
        didDrag = true;
        // Compute dynamic track Y-ranges (ruler is 28px)
        let currentTrackY = 28;

        let captionsYRange = { top: 0, bottom: 0, active: false };
        if (showCaptionsTrack) {
          captionsYRange = { top: currentTrackY, bottom: currentTrackY + 48, active: true };
          currentTrackY += 48;
        }

        let v2YRange = { top: 0, bottom: 0, active: false };
        if (showV2Track) {
          v2YRange = { top: currentTrackY, bottom: currentTrackY + 80, active: true };
          currentTrackY += 80;
        }

        let v1YRange = { top: 0, bottom: 0, active: false };
        if (showV1Track) {
          v1YRange = { top: currentTrackY, bottom: currentTrackY + 80, active: true };
          currentTrackY += 80;
        }

        let a1YRange = { top: 0, bottom: 0, active: false };
        if (showA1Track) {
          a1YRange = { top: currentTrackY, bottom: currentTrackY + 48, active: true };
          currentTrackY += 48;
        }

        let a2YRange = { top: 0, bottom: 0, active: false };
        if (showA2Track) {
          a2YRange = { top: currentTrackY, bottom: currentTrackY + 48, active: true };
          currentTrackY += 48;
        }

        const hitsY = (range: { top: number; bottom: number; active: boolean }) => {
          if (!range.active) return false;
          return minY < range.bottom && maxY > range.top;
        };

        const matchingClips = (project?.clips || [])
          .filter((c) => {
            const isV2 = (c.trackIndex || 1) === 2;
            const targetRange = isV2 ? v2YRange : v1YRange;
            if (!hitsY(targetRange)) return false;
            const cStart = c.timelineStart;
            const cEnd = c.timelineStart + c.timelineDuration;
            return cStart < endTime && cEnd > startTime;
          })
          .map((c) => c.id);

        const matchingAudio = (project?.audioClips || [])
          .filter((a) => {
            const isA2 = (a.trackIndex || 1) === 2;
            const targetRange = isA2 ? a2YRange : a1YRange;
            if (!hitsY(targetRange)) return false;
            const aStart = a.timelineStart;
            const aEnd = a.timelineStart + a.timelineDuration;
            return aStart < endTime && aEnd > startTime;
          })
          .map((a) => a.id);

        const matchingCaptions = (project?.captions || [])
          .filter((cap) => {
            if (!hitsY(captionsYRange)) return false;
            return cap.start < endTime && cap.end > startTime;
          })
          .map((cap) => cap.id);

        setSelectedClipIds(matchingClips);
        setSelectedAudioClipIds(matchingAudio);
        setSelectedCaptionIds(matchingCaptions);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setMarquee(null);

      // If clicked on blank track area without dragging, smoothly scrub playhead to clicked spot
      if (!didDrag) {
        const pps = sanitizeTime(pixelsPerSecond, 40);
        if (!isFinite(pps) || pps <= 0.5) return;
        const rawClick = startX / pps;
        if (!isFinite(rawClick)) return;
        const saneDur = sanitizeTime(totalDuration, 15);
        const clickedTime = Math.max(0, Math.min(saneDur, rawClick));
        if (!isFinite(clickedTime)) return;
        setCurrentTime(Math.round(clickedTime * 100) / 100);
        setSelectedClipIds([]);
        setSelectedAudioClipIds([]);
        setSelectedCaptionIds([]);
        setSelectedClipId(null);
        setSelectedAudioClipId(null);
        setSelectedCaptionId(null);
        setSelectedOverlayId(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Auto-scroll timeline to follow playhead if playing
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const playheadPos = currentTime * pixelsPerSecond;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth - 140;

    if (playheadPos > scrollLeft + containerWidth - 50) {
      container.scrollLeft = playheadPos - 100;
    } else if (playheadPos < scrollLeft) {
      container.scrollLeft = Math.max(0, playheadPos - 50);
    }
  }, [currentTime, pixelsPerSecond]);

  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  // Ctrl / Alt + Mouse Wheel to Zoom In / Zoom Out centered on mouse cursor
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        const currentZoom = zoomLevelRef.current;
        const minZ = ZOOM_CONFIG.MIN_ZOOM / 40;
        const maxZ = ZOOM_CONFIG.MAX_ZOOM / 40;
        const nextZoom = Math.max(minZ, Math.min(maxZ, Math.round(currentZoom * factor * 1000) / 1000));

        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left + container.scrollLeft;
        const ppsCurrent = Math.max(0.2, 40 * currentZoom);
        const timeAtCursor = cursorX / ppsCurrent;

        setZoomLevel(nextZoom);

        requestAnimationFrame(() => {
          const ppsNext = Math.max(0.2, 40 * nextZoom);
          const newCursorX = timeAtCursor * ppsNext;
          container.scrollLeft = Math.max(0, newCursorX - (e.clientX - rect.left));
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [setZoomLevel]);

  const primaryClip = project?.clips?.[0];

  // Handle trim caption from timeline — delegates to ProjectContext trimCaptionLine (word timestamps redistributed proportionally)
  const handleTrimCaption = (id: string, start: number, end: number) => {
    const cap = project?.captions.find((c) => c.id === id);
    if (!cap) return;
    const clampedStart = Math.max(0, Math.round(start * 100) / 100);
    const clampedEnd = Math.max(clampedStart + 0.2, Math.round(end * 100) / 100);
    // Prevent creating captions that invert or become negative — guard against corrupt state
    if (clampedEnd - clampedStart < 0.15) return;
    trimCaptionLine(id, clampedStart, clampedEnd);
  };

  const handleFitTimeline = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const fitPixelsPerSec = calculateFitZoom(container.clientWidth, project, 120, 60);
    const idealZoom = Math.max(ZOOM_CONFIG.MIN_ZOOM / 40, Math.min(ZOOM_CONFIG.MAX_ZOOM / 40, fitPixelsPerSec / 40));
    setZoomLevel(Math.round(idealZoom * 1000) / 1000);
    container.scrollLeft = 0;
  };

  const handleDropFootage = (clip: any, dropTime: number, trackIndex: number, insertMode: boolean = true) => {
    appendClipToTimeline(clip, trackIndex, dropTime, insertMode);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importFootageFile(file);
    }
  };

  const v1Clips = (project?.clips || []).filter((c) => (c.trackIndex || 1) === 1);
  const v2Clips = (project?.clips || []).filter((c) => (c.trackIndex || 1) === 2);
  const a1Clips = (project?.audioClips || []).filter((a) => (a.trackIndex || 1) === 1);
  const a2Clips = (project?.audioClips || []).filter((a) => (a.trackIndex || 1) === 2);
  const captions = project?.captions || [];
  const overlays = project?.overlays || [];

  const isTimelineEmpty =
    (!project?.clips || project.clips.length === 0) &&
    captions.length === 0 &&
    (project?.audioClips?.length || 0) === 0 &&
    overlays.length === 0;

  const handleAddCaptionClick = () => {
    if (isTimelineEmpty) {
      alert('Please import a video footage clip first before adding captions.');
      return;
    }
    addCaptionLineAtPlayhead();
  };

  const handleDeleteSelected = () => {
    const hasMulti =
      selectedClipIds.length > 0 ||
      selectedAudioClipIds.length > 0 ||
      selectedCaptionIds.length > 0;
    if (hasMulti) {
      deleteMultipleTimelineItems({
        clipIds: selectedClipIds,
        audioClipIds: selectedAudioClipIds,
        captionIds: selectedCaptionIds,
      });
      setSelectedClipIds([]);
      setSelectedAudioClipIds([]);
      setSelectedCaptionIds([]);
    } else if (selectedCaptionId) {
      deleteCaptionLine(selectedCaptionId);
      setSelectedCaptionId(null);
    } else if (selectedAudioClipId) {
      deleteAudioClip(selectedAudioClipId);
      setSelectedAudioClipId(null);
    } else if (selectedOverlayId) {
      deleteOverlay(selectedOverlayId);
      setSelectedOverlayId(null);
    } else if (selectedTransitionId) {
      deleteTransition(selectedTransitionId);
      setSelectedTransitionId(null);
    } else if (selectedClipId) {
      deleteClip(selectedClipId);
      setSelectedClipId(null);
    }
  };

  // Dynamic track routing:
  const showCaptionsTrack = captions.length > 0;
  const showV2Track = v2Clips.length > 0;
  const showV1Track = !isTimelineEmpty || v1Clips.length > 0;
  const showA1Track = a1Clips.length > 0;
  const showA2Track = a2Clips.length > 0;
  const showOverlayTrack = overlays.length > 0;

  const activeTrackCount =
    (showCaptionsTrack ? 1 : 0) +
    (showV2Track ? 1 : 0) +
    (showV1Track ? 1 : 0) +
    (showA1Track ? 1 : 0) +
    (showA2Track ? 1 : 0) +
    (showOverlayTrack ? 1 : 0);

  const handleDropOnEmptyState = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).removeAttribute('data-drag');
    // Files dropped directly onto empty timeline
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const isAudio =
          file.type.startsWith('audio/') ||
          file.name.match(/\.(mp3|wav|aac|m4a|ogg|flac)$/i);
        if (isAudio) {
          importAudioFile(file);
        } else {
          importFootageFile(file);
        }
      }
      return;
    }
    let data: any = null;
    try {
      data = getDragPayload(e as any);
    } catch {}
    if (data && data.type === 'footage' && data.clip) {
      handleDropFootage(data.clip, 0, 1);
      try {
        clearDragPayload();
      } catch {}
    } else if (data && data.type === 'audio' && data.clip) {
      if (appendAudioClipToTimeline) appendAudioClipToTimeline(data.clip, 1, 0);
      try {
        clearDragPayload();
      } catch {}
    }
  };

  const handleDropOnPopulatedTimeline = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).removeAttribute('data-drag');
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    const dropTime = Math.max(0, dropX / pixelsPerSecond);

    // NLE standard: Shift key toggles OVERWRITE mode. Default is INSERT.
    const insertMode = !e.shiftKey;

    // Files dropped directly onto populated timeline
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const isAudio =
          file.type.startsWith('audio/') ||
          file.name.match(/\.(mp3|wav|aac|m4a|ogg|flac)$/i);
        if (isAudio) {
          importAudioFile(file);
        } else {
          importFootageFile(file);
        }
      }
      return;
    }

    let data: any = null;
    try {
      data = getDragPayload(e as any);
    } catch {}
    if (!data) {
      try {
        const w: any = window as any;
        if (w.__cf_draggedMedia) data = w.__cf_draggedMedia;
      } catch {}
    }

    if (data && data.type === 'footage' && data.clip) {
      // If dropped above V1 or on top area, route to Track 2 (Overlay), else Track 1 (Main)
      const targetTrack = (showV2Track && dropY < 120) || dropY < 50 ? 2 : 1;
      handleDropFootage(data.clip, isFinite(dropTime) ? dropTime : 0, targetTrack, insertMode);
      try {
        clearDragPayload();
      } catch {}
    } else if (data && data.type === 'audio' && data.clip) {
      let targetAudioTrack = 1;
      if (showA1Track && a1Clips.length > 0) {
        const hasOverlap = a1Clips.some(
          (a) =>
            a.timelineStart < dropTime + (data.clip.timelineDuration || 5) &&
            a.timelineStart + a.timelineDuration > dropTime
        );
        if (hasOverlap || showA2Track) targetAudioTrack = 2;
      }
      if (appendAudioClipToTimeline)
        appendAudioClipToTimeline(
          data.clip,
          targetAudioTrack,
          isFinite(dropTime) ? dropTime : 0
        );
      try {
        clearDragPayload();
      } catch {}
    } else if (data && (data.type === 'effect' || data.type === 'transition')) {
      // Find the clip under the cursor
      const targetTrack = (showV2Track && dropY < 120) || dropY < 50 ? 2 : 1;
      const targetClip = project?.clips.find(
        (c) => (c.trackIndex || 1) === targetTrack && dropTime >= c.timelineStart && dropTime <= c.timelineStart + c.timelineDuration
      );

      if (targetClip) {
        if (data.type === 'effect') {
          addEffectToClip(targetClip.id, data.id || data.effectId || data.type, { dropTime, duration: 2 });
        } else if (data.type === 'transition') {
          const nextClip = project?.clips.find(
            (c) => (c.trackIndex || 1) === targetTrack && c.timelineStart >= targetClip.timelineStart + targetClip.timelineDuration - 0.05
          );
          if (nextClip) {
            addTransition({
              type: data.id || data.transitionId || data.type || 'crossfade',
              name: data.name || 'Transition',
              fromClipId: targetClip.id,
              toClipId: nextClip.id,
              timelineStart: targetClip.timelineStart + targetClip.timelineDuration,
              duration: 1,
              alignment: 'center',
              params: {},
            });
          }
        }
      }
      try {
        clearDragPayload();
      } catch {}
    }
  };

  return (
    <div
      style={{ height: `${height}px` }}
      className={`bg-canvas-dark border-t border-canvas-border flex flex-col select-none relative z-10 w-full flex-shrink-0 ${className}`}
    >
      {/* Invisible file input for drag & click import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* CapCut-Style Single-Line Action Toolbar */}
      <TimelineToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onSplit={() => {
          if (selectedAudioClipId) {
            splitAudioClipAtPlayhead();
          } else {
            splitClipAtPlayhead();
          }
        }}
        onTrimLeft={() => trimClipLeftToPlayhead()}
        onTrimRight={() => trimClipRightToPlayhead()}
        onCrop={() => {
          toggleCropMode();
          setActiveTool('crop');
        }}
        onSpeed={() => setActiveSidebarTab('video')}
        onDelete={handleDeleteSelected}
        hasSelection={
          !!(
            selectedCaptionId ||
            selectedAudioClipId ||
            selectedOverlayId ||
            selectedTransitionId ||
            selectedClipId ||
            selectedCaptionIds.length > 0 ||
            selectedClipIds.length > 0 ||
            selectedAudioClipIds.length > 0
          )
        }
        selectionCount={
          selectedCaptionIds.length +
          selectedClipIds.length +
          selectedAudioClipIds.length
        }
        onAddCaption={handleAddCaptionClick}
        onFreezeFrame={() => freezeFrameAtPlayhead(1.2)}
        onReverseClip={() => {
          if (selectedClipId) reverseClip(selectedClipId);
        }}
        currentTime={currentTime}
        totalDuration={totalDuration}
        onSeek={setCurrentTime}
        isMagnetMode={isMagnetMode}
        onToggleMagnet={toggleMagnetMode}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        onFitTimeline={handleFitTimeline}
        onOpenMulticam={() => setIsMulticamOpen(true)}
        onOpenSceneDetection={() => setIsSceneDetectionOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenMacros={() => setIsMacroOpen((v) => !v)}
        onRollTrim={() => {
          if (selectedClipId) rollTrim(selectedClipId, 0.2);
        }}
        onSlipTrim={() => {
          if (selectedClipId) slipTrim(selectedClipId, 0.2);
        }}
        onSlideTrim={() => {
          if (selectedClipId) slideTrim(selectedClipId, 0.2);
        }}
        onMatchDuration={() => {
          const ids = (project?.clips || []).map((c) => c.id);
          if (ids.length >= 2) matchClipDuration(ids[0], ids[1]);
        }}
        onBatchFade={() => batchApplyTransition('crossfade', 0.5)}
        onAddAdjustmentLayer={() =>
          addOverlay({
            type: 'text' as any,
            name: 'Adjustment Layer',
            timelineStart: currentTime,
            timelineDuration: 3,
            x: 50,
            y: 50,
            scale: 1,
            opacity: 1,
          } as any)
        }
        onCompoundClip={() => {
          const allIds = (project?.clips || []).slice(0, 2).map((c) => c.id);
          if (allIds.length >= 2) createCompoundClip(allIds);
        }}
        onRemoveAllGaps={() => removeAllGaps()}
        onAddMarker={() =>
          addMarker({
            time: currentTime,
            name: `Marker ${Math.round(currentTime * 10) / 10}s`,
            color: 'amber',
            type: 'note',
          })
        }
        canSceneDetect={!!project?.clips && project.clips.length > 0}
        canClipAction={!!selectedClipId}
        isCropping={isCropping}
        onImportMedia={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/*,audio/*,image/*';
          input.multiple = true;
          input.onchange = async () => {
            if (input.files) {
              for (const file of Array.from(input.files)) {
                if (file.type.startsWith('audio/')) await importAudioFile(file);
                else await importFootageFile(file);
              }
            }
          };
          input.click();
        }}
        onRotateClip={() => {
          if (selectedClipId) {
            const c = project?.clips.find((clip) => clip.id === selectedClipId);
            if (c) {
              const cur = c.transform?.rotation || 0;
              updateClipTransform(selectedClipId, { rotation: (cur + 90) % 360 });
            }
          }
        }}
      />

      {/* Batch Editing Bar — appears when 2+ clips selected */}
      {(selectedClipIds.length > 1 || selectedAudioClipIds.length > 1) && (
        <div className="px-3 py-1.5 bg-[#0e0e10] border-b border-[#27272a] flex items-center justify-between flex-shrink-0">
          <BatchEditBar
            selectedIds={[...selectedClipIds, ...selectedAudioClipIds]}
            onClear={() => {
              setSelectedClipIds([]);
              setSelectedAudioClipIds([]);
            }}
          />
          <span className="text-[10px] text-gray-500">
            Batch edit {selectedClipIds.length + selectedAudioClipIds.length} items
          </span>
        </div>
      )}

      {/* Macro Automation Sub-Panel */}
      {isMacroOpen && (
        <div className="px-2 py-2 bg-[#0e0e10] border-b border-[#27272a] flex-shrink-0">
          <MacroPanel />
        </div>
      )}

      {/* Main Multitrack Timeline Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sticky Track Headers Column (Dynamic Width w-44, non-truncated titles) */}
        {!isTimelineEmpty && (
          <div className="w-44 bg-[#121214] border-r border-[#27272a] flex flex-col flex-shrink-0 z-20 shadow-md">
            {/* Header 0: Ruler Track Label */}
            <div className="h-7 border-b border-[#27272a] px-3 flex items-center justify-between text-[9px] font-mono text-gray-500 bg-[#0e0e10] font-bold">
              <span>TRACKS</span>
              <span className="text-forge-cyan">{activeTrackCount} ACTIVE</span>
            </div>

            {/* Dynamic Header: Captions Track (CC) */}
            {showCaptionsTrack && (
              <div className="h-12 border-b border-[#27272a] px-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 bg-[#161618] hover:bg-[#1c1c20] transition-colors group">
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <span className="text-[9px] font-mono font-bold text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/60 flex-shrink-0">
                    CC
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-gray-200 truncate">Captions</span>
                    <span className="text-[9px] text-gray-500 font-mono">{captions.length} lines</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleTrackVisibility('captions')}
                    className={`p-1 rounded transition-colors ${
                      hiddenTracks['captions']
                        ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={hiddenTracks['captions'] ? 'Show Captions' : 'Hide Captions'}
                  >
                    {hiddenTracks['captions'] ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTrackLock('captions')}
                    className={`p-1 rounded transition-colors ${
                      lockedTracks['captions']
                        ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={lockedTracks['captions'] ? 'Unlock Captions Track' : 'Lock Captions Track'}
                  >
                    {lockedTracks['captions'] ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Header: Video Track 2 (Overlay / B-Roll) */}
            {showV2Track && (
              <div className="h-20 border-b border-[#27272a] px-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 bg-[#161618] hover:bg-[#1c1c20] transition-colors group">
                <div className="flex flex-col min-w-0 pr-1 gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60 flex-shrink-0">
                      V2
                    </span>
                    <span
                      className="text-[11px] font-bold text-gray-200 truncate"
                      title={v2Clips[0]?.name || 'Overlay V2'}
                    >
                      {v2Clips[0]?.name || 'Overlay V2'}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono pl-0.5">B-Roll / Overlay</span>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleTrackVisibility('v2')}
                      className={`p-1 rounded transition-colors ${
                        hiddenTracks['v2']
                          ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={hiddenTracks['v2'] ? 'Show Track V2' : 'Hide Track V2'}
                    >
                      {hiddenTracks['v2'] ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTrackMute('v2')}
                      className={`p-1 rounded transition-colors ${
                        mutedTracks['v2']
                          ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={mutedTracks['v2'] ? 'Unmute Track V2 Audio' : 'Mute Track V2 Audio'}
                    >
                      {mutedTracks['v2'] ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTrackLock('v2')}
                      className={`p-1 rounded transition-colors ${
                        lockedTracks['v2']
                          ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={lockedTracks['v2'] ? 'Unlock Track V2' : 'Lock Track V2'}
                    >
                      {lockedTracks['v2'] ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Header: Video Track 1 (Main Video) */}
            {showV1Track && (
              <div className="h-20 border-b border-[#27272a] px-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 bg-[#18181c] hover:bg-[#1e1e24] transition-colors group">
                <div className="flex flex-col min-w-0 pr-1 gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60 flex-shrink-0">
                      V1
                    </span>
                    <span
                      className="text-[11px] font-bold text-gray-200 truncate"
                      title={v1Clips[0]?.name || 'Main Video'}
                    >
                      {v1Clips[0]?.name || 'Main Video'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-400 font-mono px-1 py-0.2 rounded bg-black/40 border border-gray-800">
                      Cover • Base
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleTrackVisibility('v1')}
                      className={`p-1 rounded transition-colors ${
                        hiddenTracks['v1']
                          ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={hiddenTracks['v1'] ? 'Show Main Video Track' : 'Hide Main Video Track'}
                    >
                      {hiddenTracks['v1'] ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTrackMute('v1')}
                      className={`p-1 rounded transition-colors ${
                        mutedTracks['v1']
                          ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={mutedTracks['v1'] ? 'Unmute Main Video Audio' : 'Mute Main Video Audio'}
                    >
                      {mutedTracks['v1'] ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTrackLock('v1')}
                      className={`p-1 rounded transition-colors ${
                        lockedTracks['v1']
                          ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={lockedTracks['v1'] ? 'Unlock Main Video Track' : 'Lock Main Video Track'}
                    >
                      {lockedTracks['v1'] ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Header: Audio Track 1 (Voice / Audio) */}
            {showA1Track && (
              <div className="h-12 border-b border-[#27272a] px-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 bg-[#161618] hover:bg-[#1c1c20] transition-colors group">
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60 flex-shrink-0">
                    A1
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-[11px] font-bold text-gray-200 truncate"
                      title={a1Clips[0]?.name || 'Voice / Audio'}
                    >
                      {a1Clips[0]?.name || 'Voice / Audio'}
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">Dialogue</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleTrackMute('a1')}
                    className={`p-1 rounded transition-colors ${
                      mutedTracks['a1']
                        ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={mutedTracks['a1'] ? 'Unmute Audio Track 1' : 'Mute Audio Track 1'}
                  >
                    {mutedTracks['a1'] ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTrackLock('a1')}
                    className={`p-1 rounded transition-colors ${
                      lockedTracks['a1']
                        ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={lockedTracks['a1'] ? 'Unlock Audio Track 1' : 'Lock Audio Track 1'}
                  >
                    {lockedTracks['a1'] ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Header: Audio Track 2 (Music / SFX) */}
            {showA2Track && (
              <div className="h-12 border-b border-[#27272a] px-2.5 flex items-center justify-between text-xs font-semibold text-gray-400 bg-[#161618] hover:bg-[#1c1c20] transition-colors group">
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 flex-shrink-0">
                    A2
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-[11px] font-bold text-gray-200 truncate"
                      title={a2Clips[0]?.name || 'Music / SFX'}
                    >
                      {a2Clips[0]?.name || 'Music / SFX'}
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">BGM / SFX</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleTrackMute('a2')}
                    className={`p-1 rounded transition-colors ${
                      mutedTracks['a2']
                        ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={mutedTracks['a2'] ? 'Unmute Audio Track 2' : 'Mute Audio Track 2'}
                  >
                    {mutedTracks['a2'] ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTrackLock('a2')}
                    className={`p-1 rounded transition-colors ${
                      lockedTracks['a2']
                        ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={lockedTracks['a2'] ? 'Unlock Audio Track 2' : 'Lock Audio Track 2'}
                  >
                    {lockedTracks['a2'] ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Header: Overlays Track (OV) */}
            {showOverlayTrack && (
              <div className="h-10 border-b border-[#27272a] px-2.5 flex items-center justify-between text-xs font-semibold text-gray-400 bg-[#161618] hover:bg-[#1c1c20] transition-colors group">
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 flex-shrink-0">
                    OV
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-gray-200 truncate">Overlays</span>
                    <span className="text-[9px] text-gray-500 font-mono">{overlays.length} items</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleTrackVisibility('overlay')}
                    className={`p-1 rounded transition-colors ${
                      hiddenTracks['overlay']
                        ? 'text-red-400 bg-red-950/40 hover:bg-red-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={hiddenTracks['overlay'] ? 'Show Overlays' : 'Hide Overlays'}
                  >
                    {hiddenTracks['overlay'] ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTrackLock('overlay')}
                    className={`p-1 rounded transition-colors ${
                      lockedTracks['overlay']
                        ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={lockedTracks['overlay'] ? 'Unlock Overlay Track' : 'Lock Overlay Track'}
                  >
                    {lockedTracks['overlay'] ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Scrollable Track Lanes */}
        <div
          ref={scrollContainerRef}
          onScroll={handleTimelineScroll}
          onMouseDown={handleTimelineMouseDown}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={isTimelineEmpty ? handleDropOnEmptyState : handleDropOnPopulatedTimeline}
          className="flex-1 overflow-x-auto overflow-y-auto relative timeline-grid bg-[#121214]"
        >
          {/* CapCut Empty State Landing Dropzone */}
          {isTimelineEmpty && (
            <div
              onClick={handleOpenFileInput}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                (e.currentTarget as HTMLElement).setAttribute('data-drag', '1');
              }}
              onDragLeave={(e) => {
                (e.currentTarget as HTMLElement).removeAttribute('data-drag');
              }}
              onDrop={handleDropOnEmptyState}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 cursor-pointer group bg-[#101014]/95 data-[drag=1]:bg-cyan-950/30 transition-all"
            >
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[#2f2f38] group-hover:border-forge-cyan bg-[#16161c]/80 group-hover:bg-[#16161c] transition-all text-center max-w-lg shadow-2xl pointer-events-none">
                <div className="w-14 h-14 rounded-2xl bg-cyan-950/50 border border-cyan-800/60 flex items-center justify-center text-forge-cyan mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-cyan-950/50">
                  <UploadCloud className="w-7 h-7 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5 tracking-wide">
                  Drag & Drop Video, Audio, or Image to Start Editing
                </h3>
                <p className="text-xs text-gray-400 mb-4 max-w-sm">
                  Or click anywhere to import media files (MP4, MOV, WebM, MP3, WAV, PNG, JPG)
                </p>
                <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-forge-cyan to-blue-600 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/50">
                  <Plus className="w-4 h-4" />
                  <span>Import Media</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ width: `${tracksWidth}px` }} className="relative">
            {/* Active Marquee Selection Box */}
            {marquee && (
              <div
                style={{
                  left: `${Math.min(marquee.startX, marquee.currentX)}px`,
                  top: `${Math.min(marquee.startY, marquee.currentY)}px`,
                  width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
                  height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
                }}
                className="absolute z-50 border border-forge-cyan bg-forge-cyan/15 rounded pointer-events-none shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              />
            )}

            {/* Global Synchronized Laser Playhead Needle with Interactive Grab Handle */}
            <div
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const container = scrollContainerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const moveX = moveEvent.clientX - rect.left + container.scrollLeft;
                  const movedTime = Math.max(0, Math.min(totalDuration, moveX / pixelsPerSecond));
                  setCurrentTime(Math.round(movedTime * 100) / 100);
                };
                const handleMouseUp = () => {
                  window.removeEventListener('mousemove', handleMouseMove);
                  window.removeEventListener('mouseup', handleMouseUp);
                };
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
              }}
              className="absolute top-0 bottom-0 z-40 cursor-ew-resize group pointer-events-auto"
              title={`Playhead: ${formatTimecode(currentTime, true)} (Drag to scrub anywhere)`}
            >
              {/* Top diamond needle handle */}
              <div className="w-3.5 h-3.5 bg-forge-purple group-hover:bg-forge-cyan rotate-45 -translate-x-[6px] -translate-y-0.5 shadow-md shadow-purple-900/80 transition-colors" />
              {/* Full height vertical guide line */}
              <div className="w-[2px] h-[550px] bg-forge-purple group-hover:bg-forge-cyan shadow-[0_0_8px_rgba(139,92,246,0.9)] -translate-x-[0.5px] transition-colors" />
            </div>

            {/* Time Ruler */}
            <TimelineRuler
              totalDuration={totalDuration}
              currentTime={currentTime}
              zoomLevel={zoomLevel}
              pixelsPerSecond={pixelsPerSecond}
              totalWidth={tracksWidth}
              onSeek={setCurrentTime}
            />

            {/* Professional Markers Lane (Feature 32) */}
            <MarkerTrack pixelsPerSecond={pixelsPerSecond} totalWidth={tracksWidth} />

            {/* Dynamic Track 1: Captions Track */}
            {showCaptionsTrack && (
              <CaptionTrack
                captions={captions}
                selectedCaptionId={selectedCaptionId}
                selectedCaptionIds={selectedCaptionIds}
                currentTime={currentTime}
                pixelsPerSecond={pixelsPerSecond}
                totalWidth={tracksWidth}
                visibleStartSeconds={viewportBounds.startSec}
                visibleEndSeconds={viewportBounds.endSec}
                isLocked={!!lockedTracks['captions']}
                isHidden={!!hiddenTracks['captions']}
                onSelectCaption={(id) => {
                  setSelectedCaptionId(id);
                  setSelectedClipId(null);
                  setSelectedAudioClipId(null);
                  setSelectedOverlayId(null);
                }}
                onTrimCaption={(id, start, end) => trimCaptionLine(id, start, end)}
                onMoveCaption={(id, newStart) => moveCaptionLine(id, newStart)}
                onSplitCaption={(id) => splitCaptionAtPlayhead(id)}
                onDuplicateCaption={(id) => duplicateCaptionLine(id)}
                onDeleteCaption={(id) => deleteCaptionLine(id)}
              />
            )}

            {/* Dynamic Track 2 (V2): Video Track 2 (Overlay / B-roll Layer) */}
            {showV2Track && (
              <VideoTrack
                clips={project?.clips || []}
                transitions={project?.transitions || []}
                selectedClipId={selectedClipId}
                selectedClipIds={selectedClipIds}
                selectedTransitionId={selectedTransitionId}
                pixelsPerSecond={pixelsPerSecond}
                totalWidth={tracksWidth}
                visibleStartSeconds={viewportBounds.startSec}
                visibleEndSeconds={viewportBounds.endSec}
                trackIndex={2}
                isMagnetMode={isMagnetMode}
                isLocked={!!lockedTracks['v2']}
                isHidden={!!hiddenTracks['v2']}
                isMuted={!!mutedTracks['v2']}
                onSelectClip={(id) => {
                  setSelectedClipId(id);
                  setSelectedAudioClipId(null);
                  setSelectedCaptionId(null);
                  setSelectedOverlayId(null);
                  setSelectedTransitionId(null);
                }}
                onSelectTransition={(id) => {
                  setSelectedTransitionId(id);
                  setSelectedClipId(null);
                  setSelectedAudioClipId(null);
                  setSelectedCaptionId(null);
                  setSelectedOverlayId(null);
                }}
                onTrimClip={(id, start, end, timelineStart) =>
                  trimClip(id, start, end, timelineStart)
                }
                onTrimTransitionDuration={(id, duration) =>
                  updateTransition(id, { duration })
                }
                onDropFootage={handleDropFootage}
                onMoveClip={moveClipPosition}
                onCloseGap={closeGapAtTime}
              />
            )}

            {/* Dynamic Track 3 (V1): Video Track 1 (Main Footage) */}
            {showV1Track && (
              <VideoTrack
                clips={project?.clips || []}
                transitions={project?.transitions || []}
                selectedClipId={selectedClipId}
                selectedClipIds={selectedClipIds}
                selectedTransitionId={selectedTransitionId}
                pixelsPerSecond={pixelsPerSecond}
                totalWidth={tracksWidth}
                visibleStartSeconds={viewportBounds.startSec}
                visibleEndSeconds={viewportBounds.endSec}
                trackIndex={1}
                isMagnetMode={isMagnetMode}
                isLocked={!!lockedTracks['v1']}
                isHidden={!!hiddenTracks['v1']}
                isMuted={!!mutedTracks['v1']}
                onSelectClip={(id) => {
                  setSelectedClipId(id);
                  setSelectedAudioClipId(null);
                  setSelectedCaptionId(null);
                  setSelectedOverlayId(null);
                  setSelectedTransitionId(null);
                }}
                onSelectTransition={(id) => {
                  setSelectedTransitionId(id);
                  setSelectedClipId(null);
                  setSelectedAudioClipId(null);
                  setSelectedCaptionId(null);
                  setSelectedOverlayId(null);
                }}
                onTrimClip={(id, start, end, timelineStart) =>
                  trimClip(id, start, end, timelineStart)
                }
                onTrimTransitionDuration={(id, duration) =>
                  updateTransition(id, { duration })
                }
                onDropFootage={handleDropFootage}
                onMoveClip={moveClipPosition}
                onCloseGap={closeGapAtTime}
              />
            )}

            {/* Dynamic Track 4 (A1): Audio Track 1 */}
            {showA1Track && (
              <AudioTrack
                audioClips={project?.audioClips || []}
                selectedAudioClipId={selectedAudioClipId}
                selectedAudioClipIds={selectedAudioClipIds}
                pixelsPerSecond={pixelsPerSecond}
                totalWidth={tracksWidth}
                visibleStartSeconds={viewportBounds.startSec}
                visibleEndSeconds={viewportBounds.endSec}
                trackIndex={1}
                isLocked={!!lockedTracks['a1']}
                isMuted={!!mutedTracks['a1']}
                isMagnetMode={isMagnetMode}
                onSelectAudioClip={(id) => {
                  setSelectedAudioClipId(id);
                  setSelectedClipId(null);
                  setSelectedCaptionId(null);
                  setSelectedOverlayId(null);
                  setSelectedTransitionId(null);
                }}
                onTrimAudioClip={(id, start, end, timelineStart) =>
                  trimAudioClip(id, start, end, timelineStart)
                }
                onDeleteAudioClip={deleteAudioClip}
                onDuplicateAudioClip={duplicateAudioClip}
                onSplitAudioClip={splitAudioClipAtPlayhead}
                onRemoveSilenceAudioClip={removeSilencesFromAudioClip}
                onEnhanceAudioClip={enhanceAudioClipTrack}
                onToggleMuteAudioClip={toggleAudioMute}
                onSetVolumeAudioClip={setAudioVolume}
                onMoveAudioClip={moveAudioClipPosition}
              />
            )}

            {/* Dynamic Track 5 (A2): Audio Track 2 (Music / SFX) */}
            {showA2Track && (
              <AudioTrack
                audioClips={project?.audioClips || []}
                selectedAudioClipId={selectedAudioClipId}
                selectedAudioClipIds={selectedAudioClipIds}
                pixelsPerSecond={pixelsPerSecond}
                totalWidth={tracksWidth}
                visibleStartSeconds={viewportBounds.startSec}
                visibleEndSeconds={viewportBounds.endSec}
                trackIndex={2}
                isLocked={!!lockedTracks['a2']}
                isMuted={!!mutedTracks['a2']}
                isMagnetMode={isMagnetMode}
                onSelectAudioClip={(id) => {
                  setSelectedAudioClipId(id);
                  setSelectedClipId(null);
                  setSelectedCaptionId(null);
                  setSelectedOverlayId(null);
                  setSelectedTransitionId(null);
                }}
                onTrimAudioClip={(id, start, end, timelineStart) =>
                  trimAudioClip(id, start, end, timelineStart)
                }
                onDeleteAudioClip={deleteAudioClip}
                onDuplicateAudioClip={duplicateAudioClip}
                onSplitAudioClip={splitAudioClipAtPlayhead}
                onRemoveSilenceAudioClip={removeSilencesFromAudioClip}
                onEnhanceAudioClip={enhanceAudioClipTrack}
                onToggleMuteAudioClip={toggleAudioMute}
                onSetVolumeAudioClip={setAudioVolume}
                onMoveAudioClip={moveAudioClipPosition}
              />
            )}

            {/* Dynamic Track 6 (OV): Overlays Track */}
            {showOverlayTrack && (
              <OverlayTrack
                overlays={overlays}
                selectedOverlayId={selectedOverlayId}
                pixelsPerSecond={pixelsPerSecond}
                totalWidth={tracksWidth}
                visibleStartSeconds={viewportBounds.startSec}
                visibleEndSeconds={viewportBounds.endSec}
                isLocked={!!lockedTracks['overlay']}
                isHidden={!!hiddenTracks['overlay']}
                onSelectOverlay={(id) => {
                  setSelectedOverlayId(id);
                  setSelectedClipId(null);
                  setSelectedAudioClipId(null);
                  setSelectedCaptionId(null);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Floating Multi-Selection Action Ribbon */}
      {(selectedClipIds.length > 0 || selectedAudioClipIds.length > 0 || selectedCaptionIds.length > 0) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 bg-[#16161a]/95 backdrop-blur-md border border-forge-cyan text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-forge-cyan">
            <Layers className="w-4 h-4 text-forge-cyan" />
            <span>
              {selectedClipIds.length + selectedAudioClipIds.length + selectedCaptionIds.length} Items Selected
            </span>
          </div>

          <div className="h-4 w-[1px] bg-gray-700" />

          {/* Delete All Selected */}
          <button
            onClick={() => {
              deleteMultipleTimelineItems({
                clipIds: selectedClipIds,
                audioClipIds: selectedAudioClipIds,
                captionIds: selectedCaptionIds,
              });
              setSelectedClipIds([]);
              setSelectedAudioClipIds([]);
              setSelectedCaptionIds([]);
            }}
            className="px-2.5 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow transition-all"
            title="Delete all selected items (Del / Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Selected</span>
          </button>

          {/* Deselect All */}
          <button
            onClick={() => {
              setSelectedClipIds([]);
              setSelectedAudioClipIds([]);
              setSelectedCaptionIds([]);
            }}
            className="px-2 py-1 rounded-lg bg-canvas-card hover:bg-canvas-hover border border-canvas-border text-gray-300 text-xs font-medium transition-all"
          >
            Deselect All (Esc)
          </button>
        </div>
      )}

      {/* Multicam Studio Quad-Angle Switcher Modal */}
      {isMulticamOpen && <MulticamStudio onClose={() => setIsMulticamOpen(false)} />}

      {/* Intelligent Scene Detection Modal */}
      {isSceneDetectionOpen && project?.clips && project.clips.length > 0 && (
        <SceneDetectionModal
          clip={project.clips.find((c) => c.id === selectedClipId) || project.clips[0]}
          onClose={() => setIsSceneDetectionOpen(false)}
        />
      )}

      {/* Editing History (Feature 31) */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="Editing History" subtitle="Jump to any snapshot — same engine as undo/redo" maxWidth="md">
        <HistoryPanel />
      </Modal>
    </div>
  );
};
