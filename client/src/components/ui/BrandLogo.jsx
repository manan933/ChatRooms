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
    xs: variant === 'lockup' ? 'h-6' : 'w-6 h-6',
    sm: variant === 'lockup' ? 'h-8' : 'w-8 h-8',
    md: variant === 'lockup' ? 'h-10' : 'w-11 h-11',
    lg: variant === 'lockup' ? 'h-14' : 'w-16 h-16',
    xl: variant === 'lockup' ? 'h-18' : 'w-24 h-24',
    '2xl': variant === 'lockup' ? 'h-24' : 'w-32 h-32',
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
