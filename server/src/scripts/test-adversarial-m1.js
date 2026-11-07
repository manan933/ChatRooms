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

let passed = 0;
let failed = 0;
let warned = 0;
const results = [];
let server = null;
let BASE_URL = '';
const createdUserIds = [];

function record(category, testName, condition, details = '') {
  if (condition) {
    console.log(`  [PASS] [${category}] ${testName}`);
    passed++;
    results.push({ category, testName, status: 'PASS', details });
  } else {
    console.error(`  [FAIL] [${category}] ${testName} - ${details}`);
    failed++;
    results.push({ category, testName, status: 'FAIL', details });
  }
}

function warn(category, testName, details = '') {
  console.warn(`  [WARN] [${category}] ${testName} - ${details}`);
  warned++;
  results.push({ category, testName, status: 'WARN', details });
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

function verifyJwt(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zyntra_jwt_secret_dev_key_2026');
    return Boolean(decoded && decoded.id);
  } catch {
    return false;
  }
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('⚡ ADVERSARIAL CHALLENGER SUITE: M1 AUTH & REGISTRATION STRESS');
  console.log('================================================================\n');

  await connectDB(5, 2000);
  console.log('[DB] Connected to MongoDB Atlas:', mongoose.connection.name);

  // Spin up on ephemeral port (0) to eliminate EADDRINUSE collisions
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      BASE_URL = `http://localhost:${port}/api`;
      console.log(`[HTTP] Adversarial Test Server running at ${BASE_URL}\n`);
      resolve();
    });
  });

  const timestamp = Date.now().toString().slice(-6);

  try {
    // =========================================================================
    // 1. MALFORMED REGISTRATION PAYLOADS
    // =========================================================================
    console.log('\n--- 1. Testing Malformed Registration Payloads ---');

    // 1.1 Empty strings
    const resEmptyBody = await request('POST', '/auth/register', {});
    record('Malformed', 'Empty body rejected with 400', resEmptyBody.status === 400, `Got ${resEmptyBody.status}`);

    const resEmptyFields = await request('POST', '/auth/register', {
      name: '',
      email: '',
      username: '',
      password: '',
    });
    record('Malformed', 'Empty strings in all fields rejected with 400', resEmptyFields.status === 400, `Got ${resEmptyFields.status}`);

    const resEmptyEmail = await request('POST', '/auth/register', {
      name: 'Valid Name',
      email: '',
      username: `u_${timestamp}_emptyemail`,
      password: 'Password123!',
    });
    record('Malformed', 'Empty email rejected with 400', resEmptyEmail.status === 400, `Got ${resEmptyEmail.status}`);

    const resEmptyUsername = await request('POST', '/auth/register', {
      name: 'Valid Name',
      email: `valid_${timestamp}@zyntra.test`,
      username: '',
      password: 'Password123!',
    });
    record('Malformed', 'Empty username rejected with 400', resEmptyUsername.status === 400, `Got ${resEmptyUsername.status}`);

    // 1.2 Null values
    const resNullValues = await request('POST', '/auth/register', {
      name: null,
      email: null,
      username: null,
      password: null,
    });
    record('Malformed', 'Null values rejected with 400', resNullValues.status === 400, `Got ${resNullValues.status}`);

    // 1.3 Extreme whitespace
    const resWhitespaceOnly = await request('POST', '/auth/register', {
      name: '   ',
      email: '   ',
      username: '   ',
      password: '   ',
    });
    record('Malformed', 'Whitespace-only fields rejected with 400', resWhitespaceOnly.status === 400, `Got ${resWhitespaceOnly.status}`);

    // Whitespace password under length 6
    const resShortWsPass = await request('POST', '/auth/register', {
      name: 'Valid User',
      email: `ws_${timestamp}@zyntra.test`,
      username: `ws_${timestamp}`,
      password: '   ',
    });
    record('Malformed', 'Short whitespace password (<6 chars) rejected with 400', resShortWsPass.status === 400, `Got ${resShortWsPass.status}`);

    // 1.4 Object type confusion payloads
    const resObjectEmail = await request('POST', '/auth/register', {
      name: 'Attack User',
      email: { $gt: '' },
      username: `obj_${timestamp}`,
      password: 'Password123!',
    });
    // Should NOT crash process, should return 400 or 500 error safely
    record('Malformed', 'Object email payload handled without crashing (status >= 400)', resObjectEmail.status >= 400, `Got ${resObjectEmail.status}`);

    const resObjectUser = await request('POST', '/auth/register', {
      name: 'Attack User',
      email: `obj_${timestamp}@zyntra.test`,
      username: { $ne: null },
      password: 'Password123!',
    });
    record('Malformed', 'Object username payload handled without crashing (status >= 400)', resObjectUser.status >= 400, `Got ${resObjectUser.status}`);

    // 1.5 Array type confusion payloads
    const resArrayUser = await request('POST', '/auth/register', {
      name: ['Hacked', 'Name'],
      email: [`arr_${timestamp}@zyntra.test`],
      username: [`arr_${timestamp}`],
      password: 'Password123!',
    });
    record('Malformed', 'Array payload handled safely (status >= 400)', resArrayUser.status >= 400, `Got ${resArrayUser.status}`);

    // 1.6 Special characters / XSS strings in registration
    const xssPayload = {
      name: '<script>alert("XSS")</script>',
      email: `xss_${timestamp}@zyntra.test`,
      username: `xss_${timestamp}`,
      password: 'Password123!',
      bio: '<img src=x onerror=alert(1)>',
    };
    const resXss = await request('POST', '/auth/register', xssPayload);
    record('Malformed', 'XSS payload registration handled (returned 201 or 400, no crash)', [201, 400].includes(resXss.status), `Got ${resXss.status}`);
    if (resXss.status === 201 && resXss.data.user?._id) {
      createdUserIds.push(resXss.data.user._id);
    }

    // 1.7 Unicode and international characters in name and bio
    const unicodePayload = {
      name: 'José María Ñandú ☕',
      email: `unicode_${timestamp}@zyntra.test`,
      username: `unicode_${timestamp}`,
      password: 'Password123!',
      bio: '日本語のバイオ 🚀✨ Привет мир',
    };
    const resUnicode = await request('POST', '/auth/register', unicodePayload);
    record('Malformed', 'Unicode registration returns 201', resUnicode.status === 201, `Got ${resUnicode.status}`);
    if (resUnicode.status === 201) {
      createdUserIds.push(resUnicode.data.user._id);
      record('Malformed', 'Unicode name preserved accurately', resUnicode.data.user.name === unicodePayload.name, `Got ${resUnicode.data.user?.name}`);
      record('Malformed', 'Unicode bio preserved accurately', resUnicode.data.user.bio === unicodePayload.bio, `Got ${resUnicode.data.user?.bio}`);
    }

    // =========================================================================
    // 2. NOSQL INJECTION ATTEMPTS
    // =========================================================================
    console.log('\n--- 2. Testing NoSQL Injection Vectors ---');

    // 2.1 Login with NoSQL object injection in email field
    const resNoSqlEmail = await request('POST', '/auth/login', {
      email: { $gt: '' },
      password: 'Password123!',
    });
    record('NoSQL', 'NoSQL object in login email rejected (does not authenticate)', resNoSqlEmail.status !== 200, `Got ${resNoSqlEmail.status}`);

    // 2.2 Login with NoSQL object injection in password field
    const resNoSqlPass = await request('POST', '/auth/login', {
      email: `unicode_${timestamp}@zyntra.test`,
      password: { $ne: null },
    });
    record('NoSQL', 'NoSQL object in login password rejected (does not authenticate)', resNoSqlPass.status !== 200, `Got ${resNoSqlPass.status}`);

    // 2.3 Login with NoSQL string syntax
    const resNoSqlString = await request('POST', '/auth/login', {
      email: "admin' || '1'=='1",
      password: "admin' || '1'=='1",
    });
    record('NoSQL', 'NoSQL classic string payload returns 401 unauthorized', resNoSqlString.status === 401, `Got ${resNoSqlString.status}`);

    // 2.4 Register with NoSQL operator in username string
    const resNoSqlUserStr = await request('POST', '/auth/register', {
      name: 'Injected User',
      email: `nosql_str_${timestamp}@zyntra.test`,
      username: `$where_${timestamp}`,
      password: 'Password123!',
    });
    record('NoSQL', 'Register with $ in username processed safely without DB corruption', [201, 400].includes(resNoSqlUserStr.status), `Got ${resNoSqlUserStr.status}`);
    if (resNoSqlUserStr.status === 201) createdUserIds.push(resNoSqlUserStr.data.user._id);

    // =========================================================================
    // 3. PASSWORD BOUNDARY CONDITIONS
    // =========================================================================
    console.log('\n--- 3. Testing Password Boundary Conditions ---');

    // 3.1 Sub-minimum password (5 characters)
    const resPass5 = await request('POST', '/auth/register', {
      name: 'Boundary User',
      email: `p5_${timestamp}@zyntra.test`,
      username: `p5_${timestamp}`,
      password: '12345',
    });
    record('Password', 'Password of 5 characters rejected with 400', resPass5.status === 400, `Got ${resPass5.status}`);
    record('Password', 'Sub-minimum password error message is descriptive', resPass5.data?.message?.includes('6 characters'), `Msg: ${resPass5.data?.message}`);

    // 3.2 Exactly 6 characters
    const resPass6 = await request('POST', '/auth/register', {
      name: 'Boundary User',
      email: `p6_${timestamp}@zyntra.test`,
      username: `p6_${timestamp}`,
      password: '123456',
    });
    record('Password', 'Password of exactly 6 characters succeeds with 201', resPass6.status === 201, `Got ${resPass6.status}`);
    if (resPass6.status === 201) {
      createdUserIds.push(resPass6.data.user._id);
      // Verify login works with exactly 6 char password
      const resLogin6 = await request('POST', '/auth/login', {
        email: `p6_${timestamp}@zyntra.test`,
        password: '123456',
      });
      record('Password', 'Login with exactly 6 character password succeeds with 200', resLogin6.status === 200, `Got ${resLogin6.status}`);
    }

    // 3.3 Passwords with spaces
    // Only 6 spaces
    const resPass6Spaces = await request('POST', '/auth/register', {
      name: 'Space User',
      email: `space6_${timestamp}@zyntra.test`,
      username: `space6_${timestamp}`,
      password: '      ',
    });
    // Check behavior: if accepted, can user log in with exact 6 spaces?
    if (resPass6Spaces.status === 201) {
      createdUserIds.push(resPass6Spaces.data.user._id);
      const resLogin6Spaces = await request('POST', '/auth/login', {
        email: `space6_${timestamp}@zyntra.test`,
        password: '      ',
      });
      record('Password', 'Password of 6 spaces preserves exact whitespace on login', resLogin6Spaces.status === 200, `Got ${resLogin6Spaces.status}`);
      warn('Password', 'Application allows passwords consisting purely of whitespace characters (6 spaces)');
    } else {
      record('Password', 'Password of 6 spaces rejected', resPass6Spaces.status === 400, `Got ${resPass6Spaces.status}`);
    }

    // Password with internal and surrounding spaces
    const spacedPass = '  pass with multiple   spaces  ';
    const resSpacedPass = await request('POST', '/auth/register', {
      name: 'Space User 2',
      email: `spaced_${timestamp}@zyntra.test`,
      username: `spaced_${timestamp}`,
      password: spacedPass,
    });
    record('Password', 'Registration with spaced password succeeds with 201', resSpacedPass.status === 201, `Got ${resSpacedPass.status}`);
    if (resSpacedPass.status === 201) {
      createdUserIds.push(resSpacedPass.data.user._id);
      // Login must preserve exact spaces
      const resLoginSpaced = await request('POST', '/auth/login', {
        email: `spaced_${timestamp}@zyntra.test`,
        password: spacedPass,
      });
      record('Password', 'Login with identical spaced password succeeds with 200', resLoginSpaced.status === 200, `Got ${resLoginSpaced.status}`);

      // Login with trimmed password must fail
      const resLoginTrimmed = await request('POST', '/auth/login', {
        email: `spaced_${timestamp}@zyntra.test`,
        password: spacedPass.trim(),
      });
      record('Password', 'Login with trimmed spaced password fails with 401 (spaces are significant)', resLoginTrimmed.status === 401, `Got ${resLoginTrimmed.status}`);
    }

    // 3.4 Extremely long password (1000 characters)
    const longPassword = 'A'.repeat(1000) + '!9x';
    const resLongPass = await request('POST', '/auth/register', {
      name: 'Long Pass User',
      email: `longpass_${timestamp}@zyntra.test`,
      username: `longpass_${timestamp}`,
      password: longPassword,
    });
    record('Password', 'Registration with 1003-character password succeeds or safely fails without timeout', [201, 400].includes(resLongPass.status), `Got ${resLongPass.status}`);
    if (resLongPass.status === 201) {
      createdUserIds.push(resLongPass.data.user._id);
      const resLoginLong = await request('POST', '/auth/login', {
        email: `longpass_${timestamp}@zyntra.test`,
        password: longPassword,
      });
      record('Password', 'Login with 1003-character password succeeds with 200', resLoginLong.status === 200, `Got ${resLoginLong.status}`);
    }

    // =========================================================================
    // 4. DUPLICATE USER COLLISIONS (CASING, @HANDLE, CONSTRAINTS)
    // =========================================================================
    console.log('\n--- 4. Testing Duplicate User Collisions ---');

    const seedUser = {
      name: 'Base Collision User',
      email: `collision_${timestamp}@zyntra.test`,
      username: `panda_${timestamp}`,
      password: 'BasePassword123!',
    };
    const resSeed = await request('POST', '/auth/register', seedUser);
    record('Collision', 'Seed user registration succeeds with 201', resSeed.status === 201, `Got ${resSeed.status}`);
    if (resSeed.status === 201) createdUserIds.push(resSeed.data.user._id);

    // 4.1 Duplicate email with uppercase letters
    const resDupEmailUpper = await request('POST', '/auth/register', {
      name: 'Uppercase Email User',
      email: `COLLISION_${timestamp}@ZYNTRA.TEST`,
      username: `otherpanda_${timestamp}`,
      password: 'OtherPassword123!',
    });
    record('Collision', 'Duplicate email with UPPERCASE letters rejected with 400', resDupEmailUpper.status === 400, `Got ${resDupEmailUpper.status}`);
    record('Collision', 'Duplicate error message mentions existing account', resDupEmailUpper.data?.message?.toLowerCase().includes('already exists'), `Msg: ${resDupEmailUpper.data?.message}`);

    // 4.2 Duplicate username with uppercase letters
    const resDupUserUpper = await request('POST', '/auth/register', {
      name: 'Uppercase Username User',
      email: `other_${timestamp}@zyntra.test`,
      username: `PANDA_${timestamp}`,
      password: 'OtherPassword123!',
    });
    record('Collision', 'Duplicate username with UPPERCASE letters rejected with 400', resDupUserUpper.status === 400, `Got ${resDupUserUpper.status}`);
    record('Collision', 'Duplicate error message mentions existing account', resDupUserUpper.data?.message?.toLowerCase().includes('already exists'), `Msg: ${resDupUserUpper.data?.message}`);

    // 4.3 Duplicate username with @ prefix
    const resDupUserHandle = await request('POST', '/auth/register', {
      name: 'Handle Prefix User',
      email: `other2_${timestamp}@zyntra.test`,
      username: `@panda_${timestamp}`,
      password: 'OtherPassword123!',
    });
    record('Collision', 'Duplicate username with @ prefix rejected with 400', resDupUserHandle.status === 400, `Got ${resDupUserHandle.status}`);

    // 4.4 Duplicate with primaryUsername instead of username
    const resDupPrimaryUser = await request('POST', '/auth/register', {
      name: 'Handle Prefix User',
      email: `other3_${timestamp}@zyntra.test`,
      primaryUsername: `@PANDA_${timestamp}`,
      password: 'OtherPassword123!',
    });
    record('Collision', 'Duplicate primaryUsername with @ and uppercase rejected with 400', resDupPrimaryUser.status === 400, `Got ${resDupPrimaryUser.status}`);

    // 4.5 Login using uppercase email, uppercase username, and @handle
    const resLoginUpperEmail = await request('POST', '/auth/login', {
      email: `COLLISION_${timestamp}@ZYNTRA.TEST`,
      password: seedUser.password,
    });
    record('Collision', 'Login with UPPERCASE email succeeds with 200', resLoginUpperEmail.status === 200, `Got ${resLoginUpperEmail.status}`);

    const resLoginUpperUser = await request('POST', '/auth/login', {
      email: `PANDA_${timestamp}`,
      password: seedUser.password,
    });
    record('Collision', 'Login with UPPERCASE username in email field succeeds with 200', resLoginUpperUser.status === 200, `Got ${resLoginUpperUser.status}`);

    const resLoginHandleUser = await request('POST', '/auth/login', {
      email: `@panda_${timestamp}`,
      password: seedUser.password,
    });
    record('Collision', 'Login with @handle in email field succeeds with 200', resLoginHandleUser.status === 200, `Got ${resLoginHandleUser.status}`);

    // =========================================================================
    // 5. CONCURRENT LOGIN & REGISTRATION REQUESTS
    // =========================================================================
    console.log('\n--- 5. Testing Concurrency (Race Conditions) ---');

    // 5.1 Concurrent registration of the exact same user (10 requests at once)
    const concurrentEmail = `race_${timestamp}@zyntra.test`;
    const concurrentUsername = `race_${timestamp}`;
    const racePayload = {
      name: 'Concurrent User',
      email: concurrentEmail,
      username: concurrentUsername,
      password: 'RacePassword123!',
    };

    const racePromises = Array.from({ length: 10 }).map(() =>
      request('POST', '/auth/register', racePayload)
    );
    const raceResults = await Promise.all(racePromises);

    const success201Count = raceResults.filter((r) => r.status === 201).length;
    const error400Count = raceResults.filter((r) => r.status === 400).length;
    const crashCount = raceResults.filter((r) => r.status === 0 || r.status >= 500).length;

    record('Concurrency', 'Exact same user concurrent registration creates EXACTLY 1 user', success201Count === 1, `201s: ${success201Count}, 400s: ${error400Count}`);
    record('Concurrency', 'Remaining 9 concurrent requests rejected with 400 without crashing', error400Count === 9, `400s: ${error400Count}`);
    record('Concurrency', 'Zero unhandled crashes (500) during concurrent registration burst', crashCount === 0, `500s/crashes: ${crashCount}`);

    // Track created user
    const winningUser = raceResults.find((r) => r.status === 201)?.data?.user;
    if (winningUser?._id) createdUserIds.push(winningUser._id);

    // Verify DB count for this email is exactly 1
    const dbUsersCount = await User.countDocuments({ email: concurrentEmail });
    record('Concurrency', 'MongoDB document count for race email is strictly 1', dbUsersCount === 1, `Count: ${dbUsersCount}`);

    // 5.2 Concurrent logins (20 parallel requests for winning user)
    const loginPromises = Array.from({ length: 20 }).map(() =>
      request('POST', '/auth/login', {
        email: concurrentEmail,
        password: racePayload.password,
      })
    );
    const parallelLogins = await Promise.all(loginPromises);
    const loginSuccessCount = parallelLogins.filter((r) => r.status === 200 && verifyJwt(r.data?.token)).length;
    record('Concurrency', 'All 20 parallel login requests succeed with 200 and valid JWT', loginSuccessCount === 20, `Successes: ${loginSuccessCount}/20`);

    // =========================================================================
    // 6. CONTEXT PERSISTENCE & BOUNDARY CONDITIONS
    // =========================================================================
    console.log('\n--- 6. Testing Context Persistence & Boundaries ---');

    // Acquire token for context operations
    const userToken = resSeed.data.token;
    const userId = resSeed.data.user._id;

    // 6.1 Adding multiple contexts sequentially
    const ctx1 = { id: `ctx-work-${timestamp}`, type: 'workplace', name: 'Workplace Alpha', username: `work_${timestamp}` };
    const ctx2 = { id: `ctx-proj-${timestamp}`, type: 'workplace', name: 'Project Beta', username: `proj_${timestamp}` };
    const ctx3 = { id: `ctx-pers2-${timestamp}`, type: 'personal', name: 'Personal Side', username: `side_${timestamp}` };

    const resCtx1 = await request('POST', '/auth/context', ctx1, userToken);
    const resCtx2 = await request('POST', '/auth/context', ctx2, userToken);
    const resCtx3 = await request('POST', '/auth/context', ctx3, userToken);

    record('Context', 'Adding Context 1 succeeds with 200', resCtx1.status === 200, `Got ${resCtx1.status}`);
    record('Context', 'Adding Context 2 succeeds with 200', resCtx2.status === 200, `Got ${resCtx2.status}`);
    record('Context', 'Adding Context 3 succeeds with 200', resCtx3.status === 200, `Got ${resCtx3.status}`);

    // Verify via GET /api/auth/me
    const resMeCtx = await request('GET', '/auth/me', null, userToken);
    const returnedContexts = resMeCtx.data?.user?.contexts || [];
    const hasAllThree = [ctx1.id, ctx2.id, ctx3.id].every((id) =>
      returnedContexts.some((c) => c.id === id)
    );
    record('Context', 'GET /api/auth/me returns all 3 newly added contexts', hasAllThree, `Found: ${returnedContexts.length} contexts`);

    // Direct MongoDB verification
    const dbUserCtx = await User.findById(userId);
    const dbHasAllThree = [ctx1.id, ctx2.id, ctx3.id].every((id) =>
      dbUserCtx.contexts.some((c) => c.id === id)
    );
    record('Context', 'MongoDB Atlas User document directly verifies all 3 contexts persisted', dbHasAllThree, `DB contexts count: ${dbUserCtx.contexts.length}`);

    // 6.2 Duplicate context IDs (updating existing context ID)
    const ctx1Updated = {
      id: ctx1.id,
      type: 'workplace',
      name: 'Workplace Alpha RENAMED',
      username: `work_renamed_${timestamp}`,
    };
    const resCtxUpdate = await request('POST', '/auth/context', ctx1Updated, userToken);
    record('Context', 'Posting same context ID updates without duplicating', resCtxUpdate.status === 200, `Got ${resCtxUpdate.status}`);
    
    const dbUserAfterUpdate = await User.findById(userId);
    const matchingCtx = dbUserAfterUpdate.contexts.filter((c) => c.id === ctx1.id);
    record('Context', 'Context array contains exactly 1 entry for the updated ID', matchingCtx.length === 1, `Count: ${matchingCtx.length}`);
    record('Context', 'Context name updated to renamed value', matchingCtx[0]?.name === ctx1Updated.name, `Name: ${matchingCtx[0]?.name}`);

    // 6.3 Special characters, Unicode & HTML in context names
    const ctxSpecial = {
      id: `ctx-spec-${timestamp}`,
      type: 'workplace',
      name: '<bold>Special & Co.</bold> 🏢🔥 "Quotes" & Slashes /',
      username: `special_${timestamp}`,
    };
    const resCtxSpecial = await request('POST', '/auth/context', ctxSpecial, userToken);
    record('Context', 'Special characters and unicode in context name succeeds with 200', resCtxSpecial.status === 200, `Got ${resCtxSpecial.status}`);
    const resMeSpecial = await request('GET', '/auth/me', null, userToken);
    const foundSpecial = resMeSpecial.data?.user?.contexts?.find((c) => c.id === ctxSpecial.id);
    record('Context', 'Special character context name preserved intact', foundSpecial?.name === ctxSpecial.name, `Name: ${foundSpecial?.name}`);

    // 6.4 Malformed context payloads (missing fields)
    const resCtxMissing = await request('POST', '/auth/context', { id: 'only-id' }, userToken);
    record('Context', 'Missing required context fields rejected with 400', resCtxMissing.status === 400, `Got ${resCtxMissing.status}`);

    // =========================================================================
    // 7. PROFILE UPDATES (BIO, PHONE, AVATAR, NAME BOUNDARIES)
    // =========================================================================
    console.log('\n--- 7. Testing Profile Updates & Edge Cases ---');

    // 7.1 Long text bio (5,000 characters)
    const longBio = 'B'.repeat(5000);
    const resLongBio = await request('PUT', '/auth/profile', { bio: longBio }, userToken);
    record('Profile', 'Updating bio with 5,000-character text succeeds with 200', resLongBio.status === 200, `Got ${resLongBio.status}`);
    const resMeLongBio = await request('GET', '/auth/me', null, userToken);
    record('Profile', 'GET /api/auth/me returns 5,000-char bio accurately', resMeLongBio.data?.user?.bio?.length === 5000, `Length: ${resMeLongBio.data?.user?.bio?.length}`);
    const dbUserLongBio = await User.findById(userId).lean();
    record('Profile', 'MongoDB Atlas document persists 5,000-char bio', dbUserLongBio?.bio?.length === 5000, `DB Length: ${dbUserLongBio?.bio?.length}`);

    // 7.2 Empty string bio
    const resEmptyBio = await request('PUT', '/auth/profile', { bio: '' }, userToken);
    record('Profile', 'Updating bio to empty string succeeds with 200', resEmptyBio.status === 200, `Got ${resEmptyBio.status}`);
    const resMeEmptyBio = await request('GET', '/auth/me', null, userToken);
    record('Profile', 'GET /api/auth/me reflects empty string bio', resMeEmptyBio.data?.user?.bio === '', `Bio: "${resMeEmptyBio.data?.user?.bio}"`);

    // 7.3 Unusual characters in bio (emojis, newlines, HTML, unicode)
    const complexBio = 'Line 1: Hello!\nLine 2: 🚀✨ 💻\nLine 3: <b>bold</b> & "quotes" & <script>';
    const resComplexBio = await request('PUT', '/auth/profile', { bio: complexBio }, userToken);
    record('Profile', 'Updating bio with complex multiline unicode characters succeeds with 200', resComplexBio.status === 200, `Got ${resComplexBio.status}`);
    const resMeComplexBio = await request('GET', '/auth/me', null, userToken);
    record('Profile', 'GET /api/auth/me returns complex bio intact', resMeComplexBio.data?.user?.bio === complexBio, `Match: ${resMeComplexBio.data?.user?.bio === complexBio}`);

    // 7.4 Phone field updates (international, spaces, symbols)
    const testPhone = '+1 (800) 555-0199 ext. 42';
    const resPhone = await request('PUT', '/auth/profile', { phone: testPhone }, userToken);
    record('Profile', 'Updating phone field succeeds with 200', resPhone.status === 200, `Got ${resPhone.status}`);
    record('Profile', 'PUT response includes phone field', resPhone.data?.user?.phone === testPhone, `Phone: ${resPhone.data?.user?.phone}`);
    const resMePhone = await request('GET', '/auth/me', null, userToken);
    record('Profile', 'GET /api/auth/me returns updated phone', resMePhone.data?.user?.phone === testPhone, `Phone: ${resMePhone.data?.user?.phone}`);
    const dbUserPhone = await User.findById(userId).lean();
    record('Profile', 'MongoDB Atlas document directly persists phone', (dbUserPhone?.phone || dbUserPhone?.['phone']) === testPhone, `DB Phone: ${dbUserPhone?.phone}`);

    // 7.5 Updating name with unicode and spaces
    const unicodeName = 'Dr. Éléonore de La Tour 🛡️';
    const resName = await request('PUT', '/auth/profile', { name: unicodeName }, userToken);
    record('Profile', 'Updating name with accented unicode succeeds with 200', resName.status === 200, `Got ${resName.status}`);
    const resMeName = await request('GET', '/auth/me', null, userToken);
    record('Profile', 'GET /api/auth/me reflects updated accented name', resMeName.data?.user?.name === unicodeName, `Name: ${resMeName.data?.user?.name}`);

  } finally {
    // CLEANUP ALL TEST ARTIFACTS
    console.log('\n--- Cleaning up test artifacts ---');
    if (createdUserIds.length > 0) {
      const deleteRes = await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`[Cleanup] Deleted ${deleteRes.deletedCount} test users from MongoDB Atlas.`);
    }

    if (server) {
      server.close();
      console.log('[HTTP] Test server closed.');
    }

    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB Atlas.');
  }

  console.log('\n================================================================');
  console.log(`ADVERSARIAL STRESS SUITE FINISHED: ${passed} PASSED, ${failed} FAILED, ${warned} WARNINGS`);
  console.log('================================================================');

  return { passed, failed, warned, results };
}

runAdversarialSuite()
  .then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Fatal crash during adversarial test run:', err);
    if (server) server.close();
    mongoose.disconnect().finally(() => process.exit(1));
  });
