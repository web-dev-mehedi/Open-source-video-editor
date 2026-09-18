import React, { useState, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { VideoClip } from '../../types/project';
import { formatTimecode } from '../../utils/timecode';
import { mediaProcessingQueue, ProcessingPriority } from '../../services/media/mediaProcessingQueue';
import {
  Upload,
  Film,
  Plus,
  Trash2,
  Music,
  Image as ImageIcon,
  Search,
  Check,
  Play,
  FileVideo,
  FileAudio,
  FileImage,
  GripVertical,
} from 'lucide-react';

export const MediaPool: React.FC = () => {
  const {
    project,
    currentTime,
    importMediaFiles,
    appendClipToTimeline,
    removeFootageAsset,
  } = useProject();

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const footageList = project?.footageLibrary || [];

  const handleBrowseFiles = () => {
    if (window.captionForgeAPI?.openFileDialog) {
      window.captionForgeAPI
        .openFileDialog({
          filters: [
            {
              name: 'Media Files',
              extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'aac', 'm4a', 'jpg', 'jpeg', 'png', 'webp', 'gif'],
            },
          ],
        })
        .then(async (filePath) => {
          if (filePath) {
            setIsUploading(true);
            await importMediaFiles([filePath]);
            setIsUploading(false);
          }
        });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,audio/*,image/*';
    input.multiple = true;
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const files = Array.from(input.files);
        setIsUploading(true);
        await importMediaFiles(files);
        setIsUploading(false);
      }
    };
    input.click();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setIsUploading(true);
      await importMediaFiles(files);
      setIsUploading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return footageList;
    const s = search.trim().toLowerCase();
    return footageList.filter((f) => f.name.toLowerCase().includes(s));
  }, [footageList, search]);

  const getResolutionBadge = (clip: VideoClip) => {
    const isImage = (clip as any).mediaType === 'image' || (clip.name || '').match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i);
    if (isImage) return 'IMG';
    if (!clip.width || !clip.height) return 'HD';
    if (clip.width >= 3840 || clip.height >= 2160) return '4K';
    if (clip.width >= 1920 || clip.height >= 1080) return '1080P';
    if (clip.width >= 1280 || clip.height >= 720) return '720P';
    return 'HD';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col h-full bg-neutral-950 text-gray-200 select-none overflow-hidden font-sans border-r border-neutral-800 ${
        isDragOver ? 'ring-2 ring-forge-cyan bg-neutral-900/80' : ''
      }`}
    >
      {/* Header Bar */}
      <div className="h-10 border-b border-neutral-800 px-3 flex items-center justify-between gap-2 flex-shrink-0 bg-neutral-900">
        <button
          onClick={handleBrowseFiles}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-forge-cyan text-black font-bold text-xs hover:bg-cyan-400 transition-colors shadow-xs disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{isUploading ? 'Importing…' : 'Import'}</span>
        </button>

        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media library…"
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-forge-cyan"
          />
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredItems.length === 0 ? (
          <div
            onClick={handleBrowseFiles}
            className="h-48 border-2 border-dashed border-neutral-800 hover:border-neutral-700 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors p-4 text-center group"
          >
            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Film className="w-5 h-5 text-gray-500 group-hover:text-forge-cyan" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-300">No media in library</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Drop videos, images, or audio here to import instantly
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredItems.map((clip) => {
              const resBadge = getResolutionBadge(clip);
              const isSelected = selectedId === clip.id;

              return (
                <div
                  key={clip.id}
                  onClick={() => setSelectedId(clip.id)}
                  draggable
                  onDragStart={(e) => {
                    mediaProcessingQueue.setPriority(clip.mediaId || clip.id, ProcessingPriority.HIGH);
                    const payload = { type: 'footage', clipId: clip.id, clip };
                    e.dataTransfer.setData('application/json', JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onMouseEnter={() => {
                    mediaProcessingQueue.setPriority(clip.mediaId || clip.id, ProcessingPriority.HIGH);
                  }}
                  className={`group relative rounded-lg border bg-neutral-900 overflow-hidden cursor-grab active:cursor-grabbing hover:border-neutral-600 transition-all ${
                    isSelected ? 'border-forge-cyan ring-1 ring-forge-cyan' : 'border-neutral-800'
                  }`}
                  title={`${clip.name}\nDuration: ${formatTimecode(clip.duration, false)}\nDrag onto timeline or click +`}
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                    {clip.thumbnailUrl || clip.mediaBlobUrl ? (
                      <img
                        src={clip.thumbnailUrl || clip.mediaBlobUrl}
                        alt={clip.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 animate-in fade-in duration-150"
                        draggable={false}
                      />
                    ) : (
                      /* Instant Shimmer Placeholder */
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-neutral-900 text-neutral-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
                        <Film className="w-6 h-6 text-neutral-600 animate-pulse" />
                        <span className="text-[9px] font-mono text-neutral-500">Loading…</span>
                      </div>
                    )}

                    {/* Top-Left Type / Resolution Badge */}
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-white uppercase tracking-wider backdrop-blur-xs">
                      {resBadge}
                    </span>

                    {/* Bottom-Right Duration Badge */}
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] font-semibold leading-none backdrop-blur-xs">
                      {formatTimecode(clip.duration, false)}
                    </span>

                    {/* Hover + Button (Instant Add to Timeline at Playhead) */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          appendClipToTimeline(clip, 1, currentTime);
                        }}
                        className="w-8 h-8 rounded-full bg-forge-cyan text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform font-bold"
                        title="Add to timeline at playhead (+)"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                      </button>
                    </div>
                  </div>

                  {/* Filename Footer */}
                  <div className="p-2 bg-neutral-900/90">
                    <p className="text-[11px] font-semibold text-gray-200 truncate leading-tight" title={clip.name}>
                      {clip.name}
                    </p>
                    <p className="text-[10px] font-mono text-gray-500 truncate mt-0.5">
                      {clip.width ? `${clip.width}×${clip.height}` : 'Video'} • {clip.duration ? formatTimecode(clip.duration, false) : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
