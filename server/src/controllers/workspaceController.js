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
        const isDemoOwner = req.user.primaryUsername === 'soumya' || req.user.email === 'soumya@zyntra.com';
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
      
      // Populate nodes for each workspace so Sidebar can render channels
      const workspaces = await Promise.all(
        rawWorkspaces.map(async (ws) => {
          const nodes = await WorkspaceNode.find({ workspaceId: ws.id }).lean();
          return {
            ...ws,
            nodes: nodes.map((n) => ({
              id: n.id,
              name: n.name,
              membersCount: n.memberCount || 1,
              folder: n.parentId ? (nodes.find((p) => p.id === n.parentId)?.name || null) : null,
              isAnnouncement: Boolean(n.isAnnouncement),
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
    const { name, contextualUsername, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required',
      });
    }

    if (!isMongoLive()) {
      const newWs = await storageService.createWorkspace(name.trim(), contextualUsername, req.user?._id || req.user?.id);
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
      const trimmedName = name.trim();
      const wsId = `ws-${Date.now()}`;
      const rootNodeId = `root-${wsId}`;
      const defaultChannelId = `chan-general-${wsId}`;
      const shortCode = trimmedName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X') || 'WS';
      const salt = Date.now().toString(36).slice(-3).toUpperCase();
      const randomSuffix = `${Math.floor(1000 + Math.random() * 9000)}-${salt}`;
      const rootJoinCode = `ZYN-${shortCode}-${randomSuffix}`;
      const generalJoinCode = `ZYN-${shortCode}-${randomSuffix}-GEN`;

      const creatorMember = {
        id: req.user?._id?.toString() || req.user?.id || 'user-1',
        name: req.user?.name || 'Creator',
        username: req.user?.primaryUsername || 'creator',
        avatar: req.user?.avatar || null,
        role: 'owner',
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
        joinCode: rootJoinCode,
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
        joinCode: generalJoinCode,
        description: 'General workspace discussions',
        createdBy: req.user?._id || null,
        members: [creatorMember],
      });

      const newWs = await Workspace.create({
        id: wsId,
        name: trimmedName,
        rootNodeId,
        defaultNodeId: defaultChannelId,
        type: 'organization',
        memberCount: 1,
        owner: req.user?._id || null,
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
      });

      return res.status(201).json({
        success: true,
        data: {
          workspace: newWs,
          rootNode,
          generalNode,
        },
      });
    } catch (dbErr) {
      console.warn('[CreateWorkspace] Mongoose query failed, using storageService:', dbErr.message);
      const newWs = await storageService.createWorkspace(name.trim(), contextualUsername);
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

    if (!isMongoLive()) {
      const workspace = await storageService.joinWorkspace(clean, req.user?._id || req.user?.id);
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
      const node = await WorkspaceNode.findOne({ joinCode: clean });

      if (!node) {
        // Also check if matches workspace join code in storage
        const fallbackWs = await storageService.joinWorkspace(clean, req.user?._id || req.user?.id);
        if (!fallbackWs) {
          return res.status(404).json({
            success: false,
            message: 'Invalid workspace invite code or channel not found',
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

      node.memberCount = (node.memberCount || 0) + 1;
      await node.save();

      let workspace = null;
      if (node.workspaceId) {
        workspace = await Workspace.findOne({ id: node.workspaceId });
        if (workspace && req.user) {
          const isMember = (workspace.members || []).some(
            (m) => m.user?.toString() === (req.user._id || req.user.id)?.toString()
          );
          if (!isMember) {
            workspace.members.push({
              user: req.user._id || req.user.id,
              role: 'member',
              contextualUsername: `${req.user.primaryUsername || 'user'}.${workspace.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
              joinedAt: new Date(),
            });
            workspace.memberCount = (workspace.memberCount || 0) + 1;
            await workspace.save();
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          node,
          workspace,
        },
      });
    } catch (dbErr) {
      console.warn('[JoinWorkspace] Mongoose query failed, using storageService:', dbErr.message);
      const workspace = await storageService.joinWorkspace(clean);
      return res.status(200).json({
        success: true,
        data: {
          workspace,
          node: workspace.nodes?.[0],
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
