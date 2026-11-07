# Backend Architecture & Feature Survey Report

**Explorer**: `teamwork_explorer_survey_2`  
**Role**: Codebase Explorer - Server Architecture & Backend Features  
**Date**: 2026-11-06  
**Scope**: Server architecture, MongoDB Atlas database, models, REST API endpoints, Socket.io real-time layer, test suites, and operational feature inventory.

---

## 1. Observation

### 1.1 Tech Stack & Configuration
- **Runtime & Module System**: Node.js v24.16.0 with native ECMAScript Modules (`"type": "module"` in `server/package.json:6`).
- **Core Frameworks & Libraries** (`server/package.json:13-26`):
  - `express`: `^4.21.2`
  - `socket.io`: `^4.8.1`
  - `mongoose`: `^8.13.0`
  - `bcryptjs`: `^3.0.3`
  - `jsonwebtoken`: `^9.0.2`
  - `multer`: `^2.4.0`
  - `cors`: `^2.8.5`
  - `morgan`: `^1.10.0`
  - `dotenv`: `^17.3.1`
  - `nodemon` (dev): `^3.1.9`
- **Server Entry Points**:
  - `server/src/server.js`: Instantiates HTTP server, creates Socket.io instance with CORS, connects to MongoDB Atlas via `connectDB()`, binds port 5000 (fallback configurable via `PORT`), and starts listening.
  - `server/src/app.js`: Configures Express application, CORS origins (`http://localhost:5173`, `http://localhost:5174`, `CLIENT_URL`), body parsing (`limit: '50mb'`), static uploads serving (`/uploads`), API route mounting (`/api/auth`, `/api/workspaces`, `/api/messages`, `/api/contacts`, `/api/upload`), SPA client fallback (`*`), and centralized error handler middleware.
- **Environment Configuration**:
  - `server/.env` and root `.env` contain:
    - `PORT=5000`
    - `NODE_ENV=development`
    - `MONGO_URI=mongodb+srv://naikpratyush76_db_user:MKl3mA5DGYnsUkIm@cluster0.ayg4rfb.mongodb.net/zyntra_db?retryWrites=true&w=majority`
    - `JWT_SECRET=zyntra_jwt_secret_dev_key_2026`
    - `JWT_EXPIRE=30d`
    - `CLIENT_URL=http://localhost:5173`

### 1.2 Database Architecture & Connection
- **Connection Logic** (`server/src/config/db.js:12-47`):
  - Uses `dns.setServers(['8.8.8.8', '1.1.1.1'])` to guarantee SRV DNS resolution for MongoDB Atlas across Windows network environments.
  - `connectDB(retries = 5, delay = 2000)` executes `mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000 })` with retry backoff.
  - Standby Fallback: `server/src/server.js:38-41` catches initial DB failure and allows the server to boot in standby mode without crashing.
- **Data Models** (`server/src/models/`):
  1. `User.js`:
     - Fields: `name`, `email` (unique, lowercase, validated), `primaryUsername` (unique, lowercase), `password` (bcrypt pre-save hook, min 6 chars, `select: false`), `avatar`, `avatarType`, `bio`, `contexts` (embedded `ContextSchema`), `status` (`online`, `away`, `offline`), `lastActive`.
  2. `Message.js`:
     - Fields: `id` (indexed, unique), `chatId` (indexed), `chatType` (`direct`, `personal-group`, `workspace-node`), `senderId`, `senderName`, `senderUsername`, `senderAvatar`, `content`, `type` (`text`, `image`, `file`, `system`), `attachment` (`type`, `name`, `size`, `url`), `reactions` (`[ReactionSchema]`: `emoji`, `count`, `users`), `isEdited`, `timestamp`.
  3. `Contact.js`:
     - `Contact`: `id` (indexed), `ownerId` (indexed), `name`, `username`, `avatar`, `status`, `lastMessage`, `lastMessageTime`, `bio`. Compound index: `{ ownerId: 1, username: 1 }`.
     - `PersonalGroup`: `id` (indexed, unique), `name`, `type`, `membersCount`, `lastMessage`, `lastMessageTime`, `description`, `creatorId`.
  4. `Workspace.js`:
     - Fields: `id` (indexed, unique), `name`, `rootNodeId`, `defaultNodeId`, `type`, `memberCount`, `owner` (ref `User`), `creatorName`, `contextualUsername`, `policy` (`emoji`, `reactions`, `editMessage`, `deleteMessage`, `title`), `members` (`[WorkspaceMemberSchema]`).
  5. `WorkspaceNode.js`:
     - Fields: `id` (indexed, unique), `workspaceId` (indexed), `name`, `parentId` (indexed, null for root), `children`, `memberCount`, `hasConversation`, `joinCode` (indexed, unique, uppercase), `description`, `createdBy` (ref `User`), `members` (`[MemberSchema]`).
