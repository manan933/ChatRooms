# Auth & Registration Subsystem Investigation Report

**Explorer**: `teamwork_explorer_survey_1_gen2`  
**Role**: Codebase Explorer - Auth & Registration Subsystem (Replacement)  
**Date**: 2026-11-06  
**Scope**: Client authentication UI (`AuthPage.jsx`), Zustand auth store (`authStore.js`), HTTP client (`api.js`), WebSocket auth (`socket.js`), server auth routes (`authRoutes.js`), controller (`authController.js`), data model (`User.js`), storage layer (`storageService.js`), auth middleware (`auth.js`), edge cases, and automated test execution.

---

## 1. Observation

### 1.1 Client Registration Workflow & State Handling
- **UI Entry Point (`client/src/pages/AuthPage.jsx`)**:
  - Manages tab switching between "Sign In" and "Create Account" via local boolean state `isRegister` (`AuthPage.jsx:6, 166-195`).
  - Registration form fields (`AuthPage.jsx:9-14, 206-275`):
    - Full Name (`name` state)
    - Username (`username` state)
    - Email address (`email` state)
    - Password (`password` state, with show/hide toggle via `showPassword` state)
  - Form submission handler (`AuthPage.jsx:24-38`):
    ```javascript
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (isRegister) {
        if (!name.trim() || !email.trim() || !password || !username.trim()) return;
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          primaryUsername: username.trim(),
        });
      } else {
        if (!email.trim() || !password) return;
        await login(email.trim(), password);
      }
    };
    ```
  - **Field Mapping**: In `AuthPage.jsx:32`, the client maps the UI input `username` to the payload field `primaryUsername: username.trim()`.

- **Client Store Handling (`client/src/store/authStore.js:84-125`)**:
  ```javascript
  register: async ({ name, email, password, primaryUsername }) => {
    set({ isLoading: true, error: null });
    const cleanUsername = primaryUsername.replace(/^@/, '').toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    try {
      const res = await api.auth.register({
        name: name.trim(),
        email: cleanEmail,
        password,
        primaryUsername: cleanUsername,
      });

      if (res.ok && res.data) {
        const token = res.data.token;
        const user = res.data.user || res.data;

        if (token) localStorage.setItem('zyntra_token', token);
        if (user) localStorage.setItem('zyntra_user', JSON.stringify(user));

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          promptWorkspaceOnLogin: true,
        });

        socketService.connect();
        return { success: true };
      }

      const errorMsg = res.error || res.data?.message || 'Registration failed';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    } catch (err) {
      const errorMsg = err.message || 'Registration failed. Please check your connection.';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },
  ```
  - Upon successful registration (HTTP 201), the JWT token is persisted to `localStorage.getItem('zyntra_token')`, the sanitized user profile to `localStorage.getItem('zyntra_user')`, Zustand state is updated with `isAuthenticated: true`, `promptWorkspaceOnLogin: true` is set, and `socketService.connect()` is called.
  - Upon error, `error` state is updated, rendering an alert badge (`AuthPage.jsx:198-203`).

### 1.2 Client Login Workflow & Auto-fill Helper
- **UI Form (`AuthPage.jsx:239-275`)**:
  - The login form presents an "Email or username" input (`placeholder="soumya@zyntra.com or username"`) and a password field.
  - Demo Quick-fill button (`AuthPage.jsx:17-22, 293-306`):
    ```javascript
    const handleFillDemo = () => {
      setIsRegister(false);
      clearError();
      setEmail('soumya@zyntra.com');
      setPassword('password123');
    };
    ```
- **Login Action (`authStore.js:48-82`)**:
  - Dispatches `api.auth.login({ email, password })`.
  - On HTTP 200: caches `zyntra_token` and `zyntra_user` in `localStorage`, updates Zustand `isAuthenticated: true`, triggers `socketService.connect()`, and sets `promptWorkspaceOnLogin: true`.

### 1.3 Token Storage, HTTP Requests & WebSocket Handshake
1. **HTTP Requests (`client/src/api/api.js:3, 13-20`)**:
   ```javascript
   const getToken = () => localStorage.getItem('zyntra_token');

   export async function request(endpoint, options = {}) {
     const token = getToken();
     const headers = {
       ...(options.isFormData ? {} : { 'Content-Type': 'application/json' }),
       ...(token ? { Authorization: `Bearer ${token}` } : {}),
       ...options.headers,
     };
     ...
   ```
   Every HTTP request automatically reads `zyntra_token` from `localStorage` and appends `Authorization: Bearer <token>`.
2. **WebSocket Handshake (`client/src/api/socket.js:14-22`)**:
   ```javascript
   const token = localStorage.getItem('zyntra_token');

   this.socket = io(SOCKET_URL, {
     transports: ['websocket', 'polling'],
     reconnection: true,
     reconnectionAttempts: 10,
     reconnectionDelay: 1000,
     auth: { token },
   });
   ```
   Passes `auth: { token }` which is authenticated on the server in `server/src/sockets/chatSocket.js:15`:
   `const token = socket.handshake.auth?.token;`

