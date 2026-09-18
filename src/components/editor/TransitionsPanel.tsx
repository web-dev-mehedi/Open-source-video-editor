import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { TRANSITION_PRESETS, EffectPreset } from '../../data/effectsPresets';
import { AnimatedPreviewCard } from '../common/AnimatedPreviewCard';
import { resolveTransitionPreset } from '../../utils/presetBridge';
import { Search, Film, Star, Check, X } from 'lucide-react';

const TRANSITION_CATEGORIES = [
  'All',
  'Favorites',
  'Trending',
  'Motion',
  'Light',
  'Glitch',
  'Classic',
  'Blur',
  'Basic',
];

export const TransitionsPanel: React.FC = () => {
  const {
    project,
    currentTime,
    addTransition,
    splitClipAtPlayhead,
    selectedClipId,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cf_favorite_transitions');
      return saved ? JSON.parse(saved) : ['crossfade', 'zoom-in', 'whip-left'];
    } catch {
      return ['crossfade', 'zoom-in', 'whip-left'];
    }
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('cf_favorite_transitions', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const clips = project?.clips || [];

  const filteredTransitions = TRANSITION_PRESETS.filter((trans) => {
    const isFav = favorites.includes(trans.id);
    const matchCategory =
      selectedCategory === 'All' ||
      (selectedCategory === 'Favorites' && isFav) ||
      trans.category.toLowerCase() === selectedCategory.toLowerCase() ||
      trans.subCategory.toLowerCase() === selectedCategory.toLowerCase();

    const matchSearch =
      !searchQuery ||
      trans.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trans.description && trans.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCategory && matchSearch;
  });

  const handleApplyTransition = (preset: EffectPreset) => {
    // Resolve UI preset id (e.g. 'zoom-in', 'whip-left') to a real engine
    // transition type — unknown ids refuse honestly instead of creating a
    // UI-only transition that would never render in preview/export.
    const resolved = resolveTransitionPreset(preset.id);
    if (!resolved) {
      setToastMessage(`Unknown transition "${preset.name}" — not applied`);
      setTimeout(() => setToastMessage(null), 2200);
      return;
    }
    const transType = resolved.engineType;
    if (clips.length === 0) {
      setToastMessage('Import video clips to timeline first');
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    if (clips.length === 1) {
      const clip = clips[0];
      const isNearStart = currentTime <= clip.timelineStart + 1.0;
      const isNearEnd = currentTime >= clip.timelineStart + clip.timelineDuration - 1.0;

      if (isNearStart || isNearEnd) {
        addTransition({
          type: transType,
          name: resolved.name,
          fromClipId: clip.id,
          toClipId: clip.id,
          timelineStart: isNearStart
            ? clip.timelineStart
            : clip.timelineStart + clip.timelineDuration,
          duration: resolved.duration,
          alignment: isNearStart ? 'start' : 'end',
          direction: resolved.direction,
          params: { ...resolved.params },
        });
        setToastMessage(`Attached ${resolved.name} to clip edge`);
      } else {
        // Split clip at playhead and insert transition between the two resulting clips
        splitClipAtPlayhead();
        addTransition({
          type: transType,
          name: resolved.name,
          fromClipId: clip.id,
          toClipId: clip.id,
          timelineStart: currentTime,
          duration: resolved.duration,
          alignment: 'center',
          direction: resolved.direction,
          params: { ...resolved.params },
        });
        setToastMessage(`Split and added ${resolved.name} at playhead`);
      }
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    // Find closest cut point among clips
    let bestCutPoint = clips[0].timelineStart + clips[0].timelineDuration;
    let fromClip = clips[0];
    let toClip = clips[1];

    let minDiff = 999999;
    for (let i = 0; i < clips.length - 1; i++) {
      const cut = clips[i].timelineStart + clips[i].timelineDuration;
      const diff = Math.abs(currentTime - cut);
      if (diff < minDiff) {
        minDiff = diff;
        bestCutPoint = cut;
        fromClip = clips[i];
        toClip = clips[i + 1];
      }
    }

    addTransition({
      type: transType,
      name: resolved.name,
      fromClipId: fromClip.id,
      toClipId: toClip.id,
      timelineStart: bestCutPoint,
      duration: resolved.duration,
      alignment: 'center',
      direction: resolved.direction,
      params: { ...resolved.params },
    });

    setToastMessage(`Added ${resolved.name} between ${fromClip.name} and ${toClip.name}`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  return (
    <div className="flex h-full bg-[#18181b] text-gray-200 select-none overflow-hidden font-sans">
      {/* Left Sub-Categories Side Navigation (CapCut Style) */}
      <div className="w-28 bg-[#121214] border-r border-[#27272a] p-2 flex flex-col gap-1 flex-shrink-0 overflow-y-auto no-scrollbar">
        <div className="px-2 py-1 text-[11px] font-bold text-forge-amber flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>Transitions</span>
          </span>
        </div>

        <div className="space-y-0.5 mt-1">
          {TRANSITION_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count =
              cat === 'All'
                ? TRANSITION_PRESETS.length
                : cat === 'Favorites'
                ? favorites.length
                : TRANSITION_PRESETS.filter(
                    (t) =>
                      t.category.toLowerCase() === cat.toLowerCase() ||
                      t.subCategory.toLowerCase() === cat.toLowerCase()
                  ).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'text-amber-400 bg-[#27272a] border border-[#3f3f46]/50 shadow-xs font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e1e22]'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {cat === 'Favorites' && (
                    <Star className="w-3 h-3 text-amber-400 fill-current" />
                  )}
                  <span>{cat}</span>
                </span>
                <span className="text-[9.5px] font-mono text-gray-500">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Grid Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#18181b]">
        {/* Search Header */}
        <div className="p-3 border-b border-[#27272a] space-y-2 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search transitions (e.g. dissolve, zoom, whip)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#27272a]/60 border border-[#3f3f46]/50 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-gray-300">
            <span className="flex items-center gap-1.5">
              <span>{selectedCategory === 'All' ? 'All Transitions' : selectedCategory}</span>
              <span className="text-[10px] text-gray-500 font-mono">
                ({filteredTransitions.length})
              </span>
            </span>
            <span className="text-[10.5px] font-normal text-gray-400">
              Hover to preview • Drag to clip seam
            </span>
          </div>
        </div>

        {/* 3-Column Animated Card Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2.5 content-start">
          {filteredTransitions.map((trans) => (
            <AnimatedPreviewCard
              key={trans.id}
              preset={trans}
              isFavorite={favorites.includes(trans.id)}
              onToggleFavorite={toggleFavorite}
              onApply={handleApplyTransition}
            />
          ))}

          {filteredTransitions.length === 0 && (
            <div className="col-span-3 py-12 flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
              <Film className="w-8 h-8 text-gray-600 animate-pulse" />
              <p className="text-xs font-semibold text-gray-400">
                No transitions match your filter
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="text-[11px] text-amber-400 hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="px-3 py-1.5 bg-amber-500/20 border-t border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-2 animate-fade-in flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
