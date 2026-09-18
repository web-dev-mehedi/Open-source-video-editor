import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Keyboard, Play, Scissors, Layers, Command, Move } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const sections = [
    {
      title: 'Playback & Scrubber',
      icon: <Play className="w-3.5 h-3.5 text-forge-cyan" />,
      items: [
        { key: 'Space / K', desc: 'Play / Pause video preview' },
        { key: '← / →', desc: 'Step backward / forward 0.1s' },
        { key: 'Shift + ← / →', desc: 'Step backward / forward 1.0s' },
        { key: 'J / L', desc: 'Shuttle rewind / fast-forward 1.0s' },
        { key: 'Home / End', desc: 'Jump to beginning / end of timeline' },
      ],
    },
    {
      title: 'Editing & Timeline',
      icon: <Scissors className="w-3.5 h-3.5 text-forge-purple" />,
      items: [
        { key: 'S', desc: 'Split / Slice video clip at playhead' },
        { key: 'Delete / Backspace', desc: 'Delete selected clip, caption, or overlay' },
        { key: 'Ctrl + Z', desc: 'Undo last action' },
        { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo last action' },
        { key: 'Ctrl + S', desc: 'Save project' },
        { key: 'Ctrl + E', desc: 'Open Export Dialog' },
      ],
    },
    {
      title: 'On-Canvas Drag & Positioning',
      icon: <Move className="w-3.5 h-3.5 text-yellow-400" />,
      items: [
        { key: 'Click & Drag', desc: 'Drag caption box directly on screen' },
        { key: 'Center Snapping', desc: 'Snaps automatically to X: 50% centerline' },
        { key: 'Apply to All', desc: 'Applies current position to all captions' },
      ],
    },
    {
      title: 'Quick Navigation',
      icon: <Layers className="w-3.5 h-3.5 text-emerald-400" />,
      items: [
        { key: 'C', desc: 'Switch to Captions Tab' },
        { key: 'T', desc: 'Switch to Templates Tab' },
        { key: '? / F1', desc: 'Toggle Shortcuts Help' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts & Gestures"
      subtitle="Supercharge your video editing speed with hotkeys"
      maxWidth="lg"
    >
      <div className="space-y-4 select-none max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((sec) => (
            <div key={sec.title} className="p-3 rounded-xl bg-canvas-card/60 border border-canvas-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-200 border-b border-canvas-border/60 pb-1.5">
                {sec.icon}
                <span>{sec.title}</span>
              </div>
              <div className="space-y-1.5">
                {sec.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">{item.desc}</span>
                    <kbd className="px-1.5 py-0.5 bg-canvas-dark border border-canvas-border rounded text-forge-cyan font-mono font-bold shadow-sm whitespace-nowrap">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-canvas-border">
          <Button variant="secondary" size="md" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
};
