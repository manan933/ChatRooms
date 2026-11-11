import jwt from 'jsonwebtoken';
import storageService from '../services/storageService.js';
import WorkspaceNode from '../models/WorkspaceNode.js';
import {
  extractDmParticipants,
  getDmPartner,
  normalizeUsername,
  registerKnownUsernames,
} from '../utils/dmHelper.js';

// Global active presence registry:
// Map of userId / lowercased username -> Set of active socket IDs
const userSockets = new Map();

export const getOnlineUsersList = () => {
  const list = [];
  for (const [key, sockets] of userSockets.entries()) {
    if (sockets && sockets.size > 0) {
      list.push(key);
    }
  }
  return list;
};

export const setupChatSocket = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'chatrooms_jwt_secret_dev_key_2026');
      } catch {
        decoded = jwt.verify(token, 'zyntra_jwt_secret_dev_key_2026');
      }
      let user = null;
      if (decoded.id) {
        try {
          user = await storageService.getUserById(decoded.id);
        } catch {}
      }
      const cleanUname = normalizeUsername(user?.primaryUsername || decoded.primaryUsername || '');
      if (cleanUname) {
        registerKnownUsernames([cleanUname]);
      }
      socket.user = {
        id: user?._id?.toString() || user?.id || decoded.id,
        _id: user?._id?.toString() || user?.id || decoded.id,
        primaryUsername: cleanUname,
        username: cleanUname,
        name: user?.name || decoded.name || 'User',
        avatar: storageService.sanitizeAvatar(user?.avatar || decoded.avatar),
      };
      next();
    } catch {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // Shared helper: fan out an event once per unique recipient socket across room + DM inbox rooms
  const broadcastChatEvent = (sourceSocket, chatId, eventName, payload, { knownUser = '', recipientHint = '', excludeSenderSocket = true } = {}) => {
    const rooms = new Set();
    if (chatId) rooms.add(chatId);
    if (chatId && chatId.startsWith('dm_')) {
      const participants = extractDmParticipants(chatId, knownUser, recipientHint ? [recipientHint] : []);
      for (const p of participants) {
        const cleanP = normalizeUsername(p);
        if (cleanP) rooms.add(`user_${cleanP}`);
      }
    }
    const roomList = Array.from(rooms);
    if (roomList.length === 0) return;

    let emitter = io.to(roomList[0]);
    for (let i = 1; i < roomList.length; i += 1) {
      emitter = emitter.to(roomList[i]);
    }
    if (excludeSenderSocket && sourceSocket?.id) {
      emitter = emitter.except(sourceSocket.id);
    }
    emitter.emit(eventName, payload);
  };

  // Auto-join user's DM, personal group, and workspace channel rooms on socket connect
  const autoJoinUserRooms = async (socket, uId, uName) => {
    try {
      const [conversations, nodes] = await Promise.all([
        storageService.getUserConversations(uId, uName),
        WorkspaceNode.find({}, 'id').lean(),
      ]);
      const roomIds = [];
      (conversations?.contacts || []).forEach((c) => {
        if (c?.id) roomIds.push(c.id);
      });
      (conversations?.groups || []).forEach((g) => {
        if (g?.id) roomIds.push(g.id);
      });
      (nodes || []).forEach((n) => {
        if (n?.id) roomIds.push(n.id);
      });
      if (roomIds.length > 0) {
        socket.join(roomIds);
      }
    } catch (err) {
      console.warn('[Socket.io] autoJoinUserRooms warning:', err.message);
    }
  };

  io.on('connection', (socket) => {
    const rawUserId = socket.user?.id || socket.user?._id;
    const userId = rawUserId ? rawUserId.toString() : '';
    const rawUsername = socket.user?.primaryUsername || socket.user?.username || '';
    const username = normalizeUsername(rawUsername);

    // Register user socket in presence tracking
    const registerPresence = (uId, uName) => {
      const keys = [uId, uName].filter(Boolean);
      let wasOffline = false;

      keys.forEach((key) => {
        const clean = normalizeUsername(key);
        if (!userSockets.has(clean)) {
          userSockets.set(clean, new Set());
        }
        const s = userSockets.get(clean);
        if (s.size === 0) wasOffline = true;
        s.add(socket.id);
      });

      if (wasOffline) {
        io.emit('user_status', {
          userId: uId || userId,
          username: normalizeUsername(uName || username),
          status: 'online',
        });
        if (uId || userId) {
          storageService.updateUserStatus(uId || userId, 'online').catch(() => {});
        }
      }
    };

    if (userId || username) {
      registerPresence(userId, username);
    }

    // Automatically join user's private inbox rooms and all known conversations in background
    if (userId) {
      socket.join(`user_${userId}`);
    }
    if (username) {
      socket.join(`user_${username}`);
      registerKnownUsernames([username]);
    }
    if (userId || username) {
      autoJoinUserRooms(socket, userId, username);
    }

    console.log(`[Socket.io] Connected: ${socket.id} (user_${username || userId})`);

    // Send currently online users list to this connected client immediately
    socket.emit('online_users_list', getOnlineUsersList());

    // Dynamic registration handler
    socket.on('register_user', (payload) => {
      try {
        const { userId: uId, username: uName } = payload || {};
        if (uId) socket.join(`user_${uId}`);
        if (uName) {
          const clean = normalizeUsername(uName);
          socket.join(`user_${clean}`);
          registerKnownUsernames([clean]);
          registerPresence(uId, clean);
        }
        if (uId || uName) {
          autoJoinUserRooms(socket, uId || userId, uName || username);
        }
        socket.emit('online_users_list', getOnlineUsersList());
      } catch (err) {
        console.error('[Socket.io] Error in register_user:', err.message);
      }
    });

    // Request full list of currently online users
    socket.on('get_online_users', () => {
      try {
        socket.emit('online_users_list', getOnlineUsersList());
      } catch (err) {
        console.error('[Socket.io] Error in get_online_users:', err.message);
      }
    });

    // Join a specific chat room (channel, DM, or personal group)
    socket.on('join_room', (roomId) => {
      try {
        if (!roomId) return;
        socket.join(roomId);
      } catch (err) {
        console.error('[Socket.io] Error in join_room:', err.message);
      }
    });

    // Leave a room
    socket.on('leave_room', (roomId) => {
      try {
        if (!roomId) return;
        socket.leave(roomId);
      } catch (err) {
        console.error('[Socket.io] Error in leave_room:', err.message);
      }
    });

    // Handle incoming message with ZERO LATENCY optimistic broadcast
    socket.on('send_message', (data, ack) => {
      try {
        const {
          id,
          chatId,
          content,
          type,
          callDetails,
          senderId,
          senderName,
          senderUsername,
          senderAvatar,
          recipientUsername,
          chatType,
          attachment,
          timestamp,
        } = data || {};

        if (!chatId || (!content?.trim() && !attachment && type !== 'call')) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Empty message' });
          return;
        }

        const messageId = id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const finalContent = content ? content.trim() : '';
        const now = timestamp || new Date().toISOString();
        const cleanSenderUname = normalizeUsername(senderUsername || username);
        if (cleanSenderUname) registerKnownUsernames([cleanSenderUname]);
        if (recipientUsername) registerKnownUsernames([recipientUsername]);

        let finalAttachment = null;
        if (attachment) {
          const att = { ...attachment };
          const name = att.name || '';
          const url = att.url || '';
          const mime = att.mimeType || '';
          const isImg =
            att.type === 'image' ||
            mime.startsWith('image/') ||
            url.startsWith('data:image/') ||
            /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)($|\?|#)/i.test(name || url);

          att.type = isImg ? 'image' : (att.type || 'file');
          if (isImg && !att.mimeType) {
            att.mimeType = 'image/jpeg';
          }
          finalAttachment = att;
        }

        const safeAvatar = storageService.sanitizeAvatar(senderAvatar) || socket.user?.avatar || null;

        const messagePayload = {
          id: messageId,
          chatId,
          chatType: chatType || (chatId.startsWith('dm_') ? 'direct' : 'workspace-node'),
          senderId: userId || senderId || 'user-1',
          senderName: senderName || socket.user?.name || 'User',
          senderUsername: cleanSenderUname,
          senderAvatar: safeAvatar,
          recipientUsername: recipientUsername ? normalizeUsername(recipientUsername) : undefined,
          content: finalContent,
          type: type || (finalAttachment?.type || 'text'),
          callDetails: callDetails || null,
          attachment: finalAttachment,
          isForwarded: Boolean(data?.isForwarded),
          reactions: [],
          timestamp: now,
        };

        // 1. INSTANT BROADCAST (sub-10ms): Deliver once per unique socket across room + DM user inboxes
        broadcastChatEvent(socket, chatId, 'receive_message', messagePayload, {
          knownUser: cleanSenderUname,
          recipientHint: recipientUsername,
          excludeSenderSocket: true,
        });

        // Ensure recipient/sender sockets present in this DM join the room too
        if (chatId.startsWith('dm_')) {
          socket.join(chatId);
        }

        // 2. Persist to MongoDB Atlas asynchronously and acknowledge when saved
        storageService
          .saveMessage(messagePayload)
          .then((saved) => {
            if (typeof ack === 'function') {
              ack({ ok: true, id: messageId, message: saved });
            }
          })
          .catch((err) => {
            console.error('[DB] Background saveMessage error:', err.message);
            if (typeof ack === 'function') {
              ack({ ok: false, id: messageId, error: err.message });
            }
          });
      } catch (err) {
        console.error('[Socket.io] Error in send_message handler:', err.message);
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    // Handle real-time read receipt / seen status
    socket.on('mark_read', async ({ chatId, userId: uId, username: uName }) => {
      try {
        const targetRoom = chatId;
        if (!targetRoom) return;
        const readerId = uId || userId;
        const readerUsername = normalizeUsername(uName || username);

        // Emit immediately so sender sees double blue tick without waiting on DB round-trip
        broadcastChatEvent(
          socket,
          targetRoom,
          'messages_read',
          {
            chatId: targetRoom,
            readerId,
            readerUsername,
          },
          { knownUser: readerUsername, excludeSenderSocket: true }
        );

        await storageService.markMessagesRead(targetRoom, readerId, readerUsername);
      } catch (err) {
        console.error('[Socket.io] Error in mark_read handler:', err.message);
      }
    });

    // Handle typing status with multi-recipient routing
    socket.on('typing_start', (data) => {
      try {
        const { roomId, chatId, userName, userId: uId } = data || {};
        const targetRoom = roomId || chatId;
        if (!targetRoom) return;

        const payload = {
          roomId: targetRoom,
          chatId: targetRoom,
          userId: uId || userId,
          userName: userName || socket.user?.name || username || 'Someone',
          isTyping: true,
        };

        broadcastChatEvent(socket, targetRoom, 'user_typing', payload, {
          knownUser: username,
          excludeSenderSocket: true,
        });
      } catch (err) {
        console.error('[Socket.io] Error in typing_start:', err.message);
      }
    });

    socket.on('typing_stop', (data) => {
      try {
        const { roomId, chatId, userId: uId, userName } = data || {};
        const targetRoom = roomId || chatId;
        if (!targetRoom) return;

        const payload = {
          roomId: targetRoom,
          chatId: targetRoom,
          userId: uId || userId,
          userName: userName || socket.user?.name || username || 'Someone',
          isTyping: false,
        };

        broadcastChatEvent(socket, targetRoom, 'user_typing', payload, {
          knownUser: username,
          excludeSenderSocket: true,
        });
      } catch (err) {
        console.error('[Socket.io] Error in typing_stop:', err.message);
      }
    });

    // Handle real-time reactions with instant broadcast
    socket.on('send_reaction', async ({ messageId, emoji, userId: uId, chatId, action }) => {
      try {
        const uid = uId || userId || socket.user?._id?.toString() || socket.user?.id || 'user-1';
        const cleanEmoji = emoji ? String(emoji).trim() : '👍';

        const updatedMsg = await storageService.addReaction(messageId, cleanEmoji, uid, action);
        if (!updatedMsg) return;

        const targetChatId = updatedMsg.chatId || chatId;
        const reactionPayload = {
          id: messageId,
          messageId,
          chatId: targetChatId,
          reactions: updatedMsg.reactions || [],
        };

        if (targetChatId) {
          broadcastChatEvent(socket, targetChatId, 'update_reaction', reactionPayload, {
            knownUser: username,
            excludeSenderSocket: false,
          });
        }
      } catch (err) {
        console.error('[Socket.io] Error in send_reaction handler:', err.message);
      }
    });

    // Helper to resolve clean target username from username, id, or canonical dm_ room
    const resolvePeerTarget = (target) => {
      if (!target) return '';
      const clean = normalizeUsername(target);
      if (clean.startsWith('dm_')) {
        return getDmPartner(clean, username) || clean;
      }
      return clean;
    };

    const emitSignaling = (eventName, payload, cleanTarget, chatId) => {
      const rooms = [];
      if (cleanTarget) rooms.push(`user_${cleanTarget}`);
      if (chatId) rooms.push(chatId);
      if (rooms.length === 0) return;

      // Chaining .to() in Socket.io sends once per unique socket and never echoes back to sender
      let emitter = io.to(rooms[0]);
      for (let i = 1; i < rooms.length; i += 1) {
        emitter = emitter.to(rooms[i]);
      }
      emitter.except(socket.id).emit(eventName, payload);
    };

    // ── WebRTC Voice & Video Call Signaling ──────────────────────────
    socket.on('call_user', (data) => {
      try {
        const { userToCall, signalData, isVideo, chatId, callId } = data || {};
        if (!userToCall && !chatId) return;
        const cleanTarget = resolvePeerTarget(userToCall);
        const callerInfo = {
          callId: callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          from: username || userId,
          callerId: userId,
          callerUsername: username,
          callerName: socket.user?.name || username || 'User',
          callerAvatar: socket.user?.avatar || null,
          signalData,
          isVideo: Boolean(isVideo),
          chatId,
        };

        emitSignaling('call_incoming', callerInfo, cleanTarget, chatId);
      } catch (err) {
        console.error('[Socket.io] Error in call_user:', err.message);
      }
    });

    socket.on('answer_call', (data) => {
      try {
        const { to, signalData, callId, chatId } = data || {};
        if (!to && !chatId) return;
        const cleanTarget = resolvePeerTarget(to);
        const payload = {
          callId,
          from: username || userId,
          signalData,
        };
        emitSignaling('call_answered', payload, cleanTarget, chatId);
      } catch (err) {
        console.error('[Socket.io] Error in answer_call:', err.message);
      }
    });

    socket.on('ice_candidate', (data) => {
      try {
        const { to, candidate, callId, chatId } = data || {};
        if (!candidate) return;
        const cleanTarget = resolvePeerTarget(to);
        const payload = {
          callId,
          from: username || userId,
          candidate,
        };
        emitSignaling('ice_candidate', payload, cleanTarget, chatId);
      } catch (err) {
        console.error('[Socket.io] Error in ice_candidate:', err.message);
      }
    });

    socket.on('end_call', (data) => {
      try {
        const { to, chatId, callId } = data || {};
        const cleanTarget = resolvePeerTarget(to);
        const payload = {
          callId,
          from: username || userId,
        };
        emitSignaling('call_ended', payload, cleanTarget, chatId);
      } catch (err) {
        console.error('[Socket.io] Error in end_call:', err.message);
      }
    });

    socket.on('reject_call', (data) => {
      try {
        const { to, chatId, callId } = data || {};
        const cleanTarget = resolvePeerTarget(to);
        const payload = {
          callId,
          from: username || userId,
        };
        emitSignaling('call_rejected', payload, cleanTarget, chatId);
      } catch (err) {
        console.error('[Socket.io] Error in reject_call:', err.message);
      }
    });

    socket.on('disconnect', () => {
      try {
        const keys = [userId, username].filter(Boolean);
        keys.forEach((key) => {
          const clean = key.toLowerCase().replace(/^@/, '');
          const s = userSockets.get(clean);
          if (s) {
            s.delete(socket.id);
            if (s.size === 0) {
              userSockets.delete(clean);
              io.emit('user_status', {
                userId,
                username: (username || '').toLowerCase().replace(/^@/, ''),
                status: 'offline',
              });
              if (userId) {
                storageService.updateUserStatus(userId, 'offline').catch(() => {});
              }
            }
          }
        });
      } catch (err) {
        console.error('[Socket.io] Error in disconnect handler:', err.message);
      }
    });
  });
};
