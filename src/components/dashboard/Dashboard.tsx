import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { NewProjectModal } from './NewProjectModal';
import { ProjectMetadata, AspectRatio } from '../../types/project';
import { formatTimecode } from '../../utils/timecode';
import { listAllProjects } from '../../services/storage/projectStorage';
import {
  Plus,
  Film,
  Smartphone,
  Monitor,
  Square,
  Clock,
  Trash2,
  Key,
  FolderOpen,
  Upload,
  Search,
  Settings,
  Play,
  Copy,
  Edit3,
  MoreVertical,
  Calendar,
  Folder,
  AlertTriangle,
  Layers,
} from 'lucide-react';

interface DashboardProps {
  onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenSettings }) => {
  const { createNewProject, loadProject, renameProject, duplicateProject, deleteProject } = useProject();
  const { settings } = useSettings();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<ProjectMetadata[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; proj: ProjectMetadata } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<ProjectMetadata | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  const fetchRecentProjects = async () => {
    try {
      const list = await listAllProjects();
      setRecentProjects(list || []);
    } catch (e) {
      console.warn('Could not fetch recent projects:', e);
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const name = projectToDelete.name;
    try {
      await deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      await fetchRecentProjects();
      showToast(`Project "${name}" and local media backups deleted.`);
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, proj: ProjectMetadata) => {
    e.stopPropagation();
    try {
      const newId = await duplicateProject(proj.id);
      if (newId) {
        await fetchRecentProjects();
        showToast(`Duplicated "${proj.name}".`);
      }
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  const handleRename = async (proj: ProjectMetadata) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    await renameProject(proj.id, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
    await fetchRecentProjects();
  };

  const handleOpenExistingFile = async () => {
    if (window.captionForgeAPI?.openFileDialog) {
      const filePath = await window.captionForgeAPI.openFileDialog({
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a'] },
        ],
      });
      if (filePath) {
        const fileName = filePath.split(/[\/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'My Video Project';
        createNewProject(fileName, undefined, filePath);
      }
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const fileName = file.name.replace(/\.[^/.]+$/, '') || 'My Video Project';
      await createNewProject(fileName, undefined, file);
      e.target.value = '';
    }
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };
  const handleGlobalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const fileName = file.name.replace(/\.[^/.]+$/, '') || 'My Video Project';
      await createNewProject(fileName, undefined, file);
    }
  };

  const filteredAndSorted = useMemo(() => {
    let out = [...recentProjects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      out = out.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.aspectRatio || '').toLowerCase().includes(q));
    }
    out.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (sortBy === 'created') return (isNaN(bCreated) ? 0 : bCreated) - (isNaN(aCreated) ? 0 : aCreated);
      const aUpdated = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bUpdated = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return (isNaN(bUpdated) ? 0 : bUpdated) - (isNaN(aUpdated) ? 0 : aUpdated);
    });
    return out;
  }, [recentProjects, searchQuery, sortBy]);

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return 'Recently';
    const diffSec = Math.floor((Date.now() - time) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden select-none"
      onClick={() => setContextMenu(null)}
    >
      {/* Header — Logo / Search / Settings */}
      <header className="h-12 bg-[#0e0e12] border-b border-[#1e1e24] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-white text-black flex items-center justify-center font-black text-[11px] shadow-sm">
            CF
          </div>
          <span className="font-bold text-sm text-white tracking-tight">CaptionForge</span>
          <span className="hidden sm:inline text-[10px] font-mono text-forge-cyan border border-forge-cyan/30 px-1.5 py-0.5 rounded">
            PRO
          </span>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden md:flex">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by name or aspect ratio…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#18181c] border border-[#27272a] rounded-full text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-full bg-[#27272a] border border-[#3f3f46] flex items-center justify-center text-[11px] font-bold text-white">
            A
          </div>
        </div>
      </header>

      {/* Mobile search */}
      <div className="md:hidden px-4 py-2 bg-[#0e0e12] border-b border-[#1e1e24]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#18181c] border border-[#27272a] rounded-full text-gray-200 placeholder-gray-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 space-y-8">
          {/* API Key Banner — minimal */}
          {!settings.geminiApiKey && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#121214] border border-amber-500/20 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-300">Add Gemini API key for automated AI caption transcription</span>
              </div>
              <button
                onClick={onOpenSettings}
                className="text-xs font-bold text-amber-400 hover:underline px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20"
              >
                Add Key
              </button>
            </div>
          )}

          {/* Top Hero Area — Standard Clean Entry Points */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Home</h1>
              <p className="text-xs text-gray-400 mt-1">Create a project or continue where you left off.</p>
            </div>

            {/* Quick action hero buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="p-4 rounded-xl bg-white text-black font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-gray-100 active:scale-[0.98] transition-all shadow-md group"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                <span>New Project</span>
              </button>

              <button
                onClick={handleOpenExistingFile}
                className="p-4 rounded-xl bg-[#151519] border border-[#27272a] text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-[#1e1e24] hover:border-white/20 active:scale-[0.98] transition-all shadow-sm"
              >
                <FolderOpen className="w-5 h-5 text-gray-400" />
                <span>Open Project</span>
              </button>

              <button
                onClick={handleOpenExistingFile}
                className="p-4 rounded-xl bg-[#151519] border border-dashed border-[#3f3f46] text-gray-300 font-medium text-sm flex items-center justify-center gap-2.5 hover:border-forge-cyan hover:text-forge-cyan active:scale-[0.98] transition-all"
              >
                <Upload className="w-5 h-5" />
                <span>Import Video File</span>
              </button>
            </div>
          </div>

          {/* Aspect Quick Starters */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Start from Aspect Ratio</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: '16:9 Widescreen', ratio: '16:9' as AspectRatio, desc: 'YouTube, Landscape', icon: Monitor },
                { title: '9:16 Vertical', ratio: '9:16' as AspectRatio, desc: 'TikTok, Reels, Shorts', icon: Smartphone },
                { title: '1:1 Square', ratio: '1:1' as AspectRatio, desc: 'Instagram, Feed', icon: Square },
                { title: '4:5 Portrait', ratio: '4:5' as AspectRatio, desc: 'Social, Mobile Ads', icon: Film },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={() => createNewProject(item.title, item.ratio)}
                  className="p-3.5 rounded-xl bg-[#121214] border border-[#1e1e24] hover:border-white/20 hover:bg-[#1a1a1e] text-left transition-all group shadow-sm"
                >
                  <item.icon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  <div className="text-xs font-bold text-white mt-2.5">{item.title}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Single Unified "RECENT PROJECTS" Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#1e1e24]">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-forge-cyan" />
                <span>Recent Projects</span>
                <span className="text-xs font-normal text-gray-500 font-mono">({filteredAndSorted.length})</span>
              </h2>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1 text-xs bg-[#121214] border border-[#27272a] rounded-full text-gray-300 focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="updated">Last edited</option>
                  <option value="created">Date created</option>
                  <option value="name">Project title</option>
                </select>
              </div>
            </div>

            {filteredAndSorted.length === 0 ? (
              <div className="py-16 rounded-2xl bg-[#121214] border border-[#1e1e24] flex flex-col items-center justify-center text-center">
                <Folder className="w-10 h-10 text-gray-600 mb-2" />
                <p className="text-sm font-bold text-white">{searchQuery ? 'No matching projects found' : 'No projects yet'}</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  {searchQuery ? 'Try a different search query.' : 'Create a new project or import a video to start editing.'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsNewModalOpen(true)}
                    className="mt-4 px-4 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-gray-100 transition-colors"
                  >
                    Create Project
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredAndSorted.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => loadProject(proj.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, proj });
                    }}
                    className="group relative p-3 rounded-2xl bg-[#121214] border border-[#1e1e24] hover:border-white/30 hover:bg-[#18181c] cursor-pointer transition-all flex flex-col shadow-sm"
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-32 rounded-xl bg-black overflow-hidden relative flex items-center justify-center border border-white/5">
                      {proj.thumbnailPath ? (
                        <img
                          src={proj.thumbnailPath}
                          alt={proj.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e24] to-black">
                          <Film className="w-8 h-8 text-white/20" />
                        </div>
                      )}

                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-black ml-0.5" />
                        </div>
                      </div>

                      {/* Duration badge */}
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-white font-mono text-[10px] leading-none">
                        {formatTimecode(proj.duration || 0, false)}
                      </span>

                      {/* Aspect Ratio badge */}
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold leading-none">
                        {proj.aspectRatio || '16:9'}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="mt-3 flex items-start justify-between gap-2 flex-1">
                      <div className="flex-1 min-w-0">
                        {renamingId === proj.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRename(proj)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(proj);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-1.5 py-0.5 text-xs bg-black border border-forge-cyan rounded text-white focus:outline-none"
                          />
                        ) : (
                          <div className="text-xs font-bold text-white truncate pr-1" title={proj.name}>
                            {proj.name}
                          </div>
                        )}

                        <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3 text-gray-600" />
                          <span>{formatRelativeTime(proj.updatedAt || proj.createdAt)}</span>
                        </div>
                      </div>

                      {/* 3-dots Context button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu({ x: e.clientX, y: e.clientY, proj });
                        }}
                        className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white opacity-80 group-hover:opacity-100 transition-opacity"
                        title="Project options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Card Actions bar */}
                    <div className="mt-3 pt-2.5 border-t border-[#1e1e24] flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadProject(proj.id);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-gray-100 active:scale-[0.98] transition-all"
                      >
                        Open
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(proj.id);
                          setRenameValue(proj.name);
                        }}
                        className="p-1.5 rounded-lg bg-[#18181c] border border-[#27272a] text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                        title="Rename"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDuplicate(e, proj)}
                        className="p-1.5 rounded-lg bg-[#18181c] border border-[#27272a] text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(proj);
                        }}
                        className="p-1.5 rounded-lg bg-[#18181c] border border-[#27272a] text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Context Menu Dropdown */}
          {contextMenu && (
            <div
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 170),
                top: Math.min(contextMenu.y, window.innerHeight - 190),
              }}
              className="fixed z-50 w-44 bg-[#18181c] border border-[#27272a] rounded-xl shadow-2xl py-1.5 text-xs select-none backdrop-blur-md"
              onClick={() => setContextMenu(null)}
            >
              <button
                onClick={() => {
                  loadProject(contextMenu.proj.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-white hover:text-black flex items-center gap-2.5 transition-colors font-medium"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Open Project
              </button>

              <button
                onClick={() => {
                  setRenamingId(contextMenu.proj.id);
                  setRenameValue(contextMenu.proj.name);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-white hover:text-black flex items-center gap-2.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Rename
              </button>

              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleDuplicate(e as any, contextMenu.proj);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-white hover:text-black flex items-center gap-2.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>

              <div className="h-[1px] bg-[#27272a] my-1" />

              <button
                onClick={() => {
                  setProjectToDelete(contextMenu.proj);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-red-600 hover:text-white text-red-400 flex items-center gap-2.5 transition-colors font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151519] border border-[#27272a] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete Project?</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                This will permanently delete <span className="text-white font-semibold">"{projectToDelete.name}"</span> along with all its saved edits and internal offline footage backups.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1e1e24] border border-[#27272a] text-xs font-semibold text-gray-300 hover:bg-[#27272a] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#18181c] border border-white/20 text-white text-xs font-medium shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Drag overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none">
          <div className="p-8 rounded-2xl border-2 border-dashed border-white bg-[#121214] max-w-md w-full flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-white animate-bounce" />
            <h2 className="text-sm font-bold text-white">Drop video file to create project</h2>
            <p className="text-xs text-gray-400">Aspect ratio and resolution will be automatically detected</p>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={handleFileInputChange} />

      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={(name, ratio, filePath) => createNewProject(name, ratio, filePath)}
      />
    </div>
  );
};
