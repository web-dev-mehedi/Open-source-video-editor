import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  aiModelManager,
} from '../../services/ai/modelManager';
import {
  AIModelPackage,
  HardwareInspectionResult,
  ModelTier,
} from '../../types/aiModel';
import {
  Cpu,
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  HardDrive,
  Zap,
  Star,
  Check,
  RefreshCw,
  Layers,
  ShieldCheck,
} from 'lucide-react';

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedTier?: ModelTier;
  onModelSelected?: (tier: ModelTier) => void;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
  initialSelectedTier,
  onModelSelected,
}) => {
  const [models, setModels] = useState<AIModelPackage[]>([]);
  const [hardware, setHardware] = useState<HardwareInspectionResult | null>(null);
  const [activeTier, setActiveTier] = useState<ModelTier>(() => aiModelManager.getActiveModelTier());
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = aiModelManager.subscribe((list) => {
      setModels([...list]);
    });
    setHardware(aiModelManager.inspectHardware());
    return () => unsub();
  }, []);

  const totalDiskBytes = aiModelManager.getTotalDiskUsageBytes();
  const totalDiskMb = (totalDiskBytes / (1024 * 1024)).toFixed(1);

  const handleDownload = async (modelId: string) => {
    await aiModelManager.downloadModel(modelId);
  };

  const handlePause = (modelId: string) => {
    aiModelManager.pauseDownload(modelId);
  };

  const handleCancel = (modelId: string) => {
    aiModelManager.cancelDownload(modelId);
  };

  const handleUninstall = (modelId: string) => {
    aiModelManager.uninstallModel(modelId);
  };

  const handleVerify = (modelId: string) => {
    setVerifyingId(modelId);
    setTimeout(() => {
      aiModelManager.verifyModel(modelId);
      setVerifyingId(null);
    }, 600);
  };

  const handleSelectModel = (tier: ModelTier) => {
    setActiveTier(tier);
    aiModelManager.setActiveModelTier(tier);
    if (onModelSelected) onModelSelected(tier);
  };

  const renderStarRating = (count: number, max = 5) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Background Removal Model Manager"
      subtitle="Local neural models for subject cutout & matting — 100% offline & private"
      maxWidth="2xl"
    >
      <div className="space-y-4 select-none">
        {/* Hardware Recommendation Banner */}
        {hardware && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-cyan-950/30 to-purple-950/20 border border-forge-purple/40 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-forge-cyan" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Hardware Recommendation
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-forge-purple/30 text-purple-200 border border-forge-purple/50 font-bold uppercase">
                Recommended: {hardware.recommendedTier}
              </span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {hardware.recommendationReason}
            </p>
            <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-400 font-mono">
              <span>GPU: {hardware.gpuRenderer.slice(0, 32)}</span>
              <span>•</span>
              <span>Est. VRAM: {Math.round(hardware.estimatedVramMb / 1024)}GB</span>
              <span>•</span>
              <span>Total AI Storage Used: {totalDiskMb} MB</span>
            </div>
          </div>
        )}

        {/* Model Cards Grid */}
        <div className="space-y-3">
          {models.map((pkg) => {
            const isInstalled = pkg.status === 'installed';
            const isDownloading = pkg.status === 'downloading';
            const isPaused = pkg.status === 'paused';
            const isSelected = activeTier === pkg.tier;
            const isRec = hardware?.recommendedTier === pkg.tier;

            return (
              <div
                key={pkg.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelected && isInstalled
                    ? 'bg-[#18181f] border-forge-purple ring-1 ring-forge-purple'
                    : isRec
                    ? 'bg-[#141418] border-cyan-900/60'
                    : 'bg-[#121215] border-[#27272a]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase">{pkg.tier}</span>
                      <span className="text-[11px] text-gray-300 font-medium">({pkg.name})</span>
                      {isRec && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                          Best Fit
                        </span>
                      )}
                      {isInstalled && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Installed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">{pkg.description}</p>
                  </div>

                  {/* Right Action Button */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isInstalled ? (
                      <button
                        onClick={() => handleSelectModel(pkg.tier)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-forge-purple text-white shadow-sm'
                            : 'bg-[#27272a] hover:bg-[#3f3f46] text-gray-200'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{isSelected ? 'Active Model' : 'Use Model'}</span>
                      </button>
                    ) : isDownloading ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePause(pkg.id)}
                          className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                          title="Pause download"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCancel(pkg.id)}
                          className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                          title="Cancel download"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : isPaused ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownload(pkg.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-forge-cyan text-black font-bold text-xs flex items-center gap-1"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                          <span>Resume</span>
                        </button>
                        <button
                          onClick={() => handleCancel(pkg.id)}
                          className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(pkg.id)}
                        className="px-3 py-1.5 rounded-lg bg-forge-cyan text-black font-bold text-xs hover:bg-cyan-400 transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar while downloading */}
                {(isDownloading || isPaused || pkg.status === 'verifying') && (
                  <div className="mt-2.5 pt-2 border-t border-[#27272a] space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-gray-400">
                      <span>
                        {pkg.status === 'verifying'
                          ? 'Verifying SHA-256 integrity...'
                          : isPaused
                          ? 'Download paused'
                          : `Downloading (${((pkg.downloadedBytes || 0) / (1024 * 1024)).toFixed(1)} / ${(pkg.downloadSizeBytes / (1024 * 1024)).toFixed(1)} MB)`}
                      </span>
                      <span className="font-bold text-forge-cyan">{pkg.downloadProgressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1f1f23] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          pkg.status === 'verifying'
                            ? 'bg-amber-400 animate-pulse'
                            : isPaused
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-forge-purple to-forge-cyan'
                        }`}
                        style={{ width: `${pkg.downloadProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Technical Specs Table Row */}
                <div className="mt-2.5 pt-2 border-t border-[#222227] grid grid-cols-4 gap-2 text-[10px]">
                  <div>
                    <span className="text-gray-500 block">Download / Disk</span>
                    <span className="font-mono text-gray-300">
                      ~{(pkg.downloadSizeBytes / (1024 * 1024)).toFixed(0)} MB / ~{(pkg.diskSizeBytes / (1024 * 1024)).toFixed(0)} MB
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block">VRAM Required</span>
                    <span className="font-mono text-gray-300">
                      ~{(pkg.vramRequirementMb / 1024).toFixed(1)} GB VRAM
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block">Quality</span>
                    {renderStarRating(pkg.qualityRating)}
                  </div>

                  <div>
                    <span className="text-gray-500 block">Inference Speed</span>
                    {renderStarRating(pkg.speedRating)}
                  </div>
                </div>

                {/* Installed Management Actions (Verify / Delete) */}
                {isInstalled && (
                  <div className="mt-2 pt-1.5 flex items-center justify-between text-[10px] text-gray-400">
                    <span className="font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>SHA-256 Verified</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVerify(pkg.id)}
                        disabled={verifyingId === pkg.id}
                        className="hover:text-white flex items-center gap-1"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${verifyingId === pkg.id ? 'animate-spin' : ''}`} />
                        <span>{verifyingId === pkg.id ? 'Verifying...' : 'Verify'}</span>
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => handleUninstall(pkg.id)}
                        className="text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Uninstall</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-[#27272a]">
          <span className="text-[11px] text-gray-500">
            Downloaded models are stored permanently in local application storage.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};
