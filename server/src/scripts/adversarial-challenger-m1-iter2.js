import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

let passed = 0;
let failed = 0;
let server = null;
let BASE_URL = '';
const createdUserIds = [];

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message} - ${details}`);
    failed++;
  }
}

async function request(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== null) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, opts);
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, error: err.message, data: {} };
  }
}

async function run() {
  console.log('========================================================================');
  console.log('🔍 EMPIRICAL CHALLENGER VERIFICATION HARNESS - MILESTONE 1 ITERATION 2');
  console.log('========================================================================\n');

  await connectDB(5, 2000);
  console.log('[DB] Connected to MongoDB Atlas:', mongoose.connection.name);

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      BASE_URL = `http://localhost:${port}/api`;
      console.log(`[HTTP] Adversarial challenger test server listening at ${BASE_URL}\n`);
      resolve();
    });
  });

  const ts = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // 1. MALFORMED NOSQL & TYPE CONFUSION PAYLOADS (MUST BE 400, NOT 500)
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Malformed NoSQL & Type Confusion (Must return 400, not 500) ---');

    const nosqlPayloadsRegister = [
      {
        name: 'Register with email object {"$gt": ""}',
        body: { name: 'Attacker', email: { $gt: '' }, username: `atk_u1_${ts}`, password: 'Password123!' },
      },
      {
        name: 'Register with password array [1,2,3]',
        body: { name: 'Attacker', email: `atk_e2_${ts}@zyntra.test`, username: `atk_u2_${ts}`, password: [1, 2, 3] },
      },
      {
        name: 'Register with name object {"$ne": null}',
        body: { name: { $ne: null }, email: `atk_e3_${ts}@zyntra.test`, username: `atk_u3_${ts}`, password: 'Password123!' },
      },
      {
        name: 'Register with username object {"$regex": ".*"}',
        body: { name: 'Attacker', email: `atk_e4_${ts}@zyntra.test`, username: { $regex: '.*' }, password: 'Password123!' },
      },
      {
        name: 'Register with primaryUsername array',
        body: { name: 'Attacker', email: `atk_e5_${ts}@zyntra.test`, primaryUsername: ['hacked'], password: 'Password123!' },
      },
      {
        name: 'Register with boolean password true',
        body: { name: 'Attacker', email: `atk_e6_${ts}@zyntra.test`, username: `atk_u6_${ts}`, password: true },
      },
      {
        name: 'Register with numeric email 12345',
        body: { name: 'Attacker', email: 12345, username: `atk_u7_${ts}`, password: 'Password123!' },
      },
    ];

    for (const test of nosqlPayloadsRegister) {
      const res = await request('POST', '/auth/register', test.body);
      assert(res.status === 400, `${test.name} -> HTTP 400`, `Got status ${res.status}: ${JSON.stringify(res.data)}`);
      assert(res.status !== 500, `${test.name} -> NOT HTTP 500`, `Got 500 crash!`);
    }

    const nosqlPayloadsLogin = [
      {
        name: 'Login with email object {"$gt": ""}',
        body: { email: { $gt: '' }, password: 'Password123!' },
      },
      {
        name: 'Login with password array [1,2,3]',
        body: { email: `test_${ts}@zyntra.test`, password: [1, 2, 3] },
      },
      {
        name: 'Login with emailOrUsername object {"$gt": ""}',
        body: { emailOrUsername: { $gt: '' }, password: 'Password123!' },
      },
      {
        name: 'Login with password object {"$ne": null}',
        body: { email: `test_${ts}@zyntra.test`, password: { $ne: null } },
      },
      {
        name: 'Login with username array ["admin"]',
        body: { username: ['admin'], password: 'Password123!' },
      },
      {
        name: 'Login with boolean email true',
        body: { email: true, password: 'Password123!' },
      },
    ];

    for (const test of nosqlPayloadsLogin) {
      const res = await request('POST', '/auth/login', test.body);
      assert(res.status === 400, `${test.name} -> HTTP 400`, `Got status ${res.status}: ${JSON.stringify(res.data)}`);
      assert(res.status !== 500, `${test.name} -> NOT HTTP 500`, `Got 500 crash!`);
    }

    // -------------------------------------------------------------------------
    // 2. DUPLICATE REGISTRATION ERROR MESSAGE
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Duplicate Registration Error Message ---');
    const EXPECTED_DUP_MSG = 'An account with that email or username already exists.';

    const seedUser = {
      name: 'Seed Duplicate User',
      email: `seed_dup_${ts}@zyntra.test`,
      username: `seed_dup_${ts}`,
      password: 'StrongPassword123!',
    };

    const resSeed = await request('POST', '/auth/register', seedUser);
    assert(resSeed.status === 201, 'Seed user registration succeeds with 201', `Got ${resSeed.status}`);
    if (resSeed.status === 201 && resSeed.data.user?._id) {
      createdUserIds.push(resSeed.data.user._id);
    }

    // 2.1 Duplicate exact email
    const resDupEmail = await request('POST', '/auth/register', {
      name: 'Dup User 1',
      email: seedUser.email,
      username: `different_u1_${ts}`,
      password: 'AnotherPassword123!',
    });
    assert(resDupEmail.status === 400, 'Duplicate exact email rejected with 400', `Got ${resDupEmail.status}`);
    assert(
      resDupEmail.data?.message === EXPECTED_DUP_MSG,
      'Duplicate exact email returns exact error message',
      `Got message: "${resDupEmail.data?.message}"`
    );

    // 2.2 Duplicate uppercase email
    const resDupEmailUpper = await request('POST', '/auth/register', {
      name: 'Dup User 2',
      email: seedUser.email.toUpperCase(),
      username: `different_u2_${ts}`,
      password: 'AnotherPassword123!',
    });
    assert(resDupEmailUpper.status === 400, 'Duplicate UPPERCASE email rejected with 400', `Got ${resDupEmailUpper.status}`);
    assert(
      resDupEmailUpper.data?.message === EXPECTED_DUP_MSG,
      'Duplicate UPPERCASE email returns exact error message',
      `Got message: "${resDupEmailUpper.data?.message}"`
    );

    // 2.3 Duplicate exact username
    const resDupUser = await request('POST', '/auth/register', {
      name: 'Dup User 3',
      email: `different_e3_${ts}@zyntra.test`,
      username: seedUser.username,
      password: 'AnotherPassword123!',
    });
    assert(resDupUser.status === 400, 'Duplicate exact username rejected with 400', `Got ${resDupUser.status}`);
    assert(
      resDupUser.data?.message === EXPECTED_DUP_MSG,
      'Duplicate exact username returns exact error message',
      `Got message: "${resDupUser.data?.message}"`
    );

    // 2.4 Duplicate uppercase username with @ prefix
    const resDupUserUpperAt = await request('POST', '/auth/register', {
      name: 'Dup User 4',
      email: `different_e4_${ts}@zyntra.test`,
      username: `@${seedUser.username.toUpperCase()}`,
      password: 'AnotherPassword123!',
    });
    assert(resDupUserUpperAt.status === 400, 'Duplicate @UPPERCASE username rejected with 400', `Got ${resDupUserUpperAt.status}`);
    assert(
      resDupUserUpperAt.data?.message === EXPECTED_DUP_MSG,
      'Duplicate @UPPERCASE username returns exact error message',
      `Got message: "${resDupUserUpperAt.data?.message}"`
    );

    // 2.5 Duplicate via primaryUsername parameter
    const resDupPrimary = await request('POST', '/auth/register', {
      name: 'Dup User 5',
      email: `different_e5_${ts}@zyntra.test`,
      primaryUsername: seedUser.username,
      password: 'AnotherPassword123!',
    });
    assert(resDupPrimary.status === 400, 'Duplicate primaryUsername rejected with 400', `Got ${resDupPrimary.status}`);
    assert(
      resDupPrimary.data?.message === EXPECTED_DUP_MSG,
      'Duplicate primaryUsername returns exact error message',
      `Got message: "${resDupPrimary.data?.message}"`
    );

    // 2.6 Concurrent race condition triggering MongoDB Atlas E11000 index error
    console.log('\n--- 2.6 Concurrent Registration Collision (Testing MongoDB 11000 duplicate handling) ---');
    const raceEmail = `race_e11000_${ts}@zyntra.test`;
    const raceUser = `race_e11000_${ts}`;
    const racePayload = {
      name: 'Race E11000 User',
      email: raceEmail,
      username: raceUser,
      password: 'RacePassword123!',
    };

    const burstResults = await Promise.all(
      Array.from({ length: 8 }).map(() => request('POST', '/auth/register', racePayload))
    );

    const successCount = burstResults.filter((r) => r.status === 201).length;
    const rejectedCount = burstResults.filter((r) => r.status === 400).length;
    const crashCount = burstResults.filter((r) => r.status === 500).length;

    assert(successCount === 1, 'Burst registration: exactly 1 request succeeded with 201', `Success: ${successCount}`);
    assert(rejectedCount === 7, 'Burst registration: exactly 7 requests rejected with 400', `Rejected: ${rejectedCount}`);
    assert(crashCount === 0, 'Burst registration: 0 crashes (no 500s)', `Crashes: ${crashCount}`);

    // Track the successful user for cleanup
    const winningRes = burstResults.find((r) => r.status === 201);
    if (winningRes?.data?.user?._id) createdUserIds.push(winningRes.data.user._id);

    // Verify all 7 rejected requests returned the exact duplicate error message
    const rejectedMessagesMatch = burstResults
      .filter((r) => r.status === 400)
      .every((r) => r.data?.message === EXPECTED_DUP_MSG);
    assert(
      rejectedMessagesMatch,
      'Burst registration: all concurrent duplicates received exact duplicate error message',
      `Sample: ${JSON.stringify(burstResults.filter((r) => r.status === 400).map((r) => r.data?.message))}`
    );

    // -------------------------------------------------------------------------
    // 3. WHITESPACE PASSWORD VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Whitespace Password Validation ---');

    // 3.1 Exactly 6 spaces password -> Expect 400 Bad Request
    const res6Spaces = await request('POST', '/auth/register', {
      name: '6 Spaces User',
      email: `ws6_${ts}@zyntra.test`,
      username: `ws6_${ts}`,
      password: '      ', // 6 spaces
    });
    assert(res6Spaces.status === 400, '6 spaces password rejected with HTTP 400', `Got status ${res6Spaces.status}`);
    assert(
      res6Spaces.data?.message?.includes('non-whitespace characters'),
      '6 spaces password error message mentions non-whitespace characters',
      `Got message: "${res6Spaces.data?.message}"`
    );

    // 3.2 10 spaces password -> Expect 400 Bad Request
    const res10Spaces = await request('POST', '/auth/register', {
      name: '10 Spaces User',
      email: `ws10_${ts}@zyntra.test`,
      username: `ws10_${ts}`,
      password: '          ', // 10 spaces
    });
    assert(res10Spaces.status === 400, '10 spaces password rejected with HTTP 400', `Got status ${res10Spaces.status}`);

    // 3.3 Tab & newline only passwords
    const resTabs = await request('POST', '/auth/register', {
      name: 'Tabs User',
      email: `wstabs_${ts}@zyntra.test`,
      username: `wstabs_${ts}`,
      password: '\t\t\t\t\t\t',
    });
    assert(resTabs.status === 400, 'Tabs-only password rejected with HTTP 400', `Got status ${resTabs.status}`);

    const resNewlines = await request('POST', '/auth/register', {
      name: 'Newlines User',
      email: `wsnewlines_${ts}@zyntra.test`,
      username: `wsnewlines_${ts}`,
      password: '\n\n\n\n\n\n',
    });
    assert(resNewlines.status === 400, 'Newlines-only password rejected with HTTP 400', `Got status ${resNewlines.status}`);

    // 3.4 Valid password containing interior & surrounding spaces
    const validSpacedPass = '  valid pass with multiple spaces  ';
    const resValidSpaced = await request('POST', '/auth/register', {
      name: 'Valid Spaced User',
      email: `valid_spaced_${ts}@zyntra.test`,
      username: `valid_spaced_${ts}`,
      password: validSpacedPass,
    });
    assert(resValidSpaced.status === 201, 'Valid password with surrounding spaces succeeds with 201', `Got status ${resValidSpaced.status}`);
    if (resValidSpaced.status === 201 && resValidSpaced.data?.user?._id) {
      createdUserIds.push(resValidSpaced.data.user._id);

      // Login with exact spaced password succeeds
      const resLoginSpaced = await request('POST', '/auth/login', {
        email: `valid_spaced_${ts}@zyntra.test`,
        password: validSpacedPass,
      });
      assert(resLoginSpaced.status === 200, 'Login with exact spaced password succeeds with 200', `Got ${resLoginSpaced.status}`);

      // Login with trimmed password fails with 401
      const resLoginTrimmed = await request('POST', '/auth/login', {
        email: `valid_spaced_${ts}@zyntra.test`,
        password: validSpacedPass.trim(),
      });
      assert(resLoginTrimmed.status === 401, 'Login with trimmed spaced password fails with 401 (spaces significant)', `Got ${resLoginTrimmed.status}`);
    }

  } catch (err) {
    console.error('[FATAL ERROR IN HARNESS]:', err);
    failed++;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP & TEARDOWN
    // -------------------------------------------------------------------------
    console.log('\n--- Cleanup & Teardown ---');
    if (createdUserIds.length > 0) {
      const delResult = await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`[Cleanup] Deleted ${delResult.deletedCount} created test users from MongoDB Atlas.`);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('[HTTP] Test server closed.');
    }

    await mongoose.connection.close();
    console.log('[DB] Disconnected from MongoDB Atlas.');

    console.log('\n========================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');

    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
