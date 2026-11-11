import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { Contact, PersonalGroup } from '../models/Contact.js';
import Workspace from '../models/Workspace.js';
import WorkspaceNode from '../models/WorkspaceNode.js';
import Media from '../models/Media.js';
import groupService from './groupService.js';
import {
  extractDmParticipants,
  getCanonicalDmId as buildCanonicalDmId,
  normalizeUsername,
  registerKnownUsernames,
} from '../utils/dmHelper.js';
import {
  getCachedUserById,
  getCachedUserByUsername,
  setCachedUser,
  invalidateCachedUser,
} from '../utils/userCache.js';

const SERVER_EMOJI_MAP = {
  '[fire]': '🔥',
  fire: '🔥',
  flame: '🔥',
  Flame: '🔥',
  '[heart]': '❤️',
  heart: '❤️',
  Heart: '❤️',
  love: '❤️',
  '+1': '👍',
  '[like]': '👍',
  like: '👍',
  Like: '👍',
  '[star]': '⭐',
  star: '⭐',
  Star: '⭐',
  '[agree]': '🤝',
  agree: '🤝',
  Agree: '🤝',
  '[celebrate]': '🎉',
  celebrate: '🎉',
  Celebrate: '🎉',
  '[laugh]': '😂',
  laugh: '😂',
  Laugh: '😂',
  '[rocket]': '🚀',
  rocket: '🚀',
  Launch: '🚀',
  launch: '🚀',
  '[check]': '✅',
  check: '✅',
  Check: '✅',
};

const normalizeEmoji = (emoji) => {
  if (!emoji) return '👍';
  const clean = String(emoji).trim();
  if (SERVER_EMOJI_MAP[clean]) return SERVER_EMOJI_MAP[clean];
  const lower = clean.toLowerCase();
  if (SERVER_EMOJI_MAP[lower]) return SERVER_EMOJI_MAP[lower];
  const unbracketed = lower.replace(/^\[|\]$/g, '');
  if (SERVER_EMOJI_MAP[unbracketed]) return SERVER_EMOJI_MAP[unbracketed];
  return clean;
};

class StorageService {
  mapUser(userDoc) {
    if (!userDoc) return null;
    const doc = userDoc.toObject ? userDoc.toObject() : userDoc;
    const id = doc._id ? doc._id.toString() : (doc.id || '');
    return {
      _id: id,
      id: id,
      name: doc.name || '',
      email: doc.email || '',
      primaryUsername: doc.primaryUsername || '',
      password: doc.password || '',
      avatar: doc.avatar || null,
      avatarType: doc.avatarType || 'ai',
      bio: doc.bio || '',
      status: doc.status || 'online',
      contexts: doc.contexts || [],
      lastActive: doc.lastActive || new Date(),
    };
  }

  // Alias for backward compatibility
  mapUserRow(row) {
    return this.mapUser(row);
  }

  sanitizeAvatar(avatar) {
    if (typeof avatar === 'string' && avatar.startsWith('data:') && avatar.length > 4096) {
      return null;
    }
    return avatar || null;
  }

  async offloadDataUrlToMedia(url, { filename = 'upload.jpg', uploadedBy = null, minLength = 2048 } = {}) {
    if (typeof url !== 'string' || !url.startsWith('data:') || url.length <= minLength) {
      return url;
    }
    try {
      const matches = url.match(/^data:([^;,]+);base64,(.+)$/);
      if (!matches) return url;
      const contentType = matches[1] || 'application/octet-stream';
      const buffer = Buffer.from(matches[2], 'base64');
      const mediaDoc = await Media.create({
        filename,
        contentType,
        data: buffer,
        size: buffer.length,
        uploadedBy: uploadedBy || null,
      });
      if (mediaDoc?._id) {
        return `/api/upload/media/${mediaDoc._id}`;
      }
    } catch (mediaErr) {
      console.warn('[Storage] Auto-persist base64 to Media skipped:', mediaErr.message);
    }
    return url;
  }

  async warmKnownUsernames() {
    try {
      const users = await User.find({}, 'primaryUsername').lean();
      registerKnownUsernames(users.map((u) => u.primaryUsername));
      return users.length;
    } catch (err) {
      console.warn('[Storage] warmKnownUsernames warning:', err.message);
      return 0;
    }
  }

