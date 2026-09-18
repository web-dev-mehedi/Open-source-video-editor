import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  buildTranscriptSentences,
  detectStumblesAndSilences,
  TranscriptSentence,
  DetectedStumble,
} from '../../utils/transcriptEditorEngine';
import { formatTimecode } from '../../utils/timecode';
import {
  FileText,
  Scissors,
  Trash2,
  Sparkles,
  Search,
  Wand2,
  Check,
  Play,
  Volume2,
  X,
  Clock,
  Zap,
} from 'lucide-react';

export const TranscriptVideoEditor: React.FC = () => {
  const {
    project,
    currentTime,
    setCurrentTime,
    rippleDeleteTimeRange,
  } = useProject();

  const captions = project?.captions || [];
  const sentences = buildTranscriptSentences(captions);
  const stumbles = detectStumblesAndSilences(captions);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWordRange, setSelectedWordRange] = useState<{
    start: number;
    end: number;
    text: string;
    captionId?: string;
  } | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<{ start: number; end: number; text: string } | null>(null);
  const [cleanedToast, setCleanedToast] = useState<{ count: number; seconds: number } | null>(null);

  const activeWordRef = useRef<HTMLSpanElement | null>(null);

  // Keyboard shortcut listener: Delete or Backspace cuts selected video
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedWordRange &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleCutSelectedText();
      } else if (e.key === 'Escape') {
        setSelectedWordRange(null);
        setRangeAnchor(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordRange]);

  // 1-Click Cut Selected Text Range and ripple video
  const handleCutSelectedText = () => {
    if (!project || !selectedWordRange) return;
    rippleDeleteTimeRange(selectedWordRange.start, selectedWordRange.end);
    setCleanedToast({
      count: 1,
      seconds: Math.round((selectedWordRange.end - selectedWordRange.start) * 10) / 10,
    });
    setSelectedWordRange(null);
    setRangeAnchor(null);
    setTimeout(() => setCleanedToast(null), 2500);
  };

  // Direct Cut Single Word
  const handleCutSingleWord = (start: number, end: number, word: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!project) return;
    rippleDeleteTimeRange(start, end);
    setCleanedToast({
      count: 1,
      seconds: Math.round((end - start) * 10) / 10,
    });
    setSelectedWordRange(null);
    setTimeout(() => setCleanedToast(null), 2500);
  };

  // Direct Cut Entire Sentence Line
  const handleCutSentence = (sent: TranscriptSentence, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!project) return;
    rippleDeleteTimeRange(sent.start, sent.end);
    setCleanedToast({
      count: sent.words.length,
      seconds: Math.round((sent.end - sent.start) * 10) / 10,
    });
    setSelectedWordRange(null);
    setTimeout(() => setCleanedToast(null), 2500);
  };

  // 1-Click Clean All Pauses & Stumbles
  const handleCleanAllStumbles = () => {
    if (!project || stumbles.length === 0) return;

    let totalSaved = 0;
    // Process in reverse order so timestamps remain aligned
    const sortedStumbles = [...stumbles].sort((a, b) => b.start - a.start);

    for (const st of sortedStumbles) {
      rippleDeleteTimeRange(st.start, st.end);
      totalSaved += st.duration;
    }

    setCleanedToast({ count: stumbles.length, seconds: Math.round(totalSaved * 10) / 10 });
    setTimeout(() => setCleanedToast(null), 3000);
  };

  // Word Selection & Shift-Click Range Selection
  const handleWordClick = (w: { start: number; end: number; word: string }, e: React.MouseEvent) => {
    setCurrentTime(w.start);

    if (e.shiftKey && rangeAnchor) {
      const start = Math.min(rangeAnchor.start, w.start);
      const end = Math.max(rangeAnchor.end, w.end);
      setSelectedWordRange({
        start,
        end,
        text: `${rangeAnchor.text} ... ${w.word}`,
      });
    } else {
      setSelectedWordRange({
        start: w.start,
        end: w.end,
        text: w.word,
      });
      setRangeAnchor({
        start: w.start,
        end: w.end,
        text: w.word,
      });
    }
  };

  // Filter sentences by search query
  const filteredSentences = searchQuery.trim()
    ? sentences.filter((s) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : sentences;

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="p-3 border-b border-[#27272a] bg-[#121214] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-forge-cyan" />
          <span className="font-bold text-white text-xs">Transcript Video Editor</span>
          <span className="text-[10px] text-gray-400 bg-[#27272a] px-1.5 py-0.5 rounded font-mono">
            {sentences.length} lines
          </span>
        </div>

        {stumbles.length > 0 && (
          <button
            onClick={handleCleanAllStumbles}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold transition-all shadow-sm active:scale-95"
            title="Automatically cut pauses and filler words from video"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Clean {stumbles.length} Pauses ({stumbles.reduce((acc, s) => acc + s.duration, 0).toFixed(1)}s)</span>
          </button>
        )}
      </div>

      {/* Action Toast */}
      {cleanedToast && (
        <div className="mx-3 mt-2 p-2 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">
              Deleted from video! Saved <strong>{cleanedToast.seconds}s</strong> on timeline.
            </span>
          </div>
          <button onClick={() => setCleanedToast(null)} className="text-gray-400 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Header */}
      <div className="p-3 border-b border-[#27272a] space-y-2 bg-[#141416]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search transcript words..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#202024] border border-[#3f3f46]/60 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-forge-cyan"
          />
        </div>

        {/* Selected Range Action Bar */}
        {selectedWordRange && (
          <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/50 flex items-center justify-between text-xs animate-in fade-in duration-150 shadow-md">
            <div className="flex items-center gap-1.5 truncate max-w-[60%]">
              <span className="font-bold text-red-400">Cut:</span>
              <span className="text-white font-semibold truncate">"{selectedWordRange.text}"</span>
              <span className="text-[10px] font-mono text-gray-400 bg-black/40 px-1 rounded">
                {(selectedWordRange.end - selectedWordRange.start).toFixed(2)}s
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCutSelectedText}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-all shadow-md active:scale-95"
                title="Delete this text and cut video clip on timeline (or press Delete/Backspace)"
              >
                <Trash2 className="w-3 h-3" />
                <span>Cut Video</span>
              </button>
              <button
                onClick={() => {
                  setSelectedWordRange(null);
                  setRangeAnchor(null);
                }}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10"
                title="Cancel selection (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transcript Document View */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
        {filteredSentences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 space-y-2">
            <FileText className="w-8 h-8 text-gray-600" />
            <span className="text-xs font-bold text-gray-400">
              {sentences.length === 0 ? 'No Transcript Generated' : 'No matching words found'}
            </span>
            <span className="text-[11px] text-gray-500 max-w-xs">
              {sentences.length === 0
                ? 'Generate AI Captions in the Captions tab to enable text-based video editing.'
                : 'Try searching for a different word or clear search query.'}
            </span>
          </div>
        ) : (
          filteredSentences.map((sent) => {
            const isCurrentlyPlaying = currentTime >= sent.start && currentTime <= sent.end;

            return (
              <div
                key={sent.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isCurrentlyPlaying
                    ? 'bg-[#1a2332] border-forge-cyan shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'bg-[#141416] border-[#27272a] hover:border-gray-600'
                }`}
              >
                {/* Timecode Header & Action Row */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setCurrentTime(sent.start)}
                    className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-forge-cyan hover:underline"
                    title="Jump playhead to start of this line"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>{formatTimecode(sent.start, true)}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setSelectedWordRange({
                          start: sent.start,
                          end: sent.end,
                          text: sent.text,
                        })
                      }
                      className="text-[10px] text-gray-400 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-cyan-950/40 transition-all flex items-center gap-1"
                      title="Select entire sentence"
                    >
                      <Scissors className="w-2.5 h-2.5" />
                      <span>Select</span>
                    </button>

                    <button
                      onClick={(e) => handleCutSentence(sent, e)}
                      className="text-[10px] text-gray-400 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-950/40 transition-all flex items-center gap-1"
                      title="Delete entire sentence and ripple-cut video clip"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Delete Line</span>
                    </button>
                  </div>
                </div>

                {/* Words Interactive Container */}
                <div className="flex flex-wrap gap-1 leading-relaxed">
                  {sent.words.map((w, wIdx) => {
                    const isWordActive = currentTime >= w.start && currentTime <= w.end;
                    const isSelected =
                      selectedWordRange &&
                      w.start >= selectedWordRange.start - 0.05 &&
                      w.end <= selectedWordRange.end + 0.05;

                    return (
                      <span
                        key={`w_${wIdx}_${w.start}`}
                        ref={isWordActive ? activeWordRef : null}
                        onClick={(e) => handleWordClick(w, e)}
                        onDoubleClick={(e) => handleCutSingleWord(w.start, w.end, w.word, e)}
                        className={`group relative inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-red-500 text-white font-bold ring-2 ring-red-400'
                            : isWordActive
                            ? 'bg-forge-cyan text-black font-bold shadow-md scale-105'
                            : 'hover:bg-white/15 text-gray-200 hover:text-white'
                        }`}
                        title={`Click to jump (${w.start.toFixed(2)}s) • Double-click to delete word from video`}
                      >
                        <span>{w.word}</span>
                        {/* Hover Quick Delete Badge */}
                        <button
                          onClick={(e) => handleCutSingleWord(w.start, w.end, w.word, e)}
                          className="opacity-0 group-hover:opacity-100 ml-1 text-gray-400 hover:text-red-300 hover:bg-red-900/50 rounded-full p-0.5 transition-all"
                          title="Delete this word & cut video"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Shortcuts Helper */}
      <div className="p-2 border-t border-[#27272a] bg-[#121214] text-[10px] text-gray-400 flex items-center justify-between px-3">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-forge-amber" />
          <span><strong>Double-Click</strong> any word or press <strong>Del</strong> to cut video</span>
        </span>
        <span>Shift+Click to select range</span>
      </div>
    </div>
  );
};
