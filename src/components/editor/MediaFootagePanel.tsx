import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { VideoClip } from '../../types/project';
import { formatTimecode, sanitizeTime } from '../../utils/timecode';
import { mediaProcessingQueue, ProcessingPriority } from '../../services/media/mediaProcessingQueue';
import {
  Upload,
  Film,
  Plus,
  Trash2,
  Music,
  Image as ImageIcon,
  Search,
  Star,
  StarOff,
  LayoutGrid,
  List,
  Clock,
  Type,
  Calendar,
  Filter,
  FolderOpen,
  Check,
  Eye,
  Play,
  FileVideo,
  FileAudio,
  FileImage,
  MoreVertical,
  GripVertical,
  Loader2,
  Sparkles,
} from 'lucide-react';

type GridSize = 'small' | 'medium' | 'large';
type MediaFilter = 'all' | 'video' | 'audio' | 'image' | 'favorites' | 'used' | 'unused';
type SortBy = 'name' | 'date' | 'duration' | 'type';
type ViewMode = 'grid' | 'list';

const GRID_CONFIG: Record<GridSize, { tileW: number; thumbH: number; cols: string }> = {
  small: { tileW: 110, thumbH: 64, cols: 'grid-cols-[repeat(auto-fill,minmax(110px,1fr))]' },
  medium: { tileW: 148, thumbH: 84, cols: 'grid-cols-[repeat(auto-fill,minmax(148px,1fr))]' },
  large: { tileW: 184, thumbH: 104, cols: 'grid-cols-[repeat(auto-fill,minmax(184px,1fr))]' },
};

function getMediaKind(clip: VideoClip, isAudio: boolean): 'video' | 'audio' | 'image' {
  if (isAudio) return 'audio';
  const n = (clip.name || '').toLowerCase();
  if (n.match(/\.(jpg|jpeg|png|webp|gif|bmp|avif|heic|svg)$/)) return 'image';
  return 'video';
}

