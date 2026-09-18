import React, { useState } from 'react';
import { VideoClip } from '../../types/project';
import { TransitionConfig } from '../../types/transitions';
import { useProject } from '../../context/ProjectContext';
import { ClipContextMenu } from './ClipContextMenu';
import { TimelineKeyframeRibbon } from '../keyframes/TimelineKeyframeRibbon';
import { SceneDetectionModal } from '../editor/SceneDetectionModal';
import { AutoCaptionModal } from '../captions/AutoCaptionModal';
import { Film, VolumeX, Sparkles, Layers, ArrowDown, Scissors, Check, Wand2, Diamond, AlertTriangle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { isImageFile } from '../../utils/mediaLoader';
import { formatTimecode, sanitizeTime } from '../../utils/timecode';
import { validateTransitionDrop, getSafeTransitionDuration } from '../../utils/transitionEngine';
import { getTransitionDefinition } from '../../utils/transitionPresets';
import { calculateTrimUpdate } from '../../hooks/useClipTrim';
import { getDragPayload, clearDragPayload } from '../../utils/nleDnD';
import { resolveEffectPreset, resolveFilterGrading, resolveTransitionPreset } from '../../utils/presetBridge';
import { findNearestCut } from '../../utils/nleTimeline';
import { EffectStrip } from './EffectStrip';

interface VideoTrackProps {
  clips: VideoClip[];
  transitions?: TransitionConfig[];
  selectedClipId: string | null;
  selectedClipIds?: string[];
  selectedTransitionId?: string | null;
  pixelsPerSecond: number;
  totalWidth: number;
  trackIndex?: number;
  isMagnetMode?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  isMuted?: boolean;
  onSelectClip: (id: string) => void;
  onSelectTransition?: (id: string) => void;
  onTrimClip: (id: string, startOffset: number, endOffset: number, timelineStart?: number) => void;
  onTrimTransitionDuration?: (id: string, duration: number) => void;
  onDropFootage?: (clip: any, dropTime: number, trackIndex: number, insertMode?: boolean) => void;
  onMoveClip?: (clipId: string, newStart: number, targetTrackIndex?: number) => void;
  onCloseGap?: (trackIndex: number, gapStartTime: number) => void;
  visibleStartSeconds?: number;
  visibleEndSeconds?: number;
}

export const VideoTrack: React.FC<VideoTrackProps> = React.memo(({
  clips,
  transitions = [],
  selectedClipId,
  selectedClipIds = [],
  selectedTransitionId,
  pixelsPerSecond,
  totalWidth,
  trackIndex = 1,
  isMagnetMode = true,
  isLocked = false,
  isHidden = false,
  isMuted = false,
  visibleStartSeconds,
  visibleEndSeconds,
  onSelectClip,
  onSelectTransition,
  onTrimClip,
  onTrimTransitionDuration,
  onDropFootage,
  onMoveClip,
  onCloseGap,
}) => {
  const {
    copyClip,
    cutClip,
    deleteClip,
    duplicateClip,
    splitClipAtPlayhead,
    splitScenesForClip,
    extractAudioFromClip,
    removeSilencesFromClip,
    enhanceAudioClip,
    enhanceVideoClipVisuals,
    toggleClipMute,
    autoTranscribeVideo,
    setActiveSidebarTab,
    addEffectToClip,
    addTransition,
    updateTransition,
    deleteTransition,
    addOverlay,
    setSelectedClipId,
    currentTime,
    setCurrentTime,
    freezeFrameAtPlayhead,
    reverseClip,
    copyClipAttributes,
    pasteClipAttributes,
    createCompoundClip,
    replaceClipMedia,
    addMarker,
    importFootageFile,
    importAudioFile,
    project,
    batchMoveClips,
    updateClip,
  } = useProject() as any;

  const [isDragOverTrack, setIsDragOverTrack] = useState<boolean>(false);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragOffsetTime, setDragOffsetTime] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clip: VideoClip } | null>(null);
  const [transDurationPreview, setTransDurationPreview] = useState<Record<string, number>>({});
  const [transContextMenu, setTransContextMenu] = useState<{ x: number; y: number; trans: TransitionConfig } | null>(null);
  const [sceneModalClip, setSceneModalClip] = useState<VideoClip | null>(null);
  const [showAutoCaptionModal, setShowAutoCaptionModal] = useState<boolean>(false);
  const [silenceToast, setSilenceToast] = useState<{ removedCount: number; savedSeconds: number } | null>(null);
  const [dropToast, setDropToast] = useState<string | null>(null);
  // Transient trim preview (avoids pushing history on every mousemove — commit once on mouseup)
  const [trimPreview, setTrimPreview] = useState<Record<string, { startOffset: number; endOffset: number; timelineStart: number; timelineDuration: number }>>({});
  const [snapIndicatorX, setSnapIndicatorX] = useState<number | null>(null);
  const [activeTrimHud, setActiveTrimHud] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    deltaSec: number;
    inOutTime: number;
    duration: number;
    x: number;
  } | null>(null);

  const trackClips = clips
    .filter((c) => (c.trackIndex || 1) === trackIndex)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  // Ghost preview + snap + track validation (professional)
  const [dragGhost, setDragGhost] = useState<{ time: number; duration: number; valid: boolean; label: string } | null>(null);
  const [isInvalidDrop, setIsInvalidDrop] = useState(false);

  const getDraggedPayload = (): any => {
    try {
      const w: any = window as any;
      if (w.__cf_draggedMedia) return w.__cf_draggedMedia;
    } catch {}
    return null;
  };

  const handleTrackDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOverTrack(true);

    // Determine dragged media type & duration for ghost width.
    // Unified DnD bus (dataTransfer + window slot) so ghosts work everywhere.
    let payload: any = null;
    try {
      payload = getDragPayload(e as any);
    } catch {}
    if (!payload) payload = getDraggedPayload();

    // Track validation: video track only accepts video/image/footage, not pure audio
    const isAudioPayload = payload && payload.type === 'audio';
    if (isAudioPayload) {
      setIsInvalidDrop(true);
      setDragGhost({ time: 0, duration: 0, valid: false, label: 'Audio → use Audio Track' });
      return;
    }
    setIsInvalidDrop(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    let rawTime = Math.max(0, rawX / pixelsPerSecond);
    if (!isFinite(rawTime)) rawTime = 0;

    // Snap computation: playhead, clip edges, markers
    const snapThreshold = 8 / Math.max(10, pixelsPerSecond);
    let snapTime = rawTime;
    let snapped = false;
    const candidates: number[] = [];
    try {
      const p: any = project as any;
      if (p && isFinite(currentTime)) candidates.push(currentTime);
      for (const c of trackClips) {
        candidates.push(c.timelineStart);
        candidates.push(c.timelineStart + c.timelineDuration);
      }
      // Add markers if available
      const allMarkers: any[] = (project as any)?.markers || [];
      for (const m of allMarkers) if (isFinite(m.time)) candidates.push(m.time);
    } catch {}
    let best = rawTime;
    let bestDist = snapThreshold + 0.01;
    // Magnetic snapping: magnet toggle ON + hold ALT to bypass temporarily.
    const snapEnabled = isMagnetMode && !(e as any).altKey;
    for (const cand of candidates) {
      const d = Math.abs(rawTime - cand);
      if (d < bestDist) { bestDist = d; best = cand; }
    }
    if (snapEnabled && bestDist <= snapThreshold) { snapTime = best; snapped = true; }

    // Transition drag: show insertion indicator snapped to the nearest cut.
    if (payload && payload.type === 'transition') {
      const presetId = (payload as any).transitionType || (payload as any).presetId;
      const bridged = presetId ? resolveTransitionPreset(presetId) : null;
      const tDur = bridged?.duration || 0.6;
      const cut = findNearestCut(trackClips, rawTime, trackIndex);
      if (cut) {
        setSnapIndicatorX(cut.cutPoint * pixelsPerSecond);
        setDragGhost({ time: cut.cutPoint - tDur / 2, duration: tDur, valid: true, label: `⇄ ${bridged?.name || 'Transition'} • ${tDur.toFixed(2)}s` });
        return;
      }
      setSnapIndicatorX(null);
      setDragGhost({ time: rawTime, duration: tDur, valid: trackClips.length > 0, label: trackClips.length > 0 ? 'Drop on a cut' : 'Need 2 clips' });
      return;
    }
    // Effect / filter drag: highlight the target clip under the cursor.
    if (payload && (payload.type === 'effect' || payload.type === 'filter')) {
      const target = trackClips.find((c) => rawTime >= c.timelineStart && rawTime <= c.timelineStart + c.timelineDuration);
      if (target) {
        setSnapIndicatorX(null);
        setDragGhost({ time: target.timelineStart, duration: target.timelineDuration, valid: true, label: `fx → ${target.name.slice(0, 18)}` });
        return;
      }
    }

    // Duration for ghost: from payload clip or default image duration
    let ghostDur = 5;
    if (payload && payload.clip && isFinite(payload.clip.duration)) ghostDur = payload.clip.duration;
    else if (payload && payload.clip && isFinite(payload.clip.timelineDuration)) ghostDur = payload.clip.timelineDuration;
    // Quantize to frame
    const fps = 30;
    const frameDur = 1 / fps;
    ghostDur = Math.max(0.2, Math.round(ghostDur / frameDur) * frameDur);
    snapTime = Math.round(snapTime / frameDur) * frameDur;
    snapTime = Math.max(0, Math.round(snapTime * 1000) / 1000);

    const isOverwrite = (e as any).shiftKey;
    const snapOff = !isMagnetMode || (e as any).altKey;
    setDragGhost({ time: snapTime, duration: ghostDur, valid: true, label: isOverwrite ? `Overwrite ${ghostDur.toFixed(1)}s` : snapped ? 'Snap • Insert' : snapOff ? `Free ${ghostDur.toFixed(1)}s (Alt)` : `Insert ${ghostDur.toFixed(1)}s` });
    if (snapped) setSnapIndicatorX(snapTime * pixelsPerSecond);
    else setSnapIndicatorX(null);
    // Also update visual feedback for snap
  };

  const handleTrackDragLeave = () => {
    setIsDragOverTrack(false);
    setDragGhost(null);
    setIsInvalidDrop(false);
    setSnapIndicatorX(null);
  };

  const handleTrackDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverTrack(false);
    setDragGhost(null);
    setIsInvalidDrop(false);
    setSnapIndicatorX(null);

    // Handle OS file drops directly onto timeline track (image/video)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      let dropTime = Math.max(0, dropX / pixelsPerSecond);
      const fpsF = 30; const frameDurF = 1 / fpsF;
      dropTime = Math.round(dropTime / frameDurF) * frameDurF;
      dropTime = Math.max(0, Math.round(dropTime * 1000) / 1000);
      for (const f of Array.from(e.dataTransfer.files)) {
        const name = (f as File).name || '';
        const isAudio = /\.(mp3|wav|aac|m4a|ogg|flac|wma|opus)$/i.test(name) || (f as File).type.startsWith('audio/');
        if (isAudio) {
          setDropToast('Invalid drop: Audio → use Audio Track');
          setTimeout(() => setDropToast(null), 2500);
          continue;
        }
        // Import then insert at dropTime (single duration handling inside importFootageFile + onDropFootage)
        importFootageFile(f as File).then((newClip: any) => {
          if (newClip && onDropFootage) onDropFootage(newClip, dropTime, trackIndex);
        });
      }
      return;
    }

    try {
      const data: any = getDragPayload(e as any);
      clearDragPayload();
      if (!data) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      let dropTime = Math.max(0, dropX / pixelsPerSecond);
      if (!isFinite(dropTime)) return;
      // Frame quantize and snap to nearest candidate (playhead / clip edges)
      const snapThreshold = 8 / Math.max(10, pixelsPerSecond);
      const candidates: number[] = [];
      try {
        if (isFinite(currentTime)) candidates.push(currentTime);
        for (const c of trackClips) { candidates.push(c.timelineStart); candidates.push(c.timelineStart + c.timelineDuration); }
        const allMarkers: any[] = (project as any)?.markers || [];
        for (const m of allMarkers) if (isFinite(m.time)) candidates.push(m.time);
      } catch {}
      let best = dropTime; let bestDist = snapThreshold + 1;
      for (const cand of candidates) { const d = Math.abs(dropTime - cand); if (d < bestDist) { bestDist = d; best = cand; } }
      // Magnet toggle + Alt bypass (consistent with dragover ghost).
      if (isMagnetMode && !(e as any).altKey && bestDist <= snapThreshold) dropTime = best;
      const fps2 = 30; const frameDur2 = 1 / fps2;
      dropTime = Math.round(dropTime / frameDur2) * frameDur2;
      dropTime = Math.max(0, Math.round(dropTime * 1000) / 1000);
      if (!isFinite(dropTime)) return;

      // Track-aware validation: reject audio on video track
      if (data.type === 'audio' && data.clip) {
        setDropToast('Invalid drop: Audio belongs on an Audio Track');
        setTimeout(() => setDropToast(null), 2500);
        return;
      }

      if (data.type === 'footage' && data.clip && onDropFootage) {
        const durCheck = sanitizeTime(data.clip.duration ?? data.clip.timelineDuration, 0);
        if (!isFinite(durCheck) || durCheck <= 0.05) {
          // Allow — ProjectContext will replace with DEFAULT_IMAGE_DURATION for images
        }
        const insertMode = !e.shiftKey; // Shift = overwrite, otherwise insert
        onDropFootage(data.clip, dropTime, trackIndex, insertMode);
      } else if (data.type === 'effect' && (data.effectType || data.presetId)) {
        // Resolve UI preset id -> real engine effect; refuse fakes honestly.
        const presetId = data.effectType || data.presetId;
        const resolved = resolveEffectPreset(presetId);
        if (!resolved) {
          setDropToast(`Unknown effect "${data.name || presetId}" — not applied`);
          setTimeout(() => setDropToast(null), 2600);
        } else {
          // Find clip under drop position
          const targetClip = trackClips.find(
            (c) => dropTime >= c.timelineStart && dropTime <= c.timelineStart + c.timelineDuration
          );

          if (targetClip) {
            addEffectToClip(targetClip.id, resolved.engineType as any, { dropTime, params: { ...resolved.params, ...(data.params || {}) } });
            setSelectedClipId(targetClip.id);
            onSelectClip(targetClip.id);
            setActiveSidebarTab('effects');
            setDropToast(`Added ${resolved.name} effect to ${targetClip.name}`);
            setTimeout(() => setDropToast(null), 2000);
          } else if (addOverlay) {
            const overlayId = `ov_fx_${Date.now()}`;
            addOverlay({
              id: overlayId,
              type: 'effect' as any,
              name: `${resolved.name} Layer`,
              timelineStart: dropTime,
              timelineDuration: 6.0,
              x: 50,
              y: 50,
              scale: 1.0,
              opacity: 1.0,
              effectType: resolved.engineType,
              params: { ...resolved.params },
            } as any);
            setDropToast(`Created ${resolved.name} Adjustment Layer`);
            setTimeout(() => setDropToast(null), 2000);
          }
        }
      } else if (data.type === 'filter') {
        const presetId = (data as any).filterId || data.presetId || (data as any).id;
        const resolved = presetId ? resolveEffectPreset(presetId) : null;
        const targetClip = trackClips.find(
          (c) => dropTime >= c.timelineStart && dropTime <= c.timelineStart + c.timelineDuration
        ) || trackClips[0];

        if (targetClip) {
          const grading = presetId ? resolveFilterGrading(presetId) : (data.params || {});
          updateClip(targetClip.id, {
            colorGrading: {
              ...(targetClip as any).colorGrading,
              ...grading,
            },
          });
          if (resolved) {
            addEffectToClip(targetClip.id, resolved.engineType as any, { dropTime, params: { ...resolved.params, ...(data.params || {}) } });
          }
          setSelectedClipId(targetClip.id);
          onSelectClip(targetClip.id);
          setDropToast(`Applied ${resolved?.name || data.name || 'filter'} to ${targetClip.name}`);
          setTimeout(() => setDropToast(null), 2000);
        }
      } else if (data.type === 'text-preset' && data.preset && addOverlay) {
        const p = data.preset;
        const overlayId = `ov_txt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        addOverlay({
          id: overlayId,
          type: 'text',
          name: p.name,
          timelineStart: dropTime,
          timelineDuration: p.duration || 4,
          x: 50,
          y: p.defaultY ?? 50,
          scale: 1.0,
          opacity: 1.0,
          rotation: 0,
          text: p.previewText,
          fontFamily: p.fontFamily,
          fontSize: p.fontSize,
          fontWeight: p.fontWeight,
          textColor: p.textColor,
          backgroundColor: p.backgroundColor,
          backgroundPadding: p.backgroundPadding,
          backgroundRadius: p.backgroundRadius,
          strokeColor: p.strokeColor,
          strokeWidth: p.strokeWidth,
          shadowColor: p.shadowColor,
          shadowBlur: p.shadowBlur,
          shadowOffsetX: p.shadowOffsetX,
          shadowOffsetY: p.shadowOffsetY,
          animationStyle: p.animationStyle || 'fade',
        });
        setDropToast(`Added text layer "${p.name}"`);
        setTimeout(() => setDropToast(null), 2000);
      } else if (data.type === 'element-preset' && data.item && addOverlay) {
        const el = data.item;
        const overlayId = `ov_el_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        addOverlay({
          id: overlayId,
          type: 'element',
          name: el.name,
          timelineStart: dropTime,
          timelineDuration: el.duration || 3,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1.0,
          textColor: el.defaultColor || '#FFFFFF',
          title: el.name,
          animationStyle: 'pop',
        });
        setDropToast(`Added element "${el.name}"`);
        setTimeout(() => setDropToast(null), 2000);
      } else if (data.type === 'motion-graphic' && data.template && addOverlay) {
        const tpl = data.template;
        const overlayId = `ov_mogrt_${Date.now()}`;
        addOverlay({
          id: overlayId,
          type: 'motion-graphic' as any,
          name: tpl.name,
          timelineStart: dropTime,
          timelineDuration: tpl.defaultParams?.durationInSeconds || 3.5,
          x: tpl.defaultParams?.x ?? 50,
          y: tpl.defaultParams?.y ?? 80,
          scale: tpl.defaultParams?.scale ?? 1.0,
          opacity: tpl.defaultParams?.opacity ?? 1.0,
          title: tpl.defaultParams?.title,
          subtitle: tpl.defaultParams?.subtitle,
          textColor: tpl.defaultParams?.textColor,
          backgroundColor: tpl.defaultParams?.backgroundColor,
          fontFamily: tpl.defaultParams?.fontFamily,
          fontSize: tpl.defaultParams?.fontSize,
          animationStyle: tpl.defaultParams?.animationStyle || 'slide',
          templateId: tpl.id,
          motionParams: { ...tpl.defaultParams },
        } as any);
        setDropToast(`Added motion graphic "${tpl.name}"`);
        setTimeout(() => setDropToast(null), 2000);
      } else if (data.type === 'transition' && (data.transitionType || data.presetId)) {
        // Smart transition placement with handle validation and safe-duration clamping.
        // UI preset ids (e.g. 'zoom-in') resolve to real engine types first.
        const presetId = data.transitionType || data.presetId;
        const bridged = resolveTransitionPreset(presetId);
        if (!bridged) {
          setDropToast(`Unknown transition "${data.name || presetId}" — not applied`);
          setTimeout(() => setDropToast(null), 2600);
        } else {
        const def = getTransitionDefinition(bridged.engineType);
        const requestedDur = (data as any).duration || bridged.duration || def?.defaultDuration || 0.75;
        const engineTransitionType = bridged.engineType;

        if (trackClips.length === 0) {
          setDropToast(`Warning: Drop a clip first — transitions need an edit point between two clips`);
          setTimeout(() => setDropToast(null), 3000);
        } else if (trackClips.length >= 2) {
          let bestCutPoint = trackClips[0].timelineStart + trackClips[0].timelineDuration;
          let fromClip = trackClips[0];
          let toClip = trackClips[1];
          let minDiff = 999999;

          for (let i = 0; i < trackClips.length - 1; i++) {
            const cut = trackClips[i].timelineStart + trackClips[i].timelineDuration;
            const diff = Math.abs(dropTime - cut);
            if (diff < minDiff) {
              minDiff = diff;
              bestCutPoint = cut;
              fromClip = trackClips[i];
              toClip = trackClips[i + 1];
            }
          }

          const validation = validateTransitionDrop(fromClip, toClip, requestedDur);
          if (!validation.valid) {
            setDropToast(`Warning: ${validation.message}`);
            setTimeout(() => setDropToast(null), 3200);
          } else {
            addTransition({
              type: engineTransitionType,
              name: bridged.name,
              fromClipId: fromClip.id,
              toClipId: toClip.id,
              timelineStart: bestCutPoint,
              duration: validation.safeDuration,
              alignment: 'center',
              direction: bridged.direction,
              params: { ...bridged.params },
            });
            const note = validation.message ? ` (${validation.message})` : '';
            setDropToast(`Snapped ${bridged.name} to cut • ${validation.safeDuration}s${note}`);
            setTimeout(() => setDropToast(null), 2800);
          }
        } else if (trackClips.length === 1) {
          const singleClip = trackClips[0];
          const isNearStart = dropTime <= singleClip.timelineStart + 1.0;
          const isNearEnd = dropTime >= singleClip.timelineStart + singleClip.timelineDuration - 1.0;

          if (isNearStart || isNearEnd) {
            const align: 'start' | 'end' = isNearStart ? 'start' : 'end';
            const { safeDuration, wasClamped } = getSafeTransitionDuration(singleClip, singleClip, requestedDur, align);
            addTransition({
              type: engineTransitionType,
              name: bridged.name,
              fromClipId: singleClip.id,
              toClipId: singleClip.id,
              timelineStart: isNearStart ? singleClip.timelineStart : singleClip.timelineStart + singleClip.timelineDuration,
              duration: safeDuration,
              alignment: align,
              direction: bridged.direction,
              params: { ...bridged.params },
            });
            setDropToast(`${wasClamped ? 'Clamped to ' : ''}${bridged.name} ${isNearStart ? 'Intro' : 'Outro'} • ${safeDuration}s`);
            setTimeout(() => setDropToast(null), 2800);
          } else {
            // Validate handle before auto-split
            if (singleClip.timelineDuration < 0.6) {
              setDropToast(`Warning: Clip too short — extend it before adding a transition`);
              setTimeout(() => setDropToast(null), 3000);
            } else {
              // Don't auto-split on invalid location; guide user instead
              setDropToast(`Drop near the clip edge for intro/outro, or between two clips for a center transition`);
              setTimeout(() => setDropToast(null), 3200);
            }
          }
        }
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped timeline data', err);
    }
  };

  const handleDirectClipDrop = (e: React.DragEvent, clip: VideoClip) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = getDragPayload(e as any);
      if (!data) return;
      clearDragPayload();

      if (data.type === 'effect' && (data.effectType || data.presetId)) {
        const presetId = data.effectType || data.presetId!;
        const resolved = resolveEffectPreset(presetId);
        if (!resolved) {
          setDropToast(`Unknown effect "${data.name || presetId}" — not applied`);
          setTimeout(() => setDropToast(null), 2600);
          return;
        }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const dropTime = clip.timelineStart + Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))) * clip.timelineDuration;
        addEffectToClip(clip.id, resolved.engineType as any, { dropTime, params: { ...resolved.params, ...(data.params || {}) } });
        setSelectedClipId(clip.id);
        onSelectClip(clip.id);
        setActiveSidebarTab('effects');
        setDropToast(`Added ${resolved.name} effect to ${clip.name}`);
        setTimeout(() => setDropToast(null), 2000);
      } else if (data.type === 'filter') {
        const presetId = (data as any).filterId || data.presetId || (data as any).id;
        const resolved = presetId ? resolveEffectPreset(presetId) : null;
        const grading = presetId ? resolveFilterGrading(presetId) : (data.params || {});
        updateClip(clip.id, {
          colorGrading: {
            ...(clip as any).colorGrading,
            ...grading,
          },
        });
        if (resolved) {
          addEffectToClip(clip.id, resolved.engineType as any, { params: { ...resolved.params, ...(data.params || {}) } });
        }
        setSelectedClipId(clip.id);
        onSelectClip(clip.id);
        setDropToast(`Applied ${resolved?.name || data.name || 'filter'} to ${clip.name}`);
        setTimeout(() => setDropToast(null), 2000);
      } else if (data.type === 'transition' && (data.transitionType || data.presetId)) {
        const presetId = data.transitionType || data.presetId!;
        const bridged = resolveTransitionPreset(presetId);
        if (!bridged) {
          setDropToast(`Unknown transition "${data.name || presetId}" — not applied`);
          setTimeout(() => setDropToast(null), 2600);
          return;
        }
        const def = getTransitionDefinition(bridged.engineType);
        const { safeDuration } = getSafeTransitionDuration(clip, clip, def?.defaultDuration || bridged.duration || 0.75, 'end');
        addTransition({
          type: bridged.engineType,
          name: bridged.name,
          fromClipId: clip.id,
          toClipId: clip.id,
          timelineStart: clip.timelineStart + clip.timelineDuration,
          duration: safeDuration,
          alignment: 'end',
          direction: bridged.direction,
          params: { ...bridged.params },
        });
        setDropToast(`Added ${bridged.name} transition to ${clip.name}`);
        setTimeout(() => setDropToast(null), 2000);
      }
    } catch (err) {
      console.error('Failed to parse dropped data on clip', err);
    }
  };

  // Find all gaps on this track when not in magnet mode
  const gaps: Array<{ start: number; end: number; duration: number }> = [];
  if (!isMagnetMode && trackClips.length > 0) {
    if (trackClips[0].timelineStart > 0.05) {
      gaps.push({
        start: 0,
        end: trackClips[0].timelineStart,
        duration: trackClips[0].timelineStart,
      });
    }
    for (let i = 0; i < trackClips.length - 1; i++) {
      const currentEnd = trackClips[i].timelineStart + trackClips[i].timelineDuration;
      const nextStart = trackClips[i + 1].timelineStart;
      if (nextStart - currentEnd > 0.05) {
        gaps.push({
          start: currentEnd,
          end: nextStart,
          duration: nextStart - currentEnd,
        });
      }
    }
  }

  // Handle dragging transition edges to visually adjust duration with safe-clamping
  const handleTransitionResize = (trans: TransitionConfig, edge: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const initialDur = trans.duration;
    const fromClip = trackClips.find((c) => c.id === trans.fromClipId);
    const toClip = trackClips.find((c) => c.id === trans.toClipId);

    const onMove = (me: MouseEvent) => {
      const deltaSec = (me.clientX - startX) / pixelsPerSecond;
      const durChange = edge === 'left' ? -deltaSec : deltaSec;
      const rawDur = Math.max(0.1, initialDur + durChange);
      const { safeDuration } = getSafeTransitionDuration(fromClip, toClip, rawDur, trans.alignment || 'center');
      setTransDurationPreview((prev) => ({ ...prev, [trans.id]: safeDuration }));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTransDurationPreview((prev) => {
        const finalDur = prev[trans.id];
        if (finalDur !== undefined) {
          if (onTrimTransitionDuration) {
            onTrimTransitionDuration(trans.id, finalDur);
          } else if (updateTransition) {
            updateTransition(trans.id, { duration: finalDur });
          }
        }
        const { [trans.id]: _, ...rest } = prev;
        return rest;
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Handle dragging a clip along the track — supports multi-select, snap, vertical track switch, and batch move (single undo)
  const handleClipMouseDown = (clip: VideoClip, e: React.MouseEvent) => {
    if (e.button !== 0 || isLocked) return;
    onSelectClip(clip.id);

    const isMulti = selectedClipIds.includes(clip.id) && selectedClipIds.length > 1;
    const movingIds = isMulti ? [...selectedClipIds] : [clip.id];
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialMap = new Map<string, number>();
    for (const id of movingIds) {
      const c: any = trackClips.find((x) => x.id === id) || (clip.id === id ? clip : null);
      if (c) initialMap.set(id, c.timelineStart);
    }
    const mainInitial = initialMap.get(clip.id) ?? clip.timelineStart;
    let currentDelta = 0;
    let currentSnapX: number | null = null;
    let targetTrack = trackIndex;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const pps = sanitizeTime(pixelsPerSecond, 40);
      if (!isFinite(pps) || pps <= 0.5) return;
      const deltaX = moveEvent.clientX - startClientX;
      const deltaY = moveEvent.clientY - startClientY;
      const deltaSec = deltaX / pps;
      if (!isFinite(deltaSec)) return;

      // Vertical track movement (drag up to V2 or down to V1)
      if (trackIndex === 1 && deltaY < -24) {
        targetTrack = 2;
      } else if (trackIndex === 2 && deltaY > 24) {
        targetTrack = 1;
      } else {
        targetTrack = trackIndex;
      }

      let rawMainStart = Math.max(0, sanitizeTime(mainInitial, 0) + deltaSec);
      if (!isFinite(rawMainStart)) rawMainStart = mainInitial;
      let snapX: number | null = null;
      const snapThreshold = 6 / pps;
      // Snap candidates: 0, playhead, clip edges, markers
      const candidates: number[] = [0];
      try {
        if (isFinite(currentTime)) candidates.push(currentTime);
        for (const other of trackClips) {
          if (movingIds.includes(other.id)) continue;
          candidates.push(other.timelineStart);
          candidates.push(other.timelineStart + other.timelineDuration);
        }
        const ms: any[] = (project as any)?.markers || [];
        for (const m of ms) if (isFinite(m.time)) candidates.push(m.time);
      } catch {}
      const mainDur = clip.timelineDuration;
      // Snap start to candidate — magnet toggle + Alt bypass (consistent everywhere).
      const snapOn = isMagnetMode && !(moveEvent as MouseEvent).altKey;
      if (snapOn) {
        for (const cand of candidates) {
          if (Math.abs(rawMainStart - cand) < snapThreshold) { rawMainStart = cand; snapX = cand * pixelsPerSecond; break; }
          if (Math.abs(rawMainStart + mainDur - cand) < snapThreshold) { rawMainStart = Math.max(0, cand - mainDur); snapX = cand * pixelsPerSecond; break; }
        }
      }
      // Prevent moving main clip to negative via multi-select bounds check
      const minStart = Math.min(...Array.from(initialMap.values()));
      if (rawMainStart < 0) rawMainStart = 0;
      if (minStart + (rawMainStart - mainInitial) < 0) {
        rawMainStart = mainInitial - minStart;
        snapX = 0;
      }
      currentDelta = rawMainStart - mainInitial;
      setDraggingClipId(clip.id);
      setDragOffsetTime(rawMainStart);
      setSnapIndicatorX(snapX);
      currentSnapX = snapX;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setDraggingClipId(null);
      setSnapIndicatorX(null);
      if (Math.abs(currentDelta) > 0.02 || targetTrack !== trackIndex) {
        if (movingIds.length > 1 && batchMoveClips) {
          batchMoveClips(movingIds, Math.round(currentDelta * 100) / 100, targetTrack);
        } else if (onMoveClip) {
          const finalStart = Math.max(0, Math.round((mainInitial + currentDelta) * 100) / 100);
          onMoveClip(clip.id, finalStart, targetTrack);
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleContextMenu = (e: React.MouseEvent, clip: VideoClip) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectClip(clip.id);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      clip,
    });
  };

  return (
    <div
      style={{ width: `${totalWidth}px` }}
      onDragOver={isLocked ? undefined : handleTrackDragOver}
      onDragLeave={isLocked ? undefined : handleTrackDragLeave}
      onDrop={isLocked ? undefined : handleTrackDrop}
      className={`h-20 border-b border-canvas-border relative select-none flex-shrink-0 transition-colors ${
        isHidden ? 'opacity-40 grayscale-30' : ''
      } ${
        isDragOverTrack
          ? trackIndex === 2
            ? 'bg-amber-950/40 ring-1 ring-amber-400'
            : 'bg-cyan-950/40 ring-1 ring-cyan-400'
          : 'bg-[#141416]/40'
      }`}
    >
      {/* Drop Hint Badge when dragging footage */}
      {isDragOverTrack && !dragGhost && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-2xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-forge-cyan text-black font-bold text-xs shadow-lg">
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Drop footage onto Video Track V{trackIndex}</span>
          </div>
        </div>
      )}
      {/* Ghost clip preview — shows precise drop location, duration, insert behavior */}
      {dragGhost && isDragOverTrack && (
        <div
          style={{
            left: `${dragGhost.time * pixelsPerSecond}px`,
            width: `${Math.max(28, dragGhost.duration * pixelsPerSecond)}px`,
          }}
          className={`absolute top-1.5 bottom-1.5 rounded-lg border-2 border-dashed flex flex-col items-center justify-center z-25 pointer-events-none shadow-lg backdrop-blur-sm ${
            !dragGhost.valid
              ? 'bg-red-950/40 border-red-500 text-red-300'
              : isInvalidDrop
              ? 'bg-red-950/40 border-red-500 text-red-300'
              : 'bg-cyan-950/40 border-cyan-400 text-cyan-200'
          }`}
        >
          <span className="text-[10px] font-bold font-mono truncate px-1">
            {dragGhost.valid ? (isInvalidDrop ? 'Invalid Track' : `▸ ${dragGhost.label}`) : dragGhost.label}
          </span>
          <span className="text-[9px] font-mono opacity-80">
            @ {dragGhost.time.toFixed(2)}s • {dragGhost.duration.toFixed(1)}s
          </span>
        </div>
      )}
      {/* Invalid drop feedback */}
      {isInvalidDrop && isDragOverTrack && (
        <div className="absolute top-1 right-2 z-30 pointer-events-none">
          <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full"> ✕ Drop on Audio Track </span>
        </div>
      )}

      {/* Drop Feedback Toast (transitions, effects, invalid drops) */}
      {dropToast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] backdrop-blur-md border px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-[90%] ${
          dropToast.includes('Warning:') || dropToast.includes('Clip too short') || dropToast.includes('need an edit') || dropToast.includes('Insufficient')
            ? 'bg-amber-950/90 border-amber-600 text-amber-100'
            : 'bg-[#18181b]/95 border-forge-cyan text-white'
        }`}>
          {dropToast.includes('Warning:') || dropToast.includes('Clip too short') ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold truncate">{dropToast}</span>
          <button
            onClick={() => setDropToast(null)}
            className="ml-2 text-gray-400 hover:text-white text-xs font-bold flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Silence Detection Toast Notification */}
      {silenceToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-[#18181b]/95 backdrop-blur-md border border-forge-cyan text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Wand2 className="w-4 h-4 text-forge-cyan animate-pulse" />
          <span className="text-xs font-semibold">
            Removed <strong className="text-forge-cyan font-bold">{silenceToast.removedCount}</strong> silent pauses ({silenceToast.savedSeconds}s saved)
          </span>
          <button
            onClick={() => setSilenceToast(null)}
            className="ml-2 text-gray-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Render Gap Indicators when Magnet is OFF */}
      {gaps.map((gap, idx) => {
        const left = gap.start * pixelsPerSecond;
        const width = Math.max(20, gap.duration * pixelsPerSecond);

        return (
          <div
            key={`gap_${idx}_${gap.start}`}
            style={{ left: `${left}px`, width: `${width}px` }}
            className="absolute top-1.5 bottom-1.5 rounded-md border border-dashed border-gray-700/60 bg-black/40 flex items-center justify-center group overflow-hidden z-5"
            title={`Gap: ${gap.duration.toFixed(2)}s - Click to Close Gap`}
          >
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#6b7280_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseGap?.(trackIndex, gap.start);
              }}
              className="relative z-10 px-1.5 py-0.5 rounded bg-canvas-card/90 hover:bg-forge-purple border border-canvas-border text-[9px] font-mono text-gray-300 hover:text-white flex items-center gap-1 shadow transition-all group-hover:scale-105"
            >
              <span>Gap {gap.duration.toFixed(1)}s</span>
              <span className="text-forge-cyan group-hover:text-white font-bold">➔| Close</span>
            </button>
          </div>
        );
      })}

      {/* Magnet Snap Guide Line */}
      {snapIndicatorX !== null && (
        <div
          style={{ left: `${snapIndicatorX}px` }}
          className="absolute top-0 bottom-0 w-0.5 bg-forge-cyan shadow-[0_0_10px_rgba(6,182,212,0.9)] z-25 pointer-events-none"
        >
          <div className="w-2 h-2 bg-forge-cyan rotate-45 -translate-x-[3px] -translate-y-[1px] shadow-sm" />
          <div className="w-2 h-2 bg-forge-cyan rotate-45 -translate-x-[3px] translate-y-[-2px] absolute bottom-0" />
        </div>
      )}

      {/* Floating Live Trim HUD Overlay */}
      {activeTrimHud && (
        <div
          style={{ left: `${Math.max(10, activeTrimHud.x - 70)}px` }}
          className="absolute -top-7 z-40 bg-black/95 border border-forge-cyan text-white px-2 py-0.5 rounded-md shadow-2xl text-[10px] font-mono flex items-center gap-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
        >
          <span className="text-forge-cyan font-bold">
            {activeTrimHud.edge === 'left' ? 'IN' : 'OUT'}:
          </span>
          <span>{formatTimecode(activeTrimHud.inOutTime, true)}</span>
          <span className={activeTrimHud.deltaSec >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {activeTrimHud.deltaSec >= 0 ? `+${activeTrimHud.deltaSec.toFixed(2)}s` : `${activeTrimHud.deltaSec.toFixed(2)}s`}
          </span>
          <span className="opacity-40">|</span>
          <span className="opacity-80">Dur: {activeTrimHud.duration.toFixed(2)}s</span>
        </div>
      )}

      {/* Virtualized Clips Lane */}
      {trackClips
        .filter((clip) => {
          if (visibleStartSeconds === undefined || visibleEndSeconds === undefined) return true;
          const isSelected = clip.id === selectedClipId || (selectedClipIds && selectedClipIds.includes(clip.id));
          if (isSelected) return true;
          const preview = trimPreview[clip.id];
          const start = preview ? preview.timelineStart : clip.timelineStart;
          const end = start + (preview ? preview.timelineDuration : clip.timelineDuration);
          return end >= visibleStartSeconds && start <= visibleEndSeconds;
        })
        .map((clip) => {
        const isSelected = clip.id === selectedClipId || (selectedClipIds && selectedClipIds.includes(clip.id));
        const isDragging = clip.id === draggingClipId;
        const preview = trimPreview[clip.id];
        const effectiveStart = isDragging ? dragOffsetTime : (preview ? preview.timelineStart : clip.timelineStart);
        const left = effectiveStart * pixelsPerSecond;
        const displayDuration = preview ? preview.timelineDuration : clip.timelineDuration;
        const width = Math.max(30, displayDuration * pixelsPerSecond);
        const effectCount = clip.effects?.filter((e) => e.enabled).length || 0;
        const isBroll = (clip.trackIndex || 1) > 1;
        const peaks = clip.waveformPeaks || [];
        const isImage = (clip as any).mediaType === 'image' || isImageFile(clip.name) || isImageFile(clip.filePath || '');

        return (
          <div
            key={clip.id}
            onMouseDown={(e) => handleClipMouseDown(clip, e)}
            onContextMenu={(e) => handleContextMenu(e, clip)}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => handleDirectClipDrop(e, clip)}
            style={{
              left: `${left}px`,
              width: `${width}px`,
              zIndex: isDragging ? 35 : isSelected ? 20 : 10,
            }}
            className={`absolute top-1.5 bottom-1.5 rounded-lg border flex flex-col justify-between overflow-hidden transition-shadow group select-none ${
              isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
            } ${
              isDragging
                ? 'opacity-80 ring-2 ring-forge-cyan shadow-2xl scale-[1.01]'
                : isSelected
                ? isBroll
                  ? 'border-2 border-white ring-2 ring-amber-400/60 bg-[#1e1710] shadow-xl shadow-amber-950/60'
                  : 'border-2 border-white ring-2 ring-cyan-400/60 bg-[#0e1d24] shadow-xl shadow-cyan-950/60'
                : isBroll
                ? 'border-amber-500/40 bg-amber-950/30 hover:border-amber-400'
                : 'border-[#3f3f46]/80 bg-[#18181c] hover:border-gray-400'
            }`}
          >
            {/* Filmstrip background thumbnail */}
            {clip.thumbnailUrl && (
              <div
                style={{ backgroundImage: `url(${clip.thumbnailUrl})` }}
                className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
              />
            )}

            {/* Subtle Gradient Accent */}
            <div
              className={`absolute inset-0 pointer-events-none ${
                isBroll
                  ? 'bg-gradient-to-r from-amber-900/30 via-transparent to-amber-900/30'
                  : 'bg-gradient-to-r from-cyan-950/40 via-transparent to-cyan-950/40'
              }`}
            />

            {/* Top Tag Strip matching CapCut Screenshot 3: [Flvre into.mp4  00:00:49:28] */}
            <div className="relative z-10 flex items-center justify-between w-full">
              <div className={`flex items-center gap-1.5 border-b border-r px-2 py-0.5 rounded-br text-[10px] font-mono truncate max-w-[85%] shadow-xs ${isImage ? 'bg-violet-950/90 text-violet-200 border-violet-800/40' : 'bg-[#0b242a]/90 text-cyan-200 border-cyan-800/40'}`}>
                {isImage ? (
                  <ImageIcon className="w-3 h-3 text-violet-400 flex-shrink-0" />
                ) : isBroll ? (
                  <Layers className="w-3 h-3 text-forge-amber flex-shrink-0" />
                ) : (
                  <Film className="w-3 h-3 text-forge-cyan flex-shrink-0" />
                )}
                <span className="font-bold truncate">{clip.name}</span>
                <span className={`font-bold ml-1 ${isImage ? 'text-violet-300' : 'text-cyan-400'}`}>
                  {formatTimecode(clip.timelineDuration, true)}
                </span>
                {isImage && <span className="text-[8px] bg-violet-600 text-white px-1 rounded font-bold ml-1">IMG {clip.timelineDuration.toFixed(1)}s</span>}
              </div>

              <div className="flex items-center gap-1 pr-1.5 pt-0.5 text-[10px] text-gray-300 flex-shrink-0">
                {/* Active Effects Badge */}
                {effectCount > 0 && (
                  <span className="bg-forge-cyan/30 text-forge-cyan border border-forge-cyan/50 px-1 rounded font-mono font-bold text-[9px] flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>fx {effectCount}</span>
                  </span>
                )}

                {/* Speed Badge */}
                {clip.speed && clip.speed !== 1.0 && (
                  <span className="bg-black/60 px-1 rounded text-[9px] font-mono text-forge-amber font-bold">
                    {clip.speed}x
                  </span>
                )}

                {/* Mute status */}
                {(clip.isMuted || isMuted) && (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/40 px-1 rounded text-[9px] flex items-center gap-0.5 font-bold">
                    <VolumeX className="w-2.5 h-2.5" />
                    <span>Muted</span>
                  </span>
                )}
              </div>
            </div>

            {/* Bottom: Image indicator or Waveform */}
            {isImage ? (
              <div className="relative z-10 w-full h-5 bg-violet-950/40 border-t border-violet-800/40 px-1 flex items-center justify-between overflow-hidden">
                <span className="text-[9px] font-bold text-violet-300 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> IMAGE • {formatTimecode(clip.timelineDuration, true)} • HOLD
                </span>
                <span className="text-[8px] font-mono text-violet-400">{clip.width}×{clip.height}</span>
              </div>
            ) : (
              !clip.isMuted && !isMuted && (
                <div className="relative z-10 w-full h-5 bg-[#06181d]/85 border-t border-cyan-950/60 px-1 flex items-end overflow-hidden">
                  {peaks.length > 0 ? (
                    <div className="w-full h-full flex items-end gap-[1px]">
                      {peaks.map((peak, pIdx) => {
                        const barHeight = Math.max(12, Math.round(peak * 100));
                        return (
                          <div
                            key={`peak_${pIdx}`}
                            style={{ height: `${barHeight}%` }}
                            className="flex-1 min-w-[1.5px] max-w-[4px] bg-forge-cyan/90 rounded-t-xs"
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-cyan-600 font-mono">
                      <span>AUDIO</span>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Timed effect bars — drag to move, edges to resize (real NLE objects) */}
            <EffectStrip clip={clip} pixelsPerSecond={pixelsPerSecond} isLocked={isLocked} onSelectClip={onSelectClip} />

            {/* Visual Diamond Keyframe Markers Ribbon */}
            <TimelineKeyframeRibbon
              clip={clip}
              currentTime={currentTime}
              pixelsPerSecond={pixelsPerSecond}
              onSelectKeyframeTime={setCurrentTime}
            />

            {/* Left Trim Handle — CapCut-Style in-point trimming */}
            {!isLocked && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSelectClip(clip.id);
                  const startX = e.clientX;
                  let latestTrim: ReturnType<typeof calculateTrimUpdate> | null = null;
                  const fps = clip.fps || 30;
                  const isImg = (clip as any).mediaType === 'image' || isImageFile(clip.name) || isImageFile(clip.filePath || '');

                  // Snap candidates: playhead, markers, other clip edges
                  const snapCandidates: number[] = [0];
                  if (isFinite(currentTime)) snapCandidates.push(currentTime);
                  for (const other of clips) {
                    if (other.id === clip.id) continue;
                    snapCandidates.push(other.timelineStart);
                    snapCandidates.push(other.timelineStart + other.timelineDuration);
                  }
                  const allMarkers: any[] = (project as any)?.markers || [];
                  for (const m of allMarkers) if (isFinite(m.time)) snapCandidates.push(m.time);

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const pps2 = sanitizeTime(pixelsPerSecond, 40);
                    if (!isFinite(pps2) || pps2 <= 0.5) return;
                    const deltaSec = deltaX / pps2;
                    if (!isFinite(deltaSec)) return;

                    const updated = calculateTrimUpdate(clip, 'left', deltaSec, {
                      fps,
                      isImage: isImg,
                      snapCandidates: isMagnetMode ? snapCandidates : undefined,
                      snapThresholdTimeline: 8 / pps2,
                    });
                    latestTrim = updated;
                    setTrimPreview((prev) => ({ ...prev, [clip.id]: updated }));
                    if (updated.snapped && updated.snapPoint !== undefined) {
                      setSnapIndicatorX(updated.snapPoint * pps2);
                    } else {
                      setSnapIndicatorX(null);
                    }
                    if (setCurrentTime && isFinite(updated.effectiveCurrentCutTime)) {
                      setCurrentTime(updated.effectiveCurrentCutTime);
                    }
                    setActiveTrimHud({
                      clipId: clip.id,
                      edge: 'left',
                      deltaSec: updated.deltaSecondsTimeline,
                      inOutTime: updated.startOffset,
                      duration: updated.timelineDuration,
                      x: updated.timelineStart * pps2,
                    });
                  };

                  const handleMouseUp = () => {
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);
                    setTrimPreview((prev) => {
                      const { [clip.id]: _, ...rest } = prev;
                      return rest;
                    });
                    setSnapIndicatorX(null);
                    setActiveTrimHud(null);
                    if (
                      latestTrim &&
                      (Math.abs(latestTrim.startOffset - clip.startOffset) > 0.005 ||
                        Math.abs(latestTrim.timelineStart - clip.timelineStart) > 0.005 ||
                        Math.abs(latestTrim.endOffset - clip.endOffset) > 0.005)
                    ) {
                      onTrimClip(clip.id, latestTrim.startOffset, latestTrim.endOffset, latestTrim.timelineStart);
                    }
                  };

                  window.addEventListener('mousemove', handleMouseMove);
                  window.addEventListener('mouseup', handleMouseUp);
                }}
                className={`absolute left-0 top-0 bottom-0 w-3 hover:w-3.5 transition-all cursor-ew-resize z-30 flex items-center justify-center rounded-l select-none ${
                  trimPreview[clip.id]
                    ? 'bg-forge-cyan opacity-100 ring-2 ring-forge-cyan'
                    : 'bg-black/75 hover:bg-forge-cyan opacity-0 group-hover:opacity-100'
                }`}
                title="Trim In-Point (drag left/right to adjust start without altering source media)"
              >
                <div className="w-0.5 h-6 bg-white/90 rounded-full" />
              </div>
            )}

            {/* Right Trim Handle — CapCut-Style out-point trimming */}
            {!isLocked && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSelectClip(clip.id);
                  const startX = e.clientX;
                  let latestTrim: ReturnType<typeof calculateTrimUpdate> | null = null;
                  const fps = clip.fps || 30;
                  const isImg = (clip as any).mediaType === 'image' || isImageFile(clip.name) || isImageFile(clip.filePath || '');

                  // Snap candidates: playhead, markers, other clip edges
                  const snapCandidates: number[] = [0];
                  if (isFinite(currentTime)) snapCandidates.push(currentTime);
                  for (const other of clips) {
                    if (other.id === clip.id) continue;
                    snapCandidates.push(other.timelineStart);
                    snapCandidates.push(other.timelineStart + other.timelineDuration);
                  }
                  const allMarkers: any[] = (project as any)?.markers || [];
                  for (const m of allMarkers) if (isFinite(m.time)) snapCandidates.push(m.time);

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const pps2 = sanitizeTime(pixelsPerSecond, 40);
                    if (!isFinite(pps2) || pps2 <= 0.5) return;
                    const deltaSec = deltaX / pps2;
                    if (!isFinite(deltaSec)) return;

                    const updated = calculateTrimUpdate(clip, 'right', deltaSec, {
                      fps,
                      isImage: isImg,
                      snapCandidates: isMagnetMode ? snapCandidates : undefined,
                      snapThresholdTimeline: 8 / pps2,
                    });
                    latestTrim = updated;
                    setTrimPreview((prev) => ({ ...prev, [clip.id]: updated }));
                    if (updated.snapped && updated.snapPoint !== undefined) {
                      setSnapIndicatorX(updated.snapPoint * pps2);
                    } else {
                      setSnapIndicatorX(null);
                    }
                    if (setCurrentTime && isFinite(updated.effectiveCurrentCutTime)) {
                      setCurrentTime(updated.effectiveCurrentCutTime);
                    }
                    setActiveTrimHud({
                      clipId: clip.id,
                      edge: 'right',
                      deltaSec: updated.deltaSecondsTimeline,
                      inOutTime: updated.endOffset,
                      duration: updated.timelineDuration,
                      x: (updated.timelineStart + updated.timelineDuration) * pps2,
                    });
                  };

                  const handleMouseUp = () => {
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);
                    setTrimPreview((prev) => {
                      const { [clip.id]: _, ...rest } = prev;
                      return rest;
                    });
                    setSnapIndicatorX(null);
                    setActiveTrimHud(null);
                    if (
                      latestTrim &&
                      (Math.abs(latestTrim.endOffset - clip.endOffset) > 0.005 ||
                        Math.abs(latestTrim.startOffset - clip.startOffset) > 0.005)
                    ) {
                      onTrimClip(clip.id, latestTrim.startOffset, latestTrim.endOffset, latestTrim.timelineStart);
                    }
                  };

                  window.addEventListener('mousemove', handleMouseMove);
                  window.addEventListener('mouseup', handleMouseUp);
                }}
                className={`absolute right-0 top-0 bottom-0 w-3 hover:w-3.5 transition-all cursor-ew-resize z-30 flex items-center justify-center rounded-r select-none ${
                  trimPreview[clip.id]
                    ? 'bg-forge-cyan opacity-100 ring-2 ring-forge-cyan'
                    : 'bg-black/75 hover:bg-forge-cyan opacity-0 group-hover:opacity-100'
                }`}
                title="Trim Out-Point (drag left/right to adjust end without altering source media)"
              >
                <div className="w-0.5 h-6 bg-white/90 rounded-full" />
              </div>
            )}
          </div>
        );
      })}

      {/* Render Transition Blocks on cuts */}
      {transitions.map((trans) => {
        const transClip = trackClips.find((c) => c.id === trans.fromClipId || c.id === trans.toClipId);
        if (!transClip) return null;

        const effectiveDur = transDurationPreview[trans.id] ?? trans.duration;
        const left = trans.timelineStart * pixelsPerSecond;
        const width = Math.max(22, effectiveDur * pixelsPerSecond);
        const isSelected = trans.id === selectedTransitionId;

        return (
          <div
            key={trans.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTransition?.(trans.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSelectTransition?.(trans.id);
              setActiveSidebarTab('transitions');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectTransition?.(trans.id);
              setTransContextMenu({ x: e.clientX, y: e.clientY, trans });
            }}
            style={{
              left: `${left - width / 2}px`,
              width: `${width}px`,
            }}
            className={`group absolute top-1.5 bottom-1.5 rounded-md bg-forge-amber border flex items-center justify-between px-1 cursor-pointer z-20 transition-all select-none shadow-md ${
              isSelected
                ? 'border-white ring-2 ring-forge-amber shadow-lg text-black font-bold'
                : 'border-amber-600 text-black/90 hover:bg-amber-400'
            }`}
            title={`Transition: ${trans.name} (${effectiveDur.toFixed(2)}s) • Double-click to configure • Drag handles to adjust`}
          >
            {/* Left duration resize handle */}
            {!isLocked && (
              <div
                onMouseDown={(e) => handleTransitionResize(trans, 'left', e)}
                className="absolute left-0 top-0 bottom-0 w-2.5 bg-black/30 hover:bg-black/70 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-l z-30"
                title="Trim transition duration"
              />
            )}

            <div className="flex items-center gap-0.5 text-[9px] font-bold truncate px-1 pointer-events-none mx-auto">
              <span>⧓</span>
              <span className="truncate">{trans.name}</span>
              <span className="text-[8px] opacity-75 font-mono ml-0.5">{effectiveDur.toFixed(1)}s</span>
            </div>

            {/* Right duration resize handle */}
            {!isLocked && (
              <div
                onMouseDown={(e) => handleTransitionResize(trans, 'right', e)}
                className="absolute right-0 top-0 bottom-0 w-2.5 bg-black/30 hover:bg-black/70 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r z-30"
                title="Trim transition duration"
              />
            )}
          </div>
        );
      })}

      {/* Right-Click CapCut Context Menu Modal — Quick Actions (Features 07,09,14,15,26,32) */}
      {contextMenu && (
        <ClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipId={contextMenu.clip.id}
          clipName={contextMenu.clip.name}
          isMuted={contextMenu.clip.isMuted}
          onClose={() => setContextMenu(null)}
          onCopy={() => copyClip(contextMenu.clip.id)}
          onCut={() => cutClip(contextMenu.clip.id)}
          onDelete={() => deleteClip(contextMenu.clip.id)}
          onDuplicate={() => duplicateClip(contextMenu.clip.id)}
          onSplit={() => splitClipAtPlayhead()}
          onSplitScenes={() => setSceneModalClip(contextMenu.clip)}
          onExtractAudio={() => extractAudioFromClip(contextMenu.clip.id)}
          onRemoveSilence={() => {
            const res = removeSilencesFromClip(contextMenu.clip.id);
            if (res.removedCount > 0) {
              setSilenceToast(res);
              setTimeout(() => setSilenceToast(null), 5000);
            }
          }}
          onEnhanceAudio={() => enhanceAudioClip(contextMenu.clip.id)}
          onEnhanceVisuals={() => enhanceVideoClipVisuals(contextMenu.clip.id)}
          onAdjustColor={() => {
            onSelectClip(contextMenu.clip.id);
            setActiveSidebarTab('effects');
          }}
          onToggleMute={() => toggleClipMute(contextMenu.clip.id)}
          onGenerateCaptions={() => setShowAutoCaptionModal(true)}
          onFreeze={() => freezeFrameAtPlayhead()}
          onReverse={() => reverseClip(contextMenu.clip.id)}
          onCopyAttributes={() => copyClipAttributes(contextMenu.clip.id)}
          onPasteAttributes={() => pasteClipAttributes([contextMenu.clip.id])}
          onCreateCompound={() => {
            const sel = (selectedClipIds && selectedClipIds.length >= 2) ? selectedClipIds : [contextMenu.clip.id];
            if (sel.length === 1) {
              const idx = trackClips.findIndex((c) => c.id === contextMenu.clip.id);
              const nxt = trackClips[idx + 1];
              if (nxt) sel.push(nxt.id);
            }
            if (sel.length >= 2) createCompoundClip(sel);
          }}
          onReplaceMedia={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*,audio/*';
            input.onchange = (e: any) => {
              const file = e.target.files?.[0];
              if (file) replaceClipMedia(contextMenu.clip.id, file);
            };
            input.click();
          }}
          onAddMarker={() => addMarker({ time: contextMenu.clip.timelineStart, name: `Marker: ${contextMenu.clip.name.slice(0, 16)}`, color: 'amber', type: 'note' })}
          onToggleDeactivate={() => toggleClipMute(contextMenu.clip.id)}
          onExportClip={() => {
            onSelectClip(contextMenu.clip.id);
            const exportBtn = document.getElementById('export-button') || document.querySelector('[title*="Export"]');
            if (exportBtn) (exportBtn as HTMLElement).click();
          }}
        />
      )}

      {/* Intelligent Scene Detection Modal */}
      {sceneModalClip && (
        <SceneDetectionModal
          clip={sceneModalClip}
          onClose={() => setSceneModalClip(null)}
        />
      )}

      {/* Multilingual AI Auto-Caption Modal */}
      <AutoCaptionModal
        isOpen={showAutoCaptionModal}
        onClose={() => setShowAutoCaptionModal(false)}
      />

      {/* Transition Context Menu */}
      {transContextMenu && (
        <div
          className="fixed z-50 bg-[#1e1e24] border border-[#3f3f46] rounded-xl shadow-2xl p-1.5 text-xs text-gray-200 min-w-[160px]"
          style={{ top: `${transContextMenu.y}px`, left: `${transContextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-bold text-gray-400 border-b border-[#27272a] mb-1 truncate">
            {transContextMenu.trans.name}
          </div>
          <div className="px-2 py-1 text-[10px] text-gray-400 font-semibold">Duration:</div>
          <div className="grid grid-cols-3 gap-1 px-1 mb-1">
            {[0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map((d) => (
              <button
                key={d}
                onClick={() => {
                  if (onTrimTransitionDuration) {
                    onTrimTransitionDuration(transContextMenu.trans.id, d);
                  } else if (updateTransition) {
                    updateTransition(transContextMenu.trans.id, { duration: d });
                  }
                  setTransContextMenu(null);
                }}
                className={`px-1.5 py-1 rounded text-[10px] font-mono text-center hover:bg-[#27272a] cursor-pointer ${
                  Math.abs(transContextMenu.trans.duration - d) < 0.05 ? 'bg-amber-500 text-black font-bold' : 'text-gray-300'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (deleteTransition) deleteTransition(transContextMenu.trans.id);
              setTransContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-950/60 text-red-400 text-left transition-colors cursor-pointer mt-1"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Remove Transition</span>
          </button>
        </div>
      )}

      {/* Dismiss transition context menu when clicking outside */}
      {transContextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setTransContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setTransContextMenu(null);
          }}
        />
      )}
    </div>
  );
});
