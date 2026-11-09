import mongoose from 'mongoose';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { PersonalGroup } from '../models/Contact.js';

class GroupService {
  /**
   * Get all groups & subgroups that a user either created or belongs to as a member
   */
  async getUserGroups(userId, username) {
    try {
      const uidStr = userId ? userId.toString() : '';
      const cleanUname = (username || '').toLowerCase().replace(/^@/, '');

      const query = {
        $or: [
          ...(uidStr ? [{ creatorId: uidStr }, { 'members.id': uidStr }] : []),
          ...(cleanUname ? [{ 'members.username': cleanUname }] : []),
        ],
      };

      const groups = await PersonalGroup.find(query).sort({ lastMessageTime: -1 }).lean();

      return groups.map((g) => {
        const membersList = Array.isArray(g.members) ? g.members : [];
        return {
          id: g.id,
          name: g.name,
          description: g.description || '',
          avatar: g.avatar || null,
          membersCount: membersList.length > 0 ? membersList.length : (g.membersCount || 1),
          parentGroupId: g.parentGroupId || null,
          creatorId: g.creatorId,
          owner: g.creatorId,
          members: membersList,
          lastMessage: g.lastMessage || '',
          lastMessageTime: g.lastMessageTime ? new Date(g.lastMessageTime).toISOString() : new Date().toISOString(),
          type: 'group',
        };
      });
    } catch (err) {
      console.error('[GroupService] getUserGroups error:', err);
      return [];
    }
  }

  /**
   * Create a new group or subgroup with initial creator and optional members
   */
  async createPersonalGroup(name, description = '', userId = null, parentGroupId = null, initialMembers = []) {
    const id = parentGroupId ? `subgroup-${Date.now()}` : `group-${Date.now()}`;
    const uidStr = userId ? userId.toString() : 'user-1';

    let creatorUser = null;
    if (mongoose.Types.ObjectId.isValid(uidStr)) {
      creatorUser = await User.findById(uidStr).lean();
    }
    if (!creatorUser) {
      creatorUser = await User.findOne({ id: uidStr }).lean();
    }

    const members = [
      {
        id: uidStr,
        username: creatorUser?.primaryUsername || creatorUser?.username || 'user',
        name: creatorUser?.name || 'Admin',
        avatar: creatorUser?.avatar || null,
        role: 'owner',
        joinedAt: new Date(),
      },
    ];

    if (Array.isArray(initialMembers) && initialMembers.length > 0) {
      for (const mItem of initialMembers) {
        const rawUname = typeof mItem === 'string' ? mItem : (mItem.username || mItem.primaryUsername);
        const clean = (rawUname || '').trim().toLowerCase().replace(/^@/, '');
        if (!clean || clean === creatorUser?.primaryUsername?.toLowerCase()) continue;

        const u = await User.findOne({
          $or: [
            { primaryUsername: clean },
            { username: clean },
          ],
        }).lean();

        if (u) {
          members.push({
            id: u._id.toString(),
            username: u.primaryUsername || u.username,
            name: u.name,
            avatar: u.avatar || null,
            role: 'member',
            joinedAt: new Date(),
          });
        }
      }
    }

    const group = await PersonalGroup.create({
      id,
      name: name.trim(),
      description: description.trim(),
      membersCount: members.length,
      members,
      parentGroupId: parentGroupId || null,
      lastMessage: '',
      lastMessageTime: new Date(),
      creatorId: uidStr,
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar || null,
      membersCount: members.length,
      parentGroupId: group.parentGroupId || null,
      creatorId: uidStr,
      owner: uidStr,
      members,
      type: 'group',
    };
  }

  /**
   * Update group profile: name, description, avatar
   */
  async updateGroup(groupId, updateData = {}, userId = null) {
    const group = await PersonalGroup.findOne({ id: groupId });
    if (!group) return null;

    if (updateData.name && updateData.name.trim()) {
      group.name = updateData.name.trim();
    }
    if (typeof updateData.description === 'string') {
      group.description = updateData.description.trim();
    }
    if (updateData.avatar !== undefined) {
      group.avatar = updateData.avatar;
    }

    await group.save();
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar || null,
      membersCount: group.members?.length || group.membersCount || 1,
      parentGroupId: group.parentGroupId || null,
      creatorId: group.creatorId,
      owner: group.creatorId,
      members: group.members || [],
      type: 'group',
    };
  }

