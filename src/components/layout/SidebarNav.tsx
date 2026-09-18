import React from 'react';
import { useProject, SidebarTabType } from '../../context/ProjectContext';
import {
  FolderOpen,
  Music,
  Type,
  MessageSquareText,
  Sparkles,
  SunMedium,
  Film,
  Smile,
  Shapes,
  Layout,
  Sliders,
} from 'lucide-react';

interface SidebarNavProps {
  isPanelOpen?: boolean;
  onTogglePanel?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ isPanelOpen = true, onTogglePanel }) => {
  const { activeSidebarTab, setActiveSidebarTab, project } = useProject();

  const footageCount = project?.footageLibrary?.length || project?.clips?.length || 0;
  const captionCount = project?.captions?.length || 0;
  const audioCount = project?.audioClips?.length || 0;

  const tabs: {
    id: SidebarTabType;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    highlight?: string;
  }[] = [
    {
      id: 'media',
      label: 'Media',
      icon: <FolderOpen className="w-4 h-4" />,
      badge: footageCount > 0 ? `${footageCount}` : undefined,
      highlight: 'text-forge-cyan',
    },
    {
      id: 'text',
      label: 'Text',
      icon: <Type className="w-4 h-4" />,
      highlight: 'text-sky-400',
    },
    {
      id: 'captions',
      label: 'Captions',
      icon: <MessageSquareText className="w-4 h-4" />,
      badge: captionCount > 0 ? `${captionCount}` : undefined,
      highlight: 'text-forge-purple',
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: <Music className="w-4 h-4" />,
      badge: audioCount > 0 ? `${audioCount}` : undefined,
      highlight: 'text-amber-400',
    },
    {
      id: 'effects',
      label: 'Effects',
      icon: <Sparkles className="w-4 h-4" />,
      highlight: 'text-pink-400',
    },
    {
      id: 'filters',
      label: 'Filters',
      icon: <SunMedium className="w-4 h-4" />,
      highlight: 'text-emerald-400',
    },
    {
      id: 'transitions',
      label: 'Transitions',
      icon: <Film className="w-4 h-4" />,
      highlight: 'text-forge-amber',
    },
    {
      id: 'stickers',
      label: 'Stickers',
      icon: <Smile className="w-4 h-4" />,
      highlight: 'text-yellow-400',
    },
    {
      id: 'elements',
      label: 'Elements',
      icon: <Shapes className="w-4 h-4" />,
      highlight: 'text-indigo-400',
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: <Layout className="w-4 h-4" />,
      highlight: 'text-purple-400',
    },
    {
      id: 'adjustments',
      label: 'Adjust',
      icon: <Sliders className="w-4 h-4" />,
      highlight: 'text-cyan-400',
    },
  ];

  const handleTabClick = (tabId: SidebarTabType) => {
    if (activeSidebarTab === tabId && isPanelOpen && onTogglePanel) {
      // Toggle collapse if clicking the currently open section
      onTogglePanel();
    } else {
      setActiveSidebarTab(tabId);
      if (!isPanelOpen && onTogglePanel) {
        onTogglePanel();
      }
    }
  };

  return (
    <div className="w-14 bg-[#121214] border-r border-[#27272a] flex flex-col items-center py-2 gap-1 select-none z-20 flex-shrink-0">
      {tabs.map((tab) => {
        const isActive =
          activeSidebarTab === tab.id ||
          (tab.id === 'media' && activeSidebarTab === 'footage') ||
          (tab.id === 'stickers' && activeSidebarTab === 'overlays') ||
          (tab.id === 'templates' && activeSidebarTab === 'styles') ||
          (tab.id === 'adjustments' && activeSidebarTab === 'video');

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative group cursor-pointer ${
              isActive && isPanelOpen
                ? `bg-[#27272a] ${tab.highlight || 'text-forge-cyan'} shadow-sm border border-[#3f3f46]`
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#18181c]'
            }`}
            title={tab.label}
          >
            {tab.icon}
            <span className="text-[8.5px] font-bold tracking-tight leading-none">{tab.label}</span>

            {tab.badge && (
              <span className="absolute top-0.5 right-0.5 px-1 py-0.2 rounded-full text-[7.5px] font-mono font-black bg-forge-cyan text-black shadow-xs">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
export default SidebarNav;
