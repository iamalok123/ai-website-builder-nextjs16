# 🚀 AI Website Builder - Next.js 16 & React 19

![Next.js](https://img.shields.io/badge/Next.js-16.2.10-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-blue?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-22.14.0-339933?style=for-the-badge&logo=node.js)
![E2B Sandbox](https://img.shields.io/badge/E2B-Cloud_MicroVM_Sandbox-orange?style=for-the-badge)
![CodeMirror](https://img.shields.io/badge/CodeMirror-v6-black?style=for-the-badge)
![Vitest](https://img.shields.io/badge/Vitest-54_Tests_Passing-brightgreen?style=for-the-badge)
![Prisma](https://img.shields.io/badge/Prisma-7.8.0-1B222D?style=for-the-badge&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash-4285F4?style=for-the-badge&logo=google)
![Arcjet Security](https://img.shields.io/badge/Arcjet-Shield_%26_Bot_Protection-red?style=for-the-badge)
![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?style=for-the-badge&logo=render)

A full-stack, enterprise-grade AI Web Application & Component Builder powered by **Next.js 16 (App Router)**, **React 19**, and **Google Gemini 3.5 Flash**. The platform transforms natural language descriptions and visual wireframe inputs into production-ready React applications with real-time SSE AI thought streaming, in-browser CodeMirror 6 code editing, and live cloud container execution inside **E2B MicroVM sandboxes**.

---

## 🌟 What's New in Recent Updates

- 🚀 **Full-Stack MicroVM Architecture with Crash-Proof File Database:** Enabled full-stack website generation running both frontend (React 19 on port 3000) and backend (Express on port 3001) in isolated E2B microVMs. Pre-configured Vite reverse proxy (`/api/*` ──► `http://127.0.0.1:3001`), universal zero-dependency file-based persistent storage (`./database.json` and `./sqlite-shim.js`), automatic import sanitization for Node 20 microVM runtime compatibility, and optimistic UI updates for instant perceived responsiveness.
- 📱 **Mobile Resilience, Heartbeat Pings & Proxy Buffering Fix:** Added `"X-Accel-Buffering": "no"` to disable reverse proxy buffering on Render, coupled with 2.5-second SSE keepalive heartbeats (`: keepalive\n\n`) preventing mobile cellular carrier drops.
- 💾 **Unconditional Server-Side Database Persistence:** Decoupled database commits from client socket lifecycles, ensuring completed AI-generated applications are always saved to PostgreSQL even if a mobile device dims or encounters network jitter. Fixed Prisma compound unique indexing (`id_userId`).
- 📲 **Mobile View Auto-Transition:** Automatically shifts mobile view from chat to preview upon `done`, giving mobile users immediate visual confirmation of their generated full-stack web application.
- ☁️ **E2B Cloud MicroVM Sandbox Architecture:** Replaced client-only sandboxing with isolated Firecracker microVMs powered by E2B (`@e2b/code-interpreter`), running real Node.js and full-stack Vite 6 servers with live shareable external URLs (`https://3000-*.e2b.app`).
- 🖤 **High-Performance Pure Black CodeMirror 6 Editor:** Replaced the plain textarea with `@uiw/react-codemirror`, featuring a custom pure black theme (`#000000`), vivid neon syntax highlighting, bracket matching, auto-closing quotes/brackets, code folding, built-in search/replace (`Ctrl+F`), cursor Ln/Col stats, and auto-save sandbox sync badges.
- ⚡ **Debounced MicroVM Sync & Vite HMR Dual-Mirroring:** 300ms debounced file synchronization with `queueMicrotask` decoupling to avoid network saturation, immediate flush on tab switch to Preview, and automatic dual-mirroring of `App.jsx` across root and `src/` so Vite HMR updates in real time. Backend edits automatically hot-reload Express without microVM reboots.
- 🌐 **Unified Browser Omnibar Header:** Consolidated redundant controls into a single browser header toolbar with centered address pill, clipboard URL copy, instant iframe cache-busting reload (`?_t=Date.now()`), responsive viewport toggles (Desktop/Tablet/Mobile), popout window, and ZIP export via JSZip.
- 🎨 **Responsive Hexagon Background & Multi-Device Glow:** Enhanced `HexagonBackground` with dynamic responsive sizing (`42px` mobile, `52px` tablet, `60px` desktop) using `useSyncExternalStore`, mobile touch-drag coordinate tracking, scale popping (`scale-105`), and viewport clipping (`overflow-x-clip`) preventing horizontal shift.
- 🧪 **Enterprise Vitest Test Suite:** Added 56 comprehensive unit and integration tests across 12 test suites verifying sandbox lifecycle, language resolvers, HMR dual-mirroring, full-stack proxying, and AI parser resilience.
- 🛡️ **Guarded Atomic Credit Ledger & Stream Abort Protection:** Switched credit deductions to conditional Prisma transactions (`credits >= CREDIT_COST`) to prevent race-condition negative balances. Added client abort detection (`isClosed`) so interrupted or cancelled generations never deduct credits or commit partial files.
- 🔄 **Self-Healing User Provisioning:** Integrated automated `checkUser()` sync fallbacks across all project and workspace server actions, guaranteeing seamless auto-provisioning and concurrent sign-up handling without unexpected redirects.
- 🔌 **Global Prisma Pool Hardening:** Cached Prisma Client instance on `globalThis` across all environments (including production Node runtime on Render) to prevent connection pool exhaustion during chunk evaluation.

---

## ✨ Key Features

### 🧠 Real-Time AI Code Generation & Streaming
- **SSE Stream Processing:** Streams response "thought chunks" (e.g. *Analyzing prompt...*, *Structuring Tailwind layout...*, *Adding interactive state...*) via Server-Sent Events before delivering code.
- **Iterative Refinement:** Refine generated UI through follow-up prompts. Modify styling, add animations, or create sub-components dynamically via `@cline/sdk`.
- **NPM Registry Hallucination Shield:** Validates imported packages against the official NPM registry to prevent broken dependency imports in the sandbox.
- **Resilient Error Categorization:** Granular diagnostics for Gemini free-tier quota limits (429), high-demand server capacity (503), and connection drops.

### 💻 Cloud MicroVM Sandbox & CodeMirror 6 Editor
- **E2B MicroVM Execution:** Executes generated React 19, Tailwind CSS, and Vite 6 applications inside isolated Firecracker Linux microVMs running on port 3000.
- **Zero Local Setup:** Instant visual feedback with live HTTPS public URLs and WebSocket HMR.
- **CodeMirror 6 IDE:** Full-featured pure black IDE with line numbers, active line highlighting, bracket matching, code folding, search & replace, and breadcrumbs.
- **Bi-Directional Code Synchronization:** Automatic 300ms debounced sync from the editor to the active cloud sandbox, with 3000ms debounced persistence to PostgreSQL.

### 🔐 Authentication & Atomic Credit Economy
- **Clerk Authentication:** Frictionless user sign-up, sign-in, and session management (`@clerk/nextjs`) with resilient fallback handlers for concurrent user creation.
- **Atomic Credit Ledger:** New users receive 10 initial credits. Deductions use conditional atomic operations (`credits: { gte: CREDIT_COST }`) executed only upon successful stream completion, safeguarding users from credit loss during network disconnects.
- **Non-Blocking Credit Streaming:** Credits are fetched asynchronously via client-side `UserCreditBadge`, keeping navbar rendering blazing fast without blocking SSR.

### 🛡️ Enterprise-Grade Security
- **Arcjet Security Engine:** Integrated `@arcjet/next` to block bot pings, mitigate AI prompt injection attacks, and shield against malicious rate abuse.
- **Server Action Protection:** Authenticated user session checks and row-level workspace ownership enforcement across all Server Actions.

---

## 🏗️ Architecture & Data Flow

```mermaid
graph TD
    User([User Browser]) -->|HTTP / SSE Request| NextApp[Next.js 16 App Router]
    NextApp -->|Session Auth| Clerk[Clerk Auth Provider]
    NextApp -->|Bot & Threat Check| Arcjet[Arcjet Security Engine]
    NextApp -->|Stream Prompt & History| Gemini[Google Gemini 3.5 Flash]
    NextApp -->|Validate NPM Packages| NPMRegistry[NPM Registry API]
    NextApp -->|Atomic Transaction| Prisma[Prisma 7 ORM]
    Prisma -->|PostgreSQL| Supabase[(Supabase DB)]
    NextApp -->|Launch / Sync Files| E2B[E2B Cloud MicroVM]
    E2B -->|Port 3000 HTTPS Proxy| User
```

---

## 🛠️ Tech Stack & Core Dependencies

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js | `16.2.10` | App Router, Server Actions, Dynamic Streaming |
| **Frontend Library** | React / React DOM | `19.2.4` | React Concurrent Features, Modern Hooks & `useSyncExternalStore` |
| **Runtime Engine** | Node.js | `>=22.12.0 <24.0.0` | Node 22 LTS compatibility for Prisma 7 |
| **AI Model & SDK** | Google GenAI (`@google/genai`) | `2.12.0` | Streaming code generation via Gemini 3.5 Flash |
| **Cloud Sandbox** | E2B (`e2b`) | `^2.62.0` | Firecracker microVM cloud execution engine |
| **Code Editor** | CodeMirror 6 (`@uiw/react-codemirror`) | `^4.25.12` | Pure black IDE editor with multi-language syntax highlighting |
| **Testing Suite** | Vitest (`vitest`) | `^5.0.5` | Unit and integration test runner (53 tests passing) |
| **Database & ORM** | Prisma / Supabase | `7.8.0` / `2.110.6` | PostgreSQL relational database & client adapter |
| **Authentication** | Clerk | `7.5.18` | User identity & route middleware security |
| **Security Shield** | Arcjet | `1.8.0` | Bot detection, rate-limiting, prompt injection shield |
| **Styling & Motion** | Tailwind CSS v4 / Framer Motion | `v4` / `12.42.2` | Utility-first styling & micro-animations |

---

## 📁 Project Directory Structure

```text
ai_website_builder_nextjs_16/
├── actions/                         # Server Actions (Database mutations & queries)
│   ├── projects.ts                  # Fetching, listing, and deleting user projects (with auto-provisioning)
│   ├── user.ts                      # Asynchronous credit & subscription plan retrieval
│   └── workspace.ts                 # Workspace retrieval and file update mutations
├── app/                             # Next.js 16 App Router Entry Point
│   ├── (auth)/                      # Clerk authentication routes (Sign In / Sign Up)
│   │   ├── sign-in/[[...sign-in]]/  # Sign-in route handlers
│   │   └── sign-up/[[...sign-up]]/  # Sign-up route handlers
│   ├── (main)/                      # Main Application Area
│   │   ├── projects/                # Dashboard listing user saved workspaces
│   │   │   ├── loading.tsx          # Project grid skeleton loading handler
│   │   │   └── page.tsx             # User projects grid page
│   │   └── workspace/[id]/          # AI Workspace page
│   │       ├── loading.tsx          # Instant workspace loading state
│   │       └── page.tsx             # Workspace main layout view
│   ├── api/                         # SSE & Utility API Route Handlers
│   │   ├── gen-ai-code/             # SSE endpoint for initial workspace generation
│   │   ├── improve/                 # SSE endpoint for iterative code edits
│   │   ├── sandbox/                 # E2B Cloud MicroVM lifecycle management
│   │   └── health/                  # Healthcheck endpoint for Render / Uptime monitoring
│   ├── globals.css                  # Global styles & custom animations
│   ├── layout.tsx                   # Root layout, theme providers, & Clerk provider
│   ├── not-found.tsx                # Custom 404 page
│   └── page.tsx                     # Landing page with demo preview & marquee suggestions
├── components/                      # Reusable UI Components
│   ├── ChatPanel.tsx                # AI Chat interface, message list, & thought chunks
│   ├── CodePanel.tsx                # Browser omnibar toolbar & preview frame container
│   ├── Header.tsx                   # Main navigation header (non-blocking)
│   ├── MobileHeaderMenu.tsx         # Mobile drawer menu navigation with lazy credit sync
│   ├── ProjectCard.tsx              # Project preview card with action triggers
│   ├── UserCreditBadge.tsx          # Asynchronous client credit badge with pricing modal
│   ├── WorkspaceClient.tsx          # Client state wrapper for Chat & Code panels
│   ├── editor/                      # CodeMirror 6 Editor Components
│   │   ├── CodeMirrorEditor.tsx     # Pure black IDE editor with live stats & copy triggers
│   │   └── editor-theme.ts          # Custom high-contrast syntax highlighting & language resolvers
│   ├── theme-provider.tsx           # Dark/light theme provider wrapper
│   └── ui/                          # Primitive UI components (Shadcn / Base UI)
├── lib/                             # Core Utilities & Configuration
│   ├── arcjet.ts                    # Arcjet security rules configuration
│   ├── checkUser.ts                 # Resilient Clerk-to-Prisma user sync & auto-provisioning
│   ├── constants.ts                 # Application constants (e.g. credit cost rules)
│   ├── data.ts                      # Landing page mock dataset & prompts
│   ├── e2b.ts                       # E2B cloud sandbox microVM lifecycle & file synchronization
│   └── prisma.ts                    # Prisma Client instance with universal globalThis caching
├── prisma/                          # Database Modeling & Migrations
│   └── schema.prisma                # Relational User & Workspace schema
├── proxy.ts                         # Custom Middleware proxy (Clerk & Arcjet guard)
├── render.yaml                      # Render deployment configuration blueprint
├── tests/                           # Vitest Automated Test Suite (53 Tests)
│   ├── ai/                          # AI parsing and prompt routing tests
│   ├── api/                         # API route health and sandbox tests
│   ├── database/                    # Workspace schema and project action tests
│   ├── e2b/                         # E2B cloud microVM lifecycle & scaffolding tests
│   ├── editor/                      # CodeMirror language resolvers & HMR dual-mirror tests
│   └── file-tree/                   # Virtual file tree hierarchy and icon tests
├── .node-version                    # Node engine specification (22.14.0)
└── package.json                     # Node dependencies & build scripts
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root directory using `.env.example` as a template:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Google Gemini AI API Key
GEMINI_API_KEY=AIzaSy...

# Database URLs (Supabase / PostgreSQL)
# DATABASE_URL uses pooled connection (pgbouncer=true)
DATABASE_URL="postgresql://user:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
# DIRECT_URL uses direct connection (for migrations)
DIRECT_URL="postgresql://user:password@aws-0-region.pooler.supabase.com:5432/postgres"

# Arcjet Security Key
ARCJET_KEY=ajkey_...

# Optional Subscription Plan IDs
NEXT_PUBLIC_CLERK_STANDARD_PLAN_ID=cplan_...
NEXT_PUBLIC_CLERK_PRO_PLAN_ID=cplan_...
```

---

## 🚀 Getting Started

### 1. System Requirements
- **Node.js:** `v22.12.0` or higher (v22.14.0 recommended)
- **NPM / PNPM / Yarn:** Package manager of your choice
- **PostgreSQL Database:** Supabase or local PostgreSQL instance

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/ai_website_builder_nextjs_16.git

# Navigate into the project folder
cd ai_website_builder_nextjs_16

# Install dependencies
npm install
```

### 3. Database Migration
Generate the Prisma Client and sync your relational database schema:
```bash
# Generate Prisma Client (runs automatically on postinstall)
npm run postinstall

# Push database schema to PostgreSQL
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to start building.

---

## 📜 NPM Scripts Overview

| Command | Action |
| :--- | :--- |
| `npm run dev` | Boots up Next.js 16 development server on `localhost:3000` |
| `npm run build` | Enforces `NODE_ENV=production` and creates an optimized Next.js production build |
| `npm start` | Executes `prisma migrate deploy` followed by starting the production server |
| `npm run postinstall` | Automatically triggers `prisma generate` after package installs |
| `npm run lint` | Runs ESLint validation across all TypeScript and React files |

---

## 📡 API Endpoint Reference

### 1. `POST /api/gen-ai-code`
- **Description:** Generates new workspace components and files from user prompt.
- **Workflow:**
  1. Authenticates Clerk user session & verifies available credits.
  2. Runs Arcjet threat detection & prompt injection check.
  3. Sends request to Google Gemini 3.5 Flash.
  4. Streams SSE event logs (`thought` chunks and code payload).
  5. Monitors client connection state (`isClosed`) — aborts without saving or charging if client disconnects.
  6. Validates NPM dependencies against registry.
  7. Executes atomic transaction with conditional balance check (`credits >= CREDIT_COST`) to deduct credit and save Workspace.
  8. Gracefully handles and categorizes upstream API exceptions (429 rate limit, 503 high demand, connection resets).

### 2. `POST /api/improve`
- **Description:** Refines, fixes bugs, or updates existing workspace code files via iterative AI prompts.
- **Workflow:**
  1. Validates workspace ownership, existing files, and credit balance.
  2. Generates updated file structures with Gemini 3.5 Flash and streams diff thoughts.
  3. Checks connection liveness before committing updates.
  4. Deducts credit atomically with balance guard and broadcasts completed payload.

### 3. `GET /api/health`
- **Description:** Lightweight health monitoring endpoint returning system status `200 OK` for uptime monitors (e.g. Render keep-alive cron jobs).

---

## ☁️ Deployment Guide

### Deploying to Render
1. Connect your repository to **Render**.
2. Render automatically detects `render.yaml` blueprint.
3. Node engine is pinned via `.node-version` (`22.14.0`).
4. Health checks run against `/api/health`.
5. Set required secret environment variables (`GEMINI_API_KEY`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `ARCJET_KEY`) in the Render Dashboard.

### Deploying to Vercel
1. Import repository into **Vercel**.
2. Configure Environment Variables in the project settings.
3. Ensure `DATABASE_URL` uses the pooled connection string (`pgbouncer=true`).
4. Set Build Command to `npm run build`.
5. Deploy!

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check out the repository issues page.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git checkout -b feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