- **Data Access Layer** (`server/src/services/storageService.js`):
  - Wraps Mongoose models with business logic, auto-linking reciprocal direct contacts upon DM transmission, sanitizing handles, formatting outputs, and seeding default organizations.

### 1.3 Complete REST API Endpoint Catalog

| Method | Endpoint | Auth Required | Controller Handler | Purpose & Implementation State |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | `app.js:52` | **Implemented & Sound**: Returns server health status, message, ISO timestamp. |
| `GET` | `/api/auth/diagnostic` | None | `authRoutes.js:15` | **Implemented & Sound**: Reports DB connection state, host, DB name, registered user list. |
| `POST` | `/api/auth/register` | None | `authController.js:22` | **Implemented & Sound**: Validates name/email/username/pwd (>=6 chars), hashes password via bcrypt, stores in Atlas, returns JWT + user. |
| `POST` | `/api/auth/login` | None | `authController.js:71` | **Implemented & Sound**: Authenticates via email or username + password, checks bcrypt hash, returns JWT + user. |
| `GET` | `/api/auth/me` | Bearer Token (`protect`) | `authController.js:113` | **Implemented & Sound**: Returns authenticated user profile and contexts. |
| `PUT` | `/api/auth/profile` | Bearer Token (`protect`) | `authController.js:124` | **Implemented & Sound**: Updates user profile (name, bio, avatar, phone) and updates associated messages & contacts. |
| `POST` | `/api/auth/context` | Bearer Token (`protect`) | `authController.js:135` | **Partially Implemented / Buggy**: Appends context to `req.user.contexts` in memory but **fails to call `user.save()` or `findByIdAndUpdate()`**; context updates do not persist across sessions. |
| `GET` | `/api/workspaces` | Optional Auth (`optionalProtect`) | `workspaceController.js:30` | **Implemented & Sound**: Lists workspaces with nested nodes/channels for sidebar rendering. |
| `GET` | `/api/workspaces/nodes` | Optional Auth | `workspaceController.js:96` | **Implemented & Sound**: Returns key-value dictionary of all nodes matching client store format. |
| `GET` | `/api/workspaces/:id/tree` | Optional Auth | `workspaceController.js:144` | **Implemented & Sound**: Returns tree dictionary for specific workspace hierarchy. |
| `POST` | `/api/workspaces` | Optional Auth | `workspaceController.js:194` | **Implemented & Sound**: Creates workspace, root node, and general channel with unique join codes. |
| `POST` | `/api/workspaces/:id/nodes` | Optional Auth | `workspaceController.js:313` | **Implemented & Sound**: Creates child channel/group under parent node, auto-generates join code, links parent. |
| `POST` | `/api/workspaces/:id/nodes/:nodeId/members` | Optional Auth | `workspaceController.js:396` | **Implemented & Sound**: Adds member list to channel/node. |
| `POST` | `/api/workspaces/nodes/:nodeId/members` | Optional Auth | `workspaceController.js:396` | **Implemented & Sound**: Alias endpoint for member addition without workspace ID in path. |
| `POST` | `/api/workspaces/join` | Optional Auth | `workspaceController.js:482` | **Implemented & Sound**: Joins channel/workspace by uppercase `joinCode`, increments member counts, registers user. |
| `POST` | `/api/workspaces/leave-parent-group` | Optional Auth | `workspaceController.js:582` | **Stubbed / Mock**: Returns static JSON payload acknowledging leave; does NOT modify node members or delete relations. |
| `GET` | `/api/messages/:chatId` | Optional Auth | `messageController.js:6` | **Implemented & Sound**: Fetches messages sorted by timestamp ascending for any chat channel or DM. |
| `POST` | `/api/messages/:chatId` | Optional Auth | `messageController.js:28` | **Implemented & Sound**: Persists message, links attachments, auto-creates reciprocal DM contacts if DM. |
| `PUT` | `/api/messages/:id` | Optional Auth | `messageController.js:80` | **Implemented & Sound**: Edits message content and marks `isEdited: true`. |
| `DELETE`| `/api/messages/:id` | Optional Auth | `messageController.js:110` | **Implemented & Sound**: Removes message from database by `id`. |
| `POST` | `/api/messages/:id/reactions`| Optional Auth | `messageController.js:129` | **Implemented & Sound**: Toggles emoji reaction with user tracking and count updates. |
| `GET` | `/api/contacts` | Optional Auth | `contactController.js:6` | **Implemented & Sound**: Returns user direct contacts (including dynamic DM partners) and personal groups. |
| `GET` | `/api/contacts/search` | Optional Auth | `contactController.js:27` | **Implemented & Sound**: Searches users across username, name, email regex excluding requesting user. |
| `POST` | `/api/contacts` | Optional Auth | `contactController.js:46` | **Implemented & Sound**: Adds direct contact relationship bidirectionally. |
| `POST` | `/api/contacts/groups` | Optional Auth | `contactController.js:82` | **Implemented & Sound**: Creates personal group chat with title, description, and initial creator. |
| `POST` | `/api/upload` | Public | `uploadRoutes.js:87` | **Implemented & Sound**: Multer multipart upload (25MB limit), writes to disk, returns `/uploads/...` URL. |
| `POST` | `/api/upload/file` | Public | `uploadRoutes.js:88` | **Implemented & Sound**: Alias endpoint for single file/photo upload. |

