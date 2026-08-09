# 🚀 AI Website Builder - Next.js 16 & React 19

![Next.js](https://img.shields.io/badge/Next.js-16.2.10-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-blue?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-22.14.0-339933?style=for-the-badge&logo=node.js)
![Prisma](https://img.shields.io/badge/Prisma-7.8.0-1B222D?style=for-the-badge&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash-4285F4?style=for-the-badge&logo=google)
![Arcjet Security](https://img.shields.io/badge/Arcjet-Shield_%26_Bot_Protection-red?style=for-the-badge)
![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?style=for-the-badge&logo=render)

A full-stack, enterprise-grade AI Web Application & Component Builder powered by **Next.js 16 (App Router)**, **React 19**, and **Google Gemini 3.5 Flash**. The platform transforms natural language descriptions and visual inputs into production-ready React applications with real-time SSE AI thought streaming and instant in-browser Sandpack execution.

---

## 🌟 What's New in Recent Updates

- 🎨 **Landing Page & Theme Overhaul:** Complete redesign featuring an orange accent dark-workspace mockup, floating glassmorphic navbar, unified demo preview, and marquee prompt suggestion chips.
- 📱 **Responsive Mobile Navigation:** Added a sleek `MobileHeaderMenu` with drawer navigation for mobile devices.
- ⚡ **Instant Workspace & Project Loading:** Introduced dedicated Next.js 16 loading boundary screens (`workspace/loading.tsx` and `projects/loading.tsx`) and optimized server actions to deliver faster perceived load times.
- 🛠️ **Deployment & Health Monitoring:** Added `/api/health` health check route, `proxy.ts` middleware exception for keep-alive pings, and complete `render.yaml` configuration.
- 🔒 **Node 22 & Prisma 7 Upgrade:** Upgraded engine requirements (`Node >= 22.12.0`) to ensure full compatibility with Prisma 7 ORM and client adapter performance.

---

## ✨ Key Features

### 🧠 Real-Time AI Code Generation & Streaming
- **SSE Stream Processing:** Streams response "thought chunks" (e.g. *Analyzing prompt...*, *Structuring Tailwind layout...*, *Adding interactive state...*) via Server-Sent Events before delivering code.
- **Iterative Refinement:** Refine generated UI through follow-up prompt prompts. Modify styling, add animations, or create sub-components dynamically.
- **NPM Registry Hallucination Shield:** Validates imported packages against the official NPM registry to prevent broken dependency imports in Sandpack.

### 💻 In-Browser Interactive Execution Sandbox
- **Powered by Sandpack:** Runs generated React 19 and Tailwind CSS code directly inside an isolated browser sandbox (`@codesandbox/sandpack-react`).
- **Zero Local Setup:** Instant visual feedback without compiling or installing dependencies locally.

### 🔐 Authentication & Atomic Credit Economy
- **Clerk Authentication:** Frictionless user sign-up, sign-in, and session management (`@clerk/nextjs`).
- **Atomic Credit Ledger:** New users receive 10 initial credits. Credits are deducted via atomic Prisma database transactions (`db.$transaction`) only upon successful code generation.

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
    NextApp -->|Virtual File Tree| Sandpack[Sandpack Sandbox]
    Sandpack -->|Live Preview Render| User
```

---

## 🛠️ Tech Stack & Core Dependencies

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js | `16.2.10` | App Router, Server Actions, Dynamic Streaming |
| **Frontend Library** | React / React DOM | `19.2.4` | React Concurrent Features & Modern Hooks |
| **Runtime Engine** | Node.js | `>=22.12.0 <24.0.0` | Node 22 LTS compatibility for Prisma 7 |
| **AI Model & SDK** | Google GenAI (`@google/genai`) | `2.12.0` | Streaming code generation via Gemini 3.5 Flash |
| **Sandbox Execution** | Sandpack React & Themes | `2.20.0` / `2.0.21` | In-browser client execution engine |
| **Database & ORM** | Prisma / Supabase | `7.8.0` / `2.110.6` | PostgreSQL relational database & client adapter |
| **Authentication** | Clerk | `7.5.18` | User identity & route middleware security |
| **Security Shield** | Arcjet | `1.8.0` | Bot detection, rate-limiting, prompt injection shield |
| **Styling & Motion** | Tailwind CSS v4 / Framer Motion | `v4` / `12.42.2` | Utility-first styling & micro-animations |

---

## 📁 Project Directory Structure

```text
ai_website_builder_nextjs_16/
├── actions/                         # Server Actions (Database mutations & queries)
│   ├── projects.ts                  # Fetching, listing, and deleting user projects
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
│   │   └── health/                  # Healthcheck endpoint for Render / Uptime monitoring
│   ├── global-error.tsx             # Global application error boundary
│   ├── globals.css                  # Global styles & custom animations
│   ├── layout.tsx                   # Root layout, theme providers, & Clerk provider
│   ├── not-found.tsx                # Custom 404 page
│   └── page.tsx                     # Redesigned Landing Page with demo preview & marquee
├── components/                      # Reusable UI Components
│   ├── ChatPanel.tsx                # AI Chat interface, message list, & thought chunks
│   ├── CodePanel.tsx                # Sandpack editor & live browser preview toggle
│   ├── Header.tsx                   # Main navigation header
│   ├── MobileHeaderMenu.tsx         # Mobile drawer menu navigation
│   ├── ProjectCard.tsx              # Project preview card with action triggers
│   ├── WorkspaceClient.tsx          # Client state wrapper for Chat & Code panels
│   ├── theme-provider.tsx           # Dark/light theme provider wrapper
│   └── ui/                          # Primitive UI components (Shadcn / Base UI)
├── lib/                             # Core Utilities & Configuration
│   ├── arcjet.ts                    # Arcjet security rules configuration
│   ├── constants.ts                 # Application constants (e.g. credit cost rules)
│   ├── data.ts                      # Landing page mock dataset & prompts
│   └── prisma.ts                    # Prisma Client initialization instance
├── prisma/                          # Database Modeling & Migrations
│   └── schema.prisma                # Relational User & Workspace schema
├── proxy.ts                         # Custom Middleware proxy (Clerk & Arcjet guard)
├── render.yaml                      # Render deployment configuration blueprint
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
  5. Validates NPM dependencies against registry.
  6. Executes atomic database transaction to deduct credit and save Workspace.

### 2. `POST /api/improve`
- **Description:** Refines, fixes bugs, or updates existing workspace code files via iterative AI prompts.

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
