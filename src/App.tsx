import React, { useState, useEffect, useRef } from 'react';
import { useProject } from './context/ProjectContext';
import { AppHeader } from './components/layout/AppHeader';
import { SidebarNav } from './components/layout/SidebarNav';
import { LeftProjectPanel } from './components/layout/LeftProjectPanel';
import { RightInspectorPanel } from './components/layout/RightInspectorPanel';
import { StatusBar } from './components/layout/StatusBar';
import { Dashboard } from './components/dashboard/Dashboard';
import { VideoPlayer } from './components/player/VideoPlayer';
import { Timeline } from './components/timeline/Timeline';
import { ExportModal } from './components/export/ExportModal';
import { ExportProgressModal } from './components/export/ExportProgressModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ShortcutsModal } from './components/settings/ShortcutsModal';
import { CustomShortcutsModal } from './components/settings/CustomShortcutsModal';
import { CommandPalette } from './components/command/CommandPalette';
import { VersionHistoryModal } from './components/version/VersionHistoryModal';
import { ExportSettings, ExportProgress } from './types/export';
import { executeWebExport, cancelWebExport } from './utils/webExportEngine';
import { subscribeBgTasks, BgTask } from './utils/backgroundProcessor';
import { pickExportDestinationFolder, sanitizeFileName, joinExportPath } from './services/export/destinationService';

