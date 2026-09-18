import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Modal } from '../common/Modal';
import { History, Save, RotateCcw, Clock } from 'lucide-react';

export const VersionHistoryModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { project, saveVersionSnapshot, getVersionHistory, restoreVersion } = useProject();
  const [versions, setVersions] = useState<any[]>([]);
  const [name, setName] = useState('');
  useEffect(() => { if (isOpen) setVersions(getVersionHistory()); }, [isOpen, getVersionHistory, project]);
  if (!project) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Version History & Auto-Save" subtitle="Snapshots are local — restore any previous project state" maxWidth="lg">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Version name (e.g. Before color grade)" className="flex-1 px-2.5 py-1.5 text-xs bg-[#121214] border border-[#27272a] rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple" />
          <button onClick={() => { saveVersionSnapshot(name || undefined); setName(''); setVersions(getVersionHistory()); }} className="px-3 py-1.5 rounded-lg bg-forge-purple text-white text-xs font-bold flex items-center gap-1"><Save className="w-3.5 h-3.5" />Save</button>
        </div>
        <div className="max-h-[320px] overflow-y-auto space-y-1 border border-[#27272a] rounded-lg p-2 bg-[#0e0e10]">
          {versions.length === 0 ? <div className="text-xs text-gray-500 p-3 text-center">No versions yet — autosave runs every 12s.</div> : versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-2 rounded bg-[#18181c] border border-[#27272a]">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1"><History className="w-3 h-3 text-forge-cyan" />{v.name}</div>
                <div className="text-[10px] text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(v.createdAt).toLocaleString()} • {(v.sizeBytes / 1024).toFixed(1)}KB</div>
              </div>
              <button onClick={() => { if (confirm(`Restore "${v.name}"? Current state will be saved as new version.`)) { saveVersionSnapshot('Before restore'); restoreVersion(v.id); onClose(); } }} className="px-2 py-1 rounded bg-[#27272a] hover:bg-white/10 text-xs text-gray-200 flex items-center gap-1"><RotateCcw className="w-3 h-3" />Restore</button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