### 1.4 Session Recovery & Page Reload (`auth.me`)
- **Initial Store State (`authStore.js:6-18`)**:
  ```javascript
  const getInitialUser = () => {
    try {
      const cached = localStorage.getItem('zyntra_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  export const useAuthStore = create((set, get) => ({
    user: getInitialUser(),
    token: localStorage.getItem('zyntra_token') || null,
    isAuthenticated: Boolean(localStorage.getItem('zyntra_token') && getInitialUser()),
    ...
  ```
  `isAuthenticated` is initialized synchronously from `localStorage`. In `client/src/App.jsx:14-16`, `{isAuthenticated ? <ChatPage /> : <AuthPage />}`, preventing flash of login page on refresh.
- **Session Verification (`authStore.js:24-46`)**:
  ```javascript
  initAuth: async () => {
    const token = localStorage.getItem('zyntra_token');
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null, isLoading: false });
      return;
    }

    try {
      const res = await api.auth.me();
      if (res.ok && res.data) {
        const user = res.data.user || res.data;
        localStorage.setItem('zyntra_user', JSON.stringify(user));
        set({ user, isAuthenticated: true, error: null });
        socketService.connect();
      } else if (res.status === 401 || !res.ok) {
        get().logout();
      }
    } catch (e) {
      console.error('initAuth failed', e);
    } finally {
      set({ isLoading: false });
    }
  },
  ```
  `App.jsx:9-11` calls `initAuth()` in `useEffect`. If `GET /api/auth/me` returns 200, user state is synced and socket is re-established. If 401 or expired, `logout()` wipes local storage and renders `AuthPage`.

### 1.5 Server Auth Handling & Database Models
1. **User Schema (`server/src/models/User.js:14-98`)**:
   - `name`: Required, trimmed.
   - `email`: Required, unique, lowercase, trimmed, validated via regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
   - `primaryUsername`: Required, unique, lowercase, trimmed.
   - `password`: Required, minlength 6, `select: false` (omitted from queries by default).
   - `contexts`: Array of `ContextSchema` (`[{ id, type, name, username }]`).
   - `pre('save')` hook (`User.js:84-91`): Generates bcrypt salt (`salt = await bcrypt.genSalt(10)`) and hashes password before persisting.
   - `matchPassword` method (`User.js:94-96`): Compares plain password with bcrypt hash via `bcrypt.compare`.
2. **Registration Controller (`server/src/controllers/authController.js:22-69`)**:
   - Validates `!name || !email || !primaryUsername || !password`.
   - Rejects passwords with `password.length < 6` (HTTP 400).
   - Normalizes `cleanUsername = primaryUsername.replace(/^@/, '').toLowerCase().trim()`.
   - Normalizes `cleanEmail = email.toLowerCase().trim()`.
   - Delegates creation to `storageService.createUser`:
     - Checks existing user with `$or: [{ email: cleanEmail }, { primaryUsername: cleanUsername }]`.
     - Automatically creates default personal context: `[{ id: 'ctx-personal', type: 'personal', name: 'Personal', username: `${cleanUsername}.personal` }]`.
   - Generates JWT token (`jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' })`).
   - Returns HTTP 201 with `{ success: true, token, user }`.
3. **Login Controller (`server/src/controllers/authController.js:71-111`)**:
   - Accepts identifier from `{ email, username, emailOrUsername }`.
   - Cleans identifier: `cleanIdentifier = rawIdentifier.toLowerCase().trim().replace(/^@/, '')`.
   - Resolves user by calling `storageService.findUserByEmail(cleanIdentifier)` with fallback to `storageService.findUserByUsername(cleanIdentifier)`.
   - Checks password match via `storageService.verifyPassword(password, user.password)`.
   - Returns HTTP 200 with JWT and formatted user object.
   - Rejects non-existent users with 401 (`Invalid credentials. User not found.`).
   - Rejects incorrect passwords with 401 (`Invalid credentials. Password incorrect.`).

### 1.6 Identified Edge Cases, Inconsistencies & Bugs
1. **`primaryUsername` vs. `username` Field Inconsistency (Server & Store)**:
   - In `server/src/controllers/authController.js:25-29`:
     ```javascript
     const { name, email, primaryUsername, password, avatar, bio } = req.body || {};
     if (!name || !email || !primaryUsername || !password) {
       return res.status(400).json({ success: false, message: 'Please provide name, email, username, and password.' });
     }
     ```
     - Direct observation: The error message asks the client for `username`, but line 25 strictly checks `!primaryUsername` without fallback (`primaryUsername || username`).
     - Empirical verification: Passing `{ name, email, username: 'alex', password: 'password123' }` returns HTTP 400: `"Please provide name, email, username, and password."` even though `username` was provided.
     - In `client/src/store/authStore.js:84-86`:
       ```javascript
       register: async ({ name, email, password, primaryUsername }) => {
         const cleanUsername = primaryUsername.replace(/^@/, '').toLowerCase().trim();
       ```
       If an API caller or refactored component passes `{ username }` instead of `{ primaryUsername }`, calling `.replace` on `undefined` throws an uncaught `TypeError: Cannot read properties of undefined (reading 'replace')`.
