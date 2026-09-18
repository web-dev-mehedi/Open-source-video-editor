import React, { useState } from 'react';
import { Diamond, Plus, Minus } from 'lucide-react';

interface NumberControlProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onReset?: () => void;
  keyframeActive?: boolean;
  onToggleKeyframe?: () => void;
  mixed?: boolean;
}

export const NumberControl: React.FC<NumberControlProps> = ({ label, value, min, max, step = 1, unit, onChange, onReset, keyframeActive, onToggleKeyframe, mixed }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) {
      let v = n;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onChange(v);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[11px] text-gray-400 min-w-[80px]">{label}</span>
      <div className="flex items-center gap-1 flex-1 justify-end">
        {mixed ? (
          <span className="text-[11px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800">Mixed</span>
        ) : editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="w-20 px-1.5 py-0.5 text-xs bg-[#27272a] border border-forge-cyan rounded text-white font-mono focus:outline-none"
          />
        ) : (
          <button
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            onMouseDown={(e) => {
              // scrub on drag
              const startX = e.clientX;
              const startV = value;
              const onMove = (ev: MouseEvent) => {
                const dx = ev.clientX - startX;
                const n = startV + dx * (step || 1) * 0.5;
                let v = Math.round(n / step) * step;
                if (min !== undefined) v = Math.max(min, v);
                if (max !== undefined) v = Math.min(max, v);
                onChange(v);
              };
              const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            className="px-2 py-0.5 text-xs bg-[#27272a] border border-[#3f3f46] rounded text-white font-mono hover:border-gray-500 min-w-[56px] text-center"
            title="Click to type, drag to scrub"
          >
            {value}
            {unit ? unit : ''}
          </button>
        )}
        {onToggleKeyframe !== undefined && (
          <button
            onClick={onToggleKeyframe}
            className={`p-1 rounded ${keyframeActive ? 'text-forge-cyan bg-cyan-950/40' : 'text-gray-500 hover:text-white'}`}
            title={keyframeActive ? 'Remove keyframe' : 'Add keyframe'}
          >
            <Diamond className={`w-3 h-3 ${keyframeActive ? 'fill-current' : ''}`} />
          </button>
        )}
        {onReset && (
          <button onClick={onReset} className="text-[10px] text-gray-500 hover:text-white px-1">Reset</button>
        )}
      </div>
    </div>
  );
};
