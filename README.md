# 🚀 AI Website Builder - Next.js 16

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![Prisma](https://img.shields.io/badge/Prisma-ORM-1B222D?style=for-the-badge&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash-4285F4?style=for-the-badge&logo=google)
![Arcjet](https://img.shields.io/badge/Arcjet-Security-red?style=for-the-badge)

## 📖 Introduction

Welcome to the **AI Website Builder**, an advanced, highly-interactive platform that bridges the gap between natural language and functional code. Engineered with the cutting-edge **Next.js 16 (App Router)** and **React 19**, this application allows users to describe their desired web application, component, or layout in simple text, and watch it come to life in a live, in-browser execution sandbox.

By leveraging Google's **Gemini 3.5 Flash AI model**, the platform translates prompts into fully functional, styled, and validated React code. It's designed to accelerate development, aid prototyping, and lower the barrier to entry for modern web development.

---

## ✨ Comprehensive Feature Set

### 🧠 Advanced AI Code Generation
- **Intelligent Prompt Processing:** Converts natural language and even image inputs into complete, production-ready React applications.
- **Server-Sent Events (SSE) Streaming:** Delivers AI responses in real-time. You see "thought chunks" (e.g., *Designing layout...*, *Adding interactivity...*) for an engaging UX before the final code is rendered.
- **Iterative Refinement:** After the initial generation, continue the conversation. Ask the AI to change colors, add animations, or refactor components, and watch the preview update instantly.

### 💻 Live Browser Sandbox
- **Sandpack Integration:** Uses CodeSandbox's `@codesandbox/sandpack-react` to execute the generated React and Tailwind code securely inside the browser.
- **No Local Setup Required:** Users can test their generated apps immediately without configuring Webpack, Vite, or a local Node.js environment.

### 🔐 Robust Authentication & User Management
- **Clerk Auth:** Secure, frictionless sign-ups, sign-ins, and session management using `@clerk/nextjs`.
- **Credit-Based System:** Users start with a free tier of 10 credits. Each generation deducts a credit via atomic Prisma transactions, ensuring fairness and preventing abuse.

### 🛡️ Enterprise-Grade Security
- **Arcjet Protection:** Deeply integrated `@arcjet/next` to block bots, enforce rate-limiting, and protect against AI Prompt Injections and sensitive data leaks.

### 🗄️ Reliable Data Persistence
- **Prisma & PostgreSQL:** Scalable relational data modeling hosted on Supabase.
- **Workspace Management:** Every conversation is saved as a discrete Workspace, preserving chat history, generated files, and npm dependencies.

### 🎨 Modern UI & Animations
- **Shadcn UI & Base UI:** Accessible, beautiful component primitives.
- **Tailwind CSS v4 & Framer Motion:** Fluid page transitions, micro-interactions, and comprehensive dark/light mode support.

---

## 🏗️ Technology Stack

### Frontend Architecture
- **Framework:** Next.js 16.2.10 (App Router)
- **Library:** React 19
- **Styling:** Tailwind CSS v4, PostCSS
- **Components:** Shadcn UI, Base UI, Lucide React
- **Animations:** Framer Motion 12, Tailwind Animate CSS
- **Code Execution:** Sandpack React & Themes

### Backend & AI Integration
- **Generative AI:** Google GenAI SDK (`@google/genai`)
- **API Architecture:** Next.js Route Handlers with Server-Sent Events (SSE)
- **Timeout Management:** Vercel Fluid dynamic max duration handling (up to 300 seconds for complex generations)
- **Validation:** Zod (Schema validation), NPM registry validation (hallucinated package prevention)

### Database, Auth & Security
- **ORM:** Prisma Client 7.8
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Clerk
- **Security:** Arcjet

---

## 🗃️ Database Schema Overview

The application utilizes Prisma to manage relations between Users and Workspaces.

### `User` Model
- Handles Clerk identity mapping (`clerkId`).
- Tracks available `credits` (defaults to 10) and subscription `plan`.
- Maintains profile metadata (`name`, `email`, `imageUrl`).

### `Workspace` Model
- Represents an individual project or chat session.
- `userId` (Foreign Key referencing `User`).
- `messages` (JSON array tracking the chat history for context).
- `fileData` (JSON object holding the generated virtual file system and dependencies).

---

## 🛠️ Project Structure

```text
├── actions/              # Next.js Server Actions (Database mutations & queries)
│   ├── projects.ts       # Logic for fetching & deleting user projects
│   └── workspace.ts      # Logic for workspace retrieval & file updates
├── app/                  # Next.js 16 App Router Entry Point
│   ├── (auth)/           # Clerk authentication routes (Sign In / Sign Up)
│   ├── (main)/           # Primary application UI (Workspaces, Projects)
│   ├── api/              # API Route Handlers
│   │   ├── gen-ai-code/  # SSE Route handling Gemini interaction
│   │   └── improve/      # SSE Route for refining code
│   ├── layout.tsx        # Global Layout, Fonts, Providers
│   └── page.tsx          # Landing / Entry Page
├── components/           # Reusable React UI Components
│   ├── ChatPanel.tsx     # Chat interface and message tracking
│   ├── CodePanel.tsx     # Sandpack preview and code editor
│   ├── WorkspaceClient.tsx # Wrapper coordinating chat and code panels
│   └── ui/               # Shadcn UI primitives
├── lib/                  # Utility functions and configurations
│   ├── arcjet.ts         # Arcjet security configuration
│   ├── prisma.ts         # Prisma client instantiation
│   └── constants.ts      # App-wide constants (e.g., Credit costs)
└── prisma/               # Database Modeling
    └── schema.prisma     # Relational database schema
```

---

## ⚙️ Environment Variables Setup

Before running the project locally, create a `.env` file in the root directory and populate it with the following keys. Refer to `.env.example` for defaults.

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Google Gemini API
GEMINI_API_KEY=AIzaSy...

# Database (Supabase / PostgreSQL)
DATABASE_URL="postgresql://user:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@aws-0-region.pooler.supabase.com:5432/postgres"

# Arcjet Security
ARCJET_KEY=ajkey_...
```

---

## 🚀 Getting Started Guide

### 1. Prerequisites
Ensure you have the following installed:
- Node.js (v20+ recommended)
- npm or yarn or pnpm
- A Supabase project (for the PostgreSQL database)
- A Clerk application (for authentication)
- Google Gemini API Key

### 2. Installation
Clone the repository and install all required dependencies:
```bash
git clone https://github.com/your-username/ai_website_builder_nextjs_16.git
cd ai_website_builder_nextjs_16
npm install
```

### 3. Database Migration
Generate the Prisma client and push the schema to your remote PostgreSQL database:
```bash
npm run postinstall
npx prisma db push
```

### 4. Running the Development Server
Start the Next.js development server:
```bash
npm run dev
```

Navigate your browser to [http://localhost:3000](http://localhost:3000) to experience the AI builder locally.

---

## 📜 Available Scripts

The `package.json` includes several scripts for development and deployment:

- `npm run dev`: Starts the Next.js development server on port 3000.
- `npm run build`: Creates an optimized production build of your application.
- `npm run start`: Runs database migrations (`npx prisma migrate deploy`) and then starts the Next.js production server.
- `npm run postinstall`: Generates the Prisma Client automatically after dependencies are installed.
- `npm run lint`: Runs ESLint to statically analyze your code and find potential issues.

---

## 📡 Core API Endpoints

### `POST /api/gen-ai-code`
- **Purpose:** Handles the core code generation loop.
- **Flow:**
  1. Authenticates user via Clerk and checks credit balance via Prisma.
  2. Protects against prompt injections and bots using Arcjet.
  3. Prepares context (previous messages, existing file states, images).
  4. Streams the prompt to Gemini 3.5 Flash.
  5. Emits real-time SSE updates (thought processes and status).
  6. Validates hallucinated npm packages against the actual npm registry.
  7. Deducts credits and saves the new Workspace to the database via an atomic transaction.

### `POST /api/improve`
- **Purpose:** A lighter endpoint designated for specifically refactoring or fixing bugs in existing workspaces.

---

## 💳 Credit System Architecture

To manage API usage and costs:
- Every new user is initialized with **10 credits** via the Prisma Schema default.
- Every successful AI code generation deducts `CREDIT_COST_PER_GENERATION` (configured in `lib/constants.ts`).
- Transactions are **Atomic**: The database update that deducts the credit and saves the generated workspace happens in a single `db.$transaction`. If the AI fails, returns invalid JSON, or the connection breaks, the user is never charged.

---

## 🛡️ Security Implementation Details

Security is a first-class citizen in this architecture:
- **Authentication Walls:** All API routes strictly verify Clerk sessions before invoking database or AI logic.
- **Arcjet Protection:** The `aj.protect()` layer intercepts requests to prevent abuse. It specifically targets prompt injections (preventing malicious users from overriding the system prompt) and scrubs sensitive information.
- **Database Access:** Server Actions are used extensively, preventing direct database exposure to the client. Ownership checks (`userId === session.userId`) are enforced on every read/write operation.

---

## 🐛 Troubleshooting Common Issues

**1. Prisma Client Errors on Vercel:**
If you encounter `PrismaClientInitializationError` in production, ensure that your `DATABASE_URL` is using the pooled connection string (with `?pgbouncer=true`) and `DIRECT_URL` is using the non-pooled connection string.

**2. Arcjet Blocking Requests Locally:**
If Arcjet blocks you during local development, ensure your `ARCJET_KEY` is configured for development mode. Check your Arcjet dashboard to whitelist your local IP if necessary.

**3. Sandpack Previews Not Updating:**
Because Sandpack caches dependencies heavily in the browser, if an injected npm package is failing to load, try doing a hard refresh in your browser or clear local storage.

**4. AI Returning "Invalid JSON" errors:**
The prompt strictly enforces a JSON response format. If the request exceeds max tokens, the JSON might become malformed. The platform catches this and emits an error event *without deducting user credits*. Try breaking down the prompt into smaller, iterative steps.

---

## ☁️ Deployment

The application is fully optimized for deployment on Vercel.

1. Connect your GitHub repository to Vercel.
2. Inject all required Environment Variables into the Vercel dashboard.
3. Ensure the Build Command is set to `npm run build`.
4. Deploy!

Because it uses Next.js App Router and Prisma, it's highly recommended to utilize connection pooling (`pgbouncer=true` in `DATABASE_URL`) to manage Vercel Serverless scaling efficiently.

---

## 🤝 Contributing & Feedback

Contributions are highly welcomed! Whether it's adding a new UI feature, optimizing the Gemini prompts, or improving the Sandpack integration, your pull requests are appreciated.

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.
