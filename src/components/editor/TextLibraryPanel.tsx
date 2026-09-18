import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { OverlayElement } from '../../types/project';
import {
  Type,
  Sparkles,
  Plus,
  Search,
  Flame,
  Layout,
  Tag,
  AtSign,
  Palette,
  AlignLeft,
} from 'lucide-react';

interface TextPreset {
  id: string;
  name: string;
  category: 'basic' | 'titles' | 'lower_third' | 'neon' | 'social';
  previewText: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textColor: string;
  backgroundColor?: string;
  backgroundPadding?: number;
  backgroundRadius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  animationStyle?: 'fade' | 'zoom' | 'slide' | 'pop' | 'typewriter' | 'none';
  duration: number;
  defaultY?: number;
}

const TEXT_PRESETS: TextPreset[] = [
  // Basic
  {
    id: 'txt_default',
    name: 'Default Text',
    category: 'basic',
    previewText: 'Default Text',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '700',
    textColor: '#FFFFFF',
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    duration: 4,
    defaultY: 50,
  },
  {
    id: 'txt_heading_bold',
    name: 'Impact Heading',
    category: 'basic',
    previewText: 'BOLD HEADLINE',
    fontFamily: 'Montserrat',
    fontSize: 56,
    fontWeight: '900',
    textColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowBlur: 12,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    duration: 3.5,
    defaultY: 45,
  },
  {
    id: 'txt_pill_badge',
    name: 'Highlight Box',
    category: 'basic',
    previewText: 'MUST WATCH',
    fontFamily: 'Montserrat',
    fontSize: 36,
    fontWeight: '800',
    textColor: '#000000',
    backgroundColor: '#FACC15',
    backgroundPadding: 16,
    backgroundRadius: 8,
    duration: 3,
    defaultY: 35,
  },

  // Titles
  {
    id: 'txt_cinema_title',
    name: 'Cinematic Title',
    category: 'titles',
    previewText: 'THE CHRONICLES',
    fontFamily: 'Cinzel',
    fontSize: 52,
    fontWeight: '700',
    textColor: '#F8FAFC',
    shadowColor: 'rgba(255,255,255,0.4)',
    shadowBlur: 20,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    animationStyle: 'fade',
    duration: 4.5,
    defaultY: 50,
  },
  {
    id: 'txt_modern_clean',
    name: 'Modern Minimal',
    category: 'titles',
    previewText: 'Summer Collection',
    fontFamily: 'Inter',
    fontSize: 44,
    fontWeight: '600',
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.6)',
    backgroundPadding: 14,
    backgroundRadius: 12,
    duration: 4,
    defaultY: 50,
  },
  {
    id: 'txt_gradient_punch',
    name: 'Sunset Punch',
    category: 'titles',
    previewText: 'NEXT LEVEL',
    fontFamily: 'Montserrat',
    fontSize: 54,
    fontWeight: '900',
    textColor: '#FF007A',
    strokeColor: '#FFFFFF',
    strokeWidth: 2,
    shadowColor: 'rgba(255, 0, 122, 0.6)',
    shadowBlur: 16,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    animationStyle: 'pop',
    duration: 3.5,
    defaultY: 45,
  },

  // Lower Third
  {
    id: 'txt_lt_creator',
    name: 'Creator Lower Third',
    category: 'lower_third',
    previewText: 'John Doe | Video Creator',
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backgroundPadding: 16,
    backgroundRadius: 8,
    strokeColor: '#06B6D4',
    strokeWidth: 2,
    animationStyle: 'slide',
    duration: 5,
    defaultY: 82,
  },
  {
    id: 'txt_lt_broadcast',
    name: 'News Broadcast',
    category: 'lower_third',
    previewText: 'BREAKING NEWS // LIVE',
    fontFamily: 'Montserrat',
    fontSize: 28,
    fontWeight: '900',
    textColor: '#FFFFFF',
    backgroundColor: '#DC2626',
    backgroundPadding: 12,
    backgroundRadius: 4,
    duration: 5,
    defaultY: 85,
  },
  {
    id: 'txt_lt_minimal_bar',
    name: 'Accent Line Title',
    category: 'lower_third',
    previewText: 'Creative Director',
    fontFamily: 'Inter',
    fontSize: 30,
    fontWeight: '600',
    textColor: '#E2E8F0',
    backgroundColor: 'rgba(0,0,0,0.7)',
    backgroundPadding: 14,
    backgroundRadius: 6,
    duration: 4,
    defaultY: 80,
  },

  // Neon & Glow
  {
    id: 'txt_neon_cyan',
    name: 'Cyber Cyan Glow',
    category: 'neon',
    previewText: 'CYBERPUNK',
    fontFamily: 'Montserrat',
    fontSize: 50,
    fontWeight: '900',
    textColor: '#22D3EE',
    strokeColor: '#0891B2',
    strokeWidth: 1.5,
    shadowColor: 'rgba(6, 182, 212, 0.95)',
    shadowBlur: 24,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    duration: 4,
    defaultY: 50,
  },
  {
    id: 'txt_neon_pink',
    name: 'Electric Pink',
    category: 'neon',
    previewText: 'VIRAL DROP',
    fontFamily: 'Montserrat',
    fontSize: 50,
    fontWeight: '900',
    textColor: '#F43F5E',
    strokeColor: '#BE123C',
    strokeWidth: 1.5,
    shadowColor: 'rgba(244, 63, 94, 0.95)',
    shadowBlur: 24,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    duration: 4,
    defaultY: 50,
  },
  {
    id: 'txt_retro_gold',
    name: 'Retro Golden',
    category: 'neon',
    previewText: 'GOLDEN ERA',
    fontFamily: 'Cinzel',
    fontSize: 48,
    fontWeight: '800',
    textColor: '#FBBF24',
    shadowColor: 'rgba(217, 119, 6, 0.9)',
    shadowBlur: 18,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    duration: 4,
    defaultY: 50,
  },

  // Social
  {
    id: 'txt_soc_handle',
    name: 'Social Handle @',
    category: 'social',
    previewText: '@yourusername',
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    backgroundPadding: 14,
    backgroundRadius: 9999,
    strokeColor: 'rgba(255,255,255,0.2)',
    strokeWidth: 1,
    duration: 4.5,
    defaultY: 82,
  },
  {
    id: 'txt_soc_subscribe',
    name: 'Subscribe Callout',
    category: 'social',
    previewText: 'SUBSCRIBE & LIKE',
    fontFamily: 'Montserrat',
    fontSize: 36,
    fontWeight: '900',
    textColor: '#FFFFFF',
    backgroundColor: '#E11D48',
    backgroundPadding: 16,
    backgroundRadius: 9999,
    shadowColor: 'rgba(225, 29, 72, 0.6)',
    shadowBlur: 14,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    duration: 4,
    defaultY: 78,
  },
];

