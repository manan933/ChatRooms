import { create } from 'zustand';

// Two primary themes (Item 29):
// Theme 1 (Light): Skyblue #0593C6 + white #FCFFFF + hot pink #D83995
// Theme 2 (Dark): midnight black #02070A + electric blue #0297DE + Cantaloupe orange #FC734D

const getInitialTheme = () => {
  const saved = localStorage.getItem('chatrooms_theme') || localStorage.getItem('zyntra_theme');
  if (saved) return saved;
  return 'dark'; // Default to Theme 2 (Midnight Dark)
};

const applyRootStyles = (theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  localStorage.setItem('chatrooms_theme', theme);
};

export const useThemeStore = create((set, get) => {
  const initialTheme = getInitialTheme();
  const initialSound = localStorage.getItem('chatrooms_sound') !== 'false';

  applyRootStyles(initialTheme);

  return {
    theme: initialTheme,
    soundEnabled: initialSound,

    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      applyRootStyles(nextTheme);
      set({ theme: nextTheme });
    },

    setTheme: (theme) => {
      applyRootStyles(theme);
      set({ theme });
    },

    setSoundEnabled: (soundEnabled) => {
      localStorage.setItem('chatrooms_sound', String(soundEnabled));
      set({ soundEnabled });
    },
  };
});

export default useThemeStore;
