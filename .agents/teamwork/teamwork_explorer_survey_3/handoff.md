# Client Architecture & Frontend Features Investigation Report

## 1. Observation

### 1.1 Tech Stack & Dependency Footprint
Direct inspection of `client/package.json`, `client/vite.config.js`, and `client/src/main.jsx` reveals:
- **Framework & Runtime**: React 19.2.8 (`react`, `react-dom`) initialized in `client/src/main.jsx:6` with `ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)`.
- **Bundler & Build Tool**: Vite 8.3.0 (`vite`, `@vitejs/plugin-react`). Build configuration in `client/vite.config.js` configures dev port `5173`, with proxy rules routing `/api` -> `http://localhost:5000` (changeOrigin: true) and `/socket.io` -> `http://localhost:5000` (ws: true).
- **Styling**: Tailwind CSS v4.3.3 (`tailwindcss`, `@tailwindcss/vite`). Configured via Vite plugin in `vite.config.js` and imported in `client/src/index.css:2` (`@import "tailwindcss"`).
- **State Management**: Zustand 5.0.15 (`zustand`). Three stores manage application state:
  1. `client/src/store/authStore.js` (User session, authentication status, profile updates)
  2. `client/src/store/chatStore.js` (Conversations, channels, messages, reactions, typing, active workspace)
  3. `client/src/store/themeStore.js` (Color scheme, accents, custom wallpapers, synthesized sound toggle, font scale)
- **Real-Time Client**: Socket.IO client 4.8.3 (`socket.io-client`), encapsulated in `client/src/api/socket.js`.
- **Iconography**: Lucide React 1.46.0 (`lucide-react`).
- **End-to-End Automation**: Puppeteer 25.12.0 (`puppeteer`), located in `client/test_browser_all_buttons.js`.
- **Ghost / Unused Dependencies**:
  - `react-router-dom` 7.18.4 is declared in `client/package.json:20`, but grep search across `client/src` finds 0 occurrences.
  - `framer-motion` 13.3.0 is declared in `client/package.json:14`, but grep search across `client/src` finds 0 occurrences.
  - `react-hook-form` 7.88.0 is declared in `client/package.json:19`, but grep search across `client/src` finds 0 occurrences.

### 1.2 Routing & Navigation Architecture
- `client/src/App.jsx:14-16`:
  ```jsx
  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    {isAuthenticated ? <ChatPage /> : <AuthPage />}
  </div>
  ```
- Routing is handled via binary conditional rendering controlled by `useAuthStore.isAuthenticated`.
- There is no browser URL routing, nested routes, route parameters (e.g. `/channel/:id`, `/chat/:userId`), or browser back/forward history navigation for conversation states.

### 1.3 Client Network Layer & Backend Communication
1. **HTTP Client (`client/src/api/api.js`)**:
   - Uses native `fetch` with `API_BASE = ''` (resolving against Vite development proxy `http://localhost:5000` or production origin).
   - Authorization: Reads token from `localStorage.getItem('zyntra_token')` and appends `Authorization: Bearer ${token}`.
   - Multipart file upload: `isFormData: true` omits `'Content-Type': 'application/json'` allowing browser to compute `multipart/form-data; boundary=...`.
   - Endpoints mapped:
     - `auth.login`: `POST /api/auth/login`
     - `auth.register`: `POST /api/auth/register`
     - `auth.me`: `GET /api/auth/me`
     - `auth.updateProfile`: `PUT /api/auth/profile`
     - `contacts.list`: `GET /api/contacts`
     - `contacts.search`: `GET /api/contacts/search?q={query}`
     - `contacts.add`: `POST /api/contacts`
     - `contacts.createGroup`: `POST /api/contacts/groups`
     - `workspaces.list`: `GET /api/workspaces`
     - `workspaces.nodes`: `GET /api/workspaces/nodes`
     - `workspaces.create`: `POST /api/workspaces`
     - `workspaces.createNode`: `POST /api/workspaces/:wsId/nodes`
     - `workspaces.join`: `POST /api/workspaces/join`
     - `messages.byChat`: `GET /api/messages/:chatId`
     - `messages.send`: `POST /api/messages/:chatId`
     - `messages.edit`: `PUT /api/messages/:messageId`
     - `messages.delete`: `DELETE /api/messages/:messageId`
     - `messages.reaction`: `POST /api/messages/:messageId/reactions`
     - `upload.file`: `POST /api/upload/file`
