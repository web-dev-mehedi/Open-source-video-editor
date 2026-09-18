import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  AnimatableProperty,
  ClipKeyframeState,
  KeyframePoint,
  KeyframeEasing,
  DEFAULT_KEYFRAME_TRACKS,
} from '../../types/keyframes';
import {
  getInterpolatedClipTransform,
  isAtKeyframe,
  findPreviousKeyframeTime,
  findNextKeyframeTime,
} from '../../utils/keyframeEngine';
import { KeyframeCurveEditor } from './KeyframeCurveEditor';
import { Slider } from '../common/Slider';
import {
  Sparkles,
  Move,
  RotateCw,
  Eye,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sliders,
  Diamond,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '../common/Button';

export const KeyframeInspector: React.FC = () => {
  const {
    project,
    selectedClipId,
    currentTime,
    setCurrentTime,
    updateClip,
  } = useProject();

  const activeClip = project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  const clipRelativeTime = activeClip
    ? Math.max(0, Math.min(activeClip.timelineDuration, currentTime - activeClip.timelineStart))
    : 0;

  const [activeProperty, setActiveProperty] = useState<AnimatableProperty>('scale');
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  const keyframesState: ClipKeyframeState = activeClip?.keyframes || {
    tracks: {
      positionX: { ...DEFAULT_KEYFRAME_TRACKS.positionX, keyframes: [] },
      positionY: { ...DEFAULT_KEYFRAME_TRACKS.positionY, keyframes: [] },
      scale: { ...DEFAULT_KEYFRAME_TRACKS.scale, keyframes: [] },
      rotation: { ...DEFAULT_KEYFRAME_TRACKS.rotation, keyframes: [] },
      opacity: { ...DEFAULT_KEYFRAME_TRACKS.opacity, keyframes: [] },
    },
  };

  const currentTrack = keyframesState.tracks[activeProperty];
  const activeKeyframePoint = isAtKeyframe(currentTrack, clipRelativeTime);
  const interpolatedTransform = getInterpolatedClipTransform(activeClip, currentTime);

  // Add or remove keyframe at current playhead
  const handleToggleKeyframe = (prop: AnimatableProperty) => {
    if (!activeClip) return;
    const track = keyframesState.tracks[prop];
    const existing = isAtKeyframe(track, clipRelativeTime);

    let updatedKeyframes: KeyframePoint[];

    if (existing) {
      // Remove keyframe
      updatedKeyframes = track.keyframes.filter((k) => k.id !== existing.id);
    } else {
      // Add keyframe with current interpolated value
      const currentValue =
        prop === 'positionX'
          ? interpolatedTransform.xPercent
          : prop === 'positionY'
          ? interpolatedTransform.yPercent
          : prop === 'scale'
          ? interpolatedTransform.scale
          : prop === 'rotation'
          ? interpolatedTransform.rotation
          : interpolatedTransform.opacity;

      const newKeyframe: KeyframePoint = {
        id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time: Math.round(clipRelativeTime * 100) / 100,
        value: currentValue,
        easing: 'easeInOut',
      };

      updatedKeyframes = [...track.keyframes, newKeyframe].sort((a, b) => a.time - b.time);
    }

    const updatedState: ClipKeyframeState = {
      tracks: {
        ...keyframesState.tracks,
        [prop]: {
          ...track,
          keyframes: updatedKeyframes,
        },
      },
    };

    updateClip(activeClip.id, { keyframes: updatedState });
  };

  // Update numerical value of property at current playhead
  const handleUpdateValue = (prop: AnimatableProperty, val: number) => {
    if (!activeClip) return;
    const track = keyframesState.tracks[prop];
    const existing = isAtKeyframe(track, clipRelativeTime);

    let updatedKeyframes: KeyframePoint[];

    if (existing) {
      updatedKeyframes = track.keyframes.map((k) => (k.id === existing.id ? { ...k, value: val } : k));
    } else if (track.keyframes.length > 0) {
      // Create a keyframe at current time if track is active
      const newKeyframe: KeyframePoint = {
        id: `kf_${Date.now()}`,
        time: Math.round(clipRelativeTime * 100) / 100,
        value: val,
        easing: 'easeInOut',
      };
      updatedKeyframes = [...track.keyframes, newKeyframe].sort((a, b) => a.time - b.time);
    } else {
      // No keyframes yet, update static transform
      const staticT = activeClip.transform || {};
      updateClip(activeClip.id, {
        transform: {
          ...staticT,
          xPercent: prop === 'positionX' ? val : staticT.xPercent ?? 0,
          yPercent: prop === 'positionY' ? val : staticT.yPercent ?? 0,
          scale: prop === 'scale' ? val : staticT.scale ?? 1.0,
          rotation: prop === 'rotation' ? val : staticT.rotation ?? 0,
          opacity: prop === 'opacity' ? val : staticT.opacity ?? 1.0,
        },
      });
      return;
    }

    const updatedState: ClipKeyframeState = {
      tracks: {
        ...keyframesState.tracks,
        [prop]: {
          ...track,
          keyframes: updatedKeyframes,
        },
      },
    };

    updateClip(activeClip.id, { keyframes: updatedState });
  };

  // Jump to Previous Keyframe
  const handleJumpPrev = () => {
    if (!activeClip) return;
    const prevTime = findPreviousKeyframeTime(keyframesState, clipRelativeTime);
    if (prevTime !== null) {
      setCurrentTime(activeClip.timelineStart + prevTime);
    }
  };

  // Jump to Next Keyframe
  const handleJumpNext = () => {
    if (!activeClip) return;
    const nextTime = findNextKeyframeTime(keyframesState, clipRelativeTime);
    if (nextTime !== null) {
      setCurrentTime(activeClip.timelineStart + nextTime);
    }
  };

  // Update Easing Curve
  const handleUpdateEasing = (newEasing: KeyframeEasing) => {
    if (!activeClip) return;
    const track = keyframesState.tracks[activeProperty];
    const targetKf = activeKeyframePoint || track.keyframes[0];
    if (!targetKf) return;

    const updatedKeyframes = track.keyframes.map((k) =>
      k.id === targetKf.id ? { ...k, easing: newEasing } : k
    );

    const updatedState: ClipKeyframeState = {
      tracks: {
        ...keyframesState.tracks,
        [activeProperty]: {
          ...track,
          keyframes: updatedKeyframes,
        },
      },
    };

    updateClip(activeClip.id, { keyframes: updatedState });
  };

  const handleResetTrack = (prop: AnimatableProperty) => {
    if (!activeClip) return;
    const updatedState: ClipKeyframeState = {
      tracks: {
        ...keyframesState.tracks,
        [prop]: {
          ...keyframesState.tracks[prop],
          keyframes: [],
        },
      },
    };
    updateClip(activeClip.id, { keyframes: updatedState });
  };

  if (!activeClip) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500 space-y-2">
        <Sliders className="w-10 h-10 text-gray-600" />
        <span className="text-xs font-bold text-gray-400">No Clip Selected</span>
        <span className="text-[11px] text-gray-500">Select a video clip to animate position, scale, rotation, and opacity.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto p-3 space-y-4 text-xs no-scrollbar">
      {/* Top Keyframe Navigation Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <Diamond className="w-4 h-4 text-forge-cyan fill-forge-cyan/20" />
          <span className="font-bold text-white text-xs">Keyframe Animation</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#121214] px-2 py-1 rounded-xl border border-[#27272a]">
          <button
            onClick={handleJumpPrev}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10"
            title="Jump to Previous Keyframe"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] font-mono text-gray-400 px-1">
            {clipRelativeTime.toFixed(2)}s
          </span>

          <button
            onClick={handleJumpNext}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10"
            title="Jump to Next Keyframe"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Animatable Properties Cards */}
      <div className="space-y-2.5">
        {/* 1. Scale */}
        <PropertyControlRow
          title="Scale"
          icon={<Maximize2 className="w-3.5 h-3.5 text-forge-cyan" />}
          value={interpolatedTransform.scale}
          min={0.1}
          max={3.0}
          unit="x"
          step={0.05}
          hasKeyframe={!!isAtKeyframe(keyframesState.tracks.scale, clipRelativeTime)}
          keyframeCount={keyframesState.tracks.scale.keyframes.length}
          isSelected={activeProperty === 'scale'}
          onSelect={() => setActiveProperty('scale')}
          onToggleKeyframe={() => handleToggleKeyframe('scale')}
          onChange={(v) => handleUpdateValue('scale', v)}
          onReset={() => handleResetTrack('scale')}
        />

        {/* 2. Position X */}
        <PropertyControlRow
          title="Position X"
          icon={<Move className="w-3.5 h-3.5 text-forge-purple" />}
          value={interpolatedTransform.xPercent}
          min={-100}
          max={100}
          unit="%"
          step={1}
          hasKeyframe={!!isAtKeyframe(keyframesState.tracks.positionX, clipRelativeTime)}
          keyframeCount={keyframesState.tracks.positionX.keyframes.length}
          isSelected={activeProperty === 'positionX'}
          onSelect={() => setActiveProperty('positionX')}
          onToggleKeyframe={() => handleToggleKeyframe('positionX')}
          onChange={(v) => handleUpdateValue('positionX', v)}
          onReset={() => handleResetTrack('positionX')}
        />

        {/* 3. Position Y */}
        <PropertyControlRow
          title="Position Y"
          icon={<Move className="w-3.5 h-3.5 text-forge-purple" />}
          value={interpolatedTransform.yPercent}
          min={-100}
          max={100}
          unit="%"
          step={1}
          hasKeyframe={!!isAtKeyframe(keyframesState.tracks.positionY, clipRelativeTime)}
          keyframeCount={keyframesState.tracks.positionY.keyframes.length}
          isSelected={activeProperty === 'positionY'}
          onSelect={() => setActiveProperty('positionY')}
          onToggleKeyframe={() => handleToggleKeyframe('positionY')}
          onChange={(v) => handleUpdateValue('positionY', v)}
          onReset={() => handleResetTrack('positionY')}
        />

        {/* 4. Rotation */}
        <PropertyControlRow
          title="Rotation"
          icon={<RotateCw className="w-3.5 h-3.5 text-forge-amber" />}
          value={interpolatedTransform.rotation}
          min={-360}
          max={360}
          unit="°"
          step={1}
          hasKeyframe={!!isAtKeyframe(keyframesState.tracks.rotation, clipRelativeTime)}
          keyframeCount={keyframesState.tracks.rotation.keyframes.length}
          isSelected={activeProperty === 'rotation'}
          onSelect={() => setActiveProperty('rotation')}
          onToggleKeyframe={() => handleToggleKeyframe('rotation')}
          onChange={(v) => handleUpdateValue('rotation', v)}
          onReset={() => handleResetTrack('rotation')}
        />

        {/* 5. Opacity */}
        <PropertyControlRow
          title="Opacity"
          icon={<Eye className="w-3.5 h-3.5 text-emerald-400" />}
          value={Math.round(interpolatedTransform.opacity * 100)}
          min={0}
          max={100}
          unit="%"
          step={1}
          hasKeyframe={!!isAtKeyframe(keyframesState.tracks.opacity, clipRelativeTime)}
          keyframeCount={keyframesState.tracks.opacity.keyframes.length}
          isSelected={activeProperty === 'opacity'}
          onSelect={() => setActiveProperty('opacity')}
          onToggleKeyframe={() => handleToggleKeyframe('opacity')}
          onChange={(v) => handleUpdateValue('opacity', v / 100)}
          onReset={() => handleResetTrack('opacity')}
        />
      </div>

      {/* Easing & Spline Velocity Curve Studio */}
      <KeyframeCurveEditor
        easing={activeKeyframePoint?.easing || 'easeInOut'}
        onChangeEasing={handleUpdateEasing}
      />
    </div>
  );
};

