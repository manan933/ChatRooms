import jwt from 'jsonwebtoken';
import storageService from '../services/storageService.js';
import User from '../models/User.js';

const generateToken = (userOrId) => {
  const id = (userOrId && typeof userOrId === 'object') ? (userOrId._id || userOrId.id) : userOrId;
  const primaryUsername = (userOrId && typeof userOrId === 'object') ? (userOrId.primaryUsername || userOrId.username || '') : '';
  return jwt.sign(
    { id: id ? id.toString() : '', primaryUsername },
    process.env.JWT_SECRET || 'zyntra_jwt_secret_dev_key_2026',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

const formatUserResponse = (user) => ({
  id: user._id || user.id,
  _id: user._id || user.id,
  name: user.name,
  email: user.email,
  primaryUsername: user.primaryUsername,
  avatar: user.avatar || null,
  bio: user.bio || '',
  phone: user.phone || (user.get ? user.get('phone') : null) || (user._doc ? user._doc.phone : null) || '',
  contexts: user.contexts || [],
  status: user.status || 'online',
});

export const register = async (req, res, next) => {
  try {
    console.log('[Auth] Register attempt:', req.body?.email);
    const { name, email, primaryUsername, username, password, avatar, bio } = req.body || {};
    const rawUsername = primaryUsername || username;

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof rawUsername !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({ success: false, message: 'Invalid payload: fields must be strings.' });
    }

    if (!name.trim() || !email.trim() || !rawUsername.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, username, and password.' });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long and contain non-whitespace characters.' });
    }

    const cleanUsername = rawUsername.replace(/^@/, '').toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    try {
      const user = await storageService.createUser({
        name: name.trim(),
        email: cleanEmail,
        primaryUsername: cleanUsername,
        password,
        avatar: avatar || null,
        bio: bio || 'Building contextual communication'
      });

      console.log('[Auth] Registration successful for:', cleanEmail);
      const token = generateToken(user);
      
      return res.status(201).json({
        success: true,
        token,
        user: formatUserResponse(user),
      });
    } catch (err) {
      console.error('[Auth] Storage error during register:', err.message);
      // Determine if it's a unique constraint violation
      const msg = (err.message || '').toLowerCase();
      let errorMsg = 'An error occurred during registration. Please try again.';
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.includes('unique') ||
        msg.includes('constraint') ||
        err.code === 11000
      ) {
        errorMsg = 'An account with that email or username already exists.';
      }
      return res.status(400).json({ success: false, message: errorMsg });
    }
  } catch (error) {
    console.error('[Auth] Server error during register:', error);
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, username, emailOrUsername, password } = req.body || {};
    const rawIdentifier = (typeof email === 'string' && email.trim())
      ? email
      : (typeof emailOrUsername === 'string' && emailOrUsername.trim())
        ? emailOrUsername
        : (typeof username === 'string' && username.trim())
          ? username
          : (email || emailOrUsername || username || '');

    if (typeof rawIdentifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid payload: credentials must be strings.' });
    }

    if (!rawIdentifier.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email or username and password' });
    }

    const cleanIdentifier = rawIdentifier.toLowerCase().trim().replace(/^@/, '');
    console.log('[Auth] Login attempt for:', cleanIdentifier);

    let user = await storageService.findUserByEmail(cleanIdentifier);
    if (!user) {
      user = await storageService.findUserByUsername(cleanIdentifier);
    }

    if (!user) {
      console.warn('[Auth] Login failed: User not found:', cleanIdentifier);
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await storageService.verifyPassword(password, user.password);
    if (!isMatch) {
      console.warn('[Auth] Login failed: Incorrect password for:', cleanIdentifier);
      return res.status(401).json({ success: false, message: 'Invalid credentials. Password incorrect.' });
    }

    console.log('[Auth] Login successful for:', cleanIdentifier);
    const token = generateToken(user);
    
    return res.status(200).json({
      success: true,
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('[Auth] Server error during login:', error);
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    res.status(200).json({ success: true, user: formatUserResponse(req.user) });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, avatar, phone } = req.body;
    const userId = req.user._id || req.user.id;
    let user = await storageService.updateUserProfile(userId, { name, bio, avatar, phone });
    if (phone !== undefined && userId) {
      const updatedWithPhone = await User.findByIdAndUpdate(userId, { phone }, { new: true, strict: false });
      if (updatedWithPhone) user = updatedWithPhone;
    }
    res.status(200).json({ success: true, user: formatUserResponse(user || req.user) });
  } catch (error) {
    next(error);
  }
};

export const addContext = async (req, res, next) => {
  try {
    const { id, type, name, username } = req.body;
    if (!id || !type || !name || !username) {
      return res.status(400).json({ success: false, message: 'Context requires id, type, name, and username' });
    }
    const user = req.user;
    const contexts = user.contexts || [];
    const filtered = contexts.filter((c) => c.id !== id);
    filtered.push({ id, type, name, username });
    user.contexts = filtered;

    const userId = user._id || user.id;
    if (userId) {
      await User.findByIdAndUpdate(userId, { contexts: filtered }, { new: true });
    }

    res.status(200).json({ success: true, contexts: user.contexts });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide both your current and new password' });
    }
    if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const userId = req.user._id || req.user.id;
    const user = await storageService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await storageService.verifyPassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashed = await storageService.hashPassword(newPassword.trim());
    await storageService.updateUserPassword(userId, hashed);

    return res.status(200).json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    next(error);
  }
};