  async migrateLargeDataAvatars() {
    try {
      const usersWithLargeAvatar = await User.find({
        avatar: { $regex: '^data:' },
      }).lean();

      let migratedCount = 0;
      for (const u of usersWithLargeAvatar) {
        if (!u.avatar || u.avatar.length <= 4096) continue;
        const mediaUrl = await this.offloadDataUrlToMedia(u.avatar, {
          filename: `avatar-${u.primaryUsername || u._id}.jpg`,
          uploadedBy: u._id?.toString(),
          minLength: 4096,
        });
        if (mediaUrl && mediaUrl !== u.avatar) {
          migratedCount++;
          await Promise.all([
            User.updateOne({ _id: u._id }, { $set: { avatar: mediaUrl } }),
            Contact.updateMany({ username: u.primaryUsername }, { $set: { avatar: mediaUrl } }),
            Message.updateMany({ senderUsername: u.primaryUsername }, { $set: { senderAvatar: mediaUrl } }),
            PersonalGroup.updateMany(
              { 'members.username': u.primaryUsername },
              { $set: { 'members.$[elem].avatar': mediaUrl } },
              { arrayFilters: [{ 'elem.username': u.primaryUsername }] }
            ),
          ]);
          invalidateCachedUser(u._id?.toString(), u.primaryUsername);
        }
      }

      // Clean any orphaned base64 avatars left on Message docs whose senderUsername differed
      const residualMsgSenders = await Message.distinct('senderUsername', {
        senderAvatar: { $regex: '^data:' },
      });
      for (const uname of residualMsgSenders) {
        if (!uname) continue;
        const u = await User.findOne({ primaryUsername: normalizeUsername(uname) }, 'avatar').lean();
        const replacement = u?.avatar && !u.avatar.startsWith('data:') ? u.avatar : null;
        await Message.updateMany(
          { senderUsername: uname, senderAvatar: { $regex: '^data:' } },
          { $set: { senderAvatar: replacement } }
        );
      }

      if (migratedCount > 0) {
        console.log(`[Storage] Migrated ${migratedCount} large base64 user avatar(s) to Media collection.`);
      }
      return migratedCount;
    } catch (err) {
      console.warn('[Storage] migrateLargeDataAvatars warning:', err.message);
      return 0;
    }
  }

  async findUserByEmail(email) {
    const clean = (email || '').toLowerCase().trim();
    if (!clean) return null;
    const user = await User.findOne({ email: clean }).select('+password').lean();
    const mapped = this.mapUser(user);
    if (mapped) setCachedUser(mapped);
    return mapped;
  }

  async findUserByUsername(username) {
    const clean = normalizeUsername(username);
    if (!clean) return null;
    const user = await User.findOne({
      $or: [{ primaryUsername: clean }, { 'contexts.username': clean }],
    })
      .select('+password')
      .lean();
    const mapped = this.mapUser(user);
    if (mapped) setCachedUser(mapped);
    return mapped;
  }

  async findUserByUsernameLight(username) {
    const clean = normalizeUsername(username);
    if (!clean) return null;
    const cached = getCachedUserByUsername(clean);
    if (cached) return cached;
    return this.findUserByUsername(clean);
  }

