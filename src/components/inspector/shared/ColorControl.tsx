import React from 'react';

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mixed?: boolean;
}

export const ColorControl: React.FC<ColorControlProps> = ({ label, value, onChange, mixed }) => {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[11px] text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {mixed ? (
          <span className="text-[11px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800">Mixed</span>
        ) : (
          <>
            <span className="text-[10px] font-mono text-gray-500">{value}</span>
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded border border-[#3f3f46] bg-transparent cursor-pointer" />
          </>
        )}
      </div>
    </div>
  );
};