export const MediaFootagePanel: React.FC = () => {
  const {
    project,
    currentTime,
    importMediaFiles,
    importFootageFile,
    importAudioFile,
    appendClipToTimeline,
    replacePrimaryClip,
    removeFootageAsset,
  } = useProject();

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [gridSize, setGridSize] = useState<GridSize>(() => (localStorage.getItem('cf_media_grid_size') as GridSize) || 'medium');
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('cf_media_view_mode') as ViewMode) || 'grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem('cf_media_favorites'); return new Set(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clip: VideoClip | null; isAudio?: boolean } | null>(null);
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const footageList = project?.footageLibrary || [];
  const audioClips = project?.audioClips || [];
  const timelineFilePaths = useMemo(() => new Set((project?.clips || []).map((c) => c.filePath)), [project?.clips]);

  // Persist prefs
  useEffect(() => { localStorage.setItem('cf_media_grid_size', gridSize); }, [gridSize]);
  useEffect(() => { localStorage.setItem('cf_media_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { try { localStorage.setItem('cf_media_favorites', JSON.stringify([...favorites])); } catch {} }, [favorites]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [search]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const isUsed = useCallback((clip: VideoClip) => timelineFilePaths.has(clip.filePath), [timelineFilePaths]);

  // Unified media items for filtering (footage + standalone audio as synthetic clips)
  const allItems = useMemo(() => {
    const audioAsClips: (VideoClip & { _isAudio: boolean })[] = audioClips.map((a) => ({
      id: a.id,
      name: a.name,
      filePath: a.filePath,
      duration: a.duration,
      width: 0,
      height: 0,
      fps: 0,
      thumbnailUrl: undefined,
      waveformPeaks: a.waveformPeaks,
      mediaBlobUrl: (a as any).mediaBlobUrl,
      startOffset: a.startOffset,
      endOffset: a.endOffset,
      timelineStart: a.timelineStart,
      timelineDuration: a.timelineDuration,
      speed: 1,
      volume: a.volume,
      isMuted: a.isMuted,
      _isAudio: true,
    } as any));
    return [...footageList.map((c) => ({ ...c, _isAudio: false } as any)), ...audioAsClips];
  }, [footageList, audioClips]);

  const filteredSorted = useMemo(() => {
    let out = [...allItems];
    // Search
    if (debouncedSearch) {
      out = out.filter((c: any) => c.name.toLowerCase().includes(debouncedSearch) || (c.filePath || '').toLowerCase().includes(debouncedSearch));
    }
    // Filter
    if (filter !== 'all') {
      out = out.filter((c: any) => {
        const kind = getMediaKind(c, c._isAudio);
        if (filter === 'video') return kind === 'video';
        if (filter === 'audio') return kind === 'audio';
        if (filter === 'image') return kind === 'image';
        if (filter === 'favorites') return favorites.has(c.id);
        if (filter === 'used') return isUsed(c);
        if (filter === 'unused') return !isUsed(c);
        return true;
      });
    }
    // Sort
    out.sort((a: any, b: any) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'duration') return (b.duration || 0) - (a.duration || 0);
      if (sortBy === 'type') return getMediaKind(a, a._isAudio).localeCompare(getMediaKind(b, b._isAudio));
      // date = id timestamp (clip_xxx or footage_xxx) -> fallback to name
      const ta = parseInt((a.id.split('_')[1] || '0'), 10) || 0;
      const tb = parseInt((b.id.split('_')[1] || '0'), 10) || 0;
      return tb - ta;
    });
    return out;
  }, [allItems, debouncedSearch, filter, sortBy, favorites, isUsed]);

  const handleBrowseFiles = async () => {
    if (window.captionForgeAPI?.openFileDialog) {
      const filePath = await window.captionForgeAPI.openFileDialog({
        filters: [{ name: 'Media Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'aac', 'm4a', 'jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      });
      if (filePath) {
        setIsUploading(true);
        await importMediaFiles([filePath]);
        setIsUploading(false);
      }
    } else fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setIsUploading(true);
    await importMediaFiles(files);
    setIsUploading(false);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files);
      setIsUploading(true);
      await importMediaFiles(files);
      setIsUploading(false);
    }
  };

  const onTileClick = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  const onTileDoubleClick = (clip: any) => {
    if (clip._isAudio) return;
    const t = sanitizeTime(currentTime, 0);
    if (!isFinite(t)) return;
    if (!isUsed(clip)) appendClipToTimeline(clip, 1, t);
  };

  const selectedSingle = selectedIds.size === 1 ? filteredSorted.find((c: any) => selectedIds.has(c.id)) : null;

  return (
    <div className="flex flex-col h-full bg-[#0e0e10] text-gray-200 select-none overflow-hidden font-sans" onClick={() => setContextMenu(null)}>
      {/* Compact Header — Import + Search + View + Sort */}
      <div className="h-9 bg-[#121214] border-b border-[#27272a] px-2 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleBrowseFiles}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#27272a] hover:bg-[#2f2f35] border border-[#3f3f46] text-xs font-bold text-white disabled:opacity-50 flex-shrink-0"
          title="Import media (Ctrl+I)"
        >
          <Upload className="w-3.5 h-3.5 text-forge-cyan" />
          <span>{isUploading ? '…' : 'Import'}</span>
        </button>

        <div className="flex-1 relative min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media…"
            className="w-full pl-7 pr-2 py-1 text-xs bg-[#18181c] border border-[#27272a] rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:border-forge-cyan"
          />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Grid size */}
          <div className="hidden sm:flex items-center gap-0.5 bg-[#18181c] border border-[#27272a] rounded-md p-0.5">
            {(['small', 'medium', 'large'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setGridSize(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${gridSize === s ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                title={`Thumbnail size: ${s}`}
              >
                {s[0].toUpperCase()}
              </button>
            ))}
          </div>
          {/* Grid / List */}
          <div className="flex items-center bg-[#18181c] border border-[#27272a] rounded-md p-0.5">
            <button onClick={() => setViewMode('grid')} className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white text-black' : 'text-gray-400'}`} title="Grid view">
              <LayoutGrid className="w-3 h-3" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-white text-black' : 'text-gray-400'}`} title="List view">
              <List className="w-3 h-3" />
            </button>
          </div>
          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="hidden lg:block px-1.5 py-1 text-[11px] bg-[#18181c] border border-[#27272a] rounded-md text-gray-300 focus:outline-none">
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="duration">Duration</option>
            <option value="type">Type</option>
          </select>
        </div>

        <input ref={fileInputRef} type="file" accept="video/*,image/*,audio/*" multiple onChange={handleFileInputChange} className="hidden" />
      </div>

      {/* Filter Tabs — professional bins */}
      <div className="px-2 py-1.5 bg-[#0e0e10] border-b border-[#27272a] flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
        {[
          { id: 'all', label: 'All', icon: FolderOpen, count: allItems.length },
          { id: 'video', label: 'Video', icon: FileVideo, count: allItems.filter((c: any) => getMediaKind(c, c._isAudio) === 'video').length },
          { id: 'audio', label: 'Audio', icon: FileAudio, count: allItems.filter((c: any) => getMediaKind(c, c._isAudio) === 'audio').length },
          { id: 'image', label: 'Image', icon: FileImage, count: allItems.filter((c: any) => getMediaKind(c, c._isAudio) === 'image').length },
          { id: 'favorites', label: 'Favorites', icon: Star, count: favorites.size },
          { id: 'used', label: 'Used', icon: Check, count: allItems.filter((c: any) => isUsed(c)).length },
          { id: 'unused', label: 'Unused', icon: Eye, count: allItems.filter((c: any) => !isUsed(c)).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as MediaFilter)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border ${filter === tab.id ? 'bg-white text-black border-white' : 'bg-[#18181c] text-gray-400 border-[#27272a] hover:text-white hover:border-gray-600'}`}
          >
            <tab.icon className="w-3 h-3" />
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1 rounded-full ${filter === tab.id ? 'bg-black/10' : 'bg-black/40'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Dropzone + Grid/List */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => setSelectedIds(new Set())}
      >
        {isDragOver && (
          <div className="mb-2 p-3 rounded-lg border border-dashed border-forge-cyan bg-cyan-950/20 text-center text-xs font-bold text-forge-cyan pointer-events-none">Drop to import</div>
        )}

        {filteredSorted.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-lg bg-[#18181c] border border-[#27272a] flex items-center justify-center">
              <Film className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-300">{search || filter !== 'all' ? 'No matching media' : 'No media yet'}</p>
              <p className="text-[11px] text-gray-500 mt-1 max-w-[220px]">{search || filter !== 'all' ? 'Try another search or filter.' : 'Import video, audio, or images to start editing.'}</p>
            </div>
            {!search && filter === 'all' && (
              <button onClick={handleBrowseFiles} className="mt-1 px-3 py-1.5 rounded-md bg-white text-black text-xs font-bold hover:bg-gray-100">Import Media</button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={`grid gap-2 ${GRID_CONFIG[gridSize].cols}`}>
            {filteredSorted.map((clip: any) => {
              const kind = getMediaKind(clip, clip._isAudio);
              const isSelected = selectedIds.has(clip.id);
              const isFav = favorites.has(clip.id);
              const used = isUsed(clip);
              const thumbH = GRID_CONFIG[gridSize].thumbH;
              return (
                <div
                  key={clip.id}
                  onClick={(e) => { e.stopPropagation(); onTileClick(clip.id, e); }}
                  onDoubleClick={() => onTileDoubleClick(clip)}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, clip, isAudio: clip._isAudio }); }}
                  draggable
                  onDragStart={(e) => {
                    mediaProcessingQueue.setPriority(clip.mediaId || clip.id, ProcessingPriority.HIGH);
                    const payload = clip._isAudio ? { type: 'audio', clip } : { type: 'footage', clipId: clip.id, clip };
                    e.dataTransfer.setData('application/json', JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'copy';
                    try { (window as any).__cf_draggedMedia = payload; } catch {}
                    if (clip.thumbnailUrl || clip.mediaBlobUrl) {
                      const img = new Image();
                      img.src = clip.thumbnailUrl || clip.mediaBlobUrl;
                      try { e.dataTransfer.setDragImage(img, 24, 24); } catch {}
                    }
                  }}
                  onDragEnd={() => { try { (window as any).__cf_draggedMedia = null; } catch {} }}
                  onMouseEnter={() => {
                    mediaProcessingQueue.setPriority(clip.mediaId || clip.id, ProcessingPriority.HIGH);
                    setHoverPreview(clip.id);
                  }}
                  onMouseLeave={() => setHoverPreview(null)}
                  className={`group relative rounded-md border bg-[#121214] overflow-hidden cursor-grab active:cursor-grabbing hover:border-gray-600 transition-all ${isSelected ? 'border-white ring-1 ring-white shadow-lg' : 'border-[#27272a]'}`}
                  title={`${clip.name}\n${clip.width ? `${clip.width}x${clip.height} • ${clip.fps}fps` : ''}\n${formatTimecode(clip.duration, false)} — Drag to timeline`}
                >
                  {/* Thumbnail / Progressive State */}
                  <div className="relative bg-black overflow-hidden flex items-center justify-center" style={{ height: thumbH }}>
                    {kind === 'video' && clip.thumbnailUrl ? (
                      <img src={clip.thumbnailUrl} alt={clip.name} loading="lazy" className="w-full h-full object-cover animate-in fade-in duration-200" draggable={false} />
                    ) : kind === 'image' && (clip.thumbnailUrl || clip.mediaBlobUrl) ? (
                      <img src={clip.thumbnailUrl || clip.mediaBlobUrl} alt={clip.name} loading="lazy" className="w-full h-full object-cover animate-in fade-in duration-200" draggable={false} />
                    ) : kind === 'audio' ? (
                      <div className="w-full h-full flex items-end gap-[1px] px-1 pb-1 bg-[#0e0e10]">
                        {(clip.waveformPeaks || []).slice(0, 32).map((p: number, i: number) => (
                          <div key={i} style={{ height: `${Math.max(8, p * 100)}%` }} className="flex-1 max-w-[3px] bg-forge-cyan/80 rounded-t-[1px]" />
                        ))}
                        <Music className="absolute top-1.5 left-1.5 w-3 h-3 text-forge-cyan/70" />
                      </div>
                    ) : (
                      /* Instant Shimmer Placeholder while background processing */
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#141417] text-gray-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
                        {kind === 'video' ? (
                          <FileVideo className="w-6 h-6 text-gray-500 animate-pulse" />
                        ) : (kind as string) === 'audio' ? (
                          <FileAudio className="w-6 h-6 text-gray-500 animate-pulse" />
                        ) : (
                          <FileImage className="w-6 h-6 text-gray-500 animate-pulse" />
                        )}
                        <span className="text-[9px] font-mono text-gray-400">Loading…</span>
                      </div>
                    )}

                    {/* Top bar: type + resolution badge + favorite */}
                    <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 ${(kind as string) === 'video' ? 'bg-black/70 text-white' : (kind as string) === 'audio' ? 'bg-cyan-950/80 text-cyan-300' : 'bg-violet-950/80 text-violet-300'}`}>
                          {(kind as string) === 'video' ? <Film className="w-2.5 h-2.5" /> : (kind as string) === 'audio' ? <Music className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
                          <span className="hidden sm:inline uppercase">{kind}</span>
                        </span>
                        {clip.width && clip.width >= 3840 ? (
                          <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-500/80 text-black">4K</span>
                        ) : clip.width && clip.width >= 1920 ? (
                          <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-blue-500/80 text-white">HD</span>
                        ) : null}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(clip.id); }}
                        className={`p-1 rounded-full backdrop-blur ${isFav ? 'bg-amber-500 text-black' : 'bg-black/60 text-gray-400 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
                        title={isFav ? 'Remove favorite' : 'Favorite'}
                      >
                        <Star className={`w-3 h-3 ${isFav ? 'fill-black' : ''}`} />
                      </button>
                    </div>

                    {/* Duration */}
                    {(kind as string) !== 'image' && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] leading-none">
                        {formatTimecode(clip.duration, false)}
                      </span>
                    )}
                    {/* Used dot */}
                    {used && <span className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-emerald-500 border border-black shadow" title="Used in timeline" />}
                    {/* Hover + button (Instant Add to Timeline at Playhead) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          appendClipToTimeline(clip, 1, currentTime);
                        }}
                        className="w-7 h-7 rounded-full bg-forge-cyan text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform font-bold"
                        title="Add to timeline at playhead (+)"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>
                  </div>

                  {/* Filename + meta */}
                  <div className="px-1.5 py-1 bg-[#121214]">
                    <p className="text-[11px] font-medium text-gray-200 truncate leading-tight" title={clip.name}>{clip.name}</p>
                    <p className="text-[10px] font-mono text-gray-500 truncate">
                      {clip.width ? `${clip.width}×${clip.height}` : kind === 'audio' ? 'Audio' : '—'} {clip.duration ? `• ${formatTimecode(clip.duration, false)}` : ''}
                    </p>
                  </div>

                  {/* Hover preview scrub (lightweight) */}
                  {hoverPreview === clip.id && kind === 'video' && (
                    <div className="absolute inset-x-0 bottom-[28px] h-0.5 bg-forge-cyan/0 group-hover:bg-forge-cyan/60 transition-colors" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // List view
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_70px_80px_36px] gap-2 px-2 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <span>Name</span><span>Duration</span><span>Info</span><span></span>
            </div>
            {filteredSorted.map((clip: any) => {
              const kind = getMediaKind(clip, clip._isAudio);
              const isSelected = selectedIds.has(clip.id);
              return (
                <div
                  key={clip.id}
                  onClick={(e) => onTileClick(clip.id, e)}
                  onDoubleClick={() => onTileDoubleClick(clip)}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, clip, isAudio: clip._isAudio }); }}
                  draggable
                  onDragStart={(e) => {
                    const payload = clip._isAudio ? { type: 'audio', clip } : { type: 'footage', clipId: clip.id, clip };
                    e.dataTransfer.setData('application/json', JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'copy';
                    try { (window as any).__cf_draggedMedia = payload; } catch {}
                  }}
                  onDragEnd={() => { try { (window as any).__cf_draggedMedia = null; } catch {} }}
                  className={`grid grid-cols-[1fr_70px_80px_36px] gap-2 items-center px-2 py-1.5 rounded-md border text-xs cursor-grab ${isSelected ? 'bg-white text-black border-white' : 'bg-[#121214] border-[#27272a] text-gray-300 hover:bg-[#1a1a1e]'}`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {kind === 'video' ? <FileVideo className="w-3.5 h-3.5" /> : kind === 'audio' ? <FileAudio className="w-3.5 h-3.5" /> : <FileImage className="w-3.5 h-3.5" />}
                    <span className="truncate">{clip.name}</span>
                    {favorites.has(clip.id) && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  </span>
                  <span className="font-mono text-[11px]">{formatTimecode(clip.duration, false)}</span>
                  <span className="text-[11px] text-gray-500 truncate">{clip.width ? `${clip.width}×${clip.height}` : kind}</span>
                  <span className="flex justify-end gap-1">
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(clip.id); }} className="p-1 hover:text-amber-400"><Star className={`w-3 h-3 ${favorites.has(clip.id) ? 'fill-amber-500 text-amber-500' : ''}`} /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeFootageAsset(clip.id); }} className="p-1 hover:text-red-400" title="Remove"><Trash2 className="w-3 h-3" /></button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Details panel for single selection */}
        {selectedSingle && (
          <div className="mt-3 p-2 rounded-lg bg-[#121214] border border-[#27272a] text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-white truncate">{(selectedSingle as any).name}</span>
              <span className="text-[10px] font-mono text-gray-500">{formatTimecode((selectedSingle as any).duration, false)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-400 font-mono">
              {(selectedSingle as any).width ? <span>Res: {(selectedSingle as any).width}×{(selectedSingle as any).height}</span> : <span>Type: {getMediaKind(selectedSingle as any, (selectedSingle as any)._isAudio)}</span>}
              <span>FPS: {(selectedSingle as any).fps || '—'}</span>
              <span className="col-span-2 truncate">Path: {(selectedSingle as any).filePath}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button onClick={() => appendClipToTimeline(selectedSingle as any, 1)} className="px-2 py-1 rounded bg-white text-black text-xs font-bold">+ V1 Timeline</button>
              <button onClick={() => appendClipToTimeline(selectedSingle as any, 2)} className="px-2 py-1 rounded bg-[#27272a] border border-[#3f3f46] text-xs font-bold text-amber-300">+ V2 Overlay</button>
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 220) }}
          className="fixed z-50 w-44 bg-[#18181c] border border-[#27272a] rounded-lg shadow-2xl py-1 text-xs"
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={() => { if (contextMenu.clip) appendClipToTimeline(contextMenu.clip, 1); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-white hover:text-black flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Add to Timeline
          </button>
          <button
            onClick={() => { if (contextMenu.clip) onTileDoubleClick(contextMenu.clip); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-white hover:text-black flex items-center gap-2"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <button
            onClick={() => { if (contextMenu?.clip) toggleFavorite(contextMenu.clip.id); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-white hover:text-black flex items-center gap-2"
          >
            {contextMenu?.clip && favorites.has(contextMenu.clip.id) ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
            {contextMenu?.clip && favorites.has(contextMenu.clip.id) ? 'Unfavorite' : 'Favorite'}
          </button>
          <button
            onClick={() => { if (contextMenu?.clip && !contextMenu.isAudio) replacePrimaryClip(contextMenu.clip!); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-white hover:text-black flex items-center gap-2"
          >
            <Film className="w-3.5 h-3.5" /> Replace Primary
          </button>
          <div className="my-1 border-t border-[#27272a]" />
          <button
            onClick={() => { if (contextMenu.clip) removeFootageAsset(contextMenu.clip.id); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      )}
    </div>
  );
};
