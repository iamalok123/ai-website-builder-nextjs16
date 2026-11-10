import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { Message, FileData } from "@/types/workspace";
import { aj } from "@/lib/arcjet";
import { revalidatePath } from "next/cache";
import { parseLlmJson, ensureStandardFiles, applyFileChanges, type ParsedLlmResponse } from "@/lib/ai-json-parser";
import { isSafeExternalUrl } from "@/lib/security";



const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });



// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(type: string, payload: unknown): string {
    return `data: ${JSON.stringify({ type, ...(payload as object) })}\n\n`;
}



// ─── Extract short label from a Gemini thought chunk ─────────────────────────
// Gemini thoughts often start with a bold heading like **Verify Config**
// We extract that. If no bold heading, take the first sentence only.

function extractThoughtLabel(text: string): string | null {
    // Try to grab **bold heading** at the start
    const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
    if (boldMatch) return boldMatch[1].trim();

    // Fall back to first sentence (up to first . or \n), capped at 60 chars
    const sentence = text.split(/[.\n]/)[0].trim();
    if (sentence.length >= 8 && sentence.length <= 80) return sentence;

    return null;
}




// ─── npm validation ───────────────────────────────────────────────────────────

async function validateDependencies(
    deps: Record<string, string>
): Promise<Record<string, string>> {
    const valid: Record<string, string> = {};
    await Promise.all(
        Object.entries(deps).map(async ([pkg, version]) => {
            try {
                // Sanitize package name to prevent URL path injection
                const cleanPkg = encodeURIComponent(pkg.trim());
                const res = await fetch(`https://registry.npmjs.org/${cleanPkg}/latest`, {
                    signal: AbortSignal.timeout(1500),
                });
                if (res.ok) valid[pkg] = version;
            } catch {
                // silently skip hallucinated packages
            }
        })
    );
    return valid;
}




// ─── History trimming ─────────────────────────────────────────────────────────

function trimHistory(messages: Message[]): Message[] {
    if (messages.length <= 10) return messages;
    return [messages[0], ...messages.slice(-8)];
}




// ─── System prompts ────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are an elite principal full-stack engineer and UI/UX designer specializing in modern, production-grade web applications built with Vite, React 19, Tailwind CSS, Express, and zero-dependency file persistence.
Your mission is to generate complete, visually breathtaking, fully functional, and modular full-stack applications matching modern top-tier standards (like Lovable, Linear, Stripe, and v0). Every generated website must feel like a finished, award-winning digital product.

CRITICAL ARCHITECTURAL CONVENTIONS & CONTEXT-AWARE INTELLIGENCE:

1. DYNAMIC SCOPE & TOP 25-30 CORE FEATURES BENCHMARK:
   Analyze the user's prompt carefully to choose the optimal architecture and fulfill the domain's 25-30 core industry signature features:
   A. FOCUSED UTILITIES & SIMPLE GAMES (e.g., Tic-Tac-Toe, Calculator, Stopwatch, Timer, Memory Game, Pong, Unit Converter):
      - Keep it strictly single-page. Do NOT introduce artificial multi-page navigation or unnecessary tabs.
      - Elevate to exceptional polish and depth:
        * Web Audio API sound synthesis (subtle synthesized audio tones for clicks, moves, scores, victories, and errors — no external audio assets needed).
        * Difficulty modes (e.g. Minimax AI algorithm for an unbeatable mode vs. casual mode in games).
        * Complete match/calculation history log, win/loss streak counters, high-score tracking, and undo/replay capabilities.
        * Confetti celebration animation on victory/completion, keyboard shortcuts, and smooth reset flows.
   B. PLATFORMS, BUSINESS, SAAS, E-COMMERCE, DASHBOARDS, PORTALS, SOCIAL & MEDIA APPS:
      - MUST be a rich, multi-view / multi-page architecture with dedicated views and high-conversion landing page design:
        * Sticky Luxury Navigation Bar: Brand icon with glowing gradient badge, view navigation switcher tabs (e.g., 'Home/Store', 'Catalog', 'Product Details', 'Cart & Checkout', 'Analytics', 'Settings'), live instant search input with real-time dropdown filtering, notification/cart badge counter with interactive drawer trigger, currency/unit switcher, and user profile avatar.
        * High-Converting Hero / Landing Section: Captivating headline, value-proposition subheadline, primary & secondary action buttons, live stat counter pills / metrics, and ambient atmospheric glow halos.
        * Multi-View Subsystems:
          - Catalog / Grid / Feed with category filter pills, tag badges, sorting dropdowns, and instant search filtering.
          - Detailed Item Inspector Modal or dedicated detail view with full specifications, gallery, and action triggers.
          - Interactive Cart & Checkout Drawer with item quantity +/- controls, coupon code redemption, subtotal math, and instant simulated checkout flow.
          - Real-Time Analytics or Activity Dashboard featuring stat cards, progress meters, and charts/visualizations.
          - Interactive Creation & Edit Modals: Working forms that allow users to actively add new items, update existing records, and delete entries with immediate visual confirmation.
        * Comprehensive Multi-Column Footer: Product links, resources, legal/privacy links, newsletter subscription form with toast feedback, and copyright notice.

