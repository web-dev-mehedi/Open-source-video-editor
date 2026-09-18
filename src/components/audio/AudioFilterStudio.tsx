import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ClipAudioFiltersState, DEFAULT_CLIP_AUDIO_FILTERS, EQBand } from '../../types/audioFilters';
import { AudioDuckingPanel } from './AudioDuckingPanel';
import { VocalIsolationStudio } from './VocalIsolationStudio';
import { Slider } from '../common/Slider';
import {
  Volume2,
  Mic,
  Sliders,
  Sparkles,
  Waves,
  Zap,
  Activity,
  RotateCcw,
  Music,
  Radio,
  Headphones,
  Check,
} from 'lucide-react';
import { Button } from '../common/Button';

export const AudioFilterStudio: React.FC = () => {
  const {
    project,
    selectedClipId,
    selectedAudioClipId,
    updateClip,
    updateAudioClip,
    enhanceAudioClip,
    enhanceAudioClipTrack,
  } = useProject();

  const activeClip = project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];
  const activeAudioClip = project?.audioClips?.find((a) => a.id === selectedAudioClipId);

  const targetId = activeAudioClip?.id || activeClip?.id;

  const [filters, setFilters] = useState<ClipAudioFiltersState>(() => {
    return (activeAudioClip as any)?.audioFilters || (activeClip as any)?.audioFilters || { ...DEFAULT_CLIP_AUDIO_FILTERS };
  });

  const [activeTab, setActiveTab] = useState<'vocal-isolation' | 'eq' | 'vocal' | 'dynamics' | 'ducking' | 'pitch'>('vocal-isolation');

  useEffect(() => {
    const existing = (activeAudioClip as any)?.audioFilters || (activeClip as any)?.audioFilters;
    if (existing) setFilters(existing);
  }, [targetId]);

  const updateFilters = (updates: Partial<ClipAudioFiltersState>) => {
    const next = { ...filters, ...updates };
    setFilters(next);
    if (activeAudioClip) {
      updateAudioClip(activeAudioClip.id, { audioFilters: next } as any);
    } else if (activeClip) {
      updateClip(activeClip.id, { audioFilters: next } as any);
    }
  };

  const handleResetAll = () => {
    setFilters({ ...DEFAULT_CLIP_AUDIO_FILTERS });
    if (activeAudioClip) {
      updateAudioClip(activeAudioClip.id, { audioFilters: { ...DEFAULT_CLIP_AUDIO_FILTERS } } as any);
    } else if (activeClip) {
      updateClip(activeClip.id, { audioFilters: { ...DEFAULT_CLIP_AUDIO_FILTERS } } as any);
    }
  };

  const handleUpdateBand = (bandId: string, gain: number) => {
    const updatedBands = filters.eqBands.map((b) => (b.id === bandId ? { ...b, gain } : b));
    updateFilters({ eqBands: updatedBands });
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-hidden text-xs">
      {/* Top Tabs */}
      <div className="h-10 bg-[#121214] border-b border-[#27272a] px-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab('vocal-isolation')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'vocal-isolation' ? 'bg-forge-cyan text-black shadow-sm font-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Vocal Remover
          </button>
          <button
            onClick={() => setActiveTab('eq')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'eq' ? 'bg-forge-cyan text-black shadow-sm font-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            5-Band EQ
          </button>
          <button
            onClick={() => setActiveTab('vocal')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'vocal' ? 'bg-forge-cyan text-black shadow-sm font-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Vocal Clarity
          </button>
          <button
            onClick={() => setActiveTab('dynamics')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'dynamics' ? 'bg-forge-cyan text-black shadow-sm font-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Compressor
          </button>
          <button
            onClick={() => setActiveTab('ducking')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ducking' ? 'bg-forge-cyan text-black shadow-sm font-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Auto Ducking
          </button>
          <button
            onClick={() => setActiveTab('pitch')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pitch' ? 'bg-forge-cyan text-black shadow-sm font-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Voice FX
          </button>
        </div>

        <button
          onClick={handleResetAll}
          className="p-1 rounded text-gray-400 hover:text-red-400 transition-colors"
          title="Reset Audio Filters"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
        {/* Vocal Remover & Stem Splitter */}
        {activeTab === 'vocal-isolation' && <VocalIsolationStudio />}
        {/* Auto Ducking Tab */}
        {activeTab === 'ducking' && <AudioDuckingPanel />}
        {/* 1. 5-Band Parametric Equalizer */}
        {activeTab === 'eq' && (
          <div className="space-y-4">
            {/* Live Frequency Response Curve Visualizer */}
            <div className="p-3 bg-[#121214] rounded-2xl border border-[#27272a] flex flex-col items-center">
              <EQCurveVisualizer bands={filters.eqBands} />
              <div className="flex items-center justify-between w-full text-[10px] font-mono text-gray-500 mt-2 px-2">
                <span>80Hz (Bass)</span>
                <span>1kHz (Body)</span>
                <span>12kHz (Air)</span>
              </div>
            </div>

            {/* Band Sliders */}
            <div className="space-y-2 p-3 bg-[#141416] rounded-2xl border border-[#27272a]">
              {filters.eqBands.map((band) => (
                <div key={band.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
                    <span>{band.name}</span>
                    <span className={`font-mono ${band.gain !== 0 ? 'text-forge-cyan font-bold' : 'text-gray-500'}`}>
                      {band.gain > 0 ? `+${band.gain}dB` : `${band.gain}dB`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={band.gain}
                    onChange={(e) => handleUpdateBand(band.id, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Broadcast Vocal Enhancer */}
        {activeTab === 'vocal' && (
          <div className="space-y-3 p-3 bg-[#141416] rounded-2xl border border-[#27272a]">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-forge-purple" />
                <span>Broadcast Vocal Enhancer</span>
              </span>
              <input
                type="checkbox"
                checked={filters.vocalEnhancer.enabled}
                onChange={(e) =>
                  updateFilters({
                    vocalEnhancer: { ...filters.vocalEnhancer, enabled: e.target.checked },
                  })
                }
                className="rounded accent-forge-cyan cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-[#121214] p-2.5 rounded-xl border border-white/5">
              <span className="font-medium text-gray-300">80Hz Sub-Bass Rumble Cut</span>
              <input
                type="checkbox"
                checked={filters.vocalEnhancer.rumbleCut}
                onChange={(e) =>
                  updateFilters({
                    vocalEnhancer: { ...filters.vocalEnhancer, rumbleCut: e.target.checked },
                  })
                }
                className="rounded accent-forge-cyan cursor-pointer"
              />
            </div>

            <Slider
              label="Presence & Intelligibility (3kHz)"
              value={filters.vocalEnhancer.presence}
              min={0}
              max={100}
              unit="%"
              onChange={(v) =>
                updateFilters({
                  vocalEnhancer: { ...filters.vocalEnhancer, presence: v },
                })
              }
            />

            <Slider
              label="Air & Vocal Clarity (6.5kHz)"
              value={filters.vocalEnhancer.clarity}
              min={0}
              max={100}
              unit="%"
              onChange={(v) =>
                updateFilters({
                  vocalEnhancer: { ...filters.vocalEnhancer, clarity: v },
                })
              }
            />

            <Slider
              label="Vocal Warmth & Body (250Hz)"
              value={filters.vocalEnhancer.warmth}
              min={0}
              max={100}
              unit="%"
              onChange={(v) =>
                updateFilters({
                  vocalEnhancer: { ...filters.vocalEnhancer, warmth: v },
                })
              }
            />

            {/* AI Speech Denoise Action */}
            <div className="mt-4 pt-3 border-t border-[#27272a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-forge-cyan" />
                  <span>AI Denoise & Noise Reduction</span>
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                  Local
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                Removes stationary room hiss, air conditioner noise, and electrical hum locally
              </p>
              <button
                onClick={() => {
                  if (activeClip) enhanceAudioClip(activeClip.id);
                  else if (activeAudioClip) enhanceAudioClipTrack(activeAudioClip.id);
                }}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-forge-cyan to-forge-purple text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply Denoise (Clean Voice)</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Studio Dynamic Compressor */}
        {activeTab === 'dynamics' && (
          <div className="space-y-3 p-3 bg-[#141416] rounded-2xl border border-[#27272a]">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-forge-cyan" />
                <span>Studio Dynamic Compressor</span>
              </span>
              <input
                type="checkbox"
                checked={filters.compressor.enabled}
                onChange={(e) =>
                  updateFilters({
                    compressor: { ...filters.compressor, enabled: e.target.checked },
                  })
                }
                className="rounded accent-forge-cyan cursor-pointer"
              />
            </div>

            <Slider
              label="Threshold"
              value={filters.compressor.threshold}
              min={-40}
              max={0}
              unit="dB"
              onChange={(v) =>
                updateFilters({
                  compressor: { ...filters.compressor, threshold: v },
                })
              }
            />

            <Slider
              label="Ratio"
              value={filters.compressor.ratio}
              min={1}
              max={12}
              unit=":1"
              onChange={(v) =>
                updateFilters({
                  compressor: { ...filters.compressor, ratio: v },
                })
              }
            />

            <Slider
              label="Makeup Gain"
              value={filters.compressor.makeupGain}
              min={0}
              max={18}
              unit="dB"
              onChange={(v) =>
                updateFilters({
                  compressor: { ...filters.compressor, makeupGain: v },
                })
              }
            />
          </div>
        )}

        {/* 4. Voice Transformer & Pitch Shifter */}
        {activeTab === 'pitch' && (
          <div className="space-y-3 p-3 bg-[#141416] rounded-2xl border border-[#27272a]">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-purple-400" />
                <span>Voice Transformer & Pitch</span>
              </span>
              <input
                type="checkbox"
                checked={filters.pitchShift.enabled}
                onChange={(e) =>
                  updateFilters({
                    pitchShift: { ...filters.pitchShift, enabled: e.target.checked },
                  })
                }
                className="rounded accent-forge-cyan cursor-pointer"
              />
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { name: 'Studio Deep', semi: -4 },
                { name: 'Radio Mic', semi: -1 },
                { name: 'Helium', semi: +5 },
                { name: 'Chipmunk', semi: +8 },
                { name: 'Deep Monster', semi: -8 },
                { name: 'Robot', semi: 0 },
              ].map((pst) => (
                <button
                  key={pst.name}
                  onClick={() =>
                    updateFilters({
                      pitchShift: { enabled: true, semitones: pst.semi, preset: 'custom' },
                    })
                  }
                  className={`p-2 rounded-xl border text-center transition-all ${
                    filters.pitchShift.semitones === pst.semi && filters.pitchShift.enabled
                      ? 'bg-forge-cyan text-black font-bold border-forge-cyan'
                      : 'bg-[#121214] text-gray-300 border-white/5 hover:border-gray-500'
                  }`}
                >
                  <span className="block text-[11px]">{pst.name}</span>
                  <span className="block text-[9px] font-mono opacity-70">
                    {pst.semi > 0 ? `+${pst.semi}` : pst.semi} st
                  </span>
                </button>
              ))}
            </div>

            <Slider
              label="Pitch Shift Semitones"
              value={filters.pitchShift.semitones}
              min={-12}
              max={12}
              unit="st"
              onChange={(v) =>
                updateFilters({
                  pitchShift: { ...filters.pitchShift, semitones: v, enabled: true },
                })
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Interactive SVG Frequency Response Visualizer
// -------------------------------------------------------------
const EQCurveVisualizer: React.FC<{ bands: EQBand[] }> = ({ bands }) => {
  const width = 230;
  const height = 90;
  const midY = height / 2;

  // Generate smooth curve through 5 band gain coordinates
  const coords = bands.map((b, idx) => {
    const x = (idx / (bands.length - 1)) * (width - 24) + 12;
    const y = midY - (b.gain / 12) * (height * 0.42);
    return { x, y };
  });

  const pathD = coords.reduce((acc, c, idx) => {
    return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
  }, '');

  return (
    <svg width={width} height={height} className="bg-[#0b0b0d] rounded-xl border border-white/10 select-none">
      {/* 0 dB Center Reference Line */}
      <line x1={0} y1={midY} x2={width} y2={midY} stroke="#3f3f46" strokeDasharray="3 3" />

      {/* Grid Lines */}
      <line x1={width * 0.25} y1={0} x2={width * 0.25} y2={height} stroke="#27272a" strokeDasharray="2 2" />
      <line x1={width * 0.5} y1={0} x2={width * 0.5} y2={height} stroke="#27272a" strokeDasharray="2 2" />
      <line x1={width * 0.75} y1={0} x2={width * 0.75} y2={height} stroke="#27272a" strokeDasharray="2 2" />

      {/* Response Curve */}
      <path d={pathD} fill="none" stroke="#06B6D4" strokeWidth={2.5} className="transition-all" />

      {/* Band Nodes */}
      {coords.map((c, idx) => (
        <circle
          key={idx}
          cx={c.x}
          cy={c.y}
          r={4.5}
          fill="#06B6D4"
          stroke="#000000"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
};
