import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Users,
  Building2,
  Moon,
  Sun,
  Settings,
  LogOut,
  MessageSquarePlus,
  Hash,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Megaphone,
  BellOff,
  Trash2,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import api from '../../api/api';
import useThemeStore from '../../store/themeStore';
import useChatStore from '../../store/chatStore';
import CreateChannelModal from '../modals/CreateChannelModal';
import { ChatListSkeleton } from '../ui/Skeleton';
import BrandLogo from '../ui/BrandLogo';

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const Sidebar = ({
  contacts = [],
  groups = [],
  workspaces = [],
  isLoadingChats = false,
  activeChat,
  currentUser,
  selectedWorkspace,
  onSelectChat,
  onOpenNewChat,
  onOpenWorkspaceModal,
  onOpenSettings,
  onLogout,
  onAddChannel,
}) => {
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'workplace'
  const [search, setSearch] = useState('');
  const [activeWorkspaceIndex, setActiveWorkspaceIndex] = useState(0);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);

  const handleOpenCreateChannel = () => {
    window.history.pushState({ chatroomsModal: 'createChannel' }, '');
    setCreateChannelModalOpen(true);
  };
  const handleCloseCreateChannel = () => {
    if (window.history.state?.chatroomsModal === 'createChannel') {
      window.history.back();
    } else {
      setCreateChannelModalOpen(false);
    }
  };

  React.useEffect(() => {
    if (!createChannelModalOpen) return;
    const handlePop = () => setCreateChannelModalOpen(false);
    window.addEventListener('popstate', handlePop, { once: true });
    return () => window.removeEventListener('popstate', handlePop);
  }, [createChannelModalOpen]);
  const [expandedFolders, setExpandedFolders] = useState({
    'Computer Science & Eng': true,
    'Computer Science / AI & ML': true,
    'Computer Science': true,
    Engineering: true,
  });
  const [expandedGroups, setExpandedGroups] = useState({});
  const [copiedWsCode, setCopiedWsCode] = useState(false);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  // Search registered users directory when typing in search bar
  React.useEffect(() => {
    const q = search.trim().replace(/^@/, '');
    if (!q || q.length < 2) {
      setGlobalUsers([]);
      setIsSearchingGlobal(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        const res = await api.contacts.search(q);
        if (res.ok) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.users || []);
          const existingIds = new Set(contacts.map((c) => (c.userId || c.id || '').toString().toLowerCase()));
          const existingUnames = new Set(contacts.map((c) => (c.username || c.primaryUsername || '').toLowerCase().replace(/^@/, '')));
          const filtered = raw.filter((u) => {
            const uid = (u._id || u.id || '').toString().toLowerCase();
            const uname = (u.primaryUsername || u.username || '').toLowerCase().replace(/^@/, '');
            const isMe = (currentUser?._id && uid === currentUser._id.toString().toLowerCase()) ||
              (currentUser?.primaryUsername && uname === currentUser.primaryUsername.toLowerCase().replace(/^@/, ''));
            return !isMe && !existingIds.has(uid) && !existingUnames.has(uname);
          });
          setGlobalUsers(filtered);
        } else {
          setGlobalUsers([]);
        }
      } catch {
        setGlobalUsers([]);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, contacts, currentUser]);

  const handleStartChatWithGlobalUser = async (u) => {
    try {
      const username = u.primaryUsername || u.username;
      const res = await useChatStore.getState().addContact(username);
      if (res.success && res.contact) {
        onSelectChat(res.contact);
        setSearch('');
      } else {
        const myUname = (currentUser?.primaryUsername || '').toLowerCase().replace(/^@/, '');
        const targetUname = (username || '').toLowerCase().replace(/^@/, '');
        const dmId = 'dm_' + [myUname, targetUname].sort().join('_');
        const fallback = {
          id: dmId,
          userId: u._id || u.id,
          username: targetUname,
          name: u.name || targetUname,
          avatar: u.avatar || null,
          status: u.status || 'online',
          type: 'contact',
        };
        onSelectChat(fallback);
        setSearch('');
      }
    } catch (e) {
      console.warn('Error starting chat with user:', e);
    }
  };

  const { theme, toggleTheme } = useThemeStore();
  const { typingStatus = {}, onlineUsers = [], isChatMuted, unreadCounts = {}, getUnreadCount } = useChatStore();

  // Sync selected workspace from external selection
  React.useEffect(() => {
    if (selectedWorkspace) {
      const idx = workspaces.findIndex((w) => w.id === selectedWorkspace.id || w.name === selectedWorkspace.name);
      if (idx !== -1) {
        setActiveWorkspaceIndex(idx);
        setActiveTab('workplace');
      }
    }
  }, [selectedWorkspace, workspaces]);

  // Sync activeChat when channel is chosen
  React.useEffect(() => {
    if (activeChat?.type === 'channel' && activeChat.workspaceName) {
      setActiveTab('workplace');
      const idx = workspaces.findIndex((w) => w.name === activeChat.workspaceName);
      if (idx !== -1) setActiveWorkspaceIndex(idx);
    }
  }, [activeChat, workspaces]);

  const currentWorkspace = workspaces[activeWorkspaceIndex] || workspaces[0];

  // Filter direct contacts + groups
  const directList = useMemo(() => {
    const list = [
      ...contacts.map((c) => ({ ...c, type: 'contact' })),
      ...groups.map((g) => ({ ...g, type: 'group' })),
    ];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.username?.toLowerCase().includes(q) ||
        item.lastMessage?.toLowerCase().includes(q)
    );
  }, [contacts, groups, search]);

  // Separate root groups and nested subgroups
  const { rootGroups, subgroupsMap } = useMemo(() => {
    const groupItems = directList.filter((i) => i.type === 'group');
    const root = [];
    const subMap = {};
    const groupIds = new Set(groupItems.map((g) => g.id));

    groupItems.forEach((g) => {
      if (g.parentGroupId && groupIds.has(g.parentGroupId)) {
        if (!subMap[g.parentGroupId]) subMap[g.parentGroupId] = [];
        subMap[g.parentGroupId].push(g);
      } else {
        root.push(g);
      }
    });

    return { rootGroups: root, subgroupsMap: subMap };
  }, [directList]);

  // Auto-expand parent group if activeChat is a subgroup
  React.useEffect(() => {
    if (activeChat?.parentGroupId) {
      setExpandedGroups((prev) => ({ ...prev, [activeChat.parentGroupId]: true }));
    }
  }, [activeChat?.parentGroupId]);

  const toggleGroupExpand = (groupId, e) => {
    e?.stopPropagation();
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: prev[groupId] === false ? true : false,
    }));
  };

  // Group workspace channels by folder
  const groupedWorkspaceChannels = useMemo(() => {
    if (!currentWorkspace) return { root: [], folders: {} };
    let nodes = currentWorkspace.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      nodes = [
        {
          id: currentWorkspace.defaultNodeId || `chan-general-${currentWorkspace.id || 'ws'}`,
          name: 'general',
          rawName: 'general',
          membersCount: currentWorkspace.membersCount || currentWorkspace.memberCount || 1,
          folder: null,
          isAnnouncement: false,
        },
      ];
    }
    const q = search.trim().toLowerCase();

    const root = [];
    const folders = {};

    nodes.forEach((n) => {
      const cleanName = (n.name || 'general').replace(/^#/, '');
      if (q && !cleanName.toLowerCase().includes(q) && !(n.folder && n.folder.toLowerCase().includes(q))) {
        return;
      }

      const item = {
        id: n.id,
        name: `#${cleanName}`,
        rawName: cleanName,
        workspaceName: currentWorkspace.name,
        type: 'channel',
        avatar: null,
        membersCount: n.membersCount || currentWorkspace.membersCount || 1,
        isAnnouncement: Boolean(n.isAnnouncement),
        joinCode: currentWorkspace.joinCode,
      };

      if (!n.folder) {
        root.push(item);
      } else {
        if (!folders[n.folder]) folders[n.folder] = [];
        folders[n.folder].push(item);
      }
    });

    return { root, folders };
  }, [currentWorkspace, search]);

  const toggleFolder = (folderName) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    if (code) {
      navigator.clipboard?.writeText(code);
      setCopiedWsCode(true);
      setTimeout(() => setCopiedWsCode(false), 2000);
    }
  };

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      {/* ── Top Brand Header (ChatRooms Horizontal Lockup) ───────────── */}
      <div className="h-16 sm:h-17 px-4 flex items-center justify-between border-b border-[var(--border)] shrink-0 select-none pt-[env(safe-area-inset-top)]">
        <div className="flex items-center">
          <BrandLogo variant="lockup" size="md" />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* ── Tabs (Direct vs Workplace) ─────────────────────────────── */}
      <div className="px-3.5 pt-3 pb-2 flex items-center gap-2 shrink-0 select-none font-heading">
        <button
          type="button"
          onClick={() => setActiveTab('direct')}
          className={`flex-1 py-2 px-3 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-2 ${
            activeTab === 'direct'
              ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
              : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <Users size={16} />
          <span>Chats</span>
          <span className={`ml-0.5 text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'direct' ? 'bg-white/25 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>
            {directList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workplace')}
          className={`flex-1 py-2 px-3 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-2 ${
            activeTab === 'workplace'
              ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
              : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <Building2 size={16} />
          <span>Workplaces</span>
          <span className={`ml-0.5 text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'workplace' ? 'bg-white/25 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>
            {workspaces.length}
          </span>
        </button>
      </div>

      {/* ── Workplace Switcher Header (When in Workplaces Tab) ──────── */}
      {activeTab === 'workplace' && currentWorkspace && (
        <div className="px-3 py-1.5 shrink-0 select-none relative font-heading">
          <div
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="p-2 rounded-xl bg-[var(--bg-tertiary)]/70 backdrop-blur-md border border-[var(--border)] flex items-center justify-between cursor-pointer hover:border-[var(--border-focus)] transition-colors shadow-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
                {currentWorkspace.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate flex items-center gap-1">
                  <span>{currentWorkspace.name}</span>
                  <ChevronDown size={12} className="text-[var(--text-muted)] shrink-0" />
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">
                  Code: {currentWorkspace.joinCode || 'WS-001'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => handleCopyCode(e, currentWorkspace.joinCode || 'WS-001')}
              className="p-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
              title="Copy Workplace Code"
              aria-label="Copy code"
            >
              {copiedWsCode ? <Check size={11} className="text-[var(--accent)]" /> : <Copy size={11} />}
            </button>
          </div>

          {/* Switcher Dropdown */}
          {workspaceDropdownOpen && (
            <div className="absolute top-full left-3 right-3 mt-1 p-1 bg-[var(--bg-secondary)]/95 backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-xl z-30 space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2 py-1 block">
                Workspaces
              </span>
              {workspaces.map((ws, idx) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspaceIndex(idx);
                    setWorkspaceDropdownOpen(false);
                  }}
                  className={`w-full p-2 rounded-lg text-left flex items-center justify-between cursor-pointer border-none transition-colors ${
                    activeWorkspaceIndex === idx
                      ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-xs font-semibold truncate">{ws.name}</span>
                  <span className="text-[10px] opacity-80">{ws.nodes?.length || 1} channels</span>
                </button>
              ))}

              <div className="pt-1 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceDropdownOpen(false);
                    onOpenWorkspaceModal?.();
                  }}
                  className="w-full py-1.5 px-2 bg-transparent hover:bg-[var(--bg-hover)] text-[var(--accent)] text-xs font-semibold rounded-lg cursor-pointer border-none flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  <span>Join or Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Search Input ────────────────────────────────────────────── */}
      <div className="px-3.5 py-1.5 shrink-0">
        <div className="relative flex items-center">
          <Search size={17} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
          <input
            id="sidebar-conversations-search"
            name="conversationsSearch"
            type="text"
            aria-label={activeTab === 'direct' ? 'Search conversations' : 'Search channels'}
            placeholder={activeTab === 'direct' ? 'Search conversations...' : 'Search channels...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)]/70 backdrop-blur-md border border-[var(--border)] rounded-xl text-sm sm:text-base font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors shadow-xs"
          />
        </div>
      </div>

      {/* ── Action Buttons ──────────────────────────────────────────── */}
      <div className="px-3.5 py-1.5 flex items-center gap-2 shrink-0 font-heading">
        {activeTab === 'direct' ? (
          <button
            type="button"
            onClick={onOpenNewChat}
            className="btn-cta-vibrant w-full py-2.5 px-3.5 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border-none active:scale-[0.98]"
          >
            <MessageSquarePlus size={16} />
            <span>New Chat</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleOpenCreateChannel}
              className="btn-cta-vibrant flex-1 py-2.5 px-3.5 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border-none active:scale-[0.98]"
            >
              <Hash size={16} />
              <span>Create Channel</span>
            </button>
            <button
              type="button"
              onClick={onOpenWorkspaceModal}
              className="py-2.5 px-3 bg-[var(--bg-tertiary)]/70 hover:border-[var(--accent-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-xl text-sm font-bold transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              title="Add or Join Workplace"
              aria-label="Add workplace"
            >
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Conversation List Feed ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-1 space-y-0.5">
        {isLoadingChats && directList.length === 0 ? (
          <ChatListSkeleton count={6} />
        ) : activeTab === 'direct' ? (
          directList.length === 0 ? (
            <div className="text-center py-6 px-4 text-[var(--text-muted)] text-xs font-body">
              {search.trim() ? (
                <>
                  <p className="font-heading font-semibold mb-1 text-[var(--text-secondary)]">No conversations matching &ldquo;{search}&rdquo;</p>
                  {search.trim().length >= 2 ? (
                    <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] text-left">
                      <div className="px-1 py-1 flex items-center justify-between font-heading">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                          Directory Users {globalUsers.length > 0 ? `(${globalUsers.length})` : ''}
                        </span>
                        {isSearchingGlobal && (
                          <span className="text-[10px] text-[var(--text-muted)] animate-pulse">Searching directory...</span>
                        )}
                      </div>
                      {globalUsers.length > 0 ? (
                        <div className="space-y-1 mt-1">
                          {globalUsers.map((u) => (
                            <button
                              key={u.id || u._id}
                              type="button"
                              onClick={() => handleStartChatWithGlobalUser(u)}
                              className="group w-full p-2.5 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-all flex items-center justify-between gap-3 cursor-pointer border-none bg-transparent text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar name={u.name} src={u.avatar} size="md" status={u.status || 'online'} />
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
                          ))}
                        </div>
                      ) : !isSearchingGlobal && (
                        <div className="text-center py-4 text-xs text-[var(--text-muted)]">
                          No registered user found matching &ldquo;{search}&rdquo;
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>Type at least 2 characters to search directory users.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-heading font-semibold mb-1 text-[var(--text-secondary)]">No conversations found</p>
                  <p>Click &ldquo;New Chat&rdquo; to start a conversation.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {directList.filter((i) => i.type === 'contact').length > 0 && (
                <div className="pt-2 pb-1 px-2 font-heading">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Direct Rooms
                  </span>
                </div>
              )}
              {directList
                .filter((i) => i.type === 'contact')
                .map((item) => {
                  const isActive = activeChat?.id === item.id;
                  const uid = (item.userId || item.id || '').toString().toLowerCase();
                  const uname = (item.username || item.primaryUsername || '').toLowerCase().replace(/^@/, '');
                  const isContactOnline = Boolean(
                    (onlineUsers && (onlineUsers.includes(uid) || onlineUsers.includes(uname))) ||
                    item.status === 'online' ||
                    item.online === true
                  );

                  const typers = typingStatus[item.id] || [];
                  const isTyping = typers.length > 0;
                  const unreadCount = getUnreadCount ? getUnreadCount(item.id, item) : (unreadCounts[item.id] || 0);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectChat(item)}
                      className={`group w-full p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer border-none text-left relative ${
                        isActive
                          ? 'bg-[var(--accent-highlight-subtle)] text-[var(--text-primary)] border-l-4 border-[var(--accent-highlight)] pl-2.5 shadow-sm'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Avatar name={item.name} src={item.avatar} size="md" status={isContactOnline ? 'online' : 'offline'} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-sm sm:text-base truncate font-heading font-bold text-[var(--text-primary)]">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isChatMuted?.(item.id) && (
                              <BellOff size={13} className="text-[var(--accent-highlight)] shrink-0" title="Muted" />
                            )}
                            {item.lastMessageTime && (
                              <span className="text-xs sm:text-[13px] font-chat text-[var(--text-muted)] font-normal">
                                {formatTime(item.lastMessageTime)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete conversation with ${item.name}?`)) {
                                  useChatStore.getState().deleteChat(item.id, item);
                                }
                              }}
                              className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/15 transition-opacity shrink-0 border-none bg-transparent cursor-pointer"
                              title="Delete conversation"
                              aria-label="Delete conversation"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-0.5">
                          {isTyping ? (
                            <p className="text-[13px] sm:text-sm font-chat text-[var(--accent)] truncate m-0 leading-tight italic flex items-center gap-1 animate-pulse min-w-0 flex-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> typing...
                            </p>
                          ) : (
                            <p className="text-[13px] sm:text-sm font-chat text-[var(--text-muted)] truncate m-0 leading-normal min-w-0 flex-1">
                              {item.lastMessage || (
                                isContactOnline ? 'Active now' : (
                                  <span>
                                    Connected on{' '}
                                    <span
                                      className="font-brand font-normal text-[1.05em] text-[var(--text-secondary)]"
                                      style={{ fontFamily: "'Lakki Reddy', cursive" }}
                                    >
                                      ChatRooms
                                    </span>
                                  </span>
                                )
                              )}
                            </p>
                          )}
                          {unreadCount > 0 && (
                            <span className="bg-[#25D366] text-black text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0 shadow-sm">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

              {rootGroups.length > 0 && (
                <div className="pt-3 pb-1 px-2 font-heading">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Groups & Subgroups
                  </span>
                </div>
              )}
              {rootGroups.map((item) => {
                const isActive = activeChat?.id === item.id;
                const typers = typingStatus[item.id] || [];
                const isTyping = typers.length > 0;
                const subgroups = subgroupsMap[item.id] || [];
                const hasSubgroups = subgroups.length > 0;
                const isExpanded = expandedGroups[item.id] !== false;
                const unreadCount = getUnreadCount ? getUnreadCount(item.id, item) : (unreadCounts[item.id] || 0);

                return (
                  <div key={item.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => onSelectChat(item)}
                      className={`group w-full p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer border-none text-left relative ${
                        isActive
                          ? 'bg-[var(--accent-highlight-subtle)] text-[var(--text-primary)] border-l-4 border-[var(--accent-highlight)] pl-2.5 shadow-sm'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Avatar name={item.name} src={item.avatar} size="md" status={null} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-sm sm:text-base truncate font-heading font-bold text-[var(--text-primary)]">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isChatMuted?.(item.id) && (
                              <BellOff size={13} className="text-[var(--accent-highlight)] shrink-0" title="Muted" />
                            )}
                            {item.lastMessageTime && (
                              <span className="text-xs sm:text-[13px] font-chat text-[var(--text-muted)] font-normal">
                                {formatTime(item.lastMessageTime)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete or leave group ${item.name}?`)) {
                                  useChatStore.getState().removeChat(item.id, 'delete');
                                }
                              }}
                              className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/15 transition-opacity shrink-0 border-none bg-transparent cursor-pointer"
                              title="Delete group"
                              aria-label="Delete group"
                            >
                              <Trash2 size={13} />
                            </button>
                            {hasSubgroups && (
                              <button
                                type="button"
                                onClick={(e) => toggleGroupExpand(item.id, e)}
                                className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer ml-0.5"
                                title={isExpanded ? 'Collapse subgroups' : 'Expand subgroups'}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                          </div>
                        </div>
                        {isTyping ? (
                          <p className="text-[13px] sm:text-sm font-chat text-[var(--accent)] truncate m-0 leading-tight italic flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> typing...
                          </p>
                        ) : (
                          <div className="flex items-center justify-between gap-1.5 text-[13px] sm:text-sm font-chat text-[var(--text-muted)] mt-0.5">
                            <p className="truncate m-0 leading-normal min-w-0 flex-1">
                              {item.lastMessage || 'Active group conversation'}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasSubgroups && (
                                <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded-md">
                                  {subgroups.length} {subgroups.length === 1 ? 'subgroup' : 'subgroups'}
                                </span>
                              )}
                              {unreadCount > 0 && (
                                <span className="bg-[#25D366] text-black text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-sm">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Indented Subgroups List */}
                    {hasSubgroups && isExpanded && (
                      <div className="ml-6 pl-3 border-l-2 border-[var(--border)] flex flex-col gap-1 my-1">
                        {subgroups.map((sub) => {
                          const isSubActive = activeChat?.id === sub.id;
                          const subUnreadCount = getUnreadCount ? getUnreadCount(sub.id, sub) : (unreadCounts[sub.id] || 0);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => onSelectChat(sub)}
                              className={`group w-full p-2 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer border-none text-left ${
                                isSubActive
                                  ? 'bg-[var(--accent-highlight-subtle)] text-[var(--text-primary)] border-l-4 border-[var(--accent-highlight)] pl-2 shadow-xs'
                                  : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-6 h-6 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-subtle)] flex items-center justify-center font-bold text-xs shrink-0">
                                  #
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs sm:text-sm font-heading font-semibold text-[var(--text-primary)] truncate block">
                                      {sub.name}
                                    </span>
                                    {subUnreadCount > 0 && (
                                      <span className="bg-[#25D366] text-black text-[10px] font-bold rounded-full min-w-[18px] h-4.5 px-1 flex items-center justify-center shadow-sm shrink-0">
                                        {subUnreadCount > 99 ? '99+' : subUnreadCount}
                                      </span>
                                    )}
                                  </div>
                                  {sub.lastMessage && (
                                    <span className="text-[11px] font-chat text-[var(--text-muted)] truncate block mt-0.5">
                                      {sub.lastMessage}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete subgroup #${sub.name}?`)) {
                                    useChatStore.getState().removeChat(sub.id, 'delete');
                                  }
                                }}
                                className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/15 transition-opacity shrink-0 border-none bg-transparent cursor-pointer"
                                title="Delete subgroup"
                              >
                                <Trash2 size={12} />
                              </button>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Global Directory Search Results when searching ── */}
              {search.trim().length >= 2 && (
                <div className="mt-3 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="px-2 py-1 flex items-center justify-between font-heading">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      Directory Users {globalUsers.length > 0 ? `(${globalUsers.length})` : ''}
                    </span>
                    {isSearchingGlobal && (
                      <span className="text-[10px] text-[var(--text-muted)] animate-pulse">Searching directory...</span>
                    )}
                  </div>

                  {globalUsers.length > 0 ? (
                    <div className="space-y-1 mt-1">
                      {globalUsers.map((u) => (
                        <button
                          key={u.id || u._id}
                          type="button"
                          onClick={() => handleStartChatWithGlobalUser(u)}
                          className="group w-full p-2.5 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-all flex items-center justify-between gap-3 cursor-pointer border-none bg-transparent text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={u.name} src={u.avatar} size="md" status={u.status || 'online'} />
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
                      ))}
                    </div>
                  ) : !isSearchingGlobal && (
                    <div className="text-center py-2 text-xs text-[var(--text-muted)] font-body">
                      No additional users found
                    </div>
                  )}
                </div>
              )}
            </>
          )
        ) : workspaces.length === 0 ? (
          <div className="text-center py-8 px-4 text-[var(--text-muted)] text-xs font-body">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent)] flex items-center justify-center mx-auto mb-2">
              <Building2 size={16} />
            </div>
            <p className="font-heading font-semibold mb-1 text-[var(--text-primary)]">No Workspaces</p>
            <p className="mb-3 text-[var(--text-muted)]">Join an existing workspace or create one.</p>
            <button
              type="button"
              onClick={onOpenWorkspaceModal}
              className="py-1.5 px-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] text-xs font-heading font-bold rounded-lg border-none cursor-pointer"
            >
              Open Workspace Menu
            </button>
          </div>
        ) : (
          /* ── WORKPLACES CHANNELS TREE ────────────────────────────── */
          <div className="space-y-1 select-none pt-1 font-heading">
            {groupedWorkspaceChannels.root.length === 0 && Object.keys(groupedWorkspaceChannels.folders).length === 0 ? (
              <div className="text-center py-6 px-3 text-[var(--text-muted)] text-xs font-body">
                <p className="font-heading font-semibold mb-1 text-[var(--text-secondary)]">No channels found</p>
                <p className="text-[11px] mb-2.5">Create a channel in this workspace to get started.</p>
                <button
                  type="button"
                  onClick={handleOpenCreateChannel}
                  className="py-1.5 px-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-lg border-none cursor-pointer"
                >
                  + Create Channel
                </button>
              </div>
            ) : (
              <>
                {/* Root Channels */}
                {groupedWorkspaceChannels.root.map((channel) => {
                  const isActive = activeChat?.id === channel.id;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => onSelectChat(channel)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer border-none text-left ${
                        isActive
                          ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border-l-3 border-[var(--accent-highlight)] pl-2'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {channel.isAnnouncement ? (
                          <Megaphone size={14} className="text-[var(--accent-highlight)] shrink-0" />
                        ) : (
                          <Hash size={14} className={isActive ? 'text-[var(--accent)] shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
                        )}
                        <span className="text-sm sm:text-base font-medium truncate">{channel.rawName}</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] shrink-0">
                        {channel.membersCount}
                      </span>
                    </button>
                  );
                })}

                {/* Nested Folders & Categories */}
                {Object.entries(groupedWorkspaceChannels.folders).map(([folderName, folderChannels]) => {
                  const isExpanded = expandedFolders[folderName] !== false;
                  return (
                    <div key={folderName} className="space-y-0.5">
                      <div
                        onClick={() => toggleFolder(folderName)}
                        className="flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          <span className="truncate uppercase tracking-wider">{folderName}</span>
                        </div>
                        <span className="text-[9px] opacity-80">{folderChannels.length}</span>
                      </div>

                      {isExpanded && (
                        <div className="pl-3 space-y-0.5 border-l border-[var(--border)] ml-2.5 my-0.5">
                          {folderChannels.map((channel) => {
                            const isActive = activeChat?.id === channel.id;
                            return (
                              <button
                                key={channel.id}
                                type="button"
                                onClick={() => onSelectChat(channel)}
                                className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border-none text-left ${
                                  isActive
                                    ? 'bg-[var(--accent-highlight-subtle)] text-[var(--accent-highlight)] font-bold border-l-4 border-[var(--accent-highlight)] pl-2 shadow-xs'
                                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Hash size={14} className={isActive ? 'text-[var(--accent)] shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
                                  <span className="text-sm sm:text-base font-medium truncate">{channel.rawName}</span>
                                </div>
                                <span className="text-xs text-[var(--text-muted)] shrink-0">
                                  {channel.membersCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Current User Bar ────────────────────────────────── */}
      <div className="h-16 px-3.5 bg-[var(--bg-secondary)]/85 backdrop-blur-md border-t border-[var(--border)] flex items-center justify-between shrink-0 select-none pb-[env(safe-area-inset-bottom)]">
        <div
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Avatar
            name={currentUser?.name || 'User'}
            src={currentUser?.avatar}
            size="md"
            status="online"
          />
          <div className="min-w-0 font-heading">
            <div className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
              {currentUser?.name || 'User'}
            </div>
            <div className="text-xs sm:text-[13px] text-[var(--text-muted)] truncate">
              @{currentUser?.primaryUsername || 'user'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* ── Create Channel Modal ────────────────────────────────────── */}
      <CreateChannelModal
        isOpen={createChannelModalOpen}
        onClose={handleCloseCreateChannel}
        activeWorkspace={currentWorkspace}
        onAddChannel={onAddChannel}
      />
    </aside>
  );
};

export default Sidebar;