2. **WebSocket Client (`client/src/api/socket.js`)**:
   - Singleton `SocketService` using `io('', { transports: ['websocket', 'polling'], reconnection: true, auth: { token } })`.
   - Emits:
     - `join_room` (roomId)
     - `leave_room` (roomId)
     - `send_message` (message payload)
     - `send_reaction` ({ messageId, emoji, userId, chatId })
     - `typing_start` ({ roomId, userName, userId })
     - `typing_stop` ({ roomId, userId })
   - Subscribes:
     - `receive_message`: handles peer broadcasts and updates messages array
     - `update_reaction`: updates reaction emoji badges
     - `user_typing`: displays typing indicator
3. **Local & Session Storage Keys**:
   - `zyntra_token`: JWT string for authenticated sessions
   - `zyntra_user`: Serialized JSON object of authenticated user
   - `zyntra_theme`: `'dark'` or `'light'`
   - `zyntra_accent`: `'blue'`, `'purple'`, `'emerald'`, `'amber'`, `'rose'`
   - `zyntra_wallpaper`: `'default'`, `'grid'`, `'dots'`, `'aurora'`
   - `zyntra_sound`: `'true'` or `'false'`
   - `zyntra_font_scale`: `'compact'`, `'normal'`, `'comfortable'`
   - `zyntra_workspace_prompted`: SessionStorage flag to prevent repeated popup upon page refresh

### 1.4 Screen & Component Inventory
The client UI contains 2 pages, 5 chat layout components, 5 modals, 4 shared UI components, and 1 audio utility:
1. `client/src/pages/AuthPage.jsx`: Split-screen authentication view (Login tab, Register tab, demo quick-fill, password visibility toggle, mock preview).
2. `client/src/pages/ChatPage.jsx`: Main application container coordinating `Sidebar`, `ChatArea`, and modal triggers.
3. `client/src/components/chat/Sidebar.jsx`: Direct chats vs. Workspaces tabs, channel folder accordion tree, search filter, active workspace switcher dropdown, bottom profile/signout footer.
4. `client/src/components/chat/ChatArea.jsx`: Header with status/call/info triggers, date-grouped message stream, real-time typing indicator, scroll-to-bottom anchor, composer integration. Empty state renders workspace dashboard cards.
5. `client/src/components/chat/Composer.jsx`: Auto-resizing textarea, image and generic file upload, emoji picker trigger, send button, typing event emitter.
6. `client/src/components/chat/MessageBubble.jsx`: Message bubble with sender info, time, edited badge, read checkmark, reaction pills, hover/tap quick actions (reactions, copy, edit, delete), inline image thumbnail viewer, file attachment download card.
7. `client/src/components/chat/GroupInfoPanel.jsx`: Slide-over drawer with avatar/icon, channel invite code copy, mute toggle, member list with role badges, static shared media counters, and leave/delete/block actions.
8. `client/src/components/modals/WorkspaceModal.jsx`: 3-tab modal for selecting an existing workspace, joining by invite code, or creating a new workspace.
9. `client/src/components/modals/NewChatModal.jsx`: 3-tab modal for direct contact search, personal group creation, and joining existing group.
10. `client/src/components/modals/CreateChannelModal.jsx`: Modal for adding a channel to active workspace with optional folder/category.
11. `client/src/components/modals/SettingsModal.jsx`: 6-tab modal (Profile, Appearance, Notifications, Privacy, Workplaces, Account & Security).
12. `client/src/components/modals/CallModal.jsx`: Modal presenting simulated voice/video call with duration timer, audio waveform or video placeholder, mic/camera/screenshare buttons.
13. `client/src/components/ui/Avatar.jsx`: Deterministic gradient avatar generator with initials and online status pip.
14. `client/src/components/ui/EmojiPicker.jsx`: Categorized emoji picker with search filter.
15. `client/src/components/ui/ImageViewer.jsx`: Fullscreen photo lightbox with zoom and direct download.
16. `client/src/components/ui/Modal.jsx`: Accessible modal dialog wrapper with backdrop and Escape key listener.
17. `client/src/utils/zyntraSound.js`: Web Audio API synthesizer generating 5 synthesized tones without external audio assets.

### 1.5 Identified Bugs, Inconsistencies & Mock Stubs
1. **`authStore.updateProfile` Argument Truncation**:
   - Location: `client/src/store/authStore.js:127-130`:
     ```javascript
     updateProfile: async ({ name, avatar }) => {
       try {
         const res = await api.auth.updateProfile({ name, avatar });
     ```
   - In `client/src/components/modals/SettingsModal.jsx:129-134`:
     ```javascript
     const res = await onUpdateProfile({
       name: name.trim(),
       avatar: avatarUrl.trim() || null,
       bio: bio.trim(),
       phone: phone.trim(),
     });
     ```
   - `authStore` only extracts `{ name, avatar }`, silently discarding `bio` and `phone`, even though the backend endpoint `server/src/controllers/authController.js:128` explicitly accepts `{ name, bio, avatar, phone }`.
