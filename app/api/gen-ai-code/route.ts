import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { Message, FileData } from "@/types/workspace";
import { aj } from "@/lib/arcjet";
import { revalidatePath } from "next/cache";
import { parseLlmJson, ensureStandardFiles, applyFileChanges, validateProjectSyntax, type ParsedLlmResponse } from "@/lib/ai-json-parser";
import { DIAGNOSTIC_FIX_SYSTEM_PROMPT, getSystemPrompt, synthesizeDomainBlueprint, buildSyntaxRepairPrompt } from "@/lib/ai-prompts";
import { isDiagnosticPrompt, extractDiagnosticSummary } from "@/lib/error-fixer";
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




// Prompt helpers & domain blueprints now live in @/lib/ai-prompts

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
                if (!isLast && isDiagnosticPrompt(msg.content)) {
                    const summary = extractDiagnosticSummary(msg.content);
                    text = `[Previous Auto-Fix Diagnostic Request: ${summary.title} — ${summary.message}]`;
                } else if (isLast) {
                    const isFixRequest = isDiagnosticPrompt(msg.content);
                    if (!isFixRequest) {
                        const domainBlueprint = synthesizeDomainBlueprint(text);
                        text = `=== MANDATORY DOMAIN BLUEPRINT (Top 25-30 Features Benchmark) ===\n${domainBlueprint}\n\n` + text;
                    } else if (fileData?.files) {
                        // Server-side @babel/parser AST audit across the entire workspace
                        const serverAuditErrors = validateProjectSyntax(fileData.files);
                        if (serverAuditErrors.length > 0) {
                            const summaryList = serverAuditErrors
                                .map(
                                    (err) =>
                                        `- ${err.path}${err.line ? ` (line ${err.line}:${err.column ?? 0})` : ""}: ${err.message}`
                                )
                                .join("\n");
                            text += `\n\n=== SERVER COMPILER AST AUDIT (FIX ALL LISTED FILES) ===\n${summaryList}\n`;
                            for (const err of serverAuditErrors) {
                                const brokenCode = fileData.files[err.path]?.code;
                                if (typeof brokenCode === "string" && !text.includes(`--- ${err.path} ---`)) {
                                    text += `\n--- ${err.path} (AST Error: ${err.message}) ---\n\`\`\`\n${brokenCode}\n\`\`\`\n`;
                                }
                            }
                        }
                    }

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
                const isFixRequest = isDiagnosticPrompt(lastUserMessage);
                const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";
                const contents = await buildContents(messages, fileData);

                const geminiStream = await ai.models.generateContentStream({
                    model: modelName,
                    contents,
                    config: {
                        systemInstruction: getSystemPrompt(messages, fileData),
                        temperature: isFixRequest ? 0.2 : 0.7,
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
                let lastFinishReason: string | undefined;

                try {
                    for await (const chunk of geminiStream) {
                        const candidate0 = chunk.candidates?.[0];
                        if (candidate0?.finishReason) {
                            lastFinishReason = candidate0.finishReason;
                        }
                        const parts = candidate0?.content?.parts ?? [];

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

                if (lastFinishReason === "MAX_TOKENS") {
                    console.warn("[gen-ai-code] Gemini hit MAX_TOKENS limit; relying on structural parser & self-healing compiler gate.");
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

                let {
                    assistantMessage,
                } = parsed;
                const {
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

                let { files: fullFiles, dependencies: fullDeps } = ensureStandardFiles(
                    mergedFiles,
                    mergedDeps,
                    finalTitle
                );

                // ── Pre-Save Babel AST Verification & Self-Healing Gate ────────────────
                enqueue(sseEvent("status", { message: "Verifying build integrity…" }));
                let syntaxErrors = validateProjectSyntax(fullFiles);
                let healAttempts = 0;
                const MAX_HEAL_ATTEMPTS = 2;

                while (syntaxErrors.length > 0 && healAttempts < MAX_HEAL_ATTEMPTS) {
                    healAttempts++;
                    enqueue(
                        sseEvent("status", {
                            message: `Auto-repairing syntax (${syntaxErrors.length} file${syntaxErrors.length > 1 ? "s" : ""})…`,
                        })
                    );

                    try {
                        const repairPrompt = buildSyntaxRepairPrompt(syntaxErrors, fullFiles);
                        const repairRes = await ai.models.generateContent({
                            model: modelName,
                            contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
                            config: {
                                systemInstruction: DIAGNOSTIC_FIX_SYSTEM_PROMPT,
                                temperature: 0.15,
                                maxOutputTokens: 65536,
                                responseMimeType: "application/json",
                            },
                        });

                        const repairRaw = repairRes.text || "";
                        if (!repairRaw.trim()) break;

                        const repairedParsed = parseLlmJson(repairRaw);
                        if (!repairedParsed.files || Object.keys(repairedParsed.files).length === 0) {
                            break;
                        }

                        const reapplied = applyFileChanges(fullFiles, repairedParsed.files);
                        const ensured = ensureStandardFiles(reapplied, fullDeps, finalTitle);
                        fullFiles = ensured.files;
                        fullDeps = ensured.dependencies;
                        syntaxErrors = validateProjectSyntax(fullFiles);
                    } catch (healErr) {
                        console.warn(`[gen-ai-code] Self-healing pass ${healAttempts} failed:`, healErr);
                        break;
                    }
                }

                if (syntaxErrors.length > 0 && isFixRequest) {
                    const remainingSummary = syntaxErrors.map((e) => e.path).join(", ");
                    assistantMessage = `${assistantMessage} (Verification notice: residual syntax issue remains in ${remainingSummary}.)`;
                }

                const newFileData: FileData = {
                    files: fullFiles,
                    dependencies: fullDeps,
                    title: finalTitle,
                };

                // — Upsert workspace + deduct credit ———————
                // Unconditional DB save: Even if mobile connection had a momentary hiccup,
                // the generated project is ALWAYS saved to PostgreSQL so the user never loses their work.
                enqueue(sseEvent("status", { message: "Saving…" }));

                const finalUserMessage = messages[messages.length - 1];
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
                                    title: aiTitle ?? finalUserMessage.content.slice(0, 80),
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
                                title: aiTitle ?? finalUserMessage.content.slice(0, 80),
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