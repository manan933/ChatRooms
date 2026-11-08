import React from 'react';
import useThemeStore from '../../store/themeStore';

/**
 * Official ChatRooms Brand Logo Component
 * Renders the horizontal lockup: [logo] ChatRooms (icon side-by-side with text),
 * or the standalone icon when variant="icon".
 * Automatically adapts between Theme 1 (Light: black text) and Theme 2 (Dark: white text).
 * The word "ChatRooms" uses the 'Lakki Reddy' font as requested.
 */
export const BrandLogo = ({
  variant = 'lockup',
  size = 'md',
  className = '',
  alt = 'ChatRooms',
}) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const iconSizes = {
    xs: 'w-6 h-6',
    sm: 'w-7.5 h-7.5 sm:w-8 sm:h-8',
    md: 'w-9.5 h-9.5 sm:w-11 sm:h-11',
    lg: 'w-13 h-13 sm:w-15 sm:h-15',
    xl: 'w-16 h-16 sm:w-20 sm:h-20',
    '2xl': 'w-22 h-22 sm:w-26 sm:h-26',
    '3xl': 'w-28 h-28 sm:w-32 sm:h-32',
    hero: 'w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36',
  };

  const textSizes = {
    xs: 'text-base font-normal',
    sm: 'text-lg sm:text-xl font-normal',
    md: 'text-2xl sm:text-[26px] font-normal',
    lg: 'text-3xl sm:text-4xl font-normal',
    xl: 'text-4xl sm:text-5xl font-normal',
    '2xl': 'text-5xl sm:text-6xl font-normal',
    '3xl': 'text-6xl sm:text-7xl font-normal',
    hero: 'text-5xl sm:text-6xl md:text-7xl font-normal',
  };

  const iconSrc = isDark ? '/chatrooms-icon-white.png' : '/chatrooms-icon.png';

  if (variant === 'icon') {
    return (
      <img
        src={iconSrc}
        alt={alt}
        className={`object-contain select-none shrink-0 ${iconSizes[size] || iconSizes.md} ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none shrink-0 ${className}`}>
      <img
        src={iconSrc}
        alt=""
        className={`${iconSizes[size] || iconSizes.md} object-contain shrink-0 drop-shadow-xs`}
        draggable={false}
      />
      <span
        className={`font-brand ${textSizes[size] || textSizes.md} tracking-wide text-[var(--text-primary)] leading-none select-none`}
        style={{ fontFamily: "'Lakki Reddy', cursive" }}
      >
        ChatRooms
      </span>
    </div>
  );
};

export default BrandLogo;
