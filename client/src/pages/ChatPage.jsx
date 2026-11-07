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

export const ChatPage = () => {
  const { user, logout, updateProfile, promptWorkspaceOnLogin, setPromptWorkspaceOnLogin } = useAuthStore();
  const {
    activeChat,
    contacts,
    groups,
    workspaces,
    messages,
    typingStatus,
    isLoadingChats,
    isLoadingMessages,
    loadChats,
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
  } = useChatStore();

  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallSession, setActiveCallSession] = useState(null);

  // Automatically show workspace selection popup on login
  useEffect(() => {
    const prompted = sessionStorage.getItem('chatrooms_workspace_prompted');
    if (promptWorkspaceOnLogin || prompted !== 'true') {
      setWorkspaceModalOpen(true);
    }
  }, [promptWorkspaceOnLogin]);

  useEffect(() => {
    loadChats();

    const handleReceive = (msg) => {
      receiveMessage(msg);
      if (msg && msg.senderId !== user?.id && msg.senderId !== user?._id) {
        playReceivedSound();
      }
    };
    const handleReaction = (msg) => updateReaction(msg);
    const handleTyping = ({ roomId, userName, isTyping }) => setTyping(roomId, userName, isTyping);

    const handleIncomingCall = (callData) => {
      const myUsername = (user?.primaryUsername || '').toLowerCase().replace(/^@/, '');
      if (callData.from && (callData.from === myUsername || callData.from === user?.id)) return;
      setIncomingCall(callData);
    };

    const handleCallEndedGlobal = () => {
      setIncomingCall(null);
      setActiveCallSession(null);
    };

    socketService.on('receive_message', handleReceive);
    socketService.on('update_reaction', handleReaction);
    socketService.on('user_typing', handleTyping);
    socketService.on('call_incoming', handleIncomingCall);
    socketService.on('call_ended', handleCallEndedGlobal);
    socketService.on('call_rejected', handleCallEndedGlobal);

    return () => {
      socketService.off('receive_message', handleReceive);
      socketService.off('update_reaction', handleReaction);
      socketService.off('user_typing', handleTyping);
      socketService.off('call_incoming', handleIncomingCall);
      socketService.off('call_ended', handleCallEndedGlobal);
      socketService.off('call_rejected', handleCallEndedGlobal);
    };
  }, [loadChats, receiveMessage, updateReaction, setTyping, user?.id, user?.primaryUsername]);

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
    });
    setIncomingCall(null);
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
      {/* ─── Main layout: fills parent fully ─────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          flex: '1 1 0%',
          minHeight: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div
          style={{
            display: activeChat ? 'none' : 'flex',
            flexDirection: 'column',
            width: '100%',
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden',
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
          chat={activeCallSession.chat}
          isVideo={activeCallSession.isVideo}
          isInitiator={false}
          incomingSignal={activeCallSession.incomingSignal}
          callerInfo={activeCallSession.callerInfo}
          currentUser={user}
        />
      )}
    </>
  );
};

export default ChatPage;
