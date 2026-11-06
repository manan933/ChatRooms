# Zyntra Chat Application - Minor / Learning Project Presentation
**Department of Computer Science and Engineering**  
**School of Engineering and Technology, GIET University, Gunupur, Odisha**

---

## Slide 1: Title Slide
* **Institution**: GIET University, Gunupur | School of Engineering & Technology | Department of Computer Science & Engineering
* **Project Title**: **Zyntra: A Modern Real-Time Contextual Chat & Workplace Application**
* **Subtitle**: Full-Stack Real-Time Micro-Architecture with WebSockets, MongoDB Atlas, and Multi-Tenant Workspaces
* **Presented By**: Soumya Mohanty & Team (Regd No: [Your Registration Number])
* **Under the Guidance of**: [Supervisor Name], [Designation], Dept. of CSE, GIET University

> **Speaker Notes**:  
> "Respected supervisor, panel members, and fellow students, good morning. Today, I am excited to present our minor project titled 'Zyntra: A Modern Real-Time Contextual Chat & Workplace Application'. In modern academic and enterprise environments, communication is often fragmented between isolated personal chats and heavyweight enterprise tools. Zyntra bridges this gap by unifying direct peer-to-peer conversations with multi-tenant organizational workspaces in a responsive, low-latency, and edge-replicated architecture."

---

## Slide 2: Outlines
1. **System Design & Architecture**: High-level client-server tiers, duplex WebSocket pipeline, and edge storage tier.
2. **Database / Data Design**: MongoDB Atlas document schema (`users`, `workspaces`, `nodes`, `messages`, `contacts`).
3. **Coding & Technical Implementation**: MVC backend pattern, REST APIs, Zustand atomic state stores, and real-time socket events.
4. **Module Development & Integration**: Authentication, multi-tenant workspace system, login workspace popup, live calling suite, and mobile UI.
5. **Work Progress & Weekly Report**: Project lifecycle milestones, automated browser testing suite (26/26 checks passed), and Render cloud deployment.

> **Speaker Notes**:  
> "Our presentation follows the structural guidelines outlined for our CSE minor project evaluation, taking you through the system architecture, data modeling, implementation mechanics, module integrations, and project milestone progress."

---

## Slide 3: 1. System Design & Architecture
* **Frontend Tier (SPA)**: React 19, Vite 8, Tailwind CSS v4, Lucide Icons, and Framer Motion. Zero-runtime CSS styling and sub-500ms build execution.
* **Backend Tier**: Node.js and Express 4 providing modular RESTful API endpoints for authentication, workspace management, and media uploads.
* **Real-Time Gateway**: Socket.io v4 managing bidirectional WebSocket pipelines with automatic fallback to HTTP polling.
* **Database Tier**: MongoDB Atlas cloud cluster powered by Mongoose ODM delivering high-availability replica sets, flexible JSON document storage, indexing, and high-throughput write performance.
* **Security & Tokens**: Stateless JSON Web Tokens (JWT) with Bearer token authentication, bcryptjs salt-hashed passwords, and CORS origin security.

> **Speaker Notes**:  
> "Taking a look at our architecture, Zyntra is architected as a decoupled client-server system. On the frontend, React 19 combined with Vite delivers an ultra-fast single page application. For real-time delivery, rather than relying on HTTP polling which wastes bandwidth and introduces latency, we utilize Socket.io over WebSockets. Our storage layer leverages MongoDB Atlas, providing a resilient cloud database cluster with high-performance querying and persistent indexing."

---

## Slide 4: 1. System Design - Real-Time WebSocket Pipeline
* **Handshake & Auth**: The client establishes a WebSocket handshake authenticated via JWT token. The socket instance maps the connection ID to the active user.
* **Room Segregation (`join_room`)**: Users dynamically subscribe to channel rooms (`ws-channel-id`) or private 1-on-1 direct message rooms.
* **Instant Message Broadcast (`send_message` $\rightarrow$ `receive_message`)**: When a message is sent, it is persisted to the database and broadcasted simultaneously to all room subscribers in $<50\text{ms}$.
* **Live Typing Indicators (`user_typing`)**: Debounced typing states broadcast live to participants without persistent database overhead.
* **Real-Time Reactions (`update_reaction`)**: Instant emoji reaction sync dispatched directly to listeners.

> **Speaker Notes**:  
> "The heartbeat of Zyntra is its duplex event pipeline. When a user sends a message or reacts with an emoji, Socket.io broadcasts the event to the targeted room. This ensures that everyone within the `#announcements` or `#general` channel receives instant updates with sub-50ms latency."

---

## Slide 5: 2. Database / Data Design
* **`users` Table**: `_id` (PK), `name`, `email` (UNIQUE), `primaryUsername` (UNIQUE), `password` (bcrypt hash), `avatar`, `bio`, `status` ('online'/'offline'), `contexts` (JSON array).
* **`workspaces` Table**: `id` (PK), `name`, `joinCode` (UNIQUE, e.g. `WS-ABDYU`), `description`, `settings` (JSON), `created_at`.
* **`workspace_nodes` (Channels) Table**: `id` (PK), `workspace_id` (FK), `name`, `folder` (e.g. `ENGINEERING`), `isAnnouncement` (BOOLEAN), `membersCount`.
* **`messages` Table**: `id` (PK), `senderId` (FK), `roomId`, `content`, `attachment` (JSON), `reactions` (JSON), `created_at`.
* **`contacts` & `groups` Tables**: Bidirectional user friendships and group memberships with role-based permissions (`admin`, `member`).

