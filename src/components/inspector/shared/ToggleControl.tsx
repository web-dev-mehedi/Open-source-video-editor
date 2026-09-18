import React from 'react';

interface ToggleControlProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}

export const ToggleControl: React.FC<ToggleControlProps> = ({ label, value, onChange, description }) => {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div>
        <div className="text-[11px] font-medium text-gray-200">{label}</div>
        {description && <div className="text-[10px] text-gray-500">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full border transition-all flex items-center px-0.5 ${value ? 'bg-forge-cyan border-forge-cyan justify-end' : 'bg-[#27272a] border-[#3f3f46] justify-start'}`}
      >
        <div className="w-4 h-4 rounded-full bg-white shadow" />
      </button>
    </div>
  );
};