  /**
   * Add a member to a group by username
   */
  async addGroupMember(groupId, usernameToAdd, currentUserId = null) {
    const group = await PersonalGroup.findOne({ id: groupId });
    if (!group) return { success: false, error: 'Group not found' };

    const clean = (usernameToAdd || '').trim().toLowerCase().replace(/^@/, '');
    const userToAdd = await User.findOne({
      $or: [
        { primaryUsername: clean },
        { username: clean },
      ],
    }).lean();

    if (!userToAdd) {
      return { success: false, error: `User @${clean} not found` };
    }

    const uidStr = userToAdd._id.toString();
    if (!Array.isArray(group.members)) group.members = [];

    const alreadyMember = group.members.some(
      (m) => (m.id && m.id === uidStr) || (m.username && m.username.toLowerCase() === clean)
    );

    if (alreadyMember) {
      return { success: false, error: `@${clean} is already a member of this group` };
    }

    const newMember = {
      id: uidStr,
      username: userToAdd.primaryUsername || userToAdd.username,
      name: userToAdd.name,
      avatar: userToAdd.avatar || null,
      role: 'member',
      joinedAt: new Date(),
    };

    group.members.push(newMember);
    group.membersCount = group.members.length;
    await group.save();

    return {
      success: true,
      member: newMember,
      group: {
        id: group.id,
        name: group.name,
        membersCount: group.membersCount,
        members: group.members,
        type: 'group',
      },
    };
  }

  /**
   * Remove a member from a group
   */
  async removeGroupMember(groupId, memberIdOrUsername, currentUserId = null) {
    const group = await PersonalGroup.findOne({ id: groupId });
    if (!group) return { success: false, error: 'Group not found' };

    const clean = (memberIdOrUsername || '').toString().toLowerCase().replace(/^@/, '');
    if (!Array.isArray(group.members)) group.members = [];

    group.members = group.members.filter(
      (m) => m.id !== memberIdOrUsername && m.username?.toLowerCase() !== clean
    );

    group.membersCount = Math.max(1, group.members.length);
    await group.save();

    return {
      success: true,
      group: {
        id: group.id,
        name: group.name,
        membersCount: group.membersCount,
        members: group.members,
        type: 'group',
      },
    };
  }

  /**
   * Delete group (if creator/owner) or Leave group (if member)
   */
  async deleteOrLeaveGroup(groupId, currentUserId, currentUsername) {
    const group = await PersonalGroup.findOne({ id: groupId });
    if (!group) {
      await Message.deleteMany({ chatId: groupId });
      return { action: 'deleted' };
    }

    const uidStr = currentUserId ? currentUserId.toString() : '';
    const cleanUname = (currentUsername || '').toLowerCase().replace(/^@/, '');
    const isOwner = group.creatorId === uidStr || (group.members || []).some(
      (m) => ((m.id && m.id === uidStr) || (m.username && m.username.toLowerCase() === cleanUname)) && m.role === 'owner'
    );

    if (isOwner) {
      // Creator deleting: delete all nested subgroups, group itself, and messages
      await PersonalGroup.deleteMany({ parentGroupId: groupId });
      await PersonalGroup.deleteOne({ id: groupId });
      await Message.deleteMany({ chatId: groupId });
      return { action: 'deleted' };
    } else {
      // Member leaving: remove from members list
      if (Array.isArray(group.members)) {
        group.members = group.members.filter(
          (m) => m.id !== uidStr && m.username?.toLowerCase() !== cleanUname
        );
        group.membersCount = Math.max(1, group.members.length);
        await group.save();
      }
      return { action: 'left' };
    }
  }
}

export const groupService = new GroupService();
export default groupService;
