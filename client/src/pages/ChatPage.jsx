import React, { useEffect, useState } from 'react';
import Sidebar from '../components/chat/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import { NewChatPanel } from '../components/chat/NewChatPanel';
import { SettingsPanel } from '../components/chat/SettingsPanel';
import WorkspaceModal from '../components/modals/WorkspaceModal';
import CallModal from '../components/modals/CallModal';
import IncomingCallModal from '../components/modals/IncomingCallModal';
import ForwardModal from '../components/modals/ForwardModal';
import Avatar from '../components/ui/Avatar';
import { X } from '../components/ui/Icons';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import useChatStore, { matchesChatId } from '../store/chatStore';
import useAuthStore from '../store/authStore';
import socketService from '../api/socket';
import { playReceivedSound } from '../utils/chatroomsSound';
import notificationService from '../utils/notificationService';

export const ChatPage = () => {
  const { user, logout, updateProfile, promptWorkspaceOnLogin, setPromptWorkspaceOnLogin } = useAuthStore();
  const {
    activeChat,
    contacts,
    groups,
    workspaces,
    messages,
    unreadCounts,
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
    markMessagesAsRead,
    handleMessagesRead,
  } = useChatStore();

  // Navigation views: 'chats' (Sidebar) | 'settings' (WhatsApp Settings Panel) | 'newChat' (WhatsApp New Chat Panel)
  const [leftView, setLeftView] = useState('chats');
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceModalOptions, setWorkspaceModalOptions] = useState({ tab: 'select', parentWorkspaceId: null });
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [inAppToast, setInAppToast] = useState(null);
  const bufferedIceCandidatesRef = React.useRef([]);

  // Request notifications permission immediately if allowed, plus on first user gesture when 'default'
  useEffect(() => {
    notificationService.requestPermission().catch(() => {});
    const onFirstGesture = () => {
      if (notificationService.getPermissionState() === 'default') {
        notificationService.requestPermission().catch(() => {});
      }
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    window.addEventListener('keydown', onFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
  }, []);

  // Live unread badge in browser tab title
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts || {}).reduce((acc, n) => acc + (Number(n) || 0), 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) ChatRooms` : 'ChatRooms';
  }, [unreadCounts]);

  // ── Mobile Hardware & Gesture Back Navigation ────────────────────
  const activeChatRef = React.useRef(activeChat);
  const leftViewRef = React.useRef(leftView);
  const incomingCallRef = React.useRef(incomingCall);
  const activeCallSessionRef = React.useRef(activeCallSession);
  const modalsRef = React.useRef({
    workspace: false,
    forward: false,
    incomingCall: false,
  });

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    leftViewRef.current = leftView;
  }, [leftView]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallSessionRef.current = activeCallSession;
  }, [activeCallSession]);

  useEffect(() => {
    modalsRef.current = {
      workspace: workspaceModalOpen,
      forward: forwardModalOpen,
      incomingCall: Boolean(incomingCall),
    };
  }, [workspaceModalOpen, forwardModalOpen, incomingCall]);

  const chatPushedRef = React.useRef(false);

  // When activeChat is selected on mobile, push history state so pressing back returns to conversation list
  useEffect(() => {
    if (activeChat?.id) {
      if (!chatPushedRef.current) {
        window.history.pushState({ chatroomsView: 'chat', id: activeChat.id }, '');
        chatPushedRef.current = true;
      }
    } else {
      chatPushedRef.current = false;
    }
  }, [activeChat?.id]);

  const handleOpenSettings = () => {
    setLeftView('settings');
    window.history.pushState({ chatroomsView: 'settings' }, '');
  };
  const handleCloseSettings = () => {
    setLeftView('chats');
    if (window.history.state?.chatroomsView === 'settings') {
      window.history.back();
    }
  };

  const handleOpenNewChat = () => {
    setLeftView('newChat');
    window.history.pushState({ chatroomsView: 'newChat' }, '');
  };
  const handleCloseNewChat = () => {
    setLeftView('chats');
    if (window.history.state?.chatroomsView === 'newChat') {
      window.history.back();
    }
  };

  const handleOpenWorkspace = (options = null) => {
    const isCustomOpts = options && typeof options === 'object' && !options.nativeEvent && !options.currentTarget;
    setWorkspaceModalOptions({
      tab: isCustomOpts && options.tab ? options.tab : 'select',
      parentWorkspaceId: isCustomOpts && options.parentWorkspaceId ? options.parentWorkspaceId : null,
    });
    window.history.pushState({ chatroomsView: 'modal', name: 'workspace' }, '');
    setWorkspaceModalOpen(true);
  };
  const handleCloseWorkspace = () => {
    sessionStorage.setItem('chatrooms_workspace_prompted', 'true');
    setWorkspaceModalOptions({ tab: 'select', parentWorkspaceId: null });
    if (window.history.state?.chatroomsView === 'modal') {
      window.history.back();
    } else {
      setWorkspaceModalOpen(false);
    }
  };

  const handleCloseChat = () => {
    closeChat();
    chatPushedRef.current = false;
    if (window.history.state?.chatroomsView === 'chat') {
      window.history.back();
    }
  };

  useEffect(() => {
    // 1. Establish initial root entry to trap back button inside PWA/mobile browser
    if (!window.history.state?.chatroomsRoot) {
      window.history.replaceState({ chatroomsRoot: true, view: 'home' }, '');
      window.history.pushState({ chatroomsRoot: true, view: 'home' }, '');
    }

    const handlePopState = () => {
      // 1. Dismiss active / incoming call
      if (modalsRef.current.incomingCall) {
        setIncomingCall(null);
        return;
      }
      // 2. Dismiss open workspace or forward modal
      if (modalsRef.current.workspace) {
        sessionStorage.setItem('chatrooms_workspace_prompted', 'true');
        setWorkspaceModalOpen(false);
        return;
      }
      if (modalsRef.current.forward) {
        setForwardModalOpen(false);
        return;
      }
      // 3. Close WhatsApp-style left panels (Settings / New Chat) and return to chats list
      if (leftViewRef.current !== 'chats') {
        setLeftView('chats');
        return;
      }
      // 4. Close active chat on mobile and return to chat list
      if (activeChatRef.current) {
        chatPushedRef.current = false;
        closeChat();
        return;
      }
      // 5. Already at the chat list (home) - trap back button to keep user inside the app
      window.history.pushState({ chatroomsRoot: true, view: 'home' }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeChat]);

  // Automatically show workspace selection popup on login
  useEffect(() => {
    const prompted = sessionStorage.getItem('chatrooms_workspace_prompted');
    if (promptWorkspaceOnLogin || prompted !== 'true') {
      sessionStorage.setItem('chatrooms_workspace_prompted', 'true');
      setWorkspaceModalOpen(true);
    }
  }, [promptWorkspaceOnLogin]);

  useEffect(() => {
    if (user) {
      socketService.registerUser(user);
    }
  }, [user]);

  useEffect(() => {
    loadChats(true);

    const handleReceive = (msg) => {
      if (!msg || !msg.chatId) return;

      // Read fresh store state so mutedChats / blockedUsers / activeChat are never stale
      const storeState = useChatStore.getState();
      const senderUid = (msg.senderId || '').toString().toLowerCase();
      const senderUname = (msg.senderUsername || '').toLowerCase().replace(/^@/, '');
      const isBlocked = (storeState.blockedUsers || []).some(
        (b) => b === senderUid || b === senderUname || b === msg.chatId
      );
      if (isBlocked) return;

      const isMuted = (storeState.mutedChats || []).includes(msg.chatId);
      const myUid = (user?.id || user?._id || '').toString().toLowerCase();
      const myUname = (user?.primaryUsername || user?.username || '').toLowerCase().replace(/^@/, '');
      const isFromMe = Boolean(
        (myUid && senderUid && senderUid === myUid) ||
        (myUname && senderUname && senderUname === myUname)
      );

      receiveMessage(msg);

      if (!isFromMe && !isMuted) {
        playReceivedSound();
        const snippet =
          msg.type === 'call'
            ? msg.callDetails?.isVideo
              ? '📹 Video Call'
              : '📞 Voice Call'
            : msg.content || msg.text || (msg.attachment ? 'Sent an attachment' : 'New message');

        // Cross-platform native notifications on Android PWA & Windows Desktop
        notificationService.notifyMessage({
          title: msg.senderName || msg.senderUsername || 'ChatRooms',
          body: snippet,
          chatId: msg.chatId,
          icon: '/android-chrome-192x192.png',
        });

        // Real-Time in-app banner if user has not opened this chat (or is on chat list / another chat)
        const currActive = activeChatRef.current;
        if (!currActive || !matchesChatId(currActive, msg.chatId)) {
          setInAppToast({
            chatId: msg.chatId,
            senderId: msg.senderId,
            senderUsername: msg.senderUsername,
            senderName: msg.senderName || msg.senderUsername || 'ChatRooms',
            senderAvatar: msg.senderAvatar,
            text: snippet,
          });
          setTimeout(() => setInAppToast(null), 4500);
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
      loadChats(true);
    };

    const handleIncomingCall = (callData) => {
      const myUsername = (user?.primaryUsername || user?.username || '').toLowerCase().trim().replace(/^@/, '');
      const callerFrom = (callData?.from || callData?.callerUsername || '').toLowerCase().trim().replace(/^@/, '');
      if (callerFrom && (callerFrom === myUsername || callerFrom === String(user?.id || '').toLowerCase())) return;

      // Auto-reject incoming call if caller is blocked
      const callerId = (callData?.callerId || '').toString().toLowerCase();
      const isBlocked = (blockedUsers || []).some(
        (b) => b === callerFrom || b === callerId
      );
      if (isBlocked) {
        socketService.rejectCall({
          to: callData.from,
          chatId: callData.chatId || callData.roomId,
          callId: callData.callId,
        });
        return;
      }

      // Deduplicate repeated call_incoming for the same callId so buffered ICE candidates aren't wiped
      const existingIncomingId = incomingCallRef.current?.callId;
      const existingActiveId = activeCallSessionRef.current?.callId;
      if (callData?.callId && (existingIncomingId === callData.callId || existingActiveId === callData.callId)) {
        return;
      }

      bufferedIceCandidatesRef.current = [];
      incomingCallRef.current = callData;
      setIncomingCall(callData);

      // System notification for incoming call
      notificationService.notifyCall({
        callerName: callData.callerName || callData.from || 'Incoming Call',
        isVideo: callData.isVideo,
        chatId: callData.chatId || callData.roomId,
      });
    };

    const handleGlobalIceCandidate = (data) => {
      if (!data?.candidate) return;
      const pendingCallId = incomingCallRef.current?.callId;
      if (data.callId && pendingCallId && data.callId !== pendingCallId) return;
      bufferedIceCandidatesRef.current.push(data.candidate);
    };

    const handleCallEndedGlobal = (data) => {
      const endedCallId = data?.callId;
      if (endedCallId && incomingCallRef.current?.callId === endedCallId) {
        incomingCallRef.current = null;
        bufferedIceCandidatesRef.current = [];
      } else if (!endedCallId) {
        incomingCallRef.current = null;
        bufferedIceCandidatesRef.current = [];
      }
      setIncomingCall((prev) => {
        if (!prev) return null;
        if (!endedCallId || prev.callId === endedCallId) return null;
        return prev;
      });
      setActiveCallSession((prev) => {
        if (!prev) return null;
        if (!endedCallId || prev.callId === endedCallId) return null;
        return prev;
      });
    };

    const handleChatCleared = ({ chatId }) => {
      if (chatId) {
        useChatStore.getState().deleteChat(chatId, null, { skipApi: true });
      }
    };

    const handleGroupEvent = (payload) => {
      const grpId = payload?.group?.id || payload?.groupId || payload?.id;
      if (grpId) {
        socketService.joinRoom(grpId);
      }
      loadChats(true);
    };

    socketService.on('receive_message', handleReceive);
    socketService.on('update_reaction', handleReaction);
    socketService.on('user_typing', handleTyping);
    socketService.on('user_status', handleUserStatus);
    socketService.on('online_users_list', handleOnlineList);
    socketService.on('contact_added', handleConversationUpdate);
    socketService.on('new_conversation', handleConversationUpdate);
    socketService.on('group_created', handleGroupEvent);
    socketService.on('group_updated', handleGroupEvent);
    socketService.on('group_member_added', handleGroupEvent);
    socketService.on('group_member_removed', handleGroupEvent);
    socketService.on('chat_cleared', handleChatCleared);
    socketService.on('call_incoming', handleIncomingCall);
    socketService.on('ice_candidate', handleGlobalIceCandidate);
    socketService.on('call_ended', handleCallEndedGlobal);
    socketService.on('call_rejected', handleCallEndedGlobal);
    socketService.on('messages_read', handleMessagesRead);

    // Initial query for online presence
    socketService.getOnlineUsers();

    // Auto-sync on window focus & tab visibility (silent refresh, throttled to 10s)
    let lastFocusSync = 0;
    const handleFocusSync = () => {
      const now = Date.now();
      if (now - lastFocusSync < 10000) return;
      lastFocusSync = now;
      loadChats(true);
      socketService.getOnlineUsers();
      if (activeChatRef.current?.id) {
        loadMessages(activeChatRef.current.id, true);
        markMessagesAsRead(activeChatRef.current.id);
      }
    };

    window.addEventListener('focus', handleFocusSync);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocusSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Background sync timer every 30s (when visible) to guarantee accuracy without triggering rate limits
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        handleFocusSync();
      }
    }, 30000);

    return () => {
      socketService.off('receive_message', handleReceive);
      socketService.off('update_reaction', handleReaction);
      socketService.off('user_typing', handleTyping);
      socketService.off('user_status', handleUserStatus);
      socketService.off('online_users_list', handleOnlineList);
      socketService.off('contact_added', handleConversationUpdate);
      socketService.off('new_conversation', handleConversationUpdate);
      socketService.off('group_created', handleGroupEvent);
      socketService.off('group_updated', handleGroupEvent);
      socketService.off('group_member_added', handleGroupEvent);
      socketService.off('group_member_removed', handleGroupEvent);
      socketService.off('chat_cleared', handleChatCleared);
      socketService.off('call_incoming', handleIncomingCall);
      socketService.off('ice_candidate', handleGlobalIceCandidate);
      socketService.off('call_ended', handleCallEndedGlobal);
      socketService.off('call_rejected', handleCallEndedGlobal);
      socketService.off('messages_read', handleMessagesRead);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(syncInterval);
    };
  }, [loadChats, loadMessages, receiveMessage, updateReaction, setTyping, user?.id, user?.primaryUsername, markMessagesAsRead, handleMessagesRead]);

  const handleStartCall = (callChat, isVideo = false) => {
    const targetChat = callChat || activeChatRef.current;
    if (!targetChat) return;
    const newCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    bufferedIceCandidatesRef.current = [];
    setActiveCallSession({
      callId: newCallId,
      chat: targetChat,
      isVideo,
      isInitiator: true,
      initialIceCandidates: [],
    });
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    const callSnapshot = incomingCall;
    const queuedIce = [...bufferedIceCandidatesRef.current];
    bufferedIceCandidatesRef.current = [];
    incomingCallRef.current = null;
    setIncomingCall(null);

    const newCallId = callSnapshot.callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setActiveCallSession({
      callId: newCallId,
      chat: {
        name: callSnapshot.callerName || 'Participant',
        avatar: callSnapshot.callerAvatar,
        id: callSnapshot.chatId || callSnapshot.from,
        username: callSnapshot.callerUsername || callSnapshot.from,
      },
      isVideo: callSnapshot.isVideo,
      isInitiator: false,
      incomingSignal: callSnapshot.signalData,
      callerInfo: callSnapshot,
      initialIceCandidates: queuedIce,
    });
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

  const handleOpenForward = (msg) => {
    setMessageToForward(msg);
    setForwardModalOpen(true);
  };

  const handleForwardMessage = async (targetChat, originalMsg) => {
    if (!targetChat || !originalMsg) return;
    const forwardExtra = {
      isForwarded: true,
      type: originalMsg.type || 'text',
    };
    await sendMessage(
      targetChat.id,
      originalMsg.content || '',
      originalMsg.attachment || null,
      user,
      forwardExtra
    );
  };

  const handleDeclineIncomingCall = () => {
    if (incomingCall) {
      socketService.rejectCall({
        to: incomingCall.from,
        chatId: incomingCall.chatId || incomingCall.roomId,
        callId: incomingCall.callId,
      });
      incomingCallRef.current = null;
      bufferedIceCandidatesRef.current = [];
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
      const cleanName = (channel.name || 'general').replace(/^#/, '');
      selectChat({
        id: channel.id,
        name: `#${cleanName}`,
        rawName: cleanName,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        type: 'channel',
        avatar: null,
        membersCount: channel.membersCount || workspace.membersCount || 1,
        isAnnouncement: Boolean(channel.isAnnouncement),
        joinCode: workspace.joinCode,
      });
    } else {
      // Fallback default channel
      const fallbackChannelId = workspace.defaultNodeId || `chan-general-${workspace.id}`;
      selectChat({
        id: fallbackChannelId,
        name: '#general',
        rawName: 'general',
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        type: 'channel',
        avatar: null,
        membersCount: workspace.membersCount || 1,
        isAnnouncement: false,
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

        {/* ── Sidebar / Left Navigation Panel (WhatsApp style) ────── */}
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
          {leftView === 'settings' ? (
            <SettingsPanel
              user={user}
              onClose={handleCloseSettings}
              onUpdateProfile={updateProfile}
              onOpenWorkspaceModal={handleOpenWorkspace}
            />
          ) : leftView === 'newChat' ? (
            <NewChatPanel
              currentUser={user}
              onClose={handleCloseNewChat}
              onAddContact={addContact}
              onCreateGroup={createGroup}
              onStartDirectChat={(contact) => {
                setLeftView('chats');
                chatPushedRef.current = true;
                selectChat(contact);
                try {
                  window.history.replaceState({ chatroomsView: 'chat', id: contact.id }, '');
                } catch {}
              }}
            />
          ) : (
            <Sidebar
              contacts={contacts}
              groups={groups}
              workspaces={workspaces}
              activeChat={activeChat}
              currentUser={user}
              selectedWorkspace={selectedWorkspace}
              isLoadingChats={isLoadingChats}
              onSelectChat={(chat) => selectChat(chat)}
              onOpenNewChat={handleOpenNewChat}
              onOpenWorkspaceModal={handleOpenWorkspace}
              onOpenSettings={handleOpenSettings}
              onLogout={logout}
              onAddChannel={addChannelToWorkspace}
            />
          )}
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
          <ErrorBoundary key={activeChat?.id || 'dashboard'} onBack={handleCloseChat} onReset={() => selectChat(activeChat)}>
            <ChatArea
              chat={activeChat}
              messages={activeMessages}
              currentUser={user}
              typingUsers={currentTypingUsers}
              workspaces={workspaces}
              isLoadingMessages={isLoadingMessages}
              onOpenWorkspaceModal={handleOpenWorkspace}
              onSelectWorkspace={handleSelectWorkspace}
              onBack={handleCloseChat}
              onStartCall={handleStartCall}
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
              onForwardMessage={handleOpenForward}
              onLeaveChat={(chatId, action) => {
                useChatStore.getState().removeChat(chatId, action);
              }}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* ── Real-Time In-App Message Toast Banner ───────────────────── */}
      {inAppToast && (
        <div
          onClick={() => {
            const store = useChatStore.getState();
            const cid = inAppToast.chatId;
            let targetObj =
              (store.contacts || []).find((c) => matchesChatId(c, cid)) ||
              (store.groups || []).find((g) => matchesChatId(g, cid));
            if (!targetObj) {
              for (const ws of store.workspaces || []) {
                const node = (ws.nodes || []).find((n) => n.id === cid);
                if (node) {
                  targetObj = node;
                  break;
                }
              }
            }
            if (!targetObj) {
              targetObj = {
                id: cid,
                userId: inAppToast.senderId,
                username: inAppToast.senderUsername,
                name: inAppToast.senderName,
                avatar: inAppToast.senderAvatar,
                type: String(cid).startsWith('dm_') ? 'contact' : 'group',
              };
            }
            selectChat(targetObj);
            setInAppToast(null);
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-4 p-3 rounded-2xl bg-[var(--bg-glass)] backdrop-blur-xl border border-[var(--border)] shadow-2xl flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] transition-all animate-bounceIn select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={inAppToast.senderName} src={inAppToast.senderAvatar} size="sm" />
            <div className="min-w-0 font-heading">
              <span className="text-xs font-bold text-[var(--accent)] truncate block">
                {inAppToast.senderName}
              </span>
              <p className="text-[11px] font-chat text-[var(--text-primary)] truncate m-0">
                {inAppToast.text}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInAppToast(null);
            }}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <ForwardModal
        isOpen={forwardModalOpen}
        onClose={() => setForwardModalOpen(false)}
        message={messageToForward}
        onForward={handleForwardMessage}
      />

      <WorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={handleCloseWorkspace}
        workspaces={workspaces}
        activeWorkspace={selectedWorkspace || workspaces[0]}
        initialTab={workspaceModalOptions.tab}
        initialParentWorkspaceId={workspaceModalOptions.parentWorkspaceId}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={createWorkspace}
        onJoinWorkspace={joinWorkspace}
      />

      {/* ── Incoming Call Prompt Modal ─────────────────────────────── */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

      {/* ── Active WebRTC Call Session Modal (Caller & Callee) ──────── */}
      {activeCallSession && (
        <CallModal
          key={activeCallSession.callId}
          callId={activeCallSession.callId}
          isOpen={Boolean(activeCallSession)}
          onClose={() => setActiveCallSession(null)}
          onCallEndedSummary={handleCallEndedSummary}
          chat={activeCallSession.chat}
          isVideo={activeCallSession.isVideo}
          isInitiator={activeCallSession.isInitiator}
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
