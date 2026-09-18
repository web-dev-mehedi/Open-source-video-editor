import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'purple' | 'cyan' | 'green' | 'amber' | 'gray';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'purple',
  size = 'sm',
}) => {
  const variants = {
    purple: 'bg-forge-purple/15 text-forge-purple border-forge-purple/30',
    cyan: 'bg-forge-cyan/15 text-forge-cyan border-forge-cyan/30',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    gray: 'bg-gray-700/30 text-gray-300 border-gray-600/30',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span className={`inline-flex items-center rounded-full border ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
};