export const TextLibraryPanel: React.FC = () => {
  const {
    currentTime,
    addOverlay,
    setSelectedOverlayId,
    project,
  } = useProject();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'All', icon: Sparkles },
    { id: 'basic', label: 'Basic', icon: Type },
    { id: 'titles', label: 'Titles', icon: Layout },
    { id: 'lower_third', label: 'Lower Third', icon: AlignLeft },
    { id: 'neon', label: 'Glow / Neon', icon: Flame },
    { id: 'social', label: 'Social Callouts', icon: AtSign },
  ];

  const filteredPresets = TEXT_PRESETS.filter((p) => {
    const matchesCat = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.previewText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddPreset = (preset: TextPreset) => {
    const overlayId = `ov_txt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newOverlay: OverlayElement = {
      id: overlayId,
      type: 'text',
      name: preset.name,
      timelineStart: Math.max(0, currentTime || 0),
      timelineDuration: preset.duration || 4,
      x: 50,
      y: preset.defaultY ?? 50,
      scale: 1.0,
      opacity: 1.0,
      rotation: 0,
      text: preset.previewText,
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      textColor: preset.textColor,
      backgroundColor: preset.backgroundColor,
      backgroundPadding: preset.backgroundPadding,
      backgroundRadius: preset.backgroundRadius,
      strokeColor: preset.strokeColor,
      strokeWidth: preset.strokeWidth,
      shadowColor: preset.shadowColor,
      shadowBlur: preset.shadowBlur,
      shadowOffsetX: preset.shadowOffsetX,
      shadowOffsetY: preset.shadowOffsetY,
      animationStyle: preset.animationStyle || 'fade',
    };

    addOverlay(newOverlay);
    setSelectedOverlayId(overlayId);
  };

  const handleDragStart = (e: React.DragEvent, preset: TextPreset) => {
    const payload = {
      type: 'text-preset',
      preset,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    try {
      e.dataTransfer.effectAllowed = 'copy';
      (window as any).__cf_draggedMedia = payload;
    } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-[#121214] text-gray-200 select-none overflow-hidden font-sans">
      {/* Top Header & Search */}
      <div className="p-2.5 border-b border-[#27272a] space-y-2 bg-[#18181c] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Type className="w-4 h-4 text-forge-cyan" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Text & Titles</span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">{filteredPresets.length} presets</span>
        </div>

        {/* Quick Add Default Text Button */}
        <button
          onClick={() => handleAddPreset(TEXT_PRESETS[0])}
          className="w-full py-2 px-3 rounded-lg bg-forge-cyan hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-cyan-950 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Default Text to Timeline</span>
        </button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search text styles, titles..."
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-[#121214] border border-[#27272a] rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:border-forge-cyan"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-2 py-1.5 bg-[#121214] border-b border-[#27272a] flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-[#1e1e22] text-gray-400 hover:text-gray-200 hover:bg-[#27272a]'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Presets Grid */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredPresets.map((preset) => (
            <div
              key={preset.id}
              draggable
              onDragStart={(e) => handleDragStart(e, preset)}
              onClick={() => handleAddPreset(preset)}
              className="group relative rounded-xl bg-[#18181c] border border-[#27272a] hover:border-forge-cyan/70 p-3 flex flex-col justify-between h-28 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-950/20"
            >
              {/* Visual Live CSS Text Preview */}
              <div className="flex-1 flex items-center justify-center overflow-hidden px-1">
                <span
                  style={{
                    fontFamily: preset.fontFamily,
                    fontSize: `${Math.min(22, preset.fontSize * 0.45)}px`,
                    fontWeight: preset.fontWeight as any,
                    color: preset.textColor,
                    backgroundColor: preset.backgroundColor,
                    padding: preset.backgroundPadding ? `${preset.backgroundPadding * 0.25}px ${preset.backgroundPadding * 0.5}px` : undefined,
                    borderRadius: preset.backgroundRadius ? `${preset.backgroundRadius * 0.5}px` : undefined,
                    WebkitTextStroke: preset.strokeWidth ? `${Math.max(1, preset.strokeWidth * 0.5)}px ${preset.strokeColor}` : undefined,
                    textShadow: preset.shadowColor
                      ? `${preset.shadowOffsetX || 0}px ${preset.shadowOffsetY || 1}px ${preset.shadowBlur || 4}px ${preset.shadowColor}`
                      : undefined,
                  }}
                  className="truncate text-center select-none"
                >
                  {preset.previewText}
                </span>
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-2 border-t border-[#27272a] flex items-center justify-between text-[11px]">
                <span className="text-gray-400 group-hover:text-white font-medium truncate max-w-[120px]">
                  {preset.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddPreset(preset);
                  }}
                  className="w-5 h-5 rounded-md bg-[#27272a] group-hover:bg-forge-cyan group-hover:text-black text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
                  title="Add to timeline at playhead"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default TextLibraryPanel;
