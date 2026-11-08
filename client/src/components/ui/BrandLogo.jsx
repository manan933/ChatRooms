import React from 'react';
import useThemeStore from '../../store/themeStore';

/**
 * Official ChatRooms Brand Logo Component
 * Automatically adapts between Theme 1 (Light: black text) and Theme 2 (Dark: white text).
 *
 * Variants:
 *  - 'lockup': Full horizontal mark (Isometric Rooms Icon + "ChatRooms" text)
 *  - 'icon': Standalone isometric hexagon rooms mark
 */
export const BrandLogo = ({
  variant = 'lockup',
  size = 'md',
  className = '',
  alt = 'ChatRooms',
}) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const sizeClasses = {
    xs: variant === 'lockup' ? 'h-7' : 'w-7 h-7',
    sm: variant === 'lockup' ? 'h-9' : 'w-9 h-9',
    md: variant === 'lockup' ? 'h-11' : 'w-12 h-12',
    lg: variant === 'lockup' ? 'h-16' : 'w-18 h-18',
    xl: variant === 'lockup' ? 'h-22' : 'w-28 h-28',
    '2xl': variant === 'lockup' ? 'h-28' : 'w-36 h-36',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  const src =
    variant === 'lockup'
      ? isDark
        ? '/chatrooms-lockup-white.png'
        : '/chatrooms-lockup.png'
      : isDark
      ? '/chatrooms-icon-white.png'
      : '/chatrooms-icon.png';

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain select-none shrink-0 ${currentSizeClass} ${className}`}
      draggable={false}
    />
  );
};

export default BrandLogo;
