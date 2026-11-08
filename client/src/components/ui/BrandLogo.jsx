import React from 'react';
import useThemeStore from '../../store/themeStore';

/**
 * Official ChatRooms Brand Logo Component
 * Renders the horizontal lockup: [logo] ChatRooms (icon side-by-side with text),
 * or the standalone icon when variant="icon".
 * Automatically adapts between Theme 1 (Light: black text) and Theme 2 (Dark: white text).
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
  };

  const textSizes = {
    xs: 'text-sm font-bold',
    sm: 'text-base sm:text-lg font-bold',
    md: 'text-xl sm:text-[23px] font-extrabold',
    lg: 'text-2xl sm:text-3xl font-extrabold',
    xl: 'text-3xl sm:text-4xl font-black',
    '2xl': 'text-4xl sm:text-5xl font-black',
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
        className={`font-heading ${textSizes[size] || textSizes.md} tracking-tight text-[var(--text-primary)] leading-none select-none`}
      >
        ChatRooms
      </span>
    </div>
  );
};

export default BrandLogo;
