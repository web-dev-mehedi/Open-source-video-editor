import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { AlertTriangle, FileQuestion, FolderOpen, Upload, X, CheckCircle, RefreshCw } from 'lucide-react';

interface RelinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RelinkModal: React.FC<RelinkModalProps> = ({ isOpen, onClose }) => {
  const { project, relinkMedia, batchRelinkFolder } = useProject();
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [relinkedCount, setRelinkedCount] = useState<number | null>(null);

  if (!isOpen || !project) return null;

  const missingMedia: string[] = (project as any).missingMedia || [];
  const mediaRegistry = (project as any).mediaRegistry || [];

  const handlePickFile = (missingPath: string) => {
    const api: any = (window as any).captionForgeAPI;
    if (api?.openFileDialog) {
      api
        .openFileDialog({
          title: `Relink ${missingPath.split(/[\/\\]/).pop()}`,
          filters: [
            {
              name: 'Media Files',
              extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'jpg', 'jpeg', 'png', 'webp'],
            },
          ],
        })
        .then((newPath: string | null) => {
          if (newPath) {
            relinkMedia(missingPath, newPath);
          }
        });
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*,audio/*,image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          await relinkMedia(missingPath, file);
        }
      };
      input.click();
    }
  };

  const handleBatchFolder = async () => {
    const api: any = (window as any).captionForgeAPI;
    if (!api?.selectFolderDialog) {
      alert('Folder auto-scan requires the desktop app. Please relink files individually.');
      return;
    }

    try {
      setIsBatchProcessing(true);
      const folder = await api.selectFolderDialog({ title: 'Select folder containing missing media files' });
      if (folder) {
        const count = await batchRelinkFolder(folder);
        setRelinkedCount(count);
        setTimeout(() => setRelinkedCount(null), 3000);
      }
    } catch (err) {
      console.error('Batch relink failed:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none font-sans">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#131316]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100">Relink Missing Media</h2>
              <p className="text-[11px] text-gray-400">
                {missingMedia.length === 0
                  ? 'All media files are connected'
                  : `${missingMedia.length} media file(s) need relinking`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 max-h-[60vh] overflow-y-auto space-y-3">
          {relinkedCount !== null && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Successfully relinked {relinkedCount} file(s)!</span>
            </div>
          )}

          {missingMedia.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-bold text-gray-200">All media assets are ready</p>
              <p className="text-xs text-gray-400">No missing or offline files detected in this project.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {missingMedia.map((path, idx) => {
                const fileName = path.split(/[\/\\]/).pop() || path;
                const asset = mediaRegistry.find((a: any) => a.filePath === path || a.fileName === fileName);

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#202024] border border-[#2e2e34] flex items-center justify-between gap-3 hover:border-[#3f3f46] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <FileQuestion className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-gray-200 truncate">{fileName}</div>
                        <div className="text-[10px] text-gray-500 font-mono truncate">{path}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handlePickFile(path)}
                      className="px-3 py-1.5 rounded-lg bg-forge-cyan hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-md flex-shrink-0 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Locate File</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#27272a] bg-[#131316] flex items-center justify-between">
          <div>
            {(window as any).captionForgeAPI?.selectFolderDialog && (
              <button
                onClick={handleBatchFolder}
                disabled={isBatchProcessing || missingMedia.length === 0}
                className="px-3 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#333338] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>{isBatchProcessing ? 'Scanning Folder...' : 'Auto-Relink Folder'}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
          >
            {missingMedia.length === 0 ? 'Done' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
};
