import storageService from '../services/storageService.js';

// @desc    Get personal contacts and groups for current user
// @route   GET /api/contacts
// @access  Public / Private
export const getContactsAndGroups = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const username = req.user ? (req.user.primaryUsername || req.user.username) : null;

    if (!userId) {
      return res.status(200).json({
        success: true,
        contacts: [],
        groups: [],
      });
    }

    const data = await storageService.getUserConversations(userId, username);

    return res.status(200).json({
      success: true,
      contacts: data.contacts,
      groups: data.groups,
    });
  } catch (error) {
    console.error('[Contacts] Error in getContactsAndGroups:', error);
    next(error);
  }
};

// @desc    Search registered users by username or name to add as contacts
// @route   GET /api/contacts/search
// @access  Public / Private
export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user?._id || req.user?.id;

    const users = await storageService.searchUsers(q, currentUserId);
    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('[Search] Error in searchUsers:', error);
    next(error);
  }
};

// @desc    Add a new personal contact
// @route   POST /api/contacts
// @access  Public / Private
export const createContact = async (req, res, next) => {
  try {
    const { name, username, contactUsername, bio, avatar } = req.body || {};
    const targetUsername = username || contactUsername;

    if (!targetUsername?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Username is required to add a contact',
      });
    }

    const currentUserId = req.user?._id || req.user?.id || 'user-1';
    const currentUsername = req.user?.primaryUsername || req.user?.username || 'user';

    const contact = await storageService.addContact(currentUserId, currentUsername, targetUsername, name, bio, avatar);
    if (!contact) {
      return res.status(400).json({
        success: false,
        message: `Failed to add contact @${targetUsername}`,
      });
    }

    // Real-time broadcast to both initiator and target users
    const io = req.app.get('io');
    if (io) {
      const cleanTarget = targetUsername.toLowerCase().trim().replace(/^@/, '');
      const cleanCurrent = currentUsername.toLowerCase().trim().replace(/^@/, '');
      const dmId = storageService.getCanonicalDmId(cleanCurrent, cleanTarget);

      const targetPayload = {
        id: dmId,
        username: cleanCurrent,
        name: req.user?.name || cleanCurrent,
        avatar: req.user?.avatar || null,
        status: req.user?.status || 'online',
        bio: req.user?.bio || '',
        lastMessage: 'Connected on ChatRooms',
        lastMessageTime: new Date().toISOString(),
        type: 'contact',
      };

      io.to(`user_${cleanTarget}`).emit('contact_added', targetPayload);
      io.to(`user_${cleanTarget}`).emit('new_conversation', targetPayload);
      io.to(`user_${cleanCurrent}`).emit('contact_added', contact);
    }

    return res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error('[CreateContact] Error in createContact:', error);
    next(error);
  }
};

// @desc    Create a new personal group or subgroup
// @route   POST /api/contacts/groups
// @access  Private
export const createPersonalGroup = async (req, res, next) => {
  try {
    const { name, description, parentGroupId, members } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required',
      });
    }

    const currentUserId = req.user?._id || req.user?.id;
    const group = await storageService.createGroup(
      name.trim(),
      description?.trim() || '',
      currentUserId,
      parentGroupId || null,
      members || []
    );

    const io = req.app.get('io');
    if (io && group) {
      (group.members || []).forEach((m) => {
        if (m.username) {
          const room = `user_${m.username.toLowerCase()}`;
          io.in(room).socketsJoin(group.id);
          io.to(room).emit('group_created', group);
        }
      });
    }

    return res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error('[CreateGroup] Error in createPersonalGroup:', error);
    next(error);
  }
};

