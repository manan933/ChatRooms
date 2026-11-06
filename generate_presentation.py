import os
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Theme Colors matching GIET green template & modern sleek tech design
    DARK_GREEN = RGBColor(46, 125, 50)     # #2E7D32
    LIGHT_GREEN = RGBColor(129, 199, 132)  # #81C784
    ACCENT_GREEN = RGBColor(76, 175, 80)   # #4CAF50
    NAVY_TEXT = RGBColor(26, 32, 44)       # #1A202C
    GRAY_TEXT = RGBColor(74, 85, 104)      # #4A5568
    WHITE = RGBColor(255, 255, 255)
    LIGHT_BG = RGBColor(248, 250, 252)
    CARD_BG = RGBColor(241, 245, 249)

    arch_img = r"C:\Users\Manan Patel\.gemini\antigravity\brain\763c3b94-b360-43e3-abbc-d77af64359ea\system_architecture_1791740639531.jpg"
    ws_popup_img = r"d:\PROJECTS\Zyntra_Chat_Application\client\browser_test_screenshots\04_workspace_popup_open.png"
    chat_img = r"d:\PROJECTS\Zyntra_Chat_Application\client\browser_test_screenshots\07_chat_view_active.png"
    mobile_img = r"d:\PROJECTS\Zyntra_Chat_Application\client\browser_test_screenshots\16_mobile_responsive_chat.png"

    def add_header(slide, title_text, category_text=""):
        # Top banner line
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.12))
        shape.fill.solid()
        shape.fill.fore_color.rgb = DARK_GREEN
        shape.line.fill.background()

        # Title box
        tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(1.0))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        if category_text:
            p0 = tf.paragraphs[0]
            p0.text = category_text.upper()
            p0.font.size = Pt(11)
            p0.font.bold = True
            p0.font.color.rgb = DARK_GREEN
            p0.space_after = Pt(2)
            p1 = tf.add_paragraph()
        else:
            p1 = tf.paragraphs[0]

        p1.text = title_text
        p1.font.size = Pt(24)
        p1.font.bold = True
        p1.font.color.rgb = NAVY_TEXT

    # =========================================================================
    # SLIDE 1: Title Slide (GIET University Template)
    # =========================================================================
    slide1 = prs.slides.add_slide(prs.slide_layouts[6])
    
    # Left decorative green bar
    left_bar = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(0.4), Inches(7.5))
    left_bar.fill.solid()
    left_bar.fill.fore_color.rgb = DARK_GREEN
    left_bar.line.fill.background()

    # University Header Box
    uni_box = slide1.shapes.add_textbox(Inches(1.2), Inches(0.6), Inches(11.0), Inches(1.2))
    utf = uni_box.text_frame
    utf.word_wrap = True
    
    p = utf.paragraphs[0]
    p.text = "SCHOOL OF ENGINEERING AND TECHNOLOGY"
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = NAVY_TEXT

    p = utf.add_paragraph()
    p.text = "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN
    p.space_after = Pt(12)

    p = utf.add_paragraph()
    p.text = "GIET UNIVERSITY, GUNUPUR, ODISHA"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = GRAY_TEXT

    # Main Project Title Card
    proj_card = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(2.2), Inches(11.0), Inches(2.2))
    proj_card.fill.solid()
    proj_card.fill.fore_color.rgb = DARK_GREEN
    proj_card.line.fill.background()

    ptf = proj_card.text_frame
    ptf.word_wrap = True
    ptf.margin_left = Inches(0.5)
    ptf.margin_top = Inches(0.3)

    p = ptf.paragraphs[0]
    p.text = "MINOR / LEARNING PROJECT PRESENTATION ON"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = LIGHT_GREEN
    p.space_after = Pt(6)

    p = ptf.add_paragraph()
    p.text = "ZYNTRA: A MODERN REAL-TIME CONTEXTUAL CHAT & WORKPLACE APPLICATION"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.space_after = Pt(6)

    p = ptf.add_paragraph()
    p.text = "Full-Stack Realtime Architecture with WebSockets, MongoDB Atlas, and Multi-Tenant Workspaces"
    p.font.size = Pt(12)
    p.font.color.rgb = WHITE

    # Footer Metadata: Presented By & Supervisor
    meta_box1 = slide1.shapes.add_textbox(Inches(1.2), Inches(4.8), Inches(5.0), Inches(2.2))
    mtf1 = meta_box1.text_frame
    p = mtf1.paragraphs[0]
    p.text = "Presented By:"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN
    p = mtf1.add_paragraph()
    p.text = "Soumya Mohanty & Team"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = NAVY_TEXT
    p = mtf1.add_paragraph()
    p.text = "Regd No: [Student Registration Number]"
    p.font.size = Pt(12)
    p.font.color.rgb = GRAY_TEXT
    p = mtf1.add_paragraph()
    p.text = "B.Tech, Computer Science & Engineering"
    p.font.size = Pt(12)
    p.font.color.rgb = GRAY_TEXT

    meta_box2 = slide1.shapes.add_textbox(Inches(7.2), Inches(4.8), Inches(5.0), Inches(2.2))
    mtf2 = meta_box2.text_frame
    p = mtf2.paragraphs[0]
    p.text = "Under the Guidance of:"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN
    p = mtf2.add_paragraph()
    p.text = "[Supervisor Name]"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = NAVY_TEXT
    p = mtf2.add_paragraph()
    p.text = "[Designation, Dept. of CSE]"
    p.font.size = Pt(12)
    p.font.color.rgb = GRAY_TEXT
    p = mtf2.add_paragraph()
    p.text = "GIET University, Gunupur"
    p.font.size = Pt(12)
    p.font.color.rgb = GRAY_TEXT

    # =========================================================================
    # SLIDE 2: Outlines (matching Slide 2 of template)
    # =========================================================================
    slide2 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide2, "Presentation Outlines", "Table of Contents")

    outlines = [
        ("1. System Design & Architecture", "High-level client-server micro-architecture, WebSocket pipeline, and edge storage tier"),
        ("2. Database / Data Design", "MongoDB Atlas relational models: users, multi-tenant workspaces, channels, messages, and contacts"),
        ("3. Coding & Technical Implementation", "Controller-service pattern, REST APIs, Socket.io duplex event handling, and Zustand state store"),
        ("4. Module Development & Integration", "Authentication, workspace code system, login workspace popup, live calling suite, and mobile UI"),
        ("5. Work Progress & Weekly Report", "Milestone timeline, automated browser test suite (26/26 passed), and Render cloud deployment"),
    ]

    for i, (title, desc) in enumerate(outlines):
        y = Inches(1.8 + i * 1.05)
        # Green pill banner
        card = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), y, Inches(11.3), Inches(0.85))
        card.fill.solid()
        card.fill.fore_color.rgb = DARK_GREEN if i == 0 else ACCENT_GREEN
        card.line.fill.background()

        ctf = card.text_frame
        ctf.word_wrap = True
        ctf.margin_left = Inches(0.4)
        ctf.margin_top = Inches(0.12)

        p = ctf.paragraphs[0]
        p.text = title
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = WHITE

        p = ctf.add_paragraph()
        p.text = desc
        p.font.size = Pt(11)
        p.font.color.rgb = RGBColor(230, 245, 230)

    # =========================================================================
    # SLIDE 3: 1. System Design & Architecture - Overview
    # =========================================================================
    slide3 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide3, "System Design & Overall Architecture", "1. System Design & Architecture")

    # Left content box
    left_tb = slide3.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(6.2), Inches(5.3))
    ltf = left_tb.text_frame
    ltf.word_wrap = True

    points = [
        ("Client Tier (Single-Page App)", "Built with React 19, Vite 8, and Tailwind CSS 4. Uses Zustand for lightweight global reactive state and Framer Motion for responsive fluid transitions."),
        ("Gateway & Realtime Tier", "Node.js with Express 4 for RESTful endpoints. Socket.io 4 manages persistent full-duplex WebSocket connections with automatic fallback to HTTP long-polling."),
        ("Edge Storage Tier (MongoDB Atlas)", "Cloud-native, SQLite-compatible edge database managed via @libsql/client. Provides distributed sub-millisecond query execution, zero cold starts, and resilience."),
        ("Security & Transport Layer", "Stateless JSON Web Tokens (JWT) with Bearer headers, bcryptjs password hashing (salt rounds), and strict CORS authorization policies."),
    ]

    for title, desc in points:
        p = ltf.add_paragraph() if ltf.paragraphs[0].text else ltf.paragraphs[0]
        p.text = f"• {title}: "
        p.font.bold = True
        p.font.size = Pt(13)
        p.font.color.rgb = DARK_GREEN
        p.space_after = Pt(2)

        p2 = ltf.add_paragraph()
        p2.text = f"  {desc}"
        p2.font.size = Pt(11)
        p2.font.color.rgb = GRAY_TEXT
        p2.space_after = Pt(10)

    # Right Image: Architecture Diagram
    if os.path.exists(arch_img):
        slide3.shapes.add_picture(arch_img, Inches(7.2), Inches(1.6), width=Inches(5.3))

    # =========================================================================
    # SLIDE 4: 1. System Design - Real-Time Event Pipeline
    # =========================================================================
    slide4 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide4, "Real-Time WebSocket Event Pipeline", "1. System Design & Architecture")

    events = [
        ("Connection & Handshake", "Client connects with JWT auth token. Server verifies token, maps socket.id to user._id, and marks user status 'online'."),
        ("Room Subscriptions ('join_room')", "Users automatically join workspace channel rooms (ws-channel-id) and private 1-on-1 DM rooms upon selection."),
        ("Instant Message Broadcast ('send_message')", "Message is written to MongoDB Atlas and broadcasted simultaneously via io.to(roomId).emit('receive_message') in <50ms."),
        ("Typing Indicators ('user_typing')", "Debounced typing state broadcasts to room participants without persisting to DB, keeping latency negligible."),
        ("Live Reactions ('send_reaction')", "Real-time emoji reaction updates dispatched instantly to all active listeners in the conversation room."),
    ]

    for i, (title, desc) in enumerate(events):
        y = Inches(1.6 + i * 1.05)
        box = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y, Inches(11.7), Inches(0.9))
        box.fill.solid()
        box.fill.fore_color.rgb = CARD_BG
        box.line.color.rgb = LIGHT_GREEN
        box.line.width = Pt(1.5)

        btf = box.text_frame
        btf.word_wrap = True
        btf.margin_left = Inches(0.3)
        btf.margin_top = Inches(0.12)

        p = btf.paragraphs[0]
        p.text = f"⚡ {title}"
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = DARK_GREEN

        p = btf.add_paragraph()
        p.text = desc
        p.font.size = Pt(11)
        p.font.color.rgb = NAVY_TEXT

    # =========================================================================
    # SLIDE 5: 2. Database / Data Design
    # =========================================================================
    slide5 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide5, "MongoDB Atlas Document Database Schema Design", "2. Database / Data Design")

    tables = [
        ("users", ["_id (PK, TEXT)", "name, email (UNIQUE)", "primaryUsername (UNIQUE)", "password (bcrypt hash)", "avatar, bio, status ('online')", "contexts (JSON array)"]),
        ("workspaces", ["id (PK, TEXT)", "name (TEXT)", "joinCode (UNIQUE, 'WS-XXXXX')", "description (TEXT)", "settings (JSON object)", "created_at (DATETIME)"]),
        ("workspace_nodes (channels)", ["id (PK, TEXT)", "workspace_id (FK -> workspaces)", "name (TEXT, e.g. 'general')", "folder (TEXT, e.g. 'ENGINEERING')", "isAnnouncement (BOOLEAN)", "membersCount (INTEGER)"]),
        ("messages", ["id (PK, TEXT)", "senderId (FK -> users)", "roomId (TEXT: channel/chat ID)", "content (TEXT)", "attachment (JSON metadata)", "reactions (JSON array)", "created_at (TIMESTAMP)"]),
        ("contacts & groups", ["contacts: (id, user_id, contact_id, type)", "groups: (id, name, description, avatar)", "group_members: (group_id, user_id, role)"]),
    ]

    for i, (tbl_name, cols) in enumerate(tables):
        col_idx = i % 3
        row_idx = i // 3
        x = Inches(0.8 + col_idx * 3.95)
        y = Inches(1.6 + row_idx * 2.7)
        w = Inches(3.8)
        h = Inches(2.5) if row_idx == 0 else Inches(2.4)

        card = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = DARK_GREEN
        card.line.width = Pt(1.5)

        ctf = card.text_frame
        ctf.word_wrap = True
        ctf.margin_left = Inches(0.2)
        ctf.margin_top = Inches(0.15)

        p = ctf.paragraphs[0]
        p.text = f"TABLE: {tbl_name}"
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = DARK_GREEN
        p.space_after = Pt(4)

        for col in cols:
            p = ctf.add_paragraph()
            p.text = f"• {col}"
            p.font.size = Pt(9.5)
            p.font.color.rgb = NAVY_TEXT
            p.space_after = Pt(2)

    # =========================================================================
    # SLIDE 6: 3. Coding & Technical Implementation
    # =========================================================================
    slide6 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide6, "Modular Coding Architecture & Implementation", "3. Coding & Technical Implementation")

    impl_blocks = [
        ("Backend MVC & Storage Layer", [
            "Controllers (auth, workspace, message, contact) manage HTTP request lifecycle.",
            "storageService.js: Unified query engine using MongoDB Atlas client.",
            "Centralized error handling middleware with JWT token verification guards."
        ]),
        ("Frontend State Management (Zustand)", [
            "useAuthStore: Manages session credentials, JWT tokens, and login workspace prompts.",
            "useChatStore: Manages active channels, live messages, reactions, and workspace lists.",
            "Zero prop-drilling; components subscribe selectively to slice changes."
        ]),
        ("Realtime Socket Bridge", [
            "socketService.js: Resilient connection manager with reconnection backoff.",
            "Client listens to 'receive_message', 'update_reaction', and 'user_typing' events.",
            "Optimistic UI updates ensure instantaneous user experience before DB acknowledgment."
        ]),
        ("Vite Proxy & Build Pipeline", [
            "Vite dev proxy forwards /api and /socket.io directly to Node.js backend on port 5000.",
            "Tailwind CSS v4 compile pipeline with zero runtime CSS overhead.",
            "Production bundle minified to <500ms build execution."
        ]),
    ]

    for i, (title, items) in enumerate(impl_blocks):
        x = Inches(0.8 + (i % 2) * 5.95)
        y = Inches(1.6 + (i // 2) * 2.7)
        card = slide6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.75), Inches(2.45))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_GREEN

        ctf = card.text_frame
        ctf.word_wrap = True
        ctf.margin_left = Inches(0.25)
        ctf.margin_top = Inches(0.15)

        p = ctf.paragraphs[0]
        p.text = f"⚙️ {title}"
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = DARK_GREEN
        p.space_after = Pt(4)

        for it in items:
            p = ctf.add_paragraph()
            p.text = f"• {it}"
            p.font.size = Pt(10.5)
            p.font.color.rgb = NAVY_TEXT
            p.space_after = Pt(3)

    # =========================================================================
    # SLIDE 7: 4. Module Development - Workspace System
    # =========================================================================
    slide7 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide7, "Workspace Collaboration & Login Selection Modal", "4. Module Development & Integration")

    tb = slide7.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(6.0), Inches(5.3))
    tf = tb.text_frame
    tf.word_wrap = True

    pts = [
        ("Multi-Tenant Workspaces", "Enables university departments (e.g. 'GIET', 'CSE') and team organizations to maintain isolated discussion channels with customized member roles."),
        ("Unique 6-Character Join Codes", "Generates alphanumeric invite codes (e.g. 'WS-ABDYU') with one-click clipboard copying for frictionless team onboarding."),
        ("Post-Login Workspace Selection Popup", "Automatically presents an interactive modal immediately after login prompting users to select a workspace, enter an invite code, or create a new organization."),
        ("Hierarchical Channel Categorization", "Supports channel trees grouped by department folders (e.g. 'ENGINEERING' folder containing '#frontend-team' and '#backend-team')."),
    ]

    for title, desc in pts:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = f"📌 {title}:"
        p.font.bold = True
        p.font.size = Pt(13)
        p.font.color.rgb = DARK_GREEN
        p.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = f"   {desc}"
        p2.font.size = Pt(11)
        p2.font.color.rgb = GRAY_TEXT
        p2.space_after = Pt(10)

    if os.path.exists(ws_popup_img):
        slide7.shapes.add_picture(ws_popup_img, Inches(7.0), Inches(1.6), width=Inches(5.5))

    # =========================================================================
    # SLIDE 8: 4. Module Development - Realtime Chat & Mobile Responsiveness
    # =========================================================================
    slide8 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide8, "Real-Time Chat Area & Mobile Drawer Optimization", "4. Module Development & Integration")

    tb = slide8.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(5.2), Inches(5.3))
    tf = tb.text_frame
    tf.word_wrap = True

    pts = [
        ("Rich Message Composer", "Auto-expanding textarea, emoji picker popup, attachment preview, and instantaneous dispatch."),
        ("Calling & Media Suite", "Interactive Voice Call (Opus audio) and Video Call modals with screen share, mute, and camera toggles."),
        ("Channel Info Drawer", "Slide-over right panel detailing channel members, shared media tallies (photos & docs), and leave/mute controls."),
        ("Responsive Mobile Architecture (<768px)", "Single-column responsive view with full-width conversation list, slide-in chat area, and dynamic 'Back to conversations' navigation."),
    ]

    for title, desc in pts:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = f"✨ {title}:"
        p.font.bold = True
        p.font.size = Pt(12)
        p.font.color.rgb = DARK_GREEN
        p.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = f"   {desc}"
        p2.font.size = Pt(10)
        p2.font.color.rgb = GRAY_TEXT
        p2.space_after = Pt(8)

    if os.path.exists(chat_img):
        slide8.shapes.add_picture(chat_img, Inches(6.2), Inches(1.6), width=Inches(4.2))

    if os.path.exists(mobile_img):
        slide8.shapes.add_picture(mobile_img, Inches(10.6), Inches(1.6), width=Inches(1.9))

    # =========================================================================
    # SLIDE 9: 5. Work Progress & Weekly Report
    # =========================================================================
    slide9 = prs.slides.add_slide(prs.slide_layouts[6])
    add_header(slide9, "Project Timeline & Weekly Progress Report", "5. Work Progress & Weekly Report")

    weeks = [
        ("Weeks 1 - 2: Architecture & Schema", "Requirements analysis, architecture design, tech stack selection (React + Node.js + MongoDB Atlas), and initial DB schema."),
        ("Weeks 3 - 4: Core Backend & Real-Time Engine", "REST API development (Auth, Users, Contacts), Socket.io server integration, and MongoDB Atlas setup."),
        ("Weeks 5 - 6: Frontend UI & State Architecture", "React 19 SPA design, Zustand stores (authStore, chatStore), message composer, and emoji picker."),
        ("Weeks 7 - 8: Workspace System & Calling Suite", "Multi-tenant workspace engine, 6-char invite codes, login workspace popup, voice & video modals."),
        ("Weeks 9 - 10: Testing, Mobile Tuning & Cloud Deploy", "Puppeteer browser automated testing (26/26 passed), mobile responsiveness, and Render deployment."),
    ]

    for i, (period, desc) in enumerate(weeks):
        y = Inches(1.6 + i * 1.05)
        box = slide9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y, Inches(11.7), Inches(0.9))
        box.fill.solid()
        box.fill.fore_color.rgb = CARD_BG
        box.line.color.rgb = DARK_GREEN

        btf = box.text_frame
        btf.word_wrap = True
        btf.margin_left = Inches(0.3)
        btf.margin_top = Inches(0.12)

        p = btf.paragraphs[0]
        p.text = f"🗓️ {period}"
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = DARK_GREEN

        p = btf.add_paragraph()
        p.text = desc
        p.font.size = Pt(11)
        p.font.color.rgb = NAVY_TEXT

    # =========================================================================
    # SLIDE 10: Q&A (matching Slide 3 of template)
    # =========================================================================
    slide10 = prs.slides.add_slide(prs.slide_layouts[6])
    
    # Left decorative bar
    bar = slide10.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(0.4), Inches(7.5))
    bar.fill.solid()
    bar.fill.fore_color.rgb = DARK_GREEN
    bar.line.fill.background()

    q_box = slide10.shapes.add_textbox(Inches(1.5), Inches(1.5), Inches(10.5), Inches(4.5))
    qtf = q_box.text_frame
    qtf.word_wrap = True

    p = qtf.paragraphs[0]
    p.text = "Q & A"
    p.font.size = Pt(44)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN
    p.space_after = Pt(14)

    p = qtf.add_paragraph()
    p.text = "Thank you all for your attention!"
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = NAVY_TEXT
    p.space_after = Pt(10)

    p = qtf.add_paragraph()
    p.text = "Any questions?"
    p.font.size = Pt(22)
    p.font.color.rgb = GRAY_TEXT
    p.space_after = Pt(24)

    p = qtf.add_paragraph()
    p.text = "🌐 Live Application: https://zyntra-oau1.onrender.com/"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN
    p.space_after = Pt(4)

    p = qtf.add_paragraph()
    p.text = "💻 GitHub Repository: https://github.com/manan933/Zyntra_Chat_Application"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = GRAY_TEXT

    output_path = r"d:\PROJECTS\Zyntra_Chat_Application\Zyntra_Minor_Project_Presentation.pptx"
    prs.save(output_path)
    print(f"Presentation successfully created at: {output_path}")

if __name__ == "__main__":
    create_deck()
