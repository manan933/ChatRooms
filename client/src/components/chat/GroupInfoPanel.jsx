import React, { useState, useEffect } from 'react';
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
  UserPlus,
  Trash2,
  Loader2,
  Plus,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import api from '../../api/api';

const ROLE_CONFIG = {
  owner: { label: 'Admin', bg: 'rgba(252, 115, 77, 0.15)', text: 'var(--accent-highlight)', border: 'rgba(252, 115, 77, 0.35)' },
  admin: { label: 'Admin', bg: 'var(--accent-subtle)', text: 'var(--accent)', border: 'rgba(2, 151, 222, 0.35)' },
  moderator: { label: 'Mod', bg: 'var(--accent-subtle)', text: 'var(--accent)', border: 'rgba(2, 151, 222, 0.35)' },
  member: { label: 'Member', bg: 'rgba(148, 163, 184, 0.12)', text: 'var(--text-muted)', border: 'var(--border-subtle)' },
};

export const GroupInfoPanel = ({ chat, onClose, onLeaveChat }) => {
  const [copied, setCopied] = useState(false);
  const {
    toggleMuteChat,
    isChatMuted,
    blockUser,
    unblockUser,
    isUserBlocked,
    groups = [],
    createGroup,
    setActiveChat,
  } = useChatStore();
  const { user } = useAuthStore();

  const currentUserId = user?._id || user?.id;
  const currentUsername = (user?.primaryUsername || user?.username || '').toLowerCase().replace(/^@/, '');

  const [members, setMembers] = useState(chat?.members || []);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Subgroup creation state
  const [showCreateSubgroup, setShowCreateSubgroup] = useState(false);
  const [subgroupName, setSubgroupName] = useState('');
  const [subgroupDesc, setSubgroupDesc] = useState('');
  const [creatingSubgroup, setCreatingSubgroup] = useState(false);
  const [subgroupError, setSubgroupError] = useState(null);

  const existingSubgroups = (groups || []).filter((g) => g.parentGroupId === chat?.id);
  const parentGroup = chat?.parentGroupId ? (groups || []).find((g) => g.id === chat.parentGroupId) : null;

  useEffect(() => {
    if (chat) {
      setMembers(chat.members || []);
      setShowAddMember(false);
      setAddUsername('');
      setAddError(null);
    }
  }, [chat?.id, chat?.members]);

  if (!chat) return null;

  const isChannel = chat.type === 'channel';
  const isDirect = !isChannel && chat.type !== 'group';
  // Use real join code from chat or workspace, never fallback to fake CR-001
  const joinCode = chat.joinCode || chat.workspaceJoinCode || null;
  const muted = isChatMuted(chat.id);
  const contactBlocked = isDirect ? isUserBlocked(chat.userId || chat.id || chat.username) : false;

  // Determine if current user is admin/owner of this channel or workspace
  const isAdmin =
    chat.owner === currentUserId ||
    chat.owner?.toString() === currentUserId?.toString() ||
    chat.createdBy === currentUserId ||
    chat.creatorName?.includes('You') ||
    (members || []).some(
      (m) =>
        ((m.id && m.id === currentUserId) || (m.username && m.username.toLowerCase().replace(/^@/, '') === currentUsername)) &&
        (m.role === 'admin' || m.role === 'owner')
    );

  const handleCopyCode = () => {
    if (joinCode) {
      navigator.clipboard?.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateSubgroup = async (e) => {
    e.preventDefault();
    if (!subgroupName.trim()) return;
    setCreatingSubgroup(true);
    setSubgroupError(null);
    try {
      const res = await createGroup(subgroupName.trim(), subgroupDesc.trim(), chat.id);
      if (res.success) {
        setSubgroupName('');
        setSubgroupDesc('');
        setShowCreateSubgroup(false);
        setActionSuccess(`Created subgroup #${res.group.name}`);
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setSubgroupError(res.error || 'Failed to create subgroup');
      }
    } catch {
      setSubgroupError('Error connecting to server.');
    } finally {
      setCreatingSubgroup(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addUsername.trim()) return;

    setAddLoading(true);
    setAddError(null);
    const cleanTarget = addUsername.trim().replace(/^@/, '').toLowerCase();

    try {
      const res = await api.workspaces.addMembers(chat.id, [{ username: cleanTarget }]);
      if (res.ok) {
        setMembers((prev) => [
          ...prev,
          {
            id: `mem-${Date.now()}`,
            name: cleanTarget,
            username: cleanTarget,
            role: 'member',
            joinedAt: new Date(),
          },
        ]);
        setAddUsername('');
        setShowAddMember(false);
        setActionSuccess(`Added @${cleanTarget} to channel`);
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setAddError(res.error || 'Failed to add member. Check username.');
      }
    } catch {
      setAddError('Error connecting to server.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = async (memberId, memberUsername) => {
    if (!window.confirm(`Remove @${memberUsername} from this ${isChannel ? 'channel' : 'group'}?`)) return;

    try {
      const res = await api.workspaces.removeMember(chat.id, memberId || memberUsername);
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId && m.username !== memberUsername));
        setActionSuccess(`Removed @${memberUsername}`);
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        alert(res.error || 'Could not remove member');
      }
    } catch {
      alert('Error connecting to server');
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
            {chat.workspaceName ? `${chat.workspaceName}` : chat.username ? `@${chat.username}` : `${members.length || chat.membersCount || 1} members`}
          </p>
        </div>

        {/* Action feedback banner */}
        {actionSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
            <Check size={14} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Parent Group Navigation (if this is a subgroup) */}
        {parentGroup && (
          <div className="p-3 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--border)] flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] block">
                Parent Group
              </span>
              <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate block">
                {parentGroup.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveChat(parentGroup);
                onClose();
              }}
              className="px-2.5 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold border-none cursor-pointer transition-colors shadow-xs"
            >
              Open
            </button>
          </div>
        )}

        {/* ── Subgroups Section (for groups) ─────────────────────────── */}
        {chat.type === 'group' && (
          <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Hash size={15} className="text-[var(--accent)]" />
                <span>Subgroups ({existingSubgroups.length})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowCreateSubgroup(!showCreateSubgroup);
                  setSubgroupError(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold border-none cursor-pointer shadow-xs transition-colors"
              >
                <Plus size={12} />
                <span>Add Subgroup</span>
              </button>
            </div>

            {/* Inline Subgroup Creation Form */}
            {showCreateSubgroup && (
              <form onSubmit={handleCreateSubgroup} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--accent)]/40 flex flex-col gap-2 animate-fadeIn">
                <span className="text-xs font-bold text-[var(--text-primary)]">New Subgroup</span>
                <input
                  type="text"
                  required
                  placeholder="Subgroup name"
                  value={subgroupName}
                  onChange={(e) => setSubgroupName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={subgroupDesc}
                  onChange={(e) => setSubgroupDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                />
                {subgroupError && <span className="text-[10px] text-red-400 font-body">{subgroupError}</span>}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateSubgroup(false)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingSubgroup || !subgroupName.trim()}
                    className="px-3 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold border-none cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {creatingSubgroup ? <Loader2 size={12} className="animate-spin" /> : <span>Create</span>}
                  </button>
                </div>
              </form>
            )}

            {existingSubgroups.length === 0 ? (
              <p className="text-xs font-body text-[var(--text-muted)] m-0 italic">
                No nested subgroups yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {existingSubgroups.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setActiveChat(sub);
                      onClose();
                    }}
                    className="w-full p-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-between text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-[var(--accent)]">#</span>
                      <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {sub.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">Open →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Join Code Card (if channel) ───────────────────────────── */}
        {joinCode && (
          <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Workspace Invite Code
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-[var(--accent)] truncate block">
                {joinCode}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="py-1 px-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-[11px] font-bold border-none cursor-pointer flex items-center gap-1 shadow-xs transition-colors"
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
              <span>{isDirect ? 'Mutual Information' : `Participants (${members.length || 1})`}</span>
            </span>

            {/* Admin Add Member Trigger Button */}
            {isAdmin && (isChannel || chat.type === 'group') && (
              <button
                type="button"
                onClick={() => {
                  setShowAddMember(!showAddMember);
                  setAddError(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold border-none cursor-pointer shadow-xs transition-colors"
              >
                <UserPlus size={12} />
                <span>Add Member</span>
              </button>
            )}
          </div>

          {/* Inline Add Member Form (Admin only) */}
          {showAddMember && (
            <form onSubmit={handleAddMember} className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--accent)]/40 flex flex-col gap-2 animate-fadeIn">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">Add User by Username</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="username"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={addLoading || !addUsername.trim()}
                  className="py-1.5 px-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold border-none cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {addLoading ? <Loader2 size={12} className="animate-spin" /> : <span>Add</span>}
                </button>
              </div>
              {addError && <span className="text-[10px] text-[var(--danger)] font-body">{addError}</span>}
            </form>
          )}

          <div className="space-y-1.5">
            {isDirect ? (
              <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-center text-[11px] font-body text-[var(--text-secondary)]">
                Direct encrypted room on <strong className="text-[var(--text-primary)] font-heading">ChatRooms</strong>.
              </div>
            ) : (
              members.map((m) => {
                const roleCfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                const isMemberAdmin = m.role === 'admin' || m.role === 'owner';
                const canRemove = isAdmin && !isMemberAdmin && m.id !== currentUserId && m.username?.toLowerCase() !== currentUsername;

                return (
                  <div
                    key={m.id || m._id || m.username}
                    className="p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={m.name || m.username} size="sm" status={m.status} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {m.name || m.username}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">
                          @{m.username}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
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

                      {/* Admin remove member button */}
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id, m.username)}
                          className="p-1 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/15 border-none bg-transparent cursor-pointer transition-colors"
                          title={`Remove @${m.username}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
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
                if (window.confirm(`Permanently clear & delete chat history for ${chat.name}?`)) {
                  onLeaveChat?.(chat.id, 'delete');
                  onClose();
                }
              }}
              className="py-2 px-3 rounded-xl bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/25 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <X size={14} />
              <span>Delete Chat</span>
            </button>
          </div>
        )}

        {isDirect && (
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Clear and delete chat history with ${chat.name}?`)) {
                  onLeaveChat?.(chat.id, 'delete');
                  onClose();
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/25 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>Delete Chat</span>
            </button>

            {contactBlocked ? (
              <button
                type="button"
                onClick={() => unblockUser(chat)}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
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
                className="w-full py-2 px-3 rounded-xl bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/25 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Ban size={14} />
                <span>Block User</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default GroupInfoPanel;