export const App: React.FC = () => {
  const {
    project,
    currentTime,
    setCurrentTime,
    setActiveSidebarTab,
    togglePlayPause,
    toggleMagnetMode,
    splitClipAtPlayhead,
    splitAudioClipAtPlayhead,
    deleteClip,
    deleteAudioClip,
    deleteCaptionLine,
    deleteOverlay,
    selectedClipId,
    selectedAudioClipId,
    selectedCaptionId,
    selectedOverlayId,
    selectedTransitionId,
    deleteTransition,
    undo,
    redo,
    saveProject,
    trimClipLeftToPlayhead,
    trimClipRightToPlayhead,
    toggleCropMode,
    setProjectExportFolder,
  } = useProject();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExportProgressOpen, setIsExportProgressOpen] = useState(false);
  const [bgTasks, setBgTasks] = useState<BgTask[]>([]);

  // Resizable Workspace Panels & Timeline Layout
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('cf_left_panel_open');
    return saved !== null ? saved === 'true' : true;
  });

  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('cf_left_panel_w');
    return saved ? parseInt(saved, 10) : 310;
  });

  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('cf_right_panel_w');
    return saved ? parseInt(saved, 10) : 310;
  });

  const [timelineHeight, setTimelineHeight] = useState<number>(() => {
    const saved = localStorage.getItem('cf_timeline_h');
    return saved ? parseInt(saved, 10) : 220;
  });

  const [isDraggingLeftResizer, setIsDraggingLeftResizer] = useState(false);
  const [isDraggingRightResizer, setIsDraggingRightResizer] = useState(false);
  const [isDraggingTimelineResizer, setIsDraggingTimelineResizer] = useState(false);

  // Left Panel Resizer Drag
  const handleLeftResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeftResizer(true);
    const startX = e.clientX;
    const startW = leftPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newW = Math.max(200, Math.min(Math.floor(window.innerWidth * 0.45), startW + deltaX));
      setLeftPanelWidth(newW);
      localStorage.setItem('cf_left_panel_w', newW.toString());
    };

    const onMouseUp = () => {
      setIsDraggingLeftResizer(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Right Panel Resizer Drag
  const handleRightResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRightResizer(true);
    const startX = e.clientX;
    const startW = rightPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newW = Math.max(200, Math.min(Math.floor(window.innerWidth * 0.45), startW + deltaX));
      setRightPanelWidth(newW);
      localStorage.setItem('cf_right_panel_w', newW.toString());
    };

    const onMouseUp = () => {
      setIsDraggingRightResizer(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Timeline Height Resizer Drag
  const handleTimelineResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTimelineResizer(true);
    const startY = e.clientY;
    const startH = timelineHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newH = Math.max(120, Math.min(Math.floor(window.innerHeight * 0.65), startH + deltaY));
      setTimelineHeight(newH);
      localStorage.setItem('cf_timeline_h', newH.toString());
    };

    const onMouseUp = () => {
      setIsDraggingTimelineResizer(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Unified Global Hotkeys Engine
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');

      // 1. Save Project: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProject();
        return;
      }

      // 2. Export Project: Ctrl+E / Cmd+E
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (project) setIsExportOpen(true);
        return;
      }

      // 2b. Command Palette: Ctrl+K / Cmd+K (Feature 35)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((v) => !v);
        return;
      }
      // Version History: Ctrl+Shift+V
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (project) setIsVersionOpen(true);
        return;
      }

      // 3. Undo: Ctrl+Z / Cmd+Z (without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault();
          undo();
          return;
        }
      }

      // 4. Redo: Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (!isInput) {
          e.preventDefault();
          redo();
          return;
        }
      }

      // If typing inside an input field or text area, do not intercept regular editor hotkeys
      if (isInput) return;

      // 5. Play / Pause: Space or K
      if (e.code === 'Space' || e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      // 6. Split Clip or Audio at Playhead: S OR Ctrl+B (CapCut standard)
      if (
        (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b')
      ) {
        e.preventDefault();
        if (selectedAudioClipId) {
          splitAudioClipAtPlayhead();
        } else if (selectedClipId) {
          splitClipAtPlayhead();
        } else {
          splitClipAtPlayhead();
          splitAudioClipAtPlayhead();
        }
        return;
      }

      // 6b. Trim Left / In-Point to Playhead: Q
      if (e.key.toLowerCase() === 'q' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        trimClipLeftToPlayhead(selectedClipId || undefined);
        return;
      }

      // 6c. Trim Right / Out-Point to Playhead: W
      if (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        trimClipRightToPlayhead(selectedClipId || undefined);
        return;
      }

      // 7. Toggle Magnet Mode: N or M
      if ((e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'm') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleMagnetMode();
        return;
      }

      // 8. Delete Selected Item: Delete or Backspace (Shift+Del forces Ripple Delete)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const forceRipple = e.shiftKey;
        if (selectedCaptionId) {
          e.preventDefault();
          deleteCaptionLine(selectedCaptionId);
        } else if (selectedAudioClipId) {
          e.preventDefault();
          deleteAudioClip(selectedAudioClipId);
        } else if (selectedOverlayId) {
          e.preventDefault();
          deleteOverlay(selectedOverlayId);
        } else if (selectedTransitionId) {
          e.preventDefault();
          deleteTransition(selectedTransitionId);
        } else if (selectedClipId) {
          e.preventDefault();
          deleteClip(selectedClipId, forceRipple);
        }
        return;
      }

      // 8. Step Forward / Backward: Left / Right Arrow (Shift = 1.0s, normal = 0.1s)
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!isFinite(currentTime)) { setCurrentTime(0); return; }
        const step = e.shiftKey ? 1.0 : 0.1;
        const next = currentTime - step;
        if (!isFinite(next)) return;
        setCurrentTime(Math.max(0, next));
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!isFinite(currentTime)) { setCurrentTime(0); return; }
        const step = e.shiftKey ? 1.0 : 0.1;
        const maxDur = isFinite(project?.metadata.duration || 0) ? (project?.metadata.duration || 300) : 300;
        const next = currentTime + step;
        if (!isFinite(next)) return;
        setCurrentTime(Math.min(maxDur, next));
        return;
      }

      // 9. Shuttle Controls: J (rewind 1s) / L (forward 1s)
      if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (!isFinite(currentTime)) { setCurrentTime(0); return; }
        setCurrentTime(Math.max(0, currentTime - 1.0));
        return;
      }

      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (!isFinite(currentTime)) { setCurrentTime(0); return; }
        const maxDur = isFinite(project?.metadata.duration || 0) ? (project?.metadata.duration || 300) : 300;
        const next = currentTime + 1.0;
        if (!isFinite(next)) return;
        setCurrentTime(Math.min(maxDur, next));
        return;
      }

      // 10. Home / End: Start / End of Timeline
      if (e.key === 'Home') {
        e.preventDefault();
        setCurrentTime(0);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        const dur = isFinite(project?.metadata.duration || 0) ? (project?.metadata.duration || 0) : 0;
        setCurrentTime(dur);
        return;
      }

      // 11. Crop Tool / Tab Switching: C (Crop Video if clip exists, else Captions), T (Templates/Styles)
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (selectedClipId || (project?.clips && project.clips.length > 0)) {
          toggleCropMode();
        } else {
          setActiveSidebarTab('captions');
        }
        return;
      }

      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveSidebarTab('styles');
        return;
      }

      // 12. Shortcuts Cheat-Sheet Modal: ? or F1
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    project,
    currentTime,
    saveProject,
    togglePlayPause,
    toggleMagnetMode,
    splitClipAtPlayhead,
    splitAudioClipAtPlayhead,
    deleteClip,
    deleteAudioClip,
    deleteCaptionLine,
    deleteOverlay,
    selectedClipId,
    selectedAudioClipId,
    selectedCaptionId,
    selectedOverlayId,
    selectedTransitionId,
    deleteTransition,
    undo,
    redo,
    setCurrentTime,
    setActiveSidebarTab,
  ]);

  // Listen to native export progress events
  useEffect(() => {
    if (window.captionForgeAPI?.onExportProgress) {
      const unsubscribe = window.captionForgeAPI.onExportProgress((progress) => {
        setExportProgress(progress);
        if (progress.status === 'rendering' || progress.status === 'completed' || progress.status === 'failed') {
          setIsExportProgressOpen(true);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeBgTasks(setBgTasks);
    return unsub;
  }, []);

  const lastExportSettingsRef = useRef<ExportSettings | null>(null);

  const handleStartExport = async (settings: ExportSettings) => {
    if (!project) return;
    lastExportSettingsRef.current = settings;
    setIsExportProgressOpen(true);
    setExportProgress({
      jobId: 'init',
      projectId: project.metadata.id,
      status: 'rendering',
      percent: 0,
      outputFilePath: settings.outputPath,
    });

    if (window.captionForgeAPI?.startExport) {
      try {
        await window.captionForgeAPI.startExport(project, settings);
      } catch (err: any) {
        setExportProgress({
          jobId: 'err',
          projectId: project.metadata.id,
          status: 'failed',
          percent: 0,
          error: err?.message || 'Export error',
          outputFilePath: settings.outputPath,
        });
      }
    } else {
      try {
        const result = await executeWebExport(project, settings, (p) => {
          setExportProgress(p);
        });
        setExportProgress((prev) =>
          prev
            ? {
                ...prev,
                status: 'completed',
                percent: 100,
                outputBlobUrl: result.blobUrl,
                outputFilePath: result.outputFilePath,
              }
            : {
                jobId: 'web_done',
                projectId: project.metadata.id,
                status: 'completed',
                percent: 100,
                outputBlobUrl: result.blobUrl,
                outputFilePath: result.outputFilePath,
              }
        );
      } catch (err: any) {
        setExportProgress({
          jobId: 'err',
          projectId: project.metadata.id,
          status: 'failed',
          percent: 0,
          error: err?.message || 'Web export error',
          outputFilePath: settings.outputPath,
        });
      }
    }
  };

  const handleCancelExport = () => {
    if (exportProgress?.jobId && window.captionForgeAPI?.cancelExport) {
      window.captionForgeAPI.cancelExport(exportProgress.jobId);
    }
    cancelWebExport();
    setIsExportProgressOpen(false);
  };

  const handleRetryExport = async () => {
    if (lastExportSettingsRef.current) {
      handleCancelExport();
      handleStartExport(lastExportSettingsRef.current);
    } else {
      setIsExportProgressOpen(false);
      setIsExportOpen(true);
    }
  };

  const handleChooseAnotherFolderFromFailure = async () => {
    const chosen = await pickExportDestinationFolder(project?.metadata?.exportFolder);
    if (chosen) {
      await setProjectExportFolder(chosen);
      if (window.captionForgeAPI?.saveSettings) {
        try {
          await window.captionForgeAPI.saveSettings({ exportDirectory: chosen });
        } catch {}
      }
      if (lastExportSettingsRef.current) {
        const safeName = sanitizeFileName(lastExportSettingsRef.current.projectName, lastExportSettingsRef.current.format);
        lastExportSettingsRef.current = {
          ...lastExportSettingsRef.current,
          outputFolder: chosen,
          outputPath: joinExportPath(chosen, safeName),
        };
      }
      setIsExportProgressOpen(false);
      setIsExportOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-canvas-dark text-gray-100 overflow-hidden font-sans select-none">
      {/* Top Application Bar — hidden on Dashboard (Dashboard has its own header) */}
      {project && (
        <AppHeader
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenCommandPalette={() => setIsCommandOpen(true)}
          onOpenVersionHistory={() => setIsVersionOpen(true)}
        />
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {!project ? (
          /* Dashboard when no project is open */
          <Dashboard onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : (
          /* Professional 3-Column Top Grid + Full-Width Bottom Multitrack Timeline */
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Top Workspace: CapCut 4-Part Layout (Icon Sidebar -> Library Drawer -> Preview Monitor -> Inspector) */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
              {/* 1. Far Left: Iconic Vertical Sidebar Navigation */}
              <SidebarNav
                isPanelOpen={isLeftPanelOpen}
                onTogglePanel={() => {
                  setIsLeftPanelOpen((prev) => {
                    const next = !prev;
                    localStorage.setItem('cf_left_panel_open', String(next));
                    return next;
                  });
                }}
              />

              {/* 2. Collapsible & Resizable Asset / Library Drawer */}
              {isLeftPanelOpen && (
                <>
                  <LeftProjectPanel style={{ width: `${leftPanelWidth}px` }} />

                  {/* Left Vertical Resizer Splitter */}
                  <div
                    onMouseDown={handleLeftResizerMouseDown}
                    onDoubleClick={() => {
                      setLeftPanelWidth(310);
                      localStorage.setItem('cf_left_panel_w', '310');
                    }}
                    className={`w-1.5 hover:w-2 -mx-0.5 cursor-col-resize z-30 transition-all flex items-center justify-center group flex-shrink-0 select-none ${
                      isDraggingLeftResizer ? 'bg-forge-cyan w-2 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-transparent hover:bg-forge-cyan/70'
                    }`}
                    title="Drag to resize Library Drawer (Double-click to reset to 310px)"
                  >
                    <div className="w-[1px] h-8 bg-gray-600 group-hover:bg-white rounded-full opacity-40 group-hover:opacity-100" />
                  </div>
                </>
              )}

              {/* 3. Center Column: Video Preview Monitor */}
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <VideoPlayer />
              </div>

              {/* Right Vertical Resizer Splitter */}
              <div
                onMouseDown={handleRightResizerMouseDown}
                onDoubleClick={() => {
                  setRightPanelWidth(300);
                  localStorage.setItem('cf_right_panel_w', '300');
                }}
                className={`w-1.5 hover:w-2 -mx-0.5 cursor-col-resize z-30 transition-all flex items-center justify-center group flex-shrink-0 select-none ${
                  isDraggingRightResizer ? 'bg-forge-cyan w-2 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-transparent hover:bg-forge-cyan/70'
                }`}
                title="Drag to resize Inspector Panel (Double-click to reset)"
              >
                <div className="w-[1px] h-8 bg-gray-600 group-hover:bg-white rounded-full opacity-40 group-hover:opacity-100" />
              </div>

              {/* Right Column: Inspector & Style Customizer */}
              <RightInspectorPanel style={{ width: `${rightPanelWidth}px` }} />
            </div>

            {/* Horizontal Timeline Height Resizer Splitter */}
            <div
              onMouseDown={handleTimelineResizerMouseDown}
              onDoubleClick={() => {
                setTimelineHeight(220);
                localStorage.setItem('cf_timeline_h', '220');
              }}
              className={`h-2 hover:h-2.5 -my-1 cursor-row-resize z-30 transition-all flex items-center justify-center group flex-shrink-0 select-none relative ${
                isDraggingTimelineResizer
                  ? 'bg-forge-cyan shadow-[0_0_10px_rgba(6,182,212,0.8)]'
                  : 'bg-[#121214] hover:bg-forge-cyan/70 border-t border-b border-[#27272a]'
              }`}
              title="Drag to resize Timeline Height (Double-click to reset to 220px)"
            >
              {/* Center Grip Bar */}
              <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-1 bg-gray-400 group-hover:bg-white rounded-full" />
              </div>
            </div>

            {/* Bottom Workspace: 100% Full-Width Multitrack Timeline */}
            <Timeline height={timelineHeight} />
          </div>
        )}
      </div>

      {/* Background Processing Indicator (Feature 40) */}
      {bgTasks.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-1 items-center">
          {bgTasks.map((t) => (
            <div key={t.id} className="bg-[#1e1e22] border border-[#27272a] rounded-full px-3 py-1 flex items-center gap-2 text-xs shadow-xl">
              <span className={`w-2 h-2 rounded-full ${t.status === 'running' ? 'bg-amber-400 animate-pulse' : t.status === 'done' ? 'bg-emerald-400' : t.status === 'error' ? 'bg-red-400' : 'bg-gray-500'}`} />
              <span className="text-gray-200 font-medium">{t.label}</span>
              {t.status === 'running' && <span className="text-[10px] font-mono text-gray-400">{t.progress}%</span>}
              {t.status === 'done' && <span className="text-[10px] text-emerald-400">Done</span>}
              {t.status === 'error' && <span className="text-[10px] text-red-400">{t.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Status Bar */}
      <StatusBar />

      {/* Modals */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <CustomShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onStartExport={handleStartExport}
      />
      <ExportProgressModal
        isOpen={isExportProgressOpen}
        progress={exportProgress}
        onCancel={handleCancelExport}
        onClose={() => setIsExportProgressOpen(false)}
        onRetry={handleRetryExport}
        onChooseAnotherFolder={handleChooseAnotherFolderFromFailure}
      />
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
      <VersionHistoryModal isOpen={isVersionOpen} onClose={() => setIsVersionOpen(false)} />
    </div>
  );
};
export default App;
