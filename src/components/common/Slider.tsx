import React from 'react';

interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 font-medium">{label}</span>
          <span className="text-forge-cyan font-mono font-semibold">
            {value}
            {unit}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-canvas-border rounded-lg appearance-none cursor-pointer accent-forge-purple focus:outline-none focus:ring-1 focus:ring-forge-purple"
      />
    </div>
  );
};
