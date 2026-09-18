import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../../context/ProjectContext';
import { MulticamAngle, MulticamCutPoint } from '../../types/multicam';
import { calculateWaveformSyncOffset, generateMulticamTimelineClips } from '../../utils/multicamEngine';
import { formatTimecode } from '../../utils/timecode';
import {
  Video,
  Grid,
  Check,
  Scissors,
  Layers,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Sliders,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '../common/Button';

const ANGLE_COLORS = ['#EF4444', '#38BDF8', '#10B981', '#F59E0B', '#A855F2', '#EC4899'];

export const MulticamStudio: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    project,
    currentTime,
    setCurrentTime,
    isPlaying,
    togglePlayPause,
    setClips,
    importFootageFile,
  } = useProject();

  const allAvailableClips = React.useMemo(() => {
    const list = [...(project?.clips || []), ...(project?.footageLibrary || [])];
    const seen = new Set<string>();
    return list.filter((c) => {
      if (!c.filePath || seen.has(c.filePath)) return false;
      seen.add(c.filePath);
      return true;
    });
  }, [project?.clips, project?.footageLibrary]);

  const [angles, setAngles] = useState<MulticamAngle[]>(() => {
    if (allAvailableClips.length > 0) {
      return allAvailableClips.slice(0, 4).map((c, idx) => ({
        id: `cam_${idx + 1}`,
        name: `Angle ${idx + 1}: ${c.name.slice(0, 20)}`,
        clipId: c.id,
        filePath: c.filePath,
        thumbnailUrl: c.thumbnailUrl,
        syncOffsetSeconds: 0,
        audioEnabled: idx === 0,
        colorTag: ANGLE_COLORS[idx % ANGLE_COLORS.length],
      }));
    }
    return [
      {
        id: 'cam_1',
        name: 'Angle 1 (Master)',
        clipId: 'default_1',
        filePath: project?.metadata.primaryMediaFilePath || '',
        syncOffsetSeconds: 0,
        audioEnabled: true,
        colorTag: '#EF4444',
      },
    ];
  });

  const [activeAngleId, setActiveAngleId] = useState<string>(angles[0]?.id || 'cam_1');
  const [cutPoints, setCutPoints] = useState<MulticamCutPoint[]>([]);
  const [audioMasterId, setAudioMasterId] = useState<string>(angles[0]?.id || 'cam_1');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showClipSelectorForAngle, setShowClipSelectorForAngle] = useState<string | null>(null);

  const videoRefs = useRef<{ [angleId: string]: HTMLVideoElement | null }>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize HTML5 video elements with playhead time and offset
  useEffect(() => {
    angles.forEach((ang) => {
      const vid = videoRefs.current[ang.id];
      if (vid) {
        const targetTime = Math.max(0, currentTime + ang.syncOffsetSeconds);
        if (Math.abs(vid.currentTime - targetTime) > 0.2) {
          vid.currentTime = targetTime;
        }
      }
    });
  }, [currentTime, angles]);

  // Synchronize playback play/pause state across all angle players
  useEffect(() => {
    angles.forEach((ang) => {
      const vid = videoRefs.current[ang.id];
      if (vid) {
        if (isPlaying && vid.paused) {
          vid.play().catch(() => {});
        } else if (!isPlaying && !vid.paused) {
          vid.pause();
        }
      }
    });
  }, [isPlaying, angles]);

  // Keyboard shortcut listener for live angle cutting (keys 1, 2, 3, 4, Space, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isInput) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= angles.length) {
        e.preventDefault();
        handleSwitchAngle(angles[num - 1].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [angles, currentTime, isPlaying, togglePlayPause, onClose]);

  const handleSwitchAngle = (angleId: string) => {
    setActiveAngleId(angleId);
    // Add live cut point at current playhead
    setCutPoints((prev) => {
      const filtered = prev.filter((p) => Math.abs(p.timecode - currentTime) > 0.3);
      return [...filtered, { id: `cut_${Date.now()}`, timecode: currentTime, activeAngleId: angleId }].sort(
        (a, b) => a.timecode - b.timecode
      );
    });
  };

  // Resolve playable video source
  const getVideoSrc = (filePath?: string) => {
    if (!filePath) return '';
    if (filePath.startsWith('blob:') || filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    const clean = filePath.replace(/\\/g, '/');
    if (clean.startsWith('captionforge-media://')) return clean;
    if (clean.startsWith('file://')) {
      return `captionforge-media://${clean.replace(/^file:\/\/\/?/, '')}`;
    }
    return `captionforge-media://${clean}`;
  };

  // Auto-sync clips using acoustic waveform cross-correlation
  const handleAutoSyncWaveforms = async () => {
    if (angles.length < 2) return;
    setIsSyncing(true);
    setSyncMessage('Cross-correlating acoustic waveform energy peaks across angles...');

    await new Promise((r) => setTimeout(r, 600));

    const masterClip = allAvailableClips.find((c) => c.id === angles[0].clipId) || allAvailableClips[0];
    const masterPeaks = masterClip?.waveformPeaks || [];

    const updatedAngles = angles.map((ang, idx) => {
      if (idx === 0) return ang;
      const targetClip = allAvailableClips.find((c) => c.id === ang.clipId);
      const targetPeaks = targetClip?.waveformPeaks || [];
      const offset = calculateWaveformSyncOffset(masterPeaks, targetPeaks);
      return { ...ang, syncOffsetSeconds: offset };
    });

    setAngles(updatedAngles);
    setIsSyncing(false);
    setSyncMessage('✓ Camera angles synchronized via acoustic waveform alignment!');
    setTimeout(() => setSyncMessage(null), 3000);
  };

  // Add a new camera angle
  const handleAddAngle = () => {
    if (angles.length >= 4) return;
    const nextIdx = angles.length;
    const unusedClip = allAvailableClips.find((c) => !angles.some((a) => a.clipId === c.id)) || allAvailableClips[0];

    const newAngle: MulticamAngle = {
      id: `cam_${Date.now()}`,
      name: `Angle ${nextIdx + 1}: ${unusedClip?.name?.slice(0, 16) || 'New Camera'}`,
      clipId: unusedClip?.id || `clip_${Date.now()}`,
      filePath: unusedClip?.filePath || '',
      thumbnailUrl: unusedClip?.thumbnailUrl,
      syncOffsetSeconds: 0,
      audioEnabled: false,
      colorTag: ANGLE_COLORS[nextIdx % ANGLE_COLORS.length],
    };

    setAngles([...angles, newAngle]);
  };

  // Remove camera angle
  const handleRemoveAngle = (angleId: string) => {
    if (angles.length <= 1) return;
    const filtered = angles.filter((a) => a.id !== angleId);
    setAngles(filtered);
    if (activeAngleId === angleId) {
      setActiveAngleId(filtered[0]?.id || 'cam_1');
    }
  };

  // Select footage clip for angle
  const handleAssignClipToAngle = (angleId: string, clip: any) => {
    setAngles((prev) =>
      prev.map((a) => {
        if (a.id === angleId) {
          return {
            ...a,
            clipId: clip.id,
            name: `${a.name.split(':')[0]}: ${clip.name.slice(0, 18)}`,
            filePath: clip.filePath,
            thumbnailUrl: clip.thumbnailUrl,
          };
        }
        return a;
      })
    );
    setShowClipSelectorForAngle(null);
  };

  // Direct Footage File Import
  const handleImportNewFootage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newClip = await importFootageFile(file);
      if (newClip && showClipSelectorForAngle) {
        handleAssignClipToAngle(showClipSelectorForAngle, newClip);
      }
    }
  };

  // Adjust Sync Offset for an angle
  const handleUpdateOffset = (angleId: string, delta: number) => {
    setAngles((prev) =>
      prev.map((a) => (a.id === angleId ? { ...a, syncOffsetSeconds: Math.round((a.syncOffsetSeconds + delta) * 100) / 100 } : a))
    );
  };

  // Commit multicam cuts to main timeline
  const handleApplyToTimeline = () => {
    if (!project || angles.length === 0) return;
    const totalDur = project.metadata.duration || 30;
    const newClips = generateMulticamTimelineClips(angles, cutPoints, totalDur, allAvailableClips);

    if (newClips.length > 0) {
      setClips(newClips);
    }
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-[#09090b]/95 backdrop-blur-xl flex flex-col select-none text-gray-200 overflow-hidden font-sans">
      {/* Invisible file input for direct footage import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={handleImportNewFootage}
      />

      {/* Top Multicam Studio Bar */}
      <div className="h-14 bg-[#121214] border-b border-[#27272a] px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-950/60">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2.5">
              <span>Multicam Quad-Angle Studio</span>
              <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800/50 text-[10px] font-mono font-bold tracking-wider">
                LIVE QUAD SWITCHER
              </span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
              <span>Cut live during playback using keys</span>
              <kbd className="px-1.5 py-0.2 bg-[#222226] border border-[#3f3f46] rounded text-cyan-300 font-mono font-bold text-[10px]">1</kbd>
              <kbd className="px-1.5 py-0.2 bg-[#222226] border border-[#3f3f46] rounded text-cyan-300 font-mono font-bold text-[10px]">2</kbd>
              <kbd className="px-1.5 py-0.2 bg-[#222226] border border-[#3f3f46] rounded text-cyan-300 font-mono font-bold text-[10px]">3</kbd>
              <kbd className="px-1.5 py-0.2 bg-[#222226] border border-[#3f3f46] rounded text-cyan-300 font-mono font-bold text-[10px]">4</kbd>
              <span className="text-gray-600">|</span>
              <span>Space to Play/Pause</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {angles.length < 4 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddAngle}
              className="flex items-center gap-1.5 text-xs bg-[#1e1e22] border border-[#323238] hover:border-gray-500 text-gray-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Angle</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoSyncWaveforms}
            disabled={isSyncing || angles.length < 2}
            className="flex items-center gap-1.5 text-xs bg-[#1e1e22] border border-[#323238] hover:border-forge-cyan text-gray-200"
          >
            <Sparkles className={`w-3.5 h-3.5 text-forge-cyan ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Acoustic Waveform Sync'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleApplyToTimeline}
            className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-950/60"
          >
            <Check className="w-4 h-4" />
            <span>Apply Cuts to Timeline</span>
          </Button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Multicam Studio (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sync Toast Banner */}
      {syncMessage && (
        <div className="bg-cyan-950/90 border-b border-cyan-500/40 px-4 py-2 text-center text-xs text-cyan-300 font-mono flex items-center justify-center gap-2 animate-in fade-in duration-150 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Main Quad-Angle Switcher Grid (Responsive 2x2 or Grid) */}
      <div className="flex-1 p-6 grid grid-cols-2 gap-4 min-h-0 bg-[#0d0d10] overflow-hidden">
        {angles.map((ang, idx) => {
          const isLive = ang.id === activeAngleId;
          const isAudioMaster = ang.id === audioMasterId;
          const targetClip = allAvailableClips.find((c) => c.id === ang.clipId) || allAvailableClips[0];
          const src = getVideoSrc(ang.filePath || targetClip?.filePath);

          return (
            <div
              key={ang.id}
              onClick={() => handleSwitchAngle(ang.id)}
              className={`relative rounded-2xl overflow-hidden border-2 flex flex-col justify-between cursor-pointer transition-all bg-[#141416] ${
                isLive
                  ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.45)] ring-2 ring-red-500/60'
                  : 'border-[#27272a] hover:border-gray-500'
              }`}
            >
              {/* Synchronized Live Video Preview */}
              <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
                {src ? (
                  <video
                    ref={(el) => { videoRefs.current[ang.id] = el; }}
                    src={src}
                    playsInline
                    muted={!isAudioMaster}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-600">
                    <Video className="w-12 h-12" />
                    <span className="text-xs font-mono">{ang.name}</span>
                  </div>
                )}
              </div>

              {/* Top HUD Angle Header */}
              <div className="relative z-10 p-3.5 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ backgroundColor: ang.colorTag }}
                    className="px-2.5 py-0.5 rounded-md text-[11px] font-black text-white shadow-md"
                  >
                    CAM {idx + 1}
                  </span>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowClipSelectorForAngle(showClipSelectorForAngle === ang.id ? null : ang.id);
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-white drop-shadow hover:text-cyan-300 bg-black/50 px-2 py-1 rounded-lg border border-white/10"
                      title="Change footage source for this angle"
                    >
                      <span className="truncate max-w-[180px]">{ang.name}</span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>

                    {/* Footage Dropdown Selector */}
                    {showClipSelectorForAngle === ang.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-full mt-1.5 w-64 bg-[#18181c] border border-[#3f3f46] rounded-xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                      >
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                          Select Media Pool Footage
                        </div>
                        <div className="max-h-44 overflow-y-auto space-y-1 no-scrollbar">
                          {allAvailableClips.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => handleAssignClipToAngle(ang.id, c)}
                              className="w-full text-left p-1.5 rounded-lg hover:bg-white/10 text-xs text-gray-200 flex items-center justify-between transition-colors"
                            >
                              <span className="truncate">{c.name}</span>
                              {ang.clipId === c.id && <Check className="w-3 h-3 text-forge-cyan flex-shrink-0" />}
                            </button>
                          ))}
                        </div>
                        <div className="pt-1 border-t border-[#2e2e34]">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full text-left p-1.5 rounded-lg bg-[#27272a] hover:bg-[#323238] text-xs font-bold text-forge-cyan flex items-center gap-1.5 justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Import New Video Angle...</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isLive && (
                    <div className="flex items-center gap-1.5 bg-red-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-lg shadow-red-900/60 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>ON AIR</span>
                    </div>
                  )}

                  {angles.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAngle(ang.id);
                      }}
                      className="p-1 rounded-lg bg-black/60 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      title="Remove Angle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Angle Controls */}
              <div className="relative z-10 p-3.5 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/50 to-transparent text-xs">
                {/* Time Offset Controls */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 font-mono text-[11px] text-gray-300"
                >
                  <span className="text-gray-500">Sync:</span>
                  <button
                    onClick={() => handleUpdateOffset(ang.id, -0.1)}
                    className="px-1 hover:text-cyan-300 font-bold"
                    title="-0.1s offset"
                  >
                    -
                  </button>
                  <span className="font-bold text-white">
                    {ang.syncOffsetSeconds > 0 ? `+${ang.syncOffsetSeconds}s` : `${ang.syncOffsetSeconds}s`}
                  </span>
                  <button
                    onClick={() => handleUpdateOffset(ang.id, 0.1)}
                    className="px-1 hover:text-cyan-300 font-bold"
                    title="+0.1s offset"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAudioMasterId(ang.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                      isAudioMaster
                        ? 'bg-forge-cyan text-black shadow-md shadow-cyan-950/50'
                        : 'bg-black/60 text-gray-400 hover:text-white border border-white/10'
                    }`}
                    title="Set as master audio track"
                  >
                    {isAudioMaster ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{isAudioMaster ? 'Master Audio' : 'Mute'}</span>
                  </button>

                  <span className="w-7 h-7 rounded-lg bg-black/80 border border-white/20 text-white font-mono font-black text-xs flex items-center justify-center shadow">
                    {idx + 1}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Switcher Timeline & Cut Points Strip */}
      <div className="h-16 bg-[#121214] border-t border-[#27272a] px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlayPause}
            className="p-2.5 rounded-xl bg-white text-black hover:bg-gray-200 transition-colors shadow-lg"
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <div className="font-mono text-base font-bold text-forge-cyan bg-[#18181c] px-3 py-1 rounded-lg border border-[#2e2e34]">
            {formatTimecode(currentTime, true)}
          </div>

          <div className="text-xs text-gray-300 border-l border-gray-700 pl-4 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#222226] text-white font-mono font-bold">
              {cutPoints.length}
            </span>
            <span>live angle cuts recorded</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCutPoints([])}
            disabled={cutPoints.length === 0}
            className="text-xs text-gray-400 hover:text-red-400 bg-transparent border border-transparent hover:border-red-800/60"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Reset Cuts</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleApplyToTimeline}
            className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-950/60"
          >
            <Check className="w-4 h-4 mr-1.5" />
            <span>Commit to Timeline</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
export default MulticamStudio;
