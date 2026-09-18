import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { FILTER_PRESETS, EffectPreset } from '../../data/effectsPresets';
import { AnimatedPreviewCard } from '../common/AnimatedPreviewCard';
import { resolveEffectPreset, resolveFilterGrading } from '../../utils/presetBridge';
import { Search, Palette, Star, Check, X } from 'lucide-react';

const FILTER_CATEGORIES = [
  'All',
  'Favorites',
  'Trending',
  'Cinematic',
  'Retro',
  'Light',
  'Glitch',
  'Classic',
];

export const FiltersPanel: React.FC = () => {
  const {
    project,
    currentTime,
    selectedClipId,
    setSelectedClipId,
    updateClip,
    addEffectToClip,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cf_favorite_filters');
      return saved ? JSON.parse(saved) : ['teal-orange', 'moody-cinema', 'cyberpunk-neon'];
    } catch {
      return ['teal-orange', 'moody-cinema', 'cyberpunk-neon'];
    }
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('cf_favorite_filters', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) ||
    project?.clips?.find(
      (c) =>
        currentTime >= c.timelineStart &&
        currentTime <= c.timelineStart + c.timelineDuration
    ) ||
    project?.clips?.[0];

  const filteredFilters = FILTER_PRESETS.filter((filter) => {
    const isFav = favorites.includes(filter.id);
    const matchCategory =
      selectedCategory === 'All' ||
      (selectedCategory === 'Favorites' && isFav) ||
      filter.category.toLowerCase() === selectedCategory.toLowerCase() ||
      filter.subCategory.toLowerCase() === selectedCategory.toLowerCase();

    const matchSearch =
      !searchQuery ||
      filter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (filter.description && filter.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCategory && matchSearch;
  });

  const handleApplyFilter = (preset: EffectPreset) => {
    if (!activeClip) {
      setToastMessage('Select a clip on the timeline first');
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    // Resolve filter preset to engine effect + grading in one place so the
    // timeline drop path and this click path produce identical state.
    const resolved = resolveEffectPreset(preset.id);
    const grading = resolveFilterGrading(preset.id);
    // Apply color grading parameters & temperature/saturation adjustments to target clip
    updateClip(activeClip.id, {
      colorGrading: {
        ...(activeClip as any).colorGrading,
        ...grading,
      },
    });

    // Also add the resolved engine effect for the real-time shader pipeline
    // (previously hardcoded to 'temperature', discarding filter identity).
    if (resolved) {
      addEffectToClip(activeClip.id, resolved.engineType as any, { params: resolved.params });
    }
    setSelectedClipId(activeClip.id);

    setToastMessage(`Applied ${resolved?.name || preset.name} LUT grade to ${activeClip.name}`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  return (
    <div className="flex h-full bg-[#18181b] text-gray-200 select-none overflow-hidden font-sans">
      {/* Left Sub-Categories Navigation (CapCut Style) */}
      <div className="w-28 bg-[#121214] border-r border-[#27272a] p-2 flex flex-col gap-1 flex-shrink-0 overflow-y-auto no-scrollbar">
        <div className="px-2 py-1 text-[11px] font-bold text-emerald-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span>Filters</span>
          </span>
        </div>

        <div className="space-y-0.5 mt-1">
          {FILTER_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count =
              cat === 'All'
                ? FILTER_PRESETS.length
                : cat === 'Favorites'
                ? favorites.length
                : FILTER_PRESETS.filter(
                    (f) =>
                      f.category.toLowerCase() === cat.toLowerCase() ||
                      f.subCategory.toLowerCase() === cat.toLowerCase()
                  ).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'text-emerald-400 bg-[#27272a] border border-[#3f3f46]/50 shadow-xs font-bold'
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
              placeholder="Search filters & LUTs (e.g. teal, moody, neon)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#27272a]/60 border border-[#3f3f46]/50 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-400 transition-colors"
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
              <span>{selectedCategory === 'All' ? 'All Filters & LUTs' : selectedCategory}</span>
              <span className="text-[10px] text-gray-500 font-mono">({filteredFilters.length})</span>
            </span>
            <span className="text-[10.5px] font-normal text-gray-400">
              Hover to preview • Drag to clip
            </span>
          </div>
        </div>

        {/* 3-Column Animated Card Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2.5 content-start">
          {filteredFilters.map((filter) => (
            <AnimatedPreviewCard
              key={filter.id}
              preset={filter}
              isFavorite={favorites.includes(filter.id)}
              onToggleFavorite={toggleFavorite}
              onApply={handleApplyFilter}
            />
          ))}

          {filteredFilters.length === 0 && (
            <div className="col-span-3 py-12 flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
              <Palette className="w-8 h-8 text-gray-600 animate-pulse" />
              <p className="text-xs font-semibold text-gray-400">No filters match your filter</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="px-3 py-1.5 bg-emerald-500/20 border-t border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
