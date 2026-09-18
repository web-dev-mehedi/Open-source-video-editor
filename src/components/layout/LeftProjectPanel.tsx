import React, { useState, useEffect } from 'react';
import { useProject, SidebarTabType } from '../../context/ProjectContext';
import { MediaFootagePanel } from '../editor/MediaFootagePanel';
import { TextLibraryPanel } from '../editor/TextLibraryPanel';
import { CaptionEditor } from '../editor/CaptionEditor';
import { StylePresetSelector } from '../editor/StylePresetSelector';
import { EffectsPanel } from '../editor/EffectsPanel';
import { TransitionsPanel } from '../editor/TransitionsPanel';
import { FiltersPanel } from '../editor/FiltersPanel';
import { OverlaysPanel } from '../editor/OverlaysPanel';
import { ElementsLibraryPanel } from '../editor/ElementsLibraryPanel';
import { MotionGraphicsPanel } from '../editor/MotionGraphicsPanel';
import { TranscriptVideoEditor } from '../editor/TranscriptVideoEditor';
import { AudioFilterStudio } from '../audio/AudioFilterStudio';
import { VideoTools } from '../editor/VideoTools';

export interface LeftProjectPanelProps {
  className?: string;
  style?: React.CSSProperties;
}

export const LeftProjectPanel: React.FC<LeftProjectPanelProps> = ({ className = '', style }) => {
  const { activeSidebarTab, setActiveSidebarTab } = useProject();

  const tab = activeSidebarTab;

  return (
    <div
      style={style}
      className={`flex-shrink-0 bg-[#141418] border-r border-[#27272a] flex flex-col overflow-hidden select-none z-20 ${className}`}
    >
      {/* Active Section Content View */}
      <div className="flex-1 overflow-hidden h-full">
        {(tab === 'media' || tab === 'footage') && <MediaFootagePanel />}
        {tab === 'text' && <TextLibraryPanel />}
        {tab === 'captions' && <CaptionEditor />}
        {tab === 'transcript' && <TranscriptVideoEditor />}
        {tab === 'audio' && <AudioFilterStudio />}
        {tab === 'effects' && <EffectsPanel />}
        {tab === 'filters' && <FiltersPanel />}
        {tab === 'transitions' && <TransitionsPanel />}
        {(tab === 'stickers' || tab === 'overlays') && <OverlaysPanel />}
        {tab === 'elements' && <ElementsLibraryPanel />}
        {(tab === 'templates' || tab === 'styles' || tab === 'customizer') && <StylePresetSelector />}
        {tab === 'mogrt' && <MotionGraphicsPanel />}
        {(tab === 'adjustments' || tab === 'video') && <VideoTools />}
      </div>
    </div>
  );
};
export default LeftProjectPanel;
