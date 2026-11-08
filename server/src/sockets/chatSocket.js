import jwt from 'jsonwebtoken';
import storageService from '../services/storageService.js';

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
    const userId = (socket.user?.id || socket.user?._id || '').toString();
    const username = (socket.user?.primaryUsername || socket.user?.username || '').toLowerCase().replace(/^@/, '');

    // Automatically join user's private inbox rooms for instant DM & alert delivery
    if (userId) {
      socket.join(`user_${userId}`);
    }
    if (username) {
      socket.join(`user_${username}`);
    }

    console.log(`[Socket.io] Connected: ${socket.id} (user_${username || userId})`);

    // Dynamic registration handler
    socket.on('register_user', ({ userId: uId, username: uName }) => {
      if (uId) socket.join(`user_${uId}`);
      if (uName) {
        const clean = uName.toLowerCase().replace(/^@/, '');
        socket.join(`user_${clean}`);
      }
    });

    // Join a specific chat room (channel, DM, or personal group)
    socket.on('join_room', (roomId) => {
      if (!roomId) return;
      socket.join(roomId);
    });

    // Leave a room
    socket.on('leave_room', (roomId) => {
      if (!roomId) return;
      socket.leave(roomId);
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

        const messagePayload = {
          id: messageId,
          chatId,
          chatType: chatType || (chatId.startsWith('dm_') ? 'direct' : 'workspace-node'),
          senderId: userId || senderId || 'user-1',
          senderName: senderName || socket.user?.name || 'User',
          senderUsername: senderUsername || username || '',
          senderAvatar: senderAvatar || socket.user?.avatar || null,
          content: finalContent,
          type: type || (attachment?.type || 'text'),
          callDetails: callDetails || null,
          attachment: attachment || null,
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

    // Handle typing status
    socket.on('typing_start', ({ roomId, userName, userId: uId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('user_typing', { userId: uId || userId, userName: userName || username, isTyping: true });
    });

    socket.on('typing_stop', ({ roomId, userId: uId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('user_typing', { userId: uId || userId, isTyping: false });
    });

    // Handle real-time reactions with instant broadcast
    socket.on('send_reaction', async ({ messageId, emoji, userId: uId, chatId }) => {
      try {
        const uid = uId || userId || 'user-1';
        const cleanEmoji = emoji ? String(emoji).trim() : '👍';

        const updatedMsg = await storageService.addReaction(messageId, cleanEmoji, uid);
        const reactionPayload = {
          id: messageId,
          messageId,
          chatId: updatedMsg?.chatId || chatId,
          reactions: updatedMsg?.reactions || [],
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

    // ── WebRTC Voice & Video Call Signaling ──────────────────────────
    socket.on('call_user', (data) => {
      const { userToCall, signalData, isVideo, chatId } = data || {};
      if (!userToCall) return;
      const cleanTarget = String(userToCall).toLowerCase().replace(/^@/, '');
      const callerInfo = {
        from: username || userId,
        callerId: userId,
        callerUsername: username,
        callerName: socket.user?.name || username || 'User',
        callerAvatar: socket.user?.avatar || null,
        signalData,
        isVideo: Boolean(isVideo),
        chatId,
      };

      io.to(`user_${cleanTarget}`).emit('call_incoming', callerInfo);
      io.to(`user_${userToCall}`).emit('call_incoming', callerInfo);
      if (chatId) {
        socket.to(chatId).emit('call_incoming', callerInfo);
      }
    });

    socket.on('answer_call', (data) => {
      const { to, signalData } = data || {};
      if (!to) return;
      const cleanTarget = String(to).toLowerCase().replace(/^@/, '');
      io.to(`user_${cleanTarget}`).emit('call_answered', {
        from: username || userId,
        signalData,
      });
      io.to(`user_${to}`).emit('call_answered', {
        from: username || userId,
        signalData,
      });
    });

    socket.on('ice_candidate', (data) => {
      const { to, candidate, chatId } = data || {};
      if (to) {
        const cleanTarget = String(to).toLowerCase().replace(/^@/, '');
        io.to(`user_${cleanTarget}`).emit('ice_candidate', { from: username || userId, candidate });
        io.to(`user_${to}`).emit('ice_candidate', { from: username || userId, candidate });
      }
      if (chatId) {
        socket.to(chatId).emit('ice_candidate', { from: username || userId, candidate });
      }
    });

    socket.on('end_call', (data) => {
      const { to, chatId } = data || {};
      if (to) {
        const cleanTarget = String(to).toLowerCase().replace(/^@/, '');
        io.to(`user_${cleanTarget}`).emit('call_ended', { from: username || userId });
        io.to(`user_${to}`).emit('call_ended', { from: username || userId });
      }
      if (chatId) {
        socket.to(chatId).emit('call_ended', { from: username || userId });
      }
    });

    socket.on('reject_call', (data) => {
      const { to } = data || {};
      if (!to) return;
      const cleanTarget = String(to).toLowerCase().replace(/^@/, '');
      io.to(`user_${cleanTarget}`).emit('call_rejected', { from: username || userId });
      io.to(`user_${to}`).emit('call_rejected', { from: username || userId });
    });

    socket.on('disconnect', () => {
      // Disconnection handled cleanly
    });
  });
};
