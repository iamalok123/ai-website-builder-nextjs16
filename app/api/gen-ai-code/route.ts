import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { Message, FileData } from "@/types/workspace";
import { aj, warnIfArcjetUnconfigured } from "@/lib/arcjet";
import { revalidatePath } from "next/cache";
import { parseLlmJson, ensureStandardFiles, applyFileChanges, validateProjectSyntax, type ParsedLlmResponse } from "@/lib/ai-json-parser";
import { DIAGNOSTIC_FIX_SYSTEM_PROMPT, getSystemPrompt, synthesizeDomainBlueprint, buildSyntaxRepairPrompt } from "@/lib/ai-prompts";
import {
    DEFAULT_GEMINI_MODEL,
    formatUserFacingGeminiError,
    generateGeminiContentWithFallback,
    streamGeminiWithFallback,
} from "@/lib/gemini-client";
import { isDiagnosticPrompt, extractDiagnosticSummary } from "@/lib/error-fixer";
import { isSafeExternalUrl } from "@/lib/security";



const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });



// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(type: string, payload: unknown): string {
    return `data: ${JSON.stringify({ type, ...(payload as object) })}\n\n`;
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

const MAX_EXTERNAL_ASSET_BYTES = 10 * 1024 * 1024; // 10MB cap for fetched design images/PDFs

