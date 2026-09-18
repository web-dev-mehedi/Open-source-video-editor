import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { TrackedTarget, TrackPoint } from '../../types/objectTracking';
import { interpolateTrackedPosition } from '../../utils/objectTrackingEngine';
import { Slider } from '../common/Slider';
import {
  Target,
  Sparkles,
  Link,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Move,
  Layers,
  Check,
} from 'lucide-react';
import { Button } from '../common/Button';

export const ObjectTrackingInspector: React.FC = () => {
  const { project, currentTime, setCurrentTime, updateClip } = useProject();

  const [trackingTarget, setTrackingTarget] = useState<TrackedTarget>({
    id: 'track_target_1',
    name: 'Object 1 (e.g. Person / Product)',
    enabled: true,
    linkedType: 'caption',
    linkedId: 'active_caption',
    trackPoints: [
      { id: 'tp_1', time: 0.0, x: 50, y: 35, scale: 1.0, rotation: 0 },
      { id: 'tp_2', time: 3.0, x: 62, y: 40, scale: 1.1, rotation: 5 },
      { id: 'tp_3', time: 6.0, x: 45, y: 30, scale: 0.95, rotation: -4 },
    ],
    smoothing: 40,
    matchScale: true,
    matchRotation: true,
    offsetX: 0,
    offsetY: -15, // Default placed slightly above tracked anchor
  });

  const currentPos = interpolateTrackedPosition(trackingTarget, currentTime);

  const handleAddTrackPoint = () => {
    const newPoint: TrackPoint = {
      id: `tp_${Date.now()}`,
      time: Math.round(currentTime * 100) / 100,
      x: currentPos?.x ?? 50,
      y: currentPos?.y ?? 50,
      scale: 1.0,
      rotation: 0,
    };

    const updatedPoints = [...trackingTarget.trackPoints, newPoint].sort((a, b) => a.time - b.time);
    setTrackingTarget((prev) => ({ ...prev, trackPoints: updatedPoints }));
  };

  return (
    <div className="space-y-4 p-4 bg-[#141416] rounded-2xl border border-[#27272a] text-gray-200 select-none text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-forge-cyan/20 border border-forge-cyan/40 flex items-center justify-center text-forge-cyan">
            <Target className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-white text-xs block">Manual Object Tracking</span>
            <span className="text-[10px] text-gray-400 block">Pin graphics & captions to motion</span>
          </div>
        </div>

        <button
          onClick={() => setTrackingTarget((p) => ({ ...p, enabled: !p.enabled }))}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow-sm ${
            trackingTarget.enabled
              ? 'bg-forge-cyan text-black font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]'
              : 'bg-[#202024] text-gray-400 border border-white/5'
          }`}
        >
          {trackingTarget.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {trackingTarget.enabled && (
        <div className="space-y-3.5">
          {/* Target Name & Link Dropdown */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Linked Element (Follower)
            </label>
            <select
              value={trackingTarget.linkedType}
              onChange={(e) =>
                setTrackingTarget((p) => ({ ...p, linkedType: e.target.value as any }))
              }
              className="w-full px-3 py-1.5 bg-[#202024] border border-[#3f3f46] rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-forge-cyan"
            >
              <option value="caption">Animated Captions (Follow Speaker)</option>
              <option value="overlay">Motion Graphic / Sticker / Badge</option>
              <option value="broll">B-Roll Video Layer (PiP)</option>
            </select>
          </div>

          {/* Add Track Point at Playhead */}
          <div className="p-3 bg-[#0d0d10] rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-forge-cyan" />
                <span>Motion Path Points ({trackingTarget.trackPoints.length})</span>
              </span>

              <button
                onClick={handleAddTrackPoint}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forge-cyan hover:bg-cyan-400 text-black font-bold text-[11px] transition-all shadow"
                title="Add tracking keyframe at current playhead"
              >
                <Plus className="w-3 h-3" />
                <span>Add Node</span>
              </button>
            </div>

            {/* Current Interpolated Coordinates */}
            {currentPos && (
              <div className="flex items-center justify-between font-mono text-[10px] text-gray-400 pt-1">
                <span>X: {currentPos.x}%</span>
                <span>Y: {currentPos.y}%</span>
                <span>Scale: {currentPos.scale}x</span>
                <span>Rot: {currentPos.rotation}°</span>
              </div>
            )}
          </div>

          {/* Offsets & Smoothing */}
          <Slider
            label="Vertical Offset (Height from Target)"
            value={trackingTarget.offsetY}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(v) => setTrackingTarget((p) => ({ ...p, offsetY: v }))}
          />

          <Slider
            label="Trajectory Smoothing"
            value={trackingTarget.smoothing}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => setTrackingTarget((p) => ({ ...p, smoothing: v }))}
          />
        </div>
      )}
    </div>
  );
};
