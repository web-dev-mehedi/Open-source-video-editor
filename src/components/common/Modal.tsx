import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const modalContent = (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 select-none">
      {/* Full-screen blocking Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-150 pointer-events-auto cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Dialog Box */}
      <div
        className={`relative w-full ${widthClasses[maxWidth]} bg-[#18181c] rounded-2xl p-5 shadow-2xl border border-[#2e2e34] z-10 overflow-hidden max-h-[90vh] flex flex-col select-none animate-in fade-in zoom-in-95 duration-150 pointer-events-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#27272a]">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
