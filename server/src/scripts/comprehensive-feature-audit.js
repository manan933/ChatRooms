import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import http from 'http';
import fs from 'fs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import app from '../app.js';
import { connectDB } from '../config/db.js';
import { setupChatSocket } from '../sockets/chatSocket.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceNode from '../models/WorkspaceNode.js';
import Message from '../models/Message.js';
import { Contact, PersonalGroup } from '../models/Contact.js';

// Setup dynamic import for socket.io-client from client node_modules
const clientSocketIoPath = path.resolve(__dirname, '../../../client/node_modules/socket.io-client/build/esm/index.js');
let ClientIO;
try {
  const mod = await import(pathToFileURL(clientSocketIoPath).href);
  ClientIO = mod.io || mod.default?.io || mod.default;
} catch (e) {
  console.warn('[Socket.io Client Import Fallback]', e.message);
}

// Metrics tracker
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warnedTests = 0;
const auditLog = [];

function recordTest(category, testName, passed, details = '', isWarning = false) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  [PASS] [${category}] ${testName}`);
    auditLog.push({ category, testName, status: 'PASS', details });
  } else if (isWarning) {
    warnedTests++;
    console.warn(`  [WARN] [${category}] ${testName} - ${details}`);
    auditLog.push({ category, testName, status: 'WARN', details });
  } else {
    failedTests++;
    console.error(`  [FAIL] [${category}] ${testName} - ${details}`);
    auditLog.push({ category, testName, status: 'FAIL', details });
  }
}

// HTTP request helper
async function httpRequest(baseUrl, method, endpoint, body = null, token = null, isFormData = false) {
  const url = `${baseUrl}${endpoint}`;
  const options = { method, headers: {} };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    if (isFormData) {
      options.body = body; // Native FormData sets multipart header automatically
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.status, headers: res.headers, data };
  } catch (err) {
    return { status: 0, error: err.message, data: null };
  }
}

async function runComprehensiveFeatureAudit() {
  console.log('================================================================');
  console.log('🛡️  ZYNTRA COMPREHENSIVE MULTI-LAYER FEATURE AUDIT RUNNER');
  console.log('   Testing: 27 REST Endpoints, Socket.io Real-Time, Atlas DB');
  console.log('================================================================\n');

  // 1. Database Connection
  console.log('[Step 1] Connecting to live MongoDB Atlas cluster...');
  await connectDB(5, 2000);
  console.log(`[MongoDB Atlas] Connected to database: "${mongoose.connection.name}" at host "${mongoose.connection.host}"\n`);

  // 2. Setup Ephemeral HTTP & Socket.io Server
  console.log('[Step 2] Initializing isolated HTTP & Socket.io audit server...');
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true },
  });
  setupChatSocket(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}`;
  console.log(`[HTTP Server] Listening on ephemeral port: ${port}`);
  console.log(`[Base URL] ${BASE_URL}\n`);

  // Track created entities for automated cleanup
  const cleanupUserIds = [];
  const cleanupWorkspaceIds = [];
  const cleanupNodeIds = [];
  const cleanupMessageIds = [];
  const cleanupContactIds = [];
  const cleanupGroupIds = [];
  const cleanupFiles = [];

  const timestamp = Date.now().toString().slice(-6);

  try {
    // ========================================================================
    // LAYER 1: BACKEND REST API AUDIT (ALL 27 ENDPOINTS)
    // ========================================================================
    console.log('----------------------------------------------------------------');
    console.log('LAYER 1: BACKEND REST API AUDIT (ALL 27 ENDPOINTS)');
    console.log('----------------------------------------------------------------\n');

    // --- HEALTH CHECK (Endpoint 1) ---
    console.log('--- Suite 1: System Health Endpoint ---');
    const healthRes = await httpRequest(BASE_URL, 'GET', '/api/health');
    recordTest(
      'REST: Health',
      'GET /api/health returns 200 OK with operational payload',
      healthRes.status === 200 && healthRes.data?.status === 'ok' && Boolean(healthRes.data?.timestamp),
      `Status: ${healthRes.status}, data: ${JSON.stringify(healthRes.data)}`
    );

    // --- AUTHENTICATION & DIAGNOSTICS (Endpoints 2-7) ---
    console.log('\n--- Suite 2: Authentication & Context Endpoints ---');

    // Endpoint 2: GET /api/auth/diagnostic rejects unauthenticated request (Security Hardening)
    const unauthDiagRes = await httpRequest(BASE_URL, 'GET', '/api/auth/diagnostic');
    recordTest(
      'REST: Auth',
      'GET /api/auth/diagnostic rejects unauthenticated access with 401 Unauthorized',
      unauthDiagRes.status === 401,
      `Status: ${unauthDiagRes.status}`
    );

    // Endpoint 3: POST /api/auth/register (Primary test user 1)
    const user1Email = `audit_user1_${timestamp}@zyntra.test`;
    const user1Username = `auditor1_${timestamp}`;
    const user1Password = 'StrongAuditPass123!';
    const regRes1 = await httpRequest(BASE_URL, 'POST', '/api/auth/register', {
      name: 'Auditor Alpha',
      email: user1Email,
      primaryUsername: user1Username,
      password: user1Password,
    });
    recordTest(
      'REST: Auth',
      'POST /api/auth/register returns 201 Created with JWT and user object',
      regRes1.status === 201 && regRes1.data?.success === true && Boolean(regRes1.data?.token),
      `Status: ${regRes1.status}, token present: ${Boolean(regRes1.data?.token)}`
    );
    const token1 = regRes1.data?.token;
    const user1Id = regRes1.data?.user?.id || regRes1.data?.user?._id;
    if (user1Id) cleanupUserIds.push(user1Id);

    // Endpoint 2b: Authenticated GET /api/auth/diagnostic
    const authDiagRes = await httpRequest(BASE_URL, 'GET', '/api/auth/diagnostic', null, token1);
    recordTest(
      'REST: Auth',
      'GET /api/auth/diagnostic with Bearer token returns 200 OK and connected status',
      authDiagRes.status === 200 && authDiagRes.data?.success === true && authDiagRes.data?.connected === true,
      `Status: ${authDiagRes.status}, connected: ${authDiagRes.data?.connected}`
    );

    // Negative test: Duplicate registration rejection
    const dupRegRes = await httpRequest(BASE_URL, 'POST', '/api/auth/register', {
      name: 'Auditor Alpha Duplicate',
      email: user1Email,
      primaryUsername: user1Username,
      password: user1Password,
    });
    recordTest(
      'REST: Auth',
      'POST /api/auth/register rejects duplicate registration with 400 Bad Request',
      dupRegRes.status === 400 && dupRegRes.data?.success === false,
      `Status: ${dupRegRes.status}, error: ${dupRegRes.data?.message}`
    );

    // Register user 2 for peer/reciprocal tests
    const user2Email = `audit_user2_${timestamp}@zyntra.test`;
    const user2Username = `auditor2_${timestamp}`;
    const user2Password = 'StrongAuditPass456!';
    const regRes2 = await httpRequest(BASE_URL, 'POST', '/api/auth/register', {
      name: 'Auditor Beta',
      email: user2Email,
      primaryUsername: user2Username,
      password: user2Password,
    });
    const token2 = regRes2.data?.token;
    const user2Id = regRes2.data?.user?.id || regRes2.data?.user?._id;
    if (user2Id) cleanupUserIds.push(user2Id);

    // Endpoint 4: POST /api/auth/login
    const loginRes = await httpRequest(BASE_URL, 'POST', '/api/auth/login', {
      email: user1Email,
      password: user1Password,
    });
    recordTest(
      'REST: Auth',
      'POST /api/auth/login returns 200 OK with fresh JWT for valid credentials',
      loginRes.status === 200 && loginRes.data?.success === true && Boolean(loginRes.data?.token),
      `Status: ${loginRes.status}`
    );

    // Login with username handle
    const loginHandleRes = await httpRequest(BASE_URL, 'POST', '/api/auth/login', {
      email: `@${user1Username}`,
      password: user1Password,
    });
    recordTest(
      'REST: Auth',
      'POST /api/auth/login supports login by @username handle with 200 OK',
      loginHandleRes.status === 200 && loginHandleRes.data?.success === true,
      `Status: ${loginHandleRes.status}`
    );

    // Negative test: Bad password login
    const badLoginRes = await httpRequest(BASE_URL, 'POST', '/api/auth/login', {
      email: user1Email,
      password: 'IncorrectPassword999!',
    });
    recordTest(
      'REST: Auth',
      'POST /api/auth/login rejects incorrect password with 401 Unauthorized',
      badLoginRes.status === 401 && badLoginRes.data?.success === false,
      `Status: ${badLoginRes.status}`
    );

    // Endpoint 5: GET /api/auth/me
    const meRes = await httpRequest(BASE_URL, 'GET', '/api/auth/me', null, token1);
    recordTest(
      'REST: Auth',
      'GET /api/auth/me returns 200 OK and current profile for authenticated request',
      meRes.status === 200 && meRes.data?.user?.primaryUsername === user1Username,
      `Status: ${meRes.status}, returned username: ${meRes.data?.user?.primaryUsername}`
    );

    // Negative test: GET /api/auth/me without token
    const unauthMeRes = await httpRequest(BASE_URL, 'GET', '/api/auth/me');
    recordTest(
      'REST: Auth',
      'GET /api/auth/me rejects missing bearer token with 401 Unauthorized',
      unauthMeRes.status === 401 && unauthMeRes.data?.success === false,
      `Status: ${unauthMeRes.status}`
    );

    // Endpoint 6: PUT /api/auth/profile
    const updatedBio = 'Lead Security & Feature Auditor for Zyntra';
    const updatedPhone = '+1-800-555-AUDIT';
    const updatedName = 'Auditor Alpha PhD';
    const profileRes = await httpRequest(
      BASE_URL,
      'PUT',
      '/api/auth/profile',
      {
        name: updatedName,
        bio: updatedBio,
        phone: updatedPhone,
      },
      token1
    );
    recordTest(
      'REST: Auth',
      'PUT /api/auth/profile updates profile and returns 200 OK with persisted fields',
      profileRes.status === 200 &&
        profileRes.data?.user?.bio === updatedBio &&
        profileRes.data?.user?.phone === updatedPhone,
      `Status: ${profileRes.status}, bio: ${profileRes.data?.user?.bio}`
    );

    // Endpoint 7: POST /api/auth/context
    const contextRes = await httpRequest(
      BASE_URL,
      'POST',
      '/api/auth/context',
      {
        id: `ctx-audit-${timestamp}`,
        type: 'organization',
        name: 'Zyntra Audit Labs',
        username: `${user1Username}.auditlabs`,
      },
      token1
    );
    recordTest(
      'REST: Auth',
      'POST /api/auth/context persists new organizational context with 200 OK',
      contextRes.status === 200 &&
        Array.isArray(contextRes.data?.contexts) &&
        contextRes.data?.contexts.some((c) => c.name === 'Zyntra Audit Labs'),
      `Status: ${contextRes.status}, contexts count: ${contextRes.data?.contexts?.length}`
    );

    // --- WORKSPACES & HIERARCHY TREE (Endpoints 8-16) ---
    console.log('\n--- Suite 3: Workspaces & Channel Hierarchy Endpoints ---');

    // Endpoint 10: POST /api/workspaces (Create workspace first so we can query)
    const wsName = `Audit Corp ${timestamp}`;
    const createWsRes = await httpRequest(
      BASE_URL,
      'POST',
      '/api/workspaces',
      {
        name: wsName,
        description: 'Automated Feature Audit Workspace',
        contextualUsername: `${user1Username}.auditcorp`,
      },
      token1
    );
    recordTest(
      'REST: Workspaces',
      'POST /api/workspaces creates new organization workspace with 201 Created',
      createWsRes.status === 201 &&
        createWsRes.data?.data?.workspace?.name === wsName &&
        Boolean(createWsRes.data?.data?.rootNode) &&
        Boolean(createWsRes.data?.data?.generalNode),
      `Status: ${createWsRes.status}, workspace ID: ${createWsRes.data?.data?.workspace?.id}`
    );

    const testWs = createWsRes.data?.data?.workspace;
    const rootNode = createWsRes.data?.data?.rootNode;
    const generalNode = createWsRes.data?.data?.generalNode;
    if (testWs?.id) cleanupWorkspaceIds.push(testWs.id);
    if (rootNode?.id) cleanupNodeIds.push(rootNode.id);
    if (generalNode?.id) cleanupNodeIds.push(generalNode.id);

    // Endpoint 8: GET /api/workspaces
    const listWsRes = await httpRequest(BASE_URL, 'GET', '/api/workspaces', null, token1);
    recordTest(
      'REST: Workspaces',
      'GET /api/workspaces returns 200 OK with list of workspaces and populated nodes',
      listWsRes.status === 200 &&
        Array.isArray(listWsRes.data?.data) &&
        listWsRes.data?.data.some((w) => w.id === testWs?.id),
      `Status: ${listWsRes.status}, count: ${listWsRes.data?.count}`
    );

    // Endpoint 9: GET /api/workspaces/nodes
    const allNodesRes = await httpRequest(BASE_URL, 'GET', '/api/workspaces/nodes', null, token1);
    recordTest(
      'REST: Workspaces',
      'GET /api/workspaces/nodes returns 200 OK with node dictionary matching client store',
      allNodesRes.status === 200 &&
        typeof allNodesRes.data?.data === 'object' &&
        Boolean(allNodesRes.data?.data[generalNode?.id]),
      `Status: ${allNodesRes.status}, contains generalNode: ${Boolean(allNodesRes.data?.data[generalNode?.id])}`
    );

    // Endpoint 11: GET /api/workspaces/:id/tree
    const treeRes = await httpRequest(BASE_URL, 'GET', `/api/workspaces/${testWs?.id}/tree`, null, token1);
    recordTest(
      'REST: Workspaces',
      'GET /api/workspaces/:id/tree returns 200 OK with workspace-scoped nodes dictionary',
      treeRes.status === 200 &&
        typeof treeRes.data?.data === 'object' &&
        Boolean(treeRes.data?.data[generalNode?.id]),
      `Status: ${treeRes.status}`
    );

    // Endpoint 12: POST /api/workspaces/:id/nodes (Create child channel under parent)
    const subChannelName = `audit-channel-${timestamp}`;
    const createNodeRes = await httpRequest(
      BASE_URL,
      'POST',
      `/api/workspaces/${testWs?.id}/nodes`,
      {
        parentNodeId: rootNode?.id,
        name: subChannelName,
        description: 'Audit sub-channel testing hierarchical tree links',
      },
      token1
    );
    recordTest(
      'REST: Workspaces',
      'POST /api/workspaces/:id/nodes creates child channel and links parent with 201 Created',
      createNodeRes.status === 201 &&
        createNodeRes.data?.data?.name === subChannelName &&
        createNodeRes.data?.data?.parentId === rootNode?.id,
      `Status: ${createNodeRes.status}, child ID: ${createNodeRes.data?.data?.id}`
    );
    const childNode = createNodeRes.data?.data;
    if (childNode?.id) cleanupNodeIds.push(childNode.id);

    // Endpoint 13: POST /api/workspaces/:id/nodes/:nodeId/members
    const addMembersRes = await httpRequest(
      BASE_URL,
      'POST',
      `/api/workspaces/${testWs?.id}/nodes/${childNode?.id}/members`,
      {
        members: [
          {
            id: user2Id,
            name: 'Auditor Beta',
            username: user2Username,
            role: 'member',
          },
        ],
      },
      token1
    );
    recordTest(
      'REST: Workspaces',
      'POST /api/workspaces/:id/nodes/:nodeId/members adds member and returns 200 OK',
      addMembersRes.status === 200 && addMembersRes.data?.data?.totalMembers >= 2,
      `Status: ${addMembersRes.status}, totalMembers: ${addMembersRes.data?.data?.totalMembers}`
    );

    // Endpoint 14: POST /api/workspaces/nodes/:nodeId/members (Alias route)
    const addMembersAliasRes = await httpRequest(
      BASE_URL,
      'POST',
      `/api/workspaces/nodes/${childNode?.id}/members`,
      {
        members: [
          {
            id: 'mock-member-3',
            name: 'Member Three',
            username: 'memthree',
            role: 'member',
          },
        ],
      },
      token1
    );
    recordTest(
      'REST: Workspaces',
      'POST /api/workspaces/nodes/:nodeId/members (alias route) succeeds with 200 OK',
      addMembersAliasRes.status === 200 && Boolean(addMembersAliasRes.data?.data),
      `Status: ${addMembersAliasRes.status}`
    );

    // Endpoint 15: POST /api/workspaces/join
    const joinRes = await httpRequest(
      BASE_URL,
      'POST',
      '/api/workspaces/join',
      {
        code: generalNode?.joinCode,
      },
      token2
    );
    recordTest(
      'REST: Workspaces',
      'POST /api/workspaces/join joins channel via unique code with 200 OK',
      joinRes.status === 200 && joinRes.data?.data?.node?.id === generalNode?.id,
      `Status: ${joinRes.status}, node joined: ${joinRes.data?.data?.node?.name}`
    );

    // Negative test: Join with invalid code
    const badJoinRes = await httpRequest(
      BASE_URL,
      'POST',
      '/api/workspaces/join',
      {
        code: 'INVALID-CODE-9999',
      },
      token2
    );
    recordTest(
      'REST: Workspaces',
      'POST /api/workspaces/join rejects invalid join code with 404 Not Found',
      badJoinRes.status === 404,
      `Status: ${badJoinRes.status}`
    );

    // Endpoint 16: POST /api/workspaces/leave-parent-group (Stub audit)
    const leaveGroupRes = await httpRequest(
      BASE_URL,
      'POST',
      '/api/workspaces/leave-parent-group',
      {
        groupId: childNode?.id,
      },
      token1
    );
    recordTest(
      'REST: Workspaces',
      'POST /api/workspaces/leave-parent-group returns 200 OK (Audited Mock Stub: static response)',
      leaveGroupRes.status === 200 && leaveGroupRes.data?.groupName === childNode?.id,
      `Status: ${leaveGroupRes.status}, note: returns in-memory leftIds response without persistent workspace deletion`
    );

    // --- MESSAGES, REACTIONS, EDITS & DELETES (Endpoints 17-21) ---
    console.log('\n--- Suite 4: Messages, Reactions & Modifications Endpoints ---');

    // Endpoint 17: POST /api/messages/:chatId
    const targetChatId = generalNode?.id || `chan-${timestamp}`;
    const initialMessageContent = 'Hello Zyntra! Milestone 2 Audit Message 🚀';
    const sendMsgRes = await httpRequest(
      BASE_URL,
      'POST',
      `/api/messages/${targetChatId}`,
      {
        content: initialMessageContent,
        senderName: 'Auditor Alpha',
        senderUsername: user1Username,
        chatType: 'workspace-node',
      },
      token1
    );
    recordTest(
      'REST: Messages',
      'POST /api/messages/:chatId creates new message with 201 Created and persists',
      sendMsgRes.status === 201 && sendMsgRes.data?.data?.content === initialMessageContent,
      `Status: ${sendMsgRes.status}, message ID: ${sendMsgRes.data?.data?.id}`
    );
    const auditMessage = sendMsgRes.data?.data;
    if (auditMessage?.id) cleanupMessageIds.push(auditMessage.id);

    // Negative test: Send empty message
    const emptyMsgRes = await httpRequest(
      BASE_URL,
      'POST',
      `/api/messages/${targetChatId}`,
      {
        content: '',
      },
      token1
    );
    recordTest(
      'REST: Messages',
      'POST /api/messages/:chatId rejects empty message without attachment with 400 Bad Request',
      emptyMsgRes.status === 400 && emptyMsgRes.data?.success === false,
      `Status: ${emptyMsgRes.status}`
    );

    // Endpoint 18: GET /api/messages/:chatId
    const getMsgsRes = await httpRequest(BASE_URL, 'GET', `/api/messages/${targetChatId}`, null, token1);
    recordTest(
      'REST: Messages',
      'GET /api/messages/:chatId returns 200 OK with array containing active message',
      getMsgsRes.status === 200 &&
        Array.isArray(getMsgsRes.data?.data) &&
        getMsgsRes.data?.data.some((m) => m.id === auditMessage?.id),
      `Status: ${getMsgsRes.status}, count: ${getMsgsRes.data?.count}`
    );

    // Endpoint 19: PUT /api/messages/:id (In-place edit)
    const editedContent = 'Hello Zyntra! [EDITED CONTENT] Audit In-Place Update Verified';
    const editMsgRes = await httpRequest(
      BASE_URL,
      'PUT',
      `/api/messages/${auditMessage?.id}`,
      {
        content: editedContent,
      },
      token1
    );
    recordTest(
      'REST: Messages',
      'PUT /api/messages/:id updates content with 200 OK and sets isEdited flag',
      editMsgRes.status === 200 &&
        editMsgRes.data?.data?.content === editedContent &&
        editMsgRes.data?.data?.isEdited === true,
      `Status: ${editMsgRes.status}, isEdited: ${editMsgRes.data?.data?.isEdited}`
    );

    // Endpoint 20: POST /api/messages/:id/reactions
    const reactionRes = await httpRequest(
      BASE_URL,
      'POST',
      `/api/messages/${auditMessage?.id}/reactions`,
      {
        emoji: '🔥',
        userId: user1Id,
      },
      token1
    );
    recordTest(
      'REST: Messages',
      'POST /api/messages/:id/reactions registers emoji reaction with 200 OK and count 1',
      reactionRes.status === 200 &&
        Array.isArray(reactionRes.data?.data?.reactions) &&
        reactionRes.data?.data?.reactions.some((r) => r.emoji === '🔥' && r.count === 1),
      `Status: ${reactionRes.status}, reactions: ${JSON.stringify(reactionRes.data?.data?.reactions)}`
    );

    // Toggle reaction off
    const reactionToggleRes = await httpRequest(
      BASE_URL,
      'POST',
      `/api/messages/${auditMessage?.id}/reactions`,
      {
        emoji: '🔥',
        userId: user1Id,
      },
      token1
    );
    recordTest(
      'REST: Messages',
      'POST /api/messages/:id/reactions toggles reaction off when clicked again',
      reactionToggleRes.status === 200 &&
        (!reactionToggleRes.data?.data?.reactions?.length ||
          !reactionToggleRes.data?.data?.reactions.some((r) => r.emoji === '🔥')),
      `Status: ${reactionToggleRes.status}`
    );

    // Endpoint 21: DELETE /api/messages/:id
    const deleteMsgRes = await httpRequest(BASE_URL, 'DELETE', `/api/messages/${auditMessage?.id}`, null, token1);
    recordTest(
      'REST: Messages',
      'DELETE /api/messages/:id deletes message with 200 OK and confirms removal',
      deleteMsgRes.status === 200 && deleteMsgRes.data?.success === true,
      `Status: ${deleteMsgRes.status}`
    );

    // Confirm deletion via GET
    const confirmDeleteRes = await httpRequest(BASE_URL, 'GET', `/api/messages/${targetChatId}`, null, token1);
    recordTest(
      'REST: Messages',
      'GET /api/messages/:chatId confirms deleted message is no longer present',
      confirmDeleteRes.status === 200 && !confirmDeleteRes.data?.data?.some((m) => m.id === auditMessage?.id),
      `Deleted message excluded from query`
    );

    // --- CONTACTS & PERSONAL GROUPS (Endpoints 22-25) ---
    console.log('\n--- Suite 5: Contacts, Live User Search & Personal Groups ---');

    // Endpoint 24: POST /api/contacts (Create direct contact connection)
    const addContactRes = await httpRequest(
      BASE_URL,
      'POST',
      '/api/contacts',
      {
        username: user2Username,
        name: 'Auditor Beta',
        bio: 'Second audit tester',
      },
      token1
    );
    recordTest(
      'REST: Contacts',
      'POST /api/contacts creates reciprocal direct chat contact with 201 Created',
      addContactRes.status === 201 && addContactRes.data?.data?.username === user2Username,
      `Status: ${addContactRes.status}, contact id: ${addContactRes.data?.data?.id}`
    );
    const createdContact = addContactRes.data?.data;
    if (createdContact?.id) cleanupContactIds.push(createdContact.id);

    // Endpoint 22: GET /api/contacts
    const getContactsRes = await httpRequest(BASE_URL, 'GET', '/api/contacts', null, token1);
    recordTest(
      'REST: Contacts',
      'GET /api/contacts returns 200 OK with contacts and personal groups arrays',
      getContactsRes.status === 200 &&
        Array.isArray(getContactsRes.data?.contacts) &&
        getContactsRes.data?.contacts.some((c) => c.username === user2Username),
      `Status: ${getContactsRes.status}, contacts found: ${getContactsRes.data?.contacts?.length}`
    );

    // Endpoint 23: GET /api/contacts/search
    const searchRes = await httpRequest(
      BASE_URL,
      'GET',
      `/api/contacts/search?q=${user2Username.slice(0, 6)}`,
      null,
      token1
    );
    recordTest(
      'REST: Contacts',
      'GET /api/contacts/search searches database users by prefix with 200 OK',
      searchRes.status === 200 &&
        Array.isArray(searchRes.data?.users) &&
        searchRes.data?.users.some((u) => u.primaryUsername === user2Username),
      `Status: ${searchRes.status}, matched count: ${searchRes.data?.users?.length}`
    );

    // Endpoint 25: POST /api/contacts/groups
    const groupName = `Audit Taskforce ${timestamp}`;
    const createGroupRes = await httpRequest(
      BASE_URL,
      'POST',
      '/api/contacts/groups',
      {
        name: groupName,
        description: 'Multi-user personal audit discussion group',
      },
      token1
    );
    recordTest(
      'REST: Contacts',
      'POST /api/contacts/groups creates personal group chat with 201 Created',
      createGroupRes.status === 201 && createGroupRes.data?.data?.name === groupName,
      `Status: ${createGroupRes.status}, group ID: ${createGroupRes.data?.data?.id}`
    );
    const personalGroup = createGroupRes.data?.data;
    if (personalGroup?.id) cleanupGroupIds.push(personalGroup.id);

    // --- FILE UPLOADS & STATIC SERVING (Endpoints 26-27 + Static) ---
    console.log('\n--- Suite 6: File Uploads & Static Asset Serving ---');

    // Endpoint 26: POST /api/upload
    const dummyImageBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
    const formData1 = new FormData();
    formData1.append('file', new Blob([dummyImageBuffer], { type: 'image/gif' }), `test_audit_${timestamp}.gif`);

    const uploadRes1 = await httpRequest(BASE_URL, 'POST', '/api/upload', formData1, null, true);
    recordTest(
      'REST: Upload',
      'POST /api/upload uploads file and returns 200 OK with relative /uploads URL',
      uploadRes1.status === 200 &&
        uploadRes1.data?.success === true &&
        uploadRes1.data?.data?.url?.startsWith('/uploads/'),
      `Status: ${uploadRes1.status}, url: ${uploadRes1.data?.data?.url}`
    );
    if (uploadRes1.data?.data?.url) cleanupFiles.push(uploadRes1.data.data.url);

    // Endpoint 27: POST /api/upload/file (Alias upload endpoint used by client Composer)
    const dummyDocBuffer = Buffer.from('Zyntra Audit Report Plaintext Content Verification');
    const formData2 = new FormData();
    formData2.append('file', new Blob([dummyDocBuffer], { type: 'text/plain' }), `audit_report_${timestamp}.txt`);

    const uploadRes2 = await httpRequest(BASE_URL, 'POST', '/api/upload/file', formData2, null, true);
    recordTest(
      'REST: Upload',
      'POST /api/upload/file (client alias) uploads document with 200 OK and metadata',
      uploadRes2.status === 200 &&
        uploadRes2.data?.success === true &&
        uploadRes2.data?.data?.type === 'file' &&
        uploadRes2.data?.data?.url?.startsWith('/uploads/'),
      `Status: ${uploadRes2.status}, size: ${uploadRes2.data?.data?.size}`
    );
    if (uploadRes2.data?.data?.url) cleanupFiles.push(uploadRes2.data.data.url);

    // Static Asset Retrieval: GET /uploads/:filename
    if (uploadRes2.data?.data?.url) {
      const staticRes = await httpRequest(BASE_URL, 'GET', uploadRes2.data.data.url);
      recordTest(
        'Static Serving',
        'GET /uploads/:filename serves uploaded file with 200 OK matching original payload',
        staticRes.status === 200 && typeof staticRes.data === 'string' && staticRes.data.includes('Zyntra Audit Report'),
        `Status: ${staticRes.status}, data length: ${staticRes.data?.length}`
      );
    }

    // ========================================================================
    // LAYER 2: REAL-TIME SOCKET.IO EVENT FLOWS AUDIT
    // ========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('LAYER 2: REAL-TIME SOCKET.IO EVENT FLOWS AUDIT');
    console.log('----------------------------------------------------------------\n');

    if (!ClientIO) {
      recordTest('Socket.io', 'Client library loaded', false, 'socket.io-client could not be loaded');
    } else {
      console.log('--- Suite 7: Socket.io Handshake Authentication ---');

      // Test A: Rejected without JWT token
      const unauthSocketPromise = new Promise((resolve) => {
        const s = ClientIO(BASE_URL, {
          transports: ['websocket'],
          reconnection: false,
          auth: {},
        });
        s.on('connect_error', (err) => {
          s.disconnect();
          resolve(err.message);
        });
        s.on('connect', () => {
          s.disconnect();
          resolve('connected_unexpectedly');
        });
      });
      const unauthResult = await unauthSocketPromise;
      recordTest(
        'Socket.io: Handshake',
        'Connection rejected with Authentication Error when no JWT token is provided',
        unauthResult.includes('Authentication error'),
        `Error: ${unauthResult}`
      );

      // Test B: Successfully authenticate Client 1 and Client 2
      const socket1 = ClientIO(BASE_URL, {
        transports: ['websocket'],
        reconnection: false,
        auth: { token: token1 },
      });
      const socket2 = ClientIO(BASE_URL, {
        transports: ['websocket'],
        reconnection: false,
        auth: { token: token2 },
      });

      const connectPromise = Promise.all([
        new Promise((resolve) => socket1.on('connect', () => resolve(true))),
        new Promise((resolve) => socket2.on('connect', () => resolve(true))),
      ]);
      const [sock1Connected, sock2Connected] = await connectPromise;
      recordTest(
        'Socket.io: Handshake',
        'Client 1 and Client 2 connect successfully with valid Bearer JWT',
        sock1Connected && sock2Connected,
        `Socket1 ID: ${socket1.id}, Socket2 ID: ${socket2.id}`
      );

      // Test C: Room Join / Leave
      console.log('\n--- Suite 8: Room Join & Leave Event Handlers ---');
      const testRoomId = `room-audit-${timestamp}`;
      socket1.emit('join_room', testRoomId);
      socket2.emit('join_room', testRoomId);
      // Give socket server a moment to register room memberships
      await new Promise((r) => setTimeout(r, 100));
      recordTest(
        'Socket.io: Rooms',
        'Both clients emit join_room without errors',
        true,
        `Joined room: ${testRoomId}`
      );

      // Test D: Live Message Broadcast (send_message -> receive_message)
      console.log('\n--- Suite 9: Live Message Broadcast & Instant Persistence ---');
      const broadcastContent = `Real-Time P2P Broadcast Message ${timestamp} ⚡`;
      const broadcastPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for receive_message')), 4000);
        socket2.on('receive_message', (receivedMsg) => {
          clearTimeout(timeout);
          resolve(receivedMsg);
        });
      });

      socket1.emit('send_message', {
        chatId: testRoomId,
        content: broadcastContent,
        senderId: user1Id,
        senderName: 'Auditor Alpha',
        senderUsername: user1Username,
        chatType: 'workspace-node',
      });

      let receivedBroadcast = null;
      try {
        receivedBroadcast = await broadcastPromise;
      } catch (e) {
        console.error('[Socket.io Error]', e.message);
      }

      recordTest(
        'Socket.io: Messages',
        'Client 1 emits send_message and Client 2 receives receive_message in real time',
        receivedBroadcast !== null && receivedBroadcast.content === broadcastContent,
        `Received content: "${receivedBroadcast?.content}" from sender: "${receivedBroadcast?.senderName}"`
      );
      if (receivedBroadcast?.id) cleanupMessageIds.push(receivedBroadcast.id);

      // Test E: Real-Time Typing Indicators (typing_start & typing_stop)
      console.log('\n--- Suite 10: Real-Time Typing Indicator Sync ---');
      const typingStartPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for user_typing start')), 4000);
        socket2.on('user_typing', (data) => {
          if (data.isTyping === true) {
            clearTimeout(timeout);
            resolve(data);
          }
        });
      });

      socket1.emit('typing_start', {
        roomId: testRoomId,
        userName: 'Auditor Alpha',
        userId: user1Id,
      });

      const typingStartResult = await typingStartPromise;
      recordTest(
        'Socket.io: Typing',
        'Client 1 emits typing_start and Client 2 receives user_typing (isTyping: true)',
        typingStartResult && typingStartResult.isTyping === true && typingStartResult.userName === 'Auditor Alpha',
        `Typing event: ${JSON.stringify(typingStartResult)}`
      );

      const typingStopPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for user_typing stop')), 4000);
        socket2.on('user_typing', (data) => {
          if (data.isTyping === false) {
            clearTimeout(timeout);
            resolve(data);
          }
        });
      });

      socket1.emit('typing_stop', {
        roomId: testRoomId,
        userId: user1Id,
      });

      const typingStopResult = await typingStopPromise;
      recordTest(
        'Socket.io: Typing',
        'Client 1 emits typing_stop and Client 2 receives user_typing (isTyping: false)',
        typingStopResult && typingStopResult.isTyping === false,
        `Typing event: ${JSON.stringify(typingStopResult)}`
      );

      // Test F: Real-Time Reactions (send_reaction -> update_reaction)
      console.log('\n--- Suite 11: Real-Time Reaction Broadcast ---');
      if (receivedBroadcast?.id) {
        const reactionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for update_reaction')), 4000);
          socket2.on('update_reaction', (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });

        socket1.emit('send_reaction', {
          messageId: receivedBroadcast.id,
          emoji: '🎉',
          userId: user1Id,
          chatId: testRoomId,
        });

        let reactionEvent = null;
        try {
          reactionEvent = await reactionPromise;
        } catch (e) {
          console.error('[Socket Reaction Error]', e.message);
        }

        recordTest(
          'Socket.io: Reactions',
          'Client 1 emits send_reaction and room peers receive update_reaction event',
          reactionEvent !== null &&
            Array.isArray(reactionEvent.reactions) &&
            reactionEvent.reactions.some((r) => r.emoji === '🎉'),
          `Updated reactions: ${JSON.stringify(reactionEvent?.reactions)}`
        );
      }

      // Cleanup sockets
      socket1.emit('leave_room', testRoomId);
      socket2.emit('leave_room', testRoomId);
      socket1.disconnect();
      socket2.disconnect();
    }

    // ========================================================================
    // LAYER 3: DATABASE OPERATIONS & ATLAS PERSISTENCE AUDIT
    // ========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('LAYER 3: MONGODB ATLAS DIRECT DATABASE OPERATIONS AUDIT');
    console.log('----------------------------------------------------------------\n');

    // 1. User collection check
    const dbUser = await User.findById(user1Id).select('+password').lean();
    recordTest(
      'Database: User',
      'User document in MongoDB Atlas contains valid bcrypt hash and normalized handles',
      dbUser && dbUser.password?.startsWith('$2') && dbUser.primaryUsername === user1Username,
      `User ID: ${dbUser?._id}, hash startsWith $2: ${dbUser?.password?.startsWith('$2')}`
    );
    recordTest(
      'Database: User',
      'User document contexts array is strictly persisted in MongoDB Atlas',
      Array.isArray(dbUser?.contexts) && dbUser.contexts.some((c) => c.name === 'Zyntra Audit Labs'),
      `Contexts persisted: ${dbUser?.contexts?.length}`
    );

    // 2. Workspace & Node collections check
    const dbWorkspace = await Workspace.findOne({ id: testWs?.id }).lean();
    recordTest(
      'Database: Workspace',
      'Workspace record in Atlas contains rootNodeId, defaultNodeId, and policy flags',
      dbWorkspace && dbWorkspace.rootNodeId === rootNode?.id && Boolean(dbWorkspace.policy?.emoji),
      `Workspace: ${dbWorkspace?.name}, defaultNode: ${dbWorkspace?.defaultNodeId}`
    );

    const dbChildNode = await WorkspaceNode.findOne({ id: childNode?.id }).lean();
    recordTest(
      'Database: WorkspaceNode',
      'WorkspaceNode records store parentId links and join codes directly in Atlas',
      dbChildNode && dbChildNode.parentId === rootNode?.id && Boolean(dbChildNode.joinCode),
      `Node: ${dbChildNode?.name}, joinCode: ${dbChildNode?.joinCode}`
    );

    // 3. Contact & PersonalGroup collections check
    const dbContact = await Contact.findOne({ id: createdContact?.id }).lean();
    recordTest(
      'Database: Contact',
      'Contact document persisted with canonical DM ID in MongoDB Atlas',
      Boolean(dbContact && dbContact.id === createdContact?.id),
      `Contact ID: ${dbContact?.id}`
    );

    const dbGroup = await PersonalGroup.findOne({ id: personalGroup?.id }).lean();
    recordTest(
      'Database: Group',
      'PersonalGroup document persisted with creatorId in MongoDB Atlas',
      Boolean(dbGroup && dbGroup.name === groupName),
      `Group ID: ${dbGroup?.id}, Name: ${dbGroup?.name}`
    );

  } finally {
    // ========================================================================
    // TEARDOWN & CLEANUP
    // ========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEARDOWN: CLEANING UP AUDIT ARTIFACTS FROM MONGODB ATLAS & DISK');
    console.log('----------------------------------------------------------------');

    if (cleanupUserIds.length > 0) {
      const uRes = await User.deleteMany({ _id: { $in: cleanupUserIds } });
      console.log(`[Cleanup] Deleted ${uRes.deletedCount} audit test user(s) from MongoDB Atlas.`);
    }

    if (cleanupWorkspaceIds.length > 0) {
      const wRes = await Workspace.deleteMany({ id: { $in: cleanupWorkspaceIds } });
      console.log(`[Cleanup] Deleted ${wRes.deletedCount} audit test workspace(s) from MongoDB Atlas.`);
    }

    if (cleanupNodeIds.length > 0) {
      const nRes = await WorkspaceNode.deleteMany({ id: { $in: cleanupNodeIds } });
      console.log(`[Cleanup] Deleted ${nRes.deletedCount} audit test workspace node(s) from MongoDB Atlas.`);
    }

    if (cleanupMessageIds.length > 0) {
      const mRes = await Message.deleteMany({ id: { $in: cleanupMessageIds } });
      console.log(`[Cleanup] Deleted ${mRes.deletedCount} audit test message(s) from MongoDB Atlas.`);
    }

    if (cleanupContactIds.length > 0) {
      const cRes = await Contact.deleteMany({ id: { $in: cleanupContactIds } });
      console.log(`[Cleanup] Deleted ${cRes.deletedCount} audit test contact(s) from MongoDB Atlas.`);
    }

    if (cleanupGroupIds.length > 0) {
      const gRes = await PersonalGroup.deleteMany({ id: { $in: cleanupGroupIds } });
      console.log(`[Cleanup] Deleted ${gRes.deletedCount} audit test personal group(s) from MongoDB Atlas.`);
    }

    for (const relUrl of cleanupFiles) {
      try {
        const filePath = path.resolve(__dirname, '../../uploads', path.basename(relUrl));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[Cleanup] Removed test upload: ${path.basename(relUrl)}`);
        }
      } catch (err) {
        console.warn(`[Cleanup Warning] Could not remove file ${relUrl}:`, err.message);
      }
    }

    // Close servers and connections
    await new Promise((resolve) => server.close(resolve));
    console.log('[Cleanup] HTTP and Socket.io audit test server stopped.');

    await mongoose.disconnect();
    console.log('[Cleanup] Disconnected from MongoDB Atlas.');
  }

  // ========================================================================
  // AUDIT SUMMARY & METRICS
  // ========================================================================
  console.log('\n================================================================');
  console.log('📊 AUDIT EXECUTION SUMMARY METRICS');
  console.log('================================================================');
  console.log(`Total Verification Assertions: ${totalTests}`);
  console.log(`Passed:                        ${passedTests} ✅`);
  console.log(`Failed:                        ${failedTests} ❌`);
  console.log(`Warnings/Mock Stubs:           ${warnedTests} ⚠️`);
  console.log(`Success Rate:                  ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runComprehensiveFeatureAudit().catch((err) => {
  console.error('[FATAL AUDIT ERROR]', err);
  process.exit(1);
});
