import express from 'express';
import {
  getWorkspaces,
  getAllNodes,
  getWorkspaceTree,
  createWorkspace,
  createGroup,
  addMembersToNode,
  joinGroupByCode,
  leaveParentGroup,
  removeMemberFromNode,
} from '../controllers/workspaceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getWorkspaces);
router.get('/nodes', protect, getAllNodes);
router.get('/:id/tree', protect, getWorkspaceTree);
router.post('/', protect, createWorkspace);
router.post('/:id/nodes', protect, createGroup);
router.post('/:id/nodes/:nodeId/members', protect, addMembersToNode);
router.post('/nodes/:nodeId/members', protect, addMembersToNode);
router.post('/join', protect, joinGroupByCode);
router.post('/leave-parent-group', protect, leaveParentGroup);
router.delete('/:id/nodes/:nodeId/members/:memberId', protect, removeMemberFromNode);
router.delete('/nodes/:nodeId/members/:memberId', protect, removeMemberFromNode);

export default router;