  async findUserById(id) {
    if (!id) return null;
    let user = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await User.findById(id).select('+password').lean();
    }
    if (!user) {
      const clean = normalizeUsername(id);
      user = await User.findOne({
        $or: [{ _id: id }, { primaryUsername: clean }],
      })
        .select('+password')
        .lean();
    }
    const mapped = this.mapUser(user);
    if (mapped) setCachedUser(mapped);
    return mapped;
  }

  async getUserById(id) {
    const cached = getCachedUserById(id);
    if (cached) return cached;
    return this.findUserById(id);
  }

  async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, 10);
  }

  async createUser({ name, email, primaryUsername, password, avatar, bio }) {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanUsername = normalizeUsername(primaryUsername);

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { primaryUsername: cleanUsername }],
    }).lean();

    if (existingUser) {
      throw new Error('An account with that email or username already exists.');
    }

    const safeAvatar = await this.offloadDataUrlToMedia(avatar || null, {
      filename: `avatar-${cleanUsername}.jpg`,
      minLength: 4096,
    });

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      primaryUsername: cleanUsername,
      password,
      avatar: safeAvatar || null,
      avatarType: 'ai',
      bio: bio || 'Building contextual communication',
      contexts: [
        {
          id: 'ctx-personal',
          type: 'personal',
          name: 'Personal',
          username: `${cleanUsername}.personal`,
        },
      ],
    });

    const mapped = this.mapUser(user);
    if (mapped) setCachedUser(mapped);
    return mapped;
  }

  async verifyPassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    try {
      return bcrypt.compareSync(plainPassword, hashedPassword);
    } catch (e) {
      console.error('[DB] Password compare error:', e);
      return false;
    }
  }

  async updateUserProfile(userId, { name, bio, avatar, phone }) {
    const update = {};
    if (name !== undefined) update.name = name;
    if (bio !== undefined) update.bio = bio;

    let finalAvatar = avatar;
    if (avatar !== undefined) {
      finalAvatar = await this.offloadDataUrlToMedia(avatar, {
        filename: `avatar-${userId}.jpg`,
        uploadedBy: userId?.toString(),
        minLength: 4096,
      });
      update.avatar = finalAvatar;
    }

    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findByIdAndUpdate(userId, update, { new: true }).lean();
    } else {
      user = await User.findOneAndUpdate({ _id: userId }, update, { new: true }).lean();
    }

    if (user) {
      const sideUpdates = [];
      if (avatar !== undefined) {
        sideUpdates.push(Contact.updateMany({ username: user.primaryUsername }, { avatar: finalAvatar }).catch(() => {}));
        sideUpdates.push(Message.updateMany({ senderUsername: user.primaryUsername }, { senderAvatar: finalAvatar }).catch(() => {}));
      }
      if (name !== undefined) {
        sideUpdates.push(Contact.updateMany({ username: user.primaryUsername }, { name }).catch(() => {}));
        sideUpdates.push(Message.updateMany({ senderUsername: user.primaryUsername }, { senderName: name }).catch(() => {}));
      }
      if (sideUpdates.length > 0) {
        await Promise.all(sideUpdates);
      }
      const mapped = this.mapUser(user);
      invalidateCachedUser(userId?.toString(), user.primaryUsername);
      if (mapped) setCachedUser(mapped);
      return mapped;
    }

    return this.mapUser(user);
  }

  async updateUserStatus(userId, status) {
    if (!userId) return null;
    try {
      const filter = mongoose.Types.ObjectId.isValid(userId) ? { _id: userId } : { id: userId };
      const updated = await User.findOneAndUpdate(
        filter,
        { status: status || 'offline', lastActive: new Date() },
        { new: true }
      ).lean();
      if (updated) {
        const mapped = this.mapUser(updated);
        setCachedUser(mapped);
        return mapped;
      }
      return null;
    } catch {
      return null;
    }
  }

  async searchUsers(query, excludeUserId) {
    const q = (query || '').toLowerCase().trim().replace(/^@/, '');
    const filter = {};
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { primaryUsername: { $regex: escapedQ, $options: 'i' } },
        { 'contexts.username': { $regex: escapedQ, $options: 'i' } },
        { name: { $regex: escapedQ, $options: 'i' } },
        { email: { $regex: escapedQ, $options: 'i' } },
      ];
    }
    if (excludeUserId) {
      if (mongoose.Types.ObjectId.isValid(excludeUserId)) {
        filter._id = { $ne: excludeUserId };
      }
    }
    const users = await User.find(filter).limit(30).lean();
    registerKnownUsernames(users.map((u) => u.primaryUsername));
    return users.map((u) => this.mapUser(u));
  }

  getCanonicalDmId(username1, username2) {
    return buildCanonicalDmId(username1, username2);
  }

  async getMessagesByChat(chatId) {
    const messages = await Message.find({ chatId }).sort({ timestamp: 1 }).lean();
    return messages.map((m) => ({
      ...m,
      id: m.id || m._id.toString(),
      attachment: m.attachment || null,
      reactions: (m.reactions || []).map((r) => ({
        ...r,
        emoji: normalizeEmoji(r.emoji),
      })),
      isEdited: Boolean(m.isEdited),
      isRead: Boolean(m.isRead || (m.readBy && m.readBy.length > 1)),
      readBy: m.readBy || [],
      timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
    }));
  }

  async saveMessage(message) {
    const messageId = message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const finalContent = message.content ? message.content.trim() : '';

    let finalAttachment = null;
    if (message.attachment) {
      const att = { ...message.attachment };
      const name = att.name || 'image.jpg';
      let url = att.url || att.dataUrl || '';
      const mime = att.mimeType || 'image/jpeg';
      const isImg =
        att.type === 'image' ||
        mime.startsWith('image/') ||
        url.startsWith('data:image/') ||
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)($|\?|#)/i.test(name || url);

      att.type = isImg ? 'image' : (att.type || 'file');
      if (isImg && !att.mimeType) {
        att.mimeType = 'image/jpeg';
      }

      if (typeof url === 'string' && url.startsWith('data:')) {
        const persistedUrl = await this.offloadDataUrlToMedia(url, {
          filename: name,
          uploadedBy: message.senderId || null,
          minLength: 0,
        });
        if (persistedUrl !== url) {
          url = persistedUrl;
          delete att.dataUrl;
        }
      }

      att.url = url;
      finalAttachment = att;
    }

    // Never store huge inline base64 data URLs inside every Message document
    let cleanSenderAvatar = message.senderAvatar || null;
    if (typeof cleanSenderAvatar === 'string' && cleanSenderAvatar.startsWith('data:') && cleanSenderAvatar.length > 4096) {
      const cachedSender = await this.findUserByUsernameLight(message.senderUsername).catch(() => null);
      if (cachedSender?.avatar && !cachedSender.avatar.startsWith('data:')) {
        cleanSenderAvatar = cachedSender.avatar;
      } else {
        cleanSenderAvatar = await this.offloadDataUrlToMedia(cleanSenderAvatar, {
          filename: `avatar-${normalizeUsername(message.senderUsername) || message.senderId || 'user'}.jpg`,
          uploadedBy: message.senderId || null,
          minLength: 4096,
        });
      }
    }

    let saved;
    try {
      saved = await Message.create({
        id: messageId,
        chatId: message.chatId,
        chatType: message.chatType || (message.chatId?.startsWith('dm_') ? 'direct' : 'workspace-node'),
        senderId: message.senderId || 'user-1',
        senderName: message.senderName || 'User',
        senderUsername: normalizeUsername(message.senderUsername) || message.senderUsername || '',
        senderAvatar: cleanSenderAvatar,
        content: finalContent,
        type: message.type || (finalAttachment?.type || 'text'),
        callDetails: message.callDetails || null,
        attachment: finalAttachment,
        reactions: message.reactions || [],
        isEdited: Boolean(message.isEdited),
        isRead: Boolean(message.isRead),
        readBy: [message.senderId, normalizeUsername(message.senderUsername)].filter(Boolean),
        timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
      });
    } catch (createErr) {
      // Idempotent handling when REST + Socket or client retries send the same message id
      if (createErr?.code === 11000 && messageId) {
        const existing = await Message.findOne({ id: messageId }).lean();
        if (existing) {
          return {
            ...existing,
            id: existing.id || existing._id?.toString(),
            timestamp: existing.timestamp ? new Date(existing.timestamp).toISOString() : new Date().toISOString(),
          };
        }
      }
      throw createErr;
    }

    const previewText = finalContent || (finalAttachment?.type === 'image' ? '📷 Photo' : `📎 ${finalAttachment?.name || 'Attachment'}`);

    // If DM, ensure reciprocal contact relationships exist so both users see the conversation
    if (message.chatId && message.chatId.startsWith('dm_')) {
      const participants = extractDmParticipants(
        message.chatId,
        message.senderUsername,
        [message.recipientUsername]
      );
      if (participants.length === 2) {
        try {
          const [u1, u2] = await Promise.all([
            this.findUserByUsernameLight(participants[0]),
            this.findUserByUsernameLight(participants[1]),
          ]);
          if (u1 && u2) {
            const now = new Date();
            await Promise.all([
              Contact.findOneAndUpdate(
                { ownerId: u1._id.toString(), username: u2.primaryUsername },
                {
                  $set: {
                    id: message.chatId,
                    ownerId: u1._id.toString(),
                    name: u2.name,
                    username: u2.primaryUsername,
                    avatar: this.sanitizeAvatar(u2.avatar) || u2.avatar,
                    bio: u2.bio,
                    lastMessage: previewText,
                    lastMessageTime: now,
                  },
                },
                { upsert: true, new: true }
              ),
              Contact.findOneAndUpdate(
                { ownerId: u2._id.toString(), username: u1.primaryUsername },
                {
                  $set: {
                    id: message.chatId,
                    ownerId: u2._id.toString(),
                    name: u1.name,
                    username: u1.primaryUsername,
                    avatar: this.sanitizeAvatar(u1.avatar) || u1.avatar,
                    bio: u1.bio,
                    lastMessage: previewText,
                    lastMessageTime: now,
                  },
                },
                { upsert: true, new: true }
              ),
            ]);
          }
        } catch (e) {
          console.warn('[DB] Auto-link DM contacts warning:', e.message);
        }
      }
    } else {
      await Contact.updateMany(
        { id: message.chatId },
        { lastMessage: previewText, lastMessageTime: new Date() }
      ).catch(() => {});
    }

    return {
      ...saved.toObject(),
      id: saved.id,
      timestamp: saved.timestamp ? new Date(saved.timestamp).toISOString() : new Date().toISOString(),
    };
  }

  async findMessageById(messageId) {
    if (!messageId) return null;
    return await Message.findOne({ id: messageId }).lean();
  }

  async editMessage(messageId, newContent) {
    const updated = await Message.findOneAndUpdate(
      { id: messageId },
      { content: newContent.trim(), isEdited: true },
      { new: true }
    ).lean();

    if (!updated) return null;
    return {
      ...updated,
      id: updated.id,
      timestamp: updated.timestamp ? new Date(updated.timestamp).toISOString() : new Date().toISOString(),
    };
  }

  async deleteMessage(messageId) {
    const res = await Message.deleteOne({ id: messageId });
    return res.deletedCount > 0;
  }

  async addReaction(messageId, emoji, userId, action = null) {
    if (!messageId) return null;
    let msg = await Message.findOne({ id: messageId });
    if (!msg && mongoose.Types.ObjectId.isValid(messageId)) {
      msg = await Message.findById(messageId);
    }
    if (!msg) {
      console.warn('[storageService] addReaction: Message not found for id:', messageId);
      return null;
    }

    const uid = String(userId || 'user-1');
    const cleanEmoji = normalizeEmoji(emoji);
    let reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
    let existingIndex = reactions.findIndex((r) => normalizeEmoji(r.emoji) === cleanEmoji);

    if (existingIndex !== -1) {
      const existing = reactions[existingIndex];
      const users = (existing.users || []).map(String);
      const hasReacted = users.includes(uid);

      if (action === 'add') {
        if (!hasReacted) {
          users.push(uid);
        }
        existing.users = users;
        existing.count = users.length;
      } else if (action === 'remove') {
        const nextUsers = users.filter((u) => u !== uid);
        existing.users = nextUsers;
        existing.count = nextUsers.length;
      } else {
        // Toggle if no explicit action
        if (hasReacted) {
          existing.users = users.filter((u) => u !== uid);
          existing.count = existing.users.length;
        } else {
          users.push(uid);
          existing.users = users;
          existing.count = users.length;
        }
      }
      existing.emoji = cleanEmoji;
    } else {
      if (action !== 'remove') {
        reactions.push({ emoji: cleanEmoji, count: 1, users: [uid] });
      }
    }

    msg.reactions = reactions
      .map((r) => ({ ...r, emoji: normalizeEmoji(r.emoji) }))
      .filter((r) => r.count > 0 && r.users && r.users.length > 0);

    await msg.save();

    return {
      ...msg.toObject(),
      id: msg.id,
      reactions: msg.reactions,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
    };
  }

  async getUserConversations(currentUserId, currentUsername) {
    const cleanUsername = normalizeUsername(currentUsername);
    const uidStr = currentUserId ? currentUserId.toString() : '';

    if (!uidStr && !cleanUsername) {
      return { contacts: [], groups: [] };
    }

    if (cleanUsername) {
      registerKnownUsernames([cleanUsername]);
    }

    const escapedUname = cleanUsername ? cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

    // Fetch user contacts, DM chat IDs, and personal groups concurrently in parallel
    const [contacts, dmChatIds, formattedGroups] = await Promise.all([
      Contact.find({ ownerId: uidStr }).sort({ lastMessageTime: -1 }).lean(),
      escapedUname
        ? Message.distinct('chatId', {
            $or: [
              { chatId: new RegExp(`^dm_${escapedUname}_`, 'i') },
              { chatId: new RegExp(`^dm_.*_${escapedUname}$`, 'i') },
            ],
          })
        : Promise.resolve([]),
      groupService.getUserGroups(currentUserId, currentUsername),
    ]);

    const partnerUsernames = new Set();
    for (const chatId of dmChatIds) {
      const participants = extractDmParticipants(chatId, cleanUsername);
      if (participants.length === 2) {
        const partner = participants[0] === cleanUsername ? participants[1] : participants[0];
        if (partner && partner !== cleanUsername) {
          partnerUsernames.add(partner);
        }
      }
    }

    const existingUnames = new Set(contacts.map((c) => normalizeUsername(c.username)).filter(Boolean));
    const missingPartners = Array.from(partnerUsernames).filter((u) => !existingUnames.has(u));

    if (missingPartners.length > 0) {
      registerKnownUsernames(missingPartners);
      const canonicalIds = missingPartners.map((u) => this.getCanonicalDmId(cleanUsername, u));
      const [partnerUsers, latestDmMessages] = await Promise.all([
        User.find({ primaryUsername: { $in: missingPartners } }).lean(),
        Message.find({ chatId: { $in: canonicalIds } })
          .select('id chatId content type attachment timestamp')
          .sort({ timestamp: -1 })
          .limit(missingPartners.length * 5)
          .lean(),
      ]);

      const lastMsgMap = new Map();
      latestDmMessages.forEach((m) => {
        if (!lastMsgMap.has(m.chatId)) lastMsgMap.set(m.chatId, m);
      });

      partnerUsers.forEach((pUser) => {
        const uname = normalizeUsername(pUser.primaryUsername);
        const dmId = this.getCanonicalDmId(cleanUsername, uname);
        const lastMsg = lastMsgMap.get(dmId);
        contacts.push({
          id: dmId,
          ownerId: uidStr,
          userId: pUser._id.toString(),
          username: pUser.primaryUsername,
          name: pUser.name,
          avatar: pUser.avatar,
          status: pUser.status || 'online',
          bio: pUser.bio || '',
          lastMessage: lastMsg?.content || (lastMsg?.attachment ? '📎 Attachment' : 'Connected on ChatRooms'),
          lastMessageTime: lastMsg?.timestamp || new Date(),
          type: 'contact',
        });
      });
    }

    // Populate user profile info & compute unread counts concurrently
    const userNames = contacts.map((c) => normalizeUsername(c.username)).filter(Boolean);
    registerKnownUsernames(userNames);

    const contactChatIds = contacts.map((c) => c.id || this.getCanonicalDmId(cleanUsername, c.username)).filter(Boolean);
    const groupChatIds = (formattedGroups || []).map((g) => g.id).filter(Boolean);
    const allChatIds = Array.from(new Set([...contactChatIds, ...groupChatIds]));
    const readerTokens = [uidStr, cleanUsername].filter(Boolean);

    const [matchedUsers, unreadAgg] = await Promise.all([
      userNames.length > 0 ? User.find({ primaryUsername: { $in: userNames } }).lean() : Promise.resolve([]),
      allChatIds.length > 0
        ? Message.aggregate([
            {
              $match: {
                chatId: { $in: allChatIds },
                isRead: false,
                ...(readerTokens.length > 0 ? { readBy: { $nin: readerTokens } } : {}),
                ...(uidStr ? { senderId: { $ne: uidStr } } : {}),
                ...(cleanUsername ? { senderUsername: { $ne: cleanUsername } } : {}),
              },
            },
            { $group: { _id: '$chatId', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
    ]);

    const userMap = new Map();
    matchedUsers.forEach((u) => {
      const uname = normalizeUsername(u.primaryUsername);
      userMap.set(uname, u);
      setCachedUser(this.mapUser(u));
    });

    const unreadMap = new Map();
    unreadAgg.forEach((entry) => {
      if (entry?._id) unreadMap.set(entry._id, entry.count || 0);
    });

    const conversations = contacts.map((c) => {
      const u = userMap.get(normalizeUsername(c.username));
      const chatId = c.id || this.getCanonicalDmId(cleanUsername, c.username);
      return {
        id: chatId,
        userId: u?._id?.toString() || c.userId || c.ownerId,
        username: c.username,
        name: u?.name || c.name,
        avatar: u?.avatar || c.avatar,
        status: u?.status || c.status || 'offline',
        bio: u?.bio || c.bio || '',
        lastMessage: c.lastMessage || 'Connected on ChatRooms',
        lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime).toISOString() : new Date().toISOString(),
        unreadCount: unreadMap.get(chatId) || 0,
        type: 'contact',
      };
    });

    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    const groupsWithUnread = (formattedGroups || []).map((g) => ({
      ...g,
      unreadCount: unreadMap.get(g.id) || 0,
    }));

    return {
      contacts: conversations,
      groups: groupsWithUnread,
    };
  }

  async getContactsAndGroups(userId, username) {
    return this.getUserConversations(userId, username);
  }

  async addContact(currentUserId, currentUsername, targetUsername, name = null, bio = '', avatar = null) {
    const cleanTarget = (targetUsername || '').toLowerCase().trim().replace(/^@/, '');
    const cleanCurrent = (currentUsername || '').toLowerCase().trim().replace(/^@/, '');

    if (!cleanTarget) return null;

    const targetUser = await User.findOne({
      $or: [
        { primaryUsername: cleanTarget },
        { 'contexts.username': cleanTarget },
      ],
    });
    const resolvedTarget = (targetUser?.primaryUsername || cleanTarget).toLowerCase().trim().replace(/^@/, '');
    const dmId = this.getCanonicalDmId(cleanCurrent, resolvedTarget);
    const uidStr = currentUserId ? currentUserId.toString() : 'user-1';

    let contact = await Contact.findOne({
      ownerId: uidStr,
      username: { $in: Array.from(new Set([resolvedTarget, cleanTarget])) },
    });
    if (!contact) {
      contact = await Contact.create({
        id: dmId,
        ownerId: uidStr,
        name: targetUser?.name || name?.trim() || resolvedTarget,
        username: resolvedTarget,
        avatar: targetUser?.avatar || avatar || null,
        status: targetUser?.status || 'online',
        bio: targetUser?.bio || bio || '',
        lastMessage: 'Connected on ChatRooms',
        lastMessageTime: new Date(),
      });
    } else if (contact.username !== resolvedTarget || contact.id !== dmId) {
      contact.username = resolvedTarget;
      contact.id = dmId;
      await contact.save().catch(() => {});
    }

    // Reciprocal contact if target user is registered
    if (targetUser) {
      let reverseContact = await Contact.findOne({ ownerId: targetUser._id.toString(), username: cleanCurrent });
      if (!reverseContact) {
        const currentUser = await User.findOne({ primaryUsername: cleanCurrent });
        await Contact.create({
          id: dmId,
          ownerId: targetUser._id.toString(),
          name: currentUser?.name || cleanCurrent,
          username: cleanCurrent,
          avatar: currentUser?.avatar || null,
          status: currentUser?.status || 'online',
          bio: currentUser?.bio || '',
          lastMessage: 'Connected on ChatRooms',
          lastMessageTime: new Date(),
        }).catch(() => {});
      }
    }

    return {
      id: dmId,
      userId: targetUser ? targetUser._id.toString() : contact._id.toString(),
      username: resolvedTarget,
      primaryUsername: targetUser?.primaryUsername || resolvedTarget,
      name: contact.name,
      avatar: contact.avatar,
      status: contact.status || 'online',
      bio: contact.bio || '',
      lastMessage: contact.lastMessage || 'Connected on ChatRooms',
      lastMessageTime: contact.lastMessageTime?.toISOString?.() || new Date().toISOString(),
      type: 'contact',
    };
  }

  async addContactByUsername(username) {
    return this.addContact('user-1', 'user', username);
  }

  async createGroup(name, description = '', userId = null, parentGroupId = null, memberUsernames = []) {
    return groupService.createPersonalGroup(name, description, userId, parentGroupId, memberUsernames);
  }

  async updateGroup(groupId, updateData, userId) {
    return groupService.updateGroup(groupId, updateData, userId);
  }

  async addGroupMember(groupId, usernameToAdd, currentUserId) {
    return groupService.addGroupMember(groupId, usernameToAdd, currentUserId);
  }

  async removeGroupMember(groupId, memberIdOrUsername, currentUserId) {
    return groupService.removeGroupMember(groupId, memberIdOrUsername, currentUserId);
  }

  async deleteOrLeaveGroup(groupId, currentUserId, currentUsername) {
    return groupService.deleteOrLeaveGroup(groupId, currentUserId, currentUsername);
  }

  async deleteChat(chatId, currentUserId, currentUsername) {
    if (!chatId) return { success: false };

    const uidStr = currentUserId ? currentUserId.toString() : '';
    const cleanUsername = normalizeUsername(currentUsername);

    // 1. Delete all messages for this chat from MongoDB
    try {
      const chatIdsToDelete = [chatId];
      if (chatId.startsWith('dm_')) {
        const parts = extractDmParticipants(chatId, cleanUsername);
        if (parts.length === 2) {
          chatIdsToDelete.push(`dm_${parts[1]}_${parts[0]}`);
        }
      }
      await Message.deleteMany({ chatId: { $in: chatIdsToDelete } });
    } catch (e) {
      console.warn('[storageService] Error deleting messages for chat:', e);
    }

    // 2. Personal group or subgroup:
    if (chatId.startsWith('group-') || chatId.startsWith('subgroup-')) {
      try {
        await groupService.deleteOrLeaveGroup(chatId, currentUserId, currentUsername);
      } catch (e) {
        console.warn('[storageService] Error deleting group:', e);
      }
    } else {
      // 3. Direct Message or Contact deletion:
      try {
        const deleteConditions = [
          { id: chatId, ownerId: uidStr },
        ];

        if (chatId.startsWith('dm_')) {
          const parts = extractDmParticipants(chatId, cleanUsername);
          if (parts.length === 2) {
            deleteConditions.push({ id: `dm_${parts[1]}_${parts[0]}`, ownerId: uidStr });
          }
          parts.forEach((p) => {
            if (p && p !== cleanUsername) {
              deleteConditions.push({ username: p.toLowerCase(), ownerId: uidStr });
            }
          });
        }

        if (mongoose.Types.ObjectId.isValid(chatId)) {
          deleteConditions.push({ _id: chatId, ownerId: uidStr });
        }

        await Contact.deleteMany({ $or: deleteConditions });
      } catch (e) {
        console.warn('[storageService] Error deleting contact:', e);
      }
    }

    return { success: true, chatId };
  }


  async getWorkspaces(userId) {
    let workspaces = await Workspace.find({}).sort({ createdAt: 1 }).lean();

    if (workspaces.length === 0) {
      await this.seedDefaultWorkspaces();
      workspaces = await Workspace.find({}).sort({ createdAt: 1 }).lean();
    }

    // Batch fetch ALL workspace nodes in ONE query instead of N+1 queries
    const wsIds = workspaces.map((w) => w.id).filter(Boolean);
    const allNodes = wsIds.length > 0
      ? await WorkspaceNode.find({ workspaceId: { $in: wsIds } }).lean()
      : [];

    const nodesByWorkspace = new Map();
    for (const n of allNodes) {
      if (!nodesByWorkspace.has(n.workspaceId)) {
        nodesByWorkspace.set(n.workspaceId, []);
      }
      nodesByWorkspace.get(n.workspaceId).push(n);
    }

    const result = [];
    for (const w of workspaces) {
      const nodes = nodesByWorkspace.get(w.id) || [];
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      let formattedNodes = nodes.map((n) => ({
        id: n.id,
        name: n.name,
        membersCount: n.memberCount || 1,
        folder: n.parentId ? (nodeMap.get(n.parentId)?.name || null) : null,
        isAnnouncement: Boolean(n.isAnnouncement),
      }));

      if (formattedNodes.length === 0) {
        const defaultNode = await this.addNodeToWorkspace(w.id, { name: 'general', folder: null });
        formattedNodes = [
          {
            id: defaultNode.id,
            name: defaultNode.name,
            membersCount: 1,
            folder: null,
            isAnnouncement: false,
          },
        ];
      }

      result.push({
        ...w,
        membersCount: w.memberCount || 5,
        memberCount: w.memberCount || 5,
        settings: w.policy || { allowEmojis: true, allowAttachments: true },
        nodes: formattedNodes,
      });
    }

    return result;
  }

  async seedDefaultWorkspaces() {
    try {
      const ws1Id = 'ws-giet-univ';
      const ws2Id = 'ws-abc-tech';

      const existingWs1 = await Workspace.findOne({ id: ws1Id });
      if (!existingWs1) {
        await Workspace.create({
          id: ws1Id,
          name: 'GIET University',
          rootNodeId: `root-${ws1Id}`,
          defaultNodeId: `${ws1Id}-general`,
          type: 'organization',
          memberCount: 5,
          policy: { emoji: true, reactions: true, editMessage: true, deleteMessage: true },
        });

        await this.addNodeToWorkspace(ws1Id, { name: 'announcements', folder: null, isAnnouncement: true });
        await this.addNodeToWorkspace(ws1Id, { name: 'general', folder: null });
        await this.addNodeToWorkspace(ws1Id, { name: 'cse-aiml', folder: 'Computer Science' });
        await this.addNodeToWorkspace(ws1Id, { name: 'capstone-projects', folder: 'Computer Science' });
      }

      const existingWs2 = await Workspace.findOne({ id: ws2Id });
      if (!existingWs2) {
        await Workspace.create({
          id: ws2Id,
          name: 'ABC Technologies',
          rootNodeId: `root-${ws2Id}`,
          defaultNodeId: `${ws2Id}-general`,
          type: 'organization',
          memberCount: 5,
          policy: { emoji: true, reactions: true, editMessage: true, deleteMessage: true },
        });

        await this.addNodeToWorkspace(ws2Id, { name: 'general', folder: null });
        await this.addNodeToWorkspace(ws2Id, { name: 'react-frontend', folder: 'Engineering' });
        await this.addNodeToWorkspace(ws2Id, { name: 'backend-node', folder: 'Engineering' });
      }
    } catch (e) {
      console.warn('[DB] seedDefaultWorkspaces warning:', e.message);
    }
  }

  async getAllNodes() {
    const nodes = await WorkspaceNode.find({}).lean();
    const nodeMap = {};
    for (const n of nodes) {
      nodeMap[n.id] = {
        id: n.id,
        workspaceId: n.workspaceId,
        name: n.name,
        parentId: n.parentId || null,
        children: n.children || [],
        memberCount: n.memberCount || 1,
        hasConversation: n.hasConversation !== false,
        joinCode: n.joinCode || '',
        description: n.description || `${n.name} channel`,
        members: n.members || [],
      };
    }
    return nodeMap;
  }

  async getWorkspaceTree(workspaceId) {
    return this.getAllNodes();
  }

  async createWorkspace(name, contextualUsername, userId) {
    const wsId = `ws-${Date.now()}`;
    const cleanPrefix = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X') || 'WS';
    const salt = Date.now().toString(36).slice(-3).toUpperCase();
    const code = `ZYN-${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}-${salt}`;

    const rootNodeId = `root-${wsId}`;
    const defaultNodeId = `${wsId}-general`;

    const ws = await Workspace.create({
      id: wsId,
      name: name.trim(),
      joinCode: code,
      rootNodeId,
      defaultNodeId,
      type: 'organization',
      memberCount: 1,
      owner: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
      creatorName: 'You',
      contextualUsername: contextualUsername || '',
      policy: { emoji: true, reactions: true, editMessage: true, deleteMessage: true },
      members: [
        {
          user: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
          role: 'admin',
          contextualUsername: contextualUsername || '',
          joinedAt: new Date(),
        },
      ],
    });

    const genNode = await this.addNodeToWorkspace(wsId, { name: 'general', folder: null });

    return {
      id: wsId,
      name: ws.name,
      joinCode: code,
      membersCount: 1,
      memberCount: 1,
      isOwner: true,
      role: 'owner',
      settings: { allowEmojis: true, allowAttachments: true },
      nodes: [
        {
          id: genNode.id,
          name: genNode.name,
          membersCount: 1,
          folder: null,
          isAnnouncement: false,
        },
      ],
    };
  }

  async addNodeToWorkspace(workspaceId, { name, folder, description, isAnnouncement = false }) {
    const cleanName = (name || 'new-channel').replace(/^#/, '').toLowerCase().trim();
    const nodeId = `${workspaceId}-${cleanName}-${Date.now().toString(36)}`;
    const salt = Date.now().toString(36).slice(-3).toUpperCase();
    const joinCode = `ZYN-${cleanName.substring(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}-${salt}`;

    const node = await WorkspaceNode.create({
      id: nodeId,
      workspaceId,
      name: cleanName,
      parentId: folder || null,
      children: [],
      memberCount: 1,
      hasConversation: true,
      joinCode,
      description: description || `${cleanName} channel`,
      isAnnouncement: Boolean(isAnnouncement),
    });

    return {
      id: node.id,
      workspaceId: node.workspaceId,
      name: node.name,
      folder: node.parentId,
      description: node.description,
      isAnnouncement: node.isAnnouncement,
      membersCount: node.memberCount || 1,
    };
  }

  async joinWorkspace(code, userId) {
    const cleanCode = code.toUpperCase().trim();
    let workspace = await Workspace.findOne({ joinCode: cleanCode }).lean();
    let node = null;

    if (!workspace) {
      node = await WorkspaceNode.findOne({ joinCode: cleanCode });
      if (node) {
        workspace = await Workspace.findOne({ id: node.workspaceId }).lean();
      }
    }
    if (!workspace) {
      workspace = await Workspace.findOne({ id: cleanCode.toLowerCase() }).lean();
    }
    if (!workspace) return null;

    const nodes = await WorkspaceNode.find({ workspaceId: workspace.id }).lean();
    return {
      ...workspace,
      membersCount: workspace.memberCount || 1,
      memberCount: workspace.memberCount || 1,
      settings: workspace.policy || { allowEmojis: true, allowAttachments: true },
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        membersCount: n.memberCount || 1,
        folder: n.parentId,
        isAnnouncement: Boolean(n.isAnnouncement),
      })),
    };
  }
  async markMessagesRead(chatId, userId, username) {
    if (!chatId) return false;
    const uidStr = (userId || '').toString();
    const uIdent = (username || '').toLowerCase().replace(/^@/, '');

    const query = {
      chatId,
      isRead: false,
    };
    if (uidStr) {
      query.senderId = { $ne: uidStr };
    }
    if (uIdent) {
      query.senderUsername = { $ne: uIdent };
    }

    const res = await Message.updateMany(query, {
      $set: { isRead: true },
      ...(uidStr ? { $addToSet: { readBy: uidStr } } : {}),
    });

    return res.modifiedCount > 0;
  }

  async updateUserPassword(userId, hashedPassword) {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      return await User.findByIdAndUpdate(userId, { password: hashedPassword });
    } else {
      return await User.findOneAndUpdate({ _id: userId }, { password: hashedPassword });
    }
  }

}

export const storageService = new StorageService();
export default storageService;
