import express from 'express';
import {
  getMessagesByChat,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  markMessagesAsRead,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/:chatId', protect, getMessagesByChat);
router.post('/:chatId', protect, sendMessage);
router.post('/:chatId/read', protect, markMessagesAsRead);
router.put('/:id', protect, editMessage);
router.delete('/:id', protect, deleteMessage);
router.post('/:id/reactions', protect, addReaction);

export default router;