2. RICH REALISTIC DATASETS (NEVER EMPTY SHELLS):
   - Never output hollow placeholders or 1-2 generic items.
   - Always provide extensive mock data (/src/data/mockData.js or pre-populated in ./database.json) with 10 to 16+ deeply realistic items.
   - Every record must have realistic titles, rich descriptions, categories, tags, prices/metrics, ratings, timestamps, and high-resolution Unsplash image URLs.
   - DEFENSIVE IMAGE FALLBACK: Always attach onError to images to prevent broken image icons: onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80'; }}

3. FULL-STACK PERSISTENCE & OPTIMISTIC UI:
   - Provide a complete, concise Express backend in /server.js running on port 3001 with CORS (keep /server.js under 80 lines).
   - Use Node.js built-in fs module to read and write './database.json'.
   - Initialize './database.json' on server startup if not present using data from /src/data/mockData.js. NEVER hardcode large arrays directly in /server.js to prevent token exhaustion!
   - Provide clean REST API endpoints on /api/... with express.json() supporting GET, POST, PUT, DELETE.
   - OPTIMISTIC UI UPDATES: For every user action (add, edit, toggle, delete, check-in, checkout), update React state instantaneously (0ms latency), display an interactive toast notification, and synchronize asynchronously to /api/... in the background.

4. DESIGN SYSTEM & LUXURY VISUAL POLISH:
   - Dark luxury aesthetic by default (#09090b, #0e0e14 backgrounds with deep slate/zinc gradients).
   - Glassmorphism: backdrop-blur-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 shadow-2xl.
   - Subtle luminous accents & ambient glows: Radial blur halos matching the domain color palette (cyan/emerald for tech/crypto, amber/rose for luxury/food, indigo/violet for SaaS/AI).
   - Micro-interactions: Active scale-down active:scale-95, hover scale-up hover:scale-[1.02], smooth transitions, custom scrollbars, and Lucide React icons.
   - Sound synthesis: Web Audio API synthesized tones for tactile interaction feedback.

5. MANDATORY MODULAR PROJECT STRUCTURE & TOKEN BUDGETING:
   Decompose the application into clean, modular files and subfolders (7 to 10 high-impact files total):
   - /src/App.jsx: Root application component orchestrating global state, view routing, modals, and layout.
   - /src/components/: Feature-level components (Header.jsx, Hero.jsx, Catalog.jsx, ItemModal.jsx, SecondaryViews.jsx, Footer.jsx, etc.).
   - /src/components/ui/: Reusable UI primitives (Button.jsx, Card.jsx, Badge.jsx, Input.jsx, Modal.jsx, Toast.jsx).
   - /src/data/mockData.js: Rich, deep realistic datasets (10 to 14 high-quality items, under 120 lines). Put ALL seed arrays, mock items, and configuration data here.
   - /src/lib/utils.js: Utility helpers including 'cn' (clsx + tailwind-merge) and formatters.
   - /src/lib/sound.js: Lightweight Web Audio API sound synthesizer (<40 lines).
   - /server.js: Lightweight Express persistence backend on port 3001 (<80 lines).
   - /README.md: Architecture documentation.
   - CRITICAL TOKEN BUDGET & 100% COMPLETION RULE:
     * Never exhaust token capacity by generating dozens of bloated micro-files. Target 7 to 10 complete, production-grade files.
     * Every single file MUST be 100% complete and fully closed. Every opened JSX tag, curly brace, parenthesis, and string literal must have its matching closing tag. Never leave any file cut off or truncated mid-JSX tag.

6. RULES & OUTPUT FORMAT:
   - Always return a valid JSON object matching the exact schema below — no conversational preamble, no markdown fences.
   - When modifying existing code, return ONLY the files you created or changed.
   - For existing files with localized edits, use "patches": [{ "search": "<exact existing code>", "replace": "<new replacement code>" }]
   - For new files or full rewrites, use "code": "<full file code>"
   - Schema:
{
  "assistantMessage": "<concise 1-2 sentence description of what you built or changed>",
  "title": "<short 2-4 word app title>",
  "files": {
    "/src/components/Header.jsx": {
      "patches": [
        { "search": "<exact original code block>", "replace": "<replacement code block>" }
      ]
    },
    "/src/components/NewFeature.jsx": { "code": "<complete component code>" }
  },
  "dependencies": {
    "some-extra-package": "latest"
  }
}
   - Never import non-existent files. All relative imports must correspond to files in "files" or existing project files.
   - Pre-installed packages: react, react-dom, tailwindcss, express, cors, clsx, tailwind-merge, lucide-react. Do not list them in dependencies.
   - React 19 compatibility: Do not use outdated React 18 packages that conflict with React 19 peer dependencies.
   - Defensive programming: Use optional chaining (data?.items?.map(...)) to prevent runtime null crashes. Always test that all opened JSX tags are properly closed.`;

const PYTHON_SYSTEM_PROMPT = `You are an expert Python and modern web developer specializing in FastAPI, Flask, and interactive Python web applications.
Your job is to generate complete, working, production-grade Python web applications based on user prompts.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief explanation of what you built/changed>",
  "title": "<short 2-4 word title for the app, e.g. 'FastAPI Analytics App'>",
  "files": {
    "/main.py": { "code": "<complete python entry point serving web UI on port 3000>" },
    "/requirements.txt": { "code": "fastapi\\nuvicorn\\njinja2\\n..." },
    "/templates/index.html": { "code": "<html with Tailwind CDN>" }
  },
  "dependencies": {}
}
3. The server must bind to host "0.0.0.0" and port 3000 so the preview container can expose it to the browser.
4. If using FastAPI, run via uvicorn (e.g. if __name__ == '__main__': uvicorn.run(app, host='0.0.0.0', port=3000)).
5. If using Flask, run with app.run(host='0.0.0.0', port=3000).
6. Provide complete HTML/CSS with Tailwind CDN in templates or static files so users can interact with the app in their browser.
7. Always provide /requirements.txt containing all required pip packages.
8. When modifying existing code, ONLY include the files you have changed in the "files" object.
9. Keep code clean, robust, and production-ready with proper error handling.`;

function getSystemPrompt(messages: Message[]): string {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content.toLowerCase() || "";
    const pythonKeywords = ["python", "flask", "django", "fastapi", "uvicorn", "pandas", "numpy", "streamlit"];
    const isPython = pythonKeywords.some((keyword) => lastUserMessage.includes(keyword));
    return isPython ? PYTHON_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT;
}

/**
 * Synthesizes a real-world Top 25-30 Features Blueprint mapped to industry benchmarks
 * (e.g. Netflix, Shopify, Linear, Stripe, Apple Weather, Discord).
 */
export function synthesizeDomainBlueprint(userPrompt: string): string {
    const p = userPrompt.toLowerCase();

    // 1. SIMPLE GAMES & FOCUSED UTILITIES
    const isFocusedGameOrUtility = [
        "tic-tac-toe", "tictactoe", "calculator", "stopwatch", "timer", "pomodoro",
        "memory game", "pong", "unit converter", "sudoku", "wordle", "hangman", "dice roller"
    ].some(k => p.includes(k));

    if (isFocusedGameOrUtility) {
        return `### BENCHMARK ARCHITECTURE: FOCUSED DELIGHT UTILITY / GAME (SINGLE-PAGE DEPTH)
