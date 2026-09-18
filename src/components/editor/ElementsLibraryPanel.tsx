import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { OverlayElement } from '../../types/project';
import {
  Sparkles,
  Plus,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  Heart,
  Share2,
  Bell,
  Star,
  Flame,
  MessageCircle,
  Bookmark,
  ShieldCheck,
  Zap,
  Tag,
  Smile,
  Shapes,
} from 'lucide-react';

interface ElementItem {
  id: string;
  name: string;
  category: 'arrows' | 'badges' | 'social' | 'shapes';
  icon: React.ReactNode;
  duration: number;
  defaultColor?: string;
  defaultBg?: string;
}

const ELEMENT_ITEMS: ElementItem[] = [
  // Arrows
  {
    id: 'el_arrow_right',
    name: 'Arrow Right',
    category: 'arrows',
    icon: <ArrowRight className="w-8 h-8 text-forge-cyan stroke-[2.5]" />,
    duration: 3,
    defaultColor: '#06B6D4',
  },
  {
    id: 'el_zap',
    name: 'Lightning Bolt',
    category: 'arrows',
    icon: <Zap className="w-8 h-8 text-amber-400 fill-amber-400" />,
    duration: 3,
    defaultColor: '#FBBF24',
  },
  {
    id: 'el_star',
    name: 'Golden Star',
    category: 'arrows',
    icon: <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />,
    duration: 3,
    defaultColor: '#FACC15',
  },
  {
    id: 'el_flame',
    name: 'Viral Fire',
    category: 'arrows',
    icon: <Flame className="w-8 h-8 text-rose-500 fill-rose-500" />,
    duration: 3,
    defaultColor: '#F43F5E',
  },

  // Badges
  {
    id: 'el_badge_verified',
    name: 'Verified Badge',
    category: 'badges',
    icon: <ShieldCheck className="w-8 h-8 text-sky-400 fill-sky-400/20" />,
    duration: 4,
    defaultColor: '#38BDF8',
  },
  {
    id: 'el_check_circle',
    name: 'Approved Check',
    category: 'badges',
    icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
    duration: 3,
    defaultColor: '#34D399',
  },
  {
    id: 'el_alert_circle',
    name: 'Warning Alert',
    category: 'badges',
    icon: <AlertCircle className="w-8 h-8 text-rose-500" />,
    duration: 3,
    defaultColor: '#EF4444',
  },

  // Social
  {
    id: 'el_thumbs_up',
    name: 'Like Thumb',
    category: 'social',
    icon: <ThumbsUp className="w-8 h-8 text-blue-500 fill-blue-500/30" />,
    duration: 3.5,
    defaultColor: '#3B82F6',
  },
  {
    id: 'el_heart',
    name: 'Red Heart',
    category: 'social',
    icon: <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />,
    duration: 3.5,
    defaultColor: '#F43F5E',
  },
  {
    id: 'el_share',
    name: 'Share Icon',
    category: 'social',
    icon: <Share2 className="w-8 h-8 text-emerald-400" />,
    duration: 3.5,
    defaultColor: '#10B981',
  },
  {
    id: 'el_bell',
    name: 'Subscribe Bell',
    category: 'social',
    icon: <Bell className="w-8 h-8 text-amber-400 fill-amber-400" />,
    duration: 3.5,
    defaultColor: '#F59E0B',
  },
  {
    id: 'el_comment',
    name: 'Comment Bubble',
    category: 'social',
    icon: <MessageCircle className="w-8 h-8 text-purple-400 fill-purple-400/20" />,
    duration: 3.5,
    defaultColor: '#C084FC',
  },
  {
    id: 'el_bookmark',
    name: 'Save Bookmark',
    category: 'social',
    icon: <Bookmark className="w-8 h-8 text-yellow-400 fill-yellow-400" />,
    duration: 3.5,
    defaultColor: '#EAB308',
  },
];

export const ElementsLibraryPanel: React.FC = () => {
  const { currentTime, addOverlay, setSelectedOverlayId } = useProject();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'All', icon: Sparkles },
    { id: 'arrows', label: 'Pointers & Icons', icon: ArrowRight },
    { id: 'badges', label: 'Badges', icon: ShieldCheck },
    { id: 'social', label: 'Social Engagement', icon: ThumbsUp },
  ];

  const filteredItems = ELEMENT_ITEMS.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddElement = (item: ElementItem) => {
    const overlayId = `ov_el_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newOverlay: OverlayElement = {
      id: overlayId,
      type: 'element',
      name: item.name,
      timelineStart: Math.max(0, currentTime || 0),
      timelineDuration: item.duration || 3,
      x: 50,
      y: 50,
      scale: 1.0,
      opacity: 1.0,
      textColor: item.defaultColor || '#FFFFFF',
      title: item.name,
      animationStyle: 'pop',
    };

    addOverlay(newOverlay);
    setSelectedOverlayId(overlayId);
  };

  const handleDragStart = (e: React.DragEvent, item: ElementItem) => {
    const payload = {
      type: 'element-preset',
      item,
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
      {/* Search Header */}
      <div className="p-2.5 border-b border-[#27272a] space-y-2 bg-[#18181c] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shapes className="w-4 h-4 text-forge-purple" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Elements & Badges</span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">{filteredItems.length} items</span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search arrows, icons, badges..."
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-[#121214] border border-[#27272a] rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:border-forge-purple"
          />
        </div>
      </div>

      {/* Category Tabs */}
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

      {/* Elements Grid */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => handleAddElement(item)}
              className="group relative rounded-xl bg-[#18181c] border border-[#27272a] hover:border-forge-purple/70 p-3 flex flex-col items-center justify-between h-28 cursor-pointer transition-all hover:shadow-lg hover:shadow-purple-950/20"
            >
              <div className="flex-1 flex items-center justify-center group-hover:scale-110 transition-transform">
                {item.icon}
              </div>

              <div className="w-full pt-1.5 border-t border-[#27272a] flex items-center justify-between text-[10px]">
                <span className="text-gray-400 group-hover:text-white font-medium truncate max-w-[80px]">
                  {item.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddElement(item);
                  }}
                  className="w-4 h-4 rounded bg-[#27272a] group-hover:bg-forge-purple group-hover:text-white text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
                  title="Add to timeline"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default ElementsLibraryPanel;