> **Speaker Notes**:  
> "Our relational schema balances relational integrity with document-like agility. Workspaces own hierarchical channels that can be grouped into folders. Messages maintain strict relations to their rooms and senders, while storing attachments and emoji reactions as flexible JSON fields."

---

## Slide 6: 3. Coding & Technical Implementation
* **Backend Architecture**: Controller-Service separation:
  - `authController.js`, `workspaceController.js`, `messageController.js`, `contactController.js`.
  - `storageService.js`: Encapsulates all data access and Mongoose operations with clean promises and consistent schemas.
* **State Management (Zustand)**:
  - `useAuthStore`: Manages authenticated sessions, current user profile, and login workspace prompts.
  - `useChatStore`: Manages active conversations, channel trees, messages, and optimistic updates.
* **Vite Development Proxy**: Configured in `vite.config.js` to seamlessly proxy `/api` and `/socket.io` to backend port 5000, eliminating CORS issues.

> **Speaker Notes**:  
> "On the coding side, we maintained clean separation of concerns. On the backend, controllers orchestrate HTTP requests while `storageService` isolates our MongoDB Atlas database operations with Mongoose schemas. On the frontend, Zustand provides atomic, reactive state slices without the boilerplate of Redux."

---

## Slide 7: 4. Module Development & Integration - Workspace System
* **Multi-Tenant Workspaces**: Organizations like GIET University or department cohorts (e.g. 'GIET', 'CSE') have dedicated workspaces with segregated channels.
* **6-Character Invite Codes**: Generates unique invite codes (`WS-ABDYU`, `WS-VMSNX`) with one-click clipboard copying.
* **Login Workspace Selection Popup**: Immediately upon login, an interactive popup appears prompting users to:
  1. *Choose Workspace*: Select an existing workspace and auto-load the `#general` channel.
  2. *Join with Code*: Enter a 6-character code to join an existing organization.
  3. *Create New*: Spin up a new organization with team channels.
* **Channel Folders**: Group channels under categories such as `ENGINEERING` containing `#backend-team` and `#frontend-team`.

> **Speaker Notes**:  
> "A core innovation in Zyntra is the workspace collaboration system. After logging in, users are immediately greeted with a workspace selection modal where they can pick their organization, join via invite code, or create a new workplace. Channels can be organized cleanly into department folders."

---

## Slide 8: 4. Module Development - Chat Area & Mobile Responsiveness
* **Rich Message Composer**: Multiline auto-expanding textarea, emoji picker popup, attachment preview, and instantaneous dispatch.
* **Calling Suite**: Integrated HD Opus Voice Call and Video Call modal overlays with screen share and mute controls.
* **Channel Info Drawer**: Slide-over panel detailing channel members, invite codes, shared media tallies (Photos & Docs), and leave/mute options.
* **Mobile Responsiveness ($<768\text{px}$)**: Full single-column adaptive layout:
  - Conversation list displays at 100% width on mobile.
  - Selecting a chat smoothly transitions to the full-width chat stream.
  - Header presents a prominent **"Back to conversations"** button.

> **Speaker Notes**:  
> "In the chat area, users enjoy interactive features including voice and video calling modals, emoji pickers, and inline message search. For mobile devices, we implemented responsive single-column drawer navigation, ensuring zero clipping or horizontal scrolling on smaller viewports."

---

## Slide 9: 5. Work Progress & Weekly Report
* **Weeks 1–2**: Problem definition, requirements specification, architecture blueprint, and tech stack finalization.
* **Weeks 3–4**: Core backend REST API, MongoDB Atlas cloud cluster setup, and Socket.io event engine.
* **Weeks 5–6**: Frontend UI implementation, Zustand store design, message composer, and emoji picker.
* **Weeks 7–8**: Workspace collaboration engine, 6-character invite codes, login workspace popup, voice & video modals.
* **Weeks 9–10**: Automated browser testing with Puppeteer (26/26 checks passed), mobile responsiveness, and cloud deployment on Render at `https://zyntra-oau1.onrender.com/`.

> **Speaker Notes**:  
> "Our project followed an agile 10-week development plan. Over weeks 1 through 8 we moved from design to full implementation. In the final weeks, we executed automated browser test suites verifying all 26 UI actions and deployed the application live on Render."

---

## Slide 10: Q&A & Project Links
* **Live Web Application**: [https://zyntra-oau1.onrender.com/](https://zyntra-oau1.onrender.com/)
* **GitHub Repository**: [https://github.com/manan933/Zyntra_Chat_Application](https://github.com/manan933/Zyntra_Chat_Application)
* **Thank you all for your attention! Any questions?**

---

### Anticipated Viva / Panel Questions & Answers

1. **Why did you use MongoDB Atlas for database persistence?**
   - *Answer*: MongoDB Atlas provides a resilient, cloud-hosted document database cluster with built-in replication, horizontal scalability, flexible JSON document modeling for contextual conversations and reaction arrays, and native integration with the MERN stack.

2. **How does Socket.io scale if user traffic grows?**
   - *Answer*: Socket.io can scale horizontally by attaching a Redis pub/sub adapter (`@socket.io/redis-adapter`), allowing multiple server nodes behind a load balancer to synchronize room events seamlessly.

3. **How do you prevent unauthorized users from reading channel messages?**
   - *Answer*: Socket room joins and REST endpoints are authenticated via stateless JWT tokens. Sockets verify user membership before admitting them into workspace channel rooms or private DM rooms.
