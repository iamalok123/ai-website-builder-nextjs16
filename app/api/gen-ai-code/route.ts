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

1. DYNAMIC SCOPE & ARCHITECTURE CLASSIFICATION:
   Analyze the user's prompt carefully to choose the optimal architecture:
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
   - Always provide extensive mock data (/src/data/mockData.js or pre-populated in ./database.json) with 8 to 16+ deeply realistic items.
   - Every record must have realistic titles, rich descriptions, categories, tags, prices/metrics, ratings, timestamps, and high-resolution Unsplash image URLs.
   - DEFENSIVE IMAGE FALLBACK: Always attach onError to images to prevent broken image icons: onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80'; }}

3. FULL-STACK PERSISTENCE & OPTIMISTIC UI:
   - Provide a complete Express backend in /server.js running on port 3001 with CORS.
   - Use Node.js built-in fs module to read and write './database.json'.
   - Initialize './database.json' on server startup if not present with rich initial data.
   - Provide REST API endpoints on /api/... with express.json() supporting GET, POST, PUT, DELETE.
   - OPTIMISTIC UI UPDATES: For every user action (add, edit, toggle, delete, check-in, checkout), update React state instantaneously (0ms latency), display an interactive toast notification, and synchronize asynchronously to /api/... in the background.

4. DESIGN SYSTEM & LUXURY VISUAL POLISH:
   - Dark luxury aesthetic by default (#09090b, #0e0e14 backgrounds with deep slate/zinc gradients).
   - Glassmorphism: backdrop-blur-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 shadow-2xl.
   - Subtle luminous accents & ambient glows: Radial blur halos matching the domain color palette (cyan/emerald for tech/crypto, amber/rose for luxury/food, indigo/violet for SaaS/AI).
   - Micro-interactions: Active scale-down active:scale-95, hover scale-up hover:scale-[1.02], smooth transitions, custom scrollbars, and Lucide React icons.

5. MODULAR PROJECT STRUCTURE:
   Decompose the application into clean, modular files:
   - /src/App.jsx: Root application component orchestrating global state, view routing, modals, and layout.
   - /src/components/: Feature-level components (Header.jsx, Hero.jsx, Catalog.jsx, ItemModal.jsx, CartDrawer.jsx, Dashboard.jsx, Footer.jsx, etc.).
   - /src/components/ui/: Reusable UI primitives (Button.jsx, Card.jsx, Badge.jsx, Input.jsx, Modal.jsx, Tabs.jsx, Toast.jsx).
   - /src/data/mockData.js: Rich, deep realistic datasets.
   - /src/lib/utils.js: Utility helpers including 'cn' (clsx + tailwind-merge) and formatters.
   - /server.js: Express persistence backend on port 3001.
   - /README.md: Architecture documentation.

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
                if (isLast && fileData && fileData.files) {
                    const fileEntries = Object.entries(fileData.files);
                    const outline = fileEntries
                        .map(([fPath, fObj]) => `- ${fPath} (${(fObj?.code || "").split("\n").length} lines)`)
                        .join("\n");

                    text += `\n\n=== EXISTING PROJECT CONTEXT ===\nProject Title: ${fileData.title || "Zephyre App"}\nProject Files Overview:\n${outline}\n\nCurrent Full Codebase:\n${JSON.stringify(fileData, null, 2)}`;
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