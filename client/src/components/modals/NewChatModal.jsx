import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Search, Loader2 } from '../ui/Icons';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import api from '../../api/api';
import BrandLogo from '../ui/BrandLogo';

export const NewChatModal = ({ isOpen, onClose, onAddContact, onCreateGroup, onStartDirectChat }) => {
  const [activeTab, setActiveTab] = useState('contact'); // 'contact' | 'group'
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!search.trim() || activeTab !== 'contact') {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const cleanQuery = search.replace(/^@/, '').trim();
        const res = await api.contacts.search(cleanQuery);
        if (res.ok) {
          setSearchResults(Array.isArray(res.data) ? res.data : (res.data.users || []));
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, activeTab]);

  const handleSelectUser = async (user) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onAddContact(user.primaryUsername || user.username);
      if (res?.success) {
        onClose();
        if (res.contact) {
          onStartDirectChat?.(res.contact);
        }
      } else {
        setError(res?.error || 'Failed to add contact');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onCreateGroup(groupName.trim(), groupDesc.trim());
      if (res?.success) {
        onClose();
        setGroupName('');
        setGroupDesc('');
        if (res.group) {
          onStartDirectChat?.(res.group);
        }
      } else {
        setError(res?.error || 'Failed to create group');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const clean = joinCode.replace(/^@/, '').trim();
      const res = await onAddContact(clean);
      if (res?.success) {
        onClose();
        setJoinCode('');
        if (res.contact) {
          onStartDirectChat?.(res.contact);
        }
      } else {
        setError(res?.error || `Could not find chat or contact for "${clean}"`);
      }
    } catch {
      setError('An error occurred while joining');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BrandLogo variant="icon" size="sm" />
          <span>New Conversation</span>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl mb-4 font-heading">
        <button
          type="button"
          onClick={() => {
            setActiveTab('contact');
            setError(null);
          }}
          className={`shrink-0 flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
            activeTab === 'contact'
              ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
          }`}
        >
          <UserPlus size={14} />
          <span>Direct Contact</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('group');
            setError(null);
          }}
          className={`shrink-0 flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
            activeTab === 'group'
              ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
          }`}
        >
          <Users size={14} />
          <span>New Group</span>
        </button>
        
        <button
          type="button"
          onClick={() => {
            setActiveTab('join_group');
            setError(null);
          }}
          className={`shrink-0 flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
            activeTab === 'join_group'
              ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
          }`}
        >
          <Search size={14} />
          <span>Join Group</span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[var(--danger)] text-xs mb-3 font-body">
          {error}
        </div>
      )}

      {activeTab === 'contact' ? (
        <div className="flex flex-col gap-3 font-body">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by name or @username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              autoFocus
            />
          </div>

          {/* Search Result List */}
          <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1">
            {isSearching ? (
              <div className="flex items-center justify-center py-8 text-xs text-[var(--text-muted)] gap-2">
                <Loader2 size={16} /> Searching...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => (
                <div
                  key={user.id || user._id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={user.name} src={user.avatar} size="sm" />
                    <div className="min-w-0 font-heading">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {user.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        @{user.primaryUsername || user.username}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSelectUser(user)}
                    className="btn-cta-vibrant py-1 px-3.5 rounded-lg text-xs font-heading font-bold cursor-pointer border-none transition-transform active:scale-95"
                  >
                    Chat
                  </button>
                </div>
              ))
            ) : search.trim() ? (
              <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                No users found matching &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                Type a registered friend&apos;s username above to find them.
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'group' ? (
        <form onSubmit={handleCreateGroup} className="flex flex-col gap-3 font-heading">
          <div>
            <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Design Team or Project Room"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
              Description (optional)
            </label>
            <textarea
              rows={2}
              placeholder="What is this group about?"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!groupName.trim() || isSubmitting}
            className="btn-cta-vibrant w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 size={14} /> : <Users size={14} />}
            <span>Create Group</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoinGroup} className="flex flex-col gap-3 font-heading">
          <div>
            <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
              Group Invite Code or Friend's Handle *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. @priya_s or GRP-101"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!joinCode.trim() || isSubmitting}
            className="btn-cta-vibrant w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 size={14} /> : <Users size={14} />}
            <span>Join Group or Chat</span>
          </button>
        </form>
      )}
    </Modal>
  );
};

export default NewChatModal;
