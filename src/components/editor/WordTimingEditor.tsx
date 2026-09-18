import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CaptionLine, WordTimestamp } from '../../types/caption';
import { formatTimecode } from '../../utils/timecode';
import { Clock, Scissors, Merge, GripVertical, Play, Pause, AlertTriangle, CheckCircle, RotateCcw, Sparkles } from 'lucide-react';
import { validateCaptionTimings, runCaptionQualityCheck } from '../../utils/captionTimingEngine';

// WordTimingEditor — P34-P37: advanced timing with visualization, draggable boundaries, split/merge
export const WordTimingEditor: React.FC<{ captionId: string }> = ({ captionId }) => {
  const {
    project,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    updateWordTimestamp,
    splitCaptionLine,
    mergeCaptionLines,
    selectedCaptionId,
  } = useProject();

  const caption = project?.captions.find((c) => c.id === captionId);
  const mediaDuration = project?.metadata.duration || 30;
  const fps = project?.metadata.fps || 30;

  const [dragging, setDragging] = useState<{ wordId: string; edge: 'start' | 'end'; startX: number; origStart: number; origEnd: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Validation for this caption (P28)
  const validation = useMemo(() => {
    if (!caption) return null;
    return validateCaptionTimings([caption], mediaDuration, fps);
  }, [caption, mediaDuration, fps]);

  const quality = useMemo(() => {
    if (!caption) return null;
    return runCaptionQualityCheck([caption], mediaDuration);
  }, [caption, mediaDuration]);

  // Active word at playhead (P36)
  const activeWordId = useMemo(() => {
    if (!caption) return null;
    const w = caption.words.find((wd) => currentTime >= wd.start && currentTime <= wd.end);
    if (w) return w.id;
    // fallback: nearest
    let nearest: WordTimestamp | null = null;
    let bestDist = Infinity;
    for (const wd of caption.words) {
      const mid = (wd.start + wd.end) / 2;
      const d = Math.abs(currentTime - mid);
      if (d < bestDist) { bestDist = d; nearest = wd; }
    }
    return nearest?.id || null;
  }, [caption, currentTime]);

  const totalDur = caption ? Math.max(0.5, caption.end - caption.start) : 1;
  const pixelsPerSec = 120; // fixed for word editor

  const handleWordEdgeDown = (e: React.MouseEvent, word: WordTimestamp, edge: 'start' | 'end') => {
    e.stopPropagation();
    setDragging({ wordId: word.id, edge, startX: e.clientX, origStart: word.start, origEnd: word.end });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !caption || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const deltaSec = (e.clientX - dragging.startX) / pixelsPerSec;
    const word = caption.words.find((w) => w.id === dragging.wordId);
    if (!word) return;
    const idx = caption.words.findIndex((w) => w.id === dragging.wordId);
    const prev = idx > 0 ? caption.words[idx - 1] : null;
    const next = idx < caption.words.length - 1 ? caption.words[idx + 1] : null;

    let newStart = word.start;
    let newEnd = word.end;
    if (dragging.edge === 'start') {
      newStart = Math.max(caption.start, Math.min(word.end - 0.08, dragging.origStart + deltaSec));
      if (prev && newStart < prev.end + 0.02) newStart = prev.end + 0.02;
    } else {
      newEnd = Math.max(word.start + 0.08, Math.min(caption.end, dragging.origEnd + deltaSec));
      if (next && newEnd > next.start - 0.02) newEnd = next.start - 0.02;
    }
    newStart = Math.round(newStart * 100) / 100;
    newEnd = Math.round(newEnd * 100) / 100;
    updateWordTimestamp(caption.id, word.id, { start: newStart, end: newEnd });
  }, [dragging, caption, pixelsPerSec, updateWordTimestamp]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  if (!caption) return <div className="p-3 text-xs text-gray-500">Select a caption to edit its word timings.</div>;

  return (
    <div className="space-y-3 p-2 bg-[#0e0e12] rounded-lg border border-[#27272a]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-white">Word Timing</span>
          <span className="text-[11px] font-mono text-gray-400">{formatTimecode(caption.start)} → {formatTimecode(caption.end)} ({(caption.end - caption.start).toFixed(2)}s)</span>
          {quality && quality.beyondMedia > 0 && <span title="Beyond media"><AlertTriangle className="w-3 h-3 text-red-400" /></span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 rounded bg-[#1e1e24] border border-[#27272a] text-gray-300 hover:text-white">
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <span className="text-[11px] font-mono text-gray-500">{currentTime.toFixed(2)}s</span>
        </div>
      </div>

      {/* Validation (P28) */}
      {validation && validation.errors.length > 0 && (
        <div className="p-1.5 rounded bg-red-950/40 border border-red-800 text-[11px] text-red-300 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            {validation.errors.slice(0, 3).map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        </div>
      )}
      {validation && validation.warnings.length > 0 && validation.errors.length === 0 && (
        <div className="p-1.5 rounded bg-amber-950/30 border border-amber-800 text-[11px] text-amber-200">
          {validation.warnings.slice(0, 2).map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {/* Timeline visualization (P35) */}
      <div className="space-y-1.5">
        <div ref={trackRef} className="relative h-14 bg-black rounded border border-[#27272a] overflow-hidden select-none" onClick={(e) => {
          const rect = trackRef.current?.getBoundingClientRect();
          if (!rect) return;
          const pct = (e.clientX - rect.left) / rect.width;
          const t = caption.start + pct * totalDur;
          setCurrentTime(Math.max(caption.start, Math.min(caption.end, Math.round(t * 100) / 100)));
        }}>
          {/* Words as blocks */}
          {caption.words.map((w) => {
            const leftPct = ((w.start - caption.start) / totalDur) * 100;
            const widthPct = ((w.end - w.start) / totalDur) * 100;
            const isActive = w.id === activeWordId;
            const isEstim = w.confidence !== undefined && w.confidence < 0.6;
            return (
              <div
                key={w.id}
                style={{ left: `${leftPct}%`, width: `${Math.max(6, widthPct)}%` }}
                className={`absolute top-1 bottom-1 rounded border flex flex-col items-center justify-center cursor-pointer group/word ${isActive ? 'bg-forge-purple border-forge-purple text-white shadow-md scale-[1.02] z-10' : 'bg-[#1e1e24] border-[#3f3f46] text-gray-200 hover:border-white/30'}`}
                onClick={(e) => { e.stopPropagation(); setCurrentTime(w.start); }}
                title={`${w.word} ${w.start.toFixed(2)}→${w.end.toFixed(2)}s ${(w.end - w.start).toFixed(2)}s ${isEstim ? '(estimated)' : ''}`}
              >
                <span className={`text-xs font-bold truncate px-1 ${isActive ? 'text-white' : 'text-gray-100'}`}>{w.word}</span>
                <span className="text-[9px] font-mono text-gray-400">{(w.end - w.start).toFixed(2)}s {isEstim && <span className="text-amber-400">*</span>}</span>
                {/* Left handle */}
                <div onMouseDown={(e) => handleWordEdgeDown(e, w, 'start')} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-forge-cyan/0 hover:bg-forge-cyan/50 flex items-center justify-center">
                  <div className="w-[2px] h-5 bg-white/0 group-hover/word:bg-white/60 rounded" />
                </div>
                {/* Right handle */}
                <div onMouseDown={(e) => handleWordEdgeDown(e, w, 'end')} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-forge-cyan/0 hover:bg-forge-cyan/50 flex items-center justify-center">
                  <div className="w-[2px] h-5 bg-white/0 group-hover/word:bg-white/60 rounded" />
                </div>
                {isActive && <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow" />}
              </div>
            );
          })}
          {/* Playhead */}
          {currentTime >= caption.start && currentTime <= caption.end && (
            <div style={{ left: `${((currentTime - caption.start) / totalDur) * 100}%` }} className="absolute top-0 bottom-0 w-[2px] bg-forge-cyan shadow-[0_0_6px_#06B6D4] pointer-events-none z-20">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-forge-cyan rotate-45" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
          <span>{formatTimecode(caption.start)}</span>
          <span>{caption.words.length} words • {totalDur.toFixed(2)}s • {isPlaying ? 'playing' : 'paused'}</span>
          <span>{formatTimecode(caption.end)}</span>
        </div>
      </div>

      {/* Word list with editable timings */}
      <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
        {caption.words.map((w, idx) => {
          const isActive = w.id === activeWordId;
          return (
            <div key={w.id} className={`flex items-center gap-1.5 p-1.5 rounded border ${isActive ? 'bg-cyan-950/30 border-forge-cyan/50 ring-1 ring-forge-cyan/30' : 'bg-[#121214] border-[#1e1e24] hover:border-white/15'}`}>
              <span className={`text-xs font-bold min-w-[60px] truncate ${isActive ? 'text-forge-cyan' : 'text-white'}`}>{w.word}</span>
              <div className="flex items-center gap-1 flex-1">
                <input type="number" step={0.01} value={w.start} onChange={(e) => updateWordTimestamp(caption.id, w.id, { start: parseFloat(e.target.value) || w.start })} className="w-20 px-1 py-0.5 text-[11px] font-mono bg-black border border-[#27272a] rounded text-white" title="Start" />
                <span className="text-gray-500">→</span>
                <input type="number" step={0.01} value={w.end} onChange={(e) => updateWordTimestamp(caption.id, w.id, { end: parseFloat(e.target.value) || w.end })} className="w-20 px-1 py-0.5 text-[11px] font-mono bg-black border border-[#27272a] rounded text-white" title="End" />
                <span className="text-[10px] font-mono text-gray-500">{(w.end - w.start).toFixed(2)}s</span>
                {w.confidence !== undefined && w.confidence < 0.6 && <span className="text-[9px] bg-amber-500 text-black px-1 rounded font-bold" title="Estimated timing">EST</span>}
              </div>
              <div className="flex items-center gap-0.5">
                {idx > 0 && <button onClick={() => splitCaptionLine(caption.id, idx)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-amber-400" title="Split caption at this word (P37)"><Scissors className="w-3 h-3" /></button>}
                <button onClick={() => setCurrentTime(w.start)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-forge-cyan" title="Jump to word (P36)"><Play className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual split/merge hint */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-[#1e1e24]">
        <button onClick={() => {
          // Merge with next caption if exists
          const idx = project!.captions.findIndex((c) => c.id === captionId);
          const next = project!.captions[idx + 1];
          if (next) mergeCaptionLines(caption.id, next.id);
        }} disabled={!project?.captions.find((c) => c.id === captionId) || project.captions.indexOf(caption) === project.captions.length - 1}
          className="px-2 py-1 rounded bg-[#1e1e24] border border-[#27272a] text-xs text-gray-300 hover:text-white disabled:opacity-40 flex items-center gap-1">
          <Merge className="w-3 h-3" /> Merge next
        </button>
        <span className="text-[11px] text-gray-500">Drag word edges to adjust timing (P34). Changes update animation & highlight timing live.</span>
      </div>
    </div>
  );
};
