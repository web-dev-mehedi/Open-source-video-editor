import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { ContextAwareInspector } from '../inspector/ContextAwareInspector';
import {
  Sliders,
  Film,
  Volume2,
  Layers,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';

export interface RightInspectorPanelProps {
  className?: string;
  style?: React.CSSProperties;
}

export const RightInspectorPanel: React.FC<RightInspectorPanelProps> = ({ className = '', style }) => {
  const {
    selectedClipId,
    selectedAudioClipId,
    selectedCaptionId,
    selectedOverlayId,
    selectedTransitionId,
    project,
  } = useProject();

  // Determine current selection label & icon
  const getContextInfo = () => {
    if (selectedTransitionId) {
      return { label: 'Transition Properties', icon: <Layers className="w-3.5 h-3.5 text-purple-400" /> };
    }
    if (selectedOverlayId) {
      return { label: 'Overlay / Image', icon: <ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> };
    }
    if (selectedAudioClipId) {
      return { label: 'Audio Properties', icon: <Volume2 className="w-3.5 h-3.5 text-amber-400" /> };
    }
    if (selectedCaptionId) {
      return { label: 'Caption Style & Timing', icon: <FileText className="w-3.5 h-3.5 text-forge-purple" /> };
    }
    if (selectedClipId) {
      const clip = project?.clips.find((c) => c.id === selectedClipId);
      return {
        label: clip?.mediaType === 'image' ? 'Image Clip' : 'Video Clip Properties',
        icon: <Film className="w-3.5 h-3.5 text-forge-cyan" />,
      };
    }
    return { label: 'Project & Canvas Settings', icon: <Sliders className="w-3.5 h-3.5 text-forge-cyan" /> };
  };

  const contextInfo = getContextInfo();

  return (
    <div
      style={style}
      className={`flex-shrink-0 bg-[#121214] border-l border-[#27272a] flex flex-col overflow-hidden select-none z-20 ${className}`}
    >
      {/* Sleek Contextual Inspector Header */}
      <div className="h-11 bg-[#18181c] border-b border-[#27272a] px-3 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-2">
          {contextInfo.icon}
          <span className="font-bold text-gray-200">{contextInfo.label}</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#27272a] text-gray-400 border border-[#3f3f46]">
          Inspector
        </span>
      </div>

      {/* Context-Aware Inspector Body */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#121214]">
        <ContextAwareInspector />
      </div>
    </div>
  );
};
