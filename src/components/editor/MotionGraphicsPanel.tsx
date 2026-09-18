import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { MOTION_GRAPHIC_TEMPLATES } from '../../utils/motionGraphicsLibrary';
import { MotionGraphicTemplate, MotionGraphicCategory } from '../../types/motionGraphics';
import {
  Sparkles,
  Search,
  Check,
  ArrowDownToLine,
  Flame,
  Zap,
  Layers,
  Type,
  Video,
  Layout,
  MessageSquare,
  Share2,
} from 'lucide-react';

const CATEGORIES: { id: MotionGraphicCategory | 'all'; name: string }[] = [
  { id: 'all', name: 'All Templates' },
  { id: 'lower-third', name: 'Lower Thirds' },
  { id: 'title', name: 'Kinetic Titles' },
  { id: 'callout', name: 'Callouts' },
  { id: 'social-cta', name: 'Social CTAs' },
  { id: 'badge', name: 'Badges & News' },
];

export const MotionGraphicsPanel: React.FC = () => {
  const {
    project,
    currentTime,
    addOverlay,
    setSelectedOverlayId,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MotionGraphicCategory | 'all'>('all');
  const [appliedToastId, setAppliedToastId] = useState<string | null>(null);

  const filteredTemplates = MOTION_GRAPHIC_TEMPLATES.filter((tpl) => {
    const matchCategory = selectedCategory === 'all' || tpl.category === selectedCategory;
    const matchSearch =
      !searchQuery ||
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.defaultParams.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleApplyTemplate = (tpl: MotionGraphicTemplate) => {
    const overlayId = `ov_mogrt_${Date.now()}`;
    addOverlay({
      id: overlayId,
      type: 'motion-graphic' as any,
      name: tpl.name,
      timelineStart: currentTime,
      timelineDuration: tpl.defaultParams.durationInSeconds || 3.5,
      x: tpl.defaultParams.x,
      y: tpl.defaultParams.y,
      scale: tpl.defaultParams.scale,
      opacity: tpl.defaultParams.opacity,
      title: tpl.defaultParams.title,
      subtitle: tpl.defaultParams.subtitle,
      textColor: tpl.defaultParams.textColor,
      backgroundColor: tpl.defaultParams.backgroundColor,
      fontFamily: tpl.defaultParams.fontFamily,
      fontSize: tpl.defaultParams.fontSize,
      animationStyle: tpl.defaultParams.animationStyle as any,
      templateId: tpl.id,
      motionParams: { ...tpl.defaultParams },
    } as any);

    setSelectedOverlayId(overlayId);
    setAppliedToastId(tpl.id);
    setTimeout(() => setAppliedToastId(null), 1800);
  };

  return (
    <div className="flex h-full bg-[#18181b] text-gray-200 select-none overflow-hidden font-sans">
      {/* Left Sub-Category Side Navigation (CapCut Style) */}
      <div className="w-28 bg-[#121214] border-r border-[#27272a] p-2 flex flex-col gap-1 flex-shrink-0 overflow-y-auto no-scrollbar">
        <div className="px-2 py-1 text-[11px] font-bold text-gray-400">Library</div>
        <div className="px-2 py-1 text-[11px] font-bold text-forge-cyan flex items-center justify-between">
          <span>MOGRT</span>
          <span className="text-[10px]">⌄</span>
        </div>

        <div className="space-y-0.5 mt-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'text-forge-cyan bg-[#27272a]/70 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e1e22]'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Grid Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#18181b]">
        {/* Search Header */}
        <div className="p-3 border-b border-[#27272a] space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search motion graphics templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#27272a]/60 border border-[#3f3f46]/50 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-forge-cyan"
            />
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-gray-300">
            <span className="capitalize">{selectedCategory === 'all' ? 'Popular Templates' : selectedCategory}</span>
            <span className="text-[10px] text-gray-500 font-mono">{filteredTemplates.length} items</span>
          </div>
        </div>

        {/* 2-Column Template Card Grid with Live Preview & Drag-and-Drop */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 content-start no-scrollbar">
          {filteredTemplates.map((tpl) => {
            const isApplied = appliedToastId === tpl.id;

            return (
              <div
                key={tpl.id}
                draggable
                onDragStart={(e) => {
                  const obj = { type: 'motion-graphic', template: tpl };
                  e.dataTransfer.setData('text/plain', JSON.stringify(obj));
                  e.dataTransfer.setData('application/json', JSON.stringify(obj));
                  try {
                    e.dataTransfer.effectAllowed = 'copy';
                    (window as any).__cf_draggedMedia = obj;
                  } catch {}
                }}
                onClick={() => handleApplyTemplate(tpl)}
                className="flex flex-col items-center cursor-grab active:cursor-grabbing group select-none transition-transform"
                title={`Drag to timeline or click to add: ${tpl.name} - ${tpl.description}`}
              >
                {/* Visual Thumbnail Card with Live Hover Animation */}
                <div
                  className={`w-full aspect-[16/10] rounded-2xl bg-gradient-to-br ${tpl.bgGradient} relative overflow-hidden border border-[#3f3f46]/60 transition-all group-hover:border-forge-cyan group-hover:scale-[1.03] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] shadow-lg flex flex-col justify-between p-3`}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between z-10">
                    <span className="px-1.5 py-0.5 rounded-md bg-[#8b5cf6]/90 text-white text-[8px] font-black tracking-wider shadow">
                      {tpl.badge || 'MOGRT'}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400 bg-black/60 px-1.5 py-0.5 rounded">
                      {tpl.defaultParams.durationInSeconds}s
                    </span>
                  </div>

                  {/* Animated Miniature Preview Center */}
                  <div className="relative z-10 flex flex-col items-center justify-center text-center">
                    <div
                      style={{ borderColor: tpl.accentColor }}
                      className="px-2.5 py-1 rounded-md bg-black/50 border backdrop-blur-xs flex items-center gap-1.5 group-hover:scale-110 transition-transform duration-200"
                    >
                      <Type className="w-3.5 h-3.5 text-forge-cyan group-hover:animate-pulse" />
                      <span className="text-[11px] font-black text-white truncate max-w-[110px]">
                        {tpl.defaultParams.title}
                      </span>
                    </div>
                    {tpl.defaultParams.subtitle && (
                      <span className="text-[9px] text-gray-300 mt-1 truncate max-w-[120px] opacity-80">
                        {tpl.defaultParams.subtitle}
                      </span>
                    )}
                  </div>

                  {/* Bottom Action Icon */}
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[9px] font-bold text-gray-400 capitalize">
                      {tpl.category.replace('-', ' ')}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-black/70 hover:bg-forge-cyan hover:text-black text-white flex items-center justify-center transition-colors shadow-sm">
                      {isApplied ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <ArrowDownToLine className="w-3 h-3" />
                      )}
                    </div>
                  </div>

                  {/* Glass Reflection Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10 group-hover:opacity-40 transition-opacity" />
                </div>

                {/* Title */}
                <span className="text-[11px] font-semibold text-gray-300 mt-1.5 text-center truncate w-full group-hover:text-forge-cyan transition-colors">
                  {tpl.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
