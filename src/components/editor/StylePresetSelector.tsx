import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CAPTION_PRESET_STYLES, PRESET_CATEGORIES, KINETIC_CATEGORIES } from '../../utils/presetStyles';
import { CaptionStyleConfig } from '../../types/caption';
import {
  Check,
  Sparkles,
  Search,
  Sliders,
  Flame,
  Activity,
  Highlighter,
  Film,
  Wand2,
  CheckCircle2,
  Layers,
  Shuffle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Heart,
  Star,
  Clock,
  Bookmark,
  Copy,
  Trash2,
  Crown,
  Zap,
  Mic,
  Clapperboard,
  Briefcase,
  GraduationCap,
  Minus,
} from 'lucide-react';
import { MULTI_STYLE_FLOWS } from '../../utils/multiCaptionStyleEngine';

const FAV_KEY = 'cf_fav_templates';
const RECENT_KEY = 'cf_recent_templates';
const CUSTOM_KEY = 'cf_custom_templates';
const MAX_RECENT = 8;

function loadArray<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const StylePresetSelector: React.FC = () => {
  const {
    project,
    applyPresetStyle,
    applyPresetToSelectedCaption,
    applyMultiStyleFlow,
    clearAllCaptionStyleOverrides,
    selectedCaptionId,
    setActiveSidebarTab,
  } = useProject();

  const activePresetKey = project?.activeStyle.presetKey;
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [appliedToast, setAppliedToast] = useState<string | null>(null);
  const [applyScope, setApplyScope] = useState<'selected' | 'all'>('selected');
  const [activeMultiFlow, setActiveMultiFlow] = useState<string | null>(null);
  const [showMultiStyles, setShowMultiStyles] = useState<boolean>(true);

  // Premium library persistence
  const [favorites, setFavorites] = useState<string[]>(() => loadArray<string[]>(FAV_KEY, []));
  const [recent, setRecent] = useState<string[]>(() => loadArray<string[]>(RECENT_KEY, []));
  const [customTemplates, setCustomTemplates] = useState<CaptionStyleConfig[]>(() => loadArray<CaptionStyleConfig[]>(CUSTOM_KEY, []));
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch {}
  }, [favorites]);
  useEffect(() => {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch {}
  }, [recent]);
  useEffect(() => {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customTemplates)); } catch {}
  }, [customTemplates]);

  // Listen for custom template updates from StyleCustomizer (cross-component)
  useEffect(() => {
    const reload = () => setCustomTemplates(loadArray<CaptionStyleConfig[]>(CUSTOM_KEY, []));
    window.addEventListener('storage', reload);
    window.addEventListener('cf_custom_templates_updated' as any, reload);
    return () => {
      window.removeEventListener('storage', reload);
      window.removeEventListener('cf_custom_templates_updated' as any, reload);
    };
  }, []);

  const totalCaptionsCount = project?.captions?.length || 0;
  const selectedCaptionIndex = project?.captions?.findIndex((c) => c.id === selectedCaptionId);
  const hasSelectedCaption = selectedCaptionId && selectedCaptionIndex !== undefined && selectedCaptionIndex >= 0;

  // Merge built-in + custom templates for display
  const allTemplates: CaptionStyleConfig[] = useMemo(() => {
    return [...CAPTION_PRESET_STYLES, ...customTemplates] as CaptionStyleConfig[];
  }, [customTemplates]);

  const filteredPresets = useMemo(() => {
    let base = allTemplates;

    // Category filter
    if (selectedCategory !== 'All') {
      if (selectedCategory === 'Favorites') {
        base = base.filter((p) => favorites.includes(p.presetKey));
      } else if (selectedCategory === 'My Templates') {
        base = customTemplates;
      } else if (selectedCategory === 'Recently Used') {
        const order = new Map(recent.map((k, i) => [k, i]));
        base = base.filter((p) => recent.includes(p.presetKey)).sort((a, b) => (order.get(a.presetKey) ?? 999) - (order.get(b.presetKey) ?? 999));
      } else {
        // Handle both legacy uppercase and new kinetic categories case-insensitive
        base = base.filter((p) => {
          const cat = (p.category || '').toLowerCase();
          const sel = selectedCategory.toLowerCase();
          // Map 'Viral' filter to also include 'VIRAL'
          if (sel === 'viral' && (cat === 'viral' || cat === 'viral')) return p.category === 'VIRAL' || p.category === 'Viral';
          if (sel === 'minimal' && cat === 'minimalist') return true;
          return cat === sel;
        });
      }
    }

    // Favorites quick filter toggle
    if (showFavoritesOnly && selectedCategory !== 'Favorites') {
      base = base.filter((p) => favorites.includes(p.presetKey));
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.presetKey.toLowerCase().includes(q) ||
          p.fontFamily.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          p.animation.toLowerCase().includes(q)
      );
    }

    return base;
  }, [allTemplates, selectedCategory, favorites, customTemplates, recent, searchQuery, showFavoritesOnly]);

  const pushRecent = (presetKey: string) => {
    setRecent((prev) => {
      const next = [presetKey, ...prev.filter((k) => k !== presetKey)].slice(0, MAX_RECENT);
      return next;
    });
  };

  const toggleFavorite = (presetKey: string) => {
    setFavorites((prev) => (prev.includes(presetKey) ? prev.filter((k) => k !== presetKey) : [...prev, presetKey]));
  };

  const handleDuplicate = (preset: CaptionStyleConfig) => {
    const copy: CaptionStyleConfig = {
      ...preset,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      presetKey: `${preset.presetKey}_copy_${Date.now().toString(36).slice(-4)}`,
      name: `${preset.name} Copy`,
      category: (preset.category as any),
      description: `Copy of ${preset.name} — customize freely`,
    };
    setCustomTemplates((prev) => [copy, ...prev]);
    setAppliedToast(`Duplicated "${preset.name}" to My Templates`);
    setTimeout(() => setAppliedToast(null), 2200);
    setSelectedCategory('My Templates');
  };

  const handleDeleteCustom = (presetKey: string) => {
    setCustomTemplates((prev) => prev.filter((p) => p.presetKey !== presetKey));
    setFavorites((prev) => prev.filter((k) => k !== presetKey));
    setAppliedToast('Removed custom template');
    setTimeout(() => setAppliedToast(null), 1800);
  };

  const handleSelectPreset = (presetKey: string, presetName: string, forceScope?: 'selected' | 'all') => {
    const targetScope = forceScope || applyScope;
    pushRecent(presetKey);
    if (targetScope === 'selected' && selectedCaptionId) {
      applyPresetToSelectedCaption(selectedCaptionId, presetKey);
      setAppliedToast(`Applied "${presetName}" to Caption #${selectedCaptionIndex! + 1} only!`);
    } else {
      if (targetScope === 'selected' && !selectedCaptionId) {
        applyPresetStyle(presetKey);
        setAppliedToast(`Applied "${presetName}" to all ${totalCaptionsCount} captions (no selection)!`);
      } else {
        applyPresetStyle(presetKey);
        setAppliedToast(`Applied "${presetName}" to all ${totalCaptionsCount} captions!`);
      }
    }
    setTimeout(() => setAppliedToast(null), 2200);
  };

  const getCategoryIcon = (category?: string) => {
    const c = (category || '').toLowerCase();
    if (c === 'viral' || c === 'viral') return <Flame className="w-3 h-3 text-amber-400" />;
    if (c === 'dynamic') return <Zap className="w-3 h-3 text-yellow-400" />;
    if (c === 'animated') return <Activity className="w-3 h-3 text-cyan-400" />;
    if (c === 'highlight' || c === 'highlighter') return <Highlighter className="w-3 h-3 text-lime-400" />;
    if (c === 'classic') return <Film className="w-3 h-3 text-gray-300" />;
    if (c === 'creative') return <Wand2 className="w-3 h-3 text-purple-400" />;
    if (c === 'podcast') return <Mic className="w-3 h-3 text-emerald-400" />;
    if (c === 'cinematic') return <Clapperboard className="w-3 h-3 text-slate-300" />;
    if (c === 'business') return <Briefcase className="w-3 h-3 text-blue-400" />;
    if (c === 'educational') return <GraduationCap className="w-3 h-3 text-indigo-400" />;
    if (c === 'minimal' || c === 'minimalist') return <Minus className="w-3 h-3 text-gray-400" />;
    if (c.includes('luxury')) return <Crown className="w-3 h-3 text-amber-300" />;
    return <Sparkles className="w-3 h-3 text-forge-purple" />;
  };

  const getCategoryBadgeClass = (category?: string) => {
    const c = (category || '').toLowerCase();
    if (c === 'viral' || c === 'viral') return 'bg-amber-950/60 text-amber-300 border-amber-500/40';
    if (c === 'dynamic') return 'bg-yellow-950/60 text-yellow-300 border-yellow-500/40';
    if (c === 'podcast') return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
    if (c === 'cinematic') return 'bg-slate-800 text-slate-200 border-slate-600';
    if (c === 'business') return 'bg-blue-950/60 text-blue-300 border-blue-500/40';
    if (c === 'educational') return 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40';
    if (c === 'minimal' || c === 'minimalist') return 'bg-zinc-800 text-zinc-300 border-zinc-600';
    if (c === 'animated') return 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40';
    if (c === 'highlight' || c === 'highlighter') return 'bg-lime-950/60 text-lime-300 border-lime-500/40';
    if (c === 'classic') return 'bg-slate-800 text-slate-300 border-slate-600';
    if (c === 'creative') return 'bg-purple-950/60 text-purple-300 border-purple-500/40';
    return 'bg-canvas-dark text-gray-400 border-canvas-border';
  };

  const isFav = (k: string) => favorites.includes(k);
  const isCustom = (k: string) => customTemplates.some((t) => t.presetKey === k);

  // Recently used row data (show top 6)
  const recentPresets = useMemo(() => {
    if (recent.length === 0) return [];
    const map = new Map(allTemplates.map((p) => [p.presetKey, p]));
    return recent.map((k) => map.get(k)).filter(Boolean) as CaptionStyleConfig[];
  }, [recent, allTemplates]);

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none relative overflow-hidden font-sans">
      {appliedToast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-600/95 text-white px-3.5 py-1.5 rounded-full shadow-2xl border border-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-bounce max-w-[90%]">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{appliedToast}</span>
        </div>
      )}

      {/* Header — Template Browser */}
      <div className="p-2.5 bg-[#121214] border-b border-[#27272a] space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-4 h-4 text-forge-cyan flex-shrink-0" />
            <h3 className="text-xs font-bold text-white whitespace-nowrap">Kinetic Captions</h3>
            <span className="text-[10px] bg-[#27272a] px-1.5 py-0.2 rounded text-forge-cyan font-mono font-bold">
              {allTemplates.length}
            </span>
            {favorites.length > 0 && (
              <span className="text-[10px] bg-amber-950/60 px-1.5 py-0.2 rounded text-amber-300 font-bold flex items-center gap-1">
                <Star className="w-2.5 h-2.5" /> {favorites.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {totalCaptionsCount > 0 && (
              <div className="flex items-center bg-[#27272a] p-0.5 rounded-lg border border-[#3f3f46]">
                <button
                  type="button"
                  onClick={() => setApplyScope('selected')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    applyScope === 'selected' ? 'bg-forge-cyan text-black shadow-sm font-black' : 'text-gray-400 hover:text-white'
                  }`}
                  title="Apply to selected caption only (Current Caption)"
                >
                  Selected
                </button>
                <button
                  type="button"
                  onClick={() => setApplyScope('all')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    applyScope === 'all' ? 'bg-forge-purple text-white shadow-sm font-black' : 'text-gray-400 hover:text-white'
                  }`}
                  title="Apply to all captions"
                >
                  All
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveSidebarTab('customizer')}
              className="flex items-center gap-1 text-[11px] text-forge-purple hover:text-purple-300 font-bold px-2 py-1 rounded-lg bg-[#27272a] border border-[#3f3f46] hover:border-forge-purple/60 transition-all cursor-pointer"
              title="Fine-tune typography, animation, colors and safe area"
            >
              <Sliders className="w-3 h-3" />
              <span>Customize</span>
            </button>
          </div>
        </div>

        {/* Search + Favorites toggle */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search bold, podcast, cinematic, yellow, highlight..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-[#27272a]/70 border border-[#3f3f46] rounded-lg text-gray-200 focus:outline-none focus:border-forge-cyan placeholder-gray-500"
            />
          </div>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
              showFavoritesOnly ? 'bg-amber-500 text-black border-amber-400' : 'bg-[#27272a] text-gray-400 border-[#3f3f46] hover:text-amber-300'
            }`}
            title="Show favorites only"
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-black' : ''}`} />
            <span className="hidden sm:inline">Fav</span>
          </button>
        </div>

        {/* Category Filter Pills — Premium Kinetic */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {(['All', 'Favorites', 'Recently Used', 'My Templates'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  selectedCategory === cat
                    ? 'bg-forge-cyan text-black shadow-sm font-black'
                    : 'bg-[#27272a] text-gray-400 hover:text-gray-200 hover:bg-[#333338] border border-[#3f3f46]'
                }`}
              >
                {cat === 'Favorites' && <Heart className="w-3 h-3" />}
                {cat === 'Recently Used' && <Clock className="w-3 h-3" />}
                {cat === 'My Templates' && <Bookmark className="w-3 h-3" />}
                <span>{cat}</span>
                {cat === 'Favorites' && favorites.length > 0 && <span className="bg-black/20 px-1 rounded-full text-[9px]">{favorites.length}</span>}
                {cat === 'My Templates' && customTemplates.length > 0 && <span className="bg-black/20 px-1 rounded-full text-[9px]">{customTemplates.length}</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {(['Dynamic', 'Viral', 'Podcast', 'Cinematic', 'Business', 'Educational', 'Minimal'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  selectedCategory === cat
                    ? 'bg-white text-black shadow-sm font-black'
                    : 'bg-[#27272a] text-gray-400 hover:text-gray-200 hover:bg-[#333338] border border-[#3f3f46]'
                }`}
              >
                {getCategoryIcon(cat)}
                <span>{cat}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar opacity-80">
            {(['ANIMATED', 'HIGHLIGHT', 'CLASSIC', 'CREATIVE'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  selectedCategory === cat
                    ? 'bg-[#3f3f46] text-white shadow-sm border border-gray-500'
                    : 'bg-[#18181b] text-gray-500 hover:text-gray-300 border border-[#27272a]'
                }`}
              >
                {getCategoryIcon(cat)}
                <span className="text-[9px]">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* Recently Used Row — horizontal premium strip */}
        {recentPresets.length > 0 && selectedCategory === 'All' && !searchQuery && !showFavoritesOnly && (
          <div className="rounded-xl bg-[#121214] border border-[#27272a] p-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Recently Used</span>
              <span className="text-[9px] text-gray-500">— quick reuse</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {recentPresets.slice(0, 6).map((p) => (
                <button
                  key={`recent-${p.presetKey}`}
                  onClick={() => handleSelectPreset(p.presetKey, p.name)}
                  className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-[#27272a] border border-[#3f3f46] hover:border-forge-cyan text-left min-w-[110px] group"
                  title={`Apply ${p.name}`}
                >
                  <div className="text-[10px] font-bold text-white truncate">{p.name}</div>
                  <div className="text-[9px] text-gray-400 truncate">{p.category}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Multi-Caption Style Engine Accordion */}
        <div className="rounded-xl bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-cyan-950/50 border border-purple-500/30 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowMultiStyles((prev) => !prev)}
            className="w-full p-2.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-forge-cyan animate-pulse" />
              <div>
                <span className="text-xs font-black text-white block">Dynamic Multi-Caption Styles</span>
                <span className="text-[10px] text-gray-300">Cycles distinct styles & colors across scenes</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold">
                PRO VIRAL
              </span>
              {showMultiStyles ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </div>
          </button>

          {showMultiStyles && (
            <div className="p-2.5 pt-0 space-y-2 border-t border-purple-500/20">
              <div className="grid grid-cols-2 gap-1.5 pt-2">
                {MULTI_STYLE_FLOWS.map((flow) => {
                  const isSelected = activeMultiFlow === flow.id;
                  return (
                    <button
                      key={flow.id}
                      onClick={() => {
                        applyMultiStyleFlow(flow.id);
                        setActiveMultiFlow(flow.id);
                        setAppliedToast(`Applied "${flow.name}"!`);
                        setTimeout(() => setAppliedToast(null), 2500);
                      }}
                      className={`p-2 rounded-lg border text-left transition-all relative overflow-hidden group cursor-pointer ${
                        isSelected
                          ? 'border-forge-cyan bg-cyan-950/70 shadow-md ring-1 ring-cyan-400'
                          : 'border-[#3f3f46] bg-[#121214] hover:border-purple-500/50 hover:bg-[#1a1a1f]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-white truncate">{flow.name}</span>
                        <span className="text-[8px] font-bold text-forge-cyan">{flow.badge}</span>
                      </div>
                      <div className={`h-1 w-full rounded-full bg-gradient-to-r ${flow.gradient} opacity-80 group-hover:opacity-100 transition-all`} />
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-purple-500/20 text-[10px]">
                <button
                  onClick={() => {
                    applyMultiStyleFlow('random');
                    setActiveMultiFlow('random');
                    setAppliedToast(`Randomly styled captions!`);
                    setTimeout(() => setAppliedToast(null), 2500);
                  }}
                  className="flex items-center gap-1 text-forge-cyan hover:underline font-bold cursor-pointer"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Randomize</span>
                </button>

                <button
                  onClick={() => {
                    clearAllCaptionStyleOverrides();
                    setActiveMultiFlow(null);
                    setAppliedToast(`Reset to single style.`);
                    setTimeout(() => setAppliedToast(null), 2000);
                  }}
                  className="flex items-center gap-1 text-gray-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Single Style</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Template Grid */}
        {filteredPresets.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Search className="w-8 h-8 text-gray-600 mx-auto" />
            <p className="text-xs text-gray-400">No templates match</p>
            <p className="text-[10px] text-gray-500">Try another category or search term</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setShowFavoritesOnly(false);
              }}
              className="text-xs text-forge-cyan hover:underline mt-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredPresets.map((preset) => {
              const isActive = activePresetKey === preset.presetKey;
              const fav = isFav(preset.presetKey);
              const custom = isCustom(preset.presetKey);
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.presetKey, preset.name)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isActive
                      ? 'border-forge-purple bg-purple-950/40 ring-1 ring-forge-purple shadow-xl shadow-purple-950/60'
                      : 'border-[#27272a] bg-[#121214] hover:border-gray-500 hover:bg-[#1a1a1e]'
                  }`}
                >
                  {/* Top Row */}
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-xs font-bold text-gray-100 truncate">{preset.name}</span>
                      {preset.category && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold flex items-center gap-0.5 flex-shrink-0 ${getCategoryBadgeClass(preset.category)}`}>
                          {getCategoryIcon(preset.category)}
                          <span className="hidden sm:inline">{preset.category}</span>
                        </span>
                      )}
                      {custom && <span className="text-[8px] px-1 py-0.5 rounded bg-forge-cyan text-black font-bold">MY</span>}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleFavorite(preset.presetKey)}
                        className={`p-1 rounded transition-all ${fav ? 'text-amber-400 bg-amber-950/50' : 'text-gray-500 hover:text-amber-400 hover:bg-white/5'}`}
                        title={fav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDuplicate(preset)}
                        className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10"
                        title="Duplicate to My Templates"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {custom && (
                        <button
                          onClick={() => handleDeleteCustom(preset.presetKey)}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/30"
                          title="Delete custom template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {hasSelectedCaption && (
                        <button
                          onClick={() => handleSelectPreset(preset.presetKey, preset.name, 'selected')}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-forge-cyan/20 hover:bg-forge-cyan text-cyan-300 hover:text-black border border-forge-cyan/40 transition-all"
                          title={`Apply to Caption #${selectedCaptionIndex! + 1} only`}
                        >
                          This Only
                        </button>
                      )}
                      <button
                        onClick={() => handleSelectPreset(preset.presetKey, preset.name, 'all')}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 hover:bg-forge-purple text-gray-300 hover:text-white border border-white/20 transition-all"
                        title={`Apply to ALL captions`}
                      >
                        All
                      </button>
                    </div>
                  </div>

                  {/* Live Preview — kinetic mockup with animation cue */}
                  <div
                    style={{
                      fontFamily: `${preset.fontFamily}, 'Noto Sans Bengali', sans-serif`,
                      letterSpacing: `${preset.letterSpacing}px`,
                    }}
                    className="py-3 px-2 rounded-lg bg-black/80 border border-white/5 flex items-center justify-center text-center overflow-hidden transition-transform group-hover:scale-[1.01] relative"
                  >
                    {preset.layoutStyle === 'neon-red-hook' ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-black uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] [WebkitTextStroke:1px_black]">
                          NEVER SAY
                        </span>
                        <span className="text-xs font-black italic text-[#FF1133] px-2 py-0.5 rounded border-2 border-[#FF0033] shadow-[0_0_12px_#FF0033] bg-black/60 animate-pulse">
                          "SAVE THIS VIDEO"
                        </span>
                      </div>
                    ) : preset.layoutStyle === 'violet-metallic-3d' ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-black uppercase bg-gradient-to-b from-purple-300 via-purple-500 to-fuchsia-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">
                          ERECTILE
                        </span>
                        <span className="text-xs font-black uppercase text-white drop-shadow-[0_2px_6px_rgba(0,0,0,1)] [WebkitTextStroke:1px_black]">
                          DISFUNCTION
                        </span>
                      </div>
                    ) : preset.layoutStyle === 'fitness-yellow-punch' ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-black uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] [WebkitTextStroke:1px_black]">
                          SAVE IT FOR
                        </span>
                        <span className="text-xs font-black uppercase text-[#E2FD00] drop-shadow-[0_2px_6px_rgba(0,0,0,1)] [WebkitTextStroke:1px_black] animate-bounce">
                          YOUR CHEST DAY
                        </span>
                      </div>
                    ) : preset.layoutStyle === 'money-crimson-script' ? (
                      <div className="flex flex-col items-center -space-y-1">
                        <span className="text-sm font-black text-[#FF0033] drop-shadow-[0_0_12px_rgba(255,0,51,0.9)] animate-pulse">
                          $30,000
                        </span>
                        <span className="text-sm font-bold italic text-white font-['Caveat',cursive] drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                          Business
                        </span>
                      </div>
                    ) : preset.layoutStyle === 'skip-badge-pill' ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-bold lowercase text-white">help you</span>
                        <span className="text-xs font-black text-white px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] shadow-[0_0_10px_rgba(139,92,246,0.6)]">
                          Skip ▶
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-black uppercase flex items-center gap-1.5 flex-wrap justify-center">
                        <span
                          style={{
                            color: preset.textColor || '#FFFFFF',
                            textShadow: preset.hasShadow ? '0 2px 4px rgba(0,0,0,0.9)' : 'none',
                            WebkitTextStroke: preset.strokeWidth > 0 ? `1px ${preset.strokeColor}` : 'none',
                          }}
                        >
                          KINETIC
                        </span>
                        <span
                          style={{
                            color: preset.activeWordColor,
                            backgroundColor: preset.hasHighlightBox ? (preset.highlightBoxColor || '#FACC15') : 'transparent',
                            padding: preset.hasHighlightBox ? '1px 6px' : '0',
                            borderRadius: preset.hasHighlightBox ? '4px' : '0',
                            textShadow: preset.hasShadow ? `0 0 8px ${preset.activeWordColor}` : 'none',
                            WebkitTextStroke: preset.hasHighlightBox ? 'none' : `1px ${preset.strokeColor}`,
                          }}
                          className={`transform transition-transform font-black ${preset.animation === 'bounce' ? 'animate-bounce' : preset.animation === 'word-pop' || preset.animation === 'pop' ? 'animate-pulse' : ''}`}
                        >
                          CAPTION
                        </span>
                        <span
                          style={{
                            color: preset.textColor || '#FFFFFF',
                            textShadow: preset.hasShadow ? '0 2px 4px rgba(0,0,0,0.9)' : 'none',
                            WebkitTextStroke: preset.strokeWidth > 0 ? `1px ${preset.strokeColor}` : 'none',
                          }}
                        >
                          STYLE
                        </span>
                      </div>
                    )}
                    {/* Safe area hint */}
                    <div className="absolute bottom-1 right-1 text-[7px] text-white/20 font-mono">SAFE • {preset.yOffsetPercent}% • {preset.animation}</div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 gap-2">
                    <span className="truncate pr-2 flex-1">{preset.description || `${preset.fontFamily} • ${preset.animation}`}</span>
                    <span className="font-mono text-gray-500 uppercase flex-shrink-0 hidden sm:inline">{preset.fontFamily}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
