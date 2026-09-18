import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AspectRatio } from '../../types/project';
import { Smartphone, Monitor, Square, Film, Upload, Sparkles } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, aspectRatio: AspectRatio, filePath?: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState<string>('My Viral Short');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');

  const handleBrowseFile = async () => {
    if (window.captionForgeAPI?.openFileDialog) {
      const path = await window.captionForgeAPI.openFileDialog({
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a'] },
        ],
      });
      if (path) {
        setSelectedFilePath(path);
        const fileName = path.split(/[\/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'My Video Project';
        setName(fileName);
      }
    } else {
      setSelectedFilePath('sample_video.mp4');
    }
  };

  const handleCreate = () => {
    onCreate(name || 'Untitled Video Project', aspectRatio, selectedFilePath || undefined);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      subtitle="Select aspect ratio and import your video to start adding AI captions"
      maxWidth="md"
    >
      <div className="space-y-4 select-none">
        {/* Project Name */}
        <div>
          <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
            Project Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-canvas-card border border-canvas-border rounded-xl text-gray-200 focus:outline-none focus:border-forge-purple"
            placeholder="My YouTube Video — leave empty for Untitled Project 01"
          />
          <p className="text-[11px] text-gray-500 mt-1">If name exists, it will be saved as “{name.trim() || 'Untitled Project'} 02” to avoid overwriting.</p>
        </div>

        {/* Aspect Ratio Cards */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
            Target Platform & Aspect Ratio
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                id: '9:16',
                label: '9:16 Vertical',
                sub: 'TikTok, Reels, Shorts',
                icon: <Smartphone className="w-4 h-4 text-forge-purple" />,
              },
              {
                id: '16:9',
                label: '16:9 Landscape',
                sub: 'YouTube, Web',
                icon: <Monitor className="w-4 h-4 text-forge-cyan" />,
              },
              {
                id: '1:1',
                label: '1:1 Square',
                sub: 'Instagram, Feed',
                icon: <Square className="w-4 h-4 text-forge-amber" />,
              },
              {
                id: '4:5',
                label: '4:5 Portrait',
                sub: 'Instagram, Facebook',
                icon: <Film className="w-4 h-4 text-forge-pink" />,
              },
            ].map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setAspectRatio(ratio.id as AspectRatio)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  aspectRatio === ratio.id
                    ? 'border-forge-purple bg-purple-950/30 ring-1 ring-forge-purple text-white'
                    : 'border-canvas-border bg-canvas-card/60 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="p-2 rounded-lg bg-canvas-card border border-canvas-border">
                  {ratio.icon}
                </div>
                <div>
                  <span className="text-xs font-bold block">{ratio.label}</span>
                  <span className="text-[10px] text-gray-500">{ratio.sub}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Media Import Selector */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
            Source Video File (Optional)
          </label>
          <div
            onClick={handleBrowseFile}
            className="border-2 border-dashed border-canvas-border hover:border-forge-purple/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-canvas-card/30 hover:bg-canvas-card/60"
          >
            {selectedFilePath ? (
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-forge-cyan truncate">
                <Film className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{selectedFilePath}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-6 h-6 mx-auto text-gray-500" />
                <p className="text-xs text-gray-300 font-medium">
                  Click to select video or audio file
                </p>
                <p className="text-[10px] text-gray-500">
                  Supports MP4, MOV, WebM, MKV, MP3, WAV
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-canvas-border">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            size="md"
            leftIcon={<Sparkles className="w-4 h-4" />}
            onClick={handleCreate}
          >
            Create Project
          </Button>
        </div>
      </div>
    </Modal>
  );
};
