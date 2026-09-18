import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Button } from '../common/Button';
import {
  Sparkles,
  Search,
  Languages,
  Plus,
  Trash2,
  Scissors,
  Merge,
  ArrowUpRight,
  Clock,
  CaseSensitive,
  Palette,
  Layers,
  Flame,
} from 'lucide-react';
import { formatTimecode } from '../../utils/timecode';
import { TranslateModal } from './TranslateModal';
import { AutoCaptionModal } from '../captions/AutoCaptionModal';
import { CAPTION_PRESET_STYLES } from '../../utils/presetStyles';
import { MULTI_STYLE_FLOWS } from '../../utils/multiCaptionStyleEngine';
import { WordTimingEditor } from './WordTimingEditor';

const MOOD_COLOR_PRESETS = [
  { name: 'Blue', color: '#38BDF8', secondary: '#0284C7', glow: 'rgba(56, 189, 248, 0.55)', shadow: 'rgba(2, 132, 199, 0.95)', bg: 'bg-sky-400' },
  { name: 'Red', color: '#EF4444', secondary: '#991B1B', glow: 'rgba(239, 68, 68, 0.55)', shadow: 'rgba(220, 38, 38, 0.95)', bg: 'bg-red-500' },
  { name: 'Lime', color: '#84CC16', secondary: '#3F6212', glow: 'rgba(132, 204, 22, 0.55)', shadow: 'rgba(132, 204, 22, 0.95)', bg: 'bg-lime-500' },
  { name: 'Gold', color: '#FACC15', secondary: '#92400E', glow: 'rgba(250, 204, 21, 0.55)', shadow: 'rgba(250, 204, 21, 0.95)', bg: 'bg-amber-400' },
  { name: 'Purple', color: '#A855F2', secondary: '#6B21A8', glow: 'rgba(168, 85, 242, 0.55)', shadow: 'rgba(168, 85, 242, 0.95)', bg: 'bg-purple-500' },
  { name: 'White', color: '#FFFFFF', secondary: '#E2E8F0', glow: 'rgba(255, 255, 255, 0.35)', shadow: 'rgba(0, 0, 0, 0.95)', bg: 'bg-white' },
];

