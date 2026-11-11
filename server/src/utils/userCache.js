import { registerKnownUsernames, normalizeUsername } from './dmHelper.js';

const USER_TTL_MS = 60 * 1000; // 60 seconds
const byId = new Map();
const byUsername = new Map();

export const getCachedUserById = (id) => {
  if (!id) return null;
  const key = String(id);
  const entry = byId.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    byId.delete(key);
    return null;
  }
  return entry.user;
};

export const getCachedUserByUsername = (username) => {
  const clean = normalizeUsername(username);
  if (!clean) return null;
  const entry = byUsername.get(clean);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    byUsername.delete(clean);
    return null;
  }
  return entry.user;
};

export const setCachedUser = (user) => {
  if (!user) return;
  const uid = user._id ? user._id.toString() : (user.id ? String(user.id) : '');
  const uname = normalizeUsername(user.primaryUsername || user.username);
  const expiresAt = Date.now() + USER_TTL_MS;

  if (uname) {
    registerKnownUsernames([uname]);
  }

  // Only cache safe lightweight copy (omit password hash)
  const safeUser = { ...user };
  delete safeUser.password;

  if (uid) {
    byId.set(uid, { user: safeUser, expiresAt });
  }
  if (uname) {
    byUsername.set(uname, { user: safeUser, expiresAt });
  }
};

export const invalidateCachedUser = (id, username) => {
  if (id) byId.delete(String(id));
  const uname = normalizeUsername(username);
  if (uname) byUsername.delete(uname);
};
