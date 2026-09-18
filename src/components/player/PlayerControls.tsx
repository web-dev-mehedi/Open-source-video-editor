import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Scissors,
  Sparkles,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { formatTimecode } from '../../utils/timecode';
import { Button } from '../common/Button';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onSplit: () => void;
  onAutoTranscribe: () => void;
  isTranscribing: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  currentTime,
  totalDuration,
  volume,
  isMuted,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onSplit,
  onAutoTranscribe,
  isTranscribing,
}) => {
  const handleStep = (seconds: number) => {
    onSeek(Math.max(0, Math.min(totalDuration, currentTime + seconds)));
  };

  const handleShuttle = (seconds: number) => {
    onSeek(Math.max(0, Math.min(totalDuration, currentTime + seconds)));
  };

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div className="h-11 bg-canvas-dark border-t border-canvas-border px-3 flex items-center justify-between select-none z-20 flex-shrink-0">
      {/* Left: Transport Playback Controls & Frame Steppers */}
      <div className="flex items-center gap-2">
        {/* Shuttle Rewind J (-1.0s) */}
        <button
          onClick={() => handleShuttle(-1.0)}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-canvas-surface transition-colors"
          title="Shuttle Rewind 1s (J)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Step Back 1 Frame */}
        <button
          onClick={() => handleStep(-1 / 30)}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-canvas-surface transition-colors"
          title="Step Backward 1 Frame (Left Arrow)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className="w-7 h-7 rounded-md bg-forge-purple hover:bg-purple-600 flex items-center justify-center text-white transition-all shadow-sm"
          title={isPlaying ? 'Pause (Space / K)' : 'Play (Space / K)'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Step Forward 1 Frame */}
        <button
          onClick={() => handleStep(1 / 30)}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-canvas-surface transition-colors"
          title="Step Forward 1 Frame (Right Arrow)"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Shuttle Forward L (+1.0s) */}
        <button
          onClick={() => handleShuttle(1.0)}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-canvas-surface transition-colors"
          title="Shuttle Forward 1s (L)"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-canvas-border mx-1" />

        {/* Precision Timecode Display */}
        <div className="font-mono text-xs bg-canvas-surface px-2 py-0.5 rounded border border-canvas-border text-gray-200 flex items-center gap-1.5">
          <span className="text-forge-cyan font-bold">{formatTimecode(currentTime, true)}</span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-400">{formatTimecode(totalDuration, true)}</span>
        </div>
      </div>

      {/* Center: Quick Action Buttons (Split & AI Captions) */}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Scissors className="w-3 h-3 text-forge-amber" />}
          onClick={onSplit}
          title="Split Clip at Playhead (S)"
          className="text-[11px] py-1 px-2.5"
        >
          Split (S)
        </Button>

        <Button
          size="sm"
          variant="gradient"
          leftIcon={<Sparkles className="w-3 h-3 text-white" />}
          onClick={onAutoTranscribe}
          isLoading={isTranscribing}
          title="Generate AI Captions with Whisper & Gemini"
          className="text-[11px] py-1 px-2.5 shadow-sm font-semibold"
        >
          AI Captions
        </Button>
      </div>

      {/* Right: Audio Volume & Stereo VU Meter */}
      <div className="flex items-center gap-2.5">
        {/* Stereo VU Meter Simulation */}
        <div className="hidden sm:flex items-center gap-0.5 bg-canvas-surface px-1.5 py-1 rounded border border-canvas-border">
          <div className="flex flex-col gap-0.5">
            <div className={`w-3 h-1 rounded-xs transition-colors ${isPlaying && effectiveVolume > 0.1 ? 'bg-emerald-500' : 'bg-emerald-950'}`} />
            <div className={`w-3 h-1 rounded-xs transition-colors ${isPlaying && effectiveVolume > 0.6 ? 'bg-amber-500' : 'bg-amber-950'}`} />
          </div>
          <span className="text-[9px] font-mono text-gray-500 px-0.5">L/R</span>
        </div>

        {/* Volume Mute & Slider */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMute}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-canvas-surface"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-gray-300" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={effectiveVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 bg-canvas-border rounded cursor-pointer accent-forge-purple"
            title={`Volume: ${Math.round(effectiveVolume * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
};
