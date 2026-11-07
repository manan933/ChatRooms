import React, { useState } from 'react';
import { Search, X } from './Icons';

const REACTION_TAGS = [
  '+1', 'Like', 'Agree', 'Celebrate', 'Star', 'Heart',
  'Fire', 'Fast', 'Launch', 'Check', 'Noted', 'Support',
  'Insight', 'Question', 'Discuss', 'Priority', 'Pin', 'Review'
];

export const EmojiPicker = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = REACTION_TAGS.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-64 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 flex flex-col gap-2 z-50 select-none font-heading">
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-bold text-[var(--text-primary)]">Quick Reactions</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative flex items-center">
        <Search size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="Filter reactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-2 py-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-xs font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)]"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto custom-scrollbar pt-1">
        {filtered.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onSelect(tag)}
            className="py-1 px-2 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] transition-colors cursor-pointer text-center truncate"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
