import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Agent, createTool } from "@cline/sdk";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { FileData } from "@/types/workspace";
import { revalidatePath } from "next/cache";
import { aj, warnIfArcjetUnconfigured } from "@/lib/arcjet";
import {
    applyFileChanges,
    ensureStandardFiles,
    normalizeFilePaths,
    parseLlmJson,
    validateProjectSyntax,
} from "@/lib/ai-json-parser";
import {
    buildSyntaxRepairPrompt,
    DIAGNOSTIC_FIX_SYSTEM_PROMPT,
} from "@/lib/ai-prompts";
import {
    classifyGeminiError,
    formatUserFacingGeminiError,
    generateGeminiContentWithFallback,
    getImproveCandidateModels,
} from "@/lib/gemini-client";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(type: string, payload: object): string {
    return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    const { userId: clerkId } = await auth();
    if (!clerkId)
        return Response.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { userId, workspaceId, userRequest, fileData } = body as {
        userId: string;
        workspaceId: string;
        userRequest: string; // what the user wants improved
        fileData: FileData;
    };

    if (!userId || !workspaceId || !userRequest?.trim() || !fileData?.files) {
        return Response.json({ message: "Missing required request fields" }, { status: 400 });
    }

    warnIfArcjetUnconfigured("api/improve");
    if (process.env.ARCJET_KEY) {
        const arcjetReq = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: JSON.stringify(body),
        });
        const decision = await aj.protect(arcjetReq, {
            requested: 1,
            userId: clerkId,
            detectPromptInjectionMessage: userRequest,
            sensitiveInfoValue: userRequest,
        });
        if (decision.isDenied()) {
            return Response.json(
                { message: decision.reason?.type ?? "Request blocked" },
                { status: 429 }
            );
        }
    }

    // ── Auth + credit + workspace ownership check ──────────────────────────────

    const user = await db.user.findUnique({
        where: { id: userId, clerkId },
        select: { id: true, credits: true, plan: true },
    });

    if (!user)
        return Response.json({ message: "User not found" }, { status: 404 });

    // Pro-only gate
    if (user.plan !== "pro")
        return Response.json({ message: "Upgrade required" }, { status: 403 });

    if (user.credits < CREDIT_COST_PER_GENERATION)
        return Response.json({ message: "Insufficient credits" }, { status: 402 });

    const existingWorkspace = await db.workspace.findUnique({
        where: { id_userId: { id: workspaceId, userId } },
        select: { id: true },
    });
    if (!existingWorkspace) {
        return Response.json({ message: "Workspace not found" }, { status: 404 });
    }

    // ── Build the agent ────────────────────────────────────────────────────────

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

            const pingInterval = setInterval(() => {
                if (isClosed) return;
                enqueue(": keepalive\n\n");
            }, 2500);
            const agentUpdatedFiles: Record<string, { code: string }> = {};
            let finalSummary = "";

            // ── Tool 1: update_file ──────────────────────────────────────────────
            // The agent calls this once per file it wants to change.
            // We immediately emit a file_patch SSE event so the client
            // updates live as each file is patched.

            let hasAppliedPatches = false;

            const updateFileTool = createTool({
                name: "update_file",
                description:
                    "Update or rewrite a file in the React sandbox. Call once per file you need to change.",
                inputSchema: z.object({
                    path: z
                        .string()
                        .describe("File path exactly as it appears, e.g. /src/App.jsx"),
                    code: z.string().describe("Complete new contents of the file"),
                    reason: z
                        .string()
                        .describe("One sentence explaining what you changed and why"),
                }),
                async execute({ path, code, reason }) {
                    hasAppliedPatches = true;
                    const normalizedMap = normalizeFilePaths({ [path]: { code } });
                    const entries = Object.entries(normalizedMap);
                    const [normalizedPath, normalizedFile] = entries[0] ?? [path, { code }];
                    agentUpdatedFiles[normalizedPath] = normalizedFile;
                    // Emit live patch — client applies it to state immediately
                    enqueue(
                        sseEvent("file_patch", {
                            path: normalizedPath,
                            code: normalizedFile.code,
                            reason,
                        })
                    );
                    return `Updated ${normalizedPath}: ${reason}`;
                },
            });

            // ── Tool 2: done_improving ───────────────────────────────────────────
            // Agent calls this when all files are updated.
            // lifecycle.completesRun: true tells the Cline SDK loop to stop
            // immediately after this tool runs instead of continuing iterations.

            const doneImprovingTool = createTool({
                name: "done_improving",
                description:
                    "Call this when you have finished making all improvements.",
                inputSchema: z.object({
                    summary: z
                        .string()
                        .describe(
                            "A short friendly summary of all the improvements you made (1-3 sentences)"
                        ),
                }),
                lifecycle: { completesRun: true },
                async execute({ summary }) {
                    finalSummary = summary;
                    return "Done.";
                },
            });

            // ── Serialize current files for context ──────────────────────────────
            // We give the agent all current files as context in the system prompt
            // so it knows exactly what it's working with.

            const fileContext = Object.entries(fileData.files)
                .map(([path, { code }]) => `// ${path}\n${code}`)
                .join("\n\n---\n\n");

            const createImproveAgent = (modelId: string) => {
                const agent = new Agent({
                    providerId: "gemini",
                    modelId,
                    apiKey: process.env.GEMINI_API_KEY!,
                    maxIterations: 20,
                    systemPrompt: `You are an elite principal full-stack developer improving and modifying a live, production-grade web application running in an isolated cloud microVM.

The app is built with React 19 (functional components with hooks), Tailwind CSS CDN for styling, and an Express file-backed persistence server on port 3001.
Pre-installed packages in /package.json: react, react-dom, lucide-react, clsx, tailwind-merge, express, cors (plus any packages already declared in /package.json above).
If you import any new third-party package (e.g. recharts, framer-motion, react-router-dom, date-fns, zod, react-hook-form), you MUST also update /package.json via \`update_file\` to include it in "dependencies". Otherwise prefer zero-dependency React + Tailwind + lucide-react implementations.

Here are the current files:

${fileContext}

WORKFLOW:
1. Understand the user's requested improvements, modifications, or bug fixes.
2. Maintain existing architectural integrity:
   - If this is a focused utility/game, preserve single-screen polish, Web Audio, score history, and state.
   - If this is a platform/store/SaaS, preserve the multi-view routing, navigation header, catalog, cart drawer, modals, and footer.
3. Identify which files need to change or be created.
4. Call update_file for each file that needs changes (always provide the COMPLETE, error-free file content).
5. Once all files are updated, call done_improving with a short summary.

RULES:
- Always write complete file contents — never partial snippets or placeholders.
- Keep all existing features, data structures, and views unless specifically asked to change or remove them.
- Preserve optimistic UI state updates for immediate 0ms user feedback.
- Entry point is /src/App.jsx with a default export.
- Use .jsx file extensions for all React component files.
- All imports must reference valid existing files or installed packages.
- CRITICAL IMPORT RULE: Do not hallucinate imports. If you import icons from \`lucide-react\`, only use standard existing lucide icons.
- CRITICAL EXPORT RULE: If you create a new component in a file, ensure it is properly exported.
- CRITICAL DEFENSIVE CODING: Use optional chaining (item?.title) and image onError fallbacks to prevent runtime crashes.
- CRITICAL TAILWIND SYNTAX: If dynamic class names are needed, use: className={\`my-class \${variable}\`}.
- PRO TIP: You can call \`update_file\` multiple times in a single turn to update all necessary files efficiently!`,
                    tools: [updateFileTool, doneImprovingTool],
                    // Auto-approve both tools — no human-in-the-loop needed in this context
                    toolPolicies: {
                        update_file: { autoApprove: true },
                        done_improving: { autoApprove: true },
                    },
                });

                agent.subscribe((event) => {
                    if (event.type === "assistant-text-delta" && event.text) {
                        enqueue(sseEvent("thinking", { text: event.text }));
                    }

                    // This fires reliably every time a tool is called
                    if (event.type === "tool-started") {
                        const name = event.toolCall?.toolName;
                        if (name === "update_file") {
                            const path =
                                (event.toolCall?.input as { path?: string })?.path ?? "a file";
                            enqueue(
                                sseEvent("thinking", { text: `\n\nUpdating \`${path}\`…` })
                            );
                        } else if (name === "done_improving") {
                            enqueue(
                                sseEvent("thinking", { text: "\n\nFinalizing improvements…" })
                            );
                        }
                    }
                });

                return agent;
            };

            try {
                const candidateModels = getImproveCandidateModels(
                    process.env.GEMINI_IMPROVE_MODEL,
                    process.env.GEMINI_MODEL
                );
                let result: Awaited<ReturnType<Agent["run"]>> | null = null;

                for (let idx = 0; idx < candidateModels.length; idx++) {
                    const candidateModel = candidateModels[idx];
                    const agent = createImproveAgent(candidateModel);

                    enqueue(
                        sseEvent("status", {
                            message:
                                idx === 0
                                    ? "Cline agent starting…"
                                    : `Switching agent to ${candidateModel}…`,
                        })
                    );

                    try {
                        const runResult = await agent.run(userRequest);
                        if (runResult.status === "failed") {
                            throw new Error(runResult.error?.message ?? "Agent run failed");
                        }
                        result = runResult;
                        break;
                    } catch (agentErr: unknown) {
                        const classified = classifyGeminiError(agentErr);
                        if (
                            hasAppliedPatches ||
                            !classified.isRetryable ||
                            idx === candidateModels.length - 1
                        ) {
                            throw agentErr;
                        }
                        console.warn(
                            `[improve] Model ${candidateModel} failed (${classified.kind}), switching to ${candidateModels[idx + 1]}...`
                        );
                        await new Promise((resolve) =>
                            setTimeout(resolve, classified.kind === "model_unavailable" ? 0 : 450)
                        );
                    }
                }

                if (!result) {
                    throw new Error("Agent failed across all Gemini candidate models.");
                }

                // ── Normalize, ensure standard files, and AST-validate patches ─────

                const mergedFiles = applyFileChanges(fileData.files, agentUpdatedFiles);
                const mergedDeps: Record<string, string> = { ...(fileData.dependencies || {}) };
                if (mergedFiles["/package.json"]?.code) {
                    try {
                        const pkgParsed = JSON.parse(mergedFiles["/package.json"].code) as {
                            dependencies?: Record<string, string>;
                        };
                        if (pkgParsed.dependencies && typeof pkgParsed.dependencies === "object") {
                            Object.assign(mergedDeps, pkgParsed.dependencies);
                        }
                    } catch {
                        // Syntax check below will catch malformed package.json
                    }
                }

                const ensured = ensureStandardFiles(
                    mergedFiles,
                    mergedDeps,
                    fileData.title || "Zephyre App"
                );
                let fullFiles = ensured.files;
                let fullDeps = ensured.dependencies;

                let syntaxErrors = validateProjectSyntax(fullFiles);
                if (syntaxErrors.length > 0) {
                    enqueue(
                        sseEvent("status", {
                            message: `Auto-repairing syntax (${syntaxErrors.length} file${syntaxErrors.length > 1 ? "s" : ""})…`,
                        })
                    );
                    try {
                        const repairPrompt = buildSyntaxRepairPrompt(syntaxErrors, fullFiles);
                        const repairResult = await generateGeminiContentWithFallback({
                            client: ai.models,
                            preferredModel: candidateModels[0],
                            contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
                            config: {
                                systemInstruction: DIAGNOSTIC_FIX_SYSTEM_PROMPT,
                                temperature: 0.15,
                                maxOutputTokens: 65536,
                                responseMimeType: "application/json",
                            },
                        });
                        if (repairResult.text?.trim()) {
                            const repairedParsed = parseLlmJson(repairResult.text);
                            if (repairedParsed.files && Object.keys(repairedParsed.files).length > 0) {
                                const reapplied = applyFileChanges(fullFiles, repairedParsed.files);
                                const reEnsured = ensureStandardFiles(
                                    reapplied,
                                    fullDeps,
                                    fileData.title || "Zephyre App"
                                );
                                fullFiles = reEnsured.files;
                                fullDeps = reEnsured.dependencies;
                                for (const [repairedPath, repairedObj] of Object.entries(repairedParsed.files)) {
                                    const code = fullFiles[repairedPath]?.code ?? repairedObj?.code;
                                    if (typeof code === "string") {
                                        enqueue(
                                            sseEvent("file_patch", {
                                                path: repairedPath,
                                                code,
                                                reason: "Auto-repaired syntax before saving",
                                            })
                                        );
                                    }
                                }
                                syntaxErrors = validateProjectSyntax(fullFiles);
                            }
                        }
                    } catch (healErr) {
                        console.warn("[improve] Syntax self-healing pass failed:", healErr);
                    }
                }

                if (syntaxErrors.length > 0) {
                    console.warn(
                        "[improve] Residual syntax issues after repair:",
                        syntaxErrors.map((e) => e.path)
                    );
                }

                // ── Deduct credit + save to DB ────────────────────────────────────

                const newFileData: FileData = {
                    files: fullFiles,
                    dependencies: fullDeps,
                    title: fileData.title,
                };

                await db.$transaction([
                    db.workspace.update({
                        where: { id_userId: { id: workspaceId, userId } },
                        data: { fileData: newFileData as never },
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
                ]);

                const updatedUser = await db.user.findUnique({
                    where: { id: userId },
                    select: { credits: true },
                });

                try {
                    revalidatePath("/projects");
                } catch {
                    // Safe swallow in streaming context
                }

                // ── Final done event ──────────────────────────────────────────────

                enqueue(
                    sseEvent("done", {
                        fileData: newFileData,
                        summary: finalSummary || result.outputText,
                        creditsRemaining: updatedUser?.credits ?? 0,
                    })
                );
            } catch (err: unknown) {
                console.error("[improve] error:", err);

                const classified = classifyGeminiError(err);
                const errorMessage =
                    classified.kind !== "fatal"
                        ? formatUserFacingGeminiError(err)
                        : err instanceof Error
                        ? err.message
                        : "Something went wrong. Please try again.";

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
export const maxDuration = 300; // for vercel - 300s on Fluid