### 1.4 Real-time WebSocket Architecture (`server/src/sockets/chatSocket.js`)
- **Connection Authentication**:
  - `io.use(...)` middleware validates `socket.handshake.auth?.token` via `jwt.verify()`.
  - Rejects unauthorized handshakes with `Authentication error: No token provided` or `Invalid token`.
- **WebSocket Event Catalog**:

| Event Name | Direction | Payload | Server Action & Broadcast Behavior | Status |
| :--- | :--- | :--- | :--- | :--- |
| `join_room` | Client &rarr; Server | `roomId` (string) | Calls `socket.join(roomId)`. Logs joining user. | **Sound** |
| `leave_room` | Client &rarr; Server | `roomId` (string) | Calls `socket.leave(roomId)`. Logs room exit. | **Sound** |
| `send_message` | Client &rarr; Server | `{ id, chatId, content, senderId, senderName, senderUsername, senderAvatar, chatType, attachment, timestamp }` | Saves message to MongoDB Atlas via `storageService.saveMessage()` and emits `receive_message` to `socket.to(chatId)` (all other room participants). | **Sound** |
| `receive_message` | Server &rarr; Client | Saved message object | Broadcasted to room peers upon new message. | **Sound** |
| `typing_start` | Client &rarr; Server | `{ roomId, userName, userId }` | Emits `user_typing` `{ userId, userName, isTyping: true }` to `socket.to(roomId)`. | **Sound** |
| `typing_stop` | Client &rarr; Server | `{ roomId, userId }` | Emits `user_typing` `{ userId, isTyping: false }` to `socket.to(roomId)`. | **Sound** |
| `user_typing` | Server &rarr; Client | `{ userId, userName, isTyping }` | Real-time typing bubble trigger. | **Sound** |
| `send_reaction` | Client &rarr; Server | `{ messageId, emoji, userId, chatId }` | Saves reaction via `storageService.addReaction()` and broadcasts `update_reaction` to `io.to(chatId)`. | **Sound** |
| `update_reaction` | Server &rarr; Client | Updated message object | Broadcasted to all room members to update badge count. | **Sound** |

### 1.5 Automated Test Suites Execution & Verification
Two automated test suites exist and were executed directly:
1. `npm test --prefix server` (`server/src/scripts/test-api-http.js`):
   - Starts HTTP server on port 5055, connects to MongoDB Atlas, and runs 23 REST API integration assertions.
   - Result: `HTTP API SUITE COMPLETE: 23 PASSED, 0 FAILED`. Exit code `0`.
