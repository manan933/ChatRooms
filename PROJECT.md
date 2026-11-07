# Project: Zyntra Chat Application - Auth Fix, Feature Audit & Recommendations

## Architecture
Zyntra is a modern team and personal communication application composed of:
- **Server**: Node.js ES Modules, Express 4.21.2 REST API, Socket.io 4.8.1 real-time WebSocket server, Mongoose 8.13.0 ORM connected to MongoDB Atlas (`zyntra_db` on `cluster0.ayg4rfb.mongodb.net`), Multer file uploads to `/uploads`.
- **Client**: React 19.2.8, Vite 8.3.0, Tailwind CSS v4.3.3, Zustand 5.0.15 state management, Socket.io-client 4.8.3, Web Audio API sound synthesis.
- **Data Flow**:
  - Client state stores (`authStore`, `chatStore`, `themeStore`) coordinate with backend REST API (`/api/*`) via `client/src/api/api.js`.
  - Real-time events (messages, typing indicators, emoji reactions) are synchronized peer-to-peer across rooms via `client/src/api/socket.js` and `server/src/sockets/chatSocket.js`.
  - Uploaded files are served statically from `server/uploads/` mounted at `/uploads`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | User Registration | Create account with Name, Email, Username, Password in MongoDB Atlas with bcrypt hash and default context | M1 | Survey |
| 2 | User Login | Authenticate with Email/Username + Password, verify bcrypt hash, issue 30-day JWT | M1 | Survey |
| 3 | Session Persistence & Recovery | Cache JWT & user profile in localStorage; verify session on reload via `GET /api/auth/me` | M1 | Survey |
| 4 | User Profile Management | Update Name, Bio, Avatar, Phone via `PUT /api/auth/profile` and propagate to store | M1 | Survey |
| 5 | Workplace Context Switching | Add and switch organizational/personal contexts via `POST /api/auth/context` (fixed to persist to DB) | M1 | Survey |
| 6 | Dev Server Asset Proxy | Vite proxy table mapping `/uploads` to backend port 5000 for previewing uploaded media | M1 | Survey |
| 7 | Dependency Footprint Hygiene | Removal of unused ghost dependencies (`react-router-dom`, `framer-motion`, `react-hook-form`) and clean puppeteer placement | M1 | Survey |
| 8 | Workspace Hierarchy Management | Create workspace, list workspaces, browse tree hierarchy of parent nodes and child channels | M2 | Survey |
| 9 | Channel Join via Code | Join workspace or channel using unique uppercase join code | M2 | Survey |
| 10 | Channel Member Management | Add members to workspace channels via API | M2 | Survey |
| 11 | Direct Messaging (DM) | Bidirectional direct chat between users with automatic reciprocal contact creation | M2 | Survey |
| 12 | Personal Group Chats | Create and participate in multi-user personal group conversations | M2 | Survey |
| 13 | Real-Time Message Streaming | Emit and receive messages instantly via Socket.io `send_message` / `receive_message` | M2 | Survey |
| 14 | In-Chat Message Search | Filter and search messages within active conversation in real time | M2 | Survey |
| 15 | Message Reactions | Add/remove emoji reactions to messages with real-time room broadcast | M2 | Survey |
| 16 | Message Editing & Deletion | In-place edit of sent messages with `isEdited` badge, and deletion of sent messages | M2 | Survey |
| 17 | File & Photo Attachments | Upload and share photos, PDFs, and files with inline previews and fullscreen lightbox | M2 | Survey |
| 18 | Real-Time Typing Indicators | Broadcast typing state with 2-second debounce across room participants | M2 | Survey |
| 19 | Contact Live Search | Search users across the database by name, email, or username | M2 | Survey |
| 20 | Web Audio Sound Effects | Synthesized UI audio chimes for messages, alerts, and navigation | M2 | Survey |
| 21 | Theme & Accent Customization | Dark Obsidian vs. Clean Light mode, 5 accent palettes, chat wallpapers, font scale | M2 | Survey |
| 22 | Mock / Incomplete Features Audit | Audit stubs: CallModal (WebRTC stub), Leave Parent Group stub, Settings password/sessions stubs | M2 | Survey |
| 23 | Comprehensive Audit & Recommendations Report | Detailed report of what works, what is broken, and keep/remove recommendations | M3 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Fix & Harden Auth, Profile & Dev Proxy | Fix `authController.register` username handling, `authStore.register`, `addContext` DB persistence, `updateProfile` bio/phone fields, Vite `/uploads` proxy, dependency cleanup, and verify end-to-end | none | DONE |
| 2 | Comprehensive Feature Testing & Multi-Layer Audit | Systematically test and verify all REST endpoints (27), WebSocket events (9), database models, and client UI interactions | M1 | DONE |
| 3 | Audit Summary & Feature Recommendations Report | Synthesize all findings and test verifications into final comprehensive report with actionable Keep/Remove/Refactor recommendations | M1, M2 | DONE |

## Interface Contracts
### Client `authStore` ↔ Server `authController`
- `register({ name, email, password, primaryUsername, username })`:
  - Payload: `{ name: string, email: string, password: string, primaryUsername?: string, username?: string }`
  - Server accepts either `primaryUsername` or `username`, sanitizes `@` prefix and lowercases.
  - Response: `{ success: true, token: string, user: UserObject }`
- `login(emailOrUsername, password)`:
  - Payload: `{ email: string, password: string }` where `email` can be email or handle.
  - Response: `{ success: true, token: string, user: UserObject }`
- `updateProfile({ name, bio, avatar, phone })`:
  - Payload: `{ name?: string, bio?: string, avatar?: string, phone?: string }`
  - Response: `{ success: true, user: UserObject }`
- `addContext({ id, type, name, username })`:
  - Payload: `{ id: string, type: string, name: string, username: string }`
  - Response: `{ success: true, contexts: ContextArray }` (persisted to MongoDB Atlas)

## Code Layout
- `server/src/app.js`: Express application configuration and middleware.
- `server/src/server.js`: HTTP and Socket.io server bootstrap.
- `server/src/controllers/authController.js`: Authentication and profile controller endpoints.
- `server/src/controllers/workspaceController.js`: Workspaces and channel tree management.
- `server/src/controllers/messageController.js`: Chat messages and reactions controller.
- `server/src/controllers/contactController.js`: Direct contacts and personal groups.
- `server/src/models/`: Mongoose schemas (`User.js`, `Message.js`, `Contact.js`, `Workspace.js`, `WorkspaceNode.js`).
- `server/src/services/storageService.js`: Data access layer and business logic.
- `client/src/api/api.js`: REST API client with Bearer token injection.
- `client/src/api/socket.js`: Real-time Socket.io client singleton.
- `client/src/store/`: Zustand state management (`authStore.js`, `chatStore.js`, `themeStore.js`).
- `client/src/pages/`: Main application pages (`AuthPage.jsx`, `ChatPage.jsx`).
- `client/src/components/chat/`: Chat layout and interaction components.
- `client/src/components/modals/`: User dialogs and modals.
- `client/vite.config.js`: Vite bundler and development proxy configuration.
- `server/src/scripts/comprehensive-feature-audit.js`: Permanent 49-assertion multi-layer audit runner.
- `AUDIT_SUMMARY_REPORT.md`: Comprehensive 691-line audit and recommendation report at project root.
