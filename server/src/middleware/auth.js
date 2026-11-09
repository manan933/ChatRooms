import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import storageService from '../services/storageService.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. No token provided.',
    });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'chatrooms_jwt_secret_dev_key_2026');
    } catch {
      decoded = jwt.verify(token, 'zyntra_jwt_secret_dev_key_2026');
    }

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findById(decoded.id);
      } catch {}
    }

    if (!user) {
      user = await storageService.findUserById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists with this token.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token verification failed: ' + error.message,
    });
  }
};

export const optionalProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'chatrooms_jwt_secret_dev_key_2026');
    } catch {
      decoded = jwt.verify(token, 'zyntra_jwt_secret_dev_key_2026');
    }
    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findById(decoded.id);
      } catch {}
    }
    if (!user) {
      user = await storageService.findUserById(decoded.id);
    }
    if (user) {
      req.user = user;
    }
  } catch {}

  next();
};

export default { protect, optionalProtect };
