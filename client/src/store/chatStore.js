import { create } from 'zustand';
import api from '../api/api';
import socketService from '../api/socket';
import { normalizeEmoji } from '../utils/emojiMap';

const getCachedData = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

let messagesCacheTimer = null;

const sanitizeCacheMessage = (m) => {
  if (!m || typeof m !== 'object') return m;
  let next = m;
  if (typeof m.senderAvatar === 'string' && m.senderAvatar.startsWith('data:') && m.senderAvatar.length > 4096) {
    next = { ...next, senderAvatar: null };
  }
  if (m.attachment && typeof m.attachment.url === 'string' && m.attachment.url.startsWith('data:') && m.attachment.url.length > 32768) {
    next = { ...next, attachment: { ...m.attachment, url: '', _omittedLargeData: true } };
  }
  return next;
};

const scheduleMessagesCache = (messagesMap) => {
  if (messagesCacheTimer) clearTimeout(messagesCacheTimer);
  messagesCacheTimer = setTimeout(() => {
    try {
      const compact = {};
      Object.entries(messagesMap || {}).forEach(([cid, list]) => {
        if (Array.isArray(list) && list.length > 0) {
          compact[cid] = list.slice(-50).map(sanitizeCacheMessage);
        }
      });
      localStorage.setItem('chatrooms_cached_messages', JSON.stringify(compact));
    } catch {}
  }, 500);
};