2. `node src/scripts/verify-all.js` (`server/src/scripts/verify-all.js`):
   - Tests model operations directly against Atlas: registration, password hashing, duplicate constraints, profile updates, workplace contexts, workspace hierarchy trees, messaging, reactions, edits, contacts, and personal groups.
   - Result: `VERIFICATION COMPLETE: 25 PASSED, 0 FAILED`. Exit code `0`.

---

## 2. Logic Chain

1. **Database & Connection**:
   - Inspection of `server/src/config/db.js:12-47` and `server/src/server.js:34-41` shows that MongoDB Atlas connection uses Google/Cloudflare DNS servers (`8.8.8.8`, `1.1.1.1`) to resolve SRV records on Windows.
   - Both verification suites successfully connected to `ac-gejaxay-shard-00-00.ayg4rfb.mongodb.net` and `ac-gejaxay-shard-00-01.ayg4rfb.mongodb.net` and executed all database operations cleanly.
   - Conclusion: The database connection setup, migrations/schemas, and model layer are fully operational.

2. **Authentication & Authorization**:
   - `authController.js:22-111` enforces email and username sanitization, uniqueness checks, bcrypt password hashing, and signed JWT issuance with a 30-day expiry.
   - `test-api-http.js` confirmed that valid registration returns HTTP 201 with a valid JWT token, duplicate registration is rejected with HTTP 400, correct credentials return HTTP 200, and incorrect credentials return HTTP 401.
   - Conclusion: User registration and login functionality are robust and operating as intended.

3. **Context Management Defect**:
   - In `authController.js:135-150`, `addContext` executes:
     ```javascript
     const user = req.user;
     const contexts = user.contexts || [];
     const filtered = contexts.filter((c) => c.id !== id);
     filtered.push({ id, type, name, username });
     user.contexts = filtered;
     res.status(200).json({ success: true, contexts: user.contexts });
     ```
   - Notice that neither `user.save()` nor `User.findByIdAndUpdate()` is invoked. The change is made purely to the transient in-memory request object and lost on subsequent requests.
   - Conclusion: The `POST /api/auth/context` endpoint is partially implemented / defective.

4. **Vite Development Proxy Asset Delivery Gap**:
   - In `client/vite.config.js:14-22`:
     ```javascript
     proxy: {
       '/api': { target: 'http://localhost:5000', changeOrigin: true },
       '/socket.io': { target: 'http://localhost:5000', ws: true }
     }
     ```
   - In `server/src/app.js:45`: static files are mounted at `/uploads`.
   - In `server/src/routes/uploadRoutes.js:63`: uploads return `/uploads/${req.file.filename}`.
   - In `client/src/api/api.js:5-11`: `getFileUrl` prepends `API_BASE` (empty string).
   - Because `/uploads` is not registered in the Vite proxy table, requests to uploaded files return 404 in local development mode (`npm run dev`) when the client runs on port 5173.
   - In production mode, where Express serves both the built client and `/uploads`, it succeeds.
   - Conclusion: Local development file preview has an operational defect caused by the missing Vite proxy rule.

5. **Workspace Tree & Channel Management**:
   - `workspaceController.js` and `storageService.js` maintain parent-child relationships across `WorkspaceNode` records.
   - When a workspace is created (`POST /api/workspaces`), a root node and a general default channel are generated with distinct uppercase join codes.
   - Channels can be joined via `POST /api/workspaces/join` by supplying the join code, which properly updates membership and increments `memberCount`.
   - `leaveParentGroup` (`POST /api/workspaces/leave-parent-group`) is a stub returning a static confirmation without database mutation.

6. **Direct Messaging & Automatic Contact Linking**:
   - `storageService.js:192-237` automatically discovers the participants of a canonical DM (`dm_user1_user2`) and creates reciprocal `Contact` entries for both users with `lastMessage` and `lastMessageTime`.
   - This ensures both participants immediately see the conversation in their personal sidebar without requiring an explicit friend request / acceptance handshake.

---

## 3. Caveats

