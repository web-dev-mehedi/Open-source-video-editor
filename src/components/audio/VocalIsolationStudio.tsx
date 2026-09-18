import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { VocalIsolationConfig, DEFAULT_VOCAL_ISOLATION_CONFIG } from '../../types/vocalIsolation';
import { audioProcessor, decodeAudioFromUrl } from '../../services/audio/audioProcessor';
import {
  Mic,
  Music,
  Split,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Play,
  Pause,
  Layers,
  AlertCircle,
} from 'lucide-react';

export const VocalIsolationStudio: React.FC = () => {
  const { project, selectedClipId, updateClip, appendAudioClipToTimeline } = useProject();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAudition, setActiveAudition] = useState<'vocals' | 'instrumental' | null>(null);

  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeClip =
    project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];

  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
      }
    };
  }, []);

  if (!activeClip) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center h-full">
        <Mic className="w-8 h-8 mb-2 opacity-40 text-forge-cyan" />
        <p className="font-semibold text-gray-300">No Clip Selected</p>
        <p className="mt-1 text-gray-500">Select a clip on the timeline to extract vocals</p>
      </div>
    );
  }

  const config: VocalIsolationConfig = (activeClip as any).vocalIsolation || DEFAULT_VOCAL_ISOLATION_CONFIG;

  const handleUpdate = (updates: Partial<VocalIsolationConfig>) => {
    const newConfig: VocalIsolationConfig = { ...config, ...updates };
    updateClip(activeClip.id, { vocalIsolation: newConfig } as any);
  };

  const handleReset = () => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
    }
    setActiveAudition(null);
    updateClip(activeClip.id, { vocalIsolation: DEFAULT_VOCAL_ISOLATION_CONFIG } as any);
  };

  const handleProcessStems = async () => {
    const mediaUrl = activeClip.mediaBlobUrl || activeClip.filePath;
    if (!mediaUrl) {
      setError('Selected clip has no audio source.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const audioBuffer = await decodeAudioFromUrl(mediaUrl);
      if (!audioBuffer) {
        throw new Error('Failed to decode audio track from selected clip. The media format may be unsupported.');
      }

      const stems = await audioProcessor.separateVocalStems(audioBuffer, {
        vocalGain: config.vocalGain,
        instrumentalGain: config.instrumentalGain,
      });

      handleUpdate({
        isEnabled: true,
        isProcessed: true,
        vocalsBlobUrl: stems.vocalsBlobUrl,
        instrumentalBlobUrl: stems.instrumentalBlobUrl,
      });
    } catch (err: any) {
      console.error('[VocalIsolationStudio] Stem separation error:', err);
      setError(err?.message || 'Stem separation failed. Please verify media audio integrity.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddStemsToTimeline = () => {
    if (!config.vocalsBlobUrl || !config.instrumentalBlobUrl) return;

    // Track A1: Vocals Stem
    appendAudioClipToTimeline(
      {
        name: `${activeClip.name} (Vocals)`,
        filePath: '',
        mediaBlobUrl: config.vocalsBlobUrl,
        duration: activeClip.timelineDuration,
        timelineDuration: activeClip.timelineDuration,
      },
      1,
      activeClip.timelineStart
    );

    // Track A2: Instrumental Stem
    appendAudioClipToTimeline(
      {
        name: `${activeClip.name} (Instrumental)`,
        filePath: '',
        mediaBlobUrl: config.instrumentalBlobUrl,
        duration: activeClip.timelineDuration,
        timelineDuration: activeClip.timelineDuration,
      },
      2,
      activeClip.timelineStart
    );
  };

  const handleToggleAudition = (type: 'vocals' | 'instrumental') => {
    const targetUrl = type === 'vocals' ? config.vocalsBlobUrl : config.instrumentalBlobUrl;
    if (!targetUrl) return;

    if (activeAudition === type) {
      if (auditionAudioRef.current) auditionAudioRef.current.pause();
      setActiveAudition(null);
    } else {
      if (auditionAudioRef.current) auditionAudioRef.current.pause();
      const el = new Audio(targetUrl);
      el.onended = () => setActiveAudition(null);
      el.play().catch(() => setActiveAudition(null));
      auditionAudioRef.current = el;
      setActiveAudition(type);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-gray-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-[#27272a] flex items-center justify-between flex-shrink-0 bg-[#121214]">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Vocal Isolation & Stem Splitter</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Local neural center-channel source separation
          </p>
        </div>

        {config.isEnabled && (
          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white transition-colors"
            title="Reset Isolation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Process Stems Banner */}
        <div className="p-3 rounded-xl bg-[#1f1f23] border border-[#27272a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Split className="w-4 h-4 text-forge-cyan" />
              <div>
                <span className="text-xs font-bold text-white">Local Audio Stem Separation</span>
                <p className="text-[10px] text-gray-400">
                  {config.isProcessed ? 'Vocals and Instrumental stems separated' : 'Ready to separate audio locally'}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={config.isEnabled}
              onChange={(e) => handleUpdate({ isEnabled: e.target.checked })}
              className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-forge-cyan focus:ring-forge-cyan cursor-pointer"
            />
          </div>

          <button
            onClick={handleProcessStems}
            disabled={isProcessing}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-forge-cyan to-forge-purple text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Separating Stems Locally...</span>
              </>
            ) : config.isProcessed ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Re-Extract Vocal Stems</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Isolate Dialogue & Vocals</span>
              </>
            )}
          </button>
        </div>

        {config.isEnabled && (
          <div className="space-y-3.5 pt-1">
            {/* Extraction Mode */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Extraction Mode
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'isolate_vocals', label: 'Vocals Only' },
                  { id: 'remove_vocals', label: 'Instrumental' },
                  { id: 'split_stems', label: 'Split Stems' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleUpdate({ isolationMode: m.id as any })}
                    className={`py-2 px-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                      config.isolationMode === m.id
                        ? 'border-forge-cyan bg-cyan-950/40 text-white ring-1 ring-forge-cyan'
                        : 'border-[#27272a] bg-[#1f1f23] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stem Audition Players (Real Audio Preview) */}
            {config.isProcessed && config.vocalsBlobUrl && config.instrumentalBlobUrl && (
              <div className="space-y-2 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Stem Preview & Verification
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleToggleAudition('vocals')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      activeAudition === 'vocals'
                        ? 'bg-forge-cyan text-black border-forge-cyan'
                        : 'bg-[#27272a] border-[#3f3f46] text-gray-200 hover:text-white hover:border-forge-cyan/50'
                    }`}
                  >
                    {activeAudition === 'vocals' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-forge-cyan" />}
                    <span>Audition Vocals</span>
                  </button>

                  <button
                    onClick={() => handleToggleAudition('instrumental')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      activeAudition === 'instrumental'
                        ? 'bg-forge-purple text-white border-forge-purple'
                        : 'bg-[#27272a] border-[#3f3f46] text-gray-200 hover:text-white hover:border-forge-purple/50'
                    }`}
                  >
                    {activeAudition === 'instrumental' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-forge-purple" />}
                    <span>Audition Music</span>
                  </button>
                </div>

                {/* Add to Timeline Button */}
                <button
                  onClick={handleAddStemsToTimeline}
                  className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-forge-cyan" />
                  <span>Add Both Stems to Audio Tracks (A1 & A2)</span>
                </button>
              </div>
            )}

            {/* Vocal Track Gain */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-gray-300">
                  <Mic className="w-3.5 h-3.5 text-forge-cyan" />
                  <span>Vocal Track Gain</span>
                </div>
                <span className="font-mono text-forge-cyan">{Math.round(config.vocalGain * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={config.vocalGain}
                onChange={(e) => handleUpdate({ vocalGain: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-cyan"
              />
            </div>

            {/* Instrumental Track Gain */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-[#1f1f23] border border-[#27272a]">
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-gray-300">
                  <Music className="w-3.5 h-3.5 text-forge-purple" />
                  <span>Instrumental / BGM Gain</span>
                </div>
                <span className="font-mono text-forge-purple">{Math.round(config.instrumentalGain * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={config.instrumentalGain}
                onChange={(e) => handleUpdate({ instrumentalGain: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-forge-purple"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
