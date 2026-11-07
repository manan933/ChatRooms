import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

let server;
const PORT = 5055; // Use dedicated test port to avoid any conflicts
const BASE_URL = `http://localhost:${PORT}/api`;

let testPassed = 0;
let testFailed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    testPassed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    testFailed++;
  }
}

async function post(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

async function put(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runHttpTests() {
  console.log('----------------------------------------------------');
  console.log('🌐 Starting Zyntra HTTP REST API Integration Test');
  console.log('----------------------------------------------------');

  await connectDB(5, 2000);
  
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running at http://localhost:${PORT}`);

  const suffix = Date.now().toString().slice(-4);
  const testUser = {
    name: `API Test User ${suffix}`,
    email: `api_user_${suffix}@zyntra.test`,
    primaryUsername: `apiuser_${suffix}`,
    password: 'password123',
  };

  let token = '';

  // 1. Register API
  console.log('\n--- 1. Testing POST /api/auth/register ---');
  const regRes = await post('/auth/register', testUser);
  check('Registration returns status 201', regRes.status === 201);
  check('Registration returns JWT token', Boolean(regRes.data.token));
  check('Registration returns user with primaryUsername', regRes.data.user?.primaryUsername === testUser.primaryUsername);
  token = regRes.data.token;

  // Duplicate registration rejection
  const dupRes = await post('/auth/register', testUser);
  check('Duplicate registration returns status 400', dupRes.status === 400);
  check('Duplicate registration error message returned', Boolean(dupRes.data.message));

  // 2. Login API
  console.log('\n--- 2. Testing POST /api/auth/login ---');
  const loginRes = await post('/auth/login', {
    email: testUser.email,
    password: testUser.password,
  });
  check('Login returns status 200', loginRes.status === 200);
  check('Login returns valid token', Boolean(loginRes.data.token));

  const badLogin = await post('/auth/login', {
    email: testUser.email,
    password: 'wrongpassword',
  });
  check('Bad login returns status 401', badLogin.status === 401);

  // 3. Current User Profile API
  console.log('\n--- 3. Testing GET /api/auth/me ---');
  const meRes = await get('/auth/me', token);
  check('GET /auth/me returns status 200', meRes.status === 200);
  check('User ID matches created user', meRes.data.user?.email === testUser.email);

  // 4. Update Profile API
  console.log('\n--- 4. Testing PUT /api/auth/profile ---');
  const profRes = await put(
    '/auth/profile',
    { name: `Updated ${testUser.name}`, bio: 'Updated bio via HTTP API' },
    token
  );
  check('PUT /auth/profile returns status 200', profRes.status === 200);
  check('Profile updated in DB', profRes.data.user?.bio === 'Updated bio via HTTP API');

  // 5. Workspaces API
  console.log('\n--- 5. Testing Workspaces Endpoints ---');
  const wsRes = await get('/workspaces', token);
  check('GET /workspaces returns status 200', wsRes.status === 200);
  check('Workspaces list is array', Array.isArray(wsRes.data.data));

  const createWsRes = await post(
    '/workspaces',
    {
      name: `HTTP Workspace ${suffix}`,
      description: 'Created via automated API suite',
    },
    token
  );
  check('POST /workspaces returns status 201', createWsRes.status === 201);
  const createdWs = createWsRes.data.data.workspace;
  const rootNode = createWsRes.data.data.rootNode;
  check('Workspace has rootNode and joinCode', Boolean(rootNode.joinCode));

  // Join by code
  const joinRes = await post('/workspaces/join', { code: rootNode.joinCode }, token);
  check('POST /workspaces/join with joinCode returns status 200', joinRes.status === 200);

  // 6. Messages API
  console.log('\n--- 6. Testing Messages Endpoints ---');
  const msgContent = `Automated message test ${suffix}`;
  const sendMsgRes = await post(
    `/messages/${rootNode.id}`,
    {
      content: msgContent,
      senderName: testUser.name,
    },
    token
  );
  check('POST /messages/:chatId returns status 201', sendMsgRes.status === 201);
  const sentMsgId = sendMsgRes.data.data.id;

  const getMsgRes = await get(`/messages/${rootNode.id}`, token);
  check('GET /messages/:chatId returns status 200', getMsgRes.status === 200);
  check(
    'Sent message exists in channel history',
    getMsgRes.data.data?.some((m) => m.id === sentMsgId)
  );

  // 7. Contacts API
  console.log('\n--- 7. Testing Contacts Endpoints ---');
  const contactRes = await post(
    '/contacts',
    {
      name: 'Rohan Sharma',
      username: `rohan_${suffix}`,
      bio: 'Cloud Architect',
    },
    token
  );
  check('POST /contacts returns status 201', contactRes.status === 201);

  const getContactsRes = await get('/contacts', token);
  check('GET /contacts returns status 200', getContactsRes.status === 200);
  check(
    'Created contact exists in contacts array',
    getContactsRes.data.contacts?.some((c) => c.username === `rohan_${suffix}`)
  );

  // Clean up test user & workspace
  await User.deleteOne({ email: testUser.email });

  console.log('\n====================================================');
  console.log(`HTTP API SUITE COMPLETE: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log('====================================================\n');

  server.close();
  process.exit(testFailed > 0 ? 1 : 0);
}

runHttpTests().catch((err) => {
  console.error('HTTP test error:', err);
  if (server) server.close();
  process.exit(1);
});
