import React, { useState } from 'react';
import { AudioClip } from '../../types/project';
import { Volume2, VolumeX, Music } from 'lucide-react';
import { AudioClipContextMenu } from './AudioClipContextMenu';
import { formatTimecode, sanitizeTime } from '../../utils/timecode';
import { useProject } from '../../context/ProjectContext';
import { calculateTrimUpdate } from '../../hooks/useClipTrim';
import { getDragPayload, clearDragPayload } from '../../utils/nleDnD';

interface AudioTrackProps {
  audioClips: AudioClip[];
  selectedAudioClipId: string | null;
  selectedAudioClipIds?: string[];
  pixelsPerSecond: number;
  totalWidth: number;
  trackIndex?: number;
  isLocked?: boolean;
  isMuted?: boolean;
  isMagnetMode?: boolean;
  onSelectAudioClip: (id: string) => void;
  onTrimAudioClip: (id: string, startOffset: number, endOffset: number, timelineStart?: number) => void;
  onDeleteAudioClip?: (id: string) => void;
  onDuplicateAudioClip?: (id: string) => void;
  onSplitAudioClip?: () => void;
  onRemoveSilenceAudioClip?: (id: string) => void;
  onEnhanceAudioClip?: (id: string) => void;
  onToggleMuteAudioClip?: (id: string) => void;
  onSetVolumeAudioClip?: (id: string, volume: number) => void;
  onCopyAudioClip?: (id: string) => void;
  onCutAudioClip?: (id: string) => void;
  onMoveAudioClip?: (id: string, newStart: number, targetTrackIndex?: number) => void;
  visibleStartSeconds?: number;
  visibleEndSeconds?: number;
}

