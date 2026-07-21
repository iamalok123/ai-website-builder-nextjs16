import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
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




// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert React developer. Your job is to generate complete, working React applications based on user prompts.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief explanation of what you built/changed>",
  "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
  "files": {
    "/App.js": { "code": "<full file content>" },
    "/components/SomeComponent.js": { "code": "<full file content>" }
  },
  "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + hooks). Do NOT use TypeScript in generated files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The entry point must always be /App.js and must export a default component.
6. All imports must reference files you include in "files" or packages in "dependencies".
7. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always available.
8. When modifying existing code, ONLY include the files you have changed in the "files" object. Do not return untouched files.
9. Keep code clean, readable, and production-quality.
10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.
11. CRITICAL TAILWIND FIX: If you need dynamic class names with template literals, use EXACTLY this syntax: className={\`my-class \${variable}\`}. Do NOT use regular quotes. DO NOT accidentally add extra braces or brackets at the end like \`}\`}> or \`} />. This causes fatal syntax errors.
12. CRITICAL: Double-check all React code for syntax errors before responding. DO NOT split string literals or class names across multiple lines. Ensure all JSX template literals (className={\`...\`}) are perfectly formatted with matching brackets and backticks.`;





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
                } catch (e) {
                    isClosed = true;
                    throw e;
                }
            };
            const closeStream = () => {
                if (isClosed) return;
                isClosed = true;
                try {
                    controller.close();
                } catch {}
            };

            try {
                const contents = await buildContents(messages, fileData);

                const geminiStream = await ai.models.generateContentStream({
                    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
                    contents,
                    config: {
                        systemInstruction: SYSTEM_PROMPT,
                        temperature: 0.7,

                        // Force jSON o/p, Gemini will never wrap the responce in markdown
                        responseMimeType: "application/json",

                        // Gemini emits thought chunks before the actual output.
                        // We extract short labels from them and emit as status events
                        // so the user sees "Designing layout…", "Adding interactivity…" etc.
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
                            // Extract just the short label — not the full wall of text

                            // Thought chunks are Gemini's internal reasoning – verbose and frequent.
                            // We throttle to one status update per 600ms and extract just the
                            // bold heading or first sentence so the UI stays clean.

                            const now = Date.now();
                            if (now - lastEmitTime > 600) {
                                const label = extractThoughtLabel(part.text);
                                if (label) {
                                    enqueue(sseEvent("status", { message: label }));
                                    lastEmitTime = now;
                                }
                            }
                        } else {
                            // No thought parts are actual JSON o/p - accumulate them
                            accumulated += part.text;
                        }
                    }
                }

                // ── Parse the complete JSON response ──────────────────────────────────
                // If Gemini returns malformed JSON we abort here without deducting a credit.
                // This is the "no charge on AI failure" guarantee.
                let parsed: {
                    assistantMessage: string;
                    title?: string;
                    files: Record<string, { code: string }>;
                    dependencies: Record<string, string>;
                };

                let cleanJson = accumulated.trim();
                const firstBrace = cleanJson.indexOf('{');
                const lastBrace = cleanJson.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
                }

                try {
                    parsed = JSON.parse(cleanJson);
                } catch {
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
                // Gemini sometimes hallucinates package names that don't exist on npm.
                // We hit the npm registry for each dep and silently drop any fakes.
                // Real packages pass through unchanged.

                enqueue(sseEvent("status", { message: "Validating packages…" }));
                const validatedDeps = await validateDependencies(dependencies ?? {});
                const newFileData: FileData = {
                    files: {
                        ...(fileData?.files || {}),
                        ...files,
                    },
                    dependencies: {
                        ...(fileData?.dependencies || {}),
                        ...validatedDeps,
                    },
                    title: aiTitle || fileData?.title || "Zephyre App",
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
                    db.user.update({
                        where: { id: userId },
                        data: { credits: { decrement: CREDIT_COST_PER_GENERATION } },
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
                        creditsRemaining:
                            updatedUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
                    })
                );
            } catch (err: any) {
                console.error("[gen-ai-code] stream error:", err);
                
                let errorMessage = "Something went wrong. Please try again.";
                
                // Parse specific API errors so the user knows what actually happened
                if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("quota")) {
                    errorMessage = "You have exceeded your Gemini API rate limit (Free Tier). Please wait 60 seconds and try again.";
                } else if (err?.status === 503 || err?.message?.includes("503")) {
                    errorMessage = "The Gemini AI servers are currently experiencing high demand. Please try again in a few moments.";
                } else if (err?.code === "ECONNRESET" || err?.cause?.code === "ECONNRESET" || err?.message?.includes("terminated")) {
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