2. **Context Persistence Bug (`authController.addContext`)**:
   - Location: `server/src/controllers/authController.js:135-150`:
     ```javascript
     export const addContext = async (req, res, next) => {
       try {
         const { id, type, name, username } = req.body;
         if (!id || !type || !name || !username) {
           return res.status(400).json({ success: false, message: 'Context requires id, type, name, and username' });
         }
         const user = req.user;
         const contexts = user.contexts || [];
         const filtered = contexts.filter((c) => c.id !== id);
         filtered.push({ id, type, name, username });
         user.contexts = filtered;
         res.status(200).json({ success: true, contexts: user.contexts });
       } catch (error) { ... }
     };
     ```
     - Direct observation: `user.contexts = filtered;` mutates the in-memory user document on `req.user`, but **never executes `await user.save()` or `findByIdAndUpdate()`**.
     - Result: Added contexts are never persisted to MongoDB Atlas and disappear upon page refresh or re-login.
3. **`authStore.updateProfile` Argument Truncation**:
   - Location: `client/src/store/authStore.js:127-130`:
     ```javascript
     updateProfile: async ({ name, avatar }) => {
       try {
         const res = await api.auth.updateProfile({ name, avatar });
     ```
     - In `client/src/components/modals/SettingsModal.jsx:129-134`:
       The Settings Modal sends `{ name, avatar, bio, phone }`.
     - In `server/src/controllers/authController.js:126-128`:
       The server controller accepts `{ name, bio, avatar, phone }`.
     - Result: `authStore` deconstructs only `{ name, avatar }`, silently dropping `bio` and `phone`.

### 1.7 Automated Test Execution Results
Two test suites were executed directly against the live MongoDB Atlas cluster:
1. **HTTP REST API Integration Suite (`npm test --prefix server` / `server/src/scripts/test-api-http.js`)**:
   - Total Tests: 23
   - Passed: 23, Failed: 0 (Exit code: 0)
   - Verified:
     - `POST /api/auth/register` returns 201 + valid JWT + `primaryUsername`.
     - Duplicate registration returns 400 + descriptive error message.
     - `POST /api/auth/login` returns 200 + valid JWT token.
     - Bad login (invalid password) returns 401.
     - `GET /api/auth/me` with Bearer token returns 200 + matches user record.
     - `PUT /api/auth/profile` updates profile in database and returns 200.
     - Workspaces, Channels, Messages, Reactions, and Contacts pass integration assertions.
2. **Backend Full Model Verification Suite (`node server/src/scripts/verify-all.js`)**:
   - Total Tests: 25
   - Passed: 25, Failed: 0 (Exit code: 0)
   - Verified:
     - User account creation in Atlas with bcrypt password hash.
     - Password verification via `matchPassword` succeeds with correct password and rejects invalid password.
     - Unique constraints on MongoDB Atlas properly reject duplicate `email` and duplicate `primaryUsername`.
     - User profile updates and context array updates persist cleanly.
3. **Targeted Edge Case Probes (`node -e "..."`)**:
   - Verified live demo user `soumya@zyntra.com` / `password123`:
     - `findUserByUsername('soumya')`: found (`true`).
     - `findUserByUsername('@soumya')`: found (`true`, leading `@` stripped).
     - `findUserByUsername('SOUMYA')`: found (`true`, lowercase normalized).
     - `verifyPassword('password123')`: `true`.
     - `verifyPassword('wrong')`: `false`.
   - Verified `authController.register` validation:
     - Missing `primaryUsername` (sending `username`): status 400 (`Please provide name, email, username, and password.`).
     - Short password (< 6 chars): status 400 (`Password must be at least 6 characters long.`).

---

## 2. Logic Chain

1. **Authentication Readiness & Integrity**:
   - Based on Section 1.5 and 1.7, user registration and login are fully wired to the live MongoDB Atlas database (`cluster0.ayg4rfb.mongodb.net/zyntra_db`).
   - Registration creates a secure record, generates a bcrypt hash with 10 salt rounds, sets up a default personal context, and issues a 30-day JWT signed with `JWT_SECRET`.
   - Login accepts email, username, or identifier with `@` prefix, performs case-insensitive search, compares bcrypt hashes, and returns the JWT.
   - Both test suites (`test-api-http.js` and `verify-all.js`) executed with 100% pass rates (48 total passed assertions, 0 failures).

