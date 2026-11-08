import React, { useEffect, useState } from 'react';
import Sidebar from '../components/chat/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import NewChatModal from '../components/modals/NewChatModal';
import WorkspaceModal from '../components/modals/WorkspaceModal';
import SettingsModal from '../components/modals/SettingsModal';
import CallModal from '../components/modals/CallModal';
import IncomingCallModal from '../components/modals/IncomingCallModal';
import useChatStore from '../store/chatStore';
import useAuthStore from '../store/authStore';
import socketService from '../api/socket';
import { playReceivedSound } from '../utils/zyntraSound';
import notificationService from '../utils/notificationService';

export const ChatPage = () => {
  const { user, logout, updateProfile, promptWorkspaceOnLogin, setPromptWorkspaceOnLogin } = useAuthStore();
  const {
    activeChat,
    contacts,
    groups,
    workspaces,
    messages,
    typingStatus,
    onlineUsers,
    mutedChats,
    blockedUsers,
    isLoadingChats,
    isLoadingMessages,
    loadChats,
    loadMessages,
    selectChat,
    closeChat,
    sendMessage,
    receiveMessage,
    addReaction,
    updateReaction,
    editMessage,
    deleteMessage,
    addContact,
    createGroup,
    createWorkspace,
    joinWorkspace,
    addChannelToWorkspace,
    leaveWorkspace,
    setTyping,
    setOnlineUsersList,
    setUserStatus,
  } = useChatStore();

  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const bufferedIceCandidatesRef = React.useRef([]);

  // Automatically show workspace selection popup on login
  useEffect(() => {
    const prompted = sessionStorage.getItem('chatrooms_workspace_prompted');
    if (promptWorkspaceOnLogin || prompted !== 'true') {
      setWorkspaceModalOpen(true);
    }
  }, [promptWorkspaceOnLogin]);

  useEffect(() => {
    if (user) {
      socketService.registerUser(user);
    }
  }, [user]);

  useEffect(() => {
    loadChats();

    const handleReceive = (msg) => {
      if (!msg) return;
      const isMuted = (mutedChats || []).includes(msg.chatId);
      const isFromMe = (user?.id && msg.senderId === user.id) || (user?._id && msg.senderId === user._id);

      receiveMessage(msg);

      if (!isFromMe && !isMuted) {
        playReceivedSound();
        // Cross-platform native notifications on Android PWA & Windows Desktop
        if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
          notificationService.notifyMessage({
            title: msg.senderName || msg.senderUsername || 'ChatRooms',
            body:
              msg.type === 'call'
                ? msg.callDetails?.isVideo
                  ? '📹 Video Call'
                  : '📞 Voice Call'
                : msg.text || (msg.attachments?.length ? 'Sent an attachment' : 'New message'),
            chatId: msg.chatId,
            icon: '/android-chrome-192x192.png',
          });
        }
      }
    };
    const handleReaction = (msg) => updateReaction(msg);
    const handleTyping = ({ roomId, chatId, userName, isTyping }) => {
      const targetId = roomId || chatId;
      if (targetId) {
        setTyping(targetId, userName, isTyping);
      }
    };

    const handleUserStatus = (data) => {
      if (data && data.status) {
        setUserStatus(data.userId, data.username, data.status);
      }
    };

    const handleOnlineList = (list) => {
      if (Array.isArray(list)) {
        setOnlineUsersList(list);
      }
    };

    const handleConversationUpdate = () => {
      loadChats();
    };

    const handleIncomingCall = (callData) => {
      const myUsername = (user?.primaryUsername || '').toLowerCase().replace(/^@/, '');
      if (callData.from && (callData.from === myUsername || callData.from === user?.id)) return;

      // Auto-reject incoming call if caller is blocked
      const callerFrom = (callData.from || '').toLowerCase().replace(/^@/, '');
      const callerId = (callData.callerId || '').toString().toLowerCase();
      const isBlocked = (blockedUsers || []).some(
        (b) => b === callerFrom || b === callerId
      );
      if (isBlocked) {
        socketService.rejectCall({ target: callData.from, roomId: callData.roomId });
        return;
      }

      bufferedIceCandidatesRef.current = [];
      setIncomingCall(callData);

      // System notification when window is minimized or in background
      if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
        notificationService.notifyCall({
          callerName: callData.callerName || callData.from || 'Incoming Call',
          isVideo: callData.isVideo,
          chatId: callData.chatId || callData.roomId,
        });
      }
    };

    const handleGlobalIceCandidate = (data) => {
      if (data?.candidate) {
        bufferedIceCandidatesRef.current.push(data.candidate);
      }
    };

    const handleCallEndedGlobal = () => {
      setIncomingCall(null);
      setActiveCallSession(null);
      bufferedIceCandidatesRef.current = [];
    };

    socketService.on('receive_message', handleReceive);
    socketService.on('update_reaction', handleReaction);
    socketService.on('user_typing', handleTyping);
    socketService.on('user_status', handleUserStatus);
    socketService.on('online_users_list', handleOnlineList);
    socketService.on('contact_added', handleConversationUpdate);
    socketService.on('new_conversation', handleConversationUpdate);
    socketService.on('call_incoming', handleIncomingCall);
    socketService.on('ice_candidate', handleGlobalIceCandidate);
    socketService.on('call_ended', handleCallEndedGlobal);
    socketService.on('call_rejected', handleCallEndedGlobal);

    // Initial query for online presence
    socketService.getOnlineUsers();

    // Auto-sync on window focus & tab visibility (silent refresh)
    const handleFocusSync = () => {
      loadChats();
      socketService.getOnlineUsers();
      if (activeChat?.id) {
        loadMessages(activeChat.id, true);
      }
    };

    window.addEventListener('focus', handleFocusSync);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocusSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Background sync timer every 15s to guarantee 100% accuracy without manual refresh
    const syncInterval = setInterval(() => {
      loadChats();
      socketService.getOnlineUsers();
      if (activeChat?.id) {
        loadMessages(activeChat.id, true);
      }
    }, 15000);

    return () => {
      socketService.off('receive_message', handleReceive);
      socketService.off('update_reaction', handleReaction);
      socketService.off('user_typing', handleTyping);
      socketService.off('user_status', handleUserStatus);
      socketService.off('online_users_list', handleOnlineList);
      socketService.off('contact_added', handleConversationUpdate);
      socketService.off('new_conversation', handleConversationUpdate);
      socketService.off('call_incoming', handleIncomingCall);
      socketService.off('ice_candidate', handleGlobalIceCandidate);
      socketService.off('call_ended', handleCallEndedGlobal);
      socketService.off('call_rejected', handleCallEndedGlobal);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(syncInterval);
    };
  }, [loadChats, loadMessages, receiveMessage, updateReaction, setTyping, user?.id, user?.primaryUsername, activeChat?.id]);

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    setActiveCallSession({
      chat: {
        name: incomingCall.callerName || 'Participant',
        avatar: incomingCall.callerAvatar,
        id: incomingCall.chatId || incomingCall.from,
        username: incomingCall.callerUsername || incomingCall.from,
      },
      isVideo: incomingCall.isVideo,
      isInitiator: false,
      incomingSignal: incomingCall.signalData,
      callerInfo: incomingCall,
      initialIceCandidates: [...bufferedIceCandidatesRef.current],
    });
    setIncomingCall(null);
  };

  const handleCallEndedSummary = ({ chatId, targetUsername, isVideo, duration, status }) => {
    const targetChatId = chatId || activeChat?.id;
    if (!targetChatId) return;

    let readableTime = '';
    if (duration >= 3600) {
      const hrs = Math.floor(duration / 3600);
      const mins = Math.floor((duration % 3600) / 60);
      readableTime = hrs + ' hr ' + (mins > 0 ? mins + ' min' : '');
    } else if (duration >= 60) {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      readableTime = secs > 0 ? mins + 'm ' + secs + 's' : mins + ' mins';
    } else if (duration > 0) {
      readableTime = duration + 's';
    }

    let summaryText = '';
    if (status === 'missed') {
      summaryText = isVideo ? 'Missed video call' : 'Missed voice call';
    } else if (status === 'declined') {
      summaryText = isVideo ? 'Video call declined' : 'Voice call declined';
    } else {
      summaryText = isVideo
        ? 'Video call ended · ' + readableTime
        : 'Voice call ended · ' + readableTime;
    }

    sendMessage(targetChatId, summaryText, null, user, {
      type: 'call',
      callDetails: {
        isVideo: Boolean(isVideo),
        duration: duration || 0,
        status: status || 'ended',
      },
    });
  };

  const handleDeclineIncomingCall = () => {
    if (incomingCall) {
      socketService.rejectCall({ to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  const handleSelectWorkspace = (workspace) => {
    if (!workspace) return;
    setSelectedWorkspace(workspace);
    sessionStorage.setItem('chatrooms_workspace_prompted', 'true');
    setPromptWorkspaceOnLogin?.(false);

    // If workspace has nodes, automatically open the first channel (e.g. general)
    if (workspace.nodes && workspace.nodes.length > 0) {
      const channel = workspace.nodes[0];
      selectChat({
        id: channel.id,
        name: `#${channel.name}`,
        rawName: channel.name,
        workspaceName: workspace.name,
        type: 'channel',
        avatar: null,
        membersCount: channel.membersCount || workspace.membersCount || 1,
        isAnnouncement: channel.isAnnouncement,
        joinCode: workspace.joinCode,
      });
    }
  };

  const activeMessages = activeChat?.id ? messages[activeChat.id] || [] : [];
  const currentTypingUsers = activeChat?.id ? typingStatus[activeChat.id] || [] : [];

  return (
    <>
      {/* ─── Main layout: fills parent fully with atmospheric aura ─── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          flex: '1 1 0%',
          minHeight: 0,
          overflow: 'hidden',
          background: 'var(--bg-app-gradient)',
          backgroundColor: 'var(--bg-primary)',
          position: 'relative',
        }}
      >
        {/* Atmospheric Radiant Ambient Auras */}
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
          aria-hidden="true"
        >
          {/* Top Beam Aura: Electric Blue (Dark) / Sky Blue (Light) */}
          <div
            className="absolute -top-[12%] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full opacity-60 blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            }}
          />
          {/* Bottom Horizon Aura: Cantaloupe Orange (Dark) / Hot Pink (Light) */}
          <div
            className="absolute -bottom-[18%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full opacity-55 blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, var(--accent-highlight) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div
          style={{
            display: activeChat ? 'none' : 'flex',
            flexDirection: 'column',
            width: '100%',
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
          }}
          className="md:!flex md:!w-[320px] lg:!w-[340px]"
        >
          <Sidebar
            contacts={contacts}
            groups={groups}
            workspaces={workspaces}
            activeChat={activeChat}
            currentUser={user}
            selectedWorkspace={selectedWorkspace}
            isLoadingChats={isLoadingChats}
            onSelectChat={(chat) => selectChat(chat)}
            onOpenNewChat={() => setNewChatModalOpen(true)}
            onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
            onLogout={logout}
            onAddChannel={addChannelToWorkspace}
          />
        </div>

        {/* ── Chat Area ────────────────────────────────────────────── */}
        <div
          style={{
            display: !activeChat ? 'none' : 'flex',
            flexDirection: 'column',
            flex: '1 1 0%',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
          }}
          className="md:!flex"
        >
          <ChatArea
            chat={activeChat}
            messages={activeMessages}
            currentUser={user}
            typingUsers={currentTypingUsers}
            workspaces={workspaces}
            isLoadingMessages={isLoadingMessages}
            onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
            onSelectWorkspace={handleSelectWorkspace}
            onBack={closeChat}
            onSend={(content, attachment) =>
              activeChat && sendMessage(activeChat.id, content, attachment, user)
            }
            onEditMessage={(msgId, content) =>
              activeChat && editMessage(activeChat.id, msgId, content)
            }
            onDeleteMessage={(msgId) =>
              activeChat && deleteMessage(activeChat.id, msgId)
            }
            onCallEndedSummary={handleCallEndedSummary}
            onReaction={(msgId, emoji) =>
              activeChat && addReaction(activeChat.id, msgId, emoji, user?.id || user?._id)
            }
            onLeaveChat={(chatId, action) => {
              useChatStore.getState().removeChat(chatId, action);
            }}
          />
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onAddContact={addContact}
        onCreateGroup={createGroup}
        onStartDirectChat={(chat) => selectChat(chat)}
      />

      <WorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        workspaces={workspaces}
        activeWorkspace={selectedWorkspace || workspaces[0]}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={createWorkspace}
        onJoinWorkspace={joinWorkspace}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        user={user}
        onUpdateProfile={updateProfile}
        onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
      />

      {/* ── Incoming Call Prompt Modal ─────────────────────────────── */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

      {/* ── Active Callee WebRTC Session Modal ───────────────────────── */}
      {activeCallSession && (
        <CallModal
          isOpen={Boolean(activeCallSession)}
          onClose={() => setActiveCallSession(null)}
          onCallEndedSummary={handleCallEndedSummary}
          chat={activeCallSession.chat}
          isVideo={activeCallSession.isVideo}
          isInitiator={false}
          incomingSignal={activeCallSession.incomingSignal}
          callerInfo={activeCallSession.callerInfo}
          initialIceCandidates={activeCallSession.initialIceCandidates || []}
          currentUser={user}
        />
      )}
    </>
  );
};

export default ChatPage;
