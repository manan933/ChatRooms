import { create } from 'zustand';
import api from '../api/api';
import socketService from '../api/socket';
import { normalizeEmoji } from '../utils/emojiMap';

export const useChatStore = create((set, get) => ({
  activeChat: null,
  contacts: [],
  groups: [],
  workspaces: [],
  messages: {},
  typingStatus: {},
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

      set({
        contacts: rawContacts,
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
          set({ activeChat: { ...current, ...found } });
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

  blockUser: (userId) => {
    set((state) => {
      const blocked = state.blockedUsers || [];
      if (blocked.includes(userId)) return state;
      return { blockedUsers: [...blocked, userId] };
    });
  },

  // Load messages for a chat
  loadMessages: async (chatId) => {
    if (!chatId) return;
    set({ isLoadingMessages: true });
    try {
      const res = await api.messages.byChat(chatId);
      const list = res.ok && Array.isArray(res.data) && res.data.length > 0
        ? res.data
        : (get().messages[chatId] || []);

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

  // Send message with instant optimistic update
  sendMessage: async (chatId, content, attachment = null, currentUser) => {
    if (!chatId || (!content?.trim() && !attachment)) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMessage = {
      id: messageId,
      chatId,
      content: content ? content.trim() : '',
      type: attachment?.type || 'text',
      attachment: attachment || null,
      senderId: currentUser?.id || currentUser?._id || 'user-1',
      senderName: currentUser?.name || 'You',
      senderUsername: currentUser?.primaryUsername || '',
      senderAvatar: currentUser?.avatar || null,
      reactions: [],
      timestamp: new Date().toISOString(),
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
    const previewText = optimisticMessage.content || (attachment?.type === 'image' ? '📷 Photo' : '📎 Attachment');
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

    // Immediately join the room so subsequent updates flow seamlessly
    socketService.joinRoom(chatId);

    set((state) => {
      const existing = state.messages[chatId] || [];
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [chatId]: [...existing, message],
        },
      };
    });

    const preview = message.content || (message.attachment?.type === 'image' ? '📷 Photo' : '📎 Attachment');
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
    const uid = userId || 'user-1';
    const cleanEmoji = normalizeEmoji(emoji);

    set((state) => {
      const list = state.messages[chatId] || [];
      const updated = list.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = [...(msg.reactions || [])];
        const existing = reactions.find((r) => normalizeEmoji(r.emoji) === cleanEmoji);

        if (existing) {
          const userHasReacted = existing.users && existing.users.includes(uid);
          if (userHasReacted) {
            existing.users = existing.users.filter((u) => u !== uid);
            existing.count = existing.users.length;
          } else {
            existing.users = [...(existing.users || []), uid];
            existing.count = existing.users.length;
          }
          existing.emoji = cleanEmoji;
        } else {
          reactions.push({
            emoji: cleanEmoji,
            count: 1,
            users: [uid],
          });
        }

        return {
          ...msg,
          reactions: reactions.filter((r) => r.count > 0),
        };
      });

      return {
        messages: {
          ...state.messages,
          [chatId]: updated,
        },
      };
    });

    socketService.sendReaction({ messageId, emoji: cleanEmoji, userId: uid, chatId });
    api.messages.reaction(messageId, cleanEmoji, uid).catch((e) => { console.error('ignored', e); });
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
          const index = list.findIndex((m) => m.id === msgId);
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

  setTyping: (roomId, userName, isTyping) => {
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
  },
}));

export default useChatStore;
