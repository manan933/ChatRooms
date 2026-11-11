import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  Search,
  Loader2,
  Plus,
  Hash,
  Check,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import api from '../../api/api';
import useChatStore from '../../store/chatStore';

export const NewChatPanel = ({
  currentUser,
  onClose,
  onAddContact,
  onCreateGroup,
  onStartDirectChat,
}) => {
  const [view, setView] = useState('list'); // 'list' | 'create_group'
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [parentGroupId, setParentGroupId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const { contacts = [], groups = [] } = useChatStore();

  // Root groups available as parents for subgroups
  const availableParentGroups = groups.filter((g) => !g.parentGroupId);

  const getMyUsername = () => {
    const direct = (currentUser?.primaryUsername || currentUser?.username || '').toLowerCase().trim().replace(/^@/, '');
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('chatrooms_user') || localStorage.getItem('zyntra_user');
      const cached = raw ? JSON.parse(raw) : null;
      return (cached?.primaryUsername || cached?.username || '').toLowerCase().trim().replace(/^@/, '');
    } catch {
      return '';
    }
  };

  // Search registered users
  useEffect(() => {
    const cleanQuery = search.replace(/^@/, '').trim();
    if (!search.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const res = await api.contacts.search(cleanQuery);
        if (res.ok) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.users || []);
          const myUname = getMyUsername();
          const myId = String(currentUser?._id || currentUser?.id || '').toLowerCase();
          const filtered = list.filter((u) => {
            const uid = String(u?._id || u?.id || '').toLowerCase();
            const uname = String(u?.primaryUsername || u?.username || '').toLowerCase().replace(/^@/, '');
            if (myId && uid && uid === myId) return false;
            if (myUname && uname && uname === myUname) return false;
            return Boolean(uname);
          });
          setSearchResults(filtered);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search, currentUser]);

  const handleSelectUser = (targetUser) => {
    const targetUsername = String(targetUser?.primaryUsername || targetUser?.username || '')
      .toLowerCase()
      .trim()
      .replace(/^@/, '');
    if (!targetUsername) return;

    const myUname = getMyUsername();
    const dmId = myUname ? `dm_${[myUname, targetUsername].sort().join('_')}` : `dm_${targetUsername}`;
    const optimisticContact = {
      id: dmId,
      userId: targetUser._id || targetUser.id,
      username: targetUsername,
      primaryUsername: targetUser.primaryUsername || targetUsername,
      name: targetUser.name || targetUsername,
      avatar: targetUser.avatar || null,
      status: targetUser.status || 'online',
      bio: targetUser.bio || '',
      type: 'contact',
    };

    setError(null);
    onStartDirectChat?.(optimisticContact);

    // Persist contact & sync in the background so tapping Chat opens immediately
    if (onAddContact) {
      Promise.resolve(onAddContact(targetUsername, optimisticContact))
        .then((res) => {
          if (res?.success && res.contact && res.contact.id && res.contact.id !== dmId) {
            const curActive = useChatStore.getState().activeChat;
            if (curActive && curActive.id === dmId) {
              onStartDirectChat?.(res.contact);
            }
          }
        })
        .catch((e) => {
          console.warn('Background addContact error:', e);
        });
    }
  };

  const toggleSelectMemberForGroup = (username) => {
    setSelectedMembers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onCreateGroup(
        groupName.trim(),
        groupDesc.trim(),
        parentGroupId || null,
        selectedMembers
      );

      if (res?.success) {
        onClose();
        setGroupName('');
        setGroupDesc('');
        setParentGroupId('');
        setSelectedMembers([]);
        if (res.group) {
          onStartDirectChat?.(res.group);
        }
      } else {
        setError(res?.error || 'Failed to create group');
      }
    } catch {
      setError('An error occurred while creating group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] overflow-hidden select-none font-heading z-20">
      {/* ── WhatsApp-Style Header ───────────────────────────────────── */}
      <div className="h-16 sm:h-17 px-4 flex items-center gap-3 border-b border-[var(--border)] shrink-0 pt-[env(safe-area-inset-top)] bg-[var(--bg-secondary)]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            if (view === 'create_group') {
              setView('list');
              setError(null);
            } else {
              onClose();
            }
          }}
          className="p-2 -ml-1 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-heading font-bold text-[var(--text-primary)] m-0 truncate">
            {view === 'create_group' ? (parentGroupId ? 'New Subgroup' : 'New Group') : 'New Chat'}
          </h2>
          <p className="text-[11px] font-body text-[var(--text-muted)] m-0 truncate">
            {view === 'create_group'
              ? (parentGroupId ? 'Create nested community topic' : 'Create conversation for multiple people')
              : `${contacts.length} contacts available`}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 mx-3.5 mt-2 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-body animate-fadeIn">
          {error}
        </div>
      )}

      {/* ── VIEW 1: Main New Chat List ──────────────────────────────── */}
      {view === 'list' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {/* Action Row: Create Group / Subgroup */}
          <div className="p-3 border-b border-[var(--border-subtle)] space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setParentGroupId('');
                setView('create_group');
                setError(null);
              }}
              className="w-full p-2.5 rounded-xl bg-[var(--bg-tertiary)]/70 hover:bg-[var(--accent-subtle)] border border-[var(--border)] flex items-center gap-3 cursor-pointer transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-highlight)] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Users size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[var(--text-primary)]">New Group</div>
                <div className="text-xs text-[var(--text-muted)] font-body">Connect multiple friends or team</div>
              </div>
            </button>

            {availableParentGroups.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setParentGroupId(availableParentGroups[0]?.id || '');
                  setView('create_group');
                  setError(null);
                }}
                className="w-full p-2.5 rounded-xl bg-[var(--bg-tertiary)]/70 hover:bg-[var(--accent-subtle)] border border-[var(--border)] flex items-center gap-3 cursor-pointer transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center shrink-0 shadow-sm">
                  <Hash size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[var(--text-primary)]">New Subgroup</div>
                  <div className="text-xs text-[var(--text-muted)] font-body">Create topic channel inside a group</div>
                </div>
              </button>
            )}
          </div>

          {/* Search Input Bar */}
          <div className="p-3 pb-2">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                placeholder="Search registered user @handle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-chat text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* User Search Results Feed */}
          {search.trim() ? (
            <div className="px-2 py-1 flex-1 overflow-y-auto">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Search Results
              </div>
              {isSearching ? (
                <div className="flex items-center justify-center py-8 text-xs text-[var(--text-muted)] gap-2">
                  <Loader2 size={16} className="animate-spin text-[var(--accent)]" /> Searching directory...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((u) => (
                  <button
                    key={u.id || u._id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className="w-full p-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between cursor-pointer border-none bg-transparent text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} src={u.avatar} size="md" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--text-primary)] truncate">{u.name}</div>
                        <div className="text-xs text-[var(--text-muted)] font-chat truncate">
                          @{u.primaryUsername || u.username}
                        </div>
                      </div>
                    </div>
                    <span className="btn-cta-vibrant px-3 py-1 rounded-lg text-xs font-bold shrink-0">
                      Chat
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-[var(--text-muted)] font-body">
                  No users found matching &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          ) : (
            /* Existing Contacts List */
            <div className="px-2 py-1 flex-1 overflow-y-auto">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Your Contacts ({contacts.length})
              </div>
              {contacts.length === 0 ? (
                <div className="text-center py-8 px-4 text-xs text-[var(--text-muted)] font-body">
                  Type a username above to start your first conversation.
                </div>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onStartDirectChat?.(c);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-3 cursor-pointer border-none bg-transparent text-left"
                  >
                    <Avatar name={c.name} src={c.avatar} size="md" status={c.status || 'offline'} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[var(--text-primary)] truncate">{c.name}</div>
                      <div className="text-xs text-[var(--text-muted)] font-chat truncate">
                        @{c.username || c.primaryUsername}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: Create Group / Subgroup Form ─────────────────────── */}
      {view === 'create_group' && (
        <form onSubmit={handleCreateGroupSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
              Group Type & Hierarchy
            </label>
            <select
              value={parentGroupId}
              onChange={(e) => setParentGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] cursor-pointer"
            >
              <option value="">None (Top-Level Group)</option>
              {availableParentGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  Subgroup of #{g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
              {parentGroupId ? 'Subgroup Topic Name *' : 'Group Name *'}
            </label>
            <input
              type="text"
              required
              placeholder={parentGroupId ? 'e.g. Announcements, Frontend, Random' : 'e.g. Project Alpha, Design Squad'}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-chat text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
              Description (optional)
            </label>
            <textarea
              rows={2}
              placeholder="What is this group/topic about?"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-chat text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none"
            />
          </div>

          {/* Member Selection from contacts */}
          {contacts.length > 0 && (
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1.5">
                Add Members ({selectedMembers.length} selected)
              </label>
              <div className="max-h-40 overflow-y-auto custom-scrollbar p-1 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] space-y-1">
                {contacts.map((c) => {
                  const uname = c.username || c.primaryUsername;
                  const isSelected = selectedMembers.includes(uname);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleSelectMemberForGroup(uname)}
                      className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={c.name} src={c.avatar} size="sm" />
                        <span className="text-xs font-bold truncate">{c.name}</span>
                        <span className="text-[11px] text-[var(--text-muted)] font-chat truncate">@{uname}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          isSelected
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                            : 'border-[var(--border)] bg-transparent'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto pt-2">
            <button
              type="submit"
              disabled={!groupName.trim() || isSubmitting}
              className="btn-cta-vibrant w-full py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer border-none disabled:opacity-50 flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              <span>{parentGroupId ? 'Create Subgroup' : 'Create Group'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default NewChatPanel;
