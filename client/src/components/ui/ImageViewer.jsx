import React, { useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut } from './Icons';
import { getFileUrl } from '../../api/api';

export const ImageViewer = ({ isOpen, onClose, src, title }) => {
  const [scale, setScale] = React.useState(1);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setScale(1);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  const fullUrl = getFileUrl(src);

  const handleDownload = async () => {
    try {
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = title || 'photo.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(fullUrl, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 bg-black/85 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="w-full flex items-center justify-between py-2 px-4 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-heading font-semibold text-white/80 truncate max-w-sm">
          {title || 'Image Preview'}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border-none cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border-none cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border-none cursor-pointer"
            title="Download Image"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border-none cursor-pointer"
            title="Close Preview"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 flex items-center justify-center p-2 max-w-full max-h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={fullUrl}
          alt={title || 'Attachment Preview'}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
        />
      </div>

      <div className="h-6" />
    </div>
  );
};

export default ImageViewer;