2. **`CallModal.jsx` is 100% Mock / Stub**:
   - `client/src/components/modals/CallModal.jsx` contains no WebRTC logic (`RTCPeerConnection`, `getUserMedia`, ICE candidates, or signaling events). It only plays synthetic audio chimes and starts an interval incrementing a seconds counter.
3. **`SettingsModal.jsx` Security & Account Mock Stubs**:
   - Password Update (`SettingsModal.jsx:145-152`): Does not make any HTTP call; sets local state `passwordMsg('Password changed successfully across all sessions!')` with `setTimeout`.
   - Active Sessions (`SettingsModal.jsx:739-758`): Hardcoded mock list showing `Windows 11 · Chrome` and `iPhone 15 Pro · Safari Mobile (2 hours ago)`.
   - Delete Account (`SettingsModal.jsx:770-775`): Calls `window.confirm` and sets a dummy message; no API request is dispatched.
   - Non-persistent Settings: "Read Receipts", "Online Indicator", "Desktop Push Alerts", "Do Not Disturb" are stored in local component state in `SettingsModal.jsx` and are lost whenever the modal closes.
4. **`GroupInfoPanel.jsx` Mock Counters & Client-Only Actions**:
   - Shared Media (`GroupInfoPanel.jsx:174-188`): Hardcoded text displaying `14 Photos` and `6 Docs`.
   - Mutual Connections (`GroupInfoPanel.jsx:133-135`): Hardcoded string `You both are members of Zyntra Technologies and Design Team`.
   - Leave / Delete / Block (`GroupInfoPanel.jsx:195-238`): Calls `removeChat` or `blockUser` in Zustand memory; no corresponding backend API endpoint is called.
5. **Lint Warnings**:
   - Running `npm run lint --prefix client` (`oxlint`) produces 28 warnings: unused imports (`Volume2`, `ShieldCheck`, `UserPlus`, `Lock`, `Folder`, `FolderOpen`, `VolumeX`, `Trash2`, `ExternalLink`, `Zap`) and `set-state-in-effect` patterns in `CallModal.jsx`, `ChatPage.jsx`, and `Sidebar.jsx`.

### 1.6 Build and Test Commands
- **Production Build**: `npm run build --prefix client` (or `npm run build` from root).
  - Tool result: `vite build` succeeded with exit code 0 in 607ms (Output: `dist/index.html` 0.67 kB, `index-BjG5VAO4.css` 46.09 kB, `index--L-3Bal8.js` 414.02 kB).
- **Linter**: `npm run lint --prefix client`.
  - Tool result: `oxlint` exited with code 0 (28 warnings, 0 errors).
- **Automated UI / Button Verification**: `node client/test_browser_all_buttons.js`.
  - Uses Puppeteer to automate 17 distinct UI interactions across login, workspace selection, channel switching, modal triggers, composer typing, emoji insertion, settings tabs, and mobile viewport resizing.
- **Unit / Component Tests**: Currently NONE configured in `client/package.json` (no Vitest / Jest setup).

---

## 2. Logic Chain

1. **Architecture & Routing Assessment**:
   - `client/src/App.jsx` checks `isAuthenticated` from Zustand.
   - If true, `ChatPage` renders; if false, `AuthPage` renders.
   - Because `react-router-dom` is declared in `package.json` but absent from `client/src`, any direct URL path like `/login`, `/channels/general`, or `/settings` will simply load the SPA root and evaluate `isAuthenticated`.
   - This simple routing model is fast and avoids synchronization errors between router state and Zustand, but lacks shareable deep links.
2. **State & Synchronization Tracing**:
   - Upon successful login/register (`authStore.js:70`, `113`), `socketService.connect()` is called.
   - `ChatPage.jsx:52-67` calls `loadChats()` and binds Socket.IO event handlers (`receive_message`, `update_reaction`, `user_typing`).
   - When a user sends a message (`Composer.jsx:137`), `chatStore.sendMessage` creates an optimistic message object, inserts it into Zustand state immediately, emits `socket.emit('send_message')`, and asynchronously sends `POST /api/messages/:chatId`.
   - This ensures instant feedback (<10ms UI perception) with reliable backend persistence.
