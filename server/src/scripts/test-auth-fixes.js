import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const PORT = 5057;
const BASE_URL = `http://localhost:${PORT}/api`;

let testPassed = 0;
let testFailed = 0;
let server = null;

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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function get(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
  const data = await res.json().catch(() => ({}));
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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function verifyJwt(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zyntra_jwt_secret_dev_key_2026');
    return Boolean(decoded && decoded.id);
  } catch {
    return false;
  }
}

async function runAuthFixesSuite() {
  console.log('====================================================');
  console.log('🧪 Running Milestone 1: Auth, Profile & Context Fixes Suite');
  console.log('====================================================');

  await connectDB(5, 2000);
  console.log('Connected to MongoDB Atlas:', mongoose.connection.name);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Auth verification server listening at http://localhost:${PORT}\n`);

  const suffix = Date.now().toString().slice(-5);
  const createdUserIds = [];

  try {
    // ------------------------------------------------------------------
    // a) Register with primaryUsername returns 201 + valid JWT
    // ------------------------------------------------------------------
    console.log('--- Test (a): Register with primaryUsername ---');
    const userAData = {
      name: `User Alpha ${suffix}`,
      email: `alpha_${suffix}@zyntra.test`,
      primaryUsername: `alpha_${suffix}`,
      password: 'StrongPassword123!',
      bio: 'Alpha initial bio',
    };

    const regARes = await post('/auth/register', userAData);
    check('Registration with primaryUsername returns status 201', regARes.status === 201);
    check('Response has success: true', regARes.data.success === true);
    check('Valid JWT returned in token field', verifyJwt(regARes.data.token));
    check('Returned user has correct primaryUsername', regARes.data.user?.primaryUsername === userAData.primaryUsername.toLowerCase());
    check('Returned user has correct email', regARes.data.user?.email === userAData.email.toLowerCase());
    
    const userA = regARes.data.user;
    const tokenA = regARes.data.token;
    if (userA?._id) createdUserIds.push(userA._id);

    // ------------------------------------------------------------------
    // b) Register with username returns 201 + valid JWT
    // ------------------------------------------------------------------
    console.log('\n--- Test (b): Register with username alias ---');
    const userBData = {
      name: `User Beta ${suffix}`,
      email: `beta_${suffix}@zyntra.test`,
      username: `beta_${suffix}`,
      password: 'StrongPassword456!',
      bio: 'Beta initial bio',
    };

    const regBRes = await post('/auth/register', userBData);
    check('Registration with username alias returns status 201', regBRes.status === 201);
    check('Response has success: true', regBRes.data.success === true);
    check('Valid JWT returned in token field', verifyJwt(regBRes.data.token));
    check('Returned user primaryUsername normalized from username alias', regBRes.data.user?.primaryUsername === userBData.username.toLowerCase());
    check('Returned user has correct email', regBRes.data.user?.email === userBData.email.toLowerCase());

    const userB = regBRes.data.user;
    const tokenB = regBRes.data.token;
    if (userB?._id) createdUserIds.push(userB._id);

    // ------------------------------------------------------------------
    // c) Login with email works, login with username works
    // ------------------------------------------------------------------
    console.log('\n--- Test (c): Login with Email & Login with Username ---');
    // c.1: Login with email
    const loginEmailRes = await post('/auth/login', {
      email: userAData.email,
      password: userAData.password,
    });
    check('Login with email returns status 200', loginEmailRes.status === 200);
    check('Login with email returns valid JWT', verifyJwt(loginEmailRes.data.token));
    check('Login with email returns correct user', loginEmailRes.data.user?.primaryUsername === userA.primaryUsername);

    // c.2: Login with username via username field
    const loginUserRes1 = await post('/auth/login', {
      username: userAData.primaryUsername,
      password: userAData.password,
    });
    check('Login with username via username field returns status 200', loginUserRes1.status === 200);
    check('Login with username returns valid JWT', verifyJwt(loginUserRes1.data.token));

    // c.3: Login with username via email field (emailOrUsername behavior)
    const loginUserRes2 = await post('/auth/login', {
      email: userBData.username,
      password: userBData.password,
    });
    check('Login with username via email field returns status 200', loginUserRes2.status === 200);
    check('Login with username returns valid JWT', verifyJwt(loginUserRes2.data.token));

    // c.4: Login with @handle prefix
    const loginHandleRes = await post('/auth/login', {
      email: `@${userAData.primaryUsername}`,
      password: userAData.password,
    });
    check('Login with @handle prefix returns status 200', loginHandleRes.status === 200);
    check('Login with @handle returns valid JWT', verifyJwt(loginHandleRes.data.token));

    // ------------------------------------------------------------------
    // d) Rejection of invalid passwords works
    // ------------------------------------------------------------------
    console.log('\n--- Test (d): Rejection of Invalid Passwords ---');
    const badPasswordRes = await post('/auth/login', {
      email: userAData.email,
      password: 'IncorrectPassword999!',
    });
    check('Login with bad password returns status 401', badPasswordRes.status === 401);
    check('Response success is false on bad password', badPasswordRes.data.success === false);
    check('Error message indicates invalid credentials', Boolean(badPasswordRes.data.message));

    const nonExistentRes = await post('/auth/login', {
      email: `nonexistent_${suffix}@zyntra.test`,
      password: 'AnyPassword123!',
    });
    check('Login with non-existent user returns status 401', nonExistentRes.status === 401);
    check('Response success is false on non-existent user', nonExistentRes.data.success === false);

    // ------------------------------------------------------------------
    // e) Profile update with bio & phone persists and returns updated fields
    // ------------------------------------------------------------------
    console.log('\n--- Test (e): Profile Update with Bio & Phone Persistence ---');
    const updatePayload = {
      name: `User Alpha Updated ${suffix}`,
      bio: 'Lead Engineer building high-reliability messaging',
      phone: '+1-555-0199',
    };

    const updateRes = await put('/auth/profile', updatePayload, tokenA);
    check('PUT /api/auth/profile returns status 200', updateRes.status === 200);
    check('Updated name returned in response', updateRes.data.user?.name === updatePayload.name);
    check('Updated bio returned in response', updateRes.data.user?.bio === updatePayload.bio);
    check('Updated phone returned in response', updateRes.data.user?.phone === updatePayload.phone);

    // Verify persistence across subsequent GET /api/auth/me query
    const meRes = await get('/auth/me', tokenA);
    check('Subsequent GET /api/auth/me returns status 200', meRes.status === 200);
    check('Subsequent GET /api/auth/me has updated bio', meRes.data.user?.bio === updatePayload.bio);
    check('Subsequent GET /api/auth/me has updated phone', meRes.data.user?.phone === updatePayload.phone);

    // Direct MongoDB Atlas query to verify database-level persistence
    const dbUserAfterUpdate = await User.findById(userA._id).lean();
    check('Direct MongoDB Atlas document reflects updated bio', dbUserAfterUpdate?.bio === updatePayload.bio);
    const dbPhone = dbUserAfterUpdate?.phone || dbUserAfterUpdate?.['phone'];
    check('Direct MongoDB Atlas document reflects updated phone', dbPhone === updatePayload.phone);

    // ------------------------------------------------------------------
    // f) AddContext persists to MongoDB Atlas across subsequent queries
    // ------------------------------------------------------------------
    console.log('\n--- Test (f): AddContext MongoDB Atlas Persistence ---');
    const newContext = {
      id: `ctx-workplace-${suffix}`,
      type: 'workplace',
      name: `Zyntra Core Team ${suffix}`,
      username: `alpha.core.${suffix}`,
    };

    const addCtxRes = await post('/auth/context', newContext, tokenA);
    check('POST /api/auth/context returns status 200', addCtxRes.status === 200);
    check('Contexts array in response includes new context', addCtxRes.data.contexts?.some((c) => c.id === newContext.id));

    // Verify persistence across subsequent GET /api/auth/me query
    const meCtxRes = await get('/auth/me', tokenA);
    check('Subsequent GET /api/auth/me reflects persisted context', meCtxRes.data.user?.contexts?.some((c) => c.id === newContext.id && c.username === newContext.username));

    // Direct MongoDB Atlas query to verify persistence in database
    const dbUserAfterCtx = await User.findById(userA._id);
    const hasContextInDB = dbUserAfterCtx?.contexts?.some((c) => c.id === newContext.id && c.name === newContext.name);
    check('MongoDB Atlas User document contains persisted context', Boolean(hasContextInDB));

  } finally {
    // Cleanup created test records
    console.log('\n--- Cleaning up test artifacts ---');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`Cleaned up ${createdUserIds.length} test users from MongoDB Atlas.`);
    }

    if (server) {
      server.close();
      console.log('HTTP test server closed.');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
  }

  console.log('\n====================================================');
  console.log(`AUTH FIXES TEST SUITE COMPLETE: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log('====================================================');

  if (testFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAuthFixesSuite().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  mongoose.disconnect().finally(() => process.exit(1));
});
