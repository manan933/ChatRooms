import React, { useState, useMemo } from 'react';
import { Search, X } from './Icons';

const EMOJI_LIST = [
  // Frequently Used / Reactions
  { emoji: '👍', name: 'thumbs up like +1' },
  { emoji: '❤️', name: 'red heart love' },
  { emoji: '🔥', name: 'fire flame lit hot' },
  { emoji: '😂', name: 'laugh crying laughing joy haha lol' },
  { emoji: '⭐', name: 'star gold favorite' },
  { emoji: '🤝', name: 'handshake agree deal partner' },
  { emoji: '🎉', name: 'party popper celebrate celebration tada' },
  { emoji: '🚀', name: 'rocket launch fast' },
  { emoji: '💯', name: 'hundred 100 perfect' },
  { emoji: '👏', name: 'clapping hands applause bravo' },
  { emoji: '🙏', name: 'folded hands pray please thanks' },
  { emoji: '✨', name: 'sparkles shiny star clean' },
  { emoji: '✅', name: 'check checkmark done success' },
  { emoji: '⚡', name: 'lightning bolt fast energy' },
  { emoji: '💡', name: 'light bulb idea insight' },
  { emoji: '👀', name: 'eyes look review peek' },

  // Faces & Expressions
  { emoji: '😀', name: 'grinning face happy smile' },
  { emoji: '😃', name: 'grinning face with big eyes' },
  { emoji: '😄', name: 'grinning face with smiling eyes' },
  { emoji: '😁', name: 'beaming face smiling' },
  { emoji: '😆', name: 'grinning squinting face' },
  { emoji: '😅', name: 'grinning face with sweat phew' },
  { emoji: '🤣', name: 'rolling on the floor laughing rofl' },
  { emoji: '😊', name: 'smiling face with smiling eyes blush' },
  { emoji: '😇', name: 'smiling face with halo angel' },
  { emoji: '🙂', name: 'slightly smiling face' },
  { emoji: '😉', name: 'winking face wink' },
  { emoji: '😍', name: 'smiling face with heart-eyes love' },
  { emoji: '🥰', name: 'smiling face with hearts adore' },
  { emoji: '😘', name: 'face blowing a kiss mwah' },
  { emoji: '😋', name: 'face savoring food delicious' },
  { emoji: '😎', name: 'smiling face with sunglasses cool' },
  { emoji: '🤩', name: 'star-struck amazing wow' },
  { emoji: '🥳', name: 'partying face party' },
  { emoji: '🤔', name: 'thinking face hmm wonder' },
  { emoji: '🤫', name: 'shushing face quiet secret' },
  { emoji: '😮', name: 'face with open mouth surprised wow' },
  { emoji: '🤯', name: 'exploding head mind blown' },
  { emoji: '😭', name: 'loudly crying face sad tears' },
  { emoji: '🥺', name: 'pleading face puppy eyes' },
  { emoji: '😤', name: 'face with steam triumph' },
  { emoji: '😴', name: 'sleeping face zzz tired' },

  // Gestures & Badges
  { emoji: '👎', name: 'thumbs down dislike bad' },
  { emoji: '👌', name: 'ok hand alright perfect' },
  { emoji: '✌️', name: 'victory hand peace' },
  { emoji: '🤞', name: 'crossed fingers good luck' },
  { emoji: '🤟', name: 'love you gesture' },
  { emoji: '🤘', name: 'sign of the horns rock on' },
  { emoji: '💪', name: 'flexed biceps muscle strong' },
  { emoji: '🙌', name: 'raising hands praise hooray' },

  // Hearts & Symbols
  { emoji: '💖', name: 'sparkling heart love' },
  { emoji: '💙', name: 'blue heart' },
  { emoji: '💚', name: 'green heart' },
  { emoji: '💛', name: 'yellow heart' },
  { emoji: '💜', name: 'purple heart' },
  { emoji: '🖤', name: 'black heart' },
  { emoji: '💔', name: 'broken heart' },
  { emoji: '📌', name: 'pushpin pin important' },
  { emoji: '📍', name: 'round pushpin location' },
  { emoji: '📝', name: 'memo note writing noted' },
  { emoji: '🚨', name: 'police car light emergency priority urgent' },
  { emoji: '🎯', name: 'bullseye target goal' },
  { emoji: '🏆', name: 'trophy winner champion' },
  { emoji: '☕', name: 'hot beverage coffee tea' },
];

export const EmojiPicker = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return EMOJI_LIST;
    const q = search.toLowerCase().trim();
    return EMOJI_LIST.filter(
      (item) => item.emoji.includes(q) || item.name.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="w-72 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 z-50 select-none font-heading backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-bold text-[var(--text-primary)] tracking-wide">
          Emojis & Reactions
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] bg-transparent border-none cursor-pointer transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative flex items-center">
        <Search size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="Search emoji (e.g. fire, heart, smile)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-xs font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-6 gap-1 max-h-52 overflow-y-auto custom-scrollbar p-1">
        {filtered.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(item.emoji)}
            title={item.name.split(' ')[0]}
            className="w-9 h-9 rounded-lg hover:bg-[var(--accent)] hover:text-white transition-all flex items-center justify-center text-lg cursor-pointer border-none bg-transparent hover:scale-110 active:scale-95"
          >
            {item.emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-6 py-6 text-center text-xs text-[var(--text-muted)] font-body">
            No emoji found for "{search}"
          </div>
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