3. **Identification of Mock vs. Real Features**:
   - Where an action invokes `api.*` methods that resolve against real Express controllers and Mongo/StorageService models (Login, Register, Workspace create/join, Channel create, Message send/edit/delete, Reactions, File Upload), the feature is classified as **Operational**.
   - Where an action only updates in-memory React/Zustand state or sets mock feedback text without backend endpoints (`CallModal`, password change in settings, account deletion, active session inspection, shared media counts), the feature is classified as **Mock / Placeholder**.
4. **Impact of Ghost Dependencies**:
   - `framer-motion`, `react-hook-form`, and `react-router-dom` add zero value to runtime UI while bloating `node_modules` by several dozen megabytes and increasing CI/install latency.
   - `puppeteer` is placed in `dependencies` rather than `devDependencies`, causing production installs to download a 170MB+ Chromium binary unnecessarily.

---

## 3. Caveats

- Investigation is based on static source analysis and build tool verification.
- Server database availability (local MongoDB vs. embedded memory fallback) was tested at the API contract layer; the client handles both transparently because API endpoints return the same schema.
- Puppeteer script `test_browser_all_buttons.js` requires the backend server and Vite dev server to be actively listening on `localhost:5000` and `localhost:5173`.

---

## 4. Conclusion & Feature Inventory

### 4.1 Itemized Client Feature Inventory

| Module / Component | Feature Description | Operational Status | UX Evaluation | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **AuthPage** | Sign In (Email/Username + Password) | Operational | Excellent: fast, clean error alerts, demo auto-fill | **KEEP** |
| **AuthPage** | Create Account (Name, Handle, Email, Password) | Operational | Clean segmented switcher, input sanitization | **KEEP** |
| **AuthPage** | Password visibility eye toggle | Operational | Polished interactive feedback | **KEEP** |
| **AuthPage** | Product preview showcase panel | Operational | Great visual design on desktop/tablet | **KEEP** |
| **WorkspaceModal** | Select active workspace | Operational | Displays channels & members count, auto-opens first channel | **KEEP** |
| **WorkspaceModal** | Join workspace by uppercase code | Operational | One-click copy & validation error alerts | **KEEP** |
| **WorkspaceModal** | Create workspace with contextual handle | Operational | Working with backend storage | **KEEP** |
| **Sidebar** | Direct Chats list & unread preview | Operational | Renders avatar, online pip, formatted time | **KEEP** |
| **Sidebar** | Workplaces accordion tree & categories | Operational | Clean folder organization, channel member counts | **KEEP** |
| **Sidebar** | Search filter for conversations & channels | Operational | Instant in-memory filtering | **KEEP** |
| **Sidebar** | Workspace switcher dropdown + code copy | Operational | Smooth dropdown menu with quick code copy | **KEEP** |
| **NewChatModal** | Direct contact live search by username | Operational | Debounced search against `/api/contacts/search` | **KEEP** |
| **NewChatModal** | Create personal group | Operational | Form with description; persists to backend | **KEEP** |
| **CreateChannelModal**| Create channel with folder | Operational | Working with API and local fallback | **KEEP** |
| **ChatArea** | Workspace Dashboard (when no chat open) | Operational | Clean onboarding grid of available workplaces | **KEEP** |
| **ChatArea** | Date-grouped message feed | Operational | "Today", "Yesterday" date badges | **KEEP** |
| **ChatArea** | In-chat message search bar | Operational | Real-time text filter across chat messages | **KEEP** |
| **ChatArea** | Scroll-to-bottom floating button | Operational | Appears automatically when scrolled up | **KEEP** |
| **ChatArea** | Custom Chat Wallpapers (Grid, Dots, Aurora) | Operational | Pure CSS/SVG backgrounds; zero lag | **KEEP** |
| **Composer** | Auto-expanding textarea & Enter-to-send | Operational | Handles multiline (Shift+Enter) and Enter to send | **KEEP** |
| **Composer** | Real-time typing status | Operational | Emits `typing_start` / `typing_stop` with 2s debounce | **KEEP** |
| **Composer** | File & image attachment upload | Operational | Real-time upload to `/api/upload/file` with preview chip | **KEEP** |
| **Composer** | Emoji picker popover | Operational | Categorized emoji grid with search | **KEEP** |
| **MessageBubble** | Message reactions & reaction pills | Operational | Socket.IO broadcast + optimistic pill count | **KEEP** |
| **MessageBubble** | Inline message edit & delete (own msgs) | Operational | Inline input field with Save/Cancel, deletes cleanly | **KEEP** |
| **MessageBubble** | Copy message text | Operational | Uses navigator.clipboard with checkmark animation | **KEEP** |
| **ImageViewer** | Lightbox preview with Zoom & Download | Operational | Fullscreen modal with escape key support | **KEEP** |
| **zyntraSound** | Synthesized Web Audio UI sound effects | Operational | Ultra-lightweight (0 bytes assets), zero latency | **KEEP** |
| **ThemeStore** | Theme Mode (Dark Obsidian / Clean Light) | Operational | Instant CSS variable toggle, saved in localStorage | **KEEP** |
| **ThemeStore** | Accent color picker (5 color palettes) | Operational | Dynamic `--accent` and `--bubble-sent` styling | **KEEP** |
| **ThemeStore** | Typography scale (Compact, Default, Large) | Operational | Dynamically modifies `--font-scale` | **KEEP** |
| **SettingsModal** | Display name & avatar picture upload | Operational | Persists via `/api/auth/profile` and `/api/upload/file` | **KEEP** |
| **SettingsModal** | Bio & Phone number update | **Broken** | UI fields present, but `authStore` drops arguments | **FIX / REFACTOR** |
| **SettingsModal** | Update Account Password | **Mock** | Pure UI simulation; does not call backend | **REFACTOR** (Connect or remove) |
| **SettingsModal** | Active Devices & Sessions | **Mock** | Hardcoded static text (Windows 11, iPhone 15) | **REMOVE** or implement server sessions |
| **SettingsModal** | Delete Account in Danger Zone | **Mock** | Browser confirm alert only; no backend call | **REFACTOR** (Connect to API or hide) |
| **SettingsModal** | Notification & Privacy toggles | **Non-persistent** | Stored in transient modal state; resets on close | **REFACTOR** (Persist to store or hide) |
| **GroupInfoPanel** | Participants list & role badges | Operational | Clean presentation of members and roles | **KEEP** |
| **GroupInfoPanel** | Shared media counters (14 Photos, 6 Docs) | **Mock** | Hardcoded text | **REFACTOR** (Calculate dynamically or remove) |
| **GroupInfoPanel** | Mutual Connections note | **Mock** | Hardcoded placeholder string | **REMOVE** |
| **GroupInfoPanel** | Leave / Delete / Block chat | **Client-only** | Deletes from client Zustand memory only | **REFACTOR** (Add backend sync) |
| **CallModal** | Voice & Video Calling | **Mock / Stub** | UI mockup with timer and sounds; no WebRTC | **MARK AS PREVIEW** or implement WebRTC |
| **Dependencies** | `react-router-dom`, `framer-motion`, `react-hook-form` | **Unused Ghost Deps**| Declared in package.json, 0 uses in code | **REMOVE FROM PACKAGE.JSON** |
| **Dependencies** | `puppeteer` | Misplaced Dep | In `dependencies` instead of `devDependencies` | **MOVE TO DEVDEPENDENCIES** |

