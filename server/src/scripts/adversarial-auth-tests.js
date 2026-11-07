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

const PORT = 5059;
const BASE_URL = `http://localhost:${PORT}/api`;

let testPassed = 0;
let testFailed = 0;
let server = null;
const findings = [];
const createdUserIds = [];

function check(desc, condition, details = '') {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    testPassed++;
  } else {
    console.error(`  [FAIL] ${desc} ${details ? `(${details})` : ''}`);
    testFailed++;
    findings.push({ desc, details });
  }
}

async function post(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    return { status: 500, error: err.message, data: {} };
  }
}

async function get(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    return { status: 500, error: err.message, data: {} };
  }
}

async function put(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    return { status: 500, error: err.message, data: {} };
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
  console.log('====================================================');
  console.log('⚔️  ADVERSARIAL STRESS-TEST & EDGE-CASE SUITE (M1)');
  console.log('====================================================');

  await connectDB(5, 2000);
  console.log('Connected to MongoDB Atlas:', mongoose.connection.name);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Adversarial test server listening on http://localhost:${PORT}\n`);

  const runId = Date.now().toString().slice(-6);

  try {
    // ==================================================================
    // 1. MALFORMED REGISTRATION PAYLOADS
    // ==================================================================
    console.log('\n--- 1. Malformed Registration Payloads ---');

    // 1.1 Empty strings
    const emptyFields = [
      { name: '', email: `val_${runId}@zyntra.test`, username: `u_${runId}_1`, password: 'password123', field: 'name' },
      { name: 'Valid Name', email: '', username: `u_${runId}_2`, password: 'password123', field: 'email' },
      { name: 'Valid Name', email: `val_${runId}_3@zyntra.test`, username: '', password: 'password123', field: 'username' },
      { name: 'Valid Name', email: `val_${runId}_4@zyntra.test`, username: `u_${runId}_4`, password: '', field: 'password' },
    ];
    for (const p of emptyFields) {
      const res = await post('/auth/register', p);
      check(`Empty ${p.field} rejected with 400`, res.status === 400 && res.data?.success === false);
    }

    // 1.2 Null values & empty body
    const nullPayloads = [
      { name: null, email: `null_${runId}@zyntra.test`, username: `unull_${runId}_1`, password: 'password123', field: 'name: null' },
      { name: 'Name', email: null, username: `unull_${runId}_2`, password: 'password123', field: 'email: null' },
      { name: 'Name', email: `null_${runId}_3@zyntra.test`, username: null, password: 'password123', field: 'username: null' },
      { name: 'Name', email: `null_${runId}_4@zyntra.test`, username: `unull_${runId}_4`, password: null, field: 'password: null' },
      null,
      {},
    ];
    for (const p of nullPayloads) {
      const res = await post('/auth/register', p);
      const desc = p ? (p.field || 'empty object {}') : 'null body';
      check(`${desc} rejected with 400 (got ${res.status})`, res.status === 400 && res.data?.success === false);
    }

    // 1.3 Extreme whitespace
    const whitespacePayloads = [
      { name: '   ', email: `ws_${runId}@zyntra.test`, username: `ws_${runId}_1`, password: 'password123', label: 'whitespace name' },
      { name: 'Valid', email: '   ', username: `ws_${runId}_2`, password: 'password123', label: 'whitespace email' },
      { name: 'Valid', email: `ws_${runId}_3@zyntra.test`, username: '   ', password: 'password123', label: 'whitespace username' },
      { name: 'Valid', email: `ws_${runId}_4@zyntra.test`, username: `ws_${runId}_4`, password: '   ', label: 'whitespace password (<6 chars)' },
    ];
    for (const p of whitespacePayloads) {
      const res = await post('/auth/register', p);
      check(`${p.label} rejected with 400`, res.status === 400 && res.data?.success === false);
    }

    // 1.4 Invalid email formats
    const invalidEmails = [
      'not-an-email',
      'missingatsign.com',
      '@nodomain.com',
      'user@.com',
      'user@com',
      'user name@domain.com',
    ];
    for (const badEmail of invalidEmails) {
      const res = await post('/auth/register', {
        name: 'Bad Email User',
        email: badEmail,
        username: `badmail_${runId}_${Math.random().toString(36).slice(2, 6)}`,
        password: 'password123',
      });
      check(`Invalid email format '${badEmail}' rejected with 400`, res.status === 400 && res.data?.success === false);
    }

    // 1.5 Special characters & Unicode support in name and username
    const unicodeName = `Jürgen Ñandú 🚀 测试_${runId}`;
    const cleanAsciiUsername = `unicode_user_${runId}`;
    const unicodeReg = await post('/auth/register', {
      name: unicodeName,
      email: `unicode_${runId}@zyntra.test`,
      username: cleanAsciiUsername,
      password: 'password123',
      bio: 'Unicode & emoji bio: 🌟✨🔥',
    });
    check('Registration with unicode/emoji name and bio succeeds (201)', unicodeReg.status === 201 && unicodeReg.data?.success === true);
    if (unicodeReg.data?.user?._id) createdUserIds.push(unicodeReg.data.user._id);
    check('Unicode name correctly stored and returned', unicodeReg.data?.user?.name === unicodeName);

    // ==================================================================
    // 2. NOSQL INJECTION PAYLOADS
    // ==================================================================
    console.log('\n--- 2. NoSQL Injection & Type Confusion Resistance ---');

    // 2.1 Registration with NoSQL injection object in email / username
    const nosqlRegisterPayloads = [
      { name: 'Hacker', email: { $gt: '' }, username: `hack_${runId}_1`, password: 'password123', label: 'email object {$gt: ""}' },
      { name: 'Hacker', email: { $ne: null }, username: `hack_${runId}_2`, password: 'password123', label: 'email object {$ne: null}' },
      { name: 'Hacker', email: `hack_${runId}_3@zyntra.test`, username: { $gt: '' }, password: 'password123', label: 'username object {$gt: ""}' },
      { name: 'Hacker', email: `hack_${runId}_4@zyntra.test`, username: `hack_${runId}_4`, password: { $gt: '' }, label: 'password object {$gt: ""}' },
      { name: 'Hacker', email: ['array@zyntra.test'], username: `hack_${runId}_5`, password: 'password123', label: 'email array' },
      { name: 'Hacker', email: `hack_${runId}_6@zyntra.test`, username: ['arrayuser'], password: 'password123', label: 'username array' },
    ];
    for (const p of nosqlRegisterPayloads) {
      const res = await post('/auth/register', p);
      // It must NOT succeed (status !== 201) and no token should be issued
      check(`Registration rejected for ${p.label} (status ${res.status}, no token)`, res.status !== 201 && !res.data?.token);
    }

    // 2.2 Login with NoSQL injection payloads
    const nosqlLoginPayloads = [
      { email: { $gt: '' }, password: 'password123', label: 'login email {$gt: ""}' },
      { email: { $ne: null }, password: { $ne: null }, label: 'login email & pass {$ne: null}' },
      { emailOrUsername: { $gt: '' }, password: 'password123', label: 'login emailOrUsername {$gt: ""}' },
      { email: "$gt", password: 'password123', label: 'login literal string "$gt"' },
      { email: "admin' OR '1'='1", password: 'password123', label: 'login SQL-style injection' },
      { email: ".*", password: 'password123', label: 'login regex string ".*"' },
      { email: `unicode_${runId}@zyntra.test`, password: { $ne: null }, label: 'valid email with password object {$ne: null}' },
      { email: `unicode_${runId}@zyntra.test`, password: { $gt: '' }, label: 'valid email with password object {$gt: ""}' },
    ];
    for (const p of nosqlLoginPayloads) {
      const res = await post('/auth/login', p);
      check(`Login rejected for ${p.label} (status ${res.status}, no token issued)`, res.status !== 200 && !res.data?.token);
    }

    // ==================================================================
    // 3. PASSWORD BOUNDARY CONDITIONS
    // ==================================================================
    console.log('\n--- 3. Password Boundary Conditions ---');

    // 3.1 Sub-minimum passwords
    const shortPasswords = ['1', '12', '123', '1234', '12345'];
    for (const sp of shortPasswords) {
      const res = await post('/auth/register', {
        name: 'Short Pass User',
        email: `short_${sp}_${runId}@zyntra.test`,
        username: `sp_${sp}_${runId}`,
        password: sp,
      });
      check(`Password length ${sp.length} rejected with 400`, res.status === 400 && res.data?.message?.includes('6 characters'));
    }

    // 3.2 Exactly 6 characters
    const exact6Pass = '6chars';
    const exact6User = {
      name: 'Exact Six User',
      email: `exact6_${runId}@zyntra.test`,
      username: `exact6_${runId}`,
      password: exact6Pass,
    };
    const exact6Reg = await post('/auth/register', exact6User);
    check('Password of exactly 6 characters succeeds registration (201)', exact6Reg.status === 201 && exact6Reg.data?.success === true);
    if (exact6Reg.data?.user?._id) createdUserIds.push(exact6Reg.data.user._id);

    // Verify login with exact 6 characters
    const exact6Login = await post('/auth/login', { email: exact6User.email, password: exact6Pass });
    check('Login with 6-char password succeeds (200)', exact6Login.status === 200 && verifyJwt(exact6Login.data?.token));

    const exact6Wrong = await post('/auth/login', { email: exact6User.email, password: '6charX' });
    check('Login with wrong 6-char password rejected (401)', exact6Wrong.status === 401);

    // 3.3 Passwords with spaces
    const spacePass = 'pass with spaces 123';
    const spaceUser = {
      name: 'Space Pass User',
      email: `spacepass_${runId}@zyntra.test`,
      username: `spacepass_${runId}`,
      password: spacePass,
    };
    const spaceReg = await post('/auth/register', spaceUser);
    check('Password with spaces succeeds registration (201)', spaceReg.status === 201);
    if (spaceReg.data?.user?._id) createdUserIds.push(spaceReg.data.user._id);

    const spaceLoginExact = await post('/auth/login', { email: spaceUser.email, password: spacePass });
    check('Login with exact spaced password succeeds (200)', spaceLoginExact.status === 200);

    const spaceLoginStripped = await post('/auth/login', { email: spaceUser.email, password: 'passwithspaces123' });
    check('Login with stripped spaces rejected (401)', spaceLoginStripped.status === 401);

    // 3.4 Very long passwords (100, 500, 1000 characters)
    const longPass100 = 'A'.repeat(100) + '!9z';
    const longUser100 = {
      name: 'Long Pass 100',
      email: `long100_${runId}@zyntra.test`,
      username: `long100_${runId}`,
      password: longPass100,
    };
    const longReg100 = await post('/auth/register', longUser100);
    check('103-char password succeeds registration (201)', longReg100.status === 201);
    if (longReg100.data?.user?._id) createdUserIds.push(longReg100.data.user._id);

    const longLogin100 = await post('/auth/login', { email: longUser100.email, password: longPass100 });
    check('Login with 103-char password succeeds (200)', longLogin100.status === 200);

    const longPass1000 = 'Z'.repeat(1000) + 'X1!';
    const longUser1000 = {
      name: 'Long Pass 1000',
      email: `long1000_${runId}@zyntra.test`,
      username: `long1000_${runId}`,
      password: longPass1000,
    };
    const longReg1000 = await post('/auth/register', longUser1000);
    check('1003-char password handled gracefully without crash (status 201)', longReg1000.status === 201);
    if (longReg1000.data?.user?._id) createdUserIds.push(longReg1000.data.user._id);

    const longLogin1000 = await post('/auth/login', { email: longUser1000.email, password: longPass1000 });
    check('Login with 1003-char password succeeds (200)', longLogin1000.status === 200);

    // ==================================================================
    // 4. DUPLICATE USER COLLISIONS (CASING, @HANDLE)
    // ==================================================================
    console.log('\n--- 4. Duplicate User Collisions & Casing Resolution ---');

    const baseCollUser = {
      name: 'Collision Base',
      email: `coll_base_${runId}@zyntra.test`,
      username: `coll_user_${runId}`,
      password: 'StrongPassword123!',
    };
    const baseReg = await post('/auth/register', baseCollUser);
    check('Base collision user registered successfully (201)', baseReg.status === 201);
    if (baseReg.data?.user?._id) createdUserIds.push(baseReg.data.user._id);

    // 4.1 Duplicate email with uppercase
    const dupEmailUpper = await post('/auth/register', {
      name: 'Collision Upper Email',
      email: `COLL_BASE_${runId.toUpperCase()}@ZYNTRA.TEST`,
      username: `coll_diff_u1_${runId}`,
      password: 'StrongPassword123!',
    });
    check('Duplicate email in UPPERCASE rejected with 400', dupEmailUpper.status === 400 && dupEmailUpper.data?.success === false);

    // 4.2 Duplicate email with whitespace
    const dupEmailSpace = await post('/auth/register', {
      name: 'Collision Whitespace Email',
      email: `  coll_base_${runId}@zyntra.test  `,
      username: `coll_diff_u2_${runId}`,
      password: 'StrongPassword123!',
    });
    check('Duplicate email with padded whitespace rejected with 400', dupEmailSpace.status === 400 && dupEmailSpace.data?.success === false);

    // 4.3 Duplicate username with uppercase
    const dupUserUpper = await post('/auth/register', {
      name: 'Collision Upper Username',
      email: `coll_diff_e1_${runId}@zyntra.test`,
      username: `COLL_USER_${runId.toUpperCase()}`,
      password: 'StrongPassword123!',
    });
    check('Duplicate username in UPPERCASE rejected with 400', dupUserUpper.status === 400 && dupUserUpper.data?.success === false);

    // 4.4 Duplicate username with @ prefix
    const dupUserHandle = await post('/auth/register', {
      name: 'Collision @Handle Username',
      email: `coll_diff_e2_${runId}@zyntra.test`,
      username: `@coll_user_${runId}`,
      password: 'StrongPassword123!',
    });
    check('Duplicate username with @prefix rejected with 400', dupUserHandle.status === 400 && dupUserHandle.data?.success === false);

    // 4.5 Duplicate username with @ prefix AND uppercase
    const dupUserHandleUpper = await post('/auth/register', {
      name: 'Collision @Handle Upper',
      email: `coll_diff_e3_${runId}@zyntra.test`,
      username: `@COLL_USER_${runId.toUpperCase()}`,
      password: 'StrongPassword123!',
    });
    check('Duplicate username with @prefix AND uppercase rejected with 400', dupUserHandleUpper.status === 400 && dupUserHandleUpper.data?.success === false);

    // 4.6 Login resolutions across all collision variants
    const loginUpperEmail = await post('/auth/login', { email: `COLL_BASE_${runId.toUpperCase()}@ZYNTRA.TEST`, password: 'StrongPassword123!' });
    check('Login with UPPERCASE email resolves correctly (200)', loginUpperEmail.status === 200 && loginUpperEmail.data?.success === true);

    const loginUpperUser = await post('/auth/login', { username: `COLL_USER_${runId.toUpperCase()}`, password: 'StrongPassword123!' });
    check('Login with UPPERCASE username resolves correctly (200)', loginUpperUser.status === 200 && loginUpperUser.data?.success === true);

    const loginHandle = await post('/auth/login', { username: `@coll_user_${runId}`, password: 'StrongPassword123!' });
    check('Login with @handle resolves correctly (200)', loginHandle.status === 200 && loginHandle.data?.success === true);

    const loginHandleUpper = await post('/auth/login', { username: `@COLL_USER_${runId.toUpperCase()}`, password: 'StrongPassword123!' });
    check('Login with @HANDLE (upper + prefix) resolves correctly (200)', loginHandleUpper.status === 200 && loginHandleUpper.data?.success === true);

    const loginPadded = await post('/auth/login', { emailOrUsername: `  @coll_user_${runId}  `, password: 'StrongPassword123!' });
    check('Login with padded whitespace + @handle resolves correctly (200)', loginPadded.status === 200 && loginPadded.data?.success === true);

    // ==================================================================
    // 5. CONCURRENT LOGIN AND REGISTRATION REQUESTS
    // ==================================================================
    console.log('\n--- 5. Concurrency & Race-Condition Probing ---');

    // 5.1 Ten concurrent registrations for the exact same credentials
    const concurrentEmail = `concurr_${runId}@zyntra.test`;
    const concurrentUsername = `concurr_${runId}`;
    const concurrentPass = 'RacePass123!';

    const regPromises = [];
    for (let i = 0; i < 10; i++) {
      regPromises.push(
        post('/auth/register', {
          name: `Concurrent User ${i}`,
          email: concurrentEmail,
          username: concurrentUsername,
          password: concurrentPass,
        })
      );
    }

    const regResults = await Promise.all(regPromises);
    const successCount = regResults.filter((r) => r.status === 201).length;
    const failureCount = regResults.filter((r) => r.status === 400).length;

    check('Concurrent registration: exactly ONE request succeeds with 201', successCount === 1, `success: ${successCount}`);
    check('Concurrent registration: other nine requests return 400', failureCount === 9, `failure: ${failureCount}`);

    // Verify in MongoDB Atlas directly that only 1 document exists
    const dbDocs = await User.find({ email: concurrentEmail });
    check('Database integrity: exactly 1 user document created in MongoDB Atlas', dbDocs.length === 1, `found: ${dbDocs.length}`);
    if (dbDocs[0]?._id) createdUserIds.push(dbDocs[0]._id);

    // 5.2 Ten concurrent logins for the same account
    const loginPromises = [];
    for (let i = 0; i < 10; i++) {
      loginPromises.push(
        post('/auth/login', {
          email: concurrentEmail,
          password: concurrentPass,
        })
      );
    }
    const loginResults = await Promise.all(loginPromises);
    const loginSuccessCount = loginResults.filter((r) => r.status === 200 && verifyJwt(r.data?.token)).length;
    check('Concurrent login: all 10 parallel logins succeed with 200 & valid JWT', loginSuccessCount === 10, `got: ${loginSuccessCount}`);

    // 5.3 Parallel profile updates on the same account
    const token = loginResults[0]?.data?.token;
    const updatePromises = [];
    for (let i = 0; i < 6; i++) {
      updatePromises.push(
        put('/auth/profile', {
          name: `Concurrent Name Update ${i}`,
          bio: `Bio version ${i}`,
        }, token)
      );
    }
    const updateResults = await Promise.all(updatePromises);
    const updateSuccessCount = updateResults.filter((r) => r.status === 200).length;
    check('Concurrent profile updates: all 6 complete cleanly without error (200)', updateSuccessCount === 6, `got: ${updateSuccessCount}`);

    // ==================================================================
    // 6. WORKPLACE CONTEXT PERSISTENCE
    // ==================================================================
    console.log('\n--- 6. Workplace Context Persistence & Edge Cases ---');

    // 6.1 Add multiple contexts sequentially
    const ctx1 = { id: `ctx_eng_${runId}`, type: 'workplace', name: 'Engineering', username: `concurr_${runId}.eng` };
    const ctx2 = { id: `ctx_design_${runId}`, type: 'workplace', name: 'Design Studio', username: `concurr_${runId}.design` };

    const addCtx1 = await post('/auth/context', ctx1, token);
    check('Add first context (Engineering) returns 200', addCtx1.status === 200);
    check('Context array has length >= 2', Array.isArray(addCtx1.data?.contexts) && addCtx1.data.contexts.length >= 2);

    const addCtx2 = await post('/auth/context', ctx2, token);
    check('Add second context (Design) returns 200', addCtx2.status === 200);
    check('Context array has length >= 3', Array.isArray(addCtx2.data?.contexts) && addCtx2.data.contexts.length >= 3);

    // 6.2 Duplicate context ID (Upsert behavior)
    const ctx1Updated = { id: `ctx_eng_${runId}`, type: 'workplace', name: 'Core Engineering Re-org', username: `concurr_${runId}.core` };
    const addCtx1Dup = await post('/auth/context', ctx1Updated, token);
    check('Re-adding duplicate context ID returns 200', addCtx1Dup.status === 200);
    const engMatches = addCtx1Dup.data?.contexts?.filter((c) => c.id === `ctx_eng_${runId}`);
    check('Duplicate context ID was replaced (exactly 1 instance)', engMatches?.length === 1);
    check('Updated context name reflected', engMatches?.[0]?.name === 'Core Engineering Re-org');

    // 6.3 Special characters in context names
    const specialCtx = {
      id: `ctx_spec_${runId}`,
      type: 'workplace',
      name: '🚀 Space Corp / "Quoted" & <script>alert(1)</script> / 日本語',
      username: `concurr_${runId}.space`,
    };
    const addSpecialCtx = await post('/auth/context', specialCtx, token);
    check('Add context with emojis, quotes, HTML-tags & unicode returns 200', addSpecialCtx.status === 200);

    // 6.4 Missing context fields validation
    const missingCtxFields = [
      { id: 'c1', type: 'workplace', name: 'N1' }, // missing username
      { id: 'c2', type: 'workplace', username: 'u2' }, // missing name
      { id: 'c3', name: 'N3', username: 'u3' }, // missing type
      { type: 'workplace', name: 'N4', username: 'u4' }, // missing id
    ];
    for (const mc of missingCtxFields) {
      const res = await post('/auth/context', mc, token);
      check(`Context missing fields rejected with 400`, res.status === 400 && res.data?.success === false);
    }

    // 6.5 Verify persistence to MongoDB Atlas directly & via GET /api/auth/me
    const meRes = await get('/auth/me', token);
    check('GET /api/auth/me returns 200', meRes.status === 200);
    const meContexts = meRes.data?.user?.contexts || [];
    const foundSpecial = meContexts.find((c) => c.id === `ctx_spec_${runId}`);
    check('Special characters context persisted and hydrated from DB in GET /api/auth/me', Boolean(foundSpecial));
    check('Special characters context name matched exactly', foundSpecial?.name === specialCtx.name);

    // Directly query MongoDB
    const directUserDoc = await User.findById(dbDocs[0]._id);
    const directFound = directUserDoc.contexts.find((c) => c.id === `ctx_spec_${runId}`);
    check('Direct MongoDB Atlas document contains persisted context', Boolean(directFound));

    // ==================================================================
    // 7. PROFILE UPDATES EDGE CASES
    // ==================================================================
    console.log('\n--- 7. Profile Updates Edge Cases ---');

    // 7.1 Long bio (500 chars)
    const longBio500 = 'Bio 500 chars: ' + '🌟'.repeat(200) + ' and more narrative text.';
    const updateBio500 = await put('/auth/profile', { bio: longBio500 }, token);
    check('Update bio with 500 characters returns 200', updateBio500.status === 200);
    check('Returned bio matches 500-char string', updateBio500.data?.user?.bio === longBio500);

    // 7.2 Very long bio (5000 chars)
    const longBio5000 = 'Bio 5000 chars: ' + 'A'.repeat(4980);
    const updateBio5000 = await put('/auth/profile', { bio: longBio5000 }, token);
    check('Update bio with 5,000 characters returns 200 without crashing', updateBio5000.status === 200);
    check('5,000-char bio persisted in response', updateBio5000.data?.user?.bio === longBio5000);

    // 7.3 Empty bio string
    const updateBioEmpty = await put('/auth/profile', { bio: '' }, token);
    check('Update bio with empty string returns 200', updateBioEmpty.status === 200);
    check('Bio updated to empty string (not reverting to default)', updateBioEmpty.data?.user?.bio === '');

    // 7.4 Unusual characters, newlines, tabs, emojis in bio
    const weirdBio = 'Line 1\nLine 2\tTabbed ✨🔥 "Double" \'Single\' & <tag>';
    const updateWeirdBio = await put('/auth/profile', { bio: weirdBio }, token);
    check('Update bio with newlines, tabs, emojis and quotes returns 200', updateWeirdBio.status === 200);
    check('Unusual characters bio retained verbatim', updateWeirdBio.data?.user?.bio === weirdBio);

    // 7.5 Phone number updates and persistence
    const testPhone = '+1 (555) 019-2834 ext. 42';
    const updatePhone = await put('/auth/profile', { phone: testPhone }, token);
    check('Update phone number returns 200', updatePhone.status === 200);
    check('Phone returned in response user object', updatePhone.data?.user?.phone === testPhone);

    // Hydration check via GET /api/auth/me
    const verifyMeProfile = await get('/auth/me', token);
    check('GET /api/auth/me reflects updated phone and weird bio',
      verifyMeProfile.data?.user?.phone === testPhone && verifyMeProfile.data?.user?.bio === weirdBio);

    // ==================================================================
    // 8. TEARDOWN & CLEANUP
    // ==================================================================
    console.log('\n--- 8. Cleanup & Teardown ---');
    console.log(`Cleaning up ${createdUserIds.length} test users from MongoDB Atlas...`);
    if (createdUserIds.length > 0) {
      const delRes = await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`Deleted ${delRes.deletedCount} user documents.`);
    }

  } catch (error) {
    console.error('CRITICAL UNHANDLED ERROR IN ADVERSARIAL SUITE:', error);
    testFailed++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('Test HTTP server closed.');
    }
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');

    console.log('\n====================================================');
    console.log(`📊 ADVERSARIAL SUITE SUMMARY: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log('====================================================');

    if (findings.length > 0) {
      console.log('\n⚠️ Findings / Failures:');
      findings.forEach((f, idx) => {
        console.log(`  ${idx + 1}. ${f.desc} - ${f.details}`);
      });
    }

    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runAdversarialSuite();
