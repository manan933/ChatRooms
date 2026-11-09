import storageService from '../services/storageService.js';

// @desc    Get all messages for a specific chat (channel, contact, or personal group)
// @route   GET /api/messages/:chatId
// @access  Protected
export const getMessagesByChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return res.status(400).json({ success: false, message: 'chatId is required' });
    }

    const userId = req.user ? (req.user._id || req.user.id) : null;
    const username = req.user ? (req.user.primaryUsername || req.user.username) : null;

    // Asynchronously mark incoming messages as read when user loads the chat
    if (userId) {
      storageService.markMessagesRead(chatId, userId, username).then((hasRead) => {
        if (hasRead) {
          const io = req.app.get('io');
          if (io) {
            io.to(chatId).emit('messages_read', { chatId, readerId: userId, readerUsername: username });
          }
        }
      }).catch(() => {});
    }

    const list = await storageService.getMessagesByChat(chatId);
    return res.status(200).json({
      success: true,
      count: list.length,
      data: list,
    });
  } catch (error) {
    console.error('[Messages] Error in getMessagesByChat:', error);
    next(error);
  }
};

// @desc    Explicitly mark all messages in a chat as read
// @route   POST /api/messages/:chatId/read
// @access  Protected
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?._id || req.user?.id;
    const username = req.user?.primaryUsername || req.user?.username;

    const hasRead = await storageService.markMessagesRead(chatId, userId, username);

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('messages_read', { chatId, readerId: userId, readerUsername: username });
    }

    return res.status(200).json({ success: true, updated: hasRead });
  } catch (error) {
    console.error('[Messages] Error in markMessagesAsRead:', error);
    next(error);
  }
};

// @desc    Send a new message
// @route   POST /api/messages/:chatId
// @access  Protected
export const sendMessage = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const {
      id,
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
    } = req.body || {};

    if (!chatId || (!content?.trim() && !attachment)) {
      return res.status(400).json({
        success: false,
        message: 'chatId and either content or attachment are required',
      });
    }

    const newId = id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const finalContent = content ? content.trim() : '';

    const saved = await storageService.saveMessage({
      id: newId,
      chatId,
      chatType: chatType || 'direct',
      senderId: req.user?._id?.toString() || req.user?.id || senderId || 'user',
      senderName: req.user?.name || senderName || 'User',
      senderUsername: req.user?.primaryUsername || senderUsername || '',
      senderAvatar: req.user?.avatar || senderAvatar || null,
      content: finalContent,
      type: type || (attachment?.type || 'text'),
      callDetails: callDetails || null,
      attachment: attachment || null,
      isForwarded: Boolean(req.body?.isForwarded),
      timestamp: timestamp || new Date().toISOString(),
    });

    // Realtime broadcast via Socket.io if available
    const io = req.app?.get('io');
    if (io) {
      io.to(chatId).emit('receive_message', saved);
      if (chatId.startsWith('dm_')) {
        const parts = chatId.replace('dm_', '').split('_');
        if (parts.length === 2) {
          io.to(`user_${parts[0].toLowerCase()}`).emit('receive_message', saved);
          io.to(`user_${parts[1].toLowerCase()}`).emit('receive_message', saved);
        }
      }
    }

    return res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (error) {
    console.error('[Messages] Error in sendMessage:', error);
    next(error);
  }
};

// @desc    Edit an existing message (Stops IDOR - Item 14)
// @route   PUT /api/messages/:id
// @access  Protected
export const editMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content cannot be empty',
      });
    }

    const existingMsg = await storageService.findMessageById(id);
    if (!existingMsg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Verify ownership to stop IDOR
    const requesterId = req.user?._id?.toString() || req.user?.id?.toString();
    const requesterUsername = req.user?.primaryUsername?.toLowerCase();
    const senderId = existingMsg.senderId?.toString();
    const senderUsername = existingMsg.senderUsername?.toLowerCase();

    if (requesterId && senderId && senderId !== requesterId && senderUsername !== requesterUsername) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot edit another user\'s message',
      });
    }

    const updated = await storageService.editMessage(id, content);
    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[Messages] Error in editMessage:', error);
    next(error);
  }
};

// @desc    Delete a message (Stops IDOR - Item 14)
// @route   DELETE /api/messages/:id
// @access  Protected
export const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingMsg = await storageService.findMessageById(id);
    if (!existingMsg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Verify ownership to stop IDOR
    const requesterId = req.user?._id?.toString() || req.user?.id?.toString();
    const requesterUsername = req.user?.primaryUsername?.toLowerCase();
    const senderId = existingMsg.senderId?.toString();
    const senderUsername = existingMsg.senderUsername?.toLowerCase();

    if (requesterId && senderId && senderId !== requesterId && senderUsername !== requesterUsername) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot delete another user\'s message',
      });
    }

    await storageService.deleteMessage(id);
    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      data: { id },
    });
  } catch (error) {
    console.error('[Messages] Error in deleteMessage:', error);
    next(error);
  }
};

// @desc    Clear and delete all messages and history for a chat
// @route   DELETE /api/messages/chat/:chatId
// @access  Protected
export const clearChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user?._id || req.user?.id;
    const currentUsername = req.user?.primaryUsername || req.user?.username;

    if (!chatId) {
      return res.status(400).json({ success: false, message: 'Chat ID is required' });
    }

    await storageService.deleteChat(chatId, currentUserId, currentUsername);

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('chat_cleared', { chatId });
      if (chatId.startsWith('dm_')) {
        const parts = chatId.replace('dm_', '').split('_');
        parts.forEach((p) => io.to(`user_${p.toLowerCase()}`).emit('chat_cleared', { chatId }));
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully',
      data: { chatId },
    });
  } catch (error) {
    console.error('[Messages] Error in clearChat:', error);
    next(error);
  }
};

// @desc    Add or increment reaction on a message
// @route   POST /api/messages/:id/reactions
// @access  Protected
export const addReaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { emoji, userId, action } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required',
      });
    }

    const uid = req.user?._id?.toString() || req.user?.id || userId || 'user-1';
    const updated = await storageService.addReaction(id, emoji, uid, action);

    if (updated?.chatId) {
      const io = req.app.get('io');
      if (io) {
        const reactionPayload = {
          id,
          messageId: id,
          chatId: updated.chatId,
          reactions: updated.reactions || [],
        };
        io.to(updated.chatId).emit('update_reaction', reactionPayload);
      }
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[Messages] Error in addReaction:', error);
    next(error);
  }
};