---

## 5. Verification Method

### 5.1 Independent Codebase Verification
1. **Verify Ghost Dependencies**:
   ```powershell
   # Check occurrences of framer-motion, react-hook-form, react-router-dom in client/src
   Select-String -Path "client/src/**/*.jsx", "client/src/**/*.js" -Pattern "framer-motion"
   Select-String -Path "client/src/**/*.jsx", "client/src/**/*.js" -Pattern "react-hook-form"
   Select-String -Path "client/src/**/*.jsx", "client/src/**/*.js" -Pattern "react-router-dom"
   ```
   *Expected result*: No matches found in `client/src`.
2. **Verify `authStore.updateProfile` Argument Truncation**:
   Inspect `client/src/store/authStore.js:127-130`:
   ```javascript
   updateProfile: async ({ name, avatar }) => {
     try {
       const res = await api.auth.updateProfile({ name, avatar });
   ```
   Compare against `client/src/components/modals/SettingsModal.jsx:129-134` where `{ name, avatar, bio, phone }` are passed.
3. **Verify Production Build**:
   ```powershell
   npm run build --prefix client
   ```
   *Expected result*: Vite transforms modules and outputs `dist/index.html`, `dist/assets/index-*.css`, and `dist/assets/index-*.js` without build errors.
4. **Verify Linter Status**:
   ```powershell
   npm run lint --prefix client
   ```
   *Expected result*: 0 errors, 28 warnings (unused variables/imports and effect setState warnings).
5. **Verify CallModal Stub**:
   Inspect `client/src/components/modals/CallModal.jsx`. Confirm there are zero references to `RTCPeerConnection`, `navigator.mediaDevices`, or audio/video media streams.
