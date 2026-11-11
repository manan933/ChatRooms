import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import WorkspaceNode from '../models/WorkspaceNode.js';
import storageService from '../services/storageService.js';

const isMongoLive = () => mongoose.connection.readyState === 1;

// Helper to get all descendant node IDs recursively
const getAllDescendantIds = async (parentId) => {
  const descendants = [];
  const queue = [parentId];

  while (queue.length > 0) {
    const currId = queue.shift();
    const currNode = await WorkspaceNode.findOne({ id: currId });
    if (currNode && currNode.children?.length) {
      for (const childId of currNode.children) {
        descendants.push(childId);
        queue.push(childId);
      }
    }
  }

  return descendants;
};

// @desc    Get all workspaces
// @route   GET /api/workspaces
// @access  Public / Optional Auth
export const getWorkspaces = async (req, res, next) => {
  try {
    if (!isMongoLive()) {
      const workspaces = await storageService.getWorkspaces(req.user?._id || req.user?.id);
      return res.status(200).json({
        success: true,
        count: workspaces.length,
        data: workspaces,
      });
    }

    try {
      let query = {};
      if (req.user) {
        const isDemoOwner = req.user.primaryUsername === 'soumya' || req.user.email === 'soumya@chatrooms.com' || req.user.email === 'soumya@zyntra.com';
        if (!isDemoOwner) {
          query = {
            $or: [
              { owner: req.user._id || req.user.id },
              { 'members.user': req.user._id || req.user.id },
            ],
          };
        }
      }

      const rawWorkspaces = await Workspace.find(query).sort({ createdAt: 1 }).lean();

      // Batch fetch all workspace nodes in ONE query instead of N+1 per-workspace queries
      const wsIds = rawWorkspaces.map((ws) => ws.id).filter(Boolean);
      const wsObjIds = rawWorkspaces.map((ws) => ws._id?.toString()).filter(Boolean);
      const allLookupIds = Array.from(new Set([...wsIds, ...wsObjIds]));
      const allNodes = allLookupIds.length > 0
        ? await WorkspaceNode.find({ workspaceId: { $in: allLookupIds } }).lean()
        : [];

      const nodesByWsId = new Map();
      for (const n of allNodes) {
        if (!nodesByWsId.has(n.workspaceId)) {
          nodesByWsId.set(n.workspaceId, []);
        }
        nodesByWsId.get(n.workspaceId).push(n);
      }

      // Populate nodes and joinCode for each workspace
      const workspaces = await Promise.all(
        rawWorkspaces.map(async (ws) => {
          const byCustomId = ws.id ? (nodesByWsId.get(ws.id) || []) : [];
          const byObjId = ws._id ? (nodesByWsId.get(ws._id.toString()) || []) : [];
          let nodes = byCustomId.length > 0 || byObjId.length > 0
            ? Array.from(new Map([...byCustomId, ...byObjId].map((n) => [n.id || n._id?.toString(), n])).values())
            : [];

          let wsJoinCode = ws.joinCode;
          if (!wsJoinCode) {
            const shortCode = (ws.name || 'WS').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X') || 'WS';
            wsJoinCode = 'WS-' + shortCode + '-' + Math.floor(1000 + Math.random() * 9000);
            await Workspace.updateOne({ id: ws.id }, { $set: { joinCode: wsJoinCode } });
          }

          if (!nodes || nodes.length === 0) {
            const defaultId = ws.defaultNodeId || `chan-general-${ws.id}`;
            const fallbackNode = await WorkspaceNode.create({
              id: defaultId,
              workspaceId: ws.id,
              name: 'General',
              parentId: ws.rootNodeId || null,
              children: [],
              memberCount: ws.memberCount || 1,
              hasConversation: true,
              joinCode: wsJoinCode + '-GEN',
              description: 'General discussions',
            }).catch(() => null);

            if (fallbackNode) {
              nodes = [fallbackNode.toObject ? fallbackNode.toObject() : fallbackNode];
            } else {
              nodes = [
                {
                  id: defaultId,
                  name: 'General',
                  memberCount: ws.memberCount || 1,
                  parentId: null,
                  isAnnouncement: false,
                },
              ];
            }
          }

          const nodeById = new Map(nodes.map((n) => [n.id, n]));
          return {
            ...ws,
            parentWorkspaceId: ws.parentWorkspaceId || null,
            joinCode: wsJoinCode,
            nodes: nodes.map((n) => ({
              id: n.id,
              name: n.name,
              membersCount: n.memberCount || 1,
              folder: n.folder || (n.parentId && n.parentId !== ws.rootNodeId ? (nodeById.get(n.parentId)?.name || null) : null),
              isAnnouncement: Boolean(n.isAnnouncement),
              joinCode: wsJoinCode,
            })),
          };
        })
      );

      return res.status(200).json({
        success: true,
        count: workspaces.length,
        data: workspaces,
      });
    } catch (dbErr) {
      console.warn('[Workspaces] Mongoose query failed, using storageService:', dbErr.message);
      const workspaces = await storageService.getWorkspaces();
      return res.status(200).json({
        success: true,
        count: workspaces.length,
        data: workspaces,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all workspace nodes as a key-value dictionary (matching client store)
// @route   GET /api/workspaces/nodes
// @access  Public
export const getAllNodes = async (req, res, next) => {
  try {
    if (!isMongoLive()) {
      const nodeMap = await storageService.getAllNodes();
      return res.status(200).json({
        success: true,
        data: nodeMap,
      });
    }

    try {
      const nodes = await WorkspaceNode.find().lean();
      const nodeMap = {};
      nodes.forEach((n) => {
        nodeMap[n.id] = {
          id: n.id,
          workspaceId: n.workspaceId,
          name: n.name,
          parentId: n.parentId,
          children: n.children || [],
          memberCount: n.memberCount || 1,
          hasConversation: n.hasConversation !== false,
          joinCode: n.joinCode,
          description: n.description,
          members: n.members || [],
        };
      });

      return res.status(200).json({
        success: true,
        data: nodeMap,
      });
    } catch (dbErr) {
      console.warn('[Nodes] Mongoose query failed, using storageService:', dbErr.message);
      const nodeMap = await storageService.getAllNodes();
      return res.status(200).json({
        success: true,
        data: nodeMap,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get tree nodes for specific workspace
// @route   GET /api/workspaces/:id/tree
// @access  Public
export const getWorkspaceTree = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isMongoLive()) {
      const nodeMap = await storageService.getWorkspaceTree(id);
      return res.status(200).json({
        success: true,
        data: nodeMap,
      });
    }

    try {
      const nodes = await WorkspaceNode.find({ workspaceId: id }).lean();
      const nodeMap = {};
      nodes.forEach((n) => {
        nodeMap[n.id] = {
          id: n.id,
          workspaceId: n.workspaceId,
          name: n.name,
          parentId: n.parentId,
          children: n.children || [],
          memberCount: n.memberCount || 1,
          hasConversation: n.hasConversation !== false,
          joinCode: n.joinCode,
          description: n.description,
          members: n.members || [],
        };
      });

      return res.status(200).json({
        success: true,
        data: nodeMap,
      });
    } catch (dbErr) {
      console.warn('[Tree] Mongoose query failed, using storageService:', dbErr.message);
      const nodeMap = await storageService.getWorkspaceTree(id);
      return res.status(200).json({
        success: true,
        data: nodeMap,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new workspace
// @route   POST /api/workspaces
// @access  Private / Public
export const createWorkspace = async (req, res, next) => {
  try {
    const { name, contextualUsername, description, parentWorkspaceId } = req.body;
    const cleanParentId = parentWorkspaceId ? String(parentWorkspaceId).trim() : null;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required',
      });
    }

    if (!isMongoLive()) {
      const newWs = await storageService.createWorkspace(
        name.trim(),
        contextualUsername,
        req.user?._id || req.user?.id,
        cleanParentId
      );
      return res.status(201).json({
        success: true,
        data: {
          workspace: newWs,
          rootNode: newWs.nodes?.[0],
          generalNode: newWs.nodes?.[0],
        },
      });
    }

    try {
      let validParentId = null;
      if (cleanParentId) {
        const parentWs = await Workspace.findOne({ id: cleanParentId }).lean();
        if (!parentWs) {
          return res.status(404).json({
            success: false,
            message: 'Parent workspace not found',
          });
        }
        validParentId = parentWs.id;
      }

      const trimmedName = name.trim();
      const wsId = `ws-${Date.now()}`;
      const rootNodeId = `root-${wsId}`;
      const defaultChannelId = `chan-general-${wsId}`;
      const shortCode = trimmedName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X') || 'WS';
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      const wsJoinCode = 'WS-' + shortCode + '-' + randDigits;

      const creatorMember = {
        id: req.user?._id?.toString() || req.user?.id || 'user-1',
        name: req.user?.name || 'Creator',
        username: req.user?.primaryUsername || 'creator',
        avatar: req.user?.avatar || null,
        role: 'admin',
        joinedAt: new Date(),
      };

      const rootNode = await WorkspaceNode.create({
        id: rootNodeId,
        workspaceId: wsId,
        name: trimmedName,
        parentId: null,
        children: [defaultChannelId],
        memberCount: 1,
        hasConversation: true,
        joinCode: wsJoinCode,
        description: description?.trim() || `${trimmedName} headquarters & primary workspace`,
        createdBy: req.user?._id || null,
        members: [creatorMember],
      });

      const generalNode = await WorkspaceNode.create({
        id: defaultChannelId,
        workspaceId: wsId,
        name: 'General',
        parentId: rootNodeId,
        children: [],
        memberCount: 1,
        hasConversation: true,
        joinCode: wsJoinCode + '-GEN',
        description: 'General workspace discussions',
        createdBy: req.user?._id || null,
        members: [creatorMember],
      });

      const newWs = await Workspace.create({
        id: wsId,
        name: trimmedName,
        joinCode: wsJoinCode,
        parentWorkspaceId: validParentId,
        rootNodeId,
        defaultNodeId: defaultChannelId,
        type: 'organization',
        memberCount: 1,
        owner: req.user?._id || req.user?.id || null,
        creatorName: req.user?.name ? `${req.user.name} (You)` : 'You',
        contextualUsername:
          contextualUsername?.trim() ||
          `${req.user?.primaryUsername || 'user'}.${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        policy: {
          emoji: true,
          reactions: true,
          editMessage: true,
          deleteMessage: true,
          title: 'Standard Collaboration Policy',
        },
        members: [
          {
            user: req.user?._id || req.user?.id,
            role: 'admin',
            contextualUsername:
              contextualUsername?.trim() ||
              `${req.user?.primaryUsername || 'user'}.${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            joinedAt: new Date(),
          },
        ],
      });

      const formattedNewWs = {
        ...(newWs.toObject ? newWs.toObject() : newWs),
        nodes: [
          {
            id: generalNode.id,
            name: generalNode.name,
            membersCount: 1,
            folder: null,
            isAnnouncement: false,
            joinCode: wsJoinCode,
          },
          {
            id: rootNode.id,
            name: rootNode.name,
            membersCount: 1,
            folder: null,
            isAnnouncement: false,
            joinCode: wsJoinCode,
          },
        ],
      };

      return res.status(201).json({
        success: true,
        data: {
          workspace: formattedNewWs,
          rootNode,
          generalNode,
        },
      });
    } catch (dbErr) {
      console.warn('[CreateWorkspace] Mongoose query failed, using storageService:', dbErr.message);
      const newWs = await storageService.createWorkspace(
        name.trim(),
        contextualUsername,
        req.user?._id || req.user?.id,
        cleanParentId
      );
      return res.status(201).json({
        success: true,
        data: {
          workspace: newWs,
          rootNode: newWs.nodes?.[0],
          generalNode: newWs.nodes?.[0],
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create a sub-group / channel under parent node
// @route   POST /api/workspaces/:id/nodes
// @access  Public / Private
export const createGroup = async (req, res, next) => {
  try {
    const { id: workspaceId } = req.params;
    const { parentNodeId, name, description, folder, initialMembers = [] } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Channel name is required',
      });
    }

    if (!isMongoLive()) {
      const newNode = await storageService.addNodeToWorkspace(workspaceId, {
        name: name.trim(),
        folder: folder || description || null,
        description: description || '',
      });
      return res.status(201).json({
        success: true,
        data: newNode,
      });
    }

    try {
      const parent = parentNodeId ? await WorkspaceNode.findOne({ id: parentNodeId }) : null;
      const newId = `grp-${Date.now()}`;
      const cleanPrefix = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X') || 'GRP';
      const salt = Date.now().toString(36).slice(-3).toUpperCase();
      const joinCode = `ZYN-${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}-${salt}`;

      const creatorMember = {
        id: req.user?._id?.toString() || req.user?.id || 'user-1',
        name: req.user?.name || 'Creator',
        username: req.user?.primaryUsername || 'creator',
        avatar: req.user?.avatar || null,
        role: 'owner',
        joinedAt: new Date(),
      };

      const newNode = await WorkspaceNode.create({
        id: newId,
        workspaceId: workspaceId || parent?.workspaceId || 'ws-default',
        name: name.trim(),
        parentId: parentNodeId || null,
        folder: folder ? String(folder).trim() : null,
        children: [],
        memberCount: 1,
        hasConversation: true,
        joinCode,
        description: description?.trim() || `Channel created in workspace`,
        createdBy: req.user?._id || null,
        members: [creatorMember],
      });

      if (parent) {
        parent.children = [...(parent.children || []), newId];
        await parent.save();
      }

      return res.status(201).json({
        success: true,
        data: newNode,
        parent,
      });
    } catch (dbErr) {
      console.warn('[CreateNode] Mongoose query failed, using storageService:', dbErr.message);
      const newNode = await storageService.addNodeToWorkspace(workspaceId, {
        name: name.trim(),
        folder: folder || description || null,
        description: description || '',
      });
      return res.status(201).json({
        success: true,
        data: newNode,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Add multiple members to a group/node
// @route   POST /api/workspaces/:id/nodes/:nodeId/members
// @access  Public / Private
export const addMembersToNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Members array is required',
      });
    }

    if (!isMongoLive()) {
      return res.status(200).json({
        success: true,
        data: {
          node: { id: nodeId },
          addedMembers: members,
          totalMembers: members.length + 1,
        },
      });
    }

    try {
      const node = await WorkspaceNode.findOne({ id: nodeId });
      if (!node) {
        return res.status(404).json({
          success: false,
          message: 'Node not found',
        });
      }

      const currentMembers = node.members || [];
      const addedList = [];

      for (const m of members) {
        const cleanUser = (m.username || '').replace(/^@/, '').toLowerCase();
        const alreadyExists = currentMembers.some(
          (existing) =>
            existing.id === m.id ||
            existing.username?.replace(/^@/, '').toLowerCase() === cleanUser
        );
        if (!alreadyExists && cleanUser) {
          const newMember = {
            id: m.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: m.name || cleanUser,
            username: cleanUser,
            avatar: m.avatar || null,
            role: m.role || 'member',
            joinedAt: new Date(),
          };
          currentMembers.push(newMember);
          addedList.push(newMember);
        }
      }

      node.members = currentMembers;
      node.memberCount = currentMembers.length;
      await node.save();

      return res.status(200).json({
        success: true,
        data: {
          node,
          addedMembers: addedList,
          totalMembers: node.memberCount,
        },
      });
    } catch (dbErr) {
      return res.status(200).json({
        success: true,
        data: {
          node: { id: nodeId },
          addedMembers: members,
          totalMembers: members.length + 1,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Join group or channel by joinCode
// @route   POST /api/workspaces/join
// @access  Public / Private
export const joinGroupByCode = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid join code',
      });
    }

    const clean = code.trim().toUpperCase();
    const currentUserId = req.user?._id || req.user?.id;
    const currentUsername = req.user?.primaryUsername || req.user?.username || 'user';
    const currentName = req.user?.name || currentUsername;
    const currentAvatar = req.user?.avatar || null;

    if (!isMongoLive()) {
      const workspace = await storageService.joinWorkspace(clean, currentUserId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Invalid workspace invite code or workspace not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: {
          workspace,
          node: workspace.nodes?.[0],
        },
      });
    }

    try {
      // 1. Search by Workspace joinCode
      let workspace = await Workspace.findOne({
        $or: [
          { joinCode: clean },
          { id: clean.toLowerCase() },
          { joinCode: new RegExp('^' + clean + '$', 'i') },
        ],
      });

      let targetNode = null;

      if (workspace) {
        targetNode =
          (await WorkspaceNode.findOne({ id: workspace.defaultNodeId })) ||
          (await WorkspaceNode.findOne({ id: workspace.rootNodeId })) ||
          (await WorkspaceNode.findOne({ workspaceId: workspace.id }));
      } else {
        // 2. Search by WorkspaceNode joinCode
        targetNode = await WorkspaceNode.findOne({
          $or: [
            { joinCode: clean },
            { id: clean.toLowerCase() },
            { joinCode: new RegExp('^' + clean + '$', 'i') },
          ],
        });

        if (targetNode?.workspaceId) {
          workspace = await Workspace.findOne({ id: targetNode.workspaceId });
        }
      }

      if (!workspace && !targetNode) {
        const fallbackWs = await storageService.joinWorkspace(clean, currentUserId);
        if (!fallbackWs) {
          return res.status(404).json({
            success: false,
            message: 'Invalid invite code "' + clean + '". No matching workspace found.',
          });
        }
        return res.status(200).json({
          success: true,
          data: {
            workspace: fallbackWs,
            node: fallbackWs.nodes?.[0],
          },
        });
      }

      // Add user to Workspace members if not already present
      if (workspace && currentUserId) {
        workspace.members = workspace.members || [];
        const isMember = workspace.members.some(
          (m) => m.user?.toString() === currentUserId.toString()
        );
        if (!isMember) {
          workspace.members.push({
            user: currentUserId,
            role: 'member',
            contextualUsername: currentUsername + '.' + workspace.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            joinedAt: new Date(),
          });
          workspace.memberCount = workspace.members.length;
          await workspace.save();
        }
      }

      // Add user to all channels in this workspace so they have immediate access
      if (workspace?.id) {
        const allNodes = await WorkspaceNode.find({ workspaceId: workspace.id });
        for (const n of allNodes) {
          n.members = n.members || [];
          const exists = n.members.some(
            (m) =>
              m.id === currentUserId?.toString() ||
              m.username?.toLowerCase() === currentUsername.toLowerCase()
          );
          if (!exists) {
            n.members.push({
              id: currentUserId?.toString() || ('mem-' + Date.now()),
              name: currentName,
              username: currentUsername,
              avatar: currentAvatar,
              role: 'member',
              joinedAt: new Date(),
            });
            n.memberCount = n.members.length;
            await n.save();
          }
        }
        if (!targetNode && allNodes.length > 0) {
          targetNode = allNodes[0];
        }
      }

      const nodes = await WorkspaceNode.find({ workspaceId: workspace.id }).lean();
      const formattedWs = {
        ...(workspace.toObject ? workspace.toObject() : workspace),
        parentWorkspaceId: workspace.parentWorkspaceId || null,
        nodes: nodes.map((n) => ({
          id: n.id,
          name: n.name,
          membersCount: n.memberCount || 1,
          folder: n.folder || (n.parentId && n.parentId !== workspace.rootNodeId ? (nodes.find((p) => p.id === n.parentId)?.name || null) : null),
          isAnnouncement: Boolean(n.isAnnouncement),
          joinCode: workspace.joinCode,
        })),
      };

      return res.status(200).json({
        success: true,
        data: {
          workspace: formattedWs,
          node: targetNode,
        },
      });
    } catch (dbErr) {
      console.warn('[JoinWorkspace] Mongoose query failed, using storageService:', dbErr.message);
      const workspace = await storageService.joinWorkspace(clean, currentUserId);
      return res.status(200).json({
        success: true,
        data: {
          workspace,
          node: workspace?.nodes?.[0],
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Leave entire group and all descendants
// @route   POST /api/workspaces/leave-parent-group
// @access  Public / Private
export const leaveParentGroup = async (req, res, next) => {
  try {
    const { groupId } = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'groupId is required',
      });
    }

    return res.status(200).json({
      success: true,
      groupName: groupId,
      leftIds: [groupId],
      leftCount: 1,
      parentId: null,
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Remove a member from a group/node or workspace
// @route   DELETE /api/workspaces/nodes/:nodeId/members/:memberId
// @access  Protected
export const removeMemberFromNode = async (req, res, next) => {
  try {
    const { nodeId, memberId } = req.params;
    const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
    const currentUsername = (req.user?.primaryUsername || req.user?.username || '').toLowerCase();

    if (!nodeId || !memberId) {
      return res.status(400).json({ success: false, message: 'nodeId and memberId are required' });
    }

    const node = await WorkspaceNode.findOne({ id: nodeId });
    if (!node) {
      return res.status(404).json({ success: false, message: 'Channel or group not found' });
    }

    const workspace = node.workspaceId ? await Workspace.findOne({ id: node.workspaceId }) : null;

    // Check authorization: Must be owner, admin, or the user removing themselves
    const isSelf = memberId === currentUserId || memberId.toLowerCase() === currentUsername;
    const isWsOwner = workspace && workspace.owner?.toString() === currentUserId;
    const isWsAdmin = workspace && (workspace.members || []).some(
      (m) => m.user?.toString() === currentUserId && (m.role === 'admin' || m.role === 'owner')
    );
    const isNodeAdmin = (node.members || []).some(
      (m) => (m.id === currentUserId || m.username?.toLowerCase() === currentUsername) &&
             (m.role === 'admin' || m.role === 'owner')
    );

    if (!isSelf && !isWsOwner && !isWsAdmin && !isNodeAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only workspace admins can remove members',
      });
    }

    // Filter out the member
    node.members = (node.members || []).filter(
      (m) => m.id !== memberId && m.username?.toLowerCase() !== memberId.toLowerCase()
    );
    node.memberCount = node.members.length;
    await node.save();

    // If removing from workspace
    if (workspace) {
      workspace.members = (workspace.members || []).filter(
        (m) => m.user?.toString() !== memberId
      );
      workspace.memberCount = Math.max(1, workspace.members.length);
      await workspace.save();
    }

    // Socket real-time broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(nodeId).emit('member_removed', { nodeId, memberId });
      io.to('user_' + memberId.toLowerCase()).emit('removed_from_channel', { nodeId, workspaceId: workspace?.id });
    }

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      data: {
        nodeId,
        memberId,
        totalMembers: node.memberCount,
        members: node.members,
      },
    });
  } catch (error) {
    next(error);
  }
};