export const CaptionEditor: React.FC = () => {
  const {
    project,
    currentTime,
    setCurrentTime,
    selectedCaptionId,
    setSelectedCaptionId,
    setActiveSidebarTab,
    updateCaptionLine,
    updateWordTimestamp,
    splitCaptionLine,
    mergeCaptionLines,
    deleteCaptionLine,
    addCaptionLineAtPlayhead,
    setCaptionLineStyleOverride,
    applyPresetToSelectedCaption,
    applyMultiStyleFlow,
    clearAllCaptionStyleOverrides,
    setCaptionHookSplit,
    autoTranscribeVideo,
    isTranscribing,
    transcribeProgress,
    updateActiveStyle,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [showAutoCaptionModal, setShowAutoCaptionModal] = useState(false);

  const captions = project?.captions || [];

  // Filtered captions
  const filteredCaptions = searchQuery
    ? captions.filter((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : captions;

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    captions.forEach((line) => {
      if (line.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        const regex = new RegExp(searchQuery, 'gi');
        const newText = line.text.replace(regex, replaceQuery);
        updateCaptionLine(line.id, newText);
      }
    });
  };

  // Casing converter
  const handleCasingChange = (casing: 'uppercase' | 'lowercase' | 'titlecase') => {
    updateActiveStyle({ casing });
  };

  return (
    <div className="flex flex-col h-full bg-canvas-surface text-gray-200 select-none">
      {/* Top Header */}
      <div className="p-3 border-b border-canvas-border space-y-2.5 bg-[#141417]">
        {/* Title and AI Primary Action */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-wide">Captions</span>
            <span className="text-[11px] bg-[#1e1e24] px-2 py-0.5 rounded-full text-forge-purple font-mono font-bold whitespace-nowrap border border-forge-purple/30">
              {captions.length} {captions.length === 1 ? 'line' : 'lines'}
            </span>
          </div>

          <Button
            size="sm"
            variant="gradient"
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => setShowAutoCaptionModal(true)}
            isLoading={isTranscribing}
            title="Auto-transcribe with AI"
            className="h-8 px-3 text-xs font-semibold shadow-md shadow-purple-950/40"
          >
            AI Auto-Transcribe
          </Button>
        </div>

        {/* Quick Tools Equal Sized Grid */}
        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Palette className="w-3.5 h-3.5 text-forge-purple flex-shrink-0" />}
            onClick={() => setActiveSidebarTab('styles')}
            title="Browse 20+ Caption Templates"
            className="h-7.5 px-1.5 text-[11px] font-semibold justify-center truncate"
          >
            Templates
          </Button>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-forge-cyan flex-shrink-0" />}
            onClick={() => setActiveSidebarTab('styles')}
            title="Apply Dynamic Multi-Caption Styles (Multi-Template Auto-Flow)"
            className="h-7.5 px-1.5 text-[11px] font-semibold justify-center truncate"
          >
            Multi-Style
          </Button>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Languages className="w-3.5 h-3.5 text-forge-emerald flex-shrink-0" />}
            onClick={() => setShowTranslateModal(true)}
            title="Translate captions to 50+ languages"
            className="h-7.5 px-1.5 text-[11px] font-semibold justify-center truncate"
          >
            Translate
          </Button>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="w-3.5 h-3.5 text-forge-amber flex-shrink-0" />}
            onClick={addCaptionLineAtPlayhead}
            title="Add a new caption line at current playhead"
            className="h-7.5 px-1.5 text-[11px] font-semibold justify-center truncate"
          >
            Add Line
          </Button>
        </div>

        {/* Search, Replace and Quick Casing Formats */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple/80 transition-colors"
            />
          </div>

          {searchQuery && (
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="w-28 px-2 py-1 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple/80 transition-colors"
              />
              <Button size="sm" variant="secondary" onClick={handleReplaceAll} className="h-7 px-2 text-xs font-semibold">
                Replace
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1 pl-1 border-l border-canvas-border/80 text-gray-400">
            <button
              onClick={() => handleCasingChange('uppercase')}
              title="Format all captions UPPERCASE"
              className="px-1.5 py-0.5 bg-canvas-card hover:bg-canvas-hover border border-canvas-border/60 hover:border-gray-500 rounded text-[10px] font-bold text-gray-300 transition-colors"
            >
              AA
            </button>
            <button
              onClick={() => handleCasingChange('titlecase')}
              title="Format all captions Title Case"
              className="px-1.5 py-0.5 bg-canvas-card hover:bg-canvas-hover border border-canvas-border/60 hover:border-gray-500 rounded text-[10px] font-medium text-gray-300 transition-colors"
            >
              Aa
            </button>
            <button
              onClick={() => handleCasingChange('lowercase')}
              title="Format all captions lowercase"
              className="px-1.5 py-0.5 bg-canvas-card hover:bg-canvas-hover border border-canvas-border/60 hover:border-gray-500 rounded text-[10px] text-gray-400 transition-colors"
            >
              aa
            </button>
          </div>
        </div>
      </div>

      {/* Progress banner if transcribing */}
      {isTranscribing && (
        <div className="p-3 bg-forge-purple/10 border-b border-forge-purple/30 text-xs text-forge-cyan animate-pulse flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>{transcribeProgress || 'Processing audio with AI...'}</span>
        </div>
      )}

      {/* Captions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredCaptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500 space-y-2">
            <Sparkles className="w-8 h-8 text-gray-600" />
            <p className="text-xs">No captions found</p>
            <p className="text-[11px] text-gray-600">Click "AI Auto-Transcribe" or "Add Line" to begin</p>
          </div>
        ) : (
          filteredCaptions.map((line, lineIndex) => {
            const isSelected = line.id === selectedCaptionId;
            const isSpokenNow = currentTime >= line.start && currentTime <= line.end;
            const activeColor = line.styleOverride?.activeWordColor || project?.activeStyle.activeWordColor || '#38BDF8';
            const words = line.words || [];
            const splitHookIdx = typeof line.splitHookIndex === 'number'
              ? line.splitHookIndex
              : words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));

            return (
              <div
                key={line.id}
                onClick={() => {
                  setSelectedCaptionId(line.id);
                  setCurrentTime(line.start);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSpokenNow
                    ? 'border-forge-cyan bg-cyan-950/20 shadow-md shadow-cyan-950/30 ring-1 ring-forge-cyan/50'
                    : isSelected
                    ? 'border-forge-purple bg-purple-950/20'
                    : 'border-canvas-border bg-canvas-card/60 hover:border-gray-600'
                }`}
              >
                {/* Header: Timestamp and Actions */}
                <div className="flex items-center justify-between pb-1 text-[11px] text-gray-400 border-b border-canvas-border/40">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3 text-forge-amber" />
                    <span>{formatTimecode(line.start)}</span>
                    <span className="text-gray-600">→</span>
                    <span>{formatTimecode(line.end)}</span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Per-Caption Specific Template Style Override Switcher */}
                    <select
                      value={line.styleOverride?.presetKey || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          applyPresetToSelectedCaption(line.id, val);
                        } else {
                          setCaptionLineStyleOverride(line.id, undefined);
                        }
                      }}
                      className={`bg-black/60 border text-[9px] rounded px-1.5 py-0.5 font-bold focus:outline-none max-w-[105px] truncate cursor-pointer transition-all ${
                        line.styleOverride?.presetKey
                          ? 'border-forge-cyan text-forge-cyan ring-1 ring-cyan-500/40'
                          : 'border-canvas-border text-gray-400 hover:text-white'
                      }`}
                      title={`Style: ${line.styleOverride?.presetKey || 'Default'}. Click to pick a template for this specific caption block.`}
                    >
                      <option value="">🎯 Default Style</option>
                      {CAPTION_PRESET_STYLES.map((p) => (
                        <option key={p.presetKey} value={p.presetKey}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    {/* 1-Line vs 2-Lines toggle */}
                    <div className="flex items-center bg-black/40 rounded border border-canvas-border/60 p-0.5 text-[9px] font-bold">
                      <button
                        onClick={() => {
                          const current = line.styleOverride?.lineMode || project?.activeStyle.lineMode || 'auto';
                          const next = current === 'single' ? 'two-line' : current === 'two-line' ? 'auto' : 'single';
                          setCaptionLineStyleOverride(line.id, {
                            ...(line.styleOverride || {}),
                            lineMode: next,
                          });
                        }}
                        className={`px-1.5 py-0.5 rounded transition-all ${
                          line.styleOverride?.lineMode === 'single'
                            ? 'bg-forge-cyan text-black font-black'
                            : line.styleOverride?.lineMode === 'two-line'
                            ? 'bg-forge-purple text-white font-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title={`Line Mode: ${line.styleOverride?.lineMode || 'Auto'}. Click to switch (1 Line / 2 Lines / Auto)`}
                      >
                        {line.styleOverride?.lineMode === 'single' ? '1 Line' : line.styleOverride?.lineMode === 'two-line' ? '2 Lines' : 'Auto'}
                      </button>
                    </div>

                    {/* Merge with previous */}
                    {lineIndex > 0 && (
                      <button
                        onClick={() => mergeCaptionLines(filteredCaptions[lineIndex - 1].id, line.id)}
                        className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5"
                        title="Merge with previous line"
                      >
                        <Merge className="w-3 h-3" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => deleteCaptionLine(line.id)}
                      className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-white/5"
                      title="Delete line"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Editable Line Text */}
                <div>
                  <textarea
                    value={line.text}
                    onChange={(e) => updateCaptionLine(line.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    rows={2}
                    className="w-full bg-transparent text-sm font-medium text-gray-100 focus:outline-none resize-none"
                  />
                </div>

                {/* Single-Video Multi-Caption Mood & Color Palette Picker */}
                <div className="flex items-center justify-between pt-1 border-t border-canvas-border/30 text-[10px]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Palette className="w-3 h-3 text-forge-purple" />
                    <span>Highlight Mood:</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-canvas-border/50">
                    {MOOD_COLOR_PRESETS.map((m) => {
                      const isCurrentMood = line.styleOverride?.activeWordColor === m.color;

                      return (
                        <button
                          key={m.name}
                          onClick={() => {
                            setCaptionLineStyleOverride(line.id, {
                              activeWordColor: m.color,
                              secondaryColor: m.secondary,
                              lightingGlowColor: m.glow,
                              shadowColor: m.shadow,
                            });
                          }}
                          className={`w-4 h-4 rounded-full ${m.bg} transition-all transform ${
                            isCurrentMood ? 'ring-2 ring-white scale-125 shadow-md' : 'opacity-70 hover:opacity-100 hover:scale-110'
                          }`}
                          title={`${m.name} Mood (3D Hook & Lighting Glow)`}
                        />
                      );
                    })}

                    {line.styleOverride && (
                      <button
                        onClick={() => setCaptionLineStyleOverride(line.id, undefined)}
                        className="text-[9px] text-gray-500 hover:text-gray-300 ml-1 px-1 rounded bg-white/5"
                        title="Reset to default project style"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Word-by-word interactive tokens with Hook Splitting indicator */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {words.map((w, wIdx) => {
                    const isWordActive = currentTime >= w.start && currentTime <= w.end;
                    const isBottomHook = wIdx >= splitHookIdx;

                    return (
                      <React.Fragment key={w.id}>
                        {/* Hook Split Separator Indicator */}
                        {wIdx === splitHookIdx && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-forge-purple/30 border border-forge-purple text-forge-cyan flex items-center gap-0.5 select-none"
                            title="Dual-Tier Split: Words below are massive 3D Punch Hook"
                          >
                            <Flame className="w-2.5 h-2.5 text-amber-400" />
                            <span>Hook Line ↓</span>
                          </div>
                        )}

                        <div
                          className={`group/word relative px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                            isWordActive
                              ? 'bg-forge-purple text-white shadow-sm glow-purple scale-105'
                              : isBottomHook
                              ? 'bg-canvas-card border border-forge-cyan/40 text-forge-cyan font-black'
                              : 'bg-canvas-surface/80 text-gray-300 border border-canvas-border hover:border-gray-500'
                          }`}
                        >
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentTime(w.start);
                            }}
                          >
                            {w.word}
                          </span>

                          {/* Hook Split Trigger Button */}
                          {wIdx > 0 && wIdx !== splitHookIdx && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCaptionHookSplit(line.id, wIdx);
                              }}
                              className="hidden group-hover/word:inline-block p-0.5 text-gray-400 hover:text-forge-cyan"
                              title="Make this word start the Bottom 3D Hook Line"
                            >
                              <Flame className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {/* Split line at this word button */}
                          {wIdx > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                splitCaptionLine(line.id, wIdx);
                              }}
                              className="hidden group-hover/word:inline-block p-0.5 text-gray-400 hover:text-amber-400"
                              title="Split caption line here"
                            >
                              <Scissors className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* P34-P37: Advanced Word Timing Editor — visible when caption selected */}
                {isSelected && (
                  <div className="pt-2">
                    <WordTimingEditor captionId={line.id} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Translation Modal */}
      <TranslateModal
        isOpen={showTranslateModal}
        onClose={() => setShowTranslateModal(false)}
      />

      {/* Auto Caption Generation Modal */}
      <AutoCaptionModal
        isOpen={showAutoCaptionModal}
        onClose={() => setShowAutoCaptionModal(false)}
      />
    </div>
  );
};
