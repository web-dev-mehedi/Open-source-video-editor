import React, { useState, useEffect } from 'react';
import { ChevronDown, RotateCcw, Pin, PinOff } from 'lucide-react';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  onReset?: () => void;
  onPin?: () => void;
  isPinned?: boolean;
  children: React.ReactNode;
  storageKey?: string;
}

export const Section: React.FC<SectionProps> = ({ title, defaultOpen = false, onReset, onPin, isPinned, children, storageKey }) => {
  const [open, setOpen] = useState(() => {
    if (storageKey) {
      const v = localStorage.getItem(`cf_section_${storageKey}`);
      if (v !== null) return v === '1';
    }
    return defaultOpen;
  });

  useEffect(() => {
    if (storageKey) localStorage.setItem(`cf_section_${storageKey}`, open ? '1' : '0');
  }, [open, storageKey]);

  return (
    <div className="border-b border-[#27272a] bg-[#18181b]">
      <div
        className="flex items-center justify-between px-2.5 py-2 cursor-pointer hover:bg-[#1e1e22] group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          {onPin && (
            <button onClick={onPin} className={`p-1 rounded hover:bg-white/10 ${isPinned ? 'text-forge-cyan' : 'text-gray-500'}`} title={isPinned ? 'Unpin' : 'Pin to quick'}>
              {isPinned ? <Pin className="w-3 h-3 fill-current" /> : <PinOff className="w-3 h-3" />}
            </button>
          )}
          {onReset && (
            <button onClick={onReset} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white" title="Reset section">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {open && <div className="px-2.5 pb-3 pt-1 space-y-3 bg-[#121214]">{children}</div>}
    </div>
  );
};