// @desc    Edit personal group info (name, description, avatar)
// @route   PATCH /api/contacts/groups/:groupId
// @access  Protected
export const updatePersonalGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user?._id || req.user?.id;

    const updated = await storageService.updateGroup(groupId, req.body, currentUserId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('group_updated', updated);
      (updated.members || []).forEach((m) => {
        if (m.username) io.to(`user_${m.username.toLowerCase()}`).emit('group_updated', updated);
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[UpdateGroup] Error in updatePersonalGroup:', error);
    next(error);
  }
};

// @desc    Add member to group
// @route   POST /api/contacts/groups/:groupId/members
// @access  Protected
export const addGroupMemberController = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { username } = req.body;
    const currentUserId = req.user?._id || req.user?.id;

    if (!username?.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const result = await storageService.addGroupMember(groupId, username.trim(), currentUserId);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const io = req.app.get('io');
    if (io) {
      const cleanUname = username.trim().toLowerCase().replace(/^@/, '');
      io.in(`user_${cleanUname}`).socketsJoin(groupId);
      io.to(groupId).emit('group_member_added', { groupId, member: result.member, group: result.group });
      io.to(`user_${cleanUname}`).emit('group_created', result.group);
      io.to(`user_${cleanUname}`).emit('new_conversation', result.group);
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[AddMember] Error in addGroupMemberController:', error);
    next(error);
  }
};

// @desc    Remove member from group
// @route   DELETE /api/contacts/groups/:groupId/members/:memberId
// @access  Protected
export const removeGroupMemberController = async (req, res, next) => {
  try {
    const { groupId, memberId } = req.params;
    const currentUserId = req.user?._id || req.user?.id;

    const result = await storageService.removeGroupMember(groupId, memberId, currentUserId);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('group_member_removed', { groupId, memberId, group: result.group });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[RemoveMember] Error in removeGroupMemberController:', error);
    next(error);
  }
};

// @desc    Delete group (creator) or Leave group (member)
// @route   DELETE /api/contacts/groups/:groupId
// @access  Protected
export const deleteOrLeaveGroupController = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user?._id || req.user?.id;
    const currentUsername = req.user?.primaryUsername || req.user?.username;

    const result = await storageService.deleteOrLeaveGroup(groupId, currentUserId, currentUsername);

    const io = req.app.get('io');
    if (io) {
      if (result.action === 'deleted') {
        io.to(groupId).emit('group_deleted', { groupId });
        io.to(groupId).emit('chat_cleared', { chatId: groupId });
      } else {
        io.to(groupId).emit('group_member_removed', { groupId, memberId: currentUserId, memberUsername: currentUsername });
      }
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[DeleteLeaveGroup] Error in deleteOrLeaveGroupController:', error);
    next(error);
  }
};

// @desc    Delete a contact or clear personal group history
// @route   DELETE /api/contacts/:chatId
// @access  Protected
export const deleteContactOrGroup = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user?._id || req.user?.id;
    const currentUsername = req.user?.primaryUsername || req.user?.username;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required',
      });
    }

    await storageService.deleteChat(chatId, currentUserId, currentUsername);

    const io = req.app.get('io');
    if (io) {
      const cleanCurrent = (currentUsername || '').toLowerCase().trim().replace(/^@/, '');
      io.to(chatId).emit('chat_cleared', { chatId, clearedBy: cleanCurrent });
      if (chatId.startsWith('dm_')) {
        const body = chatId.slice(3).toLowerCase();
        let partner = null;
        if (cleanCurrent) {
          if (body.startsWith(`${cleanCurrent}_`)) partner = body.slice(cleanCurrent.length + 1);
          else if (body.endsWith(`_${cleanCurrent}`)) partner = body.slice(0, body.length - cleanCurrent.length - 1);
        }
        if (cleanCurrent) {
          io.to(`user_${cleanCurrent}`).emit('chat_cleared', { chatId, clearedBy: cleanCurrent });
        }
        if (partner && partner !== cleanCurrent) {
          io.to(`user_${partner}`).emit('chat_cleared', { chatId, clearedBy: cleanCurrent });
        } else if (!cleanCurrent) {
          const parts = body.split('_');
          if (parts.length === 2) {
            parts.forEach((p) => io.to(`user_${p}`).emit('chat_cleared', { chatId }));
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Chat and contact deleted successfully',
      data: { chatId },
    });
  } catch (error) {
    console.error('[DeleteContact] Error in deleteContactOrGroup:', error);
    next(error);
  }
};
