// Shared Direct Message (DM) room & username helpers
// Handles usernames that contain underscores (e.g. "pn_123", "pratyush_naik_31")

const knownUsernames = new Set();

export const normalizeUsername = (username) => {
  if (!username) return '';
  return String(username).toLowerCase().trim().replace(/^@/, '');
};

export const registerKnownUsernames = (usernames = []) => {
  for (const u of usernames) {
    const clean = normalizeUsername(u);
    if (clean) knownUsernames.add(clean);
  }
};

export const getKnownUsernames = () => knownUsernames;

export const getCanonicalDmId = (username1, username2) => {
  const u1 = normalizeUsername(username1);
  const u2 = normalizeUsername(username2);
  return 'dm_' + [u1, u2].sort().join('_');
};

/**
 * Extracts the two participant usernames from a `dm_<u1>_<u2>` chat ID,
 * even when one or both usernames contain underscores (e.g. `dm_manan_pn_123`).
 */
export const extractDmParticipants = (chatId, knownUser = null, extraHints = []) => {
  if (!chatId || typeof chatId !== 'string' || !chatId.startsWith('dm_')) {
    return [];
  }

  const rest = chatId.slice(3).toLowerCase();
  if (!rest) return [];

  // 1. Direct match using the caller's known username (sender, reader, or current user)
  const cleanKnown = normalizeUsername(knownUser);
  if (cleanKnown) {
    if (rest === `${cleanKnown}_${cleanKnown}`) {
      return [cleanKnown, cleanKnown];
    }
    if (rest.startsWith(`${cleanKnown}_`)) {
      const other = rest.slice(cleanKnown.length + 1);
      if (other) return [cleanKnown, other];
    }
    if (rest.endsWith(`_${cleanKnown}`)) {
      const other = rest.slice(0, rest.length - cleanKnown.length - 1);
      if (other) return [other, cleanKnown];
    }
  }

  // 2. Match against known registered usernames (longest first to avoid partial prefix ambiguity)
  const candidates = new Set(knownUsernames);
  for (const h of extraHints) {
    const c = normalizeUsername(h);
    if (c) candidates.add(c);
  }

  const sortedCandidates = Array.from(candidates).sort((a, b) => b.length - a.length);

  // Prefer pairs where BOTH sides are known usernames
  for (const cand of sortedCandidates) {
    if (rest.startsWith(`${cand}_`)) {
      const other = rest.slice(cand.length + 1);
      if (candidates.has(other)) {
        return [cand, other];
      }
    }
    if (rest.endsWith(`_${cand}`)) {
      const other = rest.slice(0, rest.length - cand.length - 1);
      if (candidates.has(other)) {
        return [other, cand];
      }
    }
  }

  // Fallback: single known user match on prefix/suffix
  for (const cand of sortedCandidates) {
    if (rest.startsWith(`${cand}_`)) {
      const other = rest.slice(cand.length + 1);
      if (other) return [cand, other];
    }
    if (rest.endsWith(`_${cand}`)) {
      const other = rest.slice(0, rest.length - cand.length - 1);
      if (other) return [other, cand];
    }
  }

  // 3. Last resort: classic 2-part split
  const parts = rest.split('_');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return parts;
  }

  return [];
};

export const getDmPartner = (chatId, selfUsername, extraHints = []) => {
  const cleanSelf = normalizeUsername(selfUsername);
  const participants = extractDmParticipants(chatId, cleanSelf, extraHints);
  if (participants.length !== 2) return '';
  if (!cleanSelf) return participants[0];
  return participants[0] === cleanSelf ? participants[1] : participants[0];
};

/**
 * Emits a Socket.io event to a chat room and (for DMs) each participant's user_<username> room,
 * deduplicated per unique connected socket.
 */
export const emitToChatTargets = (io, chatId, eventName, payload, { knownUser = '', recipientHint = '', exceptSocketId = null } = {}) => {
  if (!io || !chatId) return;
  const rooms = new Set([chatId]);
  if (chatId.startsWith('dm_')) {
    const participants = extractDmParticipants(chatId, knownUser, recipientHint ? [recipientHint] : []);
    for (const p of participants) {
      const cleanP = normalizeUsername(p);
      if (cleanP) rooms.add(`user_${cleanP}`);
    }
  }
  const roomList = Array.from(rooms);
  let emitter = io.to(roomList[0]);
  for (let i = 1; i < roomList.length; i += 1) {
    emitter = emitter.to(roomList[i]);
  }
  if (exceptSocketId) {
    emitter = emitter.except(exceptSocketId);
  }
  emitter.emit(eventName, payload);
};
