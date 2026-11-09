import React, { useState, useEffect } from 'react';
import { getFileUrl } from '../../utils/fileUrl';

const gradients = [
  'linear-gradient(135deg, #0297DE 0%, #FC734D 100%)', // Electric Blue to Cantaloupe Orange
  'linear-gradient(135deg, #0593C6 0%, #D83995 100%)', // Sky Blue to Hot Pink
  'linear-gradient(135deg, #FC734D 0%, #FF8A65 100%)', // Cantaloupe Orange Radiant
  'linear-gradient(135deg, #D83995 0%, #F06292 100%)', // Hot Pink Luminous
  'linear-gradient(135deg, #0297DE 0%, #00B4D8 100%)', // Electric Blue Deep
  'linear-gradient(135deg, #0593C6 0%, #38BDF8 100%)', // Sky Blue Vivid
  'linear-gradient(135deg, #D83995 0%, #8B5CF6 100%)', // Hot Pink to Violet
  'linear-gradient(135deg, #FC734D 0%, #F59E0B 100%)', // Cantaloupe to Amber
];

const getGradient = (rawName = '') => {
  const name = typeof rawName === 'string' ? rawName : String(rawName || '');
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
};

const getInitials = (rawName = '') => {
  const name = typeof rawName === 'string' ? rawName : String(rawName || '');
  if (!name.trim()) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0][0] || '') + (parts[1][0] || '')).toUpperCase() || '?';
  }
  return name.slice(0, 2).toUpperCase() || '?';
};

const sizes = {
  xs: { box: 'w-6 h-6 text-[10px]', dot: 'w-2 h-2 ring-1' },
  sm: { box: 'w-8 h-8 text-[12px]', dot: 'w-2.5 h-2.5 ring-1.5' },
  md: { box: 'w-10 h-10 text-[14px]', dot: 'w-3 h-3 ring-2' },
  lg: { box: 'w-12 h-12 text-[16px]', dot: 'w-3.5 h-3.5 ring-2' },
  xl: { box: 'w-16 h-16 text-[20px]', dot: 'w-4 h-4 ring-2' },
};

export const Avatar = ({ src, name = 'User', size = 'md', status = null, className = '' }) => {
  const [hasError, setHasError] = useState(false);
  const currentSize = sizes[size] || sizes.md;

  // Reset error state when src prop updates
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const rawUrl = src && !hasError ? src : null;
  const imageUrl = rawUrl ? getFileUrl(rawUrl) : null;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={`${currentSize.box} rounded-full object-cover shadow-sm`}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : (
        <div
          style={{ background: getGradient(name) }}
          className={`${currentSize.box} rounded-full flex items-center justify-center text-white font-bold select-none shadow-sm`}
        >
          {getInitials(name)}
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-[var(--bg-primary)] ${currentSize.dot} ${
            status === 'online'
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]'
              : 'bg-slate-400/60'
          }`}
          title={status === 'online' ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar;
