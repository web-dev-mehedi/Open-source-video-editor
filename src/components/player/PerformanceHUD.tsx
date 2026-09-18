import React, { useState, useEffect } from 'react';
import { performanceMonitor, PerformanceMetrics } from '../../utils/performanceMonitor';
import { Activity, Cpu, HardDrive, Zap, X } from 'lucide-react';

interface PerformanceHUDProps {
  isOpen: boolean;
  onClose: () => void;
  activeClipsCount?: number;
  activeTracksCount?: number;
  activeEffectsCount?: number;
  previewScale?: number;
}

export const PerformanceHUD: React.FC<PerformanceHUDProps> = ({
  isOpen,
  onClose,
  activeClipsCount = 1,
  activeTracksCount = 1,
  activeEffectsCount = 0,
  previewScale = 1.0,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(() =>
    performanceMonitor.getMetrics(activeClipsCount, activeTracksCount, activeEffectsCount, previewScale)
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setMetrics(
        performanceMonitor.getMetrics(
          activeClipsCount,
          activeTracksCount,
          activeEffectsCount,
          previewScale
        )
      );
    }, 250);

    return () => clearInterval(timer);
  }, [isOpen, activeClipsCount, activeTracksCount, activeEffectsCount, previewScale]);

  if (!isOpen) return null;

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40';
    if (fps >= 30) return 'text-amber-400 border-amber-500/50 bg-amber-950/40';
    return 'text-red-400 border-red-500/50 bg-red-950/40';
  };

  return (
    <div className="absolute top-12 left-4 z-50 bg-[#121214]/95 border border-[#27272a] rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono select-none w-64 animate-fade-in text-gray-300 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a] mb-2.5">
        <div className="flex items-center gap-1.5 text-forge-cyan font-bold">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span className="text-[11px] uppercase tracking-wider">Performance Monitor</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-[#27272a]"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="space-y-2 text-[11px]">
        {/* FPS */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Playback Speed</span>
          <span className={`px-2 py-0.5 rounded-full border font-bold ${getFpsColor(metrics.fps)}`}>
            {metrics.fps} FPS
          </span>
        </div>

        {/* Frame Render Latency */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Frame Render Time</span>
          <span className="text-forge-cyan font-bold">{metrics.frameRenderTimeMs} ms</span>
        </div>

        {/* Decode Latency */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Media Decode Time</span>
          <span className="text-gray-300">{metrics.decodeTimeMs} ms</span>
        </div>

        {/* Cache Hit Rate */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Cache Hit Rate</span>
          <span className="text-purple-400 font-bold">{metrics.cacheHitRatePercent}%</span>
        </div>

        {/* Preview Scale */}
        <div className="flex items-center justify-between pt-1 border-t border-[#27272a]">
          <span className="text-gray-400">Preview Scale</span>
          <span className="text-amber-400 font-bold">{Math.round(previewScale * 100)}%</span>
        </div>

        {/* Active Workload */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
          <span>Clips: {activeClipsCount}</span>
          <span>Tracks: {activeTracksCount}</span>
          <span>Effects: {activeEffectsCount}</span>
        </div>
      </div>
    </div>
  );
};
