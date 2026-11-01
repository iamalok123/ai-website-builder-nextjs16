import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import { db } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { Message, FileData } from "@/types/workspace";
import { aj } from "@/lib/arcjet";
import { revalidatePath } from "next/cache";
import { STANDARD_VITE_CONFIG } from "@/lib/e2b";



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
                const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
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

const DEFAULT_SYSTEM_PROMPT = `You are an expert full-stack developer specializing in modern web applications with Vite, React 19, Tailwind CSS, Node/Express, and zero-dependency file-based persistence.
Your job is to generate complete, high-performance, production-grade full-stack applications.

CRITICAL ARCHITECTURE:
1. Every application with interactive data, tasks, notes, user entries, or forms MUST be a true FULL-STACK application with both a frontend (/App.jsx) and backend (/server.js).
2. Frontend entry point: /App.jsx (React 19 functional components + Tailwind CSS + Lucide React icons).
   - OPTIMISTIC UI UPDATES: For all user actions (create, edit, delete, toggle), update the React state immediately so the UI responds instantly with 0ms delay. Synchronize with the backend asynchronously via fetch('/api/...'). If any backend call encounters an issue, maintain local state or localStorage so the user is NEVER blocked from using the application.
3. Backend entry point: /server.js (Express.js running on port 3001 with CORS).
   - Use Node.js built-in file persistence with fs (synchronous atomic read/write to './database.json').
   - Initialize storage on boot: check fs.existsSync('./database.json') and create initial structure { items: [] } if missing.
   - Helper functions: readDb() and writeDb(data).
   - Implement clean REST API routes on /api/... (GET, POST, PUT, DELETE) with express.json().
   - Return clean JSON arrays/objects with proper HTTP status codes (200, 201, 404, 500).
   - Zero external C++ native module dependencies — starts in 0ms without compilation or segfaults across all Node versions.
   - The frontend communicates with the backend via standard fetch('/api/...') calls (which Vite dev server automatically proxies to port 3001).
4. TOKEN SAVING & HIGH-DENSITY RULES:
   - Be concise and token-efficient. Prefer writing clean, self-contained components in /App.jsx rather than splitting into many tiny files.
   - Keep /server.js compact and focused (<70 lines) with clean REST routes and JSON persistence.
   - Do NOT output unnecessary boilerplate or verbose comments. Maximize functionality per token.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief 1-2 sentence explanation of what you built>",
  "title": "<short 2-4 word title, e.g. 'Kanban Task Board'>",
  "files": {
    "/App.jsx": { "code": "<full frontend component with optimistic UI>" },
    "/server.js": { "code": "<full express backend on port 3001 with file persistence>" }
  },
  "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + modern hooks). Use .jsx file extensions for all component files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The frontend entry point must always be /App.jsx and must export a default component.
6. All imports must reference files you include in "files" or packages in "dependencies".
7. Do not include react, react-dom, tailwindcss, express, or cors in "dependencies" — they are pre-configured.
8. When modifying existing code, ONLY include the files you have changed in the "files" object. Do not return untouched files.
9. Keep code clean, readable, modular, and production-quality.
10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.
11. CRITICAL TAILWIND FIX: If you need dynamic class names with template literals, use EXACTLY this syntax: className={\`my-class \${variable}\`}. Do NOT use regular quotes. DO NOT accidentally add extra braces or brackets at the end like \`}\`}> or \`} />. This causes fatal syntax errors.
12. CRITICAL: Double-check all React code for syntax errors before responding. Ensure all JSX template literals (className={\`...\`}) are perfectly formatted with matching brackets and backticks.`;

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

                if (msg.imageUrl) {
                    text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background-image, etc.): ${msg.imageUrl}]\n\n${text}`;
                    try {
                        const imgRes = await fetch(msg.imageUrl);
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
                }

                const isLast = idx === trimmed.length - 1;
                if (isLast && fileData) {
                    text +=
                        "\n\nCurrent project files for context:\n" +
                        JSON.stringify(fileData, null, 2);
                }

                parts.push({ text });
                return { role, parts };
            }

            return { role, parts: [{ text: msg.content }] };
        })
    );
}






// ─── Robust LLM JSON Parser ────────────────────────────────────────────────
function parseLlmJson(raw: string): {
    assistantMessage: string;
    title?: string;
    files: Record<string, { code: string }>;
    dependencies?: Record<string, string>;
} {
    let clean = raw.trim();
    if (clean.startsWith("```json")) clean = clean.slice(7);
    else if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    clean = clean.trim();

    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    let candidate = clean;
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        candidate = clean.substring(firstBrace, lastBrace + 1);
    }

    // Attempt 1: Standard JSON.parse on candidate
    try {
        return JSON.parse(candidate);
    } catch {}

    // Attempt 2: jsonrepair on candidate
    try {
        const repaired = jsonrepair(candidate);
        return JSON.parse(repaired);
    } catch {}

    // Attempt 3: Sanitize control characters + jsonrepair
    const sanitized = candidate.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
    try {
        const repaired = jsonrepair(sanitized);
        return JSON.parse(repaired);
    } catch {}

    // Attempt 4: If truncated mid-string, try auto-closing open quotes and objects
    const autoClosedAttempts = [
        sanitized + '"}',
        sanitized + '"} }',
        sanitized + '"}} }',
        sanitized + '}}',
        sanitized + '}}}',
    ];
    for (const attempt of autoClosedAttempts) {
        try {
            const repaired = jsonrepair(attempt);
            const parsed = JSON.parse(repaired);
            if (parsed && typeof parsed === "object" && parsed.files) {
                return parsed;
            }
        } catch {}
    }

    // Final attempt: jsonrepair on full sanitized raw string
    const rawSanitized = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
    const finalRepaired = jsonrepair(rawSanitized);
    return JSON.parse(finalRepaired);
}