async function fetchSafeExternalBinary(
    rawUrl: string,
    fallbackMime: string
): Promise<{ base64: string; mimeType: string } | null> {
    if (!isSafeExternalUrl(rawUrl)) {
        console.warn("[Security SSRF Block] Blocked untrusted URL:", rawUrl);
        return null;
    }

    const res = await fetch(rawUrl, {
        signal: AbortSignal.timeout(5000),
        redirect: "manual",
    });

    // Reject 3xx redirects rather than following into potentially private/metadata hosts
    if (!res.ok) return null;

    const declaredLength = Number(res.headers.get("content-length") || "0");
    if (declaredLength > MAX_EXTERNAL_ASSET_BYTES) {
        console.warn("[Security] Skipped oversized external attachment:", rawUrl);
        return null;
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_EXTERNAL_ASSET_BYTES) {
        console.warn("[Security] Skipped oversized external attachment body:", rawUrl);
        return null;
    }

    return {
        base64: Buffer.from(buf).toString("base64"),
        mimeType: res.headers.get("content-type") || fallbackMime,
    };
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
                                try {
                                    const fetched = await fetchSafeExternalBinary(file.url, mimeType);
                                    if (fetched) {
                                        base64Data = fetched.base64;
                                        mimeType = fetched.mimeType;
                                    }
                                } catch (err) {
                                    console.error("Failed to fetch attached binary file:", err);
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
                    try {
                        const fetched = await fetchSafeExternalBinary(msg.imageUrl, "image/jpeg");
                        if (fetched) {
                            parts.push({
                                inlineData: {
                                    data: fetched.base64,
                                    mimeType: fetched.mimeType,
                                },
                            });
                        }
                    } catch (error) {
                        console.error("Failed to fetch image for Gemini:", error);
                    }
                }

                const isLast = idx === trimmed.length - 1;
                const brokenPaths = new Set<string>();
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
                                if (typeof brokenCode === "string" && !brokenPaths.has(err.path)) {
                                    brokenPaths.add(err.path);
                                    text += `\n--- ${err.path} (AST Error: ${err.message}) ---\n\`\`\`\n${brokenCode}\n\`\`\`\n`;
                                }
                            }
                        }
                    }

                    if (fileData && fileData.files) {
                        const fileEntries = Object.entries(fileData.files).filter(
                            ([fPath]) => !(fPath === "/App.jsx" && Boolean(fileData.files["/src/App.jsx"]))
                        );
                        const outline = fileEntries
                            .map(([fPath, fObj]) => `- ${fPath} (${(fObj?.code || "").split("\n").length} lines)`)
                            .join("\n");

                        // Avoid duplicating broken files already printed verbatim in the AST audit block
                        const compactFiles: Record<string, { code: string }> = {};
                        for (const [fPath, fObj] of fileEntries) {
                            compactFiles[fPath] = brokenPaths.has(fPath)
                                ? { code: "[omitted — full contents included in AST Audit section above]" }
                                : { code: fObj?.code || "" };
                        }

                        const compactContext = {
                            title: fileData.title || "Zephyre App",
                            dependencies: fileData.dependencies || {},
                            files: compactFiles,
                        };

                        text += `\n\n=== EXISTING PROJECT CONTEXT ===\nProject Title: ${compactContext.title}\nProject Files Overview:\n${outline}\n\nCurrent Full Codebase (compact JSON):\n${JSON.stringify(compactContext)}`;
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
    if (!userId || typeof userId !== "string") {
        return Response.json({ message: "Invalid user ID" }, { status: 400 });
    }



    // ── Arcjet: rate limit, prompt injection, sensitive info ──────────────────
    // detectPromptInjectionMessage requires the actual user text to inspect.

    const arcjetReq = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(body),
    });

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    warnIfArcjetUnconfigured("api/gen-ai-code");
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

    if (workspaceId) {
        const existingWorkspace = await db.workspace.findUnique({
            where: { id_userId: { id: workspaceId, userId } },
            select: { id: true },
        });
        if (!existingWorkspace) {
            return Response.json({ message: "Workspace not found" }, { status: 404 });
        }
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
                const preferredModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
                const contents = await buildContents(messages, fileData);

                const generationResult = await streamGeminiWithFallback({
                    client: ai.models,
                    preferredModel,
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
                    onThoughtLabel: (label) => enqueue(sseEvent("status", { message: label })),
                    onStatus: (message) => enqueue(sseEvent("status", { message })),
                    canRecoverPartial: (text) => {
                        if (text.trim().length < 150) return false;
                        try {
                            const candidate = parseLlmJson(text);
                            return Boolean(candidate?.files && Object.keys(candidate.files).length > 0);
                        } catch {
                            return false;
                        }
                    },
                });

                const accumulated = generationResult.text;
                const activeModel = generationResult.modelUsed;
                if (generationResult.finishReason === "MAX_TOKENS") {
                    console.warn(`[gen-ai-code] ${activeModel} hit MAX_TOKENS limit; relying on structural parser & self-healing compiler gate.`);
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
                        const repairResult = await generateGeminiContentWithFallback({
                            client: ai.models,
                            preferredModel: activeModel,
                            contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
                            config: {
                                systemInstruction: DIAGNOSTIC_FIX_SYSTEM_PROMPT,
                                temperature: 0.15,
                                maxOutputTokens: 65536,
                                responseMimeType: "application/json",
                            },
                        });

                        const repairRaw = repairResult.text || "";
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
                    let fallbackSaved = false;
                    if (workspaceId) {
                        const updated = await db.workspace.update({
                            where: { id_userId: { id: workspaceId, userId } },
                            data: {
                                messages: updatedMessages as never,
                                fileData: newFileData as never,
                            },
                        }).catch((e) => {
                            console.error("Workspace update fallback failed:", e);
                            return null;
                        });
                        if (updated) fallbackSaved = true;
                    } else {
                        const created = await db.workspace.create({
                            data: {
                                userId,
                                title: aiTitle ?? finalUserMessage.content.slice(0, 80),
                                messages: updatedMessages as never,
                                fileData: newFileData as never,
                            },
                        }).catch((e) => {
                            console.error("Workspace create fallback failed:", e);
                            return null;
                        });
                        if (created) {
                            finalWorkspaceId = created.id;
                            fallbackSaved = true;
                        }
                    }

                    if (fallbackSaved) {
                        await db.user.updateMany({
                            where: {
                                id: userId,
                                credits: { gte: CREDIT_COST_PER_GENERATION },
                            },
                            data: {
                                credits: { decrement: CREDIT_COST_PER_GENERATION },
                            },
                        }).catch((e) => console.error("Credit deduction fallback failed:", e));
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

                const errorMessage = formatUserFacingGeminiError(err);

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