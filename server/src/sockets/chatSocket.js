import jwt from 'jsonwebtoken';
import storageService from '../services/storageService.js';

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zyntra_jwt_secret_dev_key_2026');
      let user = null;
      if (decoded.id) {
        try {
          user = await storageService.findUserById(decoded.id);
        } catch {}
      }
      socket.user = {
        id: user?._id?.toString() || user?.id || decoded.id,
        _id: user?._id?.toString() || user?.id || decoded.id,
        primaryUsername: user?.primaryUsername || decoded.primaryUsername || '',
        username: user?.primaryUsername || decoded.primaryUsername || '',
        name: user?.name || decoded.name || 'User',
        avatar: user?.avatar || decoded.avatar || null,
      };
      next();
    } catch {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const rawUserId = socket.user?.id || socket.user?._id;
    const userId = rawUserId ? rawUserId.toString() : '';
    const rawUsername = socket.user?.primaryUsername || socket.user?.username || '';
    const username = rawUsername ? rawUsername.toLowerCase().replace(/^@/, '') : '';

    // Register user socket in presence tracking
    const registerPresence = (uId, uName) => {
      const keys = [uId, uName].filter(Boolean);
      let wasOffline = false;

      keys.forEach((key) => {
        const clean = key.toLowerCase().replace(/^@/, '');
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
          username: (uName || username).toLowerCase().replace(/^@/, ''),
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

    // Automatically join user's private inbox rooms for instant DM & alert delivery
    if (userId) {
      socket.join(`user_${userId}`);
    }
    if (username) {
      socket.join(`user_${username}`);
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
          const clean = String(uName).toLowerCase().replace(/^@/, '');
          socket.join(`user_${clean}`);
          registerPresence(uId, clean);
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
    socket.on('send_message', (data) => {
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
          chatType,
          attachment,
          timestamp,
        } = data || {};

        if (!chatId || (!content?.trim() && !attachment && type !== 'call')) return;

        const messageId = id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const finalContent = content ? content.trim() : '';
        const now = timestamp || new Date().toISOString();

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

        const messagePayload = {
          id: messageId,
          chatId,
          chatType: chatType || (chatId.startsWith('dm_') ? 'direct' : 'workspace-node'),
          senderId: userId || senderId || 'user-1',
          senderName: senderName || socket.user?.name || 'User',
          senderUsername: senderUsername || username || '',
          senderAvatar: senderAvatar || socket.user?.avatar || null,
          content: finalContent,
          type: type || (finalAttachment?.type || 'text'),
          callDetails: callDetails || null,
          attachment: finalAttachment,
          isForwarded: Boolean(data?.isForwarded),
          reactions: [],
          timestamp: now,
        };

        // 1. INSTANT BROADCAST (sub-10ms): Deliver immediately to all room peers
        socket.to(chatId).emit('receive_message', messagePayload);

        // 2. If Direct Message (DM), deliver directly to BOTH participants' inbox rooms
        // so it arrives instantly in the recipient's UI and sidebar without page refresh
        if (chatId.startsWith('dm_')) {
          const parts = chatId.replace('dm_', '').split('_');
          if (parts.length === 2) {
            const u1 = parts[0].toLowerCase();
            const u2 = parts[1].toLowerCase();
            io.to(`user_${u1}`).emit('receive_message', messagePayload);
            io.to(`user_${u2}`).emit('receive_message', messagePayload);
          }
        }

        // 3. Persist to MongoDB Atlas asynchronously in background (non-blocking)
        storageService.saveMessage(messagePayload).catch((err) => {
          console.error('[DB] Background saveMessage error:', err.message);
        });
      } catch (err) {
        console.error('[Socket.io] Error in send_message handler:', err.message);
      }
    });

    // Handle real-time read receipt / seen status
    socket.on('mark_read', async ({ chatId, userId: uId, username: uName }) => {
      try {
        const targetRoom = chatId;
        if (!targetRoom) return;
        const readerId = uId || userId;
        const readerUsername = uName || username;

        await storageService.markMessagesRead(targetRoom, readerId, readerUsername);

        // Broadcast to chat room
        socket.to(targetRoom).emit('messages_read', {
          chatId: targetRoom,
          readerId,
          readerUsername,
        });

        // If DM, also broadcast directly to partner's user room
        if (targetRoom.startsWith('dm_')) {
          const parts = targetRoom.replace('dm_', '').split('_');
          if (parts.length === 2) {
            const cleanReader = (readerUsername || '').toLowerCase().replace(/^@/, '');
            const otherUser = parts[0].toLowerCase() === cleanReader ? parts[1].toLowerCase() : parts[0].toLowerCase();
            io.to(`user_${otherUser}`).emit('messages_read', {
              chatId: targetRoom,
              readerId,
              readerUsername,
            });
          }
        }
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

        socket.to(targetRoom).emit('user_typing', payload);

        if (targetRoom.startsWith('dm_')) {
          const parts = targetRoom.replace('dm_', '').split('_');
          if (parts.length === 2) {
            socket.to(`user_${parts[0].toLowerCase()}`).emit('user_typing', payload);
            socket.to(`user_${parts[1].toLowerCase()}`).emit('user_typing', payload);
          }
        }
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

        socket.to(targetRoom).emit('user_typing', payload);

        if (targetRoom.startsWith('dm_')) {
          const parts = targetRoom.replace('dm_', '').split('_');
          if (parts.length === 2) {
            socket.to(`user_${parts[0].toLowerCase()}`).emit('user_typing', payload);
            socket.to(`user_${parts[1].toLowerCase()}`).emit('user_typing', payload);
          }
        }
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

        const reactionPayload = {
          id: messageId,
          messageId,
          chatId: updatedMsg.chatId || chatId,
          reactions: updatedMsg.reactions || [],
        };

        if (reactionPayload.chatId) {
          io.to(reactionPayload.chatId).emit('update_reaction', reactionPayload);
          if (reactionPayload.chatId.startsWith('dm_')) {
            const parts = reactionPayload.chatId.replace('dm_', '').split('_');
            if (parts.length === 2) {
              io.to(`user_${parts[0].toLowerCase()}`).emit('update_reaction', reactionPayload);
              io.to(`user_${parts[1].toLowerCase()}`).emit('update_reaction', reactionPayload);
            }
          }
        }
      } catch (err) {
        console.error('[Socket.io] Error in send_reaction handler:', err.message);
      }
    });

    // Helper to resolve clean target username from username, id, or canonical dm_ room
    const resolvePeerTarget = (target) => {
      if (!target) return '';
      let clean = String(target).toLowerCase().trim().replace(/^@/, '');
      if (clean.startsWith('dm_')) {
        const parts = clean.replace('dm_', '').split('_');
        const myU = (username || '').toLowerCase().replace(/^@/, '');
        if (parts.length === 2 && myU) {
          clean = parts[0] === myU ? parts[1] : parts[0];
        }
      }
      return clean;
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

        if (cleanTarget) {
          io.to(`user_${cleanTarget}`).emit('call_incoming', callerInfo);
        }
        if (chatId) {
          socket.to(chatId).emit('call_incoming', callerInfo);
        }
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
        if (cleanTarget) {
          io.to(`user_${cleanTarget}`).emit('call_answered', payload);
        }
        if (chatId) {
          socket.to(chatId).emit('call_answered', payload);
        }
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
        if (cleanTarget) {
          io.to(`user_${cleanTarget}`).emit('ice_candidate', payload);
        }
        if (chatId) {
          socket.to(chatId).emit('ice_candidate', payload);
        }
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
        if (cleanTarget) {
          io.to(`user_${cleanTarget}`).emit('call_ended', payload);
        }
        if (chatId) {
          socket.to(chatId).emit('call_ended', payload);
        }
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
        if (cleanTarget) {
          io.to(`user_${cleanTarget}`).emit('call_rejected', payload);
        }
        if (chatId) {
          socket.to(chatId).emit('call_rejected', payload);
        }
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
