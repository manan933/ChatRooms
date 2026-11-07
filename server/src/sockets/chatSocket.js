import jwt from 'jsonwebtoken';
import storageService from '../services/storageService.js';

export const setupChatSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zyntra_jwt_secret_dev_key_2026');
      socket.user = decoded;
      next();
    } catch {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id || socket.user?._id;
    const username = (socket.user?.primaryUsername || socket.user?.username || '').toLowerCase().replace(/^@/, '');

    // Automatically join user's private inbox rooms for instant DM & alert delivery
    if (userId) {
      socket.join(`user_${userId}`);
    }
    if (username) {
      socket.join(`user_${username}`);
    }

    console.log(`[Socket.io] Connected: ${socket.id} (user_${username || userId})`);

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
          senderId,
          senderName,
          senderUsername,
          senderAvatar,
          chatType,
          attachment,
          timestamp,
        } = data || {};

        if (!chatId || (!content?.trim() && !attachment)) return;

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
          type: attachment?.type || 'text',
          attachment: attachment || null,
          reactions: [],
          timestamp: now,
        };

        // 1. INSTANT BROADCAST (sub-10ms): Deliver immediately to all room peers
        socket.to(chatId).emit('receive_message', messagePayload);

        // 2. If Direct Message (DM), also deliver directly to recipient's personal user room
        // so it arrives instantly even if they haven't selected this chat yet
        if (chatId.startsWith('dm_')) {
          const parts = chatId.replace('dm_', '').split('_');
          if (parts.length === 2) {
            const recipientUname = parts[0].toLowerCase() === username ? parts[1].toLowerCase() : parts[0].toLowerCase();
            io.to(`user_${recipientUname}`).emit('receive_message', messagePayload);
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
    socket.on('send_reaction', ({ messageId, emoji, userId: uId, chatId }) => {
      try {
        const uid = uId || userId || 'user-1';
        if (chatId) {
          // Immediately broadcast reaction to peers
          socket.to(chatId).emit('update_reaction', { messageId, emoji, userId: uid });
        }
        // Persist in background
        storageService.addReaction(messageId, emoji, uid).catch((err) => {
          console.error('[DB] Background addReaction error:', err.message);
        });
      } catch (err) {
        console.error('[Socket.io] Error in send_reaction handler:', err.message);
      }
    });

    socket.on('disconnect', () => {
      // Disconnection handled cleanly
    });
  });
};
