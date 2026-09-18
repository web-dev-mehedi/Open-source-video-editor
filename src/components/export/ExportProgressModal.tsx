import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ExportProgress } from '../../types/export';
import {
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Play,
  Film,
  XCircle,
  Clock,
  HardDrive,
  Share2,
  Check,
  Sparkles,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExportProgressModalProps {
  isOpen: boolean;
  progress: ExportProgress | null;
  onCancel: () => void;
  onClose: () => void;
  onRetry?: () => void;
  onChooseAnotherFolder?: () => void;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  progress,
  onCancel,
  onClose,
  onRetry,
  onChooseAnotherFolder,
}) => {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  useEffect(() => {
    let timer: any;
    if (isOpen && progress?.status === 'rendering') {
      timer = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [isOpen, progress?.status]);

  if (!isOpen || !progress) return null;

  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  const isRendering = progress.status === 'rendering' || progress.status === 'pending' || progress.status === 'transcribing';

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOpenFolder = () => {
    if (window.captionForgeAPI?.openFolderInExplorer && progress.outputFilePath) {
      window.captionForgeAPI.openFolderInExplorer(progress.outputFilePath);
    } else if (progress.outputBlobUrl) {
      const anchor = document.createElement('a');
      anchor.href = progress.outputBlobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => document.body.removeChild(anchor), 1000);
    }
  };

  const handlePlayVideo = () => {
    if (window.captionForgeAPI?.openFile && progress.outputFilePath) {
      window.captionForgeAPI.openFile(progress.outputFilePath);
    } else if (window.captionForgeAPI?.openFolderInExplorer && progress.outputFilePath) {
      window.captionForgeAPI.openFolderInExplorer(progress.outputFilePath);
    } else if (progress.outputBlobUrl) {
      window.open(progress.outputBlobUrl, '_blank');
    }
  };

  const fileName = progress.outputFilePath
    ? progress.outputFilePath.split(/[\\/]/).pop() || 'Exported File'
    : 'Exported Video';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isCompleted || isFailed ? onClose : () => {}}
      title={
        isCompleted
          ? 'Export Succeeded!'
          : isFailed
          ? 'Export Failed'
          : 'Rendering Video...'
      }
      subtitle={
        isCompleted
          ? 'Your media file has been encoded and saved successfully'
          : isFailed
          ? progress.error || 'An error occurred during video rendering'
          : 'Asynchronous hardware-accelerated local encoding'
      }
      maxWidth="md"
    >
      <div className="space-y-4 select-none py-1">
        {/* ========================================================================= */}
        {/* STATE 2: RENDERING PROGRESS SCREEN */}
        {/* ========================================================================= */}
        {isRendering && (
          <div className="space-y-4">
            {/* Live Progress Graphic & Mini-Canvas Preview */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-workspace-panel border border-workspace-border space-y-3">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="stroke-workspace-border"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="stroke-workspace-cyan transition-all duration-300"
                    strokeWidth="8"
                    strokeDasharray="264"
                    strokeDashoffset={264 - (264 * (progress.percent || 0)) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center font-mono font-extrabold text-white text-base">
                  <span>{progress.percent || 0}%</span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-xs font-bold text-gray-200 block">
                  Baking Layers & Hardware Encoding
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {progress.currentFrame || 0} / {progress.totalFrames || 300} Frames
                </span>
              </div>
            </div>

            {/* Metrics Grid: Speed, Elapsed Time, ETA */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-workspace-panel border border-workspace-border">
                <span className="text-[10px] text-gray-400 block">Render Speed</span>
                <span className="text-xs font-mono font-bold text-workspace-cyan">
                  {progress.speed || `${progress.fps || 60} FPS`}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-workspace-panel border border-workspace-border">
                <span className="text-[10px] text-gray-400 block">Elapsed</span>
                <span className="text-xs font-mono font-bold text-white">
                  {formatSec(elapsed)}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-workspace-panel border border-workspace-border">
                <span className="text-[10px] text-gray-400 block">Estimated ETA</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {progress.timeRemaining || '00:08'}
                </span>
              </div>
            </div>

            {/* Cancel Export Action */}
            <div className="flex justify-center pt-2">
              <button
                onClick={onCancel}
                className="px-4 py-1.5 rounded-lg bg-workspace-panel hover:bg-red-950/40 border border-workspace-border hover:border-red-500/50 text-xs font-semibold text-gray-300 hover:text-red-300 transition-all flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Export</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATE 3: EXPORT SUCCESS / COMPLETION SCREEN */}
        {/* ========================================================================= */}
        {isCompleted && (
          <div className="space-y-4">
            {/* Animated Success Checkmark Badge */}
            <div className="flex flex-col items-center justify-center p-3 space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-white">Export Finished Successfully!</h4>
            </div>

            {/* File Summary Card */}
            <div className="p-3 rounded-xl bg-workspace-panel border border-workspace-border space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-workspace-border">
                <span className="text-gray-400 font-medium">File Name:</span>
                <span className="text-white font-bold font-mono truncate max-w-[240px]">{fileName}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-workspace-border">
                <span className="text-gray-400 font-medium">Location:</span>
                <span className="text-gray-300 font-mono text-[10px] truncate max-w-[240px]" title={progress.outputFilePath}>
                  {progress.outputFilePath || 'C:\\Exports\\'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-medium">Status:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Ready to Share</span>
                </span>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleOpenFolder}
                className="py-2 px-3 rounded-lg bg-workspace-panel hover:bg-workspace-elevated border border-workspace-border text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-workspace-cyan" />
                <span>Open Folder</span>
              </button>

              <button
                onClick={handlePlayVideo}
                className="py-2 px-3 rounded-lg bg-workspace-panel hover:bg-workspace-elevated border border-workspace-border text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4 text-emerald-400" />
                <span>Play Video</span>
              </button>
            </div>

            {/* Done CTA */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-workspace-cyan text-black font-extrabold text-xs shadow-lg shadow-cyan-950/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Done & Return to Workspace
            </button>
          </div>
        )}

        {/* Failed State */}
        {isFailed && (
          <div className="space-y-3.5 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto shadow-lg shadow-red-950/40">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">Export Failed</h4>
              <p className="text-xs text-red-300 mt-1 max-w-sm mx-auto">
                {progress.error?.toLowerCase().includes('bitrate')
                  ? 'Audio bitrate configuration is unsupported by the selected encoder. Use a supported audio bitrate (e.g. 192 kbps for AAC).'
                  : progress.error?.toLowerCase().includes('write') || progress.error?.toLowerCase().includes('folder') || progress.error?.toLowerCase().includes('permission')
                  ? 'CaptionForge cannot write to the selected destination folder. Please choose another accessible folder.'
                  : progress.error?.toLowerCase().includes('empty')
                  ? 'The project timeline contains no clips or media to render.'
                  : progress.error || 'The rendering pipeline encountered an error during export.'}
              </p>
            </div>

            {/* Collapsible Technical Details */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[11px] text-gray-400 hover:text-gray-200 flex items-center justify-center gap-1 mx-auto cursor-pointer font-medium"
              >
                <span>{showDetails ? 'Hide Details' : 'View Details'}</span>
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showDetails && (
                <div className="mt-2 p-3 rounded-lg bg-black/70 border border-white/10 text-left font-mono text-[10px] text-red-300 max-h-36 overflow-y-auto whitespace-pre-wrap break-all space-y-1">
                  <div className="text-gray-400 font-sans font-semibold text-[11px] pb-1 border-b border-white/10">
                    Diagnostic Trace:
                  </div>
                  <div><strong>Error:</strong> {progress.error || 'Unknown native render error'}</div>
                  {progress.outputFilePath && (
                    <div><strong>Target Path:</strong> {progress.outputFilePath}</div>
                  )}
                  {progress.error?.toLowerCase().includes('bitrate') && (
                    <div className="text-amber-300">
                      <strong>Supported AAC Bitrates:</strong> 96000, 128000, 160000, 192000 bps (96k, 128k, 160k, 192k)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={onRetry || onClose}
                className="py-2 px-3 rounded-lg bg-workspace-panel hover:bg-workspace-elevated border border-workspace-border text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-workspace-cyan" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={onChooseAnotherFolder || onClose}
                className="py-2 px-3 rounded-lg bg-workspace-panel hover:bg-workspace-elevated border border-workspace-border text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Choose Another Folder</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-lg bg-workspace-bg hover:bg-workspace-elevated border border-workspace-border text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
