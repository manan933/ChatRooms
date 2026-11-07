import express from 'express';
import {
  getContactsAndGroups,
  createContact,
  createPersonalGroup,
  searchUsers,
} from '../controllers/contactController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getContactsAndGroups);
router.get('/search', protect, searchUsers);
router.post('/', protect, createContact);
router.post('/groups', protect, createPersonalGroup);

export default router;
