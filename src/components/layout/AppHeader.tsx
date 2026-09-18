import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { AspectRatio } from '../../types/project';
import {
  Sparkles,
  Undo2,
  Redo2,
  Save,
  Download,
  Settings,
  Keyboard,
  ChevronLeft,
  Sliders,
  SunMedium,
  Volume2,
  Film,
  Smartphone,
  Square,
  Check,
  Zap,
  Command,
  History,
} from 'lucide-react';

interface AppHeaderProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenExport: () => void;
  onOpenCommandPalette?: () => void;
  onOpenVersionHistory?: () => void;
}

export type WorkspaceMode = 'edit' | 'color' | 'audio' | 'export';

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenSettings,
  onOpenShortcuts,
  onOpenExport,
  onOpenCommandPalette,
  onOpenVersionHistory,
}) => {
  const {
    project,
    closeProject,
    saveProject,
    undo,
    redo,
    canUndo,
    canRedo,
    activeSidebarTab,
    setActiveSidebarTab,
    setProjectAspectRatio,
    saveStatus,
    renameProject,
  } = useProject();

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('edit');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>(project?.metadata?.name || 'Untitled Project');

  useEffect(() => {
    if (project?.metadata?.name) setProjectTitle(project.metadata.name);
  }, [project?.metadata?.name]);

  const handleModeChange = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    if (mode === 'edit') setActiveSidebarTab('footage');
    else if (mode === 'color') setActiveSidebarTab('effects');
    else if (mode === 'audio') setActiveSidebarTab('footage');
    else if (mode === 'export') onOpenExport();
  };

  const handleTitleSubmit = () => {
    if (project && projectTitle.trim() && projectTitle.trim() !== project.metadata.name) {
      renameProject(project.metadata.id, projectTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const currentRatio: AspectRatio = project?.metadata.aspectRatio || '9:16';

  return (
    <header className="h-11 bg-workspace-bg border-b border-workspace-border px-3 flex items-center justify-between select-none z-30 flex-shrink-0">
      {/* Left: Brand Logo + Project Name */}
      <div className="flex items-center gap-3">
        {project && (
          <button
            onClick={closeProject}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-workspace-panel hover:bg-workspace-elevated border border-workspace-border text-[11px] font-semibold text-gray-300 transition-colors"
            title="Return to Projects Dashboard"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 pr-2 border-r border-workspace-border">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-workspace-violet to-workspace-cyan flex items-center justify-center text-black shadow-sm shadow-cyan-950/50">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-black text-xs text-white tracking-wider">
            CAPTION<span className="text-workspace-cyan">FORGE</span>
          </span>
          <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-workspace-cyan/15 text-workspace-cyan border border-workspace-cyan/30">
            NLE 2.0
          </span>
        </div>

        {/* Inline Editable Project Title + Save Status */}
        {project && (
          <div className="hidden lg:flex items-center gap-2">
            {isEditingTitle ? (
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                autoFocus
                className="bg-workspace-panel border border-workspace-cyan text-white text-xs px-2 py-0.5 rounded focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-xs font-semibold text-gray-300 hover:text-white px-2 py-0.5 rounded hover:bg-workspace-panel transition-colors max-w-[200px] truncate"
                title="Click to rename project"
              >
                {project.metadata?.name || 'Untitled Project'}
              </button>
            )}
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${saveStatus === 'saved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : saveStatus === 'saving' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-gray-500/10 text-gray-400 border-white/10'}`}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Unsaved'}
            </span>
          </div>
        )}
      </div>

      {/* Center: Workspace Mode Switcher (Edit, Color, Audio, Export) — only inside editor */}
      {project && (
        <div className="hidden md:flex items-center gap-1 p-0.5 rounded-lg bg-workspace-panel border border-workspace-border">
          {[
            { id: 'edit', label: 'Edit', icon: <Sliders className="w-3.5 h-3.5" /> },
            { id: 'color', label: 'Color', icon: <SunMedium className="w-3.5 h-3.5" /> },
            { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3.5 h-3.5" /> },
            { id: 'export', label: 'Deliver', icon: <Download className="w-3.5 h-3.5" /> },
          ].map((mode) => {
            const isActive = workspaceMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id as WorkspaceMode)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-workspace-elevated text-workspace-cyan border border-workspace-border shadow-xs'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-workspace-elevated/40'
                }`}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right: Aspect Ratio, Undo/Redo & Glowing Export Button */}
      <div className="flex items-center gap-2">
        {/* Aspect Ratio Selector */}
        {project && (
          <div className="flex items-center gap-0.5 bg-workspace-panel p-0.5 rounded-lg border border-workspace-border text-xs">
            {[
              { id: '9:16', label: '9:16' },
              { id: '16:9', label: '16:9' },
              { id: '1:1', label: '1:1' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setProjectAspectRatio(r.id as AspectRatio)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  currentRatio === r.id
                    ? 'bg-workspace-cyan text-black shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Undo/Redo/Save Toolbar */}
        {project && (
          <div className="flex items-center gap-1 bg-workspace-panel p-0.5 rounded-lg border border-workspace-border">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 hover:bg-workspace-elevated transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 hover:bg-workspace-elevated transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-workspace-border mx-0.5" />
            <button
              onClick={saveProject}
              className="p-1 rounded text-gray-400 hover:text-workspace-cyan hover:bg-workspace-elevated transition-colors"
              title="Save Project (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-workspace-panel border border-transparent hover:border-workspace-border transition-all"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>

        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-workspace-panel border border-transparent hover:border-workspace-border transition-all"
            title="Command Palette (Ctrl+K) — Feature 35"
          >
            <Command className="w-3.5 h-3.5" />
          </button>
        )}

        {onOpenVersionHistory && project && (
          <button
            onClick={onOpenVersionHistory}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-workspace-panel border border-transparent hover:border-workspace-border transition-all"
            title="Version History (Ctrl+Shift+V) — Feature 38"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-workspace-panel border border-transparent hover:border-workspace-border transition-all"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {project && (
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-workspace-cyan text-black font-extrabold text-xs shadow-lg shadow-cyan-950/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Export</span>
          </button>
        )}
      </div>
    </header>
  );
};
