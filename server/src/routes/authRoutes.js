import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import {
  register,
  login,
  getMe,
  updateProfile,
  addContext,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/diagnostic', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    const users = isConnected
      ? await User.find({}, '_id email primaryUsername name avatar status').lean()
      : [];

    res.json({
      success: true,
      database: 'mongodb',
      connected: isConnected,
      host: mongoose.connection?.host || null,
      dbName: mongoose.connection?.name || null,
      count: users.length,
      users: users.map((u) => ({
        _id: u._id.toString(),
        id: u._id.toString(),
        email: u.email,
        primaryUsername: u.primaryUsername,
        name: u.name,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/context', protect, addContext);

export default router;
