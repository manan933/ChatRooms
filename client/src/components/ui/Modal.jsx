import React, { useEffect } from 'react';
import { X } from './Icons';

export const Modal = ({ isOpen, onClose, title, children, size = 'md', maxWidth }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
  };

  const chosenWidth = maxWidth ? '' : sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className={`w-full ${chosenWidth} bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]`}
        style={maxWidth ? { maxWidth } : {}}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] shrink-0">
          <div className="text-sm font-heading font-bold text-[var(--text-primary)] m-0 flex items-center gap-2">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar font-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
