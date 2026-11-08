import React, { useState } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  Hash,
  Ban,
  Bell,
  BellOff,
  LogOut,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import useChatStore from '../../store/chatStore';

const ROLE_CONFIG = {
  owner: { label: 'Owner', bg: 'rgba(252, 115, 77, 0.12)', text: 'var(--accent-highlight)', border: 'rgba(252, 115, 77, 0.25)' },
  admin: { label: 'Admin', bg: 'var(--accent-subtle)', text: 'var(--accent)', border: 'rgba(2, 151, 222, 0.25)' },
  moderator: { label: 'Mod', bg: 'var(--accent-subtle)', text: 'var(--accent)', border: 'rgba(2, 151, 222, 0.25)' },
  member: { label: 'Member', bg: 'rgba(148, 163, 184, 0.12)', text: 'var(--text-muted)', border: 'var(--border-subtle)' },
};

export const GroupInfoPanel = ({ chat, onClose, onLeaveChat }) => {
  const [copied, setCopied] = useState(false);
  const { toggleMuteChat, isChatMuted, blockUser, unblockUser, isUserBlocked } = useChatStore();

  if (!chat) return null;

  const isChannel = chat.type === 'channel';
  const isDirect = !isChannel && chat.type !== 'group';
  const joinCode = chat.joinCode || (isChannel ? 'CR-001' : null);
  const muted = isChatMuted(chat.id);
  const contactBlocked = isDirect ? isUserBlocked(chat.userId || chat.id || chat.username) : false;

  const handleCopyCode = () => {
    if (joinCode) {
      navigator.clipboard?.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside className="w-80 h-full bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden select-none z-20 font-heading">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {isChannel ? 'Channel Details' : isDirect ? 'Contact Details' : 'Group Info'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-none bg-transparent cursor-pointer"
          aria-label="Close details"
        >
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {/* ── Hero Info Card ────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)]">
          {isChannel ? (
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--border-subtle)] text-[var(--accent)] flex items-center justify-center font-bold mb-3">
              <Hash size={28} />
            </div>
          ) : (
            <Avatar name={chat.name} src={chat.avatar} size="lg" className="mb-3" />
          )}

          <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] m-0">
            {chat.name}
          </h3>
          <p className="text-sm font-body text-[var(--text-muted)] mt-0.5 m-0">
            {chat.workspaceName ? `${chat.workspaceName}` : chat.username ? `@${chat.username}` : `${chat.membersCount || 1} members`}
          </p>
        </div>

        {/* ── Join Code Card (if channel) ───────────────────────────── */}
        {joinCode && (
          <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Invite Code
              </span>
              <span className="text-sm sm:text-base font-bold text-[var(--accent)] truncate block">
                {joinCode}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="py-1 px-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-lg text-[11px] font-bold border-none cursor-pointer flex items-center gap-1 shadow-xs"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* ── Quick Controls ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => toggleMuteChat(chat.id)}
            className={`py-2.5 px-3.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              muted
                ? 'bg-[var(--accent-highlight)]/15 border-[var(--accent-highlight)]/30 text-[var(--accent-highlight)] font-bold'
                : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {muted ? <BellOff size={14} /> : <Bell size={14} />}
            <span>{muted ? 'Muted' : 'Mute Notifications'}</span>
          </button>
        </div>

        {/* ── Members or Mutual Groups ────────────────────────────── */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Users size={14} className="text-[var(--accent)]" />
              <span>{isDirect ? 'Mutual Information' : `Participants (${(chat.members || []).length || chat.membersCount || 1})`}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            {isDirect ? (
              <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-center text-[11px] font-body text-[var(--text-secondary)]">
                Direct encrypted room on <strong className="text-[var(--text-primary)] font-heading">ChatRooms</strong>.
              </div>
            ) : (
              (chat.members || []).map((m) => {
                const roleCfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                return (
                  <div
                    key={m.id || m._id}
                    className="p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={m.name} size="sm" status={m.status} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {m.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">
                          @{m.username}
                        </div>
                      </div>
                    </div>

                    <span
                      className="px-1.5 py-0.5 rounded-md text-[9px] font-bold border shrink-0"
                      style={{
                        backgroundColor: roleCfg.bg,
                        color: roleCfg.text,
                        borderColor: roleCfg.border,
                      }}
                    >
                      {roleCfg.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Leave / Delete / Block Action ────────────────────── */}
        {(isChannel || chat.type === 'group') && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Leave ${chat.name}?`)) {
                  onLeaveChat?.(chat.id, 'leave');
                  onClose();
                }
              }}
              className="py-2 px-3 rounded-xl bg-[var(--accent-highlight)]/10 hover:bg-[var(--accent-highlight)]/20 text-[var(--accent-highlight)] border border-[var(--accent-highlight)]/25 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} />
              <span>Leave</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Permanently remove ${chat.name}?`)) {
                  onLeaveChat?.(chat.id, 'delete');
                  onClose();
                }
              }}
              className="py-2 px-3 rounded-xl bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/25 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <X size={14} />
              <span>Delete</span>
            </button>
          </div>
        )}

        {isDirect && (
          contactBlocked ? (
            <button
              type="button"
              onClick={() => unblockUser(chat)}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              <span>Unblock User</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Block ${chat.name}? They will not be able to send you messages or call you.`)) {
                  blockUser(chat);
                }
              }}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/25 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Ban size={14} />
              <span>Block User</span>
            </button>
          )
        )}
      </div>
    </aside>
  );
};

export default GroupInfoPanel;
