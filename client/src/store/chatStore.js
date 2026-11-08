import { create } from 'zustand';
import api from '../api/api';
import socketService from '../api/socket';
import { normalizeEmoji } from '../utils/emojiMap';

const getInitialMutedChats = () => {
  try {
    const raw = localStorage.getItem('chatrooms_muted_chats');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getInitialBlockedUsers = () => {
  try {
    const raw = localStorage.getItem('chatrooms_blocked_users');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const useChatStore = create((set, get) => ({
  activeChat: null,
  contacts: [],
  groups: [],
  workspaces: [],
  messages: {},
  typingStatus: {},
  onlineUsers: [],
  mutedChats: getInitialMutedChats(),
  blockedUsers: getInitialBlockedUsers(),
  isLoadingChats: false,
  isLoadingMessages: false,

  // Reset store for logout
  resetStore: () => set({
    activeChat: null,
    contacts: [],
    groups: [],
    workspaces: [],
    messages: {},
    typingStatus: {},
    onlineUsers: [],
  }),

  // Initialize all chat streams (Contacts, Groups, Workspaces)
  loadChats: async () => {
    set({ isLoadingChats: true });
    try {
      const [contactsRes, workspacesRes] = await Promise.all([
        api.contacts.list(),
        api.workspaces.list(),
      ]);

      const contactsData = contactsRes.ok && contactsRes.data ? contactsRes.data : {};
      const rawContacts = contactsData.contacts && contactsData.contacts.length > 0
        ? contactsData.contacts
        : [];
      const rawGroups = contactsData.groups && contactsData.groups.length > 0
        ? contactsData.groups
        : [];

      const rawWorkspaces =
        workspacesRes.ok && workspacesRes.data
          ? Array.isArray(workspacesRes.data) && workspacesRes.data.length > 0
            ? workspacesRes.data
            : workspacesRes.data.workspaces && workspacesRes.data.workspaces.length > 0
            ? workspacesRes.data.workspaces
            : []
          : [];

      const activeOnline = (get().onlineUsers || []).map((x) => String(x).toLowerCase().replace(/^@/, ''));
      const contactsWithPresence = rawContacts.map((c) => {
        const uid = (c.userId || c.id || '').toString().toLowerCase();
        const uname = (c.username || c.primaryUsername || '').toLowerCase().replace(/^@/, '');
        const isOnline = activeOnline.includes(uid) || activeOnline.includes(uname);
        return {
          ...c,
          status: isOnline ? 'online' : (activeOnline.length > 0 ? 'offline' : (c.status || 'offline')),
          online: isOnline || (activeOnline.length === 0 && c.status === 'online'),
        };
      });

      set({
        contacts: contactsWithPresence,
        groups: rawGroups,
        workspaces: rawWorkspaces,
        isLoadingChats: false,
      });

      // Auto-subscribe to all active contact and channel rooms for instant real-time message delivery
      rawContacts.forEach((c) => {
        if (c.id) socketService.joinRoom(c.id);
      });
      rawGroups.forEach((g) => {
        if (g.id) socketService.joinRoom(g.id);
      });
      rawWorkspaces.forEach((ws) => {
        (ws.nodes || []).forEach((node) => {
          if (node.id) socketService.joinRoom(node.id);
        });
      });

      // Keep active chat in sync
      const current = get().activeChat;
      if (current) {
        const found =
          rawContacts.find((c) => c.id === current.id) ||
          rawGroups.find((g) => g.id === current.id);
        if (found) {
          const hasChanged =
            found.name !== current.name ||
            found.avatar !== current.avatar ||
            found.online !== current.online ||
            found.lastMessage !== current.lastMessage;
          if (hasChanged) {
            set({ activeChat: { ...current, ...found } });
          }
        }
      }
    } catch {
      set({ isLoadingChats: false });
    }
  },

  // Select active conversation
  selectChat: async (chat) => {
    if (!chat || !chat.id) return;
    const prev = get().activeChat;
    if (prev?.id === chat.id) return;

    socketService.joinRoom(chat.id);

    set({ activeChat: chat });
    await get().loadMessages(chat.id);
  },

  closeChat: () => {
    set({ activeChat: null });
  },

  removeChat: (chatId, action = 'leave') => {
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== chatId),
      contacts: state.contacts.filter((c) => c.id !== chatId),
      activeChat: state.activeChat?.id === chatId ? null : state.activeChat
    }));
  },

  toggleMuteChat: (chatId) => {
    if (!chatId) return;
    set((state) => {
      const current = state.mutedChats || [];
      const updated = current.includes(chatId)
        ? current.filter((id) => id !== chatId)
        : [...current, chatId];
      localStorage.setItem('chatrooms_muted_chats', JSON.stringify(updated));
      return { mutedChats: updated };
    });
  },

  isChatMuted: (chatId) => {
    return (get().mutedChats || []).includes(chatId);
  },

  blockUser: (target) => {
    if (!target) return;
    const identifiers = [];
    if (typeof target === 'string') {
      identifiers.push(target.toLowerCase().replace(/^@/, ''));
    } else {
      if (target.id) identifiers.push(String(target.id).toLowerCase());
      if (target.userId) identifiers.push(String(target.userId).toLowerCase());
      if (target.username || target.primaryUsername) {
        identifiers.push(String(target.username || target.primaryUsername).toLowerCase().replace(/^@/, ''));
      }
    }

    set((state) => {
      const current = state.blockedUsers || [];
      const updated = Array.from(new Set([...current, ...identifiers]));
      localStorage.setItem('chatrooms_blocked_users', JSON.stringify(updated));
      return { blockedUsers: updated };
    });
  },

  unblockUser: (target) => {
    if (!target) return;
    const identifiers = [];
    if (typeof target === 'string') {
      identifiers.push(target.toLowerCase().replace(/^@/, ''));
    } else {
      if (target.id) identifiers.push(String(target.id).toLowerCase());
      if (target.userId) identifiers.push(String(target.userId).toLowerCase());
      if (target.username || target.primaryUsername) {
        identifiers.push(String(target.username || target.primaryUsername).toLowerCase().replace(/^@/, ''));
      }
    }

    set((state) => {
      const current = state.blockedUsers || [];
      const updated = current.filter((id) => !identifiers.includes(id));
      localStorage.setItem('chatrooms_blocked_users', JSON.stringify(updated));
      return { blockedUsers: updated };
    });
  },

  isUserBlocked: (identifier) => {
    if (!identifier) return false;
    const clean = String(identifier).toLowerCase().replace(/^@/, '');
    return (get().blockedUsers || []).includes(clean);
  },

  // Load messages for a chat (silent = true prevents clearing screen with skeleton)
  loadMessages: async (chatId, silent = false) => {
    if (!chatId) return;
    const existing = get().messages[chatId];
    const shouldShowLoading = !silent && (!existing || existing.length === 0);
    if (shouldShowLoading) {
      set({ isLoadingMessages: true });
    }
    try {
      const res = await api.messages.byChat(chatId);
      const rawList = res.ok && Array.isArray(res.data) && res.data.length > 0
        ? res.data
        : (get().messages[chatId] || []);

      const list = rawList.map((m) => {
        if (m.attachment) {
          const isImg =
            m.attachment.type === 'image' ||
            m.attachment.mimeType?.startsWith('image/') ||
            /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)($|\?|#)/i.test(
              m.attachment.name || m.attachment.url || ''
            );
          if (isImg && m.attachment.type !== 'image') {
            return {
              ...m,
              attachment: { ...m.attachment, type: 'image' },
            };
          }
        }
        return m;
      });

      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: list,
        },
        isLoadingMessages: false,
      }));
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  // Mark messages in a conversation as read (1 tick -> 2 ticks for sender)
  markMessagesAsRead: (chatId) => {
    if (!chatId) return;
    const currentUser = (() => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const currentUid = (currentUser?.id || currentUser?._id || '').toString();
    const currentUname = (currentUser?.primaryUsername || currentUser?.username || '').toLowerCase().replace(/^@/, '');

    // 1. Emit read receipt over socket
    socketService.emit('mark_read', {
      chatId,
      userId: currentUid,
      username: currentUname,
    });

    // 2. Persist to API
    api.messages.markRead(chatId).catch(() => {});

    // 3. Update incoming messages locally
    set((state) => {
      const list = state.messages[chatId];
      if (!list || list.length === 0) return state;
      let changed = false;
      const updated = list.map((m) => {
        const mSenderId = (m.senderId || '').toString();
        const mSenderName = (m.senderUsername || '').toLowerCase().replace(/^@/, '');
        const isOwn = (currentUid && mSenderId === currentUid) || (currentUname && mSenderName === currentUname);
        if (!isOwn && !m.isRead) {
          changed = true;
          return { ...m, isRead: true };
        }
        return m;
      });

      if (!changed) return state;
      return {
        messages: {
          ...state.messages,
          [chatId]: updated,
        },
      };
    });
  },

  // Handler when participant reads messages
  handleMessagesRead: ({ chatId, readerUsername }) => {
    if (!chatId) return;
    set((state) => {
      const list = state.messages[chatId];
      if (!list || list.length === 0) return state;
      let changed = false;
      const updated = list.map((m) => {
        if (!m.isRead) {
          changed = true;
          return {
            ...m,
            isRead: true,
            readBy: readerUsername ? [...(m.readBy || []), readerUsername] : (m.readBy || []),
          };
        }
        return m;
      });

      if (!changed) return state;
      return {
        messages: {
          ...state.messages,
          [chatId]: updated,
        },
      };
    });
  },

  // Send message with instant optimistic update
  sendMessage: async (chatId, content, attachment = null, currentUser, extra = {}) => {
    if (!chatId || (!content?.trim() && !attachment && !extra?.callDetails)) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMessage = {
      id: messageId,
      chatId,
      content: content ? content.trim() : '',
      type: extra?.type || attachment?.type || 'text',
      callDetails: extra?.callDetails || null,
      attachment: attachment || null,
      senderId: currentUser?.id || currentUser?._id || 'user-1',
      senderName: currentUser?.name || 'You',
      senderUsername: currentUser?.primaryUsername || '',
      senderAvatar: currentUser?.avatar || null,
      reactions: [],
      isForwarded: Boolean(extra?.isForwarded),
      timestamp: new Date().toISOString(),
      ...extra,
    };

    // 1. Optimistic UI update
    set((state) => {
      const existing = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: [...existing, optimisticMessage],
        },
      };
    });

    // 2. Broadcast through socket
    socketService.sendMessage(optimisticMessage);

    // 3. Persist to API
    api.messages.send(chatId, optimisticMessage).catch((e) => { console.error('ignored', e); });

    // 4. Update last message preview
    const previewText = extra?.type === 'call'
      ? (extra?.callDetails?.isVideo ? '📹 ' : '📞 ') + (optimisticMessage.content || 'Call')
      : (optimisticMessage.content || (attachment?.type === 'image' ? '📷 Photo' : '📎 Attachment'));
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === chatId ? { ...c, lastMessage: previewText, lastMessageTime: new Date().toISOString() } : c
      ),
      groups: state.groups.map((g) =>
        g.id === chatId ? { ...g, lastMessage: previewText, lastMessageTime: new Date().toISOString() } : g
      ),
    }));
  },

  // Handle incoming message from Socket.io
  receiveMessage: (message) => {
    if (!message || !message.chatId) return;
    const chatId = message.chatId;

    // Drop incoming message if sender is blocked
    const senderUid = (message.senderId || '').toString().toLowerCase();
    const senderUname = (message.senderUsername || '').toLowerCase().replace(/^@/, '');
    const isBlocked = (get().blockedUsers || []).some(
      (b) => b === senderUid || b === senderUname || b === chatId
    );
    if (isBlocked) {
      return;
    }

    // Immediately join the room so subsequent updates flow seamlessly
    socketService.joinRoom(chatId);

    // Normalize image attachment if received as file or missing type
    let safeMsg = message;
    if (message.attachment) {
      const isImg =
        message.attachment.type === 'image' ||
        message.attachment.mimeType?.startsWith('image/') ||
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)($|\?|#)/i.test(
          message.attachment.name || message.attachment.url || ''
        );
      if (isImg && message.attachment.type !== 'image') {
        safeMsg = {
          ...message,
          attachment: { ...message.attachment, type: 'image' },
        };
      }
    }

    set((state) => {
      const existing = state.messages[chatId] || [];
      if (existing.some((m) => m.id === safeMsg.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [chatId]: [...existing, safeMsg],
        },
      };
    });

    const preview = message.type === 'call'
      ? (message.callDetails?.isVideo ? '📹 ' : '📞 ') + (message.content || 'Call')
      : (message.content || (message.attachment?.type === 'image' ? '📷 Photo' : '📎 Attachment'));
    const hasChat = get().contacts.some((c) => c.id === chatId) || get().groups.some((g) => g.id === chatId);

    if (!hasChat) {
      // New conversation initiated by another user: immediately load chats into sidebar!
      get().loadChats();
    } else {
      set((state) => ({
        contacts: state.contacts
          .map((c) =>
            c.id === chatId
              ? { ...c, lastMessage: preview, lastMessageTime: message.timestamp || new Date().toISOString() }
              : c
          )
          .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)),
        groups: state.groups
          .map((g) =>
            g.id === chatId
              ? { ...g, lastMessage: preview, lastMessageTime: message.timestamp || new Date().toISOString() }
              : g
          )
          .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)),
      }));
    }
  },

  // Add / toggle reaction on message
  addReaction: async (chatId, messageId, emoji, userId) => {
    const uid = String(userId || 'user-1');
    const cleanEmoji = normalizeEmoji(emoji);
    let action = 'add';

    set((state) => {
      const list = state.messages[chatId] || [];
      const updated = list.map((msg) => {
        if (msg.id !== messageId && msg._id !== messageId) return msg;

        const reactions = [...(msg.reactions || [])];
        const existing = reactions.find((r) => normalizeEmoji(r.emoji) === cleanEmoji);

        if (existing) {
          const userHasReacted = existing.users && existing.users.map(String).includes(uid);
          if (userHasReacted) {
            action = 'remove';
            existing.users = existing.users.filter((u) => String(u) !== uid);
            existing.count = existing.users.length;
          } else {
            action = 'add';
            existing.users = [...(existing.users || []), uid];
            existing.count = existing.users.length;
          }
          existing.emoji = cleanEmoji;
        } else {
          action = 'add';
          reactions.push({
            emoji: cleanEmoji,
            count: 1,
            users: [uid],
          });
        }

        return {
          ...msg,
          reactions: reactions.filter((r) => r.count > 0 && r.users && r.users.length > 0),
        };
      });

      return {
        messages: {
          ...state.messages,
          [chatId]: updated,
        },
      };
    });

    socketService.sendReaction({ messageId, emoji: cleanEmoji, userId: uid, chatId, action });
    api.messages.reaction(messageId, cleanEmoji, uid, action).catch((e) => { console.error('ignored', e); });
  },

  updateReaction: (payload) => {
    if (!payload) return;
    const msgId = payload.id || payload.messageId;
    if (!msgId) return;

    set((state) => {
      const updatedMessages = { ...state.messages };
      let changed = false;

      const targetChats = payload.chatId ? [payload.chatId] : Object.keys(updatedMessages);

      targetChats.forEach((cId) => {
        const list = updatedMessages[cId];
        if (Array.isArray(list)) {
          const index = list.findIndex((m) => m.id === msgId || (m._id && m._id === msgId));
          if (index !== -1) {
            const oldMsg = list[index];
            const newReactions = (payload.reactions || []).map((r) => ({
              ...r,
              emoji: normalizeEmoji(r.emoji),
            }));
            const updatedMsg = { ...oldMsg, reactions: newReactions };
            const newList = [...list];
            newList[index] = updatedMsg;
            updatedMessages[cId] = newList;
            changed = true;
          }
        }
      });

      if (!changed) return state;
      return { messages: updatedMessages };
    });
  },

  editMessage: async (chatId, messageId, newContent) => {
    if (!newContent?.trim()) return;

    set((state) => {
      const list = state.messages[chatId] || [];
      const updated = list.map((m) => (m.id === messageId ? { ...m, content: newContent.trim(), isEdited: true } : m));
      return {
        messages: {
          ...state.messages,
          [chatId]: updated,
        },
      };
    });

    api.messages.edit(messageId, newContent.trim()).catch((e) => { console.error('ignored', e); });
  },

  deleteMessage: async (chatId, messageId) => {
    set((state) => {
      const list = state.messages[chatId] || [];
      const updated = list.filter((m) => m.id !== messageId);
      return {
        messages: {
          ...state.messages,
          [chatId]: updated,
        },
      };
    });

    api.messages.delete(messageId).catch((e) => { console.error('ignored', e); });
  },

  addContact: async (username) => {
    const cleanUsername = username.replace(/^@/, '').trim();
    const res = await api.contacts.add(cleanUsername);
    if (res.ok && res.data) {
      await get().loadChats();
      return { success: true, contact: res.data };
    }

    return { success: false, error: res.error || res.data?.message || 'Failed to add contact' };
  },

  createGroup: async (name, description = '') => {
    const res = await api.contacts.createGroup({ name, description });
    if (res.ok && res.data) {
      await get().loadChats();
      return { success: true, group: res.data };
    }

    // Local fallback creation
    const newGroup = {
      id: `group-${Date.now()}`,
      name,
      description,
      membersCount: 1,
      lastMessage: 'Group created',
      lastMessageTime: new Date().toISOString(),
    };
    set((state) => ({
      groups: [newGroup, ...state.groups],
    }));
    return { success: true, group: newGroup };
  },

  createWorkspace: async (name, contextualUsername = '') => {
    try {
      const res = await api.workspaces.create({ name, contextualUsername });
      if (res.ok && res.data) {
        await get().loadChats();
        const ws = res.data.workspace || res.data;
        return { success: true, workspace: ws };
      }
      return { success: false, error: res.error || 'Failed to create workspace' };
    } catch (e) {
      return { success: false, error: e.message || 'Failed to create workspace' };
    }
  },

  joinWorkspace: async (code) => {
    try {
      const clean = code.trim().toUpperCase();
      const res = await api.workspaces.join(clean);
      if (res.ok && res.data) {
        await get().loadChats();
        const ws = res.data.workspace || res.data;
        return { success: true, workspace: ws };
      }
      return { success: false, error: res.error || 'Invalid workspace invite code' };
    } catch (e) {
      return { success: false, error: e.message || 'Failed to join workspace' };
    }
  },

  addChannelToWorkspace: async (workspaceId, channelName, folder = null) => {
    const cleanName = channelName.replace(/^#/, '').trim().toLowerCase();
    try {
      const res = await api.workspaces.createNode(workspaceId, { name: cleanName, folder });
      if (res.ok && res.data) {
        await get().loadChats();
        return { success: true, channel: res.data };
      }
    } catch (e) {
      console.warn('API addChannel warning:', e);
    }

    const newChannel = {
      id: `node-${Date.now()}-${cleanName}`,
      name: cleanName,
      membersCount: 1,
      folder: folder || null,
    };

    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === workspaceId
          ? { ...ws, nodes: [...(ws.nodes || []), newChannel] }
          : ws
      ),
    }));

    return { success: true, channel: newChannel };
  },

  leaveWorkspace: (workspaceId) => {
    set((state) => ({
      workspaces: state.workspaces.filter((ws) => ws.id !== workspaceId),
    }));
  },

  toggleWorkspaceSetting: (workspaceId, settingKey) => {
    set((state) => ({
      workspaces: state.workspaces.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        const currentSettings = ws.settings || { allowEmojis: true, allowAttachments: true };
        return {
          ...ws,
          settings: {
            ...currentSettings,
            [settingKey]: currentSettings[settingKey] === false ? true : false,
          }
        };
      })
    }));
  },

  setOnlineUsersList: (list = []) => {
    const normalizedList = list.map((x) => String(x).toLowerCase().replace(/^@/, ''));
    set((state) => ({
      onlineUsers: normalizedList,
      contacts: state.contacts.map((c) => {
        const uid = (c.userId || c.id || '').toString().toLowerCase();
        const uname = (c.username || c.primaryUsername || '').toLowerCase().replace(/^@/, '');
        const isOnline = normalizedList.includes(uid) || normalizedList.includes(uname);
        return {
          ...c,
          status: isOnline ? 'online' : 'offline',
          online: isOnline,
        };
      }),
      activeChat: state.activeChat && state.activeChat.type !== 'channel'
        ? (() => {
            const uid = (state.activeChat.userId || state.activeChat.id || '').toString().toLowerCase();
            const uname = (state.activeChat.username || state.activeChat.primaryUsername || '').toLowerCase().replace(/^@/, '');
            const isOnline = normalizedList.includes(uid) || normalizedList.includes(uname);
            return {
              ...state.activeChat,
              status: isOnline ? 'online' : 'offline',
              online: isOnline,
            };
          })()
        : state.activeChat,
    }));
  },

  setUserStatus: (userId, username, status) => {
    const isOnline = status === 'online';
    const cleanUid = (userId || '').toString().toLowerCase();
    const cleanUname = (username || '').toLowerCase().replace(/^@/, '');

    set((state) => {
      let updatedOnline = [...state.onlineUsers];
      if (isOnline) {
        if (cleanUid && !updatedOnline.includes(cleanUid)) updatedOnline.push(cleanUid);
        if (cleanUname && !updatedOnline.includes(cleanUname)) updatedOnline.push(cleanUname);
      } else {
        updatedOnline = updatedOnline.filter((x) => x !== cleanUid && x !== cleanUname);
      }

      const updatedContacts = state.contacts.map((c) => {
        const cUid = (c.userId || c.id || '').toString().toLowerCase();
        const cUname = (c.username || c.primaryUsername || '').toLowerCase().replace(/^@/, '');
        const match = (cleanUid && cUid === cleanUid) || (cleanUname && cUname === cleanUname);
        if (match) {
          return { ...c, status, online: isOnline };
        }
        return c;
      });

      let updatedActiveChat = state.activeChat;
      if (updatedActiveChat && updatedActiveChat.type !== 'channel') {
        const actUid = (updatedActiveChat.userId || updatedActiveChat.id || '').toString().toLowerCase();
        const actUname = (updatedActiveChat.username || updatedActiveChat.primaryUsername || '').toLowerCase().replace(/^@/, '');
        const match = (cleanUid && actUid === cleanUid) || (cleanUname && actUname === cleanUname);
        if (match) {
          updatedActiveChat = { ...updatedActiveChat, status, online: isOnline };
        }
      }

      return {
        onlineUsers: updatedOnline,
        contacts: updatedContacts,
        activeChat: updatedActiveChat,
      };
    });
  },

  setTyping: (roomId, userName, isTyping) => {
    if (!roomId) return;
    set((state) => {
      const current = state.typingStatus[roomId] || [];
      const updated = isTyping
        ? Array.from(new Set([...current, userName]))
        : current.filter((u) => u !== userName);

      return {
        typingStatus: {
          ...state.typingStatus,
          [roomId]: updated,
        },
      };
    });

    // Auto safety cleanup: clear typing indicator after 5 seconds to prevent stuck states
    if (isTyping && userName) {
      setTimeout(() => {
        set((state) => {
          const current = state.typingStatus[roomId] || [];
          if (!current.includes(userName)) return state;
          return {
            typingStatus: {
              ...state.typingStatus,
              [roomId]: current.filter((u) => u !== userName),
            },
          };
        });
      }, 5000);
    }
  },
}));

export default useChatStore;