export const AudioTrack: React.FC<AudioTrackProps> = React.memo(({
  audioClips = [],
  selectedAudioClipId,
  selectedAudioClipIds = [],
  pixelsPerSecond,
  totalWidth,
  trackIndex = 1,
  isLocked = false,
  isMuted = false,
  isMagnetMode = true,
  visibleStartSeconds,
  visibleEndSeconds,
  onSelectAudioClip,
  onTrimAudioClip,
  onDeleteAudioClip,
  onDuplicateAudioClip,
  onSplitAudioClip,
  onRemoveSilenceAudioClip,
  onEnhanceAudioClip,
  onToggleMuteAudioClip,
  onSetVolumeAudioClip,
  onCopyAudioClip,
  onCutAudioClip,
  onMoveAudioClip,
}) => {
  const { project, currentTime, setCurrentTime, appendAudioClipToTimeline } = useProject() as any;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clip: AudioClip;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragGhost, setDragGhost] = useState<{ time: number; duration: number; valid: boolean; label: string } | null>(null);
  const [isInvalid, setIsInvalid] = useState(false);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragOffsetTime, setDragOffsetTime] = useState<number>(0);
  const [snapIndicatorX, setSnapIndicatorX] = useState<number | null>(null);
  const [trimPreview, setTrimPreview] = useState<Record<string, { startOffset: number; endOffset: number; timelineStart: number; timelineDuration: number }>>({});
  const [activeTrimHud, setActiveTrimHud] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    deltaSec: number;
    inOutTime: number;
    duration: number;
    x: number;
  } | null>(null);

  const trackClips = audioClips.filter((c) => (c.trackIndex || 1) === trackIndex);

  // Handle dragging an audio clip along the track with snapping and frame accuracy
  const handleClipMouseDown = (clip: AudioClip, e: React.MouseEvent) => {
    if (e.button !== 0 || isLocked) return;
    onSelectAudioClip(clip.id);

    const startClientX = e.clientX;
    const initialStart = clip.timelineStart;
    let currentDelta = 0;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const pps = sanitizeTime(pixelsPerSecond, 40);
      if (!isFinite(pps) || pps <= 0.5) return;
      const deltaX = moveEvent.clientX - startClientX;
      const deltaSec = deltaX / pps;
      if (!isFinite(deltaSec)) return;

      let rawStart = Math.max(0, initialStart + deltaSec);
      let snapX: number | null = null;
      const snapThreshold = 6 / pps;

      // Snap candidates: 0, playhead, clip edges
      const candidates: number[] = [0];
      try {
        if (isFinite(currentTime)) candidates.push(currentTime);
        for (const other of trackClips) {
          if (other.id === clip.id) continue;
          candidates.push(other.timelineStart);
          candidates.push(other.timelineStart + other.timelineDuration);
        }
      } catch {}

      // Magnet toggle + Alt bypass (consistent with video tracks).
      if (isMagnetMode && !(moveEvent as MouseEvent).altKey) {
        for (const cand of candidates) {
          if (Math.abs(rawStart - cand) < snapThreshold) {
            rawStart = cand;
            snapX = cand * pps;
            break;
          }
          if (Math.abs(rawStart + clip.timelineDuration - cand) < snapThreshold) {
            rawStart = Math.max(0, cand - clip.timelineDuration);
            snapX = cand * pps;
            break;
          }
        }
      }

      currentDelta = rawStart - initialStart;
      setDraggingClipId(clip.id);
      setDragOffsetTime(rawStart);
      setSnapIndicatorX(snapX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setDraggingClipId(null);
      setSnapIndicatorX(null);
      if (Math.abs(currentDelta) > 0.02 && onMoveAudioClip) {
        const finalStart = Math.max(0, Math.round((initialStart + currentDelta) * 100) / 100);
        onMoveAudioClip(clip.id, finalStart, trackIndex);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const getPayload = (e?: React.DragEvent | null): any => {
    try {
      const p = getDragPayload(e as any);
      if (p) return p;
    } catch {}
    return null;
  };

  const handleContextMenu = (e: React.MouseEvent, clip: AudioClip) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectAudioClip(clip.id);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      clip,
    });
  };

  const handleAudioDragOver = (e: React.DragEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
    let payload: any = null;
    try { payload = getDragPayload(e as any); } catch {}
    if (!payload) payload = getPayload();
    const isVideoPayload = payload && payload.type === 'footage';
    if (isVideoPayload) {
      setIsInvalid(true);
      setDragGhost({ time: 0, duration: 0, valid: false, label: 'Video → use Video Track' });
      return;
    }
    setIsInvalid(false);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    let rawTime = Math.max(0, rawX / pixelsPerSecond);
    if (!isFinite(rawTime)) rawTime = 0;
    // Snap to playhead / clip edges
    const snapThreshold = 8 / Math.max(10, pixelsPerSecond);
    let snapTime = rawTime;
    let snapped = false;
    const cand: number[] = [];
    try {
      if (isFinite(currentTime)) cand.push(currentTime);
    } catch {}
    try {
      for (const c of trackClips) { cand.push(c.timelineStart); cand.push(c.timelineStart + c.timelineDuration); }
      const allMarkers: any[] = (project as any)?.markers || [];
      for (const m of allMarkers) if (isFinite(m.time)) cand.push(m.time);
      const pt = (window as any).__cf_playhead;
      if (isFinite(pt)) cand.push(pt);
    } catch {}
    let best = rawTime; let bestDist = snapThreshold + 1;
    for (const c of cand) { const d = Math.abs(rawTime - c); if (d < bestDist) { bestDist = d; best = c; } }
    if (isMagnetMode && !(e as any).altKey && bestDist <= snapThreshold) { snapTime = best; snapped = true; }
    let ghostDur = 5;
    if (payload && payload.clip && isFinite(payload.clip.duration)) ghostDur = payload.clip.duration;
    else if (payload && payload.clip && isFinite(payload.clip.timelineDuration)) ghostDur = payload.clip.timelineDuration;
    const fps = 30; const frameDur = 1 / fps;
    ghostDur = Math.max(0.2, Math.round(ghostDur / frameDur) * frameDur);
    snapTime = Math.round(snapTime / frameDur) * frameDur;
    snapTime = Math.max(0, Math.round(snapTime * 1000) / 1000);
    setDragGhost({ time: snapTime, duration: ghostDur, valid: true, label: snapped ? 'Snap' : `Insert ${ghostDur.toFixed(1)}s` });
  };

  const handleAudioDragLeave = () => { setIsDragOver(false); setDragGhost(null); setIsInvalid(false); };

  const handleAudioDrop = (e: React.DragEvent) => {
    if (isLocked) return;
    e.preventDefault();
    setIsDragOver(false);
    setDragGhost(null);
    setIsInvalid(false);
    try { clearDragPayload(); } catch {}
    // OS file drops onto audio track
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      let dropTime = Math.max(0, dropX / pixelsPerSecond);
      const fpsF = 30; const frameDurF = 1 / fpsF;
      dropTime = Math.round(dropTime / frameDurF) * frameDurF;
      dropTime = Math.max(0, Math.round(dropTime * 1000) / 1000);
      for (const f of Array.from(e.dataTransfer.files)) {
        const name = (f as File).name || '';
        const isAudio = /\.(mp3|wav|aac|m4a|ogg|flac|wma|opus)$/i.test(name) || (f as File).type.startsWith('audio/');
        if (!isAudio) continue;
        (async () => {
          try {
            const { extractMediaMetadata } = await import('../../utils/mediaLoader');
            const meta: any = await extractMediaMetadata(f as File);
            const clip: any = { name: meta.name, filePath: meta.filePath, mediaBlobUrl: meta.url, duration: meta.duration, waveformPeaks: meta.waveformPeaks, timelineDuration: meta.duration };
            if (appendAudioClipToTimeline) appendAudioClipToTimeline(clip, trackIndex, dropTime);
          } catch {}
        })();
      }
      return;
    }
    let data: any = null;
    try { data = getDragPayload(e as any); } catch {}
    if (!data) data = getPayload();
    try { clearDragPayload(); } catch {}
    if (!data) return;
    if (data.type === 'footage') {
      return;
    }
    if (data.type === 'audio' && data.clip) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      let dropTime = Math.max(0, dropX / pixelsPerSecond);
      const fps2 = 30; const frameDur2 = 1 / fps2;
      const snapThreshold = 8 / Math.max(10, pixelsPerSecond);
      const cand: number[] = [];
      for (const c of trackClips) { cand.push(c.timelineStart); cand.push(c.timelineStart + c.timelineDuration); }
      let best = dropTime; let bestDist = snapThreshold + 1;
      for (const candT of cand) { const d = Math.abs(dropTime - candT); if (d < bestDist) { bestDist = d; best = candT; } }
      if (isMagnetMode && !(e as any).altKey && bestDist <= snapThreshold) dropTime = best;
      dropTime = Math.round(dropTime / frameDur2) * frameDur2;
      dropTime = Math.max(0, Math.round(dropTime * 1000) / 1000);
      if (appendAudioClipToTimeline) appendAudioClipToTimeline(data.clip, trackIndex, dropTime);
    }
  };

  return (
    <div
      style={{ width: `${totalWidth}px` }}
      onDragOver={isLocked ? undefined : handleAudioDragOver}
      onDragLeave={isLocked ? undefined : handleAudioDragLeave}
      onDrop={isLocked ? undefined : handleAudioDrop}
      className={`h-12 bg-canvas-card/30 border-b border-canvas-border relative select-none flex-shrink-0 flex items-center ${isDragOver ? (isInvalid ? 'bg-red-950/30 ring-1 ring-red-500' : 'bg-cyan-950/30 ring-1 ring-cyan-400') : ''}`}
    >
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

      {/* Ghost for audio drop */}
      {isDragOver && dragGhost && (
        <div
          style={{ left: `${dragGhost.time * pixelsPerSecond}px`, width: `${Math.max(28, dragGhost.duration * pixelsPerSecond)}px` }}
          className={`absolute top-1 bottom-1 rounded-lg border-2 border-dashed flex flex-col items-center justify-center z-20 pointer-events-none ${!dragGhost.valid || isInvalid ? 'bg-red-950/40 border-red-500 text-red-300' : 'bg-cyan-950/40 border-cyan-400 text-cyan-200'}`}
        >
          <span className="text-[10px] font-bold font-mono">{dragGhost.valid ? `▸ ${dragGhost.label}` : dragGhost.label}</span>
        </div>
      )}
      {isDragOver && isInvalid && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-black/30">
          <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">✕ Audio track only</span>
        </div>
      )}
      {trackClips
        .filter((clip) => {
          if (visibleStartSeconds === undefined || visibleEndSeconds === undefined) return true;
          const isSelected = clip.id === selectedAudioClipId || selectedAudioClipIds.includes(clip.id);
          if (isSelected) return true;
          const preview = trimPreview[clip.id];
          const start = preview ? preview.timelineStart : clip.timelineStart;
          const end = start + (preview ? preview.timelineDuration : clip.timelineDuration);
          return end >= visibleStartSeconds && start <= visibleEndSeconds;
        })
        .map((clip) => {
        const isSelected = clip.id === selectedAudioClipId || selectedAudioClipIds.includes(clip.id);
        const isDragging = draggingClipId === clip.id;
        const preview = trimPreview[clip.id];
        const effectiveStart = isDragging ? dragOffsetTime : (preview ? preview.timelineStart : clip.timelineStart);
        const displayDuration = preview ? preview.timelineDuration : clip.timelineDuration;
        const left = effectiveStart * pixelsPerSecond;
        const width = Math.max(30, displayDuration * pixelsPerSecond);
        const peaks = clip.waveformPeaks || [];
        const isCurrentlyMuted = clip.isMuted || isMuted;

        return (
          <div
            key={clip.id}
            onMouseDown={(e) => handleClipMouseDown(clip, e)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAudioClip(clip.id);
            }}
            onContextMenu={(e) => handleContextMenu(e, clip)}
            style={{
              left: `${left}px`,
              width: `${width}px`,
            }}
            className={`absolute top-1 bottom-1 rounded-md border flex flex-col justify-between overflow-hidden cursor-pointer transition-shadow group ${
              isSelected
                ? 'border-forge-cyan bg-cyan-950/60 shadow-md shadow-cyan-950/60 ring-1 ring-forge-cyan'
                : 'border-canvas-border bg-canvas-card/85 hover:border-gray-500'
            }`}
          >
            {/* Audio Clip Info Header */}
            <div className="px-2 pt-0.5 flex items-center justify-between text-[10px] text-gray-300 relative z-10">
              <div className="flex items-center gap-1 truncate">
                <Music className="w-2.5 h-2.5 text-forge-cyan flex-shrink-0" />
                <span className="font-semibold truncate">{clip.name}</span>
              </div>

              <div className="flex items-center gap-1 font-mono text-[9px] text-gray-400">
                {isCurrentlyMuted ? (
                  <span className="text-red-400 font-bold flex items-center gap-0.5">
                    <VolumeX className="w-2.5 h-2.5" /> MUTE
                  </span>
                ) : (
                  <span>{Math.round((clip.volume ?? 1.0) * 100)}%</span>
                )}
              </div>
            </div>

            {/* Waveform Visualization Bars */}
            <div className="flex-1 flex items-center gap-[1px] px-1 pb-0.5">
              {peaks.length > 0 ? (
                peaks.map((peak, idx) => {
                  const gainHeight = Math.min(100, Math.max(12, peak * 90 * (clip.volume ?? 1.0)));
                  return (
                    <div
                      key={idx}
                      style={{
                        height: `${gainHeight}%`,
                        backgroundColor: isCurrentlyMuted
                          ? 'rgba(156, 163, 175, 0.3)'
                          : isSelected
                          ? 'rgba(6, 182, 212, 0.9)'
                          : `rgba(6, 182, 212, ${0.4 + peak * 0.6})`,
                      }}
                      className="flex-1 min-w-[2px] rounded-full"
                    />
                  );
                })
              ) : (
                <div className="w-full flex items-center justify-center text-[9px] text-gray-500 italic">
                  Audio Track
                </div>
              )}
            </div>

            {/* Start Trim Handle (In-Point) */}
            {!isLocked && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSelectAudioClip(clip.id);
                  const startX = e.clientX;
                  let latestTrim: ReturnType<typeof calculateTrimUpdate> | null = null;
                  const fps = 30;

                  // Snap candidates
                  const snapCandidates: number[] = [0];
                  if (isFinite(currentTime)) snapCandidates.push(currentTime);
                  for (const other of audioClips) {
                    if (other.id === clip.id) continue;
                    snapCandidates.push(other.timelineStart);
                    snapCandidates.push(other.timelineStart + other.timelineDuration);
                  }
                  const allMarkers: any[] = (project as any)?.markers || [];
                  for (const m of allMarkers) if (isFinite(m.time)) snapCandidates.push(m.time);

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const pps2 = sanitizeTime(pixelsPerSecond, 40);
                    if (!isFinite(pps2) || pps2 <= 0.5) return;
                    const deltaX = moveEvent.clientX - startX;
                    const deltaSec = deltaX / pps2;
                    if (!isFinite(deltaSec)) return;

                    const updated = calculateTrimUpdate(
                      {
                        timelineStart: clip.timelineStart,
                        timelineDuration: clip.timelineDuration,
                        startOffset: clip.startOffset,
                        endOffset: clip.endOffset,
                        duration: clip.duration,
                        speed: (clip as any).speed || 1.0,
                        fps,
                      },
                      'left',
                      deltaSec,
                      {
                        fps,
                        snapCandidates,
                        snapThresholdTimeline: 8 / pps2,
                      }
                    );

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
                      onTrimAudioClip(clip.id, latestTrim.startOffset, latestTrim.endOffset, latestTrim.timelineStart);
                    }
                  };

                  window.addEventListener('mousemove', handleMouseMove);
                  window.addEventListener('mouseup', handleMouseUp);
                }}
                className={`absolute left-0 top-0 bottom-0 w-2.5 hover:w-3.5 transition-all cursor-ew-resize opacity-0 group-hover:opacity-100 rounded-l flex items-center justify-center z-20 ${
                  trimPreview[clip.id]
                    ? 'bg-forge-cyan opacity-100 ring-2 ring-forge-cyan'
                    : 'bg-forge-cyan/70 hover:bg-forge-cyan'
                }`}
                title="Trim audio start (drag left/right to adjust start without altering source file)"
              >
                <div className="w-[1.5px] h-3.5 bg-black/90 rounded" />
              </div>
            )}

            {/* End Trim Handle (Out-Point) */}
            {!isLocked && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSelectAudioClip(clip.id);
                  const startX = e.clientX;
                  let latestTrim: ReturnType<typeof calculateTrimUpdate> | null = null;
                  const fps = 30;

                  // Snap candidates
                  const snapCandidates: number[] = [0];
                  if (isFinite(currentTime)) snapCandidates.push(currentTime);
                  for (const other of audioClips) {
                    if (other.id === clip.id) continue;
                    snapCandidates.push(other.timelineStart);
                    snapCandidates.push(other.timelineStart + other.timelineDuration);
                  }
                  const allMarkers: any[] = (project as any)?.markers || [];
                  for (const m of allMarkers) if (isFinite(m.time)) snapCandidates.push(m.time);

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const pps2 = sanitizeTime(pixelsPerSecond, 40);
                    if (!isFinite(pps2) || pps2 <= 0.5) return;
                    const deltaX = moveEvent.clientX - startX;
                    const deltaSec = deltaX / pps2;
                    if (!isFinite(deltaSec)) return;

                    const updated = calculateTrimUpdate(
                      {
                        timelineStart: clip.timelineStart,
                        timelineDuration: clip.timelineDuration,
                        startOffset: clip.startOffset,
                        endOffset: clip.endOffset,
                        duration: clip.duration,
                        speed: (clip as any).speed || 1.0,
                        fps,
                      },
                      'right',
                      deltaSec,
                      {
                        fps,
                        snapCandidates,
                        snapThresholdTimeline: 8 / pps2,
                      }
                    );

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
                      onTrimAudioClip(clip.id, latestTrim.startOffset, latestTrim.endOffset, latestTrim.timelineStart);
                    }
                  };

                  window.addEventListener('mousemove', handleMouseMove);
                  window.addEventListener('mouseup', handleMouseUp);
                }}
                className={`absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 transition-all cursor-ew-resize opacity-0 group-hover:opacity-100 rounded-r flex items-center justify-center z-20 ${
                  trimPreview[clip.id]
                    ? 'bg-forge-cyan opacity-100 ring-2 ring-forge-cyan'
                    : 'bg-forge-cyan/70 hover:bg-forge-cyan'
                }`}
                title="Trim audio end (drag left/right to adjust end without altering source file)"
              >
                <div className="w-[1.5px] h-3.5 bg-black/90 rounded" />
              </div>
            )}
          </div>
        );
      })}

      {/* Right Click Audio Context Menu */}
      {contextMenu && (
        <AudioClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipId={contextMenu.clip.id}
          clipName={contextMenu.clip.name}
          isMuted={contextMenu.clip.isMuted}
          volume={contextMenu.clip.volume ?? 1.0}
          onClose={() => setContextMenu(null)}
          onCopy={() => onCopyAudioClip?.(contextMenu.clip.id)}
          onCut={() => onCutAudioClip?.(contextMenu.clip.id)}
          onDelete={() => onDeleteAudioClip?.(contextMenu.clip.id)}
          onDuplicate={() => onDuplicateAudioClip?.(contextMenu.clip.id)}
          onSplit={() => onSplitAudioClip?.()}
          onRemoveSilence={() => onRemoveSilenceAudioClip?.(contextMenu.clip.id)}
          onEnhanceAudio={() => onEnhanceAudioClip?.(contextMenu.clip.id)}
          onToggleMute={() => onToggleMuteAudioClip?.(contextMenu.clip.id)}
          onSetVolume={(v) => onSetVolumeAudioClip?.(contextMenu.clip.id, v)}
        />
      )}
    </div>
  );
});
