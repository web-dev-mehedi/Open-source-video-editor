import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Keyboard, Save, RotateCcw } from 'lucide-react';

const DEFAULT_SHORTCUTS: Record<string, string> = {
  'Split': 'S',
  'Magnet': 'N',
  'Undo': 'Ctrl+Z',
  'Redo': 'Ctrl+Y',
  'Play/Pause': 'Space',
  'Command Palette': 'Ctrl+K',
  'Add Marker': 'M',
  'Freeze Frame': 'F',
};

export const CustomShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(() => {
    try { const raw = localStorage.getItem('cf_custom_shortcuts'); return raw ? JSON.parse(raw) : DEFAULT_SHORTCUTS; } catch { return DEFAULT_SHORTCUTS; }
  });
  useEffect(() => { if (isOpen) { try { const raw = localStorage.getItem('cf_custom_shortcuts'); if (raw) setShortcuts(JSON.parse(raw)); } catch {} } }, [isOpen]);
  const save = () => { localStorage.setItem('cf_custom_shortcuts', JSON.stringify(shortcuts)); onClose(); };
  const reset = () => setShortcuts(DEFAULT_SHORTCUTS);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom Keyboard Shortcuts" subtitle="Edit shortcuts — stored locally, no server needed" maxWidth="md">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto">
          {Object.entries(shortcuts).map(([action, keys]) => (
            <div key={action} className="flex items-center justify-between p-2 rounded bg-[#121214] border border-[#27272a]">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1"><Keyboard className="w-3 h-3" />{action}</span>
              <input value={keys} onChange={(e) => setShortcuts((prev) => ({ ...prev, [action]: e.target.value }))} className="w-28 px-2 py-1 text-xs bg-[#1a1a1e] border border-[#27272a] rounded text-gray-200 font-mono focus:outline-none focus:border-forge-cyan" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[#27272a]">
          <button onClick={reset} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"><RotateCcw className="w-3 h-3" />Reset</button>
          <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 rounded bg-forge-purple text-white text-xs font-bold"><Save className="w-3 h-3" />Save Shortcuts</button>
        </div>
        <p className="text-[10px] text-gray-500">Custom shortcuts are local to this device and respect platform modifiers (Ctrl/Cmd).</p>
      </div>
    </Modal>
  );
};
