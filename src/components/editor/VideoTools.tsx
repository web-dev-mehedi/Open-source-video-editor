import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { Slider } from '../common/Slider';
import { Gauge, Volume2, VolumeX, Scissors, Film, Music, Move, Layers, Trash2 } from 'lucide-react';
import { formatTimecode } from '../../utils/timecode';

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0];

export const VideoTools: React.FC = () => {
  const {
    project,
    selectedClipId,
    selectedAudioClipId,
    updateClip,
    updateAudioClip,
    moveClipToTrack,
    updateClipTransform,
    deleteAudioClip,
    deleteClip,
  } = useProject();

  const activeAudio = project?.audioClips?.find((a) => a.id === selectedAudioClipId);
  const clip = project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  // If Audio Clip is selected, render dedicated Audio Inspector
  if (selectedAudioClipId && activeAudio) {
    return (
      <div className="flex flex-col h-full bg-canvas-surface text-gray-200 select-none overflow-y-auto p-4 space-y-5">
        {/* Title */}
        <div className="flex items-center justify-between pb-2 border-b border-canvas-border">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-forge-cyan" />
            <span>Audio Clip Settings</span>
          </h3>
          <button
            onClick={() => deleteAudioClip(activeAudio.id)}
            className="p-1 rounded text-gray-400 hover:text-red-400 bg-canvas-card border border-canvas-border"
            title="Delete Audio Clip"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[11px] text-gray-300 font-mono bg-canvas-card p-2 rounded border border-canvas-border truncate">
          {activeAudio.name}
        </div>

        {/* Audio Volume */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Volume & Gain</span>
          </h4>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Mute Audio</span>
            <button
              onClick={() => updateAudioClip(activeAudio.id, { isMuted: !activeAudio.isMuted })}
              className={`p-1.5 rounded-lg border flex items-center gap-1 text-xs transition-all ${
                activeAudio.isMuted
                  ? 'bg-red-500/20 border-red-500 text-red-400'
                  : 'bg-canvas-card border-canvas-border text-gray-300'
              }`}
            >
              {activeAudio.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{activeAudio.isMuted ? 'Muted' : 'Audible'}</span>
            </button>
          </div>

          <Slider
            label="Audio Volume Level"
            value={Math.round((activeAudio.volume ?? 1.0) * 100)}
            min={0}
            max={200}
            step={5}
            unit="%"
            onChange={(val) => updateAudioClip(activeAudio.id, { volume: val / 100 })}
          />
        </div>

        {/* Track assignment */}
        <div className="space-y-2 pt-2 border-t border-canvas-border">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Audio Track Layer
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((trk) => (
              <button
                key={trk}
                onClick={() => updateAudioClip(activeAudio.id, { trackIndex: trk })}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  (activeAudio.trackIndex || 1) === trk
                    ? 'bg-forge-cyan/20 border-forge-cyan text-forge-cyan'
                    : 'bg-canvas-card border-canvas-border text-gray-400 hover:text-white'
                }`}
              >
                Track A{trk} {trk === 1 ? '(Primary)' : '(Music/SFX)'}
              </button>
            ))}
          </div>
        </div>

        {/* Trim & Timing Details */}
        <div className="space-y-2.5 pt-2 border-t border-canvas-border">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-forge-pink" />
            <span>Audio Trim Range</span>
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-canvas-card border border-canvas-border">
              <span className="text-[10px] text-gray-500 block">Start Offset</span>
              <span className="text-forge-cyan font-bold">{formatTimecode(activeAudio.startOffset)}</span>
            </div>

            <div className="p-2 rounded-lg bg-canvas-card border border-canvas-border">
              <span className="text-[10px] text-gray-500 block">End Offset</span>
              <span className="text-forge-amber font-bold">{formatTimecode(activeAudio.endOffset)}</span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-canvas-card border border-canvas-border text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Original Duration:</span>
              <span className="font-mono text-gray-200">{formatTimecode(activeAudio.duration)}</span>
            </div>
            <div className="flex justify-between text-gray-400 mt-1">
              <span>Active Timeline Length:</span>
              <span className="font-mono text-forge-cyan font-bold">
                {formatTimecode(activeAudio.timelineDuration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Film className="w-8 h-8 text-gray-600 mb-2" />
        <span>No video clip or audio selected</span>
      </div>
    );
  }

  const currentTrack = clip.trackIndex || 1;
  const transform = clip.transform || { xPercent: 0, yPercent: 0, scale: 1.0, opacity: 1.0 };

  return (
    <div className="flex flex-col h-full bg-canvas-surface text-gray-200 select-none overflow-y-auto p-4 space-y-5">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-canvas-border">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Film className="w-4 h-4 text-forge-purple" />
          <span>Video Clip Settings</span>
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400 font-mono bg-canvas-card px-2 py-0.5 rounded truncate max-w-[120px]">
            {clip.name}
          </span>
          <button
            onClick={() => deleteClip(clip.id)}
            className="p-1 rounded text-gray-400 hover:text-red-400 bg-canvas-card border border-canvas-border"
            title="Delete Clip (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multitrack Layer Switcher */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-forge-amber" />
          <span>Video Layer Track</span>
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((trk) => (
            <button
              key={trk}
              onClick={() => moveClipToTrack(clip.id, trk)}
              className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                currentTrack === trk
                  ? trk === 2
                    ? 'bg-forge-amber/20 border-forge-amber text-forge-amber font-bold'
                    : 'bg-forge-purple/20 border-forge-purple text-forge-purple font-bold'
                  : 'bg-canvas-card border-canvas-border text-gray-400 hover:text-white'
              }`}
            >
              Track V{trk} {trk === 1 ? '(Main Base)' : '(B-roll / Overlay)'}
            </button>
          ))}
        </div>
      </div>

      {/* Layer Transform Controls for V2 Overlay Layer */}
      {currentTrack > 1 && (
        <div className="space-y-3 pt-2 border-t border-canvas-border bg-amber-950/10 p-2.5 rounded-lg border border-amber-500/20">
          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-forge-amber" />
            <span>Overlay Layer Transform (PiP)</span>
          </h4>

          <Slider
            label="Layer Scale / Size"
            value={Math.round((transform.scale ?? 1.0) * 100)}
            min={10}
            max={200}
            step={5}
            unit="%"
            onChange={(val) => updateClipTransform(clip.id, { scale: val / 100 })}
          />

          <Slider
            label="Horizontal Position (X)"
            value={transform.xPercent ?? 0}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(val) => updateClipTransform(clip.id, { xPercent: val })}
          />

          <Slider
            label="Vertical Position (Y)"
            value={transform.yPercent ?? 0}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(val) => updateClipTransform(clip.id, { yPercent: val })}
          />

          <Slider
            label="Layer Opacity"
            value={Math.round((transform.opacity ?? 1.0) * 100)}
            min={10}
            max={100}
            step={5}
            unit="%"
            onChange={(val) => updateClipTransform(clip.id, { opacity: val / 100 })}
          />
        </div>
      )}

      {/* Playback Speed */}
      <div className="space-y-3 pt-2 border-t border-canvas-border">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-forge-amber" />
          <span>Playback Speed</span>
        </h4>

        <div className="grid grid-cols-4 gap-1.5">
          {SPEED_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => updateClip(clip.id, { speed: s })}
              className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                clip.speed === s
                  ? 'bg-forge-purple border-forge-purple text-white shadow-md shadow-purple-950/40'
                  : 'bg-canvas-card border-canvas-border text-gray-300 hover:border-gray-500'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <Slider
          label="Custom Speed Multiplier"
          value={clip.speed}
          min={0.25}
          max={4.0}
          step={0.05}
          unit="x"
          onChange={(val) => updateClip(clip.id, { speed: val })}
        />
      </div>

      {/* Audio & Volume */}
      <div className="space-y-3 pt-2 border-t border-canvas-border">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-forge-cyan" />
          <span>Clip Audio Levels</span>
        </h4>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Mute Audio</span>
          <button
            onClick={() => updateClip(clip.id, { isMuted: !clip.isMuted })}
            className={`p-1.5 rounded-lg border flex items-center gap-1 text-xs transition-all ${
              clip.isMuted
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-canvas-card border-canvas-border text-gray-300'
            }`}
          >
            {clip.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{clip.isMuted ? 'Muted' : 'Enabled'}</span>
          </button>
        </div>

        <Slider
          label="Clip Volume Level"
          value={Math.round(clip.volume * 100)}
          min={0}
          max={200}
          step={5}
          unit="%"
          onChange={(val) => updateClip(clip.id, { volume: val / 100 })}
        />
      </div>

      {/* Trim Range details */}
      <div className="space-y-2.5 pt-2 border-t border-canvas-border">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-forge-pink" />
          <span>Trim Information</span>
        </h4>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg bg-canvas-card border border-canvas-border">
            <span className="text-[10px] text-gray-500 block">Start Offset</span>
            <span className="text-forge-cyan font-bold">{formatTimecode(clip.startOffset)}</span>
          </div>

          <div className="p-2 rounded-lg bg-canvas-card border border-canvas-border">
            <span className="text-[10px] text-gray-500 block">End Offset</span>
            <span className="text-forge-amber font-bold">{formatTimecode(clip.endOffset)}</span>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-canvas-card border border-canvas-border text-xs">
          <div className="flex justify-between text-gray-400">
            <span>Original Duration:</span>
            <span className="font-mono text-gray-200">{formatTimecode(clip.duration)}</span>
          </div>
          <div className="flex justify-between text-gray-400 mt-1">
            <span>Active Timeline Length:</span>
            <span className="font-mono text-forge-purple font-bold">
              {formatTimecode(clip.timelineDuration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
