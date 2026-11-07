import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  MessageSquare,
  Search,
  Phone,
  Video,
  Info,
  X,
  Hash,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import MessageBubble from './MessageBubble';
import Composer from './Composer';
import GroupInfoPanel from './GroupInfoPanel';
import CallModal from '../modals/CallModal';
import { MessageFeedSkeleton } from '../ui/Skeleton';
import useThemeStore from '../../store/themeStore';
import { playSentSound, playReactionSound } from '../../utils/zyntraSound';
import BrandLogo from '../ui/BrandLogo';

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

export const ChatArea = ({
  chat,
  messages = [],
  isLoadingMessages = false,
  currentUser,
  typingUsers = [],
  workspaces = [],
  onOpenWorkspaceModal,
  onSelectWorkspace,
  onBack,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  onLeaveChat,
}) => {
  const scrollRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Search & Drawer & Calls state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);

  const { soundEnabled } = useThemeStore();

  const workspace = chat?.type === 'channel'
    ? workspaces.find((w) => w.name === chat.workspaceName)
    : null;
  const policy = workspace?.settings || { allowEmojis: true, allowAttachments: true };

  // Filter messages if search is active
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.content?.toLowerCase().includes(q) ||
        m.senderName?.toLowerCase().includes(q) ||
        m.attachment?.name?.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = null;

    filteredMessages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp).toDateString();
      if (msgDate !== lastDate) {
        groups.push({ type: 'date', date: formatDate(msg.timestamp), id: `date-${msgDate}` });
        lastDate = msgDate;
      }
      groups.push({ type: 'message', data: msg, id: msg.id });
    });

    return groups;
  }, [filteredMessages]);

  // Scroll to bottom on messages update
  useEffect(() => {
    if (scrollRef.current && !searchQuery.trim()) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, searchQuery]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 180);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleSendWrapper = (content, attachment) => {
    if (soundEnabled) playSentSound();
    onSend?.(content, attachment);
  };

  const handleReactionWrapper = (msgId, emoji) => {
    if (soundEnabled) playReactionSound();
    onReaction?.(msgId, emoji);
  };

  // If no conversation is active (Workspace Dashboard)
  if (!chat) {
    return (
      <div style={{ display: 'flex', flex: '1 1 0%', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', backgroundColor: 'var(--bg-primary)', textAlign: 'center', overflowY: 'auto' }}>
        <BrandLogo variant="lockup" size="xl" className="mb-3" />
        <p className="text-xs font-body text-[var(--text-muted)] max-w-sm leading-relaxed mb-6">
          Select a room or contact from the sidebar, or jump straight into a team workspace below.
        </p>

        <div className="w-full max-w-xl text-left">
          <div className="flex items-center justify-between mb-2.5 px-1 font-heading">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Workspaces
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">
              {workspaces.length} active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-heading">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => onSelectWorkspace ? onSelectWorkspace(ws) : onOpenWorkspaceModal?.()}
                className="p-3.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl flex flex-col items-start hover:border-[var(--border-focus)] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 mb-1.5 w-full">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
                    {ws.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] m-0 truncate group-hover:text-[var(--accent)] transition-colors">
                      {ws.name}
                    </h4>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {ws.membersCount || ws.memberCount || 1} members · {ws.nodes?.length || 1} channels
                    </span>
                  </div>
                </div>
                <p className="text-[11px] font-body text-[var(--text-secondary)] line-clamp-2 mt-0.5 mb-0">
                  {ws.description || 'Open workspace channels to start messaging.'}
                </p>
              </div>
            ))}

            <button
              onClick={onOpenWorkspaceModal}
              className="p-3.5 border border-dashed border-[var(--border)] rounded-xl flex items-center justify-center gap-2 hover:border-[var(--border-focus)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-transparent font-heading"
            >
              <span className="text-xs font-semibold">+ Join or Create Workspace</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentUserId = currentUser?.id || currentUser?._id;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 0%', height: '100%', minHeight: 0, overflow: 'hidden', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
      {/* ── Main Chat Stream Column ─────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {/* ── Chat Header ────────────────────────────────────────────── */}
        <header className="h-13 min-h-[52px] px-3 sm:px-4 bg-[var(--bg-primary)] border-b border-[var(--border)] flex items-center justify-between shrink-0 z-10 select-none">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            {/* Back button (Mobile only) */}
            <button
              type="button"
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Conversation Avatar / Channel Icon */}
            {chat.type === 'channel' ? (
              <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0 font-heading">
                <Hash size={16} />
              </div>
            ) : (
              <Avatar
                name={chat.name}
                src={chat.avatar}
                size="sm"
                status={chat.status || 'online'}
              />
            )}

            {/* Title & Status */}
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setInfoOpen(!infoOpen)}>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-heading font-semibold text-[var(--text-primary)] truncate tracking-tight m-0">
                  {chat.name}
                </h2>
              </div>
              <div className="text-[10px] font-body text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                {chat.membersCount ? (
                  <span>{chat.membersCount} members · {chat.workspaceName || 'Channel'}</span>
                ) : chat.status === 'online' ? (
                  <span className="text-[var(--online)] flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--online)] inline-block" /> Online
                  </span>
                ) : (
                  <span>Direct Room</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar on Right */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Search Input Popover */}
            {searchOpen ? (
              <div className="flex items-center gap-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-2 py-1 mr-1">
                <Search size={13} className="text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Find in chat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-28 sm:w-40 bg-transparent border-none outline-none text-xs font-body text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                title="Search Messages"
                aria-label="Search Messages"
              >
                <Search size={16} />
              </button>
            )}

            {/* Voice Call */}
            <button
              type="button"
              onClick={() => {
                setIsVideoCall(false);
                setCallModalOpen(true);
              }}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
              title="Voice Call"
              aria-label="Voice Call"
            >
              <Phone size={16} />
            </button>

            {/* Video Call */}
            <button
              type="button"
              onClick={() => {
                setIsVideoCall(true);
                setCallModalOpen(true);
              }}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
              title="Video Call"
              aria-label="Video Call"
            >
              <Video size={16} />
            </button>

            {/* Toggle Info Drawer */}
            <button
              type="button"
              onClick={() => setInfoOpen(!infoOpen)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer border-none flex items-center justify-center ${
                infoOpen
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] bg-transparent'
              }`}
              title="Room Details"
              aria-label="Room Details"
            >
              <Info size={16} />
            </button>
          </div>
        </header>

        {/* ── Message Feed ────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-4 flex flex-col relative bg-[var(--bg-primary)] font-body"
        >
          {isLoadingMessages ? (
            <MessageFeedSkeleton count={6} />
          ) : groupedMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none my-auto">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center mb-2">
                <MessageSquare size={18} />
              </div>
              <div className="text-xs font-heading font-semibold text-[var(--text-primary)] mb-0.5">
                {searchQuery ? 'No matching messages' : 'No messages yet'}
              </div>
              <p className="text-[11px] font-body text-[var(--text-muted)] max-w-xs">
                {searchQuery ? `No results found for "${searchQuery}"` : 'Send a message to start the conversation.'}
              </p>
            </div>
          ) : (
            groupedMessages.map((item) => {
              if (item.type === 'date') {
                return (
                  <div key={item.id} className="flex items-center justify-center my-3 select-none">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-medium text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                      {item.date}
                    </span>
                  </div>
                );
              }

              const msg = item.data;
              const isOwn = Boolean(
                (currentUserId && msg.senderId && msg.senderId === currentUserId) ||
                (currentUser?.primaryUsername &&
                 msg.senderUsername &&
                 msg.senderUsername.toLowerCase() === currentUser.primaryUsername.toLowerCase())
              );

              return (
                <MessageBubble
                  key={item.id}
                  message={msg}
                  isOwn={isOwn}
                  currentUserId={currentUserId}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                  onReaction={handleReactionWrapper}
                />
              );
            })
          )}

          {/* Real-time Typing indicator banner */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-body text-[var(--text-muted)] italic px-2 py-1 mt-1 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span>{typingUsers.join(', ')} typing...</span>
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-16 right-5 w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center shadow-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer z-20"
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* ── Message Composer ────────────────────────────────────────── */}
        <Composer
          chatId={chat.id}
          currentUser={currentUser}
          onSend={handleSendWrapper}
          policy={policy}
        />
      </div>

      {/* ── Right-Side Details Drawer (Responsive Mobile Slide-Over) ── */}
      {infoOpen && (
        <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-20 flex">
          <div
            className="fixed inset-0 bg-black/60 md:hidden backdrop-blur-xs"
            onClick={() => setInfoOpen(false)}
          />
          <div className="relative w-full max-w-[320px] sm:max-w-xs md:w-80 h-full ml-auto z-10 shadow-xl">
            <GroupInfoPanel
              chat={chat}
              onClose={() => setInfoOpen(false)}
              onLeaveChat={onLeaveChat}
            />
          </div>
        </div>
      )}

      {/* ── Voice & Video Call Modal ────────────────────────────────── */}
      <CallModal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        chat={chat}
        isVideo={isVideoCall}
      />
    </div>
  );
};

export default ChatArea;