- Scope Rule: Strictly single-page. Do NOT introduce fake navigation tabs or artificial pages.
- Top 20 Signature Polish Features:
  1. Web Audio API synthesized audio sound effects (distinct frequencies for move, invalid move, win, loss, reset).
  2. Dual Play Modes: Single-player vs AI (Minimax Unbeatable algorithm vs Casual) AND Two-player local pass-and-play.
  3. Live Match Scoreboard & Counters: Player wins, AI/Player 2 wins, ties/draws, current win streak, best streak.
  4. Move-by-Move Interactive History Log: Click past moves to inspect historical board states.
  5. Winning Combination Highlighting: Luminous neon glow and SVG strike-through connecting line on victory.
  6. Confetti Particle Celebration on victory with animated victory modal / badge.
  7. Board Customization: Marker skin selector (Neon Glow, Minimalist, Retro Arcade) or theme palette toggle.
  8. Keyboard Controls: Arrow keys, numpad (1-9) or spacebar triggers for high-speed play.
  9. Undo Move Button & Reset Match with smooth fade transitions.
  10. Reset Confirmation Dialog to prevent accidental match wipes.
  11. Match Statistics Export (JSON or copy summary to clipboard).
  12. Sound Mute / Unmute audio toggle pill.
  13. Responsive touch-friendly layout perfectly centered for mobile and desktop.
  14. Dark Luxury styling (#09090b canvas, glass card container, glowing border accents).`;
    }

    // 2. STREAMING / CINEMA / MEDIA / MUSIC
    if (["stream", "movie", "cinema", "netflix", "video", "film", "music", "spotify", "podcast", "media"].some(k => p.includes(k))) {
        return `### BENCHMARK ARCHITECTURE: TIER-1 STREAMING PLATFORM (NETFLIX / APPLE TV STYLE)
- Top 25-30 Core Features:
  1. Sticky Luxury Header: Brand monogram with glow, navigation links ('Home', 'Movies', 'TV Shows', 'My List', 'AI Match'), debounced live search bar, notification bell with unread indicator, user profile avatar.
  2. Cinematic Spotlight Hero Banner: Dynamic background backdrop with ambient vignette gradient, title typography, rating pill, match score (e.g. '98% Match'), duration, synopsis, 'Play' CTA, 'Add to Watchlist' toggle, and trailer sound preview toggle.
  3. Categorized Horizontal Scroll Rows: 'Trending Now', 'Top 10 Global', 'Critically Acclaimed Sci-Fi', 'Award-Winning Dramas', 'New Releases' with smooth mouse drag / scroll arrows.
  4. Interactive Media Cards: Hover elevation with thumbnail zoom, quick preview action buttons (Play, Watchlist Heart, Like, Info Chevron), age classification tags (PG-13, TV-MA), 4K Ultra HD & Dolby Atmos badges.
  5. Immersive Video Player Modal: Fullscreen capability, custom transport scrubber bar with buffered range, play/pause, skip 10s backward/forward, volume slider with mute, playback speed selector (0.5x, 1x, 1.5x, 2x), subtitle track toggle, and 'Skip Intro' button.
  6. Deep Media Detail Modal: Full synopsis, high-res poster, cast & crew chips with character names, genre badges, user reviews rating breakdown, similar recommended titles grid.
  7. AI CineMind / Mood-Based Recommender: Interactive mood chips ('Mind-Bending', 'Heartwarming', 'Dark & Gritty', 'Adrenaline Rush', 'Late Night Chill') generating tailored recommendations.
  8. 'My List' Watchlist Management: Optimistic instant toggle (heart/bookmark), active state persistence, and dedicated filter view.
  9. Continue Watching Row: Visual progress bar displaying percentage watched with instant resume.
  10. Multi-Genre Filter Toolbar: Action, Sci-Fi, Thriller, Comedy, Documentary, Horror.
  11. User Profile Switcher: Multiple simulated profiles (e.g. 'Personal', 'Family', 'Kids').
  12. Audio Tactile Feedback: Synthesized UI clicks and hover sound effects via Web Audio API.
  13. Realistic Seed Dataset in /src/data/mockData.js: 12-16 deep media items with descriptions, actors, directors, ratings, high-res Unsplash poster images, and durations.
  14. Express Backend in /server.js on port 3001: Endpoints for GET /api/media, GET /api/media/:id, POST /api/watchlist, GET /api/watchlist, and GET /api/recommendations.`;
    }

    // 3. E-COMMERCE / STORE / MARKETPLACE / RETAIL / FOOD DELIVERY
    if (["e-commerce", "ecommerce", "shop", "store", "market", "cart", "product", "fashion", "apparel", "food", "delivery", "restaurant", "shoes"].some(k => p.includes(k))) {
        return `### BENCHMARK ARCHITECTURE: LUXURY DIGITAL COMMERCE & MARKETPLACE (SHOPIFY / STRIPE STYLE)
- Top 25-30 Core Features:
  1. Luxury Navigation Bar: Brand mark, category links ('All Products', 'Featured', 'New Drops', 'Sale'), live search with instant auto-suggest dropdown, currency selector (USD, EUR, GBP), wishlist heart counter badge, and cart trigger with live item count pill.
  2. High-Impact Hero Showcase: Promotional announcement pill ('Summer Release 2026 • Free Worldwide Shipping'), bold headline, primary CTA 'Shop New Arrivals', and floating featured item pill with glowing aura.
  3. Multi-Faceted Filter & Sort Sidebar/Bar: Category pills (All, Apparel, Footwear, Accessories, Tech), Price range slider with numeric inputs, In-Stock only switch, Rating filter (4★ & up), and Sort dropdown (Featured, Price: Low to High, Price: High to Low, Highest Rated, Newest).
  4. Interactive Product Card: High-res image with hover crossfade/zoom, discount badge (-25%), color variant dots, stock status indicator ('Only 3 left in stock'), quick-add to cart button with animated checkmark confirmation.
  5. Comprehensive Product Detail Modal / View: Multi-thumbnail gallery switcher, color/variant picker, size selector chips (S, M, L, XL), quantity stepper (+/-), customer review stars breakdown, detailed material & care specs.
  6. Slide-Out Cart Drawer: Item cards with thumbnail, title, selected size/color, price, quantity controls, instant delete with undo option, coupon code input with promo validation ('DISCOUNT10'), dynamic free-shipping progress meter bar ('Add $14 more for Free Express Shipping!'), order summary math (Subtotal, Tax, Shipping, Total).
  7. Multi-Step Checkout Modal: Shipping address form -> Payment method switcher (Credit Card, Apple Pay simulation) -> Instant order confirmation screen with celebratory confetti animation and tracking number.
  8. Wishlist & Favorites System: Optimistic one-click toggle with toast notification.
  9. Customer Reviews & Ratings Section: Star breakdown bar chart, verified buyer badges, and 'Write a Review' modal.
  10. Audio & Micro-Interactions: Tactile synthesized click, add-to-cart chime, and purchase fanfare via Web Audio API.
  11. Realistic Seed Inventory in /src/data/mockData.js: 12-16 rich products with prices, ratings, inventory counts, descriptions, and high-res Unsplash photos.
  12. Express Backend in /server.js on port 3001: Endpoints for GET /api/products, GET /api/products/:id, POST /api/cart, POST /api/checkout, and GET /api/orders.`;
    }

    // 4. FINTECH / BANKING / CRYPTO / INVESTING / WEALTH / EXPENSES
    if (["fintech", "bank", "crypto", "wallet", "invest", "stock", "finance", "money", "trading", "budget", "expense", "portfolio"].some(k => p.includes(k))) {
        return `### BENCHMARK ARCHITECTURE: MODERN WEALTH & ASSET MANAGEMENT (STRIPE / ROBINHOOD STYLE)
- Top 25-30 Core Features:
  1. Executive Portfolio Header: Total Net Worth display with large typography, 24-hour P&L metric (+$2,481.20 / +3.8%), timeframe selector (1D, 1W, 1M, 1Y, ALL), currency selector, and 'Hide Balances' privacy eye toggle.
  2. Interactive Portfolio Performance Chart: High-resolution SVG / Canvas / Recharts area chart with glowing gradient fill, dynamic hover crosshair, and value tooltips.
  3. Virtual Account & Card Carousel: Checking Account, High-Yield Savings (4.85% APY), Crypto Vault, and virtual glass debit/credit cards with copyable card number, CVV toggle, and freeze card switch.
  4. Quick Action Command Bar: 'Send Funds', 'Deposit / Add Money', 'Exchange / Swap Assets', 'Request Payment', 'Download CSV Statement'.
  5. Fast Send Money Modal: Contact selector with user avatars, quick amount pills ($25, $50, $100, $500), transfer memo input, zero-fee badge, and simulated biometric/PIN confirmation.
  6. Live Transaction Ledger: Real-time transaction feed with categorized merchant icons (Subscriptions, Groceries, Payroll, Transfers), status tags (Completed, Pending), search input, and filter by transaction type.
  7. Budget & Spending Analytics: Category progress bars with warning threshold colors (Housing, Dining, Tech, Travel), monthly spending target indicator.
  8. Crypto & Market Watch Table: Live asset ticker (BTC, ETH, SOL, S&P 500) with price flasher animations (green/red pulses on simulated update), 24h change %, and sparkline previews.
  9. Audio Tactile Feedback: Coin chime on deposit, swift whoosh on transfer via Web Audio API.
  10. Realistic Financial Dataset in /src/data/mockData.js: 12+ transactions, 4 accounts, and 6 market assets.
  11. Express Backend in /server.js on port 3001: Endpoints for GET /api/portfolio, GET /api/transactions, POST /api/transactions, and GET /api/market-rates.`;
    }

    // 5. SAAS / PROJECT MANAGEMENT / KANBAN / CRM / WORKFLOW / LINEAR
    if (["saas", "project", "kanban", "crm", "task", "workflow", "linear", "jira", "notion", "board", "issue", "sprint"].some(k => p.includes(k))) {
        return `### BENCHMARK ARCHITECTURE: HIGH-VELOCITY WORKSPACE (LINEAR / NOTION STYLE)
- Top 25-30 Core Features:
  1. Workspace Header: Workspace switcher ('Engineering Core', 'Growth'), team member avatar stack with '+ Invite', global search input with '/' keyboard shortcut, and 'Create New Issue' CTA.
  2. Multi-View Mode Switcher: Kanban Board view, Tabular List view, Sprint Timeline / Calendar, and Velocity Analytics dashboard.
  3. Interactive Kanban Board: Drag-and-drop or column transition buttons across 'Backlog', 'In Progress', 'In Review', 'Done' with live column card counters.
  4. Priority & Tag Matrix: Priority indicator badges (Urgent: red flame, High: amber, Medium: blue, Low: gray), status pills, due date chips with overdue warning, and custom label tags.
  5. Deep Issue Detail Modal: Rich title & description editor, sub-task checklist with check-off progress bar, assignee selector with avatars, activity timestamp log, and quick comment thread.
  6. New Task Creation Modal: Title, markdown description, priority selector, assignee assignment, due date picker, and tags with form validation.
  7. Instant Filter Toolbar: Filter by assignee, priority filter, label multi-select, and 'Clear All Filters' button.
  8. Sprint Velocity & Burn-Down Analytics: Percentage completion ring, tasks completed metric, velocity score card.
  9. Audio Feedback: Mechanical click on status move, completion chime on finishing tasks via Web Audio API.
  10. Seed Dataset in /src/data/mockData.js: 12-16 tasks across all 4 stages with assignees, priorities, and subtasks.
  11. Express Backend in /server.js on port 3001: Endpoints for GET /api/tasks, POST /api/tasks, PUT /api/tasks/:id, and DELETE /api/tasks/:id.`;
    }

    // 6. WEATHER / ATMOSPHERIC / RADAR / CLIMATE
    if (["weather", "radar", "forecast", "climate", "atmosphere", "meteorolog", "wind", "storm", "temp"].some(k => p.includes(k))) {
        return `### BENCHMARK ARCHITECTURE: PRECISION METEOROLOGICAL RADAR (DARK SKY / APPLE WEATHER STYLE)
- Top 25-30 Core Features:
  1. Top Navigation: Current City indicator, City Search bar with live suggestions, °C / °F temperature unit toggle, and Saved Favorites drawer.
  2. Current Atmospheric Hero Display: Ultra-large temperature typography, weather condition badge (Clear, Storm, Heavy Snow, Rain), 'Feels like', high/low temperature bar, and atmospheric summary.
  3. Interactive 3D / WebGL / Canvas Radar Visualizer: Multi-layer selector (Precipitation Reflectivity dBZ, Wind Streamlines, Temperature Heatmap, Lightning Storm Tracker), time scrubbing bar (-60m to +30m forecast), pan/orbit controls, and radar color legend.
  4. 24-Hour Hourly Forecast Slider: Hourly pills with time, condition icon, temperature, and precipitation chance % bars.
  5. 7-Day Extended Forecast: Day names, condition icons, horizontal min/max temperature gradient spectrum bars, and precipitation likelihood pills.
  6. Atmospheric Metrics 8-Card Grid: Wind Speed & Direction with compass needle, UV Index gauge, Humidity percentage & Dew Point, Air Quality Index (AQI) with color-coded safety rating, Barometric Pressure, Visibility distance, and Sunrise / Sunset solar arc curve.
  7. Severe Weather Alerts Banner: Dismissible urgent alerts with warning icons, weather agency source, and recommended action steps.
  8. Multi-City Favorites Management: Quick switcher between saved global cities (Tokyo, New York, London, Sydney, Cairo).
  9. Realistic Seed Data in /src/data/mockData.js: Multi-city hourly & 7-day data, radar cell coordinates, and atmospheric metrics.
  10. Express Backend in /server.js on port 3001: Endpoints for GET /api/weather?city=..., GET /api/cities, and GET /api/radar.`;
    }

    // 7. SOCIAL / COMMUNITY / FORUM / MESSAGING / CHAT
    if (["social", "community", "forum", "chat", "message", "feed", "post", "network", "discussion"].some(k => p.includes(k))) {
        return `### BENCHMARK ARCHITECTURE: REAL-TIME COMMUNITY & SOCIAL PLATFORM (TWITTER / DISCORD STYLE)
- Top 25-30 Core Features:
  1. Sticky Navigation: Brand icon, feed switcher ('For You', 'Following', 'Trending'), search bar, notification bell with unread badge, and profile menu.
  2. Interactive Post Composer: Text area, simulated image attachment, interactive Poll creator with multi-option fields, category tag selector, and 'Publish' button.
  3. Rich Feed Posts: User avatar, display name, handle, relative timestamp ('2h ago'), rich content body, interactive poll voting with live percentage calculation.
  4. Engagement Action Bar: Like button with heart animation and optimistic counter, Comment toggle with expandable thread, Repost/Share modal, and Bookmark toggle.
  5. Threaded Comments Section: Nested replies, author tags, reply input with immediate optimistic insertion.
  6. Direct Messaging / Chat Drawer: Active conversation list, message bubbles with delivery status, and send message input.
  7. Trending Topics & Hashtags Sidebar with post volumes.
  8. User Profile Preview Modal with follower/following stats and bio.
  9. Seed Data in /src/data/mockData.js: 10-14 posts, polls, comments, and simulated user profiles.
  10. Express Backend in /server.js on port 3001: Endpoints for GET /api/posts, POST /api/posts, POST /api/posts/:id/like, and POST /api/posts/:id/comments.`;
    }

    // 8. UNIVERSAL LUXURY PRODUCT STANDARD (FOR ALL OTHER PROMPTS)
    return `### BENCHMARK ARCHITECTURE: AWARD-WINNING FULL-STACK DIGITAL PRODUCT
- Top 25-30 Core Features:
  1. Sticky Luxury Navigation Bar: Monogram logo with ambient badge glow, multi-view switcher tabs, debounced live instant search bar, notification bell with unread indicator, and user profile avatar.
  2. High-Converting Hero Section: Bold headline, value-proposition subhead, primary & secondary action buttons, live metric counters, and ambient radial glow backdrop.
  3. Multi-View Architecture: Switch between at least 3 distinct views (e.g. 'Overview / Dashboard', 'Catalog / Explorer', 'Detailed Inspector', 'Activity & Analytics', 'Settings').
  4. Multi-Faceted Filter & Sort Toolbar: Category filter pills, status switches, and dynamic sorting dropdown.
  5. Interactive Item Detail Modal: Full specification panel, action buttons, image gallery, and status indicators.
  6. Interactive Creation & Edit Modal: Working forms with validation allowing users to add and edit records with immediate UI feedback.
  7. Activity & Analytics Dashboard: Stat metric cards, visual progress indicators, and interactive data charts.
  8. Toast Notification System: Interactive feedback toasts for all user actions (create, edit, delete, favorite, toggle).
  9. Web Audio API Sound Feedback: Synthesized acoustic feedback for clicks, success confirmations, and errors.
  10. Dark Luxury Aesthetic: #09090b deep slate background, glassmorphism cards (backdrop-blur-xl bg-slate-900/70 border border-slate-800/80), smooth hover transitions.
  11. Rich Realistic Seed Data in /src/data/mockData.js: 10-14 complete, deeply detailed items with tags, metrics, and high-res Unsplash image URLs.
  12. Express Backend in /server.js on port 3001: REST API with GET, POST, PUT, DELETE endpoints for full persistence.`;
}