// ─── Ensure Complete Project File Hierarchy ──────────────────────────────────
function ensureStandardFiles(
    files: Record<string, { code: string }>,
    dependencies: Record<string, string>,
    title: string
): { files: Record<string, { code: string }>; dependencies: Record<string, string> } {
    const updatedFiles = { ...files };
    const isPython = Object.keys(updatedFiles).some((p) => p.endsWith(".py") || p.includes("requirements.txt"));

    if (isPython) {
        if (!updatedFiles["/requirements.txt"] && !updatedFiles["requirements.txt"]) {
            updatedFiles["/requirements.txt"] = { code: "fastapi\nuvicorn\njinja2\n" };
        }
        return { files: updatedFiles, dependencies };
    }

    // Ensure root index.html
    if (!updatedFiles["/index.html"] && !updatedFiles["index.html"]) {
        updatedFiles["/index.html"] = {
            code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || "Zephyre App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-black text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
        };
    }

    // Ensure root vite.config.js with allowedHosts: true, polling, and HMR
    const viteKey = Object.keys(updatedFiles).find(
        (k) => k === "/vite.config.js" || k === "vite.config.js" || k === "/vite.config.ts" || k === "vite.config.ts"
    );
    if (
        !viteKey ||
        !updatedFiles[viteKey].code.includes("allowedHosts: true") ||
        !updatedFiles[viteKey].code.includes("usePolling")
    ) {
        updatedFiles["/vite.config.js"] = {
            code: STANDARD_VITE_CONFIG,
        };
    }

    // Ensure /src/main.jsx entry point
    if (!updatedFiles["/src/main.jsx"] && !updatedFiles["src/main.jsx"]) {
        updatedFiles["/src/main.jsx"] = {
            code: `import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);`
        };
    }

    // Bridge App.jsx into src/App.jsx and root /App.jsx
    if (updatedFiles["/App.jsx"] && !updatedFiles["/src/App.jsx"]) {
        updatedFiles["/src/App.jsx"] = { code: updatedFiles["/App.jsx"].code };
    } else if (updatedFiles["/src/App.jsx"] && !updatedFiles["/App.jsx"]) {
        updatedFiles["/App.jsx"] = { code: updatedFiles["/src/App.jsx"].code };
    }

    // Ensure package.json
    const hasServerJs = Boolean(updatedFiles["/server.js"] || updatedFiles["server.js"]);
    const backendDeps = hasServerJs ? { express: "^4.21.2", cors: "^2.8.5" } : {};
    const devScript = hasServerJs
        ? "node server.js & vite --host 0.0.0.0 --port 3000"
        : "vite --host 0.0.0.0 --port 3000";

    if (!updatedFiles["/package.json"] && !updatedFiles["package.json"]) {
        updatedFiles["/package.json"] = {
            code: JSON.stringify(
                {
                    name: "zephyre-app",
                    version: "1.0.0",
                    type: "module",
                    scripts: {
                        dev: devScript,
                        build: "vite build",
                        start: "node server.js",
                    },
                    dependencies: {
                        react: "^19.0.0",
                        "react-dom": "^19.0.0",
                        "lucide-react": "^1.16.0",
                        clsx: "^2.1.1",
                        "tailwind-merge": "^3.0.0",
                        ...backendDeps,
                        ...dependencies,
                    },
                    devDependencies: {
                        "@vitejs/plugin-react": "^4.3.4",
                        vite: "^6.0.0",
                    },
                },
                null,
                2
            ),
        };
    }

    return { files: updatedFiles, dependencies };
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
                    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
                    contents,
                    config: {
                        systemInstruction: getSystemPrompt(messages),
                        temperature: 0.7,
                        maxOutputTokens: 65536,
                        // Gemini emits thought chunks before the actual output.
                        thinkingConfig: {
                            includeThoughts: true,
                        },
                    },
                });

                let accumulated = ""; // final JSON output
                let lastEmitTime = 0; // throttle thought emissions

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

                // ── Parse the complete JSON response ──────────────────────────────────
                let parsed: {
                    assistantMessage: string;
                    title?: string;
                    files: Record<string, { code: string }>;
                    dependencies?: Record<string, string>;
                };

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
                const mergedFiles = {
                    ...(fileData?.files || {}),
                    ...files,
                };
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

                revalidatePath("/projects");

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