// -------------------------------------------------------------
// Individual Property Row with Diamond Keyframe Button
// -------------------------------------------------------------
const PropertyControlRow: React.FC<{
  title: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  unit: string;
  step?: number;
  hasKeyframe: boolean;
  keyframeCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleKeyframe: () => void;
  onChange: (val: number) => void;
  onReset: () => void;
}> = ({
  title,
  icon,
  value,
  min,
  max,
  unit,
  step = 1,
  hasKeyframe,
  keyframeCount,
  isSelected,
  onSelect,
  onToggleKeyframe,
  onChange,
  onReset,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-[#16161a] border-forge-cyan shadow-[0_0_15px_rgba(6,182,212,0.15)]'
          : 'bg-[#141416] border-[#27272a] hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-white text-[11px]">{title}</span>
          {keyframeCount > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-forge-cyan/20 text-forge-cyan font-bold">
              {keyframeCount} kf
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-gray-300 font-bold">
            {value}
            {unit}
          </span>

          {/* Diamond Keyframe Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleKeyframe();
            }}
            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
              hasKeyframe
                ? 'bg-forge-cyan border-forge-cyan text-black shadow-[0_0_10px_rgba(6,182,212,0.6)] rotate-45 scale-105'
                : 'bg-[#202024] border-[#3f3f46] text-gray-400 hover:text-white hover:border-forge-cyan rotate-45'
            }`}
            title={hasKeyframe ? 'Remove Keyframe at Playhead' : 'Add Keyframe at Playhead'}
          >
            <span className="-rotate-45 text-[10px] font-black leading-none">◆</span>
          </button>
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
      />
    </div>
  );
};
