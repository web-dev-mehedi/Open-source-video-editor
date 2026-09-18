import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CaptionInspector } from './CaptionInspector';
import { VideoInspector } from './VideoInspector';
import { AudioInspector } from './AudioInspector';
import { ImageInspector } from './ImageInspector';
import { TextInspector } from './TextInspector';
import { TransitionInspectorWrapper } from './TransitionInspectorWrapper';
import { MultiInspector } from './MultiInspector';
import { isImageFile } from '../../utils/mediaLoader';
import { AspectRatio } from '../../types/project';
import {
  Sliders,
  Sparkles,
  Smartphone,
  Monitor,
  Square,
  Clock,
  Film,
  Layers,
  Palette,
  Volume2,
  FileText,
  Download,
  Folder,
  FolderOpen,
} from 'lucide-react';

export const ContextAwareInspector: React.FC = () => {
  const {
    project,
    selectedCaptionId,
    selectedClipId,
    selectedAudioClipId,
    selectedOverlayId,
    selectedTransitionId,
    setProjectAspectRatio,
    setProjectExportFolder,
    setActiveSidebarTab,
  } = useProject();

  const [multiIds, setMultiIds] = useState<string[]>([]);

  useEffect(() => {
    const h = (e: any) => setMultiIds(e.detail?.clipIds || []);
    window.addEventListener('cf_smart_select' as any, h);
    return () => window.removeEventListener('cf_smart_select' as any, h);
  }, []);

  if (multiIds.length >= 2) return <MultiInspector />;
  if (selectedTransitionId) return <TransitionInspectorWrapper />;
  if (selectedOverlayId) {
    const overlay = project?.overlays?.find((ov) => ov.id === selectedOverlayId);
    if (overlay?.type === 'text' || overlay?.type === 'element' || overlay?.type === 'motion-graphic') {
      return <TextInspector />;
    }
    return <ImageInspector />;
  }
  if (selectedAudioClipId) return <AudioInspector />;
  if (selectedCaptionId) return <CaptionInspector />;
  if (selectedClipId) {
    const clip = project?.clips.find((c) => c.id === selectedClipId);
    const isImage = clip?.mediaType === 'image' || isImageFile(clip?.name || clip?.filePath || '');
    if (isImage) return <ImageInspector />;
    return <VideoInspector />;
  }

  // Nothing selected — Show Project Settings & Canvas Inspector (CapCut / Premiere Pro Workflow)
  const currentRatio: AspectRatio = project?.metadata.aspectRatio || '9:16';
  const width = project?.metadata.width || (currentRatio === '16:9' ? 1920 : 1080);
  const height = project?.metadata.height || (currentRatio === '16:9' ? 1080 : currentRatio === '1:1' ? 1080 : 1920);
  const duration = project?.metadata.duration || 0;
  const clipCount = project?.clips?.length || 0;
  const captionCount = project?.captions?.length || 0;
  const audioCount = project?.audioClips?.length || 0;

  const handleSelectExportFolder = async () => {
    try {
      const chosen = await window.captionForgeAPI?.selectFolderDialog();
      if (chosen) {
        setProjectExportFolder(chosen);
      }
    } catch (e) {
      console.error('Failed to choose export folder:', e);
    }
  };

  const handleOpenExportFolder = () => {
    const target = project?.metadata.exportFolder;
    if (target && window.captionForgeAPI?.openFolderInExplorer) {
      window.captionForgeAPI.openFolderInExplorer(target);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#121214] text-gray-200 overflow-y-auto select-none">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-forge-cyan" />
          <span className="text-xs font-black tracking-wider uppercase text-white">Project Settings</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#27272a] text-gray-400">
          Canvas
        </span>
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* Project Name & Duration Banner */}
        <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
          <div className="text-gray-400 text-[11px]">Active Project</div>
          <div className="text-white font-bold text-sm truncate">{project?.metadata.name || 'Untitled Project'}</div>
          <div className="flex items-center justify-between pt-1 border-t border-[#27272a] text-[11px] text-gray-400 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-forge-cyan" />
              Duration: {duration.toFixed(2)}s
            </span>
            <span>{project?.metadata.fps || 30} FPS</span>
          </div>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
            Canvas Aspect Ratio
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: '9:16', label: '9:16 TikTok', icon: <Smartphone className="w-3.5 h-3.5" /> },
              { id: '16:9', label: '16:9 YouTube', icon: <Monitor className="w-3.5 h-3.5" /> },
              { id: '1:1', label: '1:1 Square', icon: <Square className="w-3.5 h-3.5" /> },
              { id: '4:5', label: '4:5 Portrait', icon: <Smartphone className="w-3.5 h-3.5" /> },
            ].map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setProjectAspectRatio(ratio.id as AspectRatio)}
                className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all text-center ${
                  currentRatio === ratio.id
                    ? 'bg-[#27272a] border-forge-cyan text-white shadow-sm'
                    : 'bg-[#18181c] border-[#27272a] text-gray-400 hover:text-gray-200 hover:bg-[#202024]'
                }`}
              >
                {ratio.icon}
                <span className="text-[10px] font-bold">{ratio.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resolution Info */}
        <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
          <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Canvas Dimensions</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-[#121214] border border-[#27272a]">
              <span className="text-gray-500 block text-[10px]">Width</span>
              <span className="text-white font-mono font-bold">{width}px</span>
            </div>
            <div className="p-2 rounded bg-[#121214] border border-[#27272a]">
              <span className="text-gray-500 block text-[10px]">Height</span>
              <span className="text-white font-mono font-bold">{height}px</span>
            </div>
          </div>
        </div>

        {/* Export Destination Configuration */}
        <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-forge-cyan" />
              Export Folder
            </span>
            <button
              onClick={handleSelectExportFolder}
              className="text-[10px] font-bold text-forge-cyan hover:underline"
            >
              Change
            </button>
          </div>
          <div className="p-2 rounded bg-[#121214] border border-[#27272a] flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-gray-300 truncate" title={project?.metadata.exportFolder || 'Default (Videos/CaptionForge)'}>
              {project?.metadata.exportFolder || 'Default (Videos/CaptionForge)'}
            </span>
            {project?.metadata.exportFolder && (
              <button
                onClick={handleOpenExportFolder}
                title="Open Folder"
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#27272a] transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-500">
            Exports will save directly to this location without prompting each time.
          </p>
        </div>

        {/* Timeline Summary Stats */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Project Assets</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] flex flex-col items-center">
              <Film className="w-3.5 h-3.5 text-forge-cyan mb-1" />
              <span className="text-base font-mono font-black text-white">{clipCount}</span>
              <span className="text-[10px] text-gray-400">Video Clips</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] flex flex-col items-center">
              <FileText className="w-3.5 h-3.5 text-forge-purple mb-1" />
              <span className="text-base font-mono font-black text-white">{captionCount}</span>
              <span className="text-[10px] text-gray-400">Captions</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] flex flex-col items-center">
              <Volume2 className="w-3.5 h-3.5 text-amber-400 mb-1" />
              <span className="text-base font-mono font-black text-white">{audioCount}</span>
              <span className="text-[10px] text-gray-400">Audio Clips</span>
            </div>
          </div>
        </div>

        {/* Quick Workflow Shortcuts */}
        <div className="pt-2 space-y-2 border-t border-[#27272a]">
          <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Quick Actions</div>
          <button
            onClick={() => setActiveSidebarTab('captions')}
            className="w-full py-2 px-3 rounded-lg bg-[#27272a] hover:bg-[#323238] border border-[#3f3f46] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-forge-purple" />
            <span>AI Auto-Caption Video</span>
          </button>
          <button
            onClick={() => setActiveSidebarTab('styles')}
            className="w-full py-2 px-3 rounded-lg bg-[#27272a] hover:bg-[#323238] border border-[#3f3f46] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Palette className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Browse Caption Presets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