const setCachedData = (key, data) => {
  if (key === 'chatrooms_cached_messages') {
    scheduleMessagesCache(data);
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
};

const getInitialMutedChats = () => {
  return getCachedData('chatrooms_muted_chats', []);
};

const getInitialBlockedUsers = () => {
  return getCachedData('chatrooms_blocked_users', []);
};

const getStoredUserInfo = () => {
  try {
    const raw = localStorage.getItem('chatrooms_user') || localStorage.getItem('zyntra_user');
    const u = raw ? JSON.parse(raw) : null;
    const uname = (u?.primaryUsername || u?.username || '').toLowerCase().trim().replace(/^@/, '');
    const uid = String(u?.id || u?._id || '').toLowerCase().trim();
    return { uname, uid };
  } catch {
    return { uname: '', uid: '' };
  }
};

const extractDmOther = (dmId, knownHandle) => {
  const idStr = String(dmId || '').toLowerCase().trim();
  const handle = String(knownHandle || '').toLowerCase().trim().replace(/^@/, '');
  if (!idStr.startsWith('dm_') || !handle) return null;
  const body = idStr.slice(3);
  const prefix = `${handle}_`;
  const suffix = `_${handle}`;
  if (body.startsWith(prefix) && !body.endsWith(suffix)) {
    return body.slice(prefix.length) || null;
  }
  if (body.endsWith(suffix) && !body.startsWith(prefix)) {
    return body.slice(0, body.length - suffix.length) || null;
  }
  if (body.startsWith(prefix) && body.endsWith(suffix)) {
    const candAfter = body.slice(prefix.length);
    const candBefore = body.slice(0, body.length - suffix.length);
    return handle <= candAfter ? candAfter : candBefore;
  }
  return null;
};

const sanitizeDeletedChats = (list) => {
  if (!Array.isArray(list) || list.length === 0) return [];
  const { uname, uid } = getStoredUserInfo();
  const cleaned = list.filter((entry) => {
    const v = String(entry || '').toLowerCase().trim().replace(/^@/, '');
    if (!v) return false;
    if (uname && v === uname) return false;
    if (uid && v === uid) return false;
    return true;
  });
  if (cleaned.length !== list.length) {
    setCachedData('chatrooms_deleted_chats', cleaned);
  }
  return cleaned;
};

export const matchesChatId = (c, targetId) => {
  if (!c || !targetId) return false;
  const tid = String(targetId).toLowerCase().trim();
  const cid = String(c.id || '').toLowerCase().trim();
  const cUid = String(c.userId || c._id || '').toLowerCase().trim();
  const cUname = String(c.username || c.primaryUsername || '').toLowerCase().trim().replace(/^@/, '');
  const { uname: myUname } = getStoredUserInfo();

  if (cid === tid || (cUid && cUid === tid) || (cUname && cUname === tid)) {
    return true;
  }

  // Handle DM permutations cleanly even when usernames contain underscores
  if (tid.startsWith('dm_')) {
    const tOtherByC = cUname ? extractDmOther(tid, cUname) : null;
    const tOtherByMe = myUname ? extractDmOther(tid, myUname) : null;

    if (cUname && tOtherByMe && cUname === tOtherByMe) {
      return true;
    }
    if (cid.startsWith('dm_') && cUname && tOtherByC) {
      if (cid === `dm_${cUname}_${tOtherByC}` || cid === `dm_${tOtherByC}_${cUname}`) {
        return true;
      }
    }

    const tParts = tid.slice(3).split('_');
    if (tParts.length === 2) {
      const reversedTid = `dm_${tParts[1]}_${tParts[0]}`;
      if (cid === reversedTid) return true;
      if (!myUname && cUname && (cUname === tParts[0] || cUname === tParts[1])) return true;
      if (cid.startsWith('dm_')) {
        const cParts = cid.slice(3).split('_');
        if (cParts.length === 2) {
          const sortedT = [...tParts].sort().join('_');
          const sortedC = [...cParts].sort().join('_');
          if (sortedT === sortedC) return true;
        }
      }
    }
  }

  if (cid.startsWith('dm_')) {
    if (!myUname || tid !== myUname) {
      if (extractDmOther(cid, tid) !== null) {
        return true;
      }
      const cParts = cid.slice(3).split('_');
      if (cParts.length === 2 && (cParts[0] === tid || cParts[1] === tid)) {
        return true;
      }
    }
  }

  return false;
};

const getFilteredInitialContacts = () => {
  const cached = getCachedData('chatrooms_cached_contacts', []);
  const deleted = sanitizeDeletedChats(getCachedData('chatrooms_deleted_chats', []));
  if (!deleted || deleted.length === 0) return cached;
  return cached.filter((c) => !deleted.some((d) => matchesChatId(c, d)));
};

const getFilteredInitialGroups = () => {
  const cached = getCachedData('chatrooms_cached_groups', []);
  const deleted = sanitizeDeletedChats(getCachedData('chatrooms_deleted_chats', []));
  if (!deleted || deleted.length === 0) return cached;
  return cached.filter((g) => !deleted.some((d) => matchesChatId(g, d)));
};

export const useChatStore = create((set, get) => ({
  activeChat: null,
  contacts: getFilteredInitialContacts(),
  groups: getFilteredInitialGroups(),
  workspaces: getCachedData('chatrooms_cached_workspaces', []),
  messages: getCachedData('chatrooms_cached_messages', {}),
  unreadCounts: getCachedData('chatrooms_unread_counts', {}),
  typingStatus: {},
  onlineUsers: [],
  mutedChats: getInitialMutedChats(),
  blockedUsers: getInitialBlockedUsers(),
  isLoadingChats: false,
  isLoadingMessages: false,

  // Reset store for logout
  resetStore: () => {
    try {
      localStorage.removeItem('chatrooms_cached_contacts');
      localStorage.removeItem('chatrooms_cached_groups');
      localStorage.removeItem('chatrooms_cached_workspaces');
      localStorage.removeItem('chatrooms_cached_messages');
      localStorage.removeItem('chatrooms_unread_counts');
      localStorage.removeItem('chatrooms_deleted_chats');
    } catch {}
    set({
      activeChat: null,
      contacts: [],
      groups: [],
      workspaces: [],
      messages: {},
      unreadCounts: {},
      typingStatus: {},
      onlineUsers: [],
    });
  },

  // Initialize all chat streams (Contacts, Groups, Workspaces)
  loadChats: async (silent = false) => {
    const hasData =
      (get().contacts && get().contacts.length > 0) ||
      (get().groups && get().groups.length > 0) ||
      (get().workspaces && get().workspaces.length > 0);

    // Never show skeleton or blank screen if we already have chats
    if (!silent && !hasData) {
      set({ isLoadingChats: true });
    }
    try {
      const [contactsRes, workspacesRes] = await Promise.all([
        api.contacts.list(),
        api.workspaces.list(),
      ]);

      const prevContacts = get().contacts || [];
      const prevGroups = get().groups || [];
      const prevWorkspaces = get().workspaces || [];

      let rawContacts = prevContacts;
      let rawGroups = prevGroups;
      if (contactsRes.ok && contactsRes.data) {
        rawContacts = Array.isArray(contactsRes.data.contacts) ? contactsRes.data.contacts : prevContacts;
        rawGroups = Array.isArray(contactsRes.data.groups) ? contactsRes.data.groups : prevGroups;
      }

      let rawWorkspaces = prevWorkspaces;
      if (workspacesRes.ok && workspacesRes.data) {
        rawWorkspaces = Array.isArray(workspacesRes.data)
          ? workspacesRes.data
          : Array.isArray(workspacesRes.data.workspaces)
          ? workspacesRes.data.workspaces
          : prevWorkspaces;
      }

      const deletedList = sanitizeDeletedChats(getCachedData('chatrooms_deleted_chats', []));
      const isBlacklisted = (item) => {
        if (!item || !deletedList || deletedList.length === 0) return false;
        return deletedList.some((d) => matchesChatId(item, d));
      };

      const safeContacts = rawContacts.filter((c) => !isBlacklisted(c));
      const safeGroups = rawGroups.filter((g) => !isBlacklisted(g));

      const activeOnline = (get().onlineUsers || []).map((x) => String(x).toLowerCase().replace(/^@/, ''));
      const contactsWithPresence = safeContacts.map((c) => {
        const uid = (c.userId || c.id || '').toString().toLowerCase();
        const uname = (c.username || c.primaryUsername || '').toLowerCase().replace(/^@/, '');
        const isOnline = activeOnline.includes(uid) || activeOnline.includes(uname);
        return {
          ...c,
          status: isOnline ? 'online' : (activeOnline.length > 0 ? 'offline' : (c.status || 'offline')),
          online: isOnline || (activeOnline.length === 0 && c.status === 'online'),
        };
      });

      set((state) => {
        // Reconcile server-computed unread counts so offline messages surface badges cleanly
        const nextUnread = { ...(state.unreadCounts || {}) };
        let unreadChanged = false;
        const currActive = state.activeChat;

        [...contactsWithPresence, ...safeGroups].forEach((item) => {
          if (item?.id && typeof item.unreadCount === 'number' && item.unreadCount > 0) {
            const isCurrentlyOpen = currActive && matchesChatId(currActive, item.id);
            if (!isCurrentlyOpen && (nextUnread[item.id] || 0) < item.unreadCount) {
              nextUnread[item.id] = item.unreadCount;
              unreadChanged = true;
            }
          }
        });
        if (unreadChanged) {
          setCachedData('chatrooms_unread_counts', nextUnread);
        }

        return {
          contacts: contactsWithPresence,
          groups: safeGroups,
          workspaces: rawWorkspaces,
          unreadCounts: unreadChanged ? nextUnread : state.unreadCounts,
          isLoadingChats: false,
        };
      });

      // Cache locally for instant loading without disappearing on future auto-reloads
      setCachedData('chatrooms_cached_contacts', contactsWithPresence);
      setCachedData('chatrooms_cached_groups', safeGroups);
      setCachedData('chatrooms_cached_workspaces', rawWorkspaces);

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
    if (!chat) return;
    let targetChat = chat;
    if (!targetChat.id && (targetChat.username || targetChat.primaryUsername)) {
      const { uname: myUname } = getStoredUserInfo();
      const targetU = (targetChat.primaryUsername || targetChat.username).toLowerCase().trim().replace(/^@/, '');
      const canonicalId = myUname ? `dm_${[myUname, targetU].sort().join('_')}` : `dm_${targetU}`;
      targetChat = { ...targetChat, id: canonicalId, username: targetU, type: targetChat.type || 'contact' };
    }
    if (!targetChat.id) return;

    const prev = get().activeChat;
    socketService.joinRoom(targetChat.id);

    set({ activeChat: targetChat });
    get().clearUnreadCount(targetChat.id, targetChat);
    get().markMessagesAsRead(targetChat.id);

    await get().loadMessages(targetChat.id, prev?.id === targetChat.id);
  },

  clearUnreadCount: (chatId, item = null) => {
    if (!chatId) return;
    const { uname: myUname } = getStoredUserInfo();
    set((state) => {
      const keys = [String(chatId).toLowerCase()];
      if (item) {
        if (item.id) keys.push(String(item.id).toLowerCase());
        if (item.username) keys.push(String(item.username).toLowerCase().replace(/^@/, ''));
        if (item.userId) keys.push(String(item.userId).toLowerCase());
        if (item.primaryUsername) keys.push(String(item.primaryUsername).toLowerCase().replace(/^@/, ''));
      }
      if (String(chatId).toLowerCase().startsWith('dm_')) {
        const partner = myUname ? extractDmOther(chatId, myUname) : null;
        if (partner && partner !== myUname) {
          keys.push(`dm_${myUname}_${partner}`, `dm_${partner}_${myUname}`, partner);
        } else {
          const parts = String(chatId).replace(/^dm_/i, '').split('_');
          if (parts.length === 2) {
            keys.push(`dm_${parts[1]}_${parts[0]}`.toLowerCase());
            if (parts[0].toLowerCase() !== myUname) keys.push(parts[0].toLowerCase());
            if (parts[1].toLowerCase() !== myUname) keys.push(parts[1].toLowerCase());
          }
        }
      }
      const next = { ...state.unreadCounts };
      let changed = false;
      Object.keys(next).forEach((k) => {
        if (keys.includes(k.toLowerCase())) {
          delete next[k];
          changed = true;
        }
      });
      if (!changed) return state;
      setCachedData('chatrooms_unread_counts', next);
      return { unreadCounts: next };
    });
  },

  getUnreadCount: (chatId, item = null) => {
    const counts = get().unreadCounts || {};
    if (!counts) return 0;
    if (counts[chatId]) return counts[chatId];
    const { uname: myUname } = getStoredUserInfo();
    const keys = [String(chatId).toLowerCase()];
    if (item) {
      if (item.id) keys.push(String(item.id).toLowerCase());
      if (item.username) keys.push(String(item.username).toLowerCase().replace(/^@/, ''));
      if (item.userId) keys.push(String(item.userId).toLowerCase());
      if (item.primaryUsername) keys.push(String(item.primaryUsername).toLowerCase().replace(/^@/, ''));
    }
    if (String(chatId).toLowerCase().startsWith('dm_')) {
      const partner = myUname ? extractDmOther(chatId, myUname) : null;
      if (partner && partner !== myUname) {
        keys.push(`dm_${myUname}_${partner}`, `dm_${partner}_${myUname}`, partner);
      } else {
        const parts = String(chatId).replace(/^dm_/i, '').split('_');
        if (parts.length === 2) {
          keys.push(`dm_${parts[1]}_${parts[0]}`.toLowerCase());
          if (parts[0].toLowerCase() !== myUname) keys.push(parts[0].toLowerCase());
          if (parts[1].toLowerCase() !== myUname) keys.push(parts[1].toLowerCase());
        }
      }
    }
    for (const k of keys) {
      if (counts[k]) return counts[k];
    }
    return 0;
  },

  closeChat: () => {
    set({ activeChat: null });
  },

  deleteChat: async (chatId, target = null) => {
    if (!chatId) return;

    const { uname: myUname, uid: myUid } = getStoredUserInfo();
    const deletedList = sanitizeDeletedChats(getCachedData('chatrooms_deleted_chats', []));
    const newDeleted = new Set(deletedList);
    newDeleted.add(String(chatId).toLowerCase());

    if (target) {
      if (target.id) newDeleted.add(String(target.id).toLowerCase());
      const tUid = String(target.userId || target._id || '').toLowerCase().trim();
      if (tUid && tUid !== myUid) newDeleted.add(tUid);
      const tUname = String(target.username || target.primaryUsername || '').toLowerCase().trim().replace(/^@/, '');
      if (tUname && tUname !== myUname) newDeleted.add(tUname);
    }

    if (String(chatId).toLowerCase().startsWith('dm_')) {
      const chatLower = String(chatId).toLowerCase();
      const partner = (myUname ? extractDmOther(chatLower, myUname) : null)
        || (target?.username ? String(target.username).toLowerCase().trim().replace(/^@/, '') : null);
      if (myUname && partner && partner !== myUname) {
        newDeleted.add(`dm_${myUname}_${partner}`);
        newDeleted.add(`dm_${partner}_${myUname}`);
        newDeleted.add(`dm_${[myUname, partner].sort().join('_')}`);
      } else {
        const parts = chatLower.replace(/^dm_/, '').split('_');
        if (parts.length === 2) {
          newDeleted.add(`dm_${parts[1]}_${parts[0]}`);
          newDeleted.add(`dm_${[...parts].sort().join('_')}`);
        }
      }
      if (partner && partner !== myUname) {
        newDeleted.add(partner);
      }
    }

    setCachedData('chatrooms_deleted_chats', Array.from(newDeleted));

    set((state) => {
      const nextMessages = { ...state.messages };
      delete nextMessages[chatId];
      if (String(chatId).toLowerCase().startsWith('dm_')) {
        const chatLower = String(chatId).toLowerCase();
        const partner = myUname ? extractDmOther(chatLower, myUname) : null;
        if (myUname && partner && partner !== myUname) {
          delete nextMessages[`dm_${myUname}_${partner}`];
          delete nextMessages[`dm_${partner}_${myUname}`];
          delete nextMessages[`dm_${[myUname, partner].sort().join('_')}`];
        } else {
          const parts = chatLower.replace(/^dm_/, '').split('_');
          if (parts.length === 2) {
            delete nextMessages[`dm_${parts[1]}_${parts[0]}`];
            delete nextMessages[`dm_${[...parts].sort().join('_')}`];
          }
        }
      }

      const nextContacts = state.contacts.filter(
        (c) => !matchesChatId(c, chatId) && (!target || !matchesChatId(c, target.id || target.username))
      );
      const nextGroups = state.groups.filter(
        (g) => !matchesChatId(g, chatId) && g.parentGroupId !== chatId
      );
      const nextActiveChat =
        matchesChatId(state.activeChat, chatId) || state.activeChat?.parentGroupId === chatId
          ? null
          : state.activeChat;

      setCachedData('chatrooms_cached_contacts', nextContacts);
      setCachedData('chatrooms_cached_groups', nextGroups);
      setCachedData('chatrooms_cached_messages', nextMessages);

      return {
        groups: nextGroups,
        contacts: nextContacts,
        messages: nextMessages,
        activeChat: nextActiveChat,
      };
    });

    try {
      await Promise.allSettled([
        api.messages.clearChat(chatId),
        api.contacts.delete(chatId),
        api.contacts.deleteGroup(chatId),
      ]);
    } catch (e) {
      console.warn('[chatStore] Failed to delete chat on server:', e);
    }
  },

  removeChat: async (chatId, action = 'leave') => {
    if (action === 'delete') {
      get().deleteChat(chatId);
      return;
    }
    // Leave group or remove contact
    set((state) => {
      const nextGroups = state.groups.filter((g) => !matchesChatId(g, chatId));
      const nextContacts = state.contacts.filter((c) => !matchesChatId(c, chatId));
      const nextActiveChat = matchesChatId(state.activeChat, chatId) ? null : state.activeChat;
      setCachedData('chatrooms_cached_contacts', nextContacts);
      setCachedData('chatrooms_cached_groups', nextGroups);
      return {
        groups: nextGroups,
        contacts: nextContacts,
        activeChat: nextActiveChat,
      };
    });
    try {
      await api.contacts.deleteGroup(chatId);
    } catch (e) {
      console.warn('[chatStore] Failed to leave group on server:', e);
    }
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
      const localList = get().messages[chatId] || [];
      let rawList = localList;

      if (res.ok && Array.isArray(res.data)) {
        const serverMsgs = res.data;
        const serverIds = new Set(serverMsgs.map((m) => m.id || m._id).filter(Boolean));
        const nowMs = Date.now();
        // Preserve in-flight optimistic messages or very recent (< 2m) local socket messages not yet flushed to DB
        const pendingLocal = localList.filter((m) => {
          const mid = m.id || m._id;
          if (mid && serverIds.has(mid)) return false;
          const ageMs = nowMs - new Date(m.timestamp || 0).getTime();
          return Boolean(m._optimistic) || (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 120000);
        });

        rawList = [...serverMsgs, ...pendingLocal].sort(
          (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
        );
      }

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

      set((state) => {
        const next = {
          ...state.messages,
          [chatId]: list,
        };
        setCachedData('chatrooms_cached_messages', next);
        return {
          messages: next,
          isLoadingMessages: false,
        };
      });
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  // Mark messages in a conversation as read (1 tick -> 2 ticks for sender)
  markMessagesAsRead: (chatId) => {
    if (!chatId) return;
    const { uid: currentUid, uname: currentUname } = getStoredUserInfo();

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

  // Send message with instant optimistic update and single-path ack/fallback persistence
  sendMessage: async (chatId, content, attachment = null, currentUser, extra = {}) => {
    if (!chatId || (!content?.trim() && !attachment && !extra?.callDetails)) return;

    const { uname: myUname } = getStoredUserInfo();
    const senderUname = (currentUser?.primaryUsername || currentUser?.username || myUname || '').toLowerCase().trim().replace(/^@/, '');

    let recipientUsername = extra?.recipientUsername || '';
    if (!recipientUsername && String(chatId).startsWith('dm_')) {
      const matchedContact = (get().contacts || []).find((c) => matchesChatId(c, chatId));
      const active = get().activeChat;
      recipientUsername =
        matchedContact?.username ||
        (active && matchesChatId(active, chatId) ? active.username : '') ||
        extractDmOther(chatId, senderUname) ||
        '';
    }

    const derivedChatType = extra?.chatType || (
      String(chatId).startsWith('dm_')
        ? 'direct'
        : String(chatId).startsWith('group-') || String(chatId).startsWith('subgroup-')
        ? 'group'
        : 'workspace-node'
    );

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const optimisticMessage = {
      id: messageId,
      chatId,
      chatType: derivedChatType,
      content: content ? content.trim() : '',
      type: extra?.type || attachment?.type || 'text',
      callDetails: extra?.callDetails || null,
      attachment: attachment || null,
      senderId: currentUser?.id || currentUser?._id || 'user-1',
      senderName: currentUser?.name || 'You',
      senderUsername: senderUname,
      senderAvatar: currentUser?.avatar || null,
      recipientUsername: recipientUsername ? recipientUsername.toLowerCase().trim().replace(/^@/, '') : undefined,
      reactions: [],
      isForwarded: Boolean(extra?.isForwarded),
      timestamp: nowIso,
      _optimistic: true,
      ...extra,
    };

    // 1. Optimistic UI update + debounced local cache
    set((state) => {
      const existing = state.messages[chatId] || [];
      const nextMap = {
        ...state.messages,
        [chatId]: [...existing, optimisticMessage],
      };
      setCachedData('chatrooms_cached_messages', nextMap);
      return { messages: nextMap };
    });

    const finalizeMessage = (persistedMsg) => {
      set((state) => {
        const list = state.messages[chatId] || [];
        let changed = false;
        const updated = list.map((m) => {
          if (m.id === messageId) {
            changed = true;
            const merged = persistedMsg ? { ...m, ...persistedMsg } : { ...m };
            delete merged._optimistic;
            return merged;
          }
          return m;
        });
        if (!changed) return state;
        const nextMap = { ...state.messages, [chatId]: updated };
        setCachedData('chatrooms_cached_messages', nextMap);
        return { messages: nextMap };
      });
    };

    // 2. Socket-first with Ack; fall back to HTTP only if socket is disconnected or ack times out
    const httpPayload = {
      ...optimisticMessage,
    };
    delete httpPayload._optimistic;

    if (socketService.isConnected()) {
      let settled = false;
      const fallbackTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          api.messages
            .send(chatId, httpPayload)
            .then((res) => finalizeMessage(res?.ok ? res.data : null))
            .catch((e) => console.error('Fallback HTTP send failed:', e));
        }
      }, 5000);

      socketService.sendMessage(httpPayload, (ack) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        if (ack?.ok) {
          finalizeMessage(ack.message || null);
        } else {
          api.messages
            .send(chatId, httpPayload)
            .then((res) => finalizeMessage(res?.ok ? res.data : null))
            .catch((e) => console.error('HTTP retry send failed:', e));
        }
      });
    } else {
      api.messages
        .send(chatId, httpPayload)
        .then((res) => finalizeMessage(res?.ok ? res.data : null))
        .catch((e) => console.error('HTTP send failed:', e));
    }

    // 3. Update last message preview immediately in sidebar
    const previewText = extra?.type === 'call'
      ? (extra?.callDetails?.isVideo ? '📹 ' : '📞 ') + (optimisticMessage.content || 'Call')
      : (optimisticMessage.content || (attachment?.type === 'image' ? '📷 Photo' : '📎 Attachment'));
    set((state) => ({
      contacts: state.contacts
        .map((c) =>
          matchesChatId(c, chatId) ? { ...c, lastMessage: previewText, lastMessageTime: nowIso } : c
        )
        .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)),
      groups: state.groups
        .map((g) =>
          matchesChatId(g, chatId) ? { ...g, lastMessage: previewText, lastMessageTime: nowIso } : g
        )
        .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)),
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

    // Un-blacklist this chat if the user had previously deleted it and a new message arrived
    const prevDeleted = getCachedData('chatrooms_deleted_chats', []);
    if (Array.isArray(prevDeleted) && prevDeleted.length > 0) {
      const chatLower = String(chatId).toLowerCase();
      const cleanedDeleted = prevDeleted.filter((d) => {
        const dl = String(d || '').toLowerCase();
        return dl !== chatLower && dl !== senderUname && dl !== senderUid;
      });
      if (cleanedDeleted.length !== prevDeleted.length) {
        setCachedData('chatrooms_deleted_chats', cleanedDeleted);
      }
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

    let wasDuplicate = false;
    set((state) => {
      const existing = state.messages[chatId] || [];
      if (existing.some((m) => m.id === safeMsg.id)) {
        wasDuplicate = true;
        return state;
      }
      const nextMap = {
        ...state.messages,
        [chatId]: [...existing, safeMsg],
      };
      setCachedData('chatrooms_cached_messages', nextMap);
      return { messages: nextMap };
    });

    if (wasDuplicate) return;

    const preview = message.type === 'call'
      ? (message.callDetails?.isVideo ? '📹 ' : '📞 ') + (message.content || 'Call')
      : (message.content || (message.attachment?.type === 'image' ? '📷 Photo' : '📎 Attachment'));
    const msgTime = message.timestamp || new Date().toISOString();

    const { uname: myUname, uid: myUid } = getStoredUserInfo();
    const isFromSelf = (myUid && senderUid === myUid) || (myUname && senderUname === myUname);

    // Unread count & instant mark read reconciliation
    const activeChat = get().activeChat;
    const isActive = Boolean(
      activeChat && (
        activeChat.id === chatId ||
        matchesChatId(activeChat, chatId)
      )
    );

    if (isActive) {
      get().clearUnreadCount(chatId, activeChat);
      if (!isFromSelf) {
        get().markMessagesAsRead(chatId);
      }
    } else if (!isFromSelf) {
      set((state) => {
        const prevCount = state.unreadCounts[chatId] || 0;
        const next = {
          ...state.unreadCounts,
          [chatId]: prevCount + 1,
        };
        setCachedData('chatrooms_unread_counts', next);
        return { unreadCounts: next };
      });
    }

    const hasContact = get().contacts.some((c) => matchesChatId(c, chatId));
    const hasGroup = get().groups.some((g) => matchesChatId(g, chatId));
    const hasWorkspaceNode = get().workspaces.some((ws) => (ws.nodes || []).some((n) => n.id === chatId));

    if (!hasContact && !hasGroup && !hasWorkspaceNode) {
      // New conversation initiated by another user: optimistically inject into sidebar immediately, then sync!
      if (String(chatId).startsWith('dm_') && !isFromSelf) {
        const partnerHandle = senderUname || extractDmOther(chatId, myUname) || chatId;
        const optimisticContact = {
          id: chatId,
          userId: message.senderId,
          username: partnerHandle,
          name: message.senderName || partnerHandle,
          avatar: message.senderAvatar || null,
          status: 'online',
          online: true,
          lastMessage: preview,
          lastMessageTime: msgTime,
          type: 'contact',
        };
        set((state) => {
          if (state.contacts.some((c) => matchesChatId(c, chatId))) return state;
          const nextContacts = [optimisticContact, ...state.contacts];
          setCachedData('chatrooms_cached_contacts', nextContacts);
          return { contacts: nextContacts };
        });
      }
      get().loadChats(true);
    } else {
      set((state) => ({
        contacts: state.contacts
          .map((c) =>
            matchesChatId(c, chatId)
              ? { ...c, lastMessage: preview, lastMessageTime: msgTime }
              : c
          )
          .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)),
        groups: state.groups
          .map((g) =>
            matchesChatId(g, chatId)
              ? { ...g, lastMessage: preview, lastMessageTime: msgTime }
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
    const cleanUsername = String(username || '').replace(/^@/, '').trim().toLowerCase();
    if (!cleanUsername) return { success: false, error: 'Invalid username' };

    const { uname: myUname } = getStoredUserInfo();
    const canonicalDmId = myUname ? `dm_${[myUname, cleanUsername].sort().join('_')}` : `dm_${cleanUsername}`;
    const reversedDmId = myUname ? `dm_${cleanUsername}_${myUname}` : '';
    const forwardDmId = myUname ? `dm_${myUname}_${cleanUsername}` : '';

    // Un-blacklist this contact/DM immediately if it was previously deleted
    try {
      const deletedList = sanitizeDeletedChats(getCachedData('chatrooms_deleted_chats', []));
      if (deletedList.length > 0) {
        const probe = { id: canonicalDmId, username: cleanUsername, primaryUsername: cleanUsername };
        const filteredDeleted = deletedList.filter((d) => {
          const dl = String(d || '').toLowerCase().trim().replace(/^@/, '');
          if (dl === cleanUsername || dl === canonicalDmId || (reversedDmId && dl === reversedDmId) || (forwardDmId && dl === forwardDmId)) {
            return false;
          }
          return !matchesChatId(probe, dl);
        });
        if (filteredDeleted.length !== deletedList.length) {
          setCachedData('chatrooms_deleted_chats', filteredDeleted);
        }
      }
    } catch {}

    const res = await api.contacts.add(cleanUsername);
    if (res.ok && res.data) {
      const contactData = res.data.data || res.data;
      try {
        const deletedList = sanitizeDeletedChats(getCachedData('chatrooms_deleted_chats', []));
        if (deletedList.length > 0) {
          const filteredDeleted = deletedList.filter((d) => !matchesChatId(contactData, d));
          if (filteredDeleted.length !== deletedList.length) {
            setCachedData('chatrooms_deleted_chats', filteredDeleted);
          }
        }
      } catch {}

      set((state) => {
        const existingIdx = state.contacts.findIndex(
          (c) => matchesChatId(c, contactData.id) || (contactData.username && matchesChatId(c, contactData.username))
        );
        const nextContacts =
          existingIdx >= 0
            ? state.contacts.map((c, idx) => (idx === existingIdx ? { ...c, ...contactData } : c))
            : [contactData, ...state.contacts];
        setCachedData('chatrooms_cached_contacts', nextContacts);
        return { contacts: nextContacts };
      });
      // Sync in background so tapping Chat is never blocked by full workspace/contact reload
      get().loadChats(true).catch(() => {});
      return { success: true, contact: contactData };
    }

    return { success: false, error: res.error || res.data?.message || 'Failed to add contact' };
  },

  createGroup: async (name, description = '', parentGroupId = null, members = []) => {
    const res = await api.contacts.createGroup({ name, description, parentGroupId, members });
    if (res.ok && res.data) {
      const groupData = res.data.data || res.data;
      await get().loadChats(true);
      return { success: true, group: groupData };
    }

    // Local fallback creation
    const newGroup = {
      id: parentGroupId ? `subgroup-${Date.now()}` : `group-${Date.now()}`,
      name,
      description,
      membersCount: Array.isArray(members) && members.length > 0 ? members.length + 1 : 1,
      parentGroupId: parentGroupId || null,
      lastMessage: parentGroupId ? 'Subgroup created' : 'Group created',
      lastMessageTime: new Date().toISOString(),
      type: 'group',
    };
    set((state) => ({
      groups: [newGroup, ...state.groups],
    }));
    return { success: true, group: newGroup };
  },

  updateGroup: async (groupId, updateData) => {
    try {
      const res = await api.contacts.updateGroup(groupId, updateData);
      if (res.ok && res.data?.data) {
        const updated = res.data.data;
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? { ...g, ...updated } : g)),
          activeChat: state.activeChat?.id === groupId ? { ...state.activeChat, ...updated } : state.activeChat,
        }));
        return { success: true, group: updated };
      }
      return { success: false, error: res.error || 'Failed to update group' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  addGroupMember: async (groupId, username) => {
    try {
      const res = await api.contacts.addGroupMember(groupId, username);
      if (res.ok && res.data?.data) {
        const { member } = res.data.data;
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id === groupId) {
              const members = [...(g.members || []), member];
              return { ...g, members, membersCount: members.length };
            }
            return g;
          }),
          activeChat: state.activeChat?.id === groupId ? {
            ...state.activeChat,
            members: [...(state.activeChat.members || []), member],
            membersCount: (state.activeChat.members?.length || 0) + 1,
          } : state.activeChat,
        }));
        return { success: true, member };
      }
      return { success: false, error: res.error || res.data?.message || 'Failed to add member' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  removeGroupMember: async (groupId, memberIdOrUsername) => {
    try {
      const res = await api.contacts.removeGroupMember(groupId, memberIdOrUsername);
      if (res.ok) {
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id === groupId) {
              const members = (g.members || []).filter(
                (m) => m.id !== memberIdOrUsername && m.username !== memberIdOrUsername
              );
              return { ...g, members, membersCount: Math.max(1, members.length) };
            }
            return g;
          }),
          activeChat: state.activeChat?.id === groupId ? {
            ...state.activeChat,
            members: (state.activeChat.members || []).filter(
              (m) => m.id !== memberIdOrUsername && m.username !== memberIdOrUsername
            ),
            membersCount: Math.max(1, (state.activeChat.members?.length || 1) - 1),
          } : state.activeChat,
        }));
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to remove member' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  createWorkspace: async (name, contextualUsername = '') => {
    try {
      const res = await api.workspaces.create({ name, contextualUsername });
      if (res.ok && res.data) {
        await get().loadChats(true);
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
        await get().loadChats(true);
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
        await get().loadChats(true);
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
