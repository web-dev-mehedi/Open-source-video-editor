import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { VideoClip } from '../../types/project';
import { useProject } from '../../context/ProjectContext';
import { detectScenesInVideoClip } from '../../utils/sceneDetectionEngine';
import { DetectedSceneCut } from '../../types/sceneDetection';
import { formatTimecode } from '../../utils/timecode';
import { Scissors, Film, Sparkles, Check, X, RefreshCw, Layers } from 'lucide-react';
import { Button } from '../common/Button';

interface SceneDetectionModalProps {
  clip: VideoClip;
  onClose: () => void;
}

export const SceneDetectionModal: React.FC<SceneDetectionModalProps> = ({ clip, onClose }) => {
  const { project, setClips } = useProject();

  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [detectedScenes, setDetectedScenes] = useState<DetectedSceneCut[]>([]);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress(0);

    try {
      const scenes = await detectScenesInVideoClip(
        clip,
        {
          sensitivity,
          minSceneDurationSec: 0.8,
          sampleIntervalSec: 0.2,
        },
        (pct) => setProgress(pct)
      );
      setDetectedScenes(scenes);
    } catch (err) {
      console.error('Scene detection failed', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [sensitivity]);

  const handleApplySplit = () => {
    if (!project || detectedScenes.length <= 1) {
      onClose();
      return;
    }

    const newClips: VideoClip[] = detectedScenes.map((scene, idx) => {
      return {
        ...clip,
        id: `clip_${Date.now()}_scene_${idx + 1}`,
        name: `${clip.name} [Scene ${idx + 1}]`,
        startOffset: scene.timestamp,
        endOffset: scene.timestamp + scene.duration * (clip.speed || 1.0),
        timelineStart: scene.timelineTimestamp,
        timelineDuration: scene.duration,
      };
    });

    const clipIdx = project.clips.findIndex((c) => c.id === clip.id);
    const updatedClips = [...project.clips];
    updatedClips.splice(clipIdx, 1, ...newClips);

    setClips(updatedClips);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-gray-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#121214]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forge-cyan/20 border border-forge-cyan/40 flex items-center justify-center text-forge-cyan shadow">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Intelligent Scene Detection</h3>
              <p className="text-[11px] text-gray-400">
                Non-AI visual histogram cut detection for <strong className="text-white">{clip.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#27272a]/60 hover:bg-[#27272a] text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-5 py-3 border-b border-[#27272a] flex items-center justify-between bg-[#141416]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300">Sensitivity:</span>
            {(['low', 'medium', 'high'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSensitivity(s)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  sensitivity === s
                    ? 'bg-forge-cyan text-black font-bold shadow'
                    : 'bg-[#202024] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-forge-cyan' : ''}`} />
            <span>Re-analyze</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full border-3 border-forge-cyan/20 border-t-forge-cyan animate-spin" />
              <span className="text-xs font-bold text-white">Analyzing Color & Edge Shifts...</span>
              <div className="w-64 bg-[#27272a] h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progress}%` }}
                  className="bg-forge-cyan h-full rounded-full transition-all duration-150"
                />
              </div>
              <span className="text-[10px] font-mono text-gray-400">{progress}% complete</span>
            </div>
          ) : detectedScenes.length === 0 ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <Film className="w-8 h-8 mx-auto text-gray-600" />
              <p className="text-xs font-semibold">No visual cuts detected</p>
              <p className="text-[11px] text-gray-500">Try switching sensitivity to "High".</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Detected <span className="text-forge-cyan font-extrabold">{detectedScenes.length}</span> Distinct Scenes
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  Total Duration: {formatTimecode(clip.timelineDuration, true)}
                </span>
              </div>

              {/* Detected Scenes Grid */}
              <div className="grid grid-cols-3 gap-3">
                {detectedScenes.map((scene, idx) => (
                  <div
                    key={scene.id}
                    className="flex flex-col bg-[#141416] rounded-xl border border-[#27272a] overflow-hidden group hover:border-forge-cyan/60 transition-colors shadow"
                  >
                    {/* Thumbnail preview */}
                    <div className="w-full aspect-video bg-black/60 relative overflow-hidden flex items-center justify-center">
                      {scene.thumbnailUrl ? (
                        <img src={scene.thumbnailUrl} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <Film className="w-6 h-6 text-gray-600" />
                      )}
                      <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300">
                        {scene.duration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="p-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Scene {idx + 1}</span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {formatTimecode(scene.timelineTimestamp, true)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#27272a] flex items-center justify-between bg-[#121214]">
          <span className="text-xs text-gray-400">
            Split cuts will replace current clip on Track V{clip.trackIndex || 1}
          </span>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isAnalyzing || detectedScenes.length <= 1}
              onClick={handleApplySplit}
              className="bg-forge-cyan hover:bg-cyan-500 text-black font-bold flex items-center gap-1.5 shadow"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Split into {detectedScenes.length} Clips</span>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
