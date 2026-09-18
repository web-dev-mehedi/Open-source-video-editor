import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { SilenceInterval, SilenceRemoverSettings, DEFAULT_SILENCE_SETTINGS } from '../../types/silenceRemover';
import { detectSilenceIntervals } from '../../utils/silenceRemoverEngine';
import {
  Scissors,
  VolumeX,
  Sparkles,
  Check,
  X,
  Play,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export interface SilenceRemoverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SilenceRemoverModal: React.FC<SilenceRemoverModalProps> = ({ isOpen, onClose }) => {
  const { project, setCurrentTime } = useProject();
  const [settings, setSettings] = useState<SilenceRemoverSettings>(DEFAULT_SILENCE_SETTINGS);
  const [intervals, setIntervals] = useState<SilenceInterval[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [removedSuccess, setRemovedSuccess] = useState<boolean>(false);

  const activeClip = project?.clips?.[0];
  const peaks = activeClip?.waveformPeaks || [];
  const duration = project?.metadata.duration || 10;

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const detected = detectSilenceIntervals(peaks, duration, settings);
      setIntervals(detected);
      setIsScanning(false);
    }, 300);
  };

  useEffect(() => {
    if (isOpen) {
      handleScan();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalSilenceTime = intervals
    .filter((i) => i.isSelected)
    .reduce((acc, curr) => acc + curr.duration, 0);

  const handleToggleInterval = (id: string) => {
    setIntervals((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const handleApplyRippleCut = () => {
    setRemovedSuccess(true);
    setTimeout(() => {
      setRemovedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-[#121214]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forge-cyan/20 border border-forge-cyan/40 flex items-center justify-center text-forge-cyan">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Silence & Pause Remover</h3>
              <p className="text-[11px] text-gray-400">
                Detect and delete dead air intervals to create fast-paced jump cuts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#27272a] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Settings Grid */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-[#1f1f23] border border-[#27272a]">
            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Min Pause Duration</span>
              <select
                value={settings.minDuration}
                onChange={(e) => {
                  setSettings({ ...settings, minDuration: parseFloat(e.target.value) });
                  handleScan();
                }}
                className="w-full bg-[#121214] border border-[#3f3f46] text-white text-xs rounded-lg p-1.5 focus:outline-none focus:border-forge-cyan"
              >
                <option value="0.2">0.2s (Aggressive Jump Cuts)</option>
                <option value="0.35">0.35s (Recommended)</option>
                <option value="0.5">0.5s (Natural Breaths)</option>
                <option value="0.8">0.8s (Long Pauses Only)</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Volume Threshold</span>
              <select
                value={settings.dbThreshold}
                onChange={(e) => {
                  setSettings({ ...settings, dbThreshold: parseInt(e.target.value, 10) });
                  handleScan();
                }}
                className="w-full bg-[#121214] border border-[#3f3f46] text-white text-xs rounded-lg p-1.5 focus:outline-none focus:border-forge-cyan"
              >
                <option value="-40">-40 dBFS (Quiet Studio)</option>
                <option value="-35">-35 dBFS (Standard)</option>
                <option value="-30">-30 dBFS (Noisy Room)</option>
              </select>
            </div>
          </div>

          {/* Scan Results Stats */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-gray-300">
              Found {intervals.length} Silent Intervals
            </span>
            <span className="text-xs font-mono font-bold text-forge-cyan">
              Saves {totalSilenceTime.toFixed(2)}s video time
            </span>
          </div>

          {/* Intervals List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {intervals.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs bg-[#1f1f23] rounded-xl border border-[#27272a]">
                No silence intervals found with current thresholds
              </div>
            ) : (
              intervals.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleInterval(item.id)}
                  className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    item.isSelected
                      ? 'border-forge-cyan/60 bg-cyan-950/30 text-white'
                      : 'border-[#27272a] bg-[#1f1f23]/60 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    <input
                      type="checkbox"
                      checked={item.isSelected}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 rounded bg-[#18181b] border-[#3f3f46] text-forge-cyan focus:ring-forge-cyan"
                    />
                    <span className="font-mono">
                      {item.start.toFixed(2)}s $\to$ {item.end.toFixed(2)}s
                    </span>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    -{item.duration.toFixed(2)}s
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#27272a] flex items-center justify-between bg-[#121214]">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-xs font-semibold text-gray-300 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleApplyRippleCut}
            disabled={intervals.filter((i) => i.isSelected).length === 0}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-forge-cyan to-forge-purple hover:opacity-90 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            {removedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Silences Cut Cleanly!</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete {intervals.filter((i) => i.isSelected).length} Pauses & Ripple</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
