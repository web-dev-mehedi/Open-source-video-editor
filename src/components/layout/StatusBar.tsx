import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { formatTimecode } from '../../utils/timecode';
import { Cpu, Key, Sparkles, Activity, Keyboard } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { project, currentTime, saveStatus, lastSavedAt } = useProject();
  const { settings, ffmpegStatus } = useSettings();

  return (
    <footer className="h-6 bg-canvas-dark border-t border-canvas-border px-3 flex items-center justify-between text-[10px] text-gray-500 font-mono select-none z-30 flex-shrink-0">
      {/* Left: Project & Timeline Stats */}
      <div className="flex items-center gap-3">
        {project ? (
          <>
            <span className="text-gray-300 font-semibold">
              {project.metadata.width}x{project.metadata.height} ({project.metadata.aspectRatio})
            </span>
            <span>•</span>
            <span className="text-gray-400">{project.metadata.fps} FPS</span>
            <span>•</span>
            <span className="text-gray-400">Duration: {formatTimecode(project.metadata.duration, false)}</span>
            <span>•</span>
            <span className="text-forge-cyan font-bold">Playhead: {formatTimecode(currentTime, true)}</span>
            <span>•</span>
            <span className={`font-bold ${saveStatus === 'saving' ? 'text-amber-400' : saveStatus === 'saved' ? 'text-emerald-400' : saveStatus === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? `Saved${lastSavedAt ? ' • ' + new Date(lastSavedAt).toLocaleTimeString() : ''}` : saveStatus === 'error' ? 'Save error' : 'Unsaved'}
            </span>
          </>
        ) : (
          <span className="text-gray-400">CaptionForge Desktop Pro Workspace</span>
        )}
      </div>

      {/* Right: Engine & API status & Help */}
      <div className="flex items-center gap-3">
        {/* Style Preset */}
        {project && (
          <div className="flex items-center gap-1 text-forge-purple">
            <Sparkles className="w-3 h-3" />
            <span className="truncate max-w-[130px]">{project.activeStyle.name}</span>
          </div>
        )}

        {/* FFmpeg Engine */}
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-forge-cyan" />
          <span className={ffmpegStatus.available ? 'text-gray-400' : 'text-amber-400'}>
            FFmpeg: {ffmpegStatus.available ? '60fps GPU' : 'Offline'}
          </span>
        </div>

        {/* Gemini AI Status */}
        <div className="flex items-center gap-1">
          <Key className="w-3 h-3 text-forge-amber" />
          <span className={settings.geminiApiKey ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
            Gemini AI: {settings.geminiApiKey ? 'Connected' : 'Free Demo'}
          </span>
        </div>

        {/* Shortcut Hint */}
        <div className="hidden sm:flex items-center gap-1 text-gray-500 hover:text-gray-300">
          <Keyboard className="w-3 h-3" />
          <span>Press ? for shortcuts</span>
        </div>
      </div>
    </footer>
  );
};
