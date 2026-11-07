import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
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

// Brute-force rate limiting on login & registration (Item 9)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 registration/login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
});

// Diagnostic endpoint protected (Item 26: Hide admin / sensitive info)
router.get('/diagnostic', protect, async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    const count = isConnected ? await User.countDocuments() : 0;

    res.json({
      success: true,
      app: 'ChatRooms',
      database: 'mongodb',
      connected: isConnected,
      host: mongoose.connection?.host || null,
      dbName: mongoose.connection?.name || null,
      count,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/context', protect, addContext);

export default router;
