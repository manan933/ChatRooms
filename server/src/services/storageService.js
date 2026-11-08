import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { Contact, PersonalGroup } from '../models/Contact.js';
import Workspace from '../models/Workspace.js';
import WorkspaceNode from '../models/WorkspaceNode.js';

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

  async findUserByEmail(email) {
    const clean = (email || '').toLowerCase().trim();
    if (!clean) return null;
    const user = await User.findOne({ email: clean }).select('+password');
    return this.mapUser(user);
  }

  async findUserByUsername(username) {
    const clean = (username || '').toLowerCase().trim().replace(/^@/, '');
    if (!clean) return null;
    const user = await User.findOne({ primaryUsername: clean }).select('+password');
    return this.mapUser(user);
  }

  async findUserById(id) {
    if (!id) return null;
    let user = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await User.findById(id).select('+password');
    }
    if (!user) {
      user = await User.findOne({
        $or: [{ _id: id }, { primaryUsername: id.replace(/^@/, '').toLowerCase() }],
      }).select('+password');
    }
    return this.mapUser(user);
  }

  async createUser({ name, email, primaryUsername, password, avatar, bio }) {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanUsername = (primaryUsername || '').toLowerCase().trim().replace(/^@/, '');

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { primaryUsername: cleanUsername }],
    });

    if (existingUser) {
      throw new Error('An account with that email or username already exists.');
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      primaryUsername: cleanUsername,
      password,
      avatar: avatar || null,
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

    return this.mapUser(user);
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
    if (avatar !== undefined) update.avatar = avatar;

    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findByIdAndUpdate(userId, update, { new: true });
    } else {
      user = await User.findOneAndUpdate({ _id: userId }, update, { new: true });
    }

    if (user && avatar !== undefined) {
      await Contact.updateMany({ username: user.primaryUsername }, { avatar }).catch(() => {});
      await Message.updateMany({ senderUsername: user.primaryUsername }, { senderAvatar: avatar }).catch(() => {});
    }

    if (user && name !== undefined) {
      await Contact.updateMany({ username: user.primaryUsername }, { name }).catch(() => {});
      await Message.updateMany({ senderUsername: user.primaryUsername }, { senderName: name }).catch(() => {});
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
      );
      return updated ? this.mapUser(updated) : null;
    } catch {
      return null;
    }
  }

  async searchUsers(query, excludeUserId) {
    const q = (query || '').toLowerCase().trim().replace(/^@/, '');
    const filter = {};
    if (q) {
      filter.$or = [
        { primaryUsername: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    if (excludeUserId) {
      if (mongoose.Types.ObjectId.isValid(excludeUserId)) {
        filter._id = { $ne: excludeUserId };
      }
    }
    const users = await User.find(filter).limit(30);
    return users.map((u) => this.mapUser(u));
  }

  getCanonicalDmId(username1, username2) {
    const u1 = (username1 || '').toLowerCase().trim().replace(/^@/, '');
    const u2 = (username2 || '').toLowerCase().trim().replace(/^@/, '');
    return 'dm_' + [u1, u2].sort().join('_');
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

    const saved = await Message.create({
      id: messageId,
      chatId: message.chatId,
      chatType: message.chatType || (message.chatId?.startsWith('dm_') ? 'direct' : 'workspace-node'),
      senderId: message.senderId || 'user-1',
      senderName: message.senderName || 'User',
      senderUsername: message.senderUsername || '',
      senderAvatar: message.senderAvatar || null,
      content: finalContent,
      type: message.type || (message.attachment?.type || 'text'),
      callDetails: message.callDetails || null,
      attachment: message.attachment || null,
      reactions: message.reactions || [],
      isEdited: Boolean(message.isEdited),
      isRead: Boolean(message.isRead),
      readBy: [message.senderId, message.senderUsername].filter(Boolean),
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    });

    const previewText = finalContent || (message.attachment?.type === 'image' ? '📷 Photo' : `📎 ${message.attachment?.name || 'Attachment'}`);

    // If DM, ensure reciprocal contact relationships exist so both users see the conversation
    if (message.chatId && message.chatId.startsWith('dm_')) {
      const parts = message.chatId.replace('dm_', '').split('_');
      if (parts.length === 2) {
        try {
          const u1 = await this.findUserByUsername(parts[0]);
          const u2 = await this.findUserByUsername(parts[1]);
          if (u1 && u2) {
            await Contact.findOneAndUpdate(
              { ownerId: u1._id.toString(), username: u2.primaryUsername },
              {
                $set: {
                  id: message.chatId,
                  ownerId: u1._id.toString(),
                  name: u2.name,
                  username: u2.primaryUsername,
                  avatar: u2.avatar,
                  bio: u2.bio,
                  lastMessage: previewText,
                  lastMessageTime: new Date(),
                },
              },
              { upsert: true, new: true }
            );

            await Contact.findOneAndUpdate(
              { ownerId: u2._id.toString(), username: u1.primaryUsername },
              {
                $set: {
                  id: message.chatId,
                  ownerId: u2._id.toString(),
                  name: u1.name,
                  username: u1.primaryUsername,
                  avatar: u1.avatar,
                  bio: u1.bio,
                  lastMessage: previewText,
                  lastMessageTime: new Date(),
                },
              },
              { upsert: true, new: true }
            );
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

  async addReaction(messageId, emoji, userId) {
    const msg = await Message.findOne({ id: messageId });
    if (!msg) return null;

    const uid = userId || 'user-1';
    const cleanEmoji = normalizeEmoji(emoji);
    let reactions = msg.reactions || [];
    let existing = reactions.find((r) => normalizeEmoji(r.emoji) === cleanEmoji);

    if (existing) {
      if (!existing.users.includes(uid)) {
        existing.users.push(uid);
      } else {
        existing.users = existing.users.filter((u) => u !== uid);
      }
      existing.count = existing.users.length;
      existing.emoji = cleanEmoji;
    } else {
      reactions.push({ emoji: cleanEmoji, count: 1, users: [uid] });
    }

    msg.reactions = reactions
      .map((r) => ({ ...r, emoji: normalizeEmoji(r.emoji) }))
      .filter((r) => r.count > 0);

    await msg.save();

    return {
      ...msg.toObject(),
      id: msg.id,
      reactions: msg.reactions,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
    };
  }

  async getUserConversations(currentUserId, currentUsername) {
    const cleanUsername = (currentUsername || '').toLowerCase().trim().replace(/^@/, '');
    const uidStr = currentUserId ? currentUserId.toString() : '';

    if (!uidStr && !cleanUsername) {
      return { contacts: [], groups: [] };
    }

    // Only return contacts that belong specifically to this user
    const contacts = await Contact.find({ ownerId: uidStr }).sort({ lastMessageTime: -1 }).lean();

    // Also look up any direct messages involving cleanUsername
    const dmMessages = await Message.find({
      chatId: { $regex: `^dm_.*${cleanUsername}` },
    }).lean();

    const partnerUsernames = new Set();
    for (const m of dmMessages) {
      const parts = m.chatId.replace('dm_', '').split('_');
      if (parts.length === 2) {
        const partner = parts[0] === cleanUsername ? parts[1] : (parts[1] === cleanUsername ? parts[0] : null);
        if (partner && partner !== cleanUsername) {
          partnerUsernames.add(partner);
        }
      }
    }

    for (const uname of partnerUsernames) {
      if (!contacts.some((c) => c.username?.toLowerCase() === uname)) {
        const pUser = await User.findOne({ primaryUsername: uname }).lean();
        if (pUser) {
          const dmId = this.getCanonicalDmId(cleanUsername, uname);
          const lastMsg = await Message.findOne({ chatId: dmId }).sort({ timestamp: -1 }).lean();
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
        }
      }
    }

    // Populate user profile info for latest avatars
    const userNames = contacts.map((c) => c.username?.toLowerCase()).filter(Boolean);
    const userMap = new Map();
    if (userNames.length > 0) {
      const matchedUsers = await User.find({ primaryUsername: { $in: userNames } }).lean();
      matchedUsers.forEach((u) => userMap.set(u.primaryUsername.toLowerCase(), u));
    }

    const conversations = contacts.map((c) => {
      const u = userMap.get(c.username?.toLowerCase());
      return {
        id: c.id || this.getCanonicalDmId(cleanUsername, c.username),
        userId: u?._id?.toString() || c.userId || c.ownerId,
        username: c.username,
        name: u?.name || c.name,
        avatar: u?.avatar || c.avatar,
        status: u?.status || c.status || 'offline',
        bio: u?.bio || c.bio || '',
        lastMessage: c.lastMessage || 'Connected on ChatRooms',
        lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime).toISOString() : new Date().toISOString(),
        type: 'contact',
      };
    });

    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    const groups = await PersonalGroup.find({ creatorId: uidStr }).sort({ lastMessageTime: -1 }).lean();
    const formattedGroups = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description || '',
      membersCount: g.membersCount || 1,
      lastMessage: g.lastMessage || '',
      lastMessageTime: g.lastMessageTime ? new Date(g.lastMessageTime).toISOString() : new Date().toISOString(),
      type: 'group',
    }));

    return {
      contacts: conversations,
      groups: formattedGroups,
    };
  }

  async getContactsAndGroups(userId, username) {
    return this.getUserConversations(userId, username);
  }

  async addContact(currentUserId, currentUsername, targetUsername, name = null, bio = '', avatar = null) {
    const cleanTarget = (targetUsername || '').toLowerCase().trim().replace(/^@/, '');
    const cleanCurrent = (currentUsername || '').toLowerCase().trim().replace(/^@/, '');

    if (!cleanTarget) return null;

    const targetUser = await User.findOne({ primaryUsername: cleanTarget });
    const dmId = this.getCanonicalDmId(cleanCurrent, cleanTarget);
    const uidStr = currentUserId ? currentUserId.toString() : 'user-1';

    let contact = await Contact.findOne({ ownerId: uidStr, username: cleanTarget });
    if (!contact) {
      contact = await Contact.create({
        id: dmId,
        ownerId: uidStr,
        name: targetUser?.name || name?.trim() || cleanTarget,
        username: cleanTarget,
        avatar: targetUser?.avatar || avatar || null,
        status: targetUser?.status || 'online',
        bio: targetUser?.bio || bio || '',
        lastMessage: 'Connected on ChatRooms',
        lastMessageTime: new Date(),
      });
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
      username: cleanTarget,
      name: contact.name,
      avatar: contact.avatar,
      status: contact.status || 'online',
      bio: contact.bio || '',
      lastMessage: contact.lastMessage || 'Connected on ChatRooms',
      lastMessageTime: new Date().toISOString(),
      type: 'contact',
    };
  }

  async addContactByUsername(username) {
    return this.addContact('user-1', 'user', username);
  }

  async createGroup(name, description = '', userId = null) {
    const id = `group-${Date.now()}`;
    const group = await PersonalGroup.create({
      id,
      name: name.trim(),
      description: description.trim(),
      membersCount: 1,
      lastMessage: '',
      lastMessageTime: new Date(),
      creatorId: userId ? userId.toString() : 'user-1',
    });
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      membersCount: 1,
      type: 'group',
    };
  }

  async getWorkspaces(userId) {
    let workspaces = await Workspace.find({}).sort({ createdAt: 1 }).lean();

    if (workspaces.length === 0) {
      await this.seedDefaultWorkspaces();
      workspaces = await Workspace.find({}).sort({ createdAt: 1 }).lean();
    }

    const result = [];
    for (const w of workspaces) {
      const nodes = await WorkspaceNode.find({ workspaceId: w.id }).lean();
      let formattedNodes = nodes.map((n) => ({
        id: n.id,
        name: n.name,
        membersCount: n.memberCount || 1,
        folder: n.parentId ? (nodes.find((p) => p.id === n.parentId)?.name || null) : null,
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
      rootNodeId,
      defaultNodeId,
      type: 'organization',
      memberCount: 1,
      owner: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
      creatorName: 'You',
      contextualUsername: contextualUsername || '',
      policy: { emoji: true, reactions: true, editMessage: true, deleteMessage: true },
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
    let node = await WorkspaceNode.findOne({ joinCode: cleanCode });
    let workspace = null;

    if (node) {
      workspace = await Workspace.findOne({ id: node.workspaceId }).lean();
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
