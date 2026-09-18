import React from 'react';
import { LucideIcon } from 'lucide-react';

interface QuickAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const QuickActions: React.FC<{ actions: QuickAction[] }> = ({ actions }) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap p-2 bg-[#121214] border-b border-[#27272a]">
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={a.onClick}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${a.variant === 'primary' ? 'bg-white text-black border-white' : 'bg-[#27272a] text-gray-300 border-[#3f3f46] hover:bg-[#2f2f35]'}`}
        >
          {a.icon && <a.icon className="w-3 h-3" />}
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
};
