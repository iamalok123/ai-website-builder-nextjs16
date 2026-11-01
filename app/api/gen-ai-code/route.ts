import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import { db } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { Message, FileData } from "@/types/workspace";
import { aj } from "@/lib/arcjet";
import { revalidatePath } from "next/cache";



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

const DEFAULT_SYSTEM_PROMPT = `You are an expert full-stack developer specializing in modern web applications with Vite, React 19, Tailwind CSS, and Node/Express.
Your job is to generate complete, working, production-grade applications based on user prompts.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief explanation of what you built/changed>",
  "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
  "files": {
    "/App.jsx": { "code": "<full file content>" },
    "/components/SomeComponent.jsx": { "code": "<full file content>" },
    "/server.js": { "code": "<optional express backend if user requires a backend or api>" }
  },
  "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + modern hooks). Use .jsx file extensions for all component files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The frontend entry point must always be /App.jsx and must export a default component.
6. If the user prompt asks for a backend, database, or API, provide an Express.js server in /server.js.
7. All imports must reference files you include in "files" or packages in "dependencies".
8. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always provided.
9. When modifying existing code, ONLY include the files you have changed in the "files" object. Do not return untouched files.
10. Keep code clean, readable, modular, and production-quality.
11. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.
12. CRITICAL TAILWIND FIX: If you need dynamic class names with template literals, use EXACTLY this syntax: className={\`my-class \${variable}\`}. Do NOT use regular quotes. DO NOT accidentally add extra braces or brackets at the end like \`}\`}> or \`} />. This causes fatal syntax errors.
13. CRITICAL: Double-check all React code for syntax errors before responding. Ensure all JSX template literals (className={\`...\`}) are perfectly formatted with matching brackets and backticks.`;

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
    if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(clean);
    } catch {
        try {
            const repaired = jsonrepair(clean);
            return JSON.parse(repaired);
        } catch {
            const sanitized = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
            const repaired = jsonrepair(sanitized);
            return JSON.parse(repaired);
        }
    }
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

    // Ensure root vite.config.js
    if (!updatedFiles["/vite.config.js"] && !updatedFiles["vite.config.js"]) {
        updatedFiles["/vite.config.js"] = {
            code: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
});`
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
    if (!updatedFiles["/package.json"] && !updatedFiles["package.json"]) {
        updatedFiles["/package.json"] = {
            code: JSON.stringify(
                {
                    name: "zephyre-app",
                    version: "1.0.0",
                    type: "module",
                    scripts: {
                        dev: "vite --host 0.0.0.0 --port 3000",
                        build: "vite build",
                        start: "node server.js",
                    },
                    dependencies: {
                        react: "^19.0.0",
                        "react-dom": "^19.0.0",
                        "lucide-react": "^1.16.0",
                        clsx: "^2.1.1",
                        "tailwind-merge": "^3.0.0",
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

            try {
                const contents = await buildContents(messages, fileData);

                const geminiStream = await ai.models.generateContentStream({
                    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
                    contents,
                    config: {
                        systemInstruction: getSystemPrompt(messages),
                        temperature: 0.7,
                        // Gemini emits thought chunks before the actual output.
                        thinkingConfig: {
                            includeThoughts: true,
                        },
                    },
                });

                let accumulated = ""; // final JSON output
                let lastEmitTime = 0; // throttle thought emissions

                for await (const chunk of geminiStream) {
                    if (isClosed) break;
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





                // — Upsert workspace + deduct credit (single transaction) ———————
                // Atomic: if either the DB write or the credit deduction fails,
                // neither happens – user never loses a credit on a failed save.
                // workspaceId is null on first generation → create, string → update.

                enqueue(sseEvent("status", { message: "Saving…" }));

                const lastUserMessage = messages[messages.length - 1];
                const updatedMessages: Message[] = [
                    ...messages,
                    { role: "assistant", content: assistantMessage },
                ];


                // If client aborted or closed connection, do not save or charge credits
                if (isClosed) return;

                const [workspace] = await db.$transaction([
                    workspaceId
                        ? db.workspace.update({
                            where: { id: workspaceId, userId },
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
                    maxWait: 15000, // 15 seconds max wait to connect
                    timeout: 20000, // 20 seconds max for transaction to run
                });



                // Re-fetch updated credit balance to return accurate value to the client.
                // The client updates its local credits state from this – no page refresh needed.
                const updatedUser = await db.user.findUnique({
                    where: { id: userId },
                    select: { credits: true },
                });

                revalidatePath("/projects");




                // Emit final result , Final done event 
                // Client receives this, updates Sandpack with the new files,
                // adds the assistant message to the chat, and updates the credit badge.
                enqueue(
                    sseEvent("done", {
                        workspaceId: workspace.id,
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

                // Parse specific API errors so the user knows what actually happened
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
                // Always close the stream - whether success, parse error or exception
                closeStream();
            }
        },
    });


    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Content-Type-Options": "nosniff",
        },
    });
}


export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Fluid : 300 sec(5 min) timeout for long generations