2. **Client-Server Contract Consistency**:
   - In `AuthPage.jsx:32`, the UI assigns `primaryUsername: username.trim()` when calling `authStore.register`.
   - In `authStore.js:94`, the store forwards `primaryUsername: cleanUsername` to `/api/auth/register`.
   - In `authController.js:25`, the server reads `primaryUsername`.
   - Because the client form explicitly uses `primaryUsername`, client registration works end-to-end.
   - However, because the server error message says `Please provide name, email, username, and password` while only accepting `primaryUsername`, any client or automated test sending `{ username }` will fail. Adding `const rawUsername = primaryUsername || username;` eliminates this vulnerability.

3. **Session Lifecycle & Persistence**:
   - The token is safely saved in `localStorage.getItem('zyntra_token')`.
   - `api.js` automatically injects the `Authorization: Bearer <token>` header on all API calls.
   - `socket.js` automatically includes the token in `auth: { token }` for real-time WebSocket connection.
   - On page refresh, `authStore` initializes synchronously from local storage and dispatches `api.auth.me()` to validate the session against the database. If the token is invalid or expired, `logout()` cleans the state and returns to `AuthPage`.

4. **Identified Deficiencies to Address**:
   - Context updates (`addContext`) do not save to database due to missing `await user.save()` in `authController.js:145`.
   - User profile updates via `authStore.updateProfile` drop `bio` and `phone` because only `{ name, avatar }` are destructured in `authStore.js:127`.

---

## 3. Caveats

1. **No OAuth / Third-Party Social Auth**: The application only supports username/email and password credentials. Google/GitHub OAuth is not configured.
2. **No Password Reset / Forgot Password Flow**: There is currently no endpoint or UI for email verification, password reset tokens, or OTPs.
3. **Client-Side Form Validation**: While `AuthPage.jsx` checks for empty fields, it relies on HTML5 `type="email"` for email format validation and does not implement real-time password strength indicators or live username availability checks before submit.

---

## 4. Conclusion

The Login and Registration subsystem is **fully functional and operational end-to-end** across client and server:
- New users can register with full name, email, username, and password. Records are correctly created in MongoDB Atlas with bcrypt password hashes and initial personal contexts.
- Existing users can log in using either email or username (with or without `@` prefix, case-insensitive).
- Authentication tokens (JWT) are properly stored in `localStorage`, attached as Bearer tokens to all REST API calls, and supplied during Socket.IO handshakes.
- Page refresh and session recovery via `GET /api/auth/me` maintain uninterrupted user sessions.
- **Recommendations for implementer**:
  1. In `server/src/controllers/authController.js:25`: Support both `primaryUsername` and `username` aliases:
     `const rawUsername = primaryUsername || username;`
  2. In `client/src/store/authStore.js:84-86`: Support fallback:
     `const targetUsername = primaryUsername || username || '';`
  3. In `server/src/controllers/authController.js:145`: Add `await User.findByIdAndUpdate(user._id, { contexts: filtered });` so added contexts persist across reloads.
  4. In `client/src/store/authStore.js:127`: Update signature to `updateProfile: async ({ name, bio, avatar, phone }) =>` and pass all 4 fields to `api.auth.updateProfile`.

---

## 5. Verification Method

To independently verify these findings, run the following commands from the project root:

1. **Run Server HTTP API Test Suite**:
   ```powershell
   npm test --prefix server
   ```
   *Expected outcome*: 23 passed, 0 failed. Verifies registration, duplicate rejection, login, invalid password rejection, `GET /api/auth/me`, and `PUT /api/auth/profile`.

2. **Run Full Backend Verification Suite**:
   ```powershell
   node server/src/scripts/verify-all.js
   ```
   *Expected outcome*: 25 passed, 0 failed. Verifies database connectivity, bcrypt password hashing, duplicate constraints, and profile operations.

3. **Verify AuthController Validation Edge Cases**:
   ```powershell
   node -e "import('./server/src/controllers/authController.js').then(async ({ register }) => { const req = { body: { name: 'A', email: 'a@b.com', username: 'alex', password: 'password123' } }; const res = { status(c) { this.c = c; return this; }, json(d) { console.log('Status:', this.c, 'Msg:', d.message); } }; await register(req, res, ()=>{}); process.exit(0); });"
   ```
   *Expected outcome*: Demonstrates the `username` vs `primaryUsername` 400 rejection behavior.

4. **Files to Inspect**:
   - `client/src/pages/AuthPage.jsx` (lines 24-38)
   - `client/src/store/authStore.js` (lines 24-125)
   - `server/src/controllers/authController.js` (lines 22-111, 135-150)
   - `server/src/services/storageService.js` (lines 35-105)
