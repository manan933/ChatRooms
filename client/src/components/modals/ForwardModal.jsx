import React, { useState, useMemo } from 'react';
import { Search, Forward, Check, X, Hash } from '../ui/Icons';
import Avatar from '../ui/Avatar';
import Modal from '../ui/Modal';
import useChatStore from '../../store/chatStore';

export const ForwardModal = ({
  isOpen,
  onClose,
  message,
  onForward,
}) => {
  const [search, setSearch] = useState('');
  const [forwardedIds, setForwardedIds] = useState(new Set());
  const { chats = [] } = useChatStore();

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase().trim();
    return chats.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.rawName?.toLowerCase().includes(q)
    );
  }, [chats, search]);

  if (!isOpen || !message) return null;

  const handleForwardToChat = (targetChat) => {
    onForward?.(targetChat, message);
    setForwardedIds((prev) => new Set([...prev, targetChat.id]));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Forward Message" size="md">
      <div className="flex flex-col gap-3 font-heading">
        {/* Message Snippet Preview */}
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-start gap-2.5">
          <Forward size={16} className="text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-[var(--accent)] block">
              {message.senderName || 'Message Preview'}
            </span>
            <p className="text-xs font-body text-[var(--text-secondary)] truncate m-0 mt-0.5">
              {message.content || (message.attachment ? '📎 Media attachment' : 'Message')}
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search contacts, groups, or channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)]"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 border-none bg-transparent cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Chats List */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {filteredChats.length === 0 ? (
            <div className="text-center py-6 text-xs text-[var(--text-muted)] font-body">
              No matching chats found
            </div>
          ) : (
            filteredChats.map((c) => {
              const isForwarded = forwardedIds.has(c.id);
              const isChannel = c.type === 'channel';

              return (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isChannel ? (
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center font-bold text-xs shrink-0">
                        <Hash size={16} />
                      </div>
                    ) : (
                      <Avatar name={c.name} src={c.avatar} size="sm" status={c.status} />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">
                        {isChannel ? (c.workspaceName || 'Channel') : (c.username ? `@${c.username}` : 'Direct Chat')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleForwardToChat(c)}
                    disabled={isForwarded}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 transition-all ${
                      isForwarded
                        ? 'bg-emerald-500/15 text-emerald-400 cursor-default'
                        : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-xs'
                    }`}
                  >
                    {isForwarded ? (
                      <>
                        <Check size={12} />
                        <span>Sent</span>
                      </>
                    ) : (
                      <>
                        <Forward size={12} />
                        <span>Forward</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Done Footer */}
        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-xs font-bold border border-[var(--border)] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ForwardModal;