// ─── Gemini contents builder ──────────────────────────────────────────────────

async function buildContents(messages: Message[], fileData: FileData | null) {
    const trimmed = trimHistory(messages);

    return Promise.all(
        trimmed.map(async (msg, idx) => {
            const role = msg.role === "assistant" ? "model" : "user";

            if (msg.role === "user") {
                const parts: object[] = [];
                let text = msg.content;

                // Process multi-format attached files (Images, PDFs, Markdown, JSON, CSV, code)
                if (msg.attachedFiles && msg.attachedFiles.length > 0) {
                    for (const file of msg.attachedFiles) {
                        const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg|gif)$/i.test(file.name);
                        const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

                        if (isImage || isPdf) {
                            let base64Data = file.base64;
                            let mimeType = file.type || (isPdf ? "application/pdf" : "image/png");

                            if (!base64Data && file.url) {
                                if (isSafeExternalUrl(file.url)) {
                                    try {
                                        const res = await fetch(file.url, { signal: AbortSignal.timeout(5000) });
                                        if (res.ok) {
                                            const buf = await res.arrayBuffer();
                                            base64Data = Buffer.from(buf).toString("base64");
                                            mimeType = res.headers.get("content-type") || mimeType;
                                        }
                                    } catch (err) {
                                        console.error("Failed to fetch attached binary file:", err);
                                    }
                                } else {
                                    console.warn("[Security SSRF Block] Blocked untrusted URL in file attachment:", file.url);
                                }
                            }

                            if (base64Data) {
                                parts.push({
                                    inlineData: {
                                        data: base64Data,
                                        mimeType,
                                    },
                                });
                            }

                            if (isImage) {
                                const urlHint = file.url ? ` (Asset URL: ${file.url})` : "";
                                text = `[Attached Design Mockup: ${file.name}${urlHint}. Replicate the visual layout, color palette, and component structure.]\n\n` + text;
                            } else {
                                text = `[Attached PDF Specification: ${file.name}. Review all requirements, pages, and components outlined in this document.]\n\n` + text;
                            }
                        } else if (file.content) {
                            const ext = file.name.split(".").pop() || "txt";
                            text = `[Attached Reference File: ${file.name} (${file.type})]\n\`\`\`${ext}\n${file.content}\n\`\`\`\nUse this data, schema, or component logic directly in the generated application.\n\n` + text;
                        }
                    }
                } else if (msg.imageUrl) {
                    text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background-image, etc.): ${msg.imageUrl}]\n\n${text}`;
                    if (isSafeExternalUrl(msg.imageUrl)) {
                        try {
                            const imgRes = await fetch(msg.imageUrl, { signal: AbortSignal.timeout(5000) });
                            if (imgRes.ok) {
                                const arrayBuffer = await imgRes.arrayBuffer();
                                const base64Data = Buffer.from(arrayBuffer).toString("base64");
                                const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
                                parts.push({
                                    inlineData: {
                                        data: base64Data,
                                        mimeType,
                                    },
                                });
                            }
                        } catch (error) {
                            console.error("Failed to fetch image for Gemini:", error);
                        }
                    } else {
                        console.warn("[Security SSRF Block] Blocked untrusted URL in msg.imageUrl:", msg.imageUrl);
                    }
                }

                const isLast = idx === trimmed.length - 1;
                if (isLast) {
                    const domainBlueprint = synthesizeDomainBlueprint(text);
                    text = `=== MANDATORY DOMAIN BLUEPRINT (Top 25-30 Features Benchmark) ===\n${domainBlueprint}\n\n` + text;

                    if (fileData && fileData.files) {
                        const fileEntries = Object.entries(fileData.files);
                        const outline = fileEntries
                            .map(([fPath, fObj]) => `- ${fPath} (${(fObj?.code || "").split("\n").length} lines)`)
                            .join("\n");

                        text += `\n\n=== EXISTING PROJECT CONTEXT ===\nProject Title: ${fileData.title || "Zephyre App"}\nProject Files Overview:\n${outline}\n\nCurrent Full Codebase:\n${JSON.stringify(fileData, null, 2)}`;
                    }
                }

                parts.push({ text });
                return { role, parts };
            }

            return { role, parts: [{ text: msg.content }] };
        })
    );
}






export async function POST(req: NextRequest) {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceId, userId, messages, fileData } = body as {
        workspaceId: string | null;
        userId: string;
        messages: Message[];
        fileData: FileData | null;
    };

    if (!messages?.length) {
        return Response.json({ message: "No messages provided" }, { status: 400 });
    }



    // ── Arcjet: rate limit, prompt injection, sensitive info ──────────────────
    // detectPromptInjectionMessage requires the actual user text to inspect.

    const arcjetReq = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(body),
    });

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (process.env.ARCJET_KEY) {
        const decision = await aj.protect(arcjetReq, {
            requested: 1,
            userId: clerkId,
            detectPromptInjectionMessage: lastUserMessage,
            sensitiveInfoValue: lastUserMessage,
        });

        if (decision.isDenied()) {
            return Response.json(
                { message: decision.reason?.type ?? "Request blocked" },
                { status: 429 }
            );
        }
    }




    const user = await db.user.findUnique({
        where: { id: userId, clerkId },
        select: { id: true, credits: true },
    });

    if (!user)
        return Response.json({ message: "User not found" }, { status: 404 });
    if (user.credits < CREDIT_COST_PER_GENERATION) {
        return Response.json({ message: "Insufficient credits" }, { status: 402 });
    }


    const encoder = new TextEncoder();


    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;
            const enqueue = (chunk: string) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(chunk));
                } catch {
                    isClosed = true;
                }
            };
            const closeStream = () => {
                if (isClosed) return;
                isClosed = true;
                try {
                    controller.close();
                } catch { }
            };

            // Keepalive ping every 2.5s to prevent mobile proxy & cellular timeouts
            const pingInterval = setInterval(() => {
                if (isClosed) return;
                enqueue(": keepalive\n\n");
            }, 2500);

            try {
                const contents = await buildContents(messages, fileData);

                const geminiStream = await ai.models.generateContentStream({
                    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
                    contents,
                    config: {
                        systemInstruction: getSystemPrompt(messages),
                        temperature: 0.7,
                        maxOutputTokens: 65536,
                        responseMimeType: "application/json",
                        // Gemini emits thought chunks before the actual output.
                        thinkingConfig: {
                            includeThoughts: true,
                        },
                    },
                });

                let accumulated = ""; // final JSON output
                let lastEmitTime = 0; // throttle thought emissions

                try {
                    for await (const chunk of geminiStream) {
                        const parts = chunk.candidates?.[0]?.content?.parts ?? [];

                        for (const part of parts) {
                            if (!part.text) continue;

                            if (part.thought) {
                                const now = Date.now();
                                if (now - lastEmitTime > 600) {
                                    const label = extractThoughtLabel(part.text);
                                    if (label) {
                                        enqueue(sseEvent("status", { message: label }));
                                        lastEmitTime = now;
                                    }
                                }
                            } else {
                                accumulated += part.text;
                            }
                        }
                    }
                } catch (streamIterErr: unknown) {
                    const msg = streamIterErr instanceof Error ? streamIterErr.message : String(streamIterErr);
                    console.warn("[gen-ai-code] Gemini stream notice during iteration:", msg);
                    // If stream closed with incomplete segment or reset but we accumulated enough valid JSON, proceed!
                    if (!accumulated || accumulated.length < 50) {
                        throw streamIterErr;
                    }
                    console.info(`[gen-ai-code] Resilient recovery: proceeding with accumulated buffer (${accumulated.length} bytes)`);
                }

                // ── Parse the complete JSON response ──────────────────────────────────
                let parsed: ParsedLlmResponse;

                try {
                    parsed = parseLlmJson(accumulated);
                } catch (parseErr) {
                    console.error("[gen-ai-code] JSON parsing failed:", parseErr, "Raw output snippet:", accumulated.slice(0, 300));
                    enqueue(
                        sseEvent("error", {
                            message: "AI returned invalid JSON. Please try again.",
                        })
                    );
                    closeStream();
                    return;
                }

                const {
                    assistantMessage,
                    title: aiTitle,
                    files,
                    dependencies,
                } = parsed;

                if (!files || typeof files !== "object") {
                    enqueue(
                        sseEvent("error", {
                            message: "AI response missing files. Please try again.",
                        })
                    );
                    closeStream();
                    return;
                }

                // ── Validate npm packages ──────────────────────────────────────────────
                enqueue(sseEvent("status", { message: "Validating packages…" }));
                const validatedDeps = await validateDependencies(dependencies ?? {});

                // ── Ensure Full Directory & File Hierarchy is Persisted ──────────────
                const mergedFiles = applyFileChanges(
                    fileData?.files || {},
                    files
                );
                const mergedDeps = {
                    ...(fileData?.dependencies || {}),
                    ...validatedDeps,
                };
                const finalTitle = aiTitle || fileData?.title || "Zephyre App";

                const { files: fullFiles, dependencies: fullDeps } = ensureStandardFiles(
                    mergedFiles,
                    mergedDeps,
                    finalTitle
                );

                const newFileData: FileData = {
                    files: fullFiles,
                    dependencies: fullDeps,
                    title: finalTitle,
                };

                // — Upsert workspace + deduct credit ———————
                // Unconditional DB save: Even if mobile connection had a momentary hiccup,
                // the generated project is ALWAYS saved to PostgreSQL so the user never loses their work.
                enqueue(sseEvent("status", { message: "Saving…" }));

                const lastUserMessage = messages[messages.length - 1];
                const updatedMessages: Message[] = [
                    ...messages,
                    { role: "assistant", content: assistantMessage },
                ];

                let finalWorkspaceId = workspaceId;

                try {
                    const [workspace] = await db.$transaction([
                        workspaceId
                            ? db.workspace.update({
                                where: { id_userId: { id: workspaceId, userId } },
                                data: {
                                    messages: updatedMessages as never,
                                    fileData: newFileData as never,
                                },
                            })
                            : db.workspace.create({
                                data: {
                                    userId,
                                    title: aiTitle ?? lastUserMessage.content.slice(0, 80),
                                    messages: updatedMessages as never,
                                    fileData: newFileData as never,
                                },
                            }),
                        db.user.updateMany({
                            where: {
                                id: userId,
                                credits: { gte: CREDIT_COST_PER_GENERATION },
                            },
                            data: {
                                credits: { decrement: CREDIT_COST_PER_GENERATION },
                            },
                        }),
                    ], {
                        maxWait: 15000,
                        timeout: 20000,
                    });
                    finalWorkspaceId = workspace.id;
                } catch (dbErr) {
                    console.error("[gen-ai-code] Primary transaction error, running safe fallback save:", dbErr);
                    if (workspaceId) {
                        await db.workspace.update({
                            where: { id_userId: { id: workspaceId, userId } },
                            data: {
                                messages: updatedMessages as never,
                                fileData: newFileData as never,
                            },
                        }).catch((e) => console.error("Workspace update fallback failed:", e));
                    } else {
                        const created = await db.workspace.create({
                            data: {
                                userId,
                                title: aiTitle ?? lastUserMessage.content.slice(0, 80),
                                messages: updatedMessages as never,
                                fileData: newFileData as never,
                            },
                        }).catch((e) => console.error("Workspace create fallback failed:", e));
                        if (created) finalWorkspaceId = created.id;
                    }
                }

                // Re-fetch updated credit balance
                const updatedUser = await db.user.findUnique({
                    where: { id: userId },
                    select: { credits: true },
                }).catch(() => null);

                try {
                    revalidatePath("/projects");
                } catch {
                    // Safe swallow in streaming context
                }

                // Emit final result done event
                enqueue(
                    sseEvent("done", {
                        workspaceId: finalWorkspaceId,
                        assistantMessage,
                        fileData: newFileData,
                        creditsRemaining: updatedUser?.credits ?? 0,
                    })
                );
            } catch (err: unknown) {
                console.error("[gen-ai-code] stream error:", err);

                let errorMessage = "Something went wrong. Please try again.";
                const errObj = err as {
                    status?: number;
                    message?: string;
                    code?: string;
                    cause?: { code?: string };
                } | null;

                if (errObj?.status === 429 || errObj?.message?.includes("429") || errObj?.message?.includes("quota")) {
                    errorMessage = "You have exceeded your Gemini API rate limit (Free Tier). Please wait 60 seconds and try again.";
                } else if (errObj?.status === 503 || errObj?.message?.includes("503")) {
                    errorMessage = "The Gemini AI servers are currently experiencing high demand. Please try again in a few moments.";
                } else if (errObj?.code === "ECONNRESET" || errObj?.cause?.code === "ECONNRESET" || errObj?.message?.includes("terminated")) {
                    errorMessage = "The AI connection was interrupted. This can happen with complex generations. Please try again.";
                }

                enqueue(
                    sseEvent("error", {
                        message: errorMessage,
                    })
                );
            } finally {
                clearInterval(pingInterval);
                closeStream();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
        },
    });
}


export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Fluid : 300 sec(5 min) timeout for long generations