import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forge-purple/50 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap';

  const variants = {
    primary: 'bg-forge-purple hover:bg-purple-600 text-white shadow-lg shadow-purple-900/30',
    secondary: 'bg-canvas-card hover:bg-canvas-hover text-gray-200 border border-canvas-border hover:border-gray-600',
    outline: 'border border-canvas-border hover:border-forge-purple text-gray-300 hover:text-white bg-transparent',
    ghost: 'text-gray-400 hover:text-gray-100 hover:bg-white/5 bg-transparent',
    danger: 'bg-red-600/90 hover:bg-red-600 text-white shadow-lg shadow-red-900/30',
    gradient: 'bg-purple-sky hover:opacity-95 text-white font-semibold shadow-lg shadow-purple-900/40 glow-purple',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
    icon: 'p-2 w-9 h-9',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon ? <span className="flex-shrink-0">{rightIcon}</span> : null}
    </button>
  );
};
