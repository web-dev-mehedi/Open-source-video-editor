import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { Undo2, Redo2, Clock, History } from 'lucide-react';

export const HistoryPanel: React.FC = () => {
  const { history, historyIndex, jumpToHistory, undo, redo, canUndo, canRedo } = useProject();
  if (history.length === 0) return <div className="p-4 text-xs text-gray-500">No history yet — edit to create snapshots.</div>;
  return (
    <div className="flex flex-col h-full bg-[#121214] text-gray-200">
      <div className="p-2 border-b border-[#27272a] flex items-center justify-between">
        <span className="text-xs font-bold flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-forge-cyan" /> Editing History</span>
        <div className="flex gap-1">
          <button onClick={undo} disabled={!canUndo} className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /></button>
          <button onClick={redo} disabled={!canRedo} className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><Redo2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.map((_, idx) => {
          const isCurrent = idx === historyIndex;
          const label = idx === 0 ? 'Initial Project' : `Action #${idx}`;
          const time = new Date().toLocaleTimeString(); // placeholder, real would store timestamp
          return (
            <button
              key={idx}
              onClick={() => jumpToHistory(idx)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between ${isCurrent ? 'bg-forge-purple text-white border-forge-purple' : 'bg-[#18181c] border-[#27272a] hover:border-gray-600 text-gray-300'}`}
            >
              <span className="flex items-center gap-1.5 truncate"><Clock className="w-3 h-3" />{label}</span>
              <span className="text-[10px] font-mono text-gray-500">{idx === historyIndex ? 'Current' : ''}</span>
            </button>
          );
        }).reverse()}
      </div>
      <div className="p-2 border-t border-[#27272a] text-[10px] text-gray-500">{history.length} snapshots • {historyIndex + 1}/{history.length}</div>
    </div>
  );
};