1. **No External Notification Push Engine**: WebSockets handle in-app real-time messaging, but there is no third-party push notification service (e.g., Web Push, FCM) or email notification system configured.
2. **Local Disk Storage for Uploads**: Uploaded attachments are saved to local filesystem `server/uploads/` rather than cloud object storage (e.g., AWS S3, Cloudinary). If deployed across multiple stateless container instances, uploads would not be shared across pods without persistent volume claims.
3. **Unbounded Chat History Queries**: `Message.find({ chatId }).sort({ timestamp: 1 })` returns all messages for a given chat room without cursor-based or limit/offset pagination. For very long conversations, this could lead to memory and latency overhead.
4. **Permissive CORS & Missing Rate Limiting**: The server currently allows all origins in development and has no Express rate limiting (`express-rate-limit`) on login/registration endpoints.

---

## 4. Conclusion & Feature Recommendations

### 4.1 Feature Status Summary

| Backend Feature Area | Operational Status | Production Readiness | Audit Recommendation |
| :--- | :--- | :--- | :--- |
| **User Registration & Login** | **Fully Functional** | Ready | **Keep**: Core requirement; fully passing end-to-end integration tests. |
| **Profile Management & Avatar** | **Fully Functional** | Ready | **Keep**: Profile updates correctly cascade to contact lists and message history. |
| **Context Switching (`/context`)** | **Defective (In-memory only)** | Needs Fix | **Keep & Fix**: Add `await User.findByIdAndUpdate()` so contexts persist. |
| **Workspace & Channel Hierarchy** | **Fully Functional** | Ready | **Keep**: Unique differentiator (multi-level tree, distinct join codes). |
| **Join Channel by Code** | **Fully Functional** | Ready | **Keep**: Fully tested and working end-to-end. |
| **Leave Parent Group** | **Stub / Mock** | Incomplete | **Keep or Formalize**: Wire DB removal or hide button until implemented. |
| **Direct Messaging & DM Sync** | **Fully Functional** | Ready | **Keep**: Reciprocal contact creation makes DM discovery seamless. |
| **Personal Groups** | **Fully Functional** | Ready | **Keep**: Working group chat system. |
| **Message Reactions** | **Fully Functional** | Ready | **Keep**: Supports toggle, real-time Socket broadcast, and persistence. |
| **Message Edit & Delete** | **Fully Functional** | Ready | **Keep**: Fully implemented and tested. |
| **File & Photo Uploads** | **Functional** (Dev proxy flaw) | Needs Config Fix | **Keep & Fix**: Add `'/uploads'` to Vite dev proxy table. |
| **Typing Indicators** | **Fully Functional** | Ready | **Keep**: Real-time Socket.io events with zero latency. |
| **Friend Request Handshake** | **Non-Existent** | Design Decision | **Remove / Keep Direct**: Direct contacts with username search is already simpler and functional. |
| **Read Receipts (`readBy`)** | **Non-Existent** | Not in Schema | **Remove / Defer**: Beyond project scope; simple timestamps suffice. |

---

## 5. Verification Method

### 5.1 Automated Command Verification
Run the following commands from the project root (`d:\PROJECTS\Zyntra_Chat_Application`):

1. **Run HTTP REST API Integration Test Suite**:
   ```powershell
   npm test --prefix server
   ```
   *Expected Output*: `HTTP API SUITE COMPLETE: 23 PASSED, 0 FAILED`.

2. **Run MongoDB Atlas Verification Suite**:
   ```powershell
   powershell -Command "cd server; node src/scripts/verify-all.js"
   ```
   *Expected Output*: `VERIFICATION COMPLETE: 25 PASSED, 0 FAILED`.

3. **Start Server Locally**:
   ```powershell
   npm run server
   ```
   *Expected Output*:
   - `[MongoDB Atlas] Connected successfully to host: ...`
   - `🚀 Zyntra Backend Server running on port 5000`
   - `📡 Socket.io ready for realtime communication`

4. **Verify Health Endpoint**:
   ```powershell
   curl http://localhost:5000/api/health
   ```
   *Expected Output*: `{"status":"ok","message":"Zyntra backend API is active & healthy", ...}`.

### 5.2 Specific Files to Inspect for Audit
- `server/src/controllers/authController.js:135-150`: Inspect `addContext` missing persistence call.
- `server/src/controllers/workspaceController.js:582-603`: Inspect `leaveParentGroup` mock stub.
- `client/vite.config.js:13-23`: Inspect missing `/uploads` proxy rule.
- `server/src/services/storageService.js:192-237`: Inspect DM reciprocal contact linking logic.
