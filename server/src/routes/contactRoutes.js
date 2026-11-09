import express from 'express';
import {
  getContactsAndGroups,
  createContact,
  createPersonalGroup,
  updatePersonalGroup,
  addGroupMemberController,
  removeGroupMemberController,
  deleteOrLeaveGroupController,
  searchUsers,
  deleteContactOrGroup,
} from '../controllers/contactController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getContactsAndGroups);
router.get('/search', protect, searchUsers);
router.post('/', protect, createContact);
router.post('/groups', protect, createPersonalGroup);
router.patch('/groups/:groupId', protect, updatePersonalGroup);
router.post('/groups/:groupId/members', protect, addGroupMemberController);
router.delete('/groups/:groupId/members/:memberId', protect, removeGroupMemberController);
router.delete('/groups/:groupId', protect, deleteOrLeaveGroupController);
router.delete('/:chatId', protect, deleteContactOrGroup);

export default router;
