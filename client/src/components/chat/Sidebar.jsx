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
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
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

  const { theme, toggleTheme } = useThemeStore();
  const { typingStatus = {}, onlineUsers = [], isChatMuted } = useChatStore();

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
      <div className="h-16 sm:h-17 px-4 flex items-center justify-between border-b border-[var(--border)] shrink-0 select-none">
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
            type="text"
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
        {isLoadingChats ? (
          <ChatListSkeleton count={6} />
        ) : activeTab === 'direct' ? (
          directList.length === 0 ? (
            <div className="text-center py-8 px-4 text-[var(--text-muted)] text-xs font-body">
              <p className="font-heading font-semibold mb-1 text-[var(--text-secondary)]">No conversations found</p>
              <p>Click &ldquo;New Chat&rdquo; to start a conversation.</p>
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

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectChat(item)}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer border-none text-left ${
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
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isChatMuted?.(item.id) && (
                              <BellOff size={13} className="text-[var(--accent-highlight)] shrink-0" title="Muted" />
                            )}
                            {item.lastMessageTime && (
                              <span className="text-xs sm:text-[13px] font-body text-[var(--text-muted)] font-normal">
                                {formatTime(item.lastMessageTime)}
                              </span>
                            )}
                          </div>
                        </div>
                        {isTyping ? (
                          <p className="text-[13px] sm:text-sm font-body text-[var(--accent)] truncate m-0 leading-tight italic flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> typing...
                          </p>
                        ) : (
                          <p className="text-[13px] sm:text-sm font-body text-[var(--text-muted)] truncate m-0 leading-normal">
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

                return (
                  <div key={item.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => onSelectChat(item)}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer border-none text-left ${
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
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isChatMuted?.(item.id) && (
                              <BellOff size={13} className="text-[var(--accent-highlight)] shrink-0" title="Muted" />
                            )}
                            {item.lastMessageTime && (
                              <span className="text-xs sm:text-[13px] font-body text-[var(--text-muted)] font-normal">
                                {formatTime(item.lastMessageTime)}
                              </span>
                            )}
                            {hasSubgroups && (
                              <button
                                type="button"
                                onClick={(e) => toggleGroupExpand(item.id, e)}
                                className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer ml-1"
                                title={isExpanded ? 'Collapse subgroups' : 'Expand subgroups'}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                          </div>
                        </div>
                        {isTyping ? (
                          <p className="text-[13px] sm:text-sm font-body text-[var(--accent)] truncate m-0 leading-tight italic flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> typing...
                          </p>
                        ) : (
                          <div className="flex items-center justify-between text-[13px] sm:text-sm font-body text-[var(--text-muted)]">
                            <p className="truncate m-0 leading-normal min-w-0 flex-1">
                              {item.lastMessage || 'Active group conversation'}
                            </p>
                            {hasSubgroups && (
                              <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded-md shrink-0 ml-1">
                                {subgroups.length} {subgroups.length === 1 ? 'subgroup' : 'subgroups'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Indented Subgroups List */}
                    {hasSubgroups && isExpanded && (
                      <div className="ml-6 pl-3 border-l-2 border-[var(--border)] flex flex-col gap-1 my-1">
                        {subgroups.map((sub) => {
                          const isSubActive = activeChat?.id === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => onSelectChat(sub)}
                              className={`w-full p-2 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer border-none text-left ${
                                isSubActive
                                  ? 'bg-[var(--accent-highlight-subtle)] text-[var(--text-primary)] border-l-4 border-[var(--accent-highlight)] pl-2 shadow-xs'
                                  : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-subtle)] flex items-center justify-center font-bold text-xs shrink-0">
                                #
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs sm:text-sm font-heading font-semibold text-[var(--text-primary)] truncate block">
                                  {sub.name}
                                </span>
                                {sub.lastMessage && (
                                  <span className="text-[11px] font-body text-[var(--text-muted)] truncate block">
                                    {sub.lastMessage}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
      <div className="h-16 px-3.5 bg-[var(--bg-secondary)]/85 backdrop-blur-md border-t border-[var(--border)] flex items-center justify-between shrink-0 select-none">
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
