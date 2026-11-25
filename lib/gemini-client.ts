import {
    ThinkingLevel,
    type GenerateContentConfig,
    type GenerateContentParameters,
    type GenerateContentResponse,
} from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
export const DEFAULT_IMPROVE_GEMINI_MODEL = "gemini-3.5-flash";

export const DEPRECATED_GEMINI_MODELS = new Set([
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]);

/**
 * Active streaming-capable Gemini Flash candidates ordered by token efficiency,
 * speed, and production JSON/AST reliability. Retired 2.5/2.0 models are never included.
 */
export const ACTIVE_GEMINI_STREAM_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
] as const;

/**
 * High-availability unary fallback models used only when every primary
 * streaming Flash model is congested or hits transient stream truncation.
 */
export const ACTIVE_GEMINI_UNARY_FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
] as const;

export type GeminiErrorKind =
    | "model_unavailable"
    | "quota_exceeded"
    | "overloaded"
    | "thinking_unsupported"
    | "stream_or_network"
    | "fatal";

export interface ClassifiedGeminiError {
    kind: GeminiErrorKind;
    status?: number;
    isRetryable: boolean;
    message: string;
}

export interface GeminiModelsClient {
    generateContentStream: (
        params: GenerateContentParameters
    ) => Promise<AsyncGenerator<GenerateContentResponse>>;
    generateContent: (
        params: GenerateContentParameters
    ) => Promise<GenerateContentResponse>;
}

/**
 * Strips any `models/` prefix and returns normalized active model IDs,
 * filtering out sunset/deprecated models that return 404.
 */
export function normalizeGeminiModelName(model?: string | null): string | null {
    if (!model) return null;
    const clean = model.trim().replace(/^models\//i, "");
    if (!clean || DEPRECATED_GEMINI_MODELS.has(clean)) {
        return null;
    }
    return clean;
}

/**
 * Builds a deduplicated, prioritized list of active streaming Gemini models.
 * Ensures deprecated models like gemini-2.5-flash are never selected.
 */
export function getGeminiCandidateModels(preferredModel?: string | null): string[] {
    const normalizedPreferred = normalizeGeminiModelName(preferredModel);
    const ordered = [
        ...(normalizedPreferred ? [normalizedPreferred] : []),
        ...ACTIVE_GEMINI_STREAM_MODELS,
    ];
    return [...new Set(ordered)];
}

/**
 * Builds candidate models for the Cline SDK Agent in `/api/improve`.
 * Keeps `gemini-3.5-flash` (natively cataloged in `@cline/llms`) first unless an
 * explicit `GEMINI_IMPROVE_MODEL` override is configured, then fails over cleanly.
 */
export function getImproveCandidateModels(
    preferredImproveModel?: string | null,
    fallbackPrimaryModel?: string | null
): string[] {
    const normalizedImprove = normalizeGeminiModelName(preferredImproveModel);
    const normalizedFallback = normalizeGeminiModelName(fallbackPrimaryModel);
    const ordered = [
        ...(normalizedImprove ? [normalizedImprove] : []),
        DEFAULT_IMPROVE_GEMINI_MODEL,
        ...(normalizedFallback ? [normalizedFallback] : []),
        "gemini-3.6-flash",
        "gemini-3-flash-preview",
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
    ];
    return [...new Set(ordered)];
}

function extractErrorStatusCode(err: unknown): number | undefined {
    if (!err || typeof err !== "object") return undefined;
    const obj = err as { status?: unknown; code?: unknown; message?: unknown };
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.code === "number") return obj.code;
    if (typeof obj.message === "string") {
        const jsonCode = obj.message.match(/"code"\s*:\s*(\d{3})/);
        if (jsonCode) return Number(jsonCode[1]);
    }
    return undefined;
}

/**
 * Classifies Gemini SDK, HTTP, and stream errors so transient congestion (503/504),
 * model sunset (404), rate limits (429), and mid-stream drops fail over cleanly.
 */
export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
    const errObj = (err && typeof err === "object" ? err : {}) as {
        name?: string;
        status?: number;
        code?: string | number;
        message?: string;
        cause?: { code?: string };
    };
    const message = errObj.message || (typeof err === "string" ? err : String(err ?? ""));
    const status = extractErrorStatusCode(err);
    const causeCode = errObj.cause?.code;

    if (status === 400 && /thinking|thinkingConfig|thinkingLevel/i.test(message)) {
        return { kind: "thinking_unsupported", status, isRetryable: true, message };
    }

    if (
        status === 404 ||
        /NOT_FOUND|no longer available|is not found|not supported for generateContent/i.test(message)
    ) {
        return { kind: "model_unavailable", status: status ?? 404, isRetryable: true, message };
    }

    if (
        status === 429 ||
        /RESOURCE_EXHAUSTED|quota|rate[- ]?limit|Too Many Requests/i.test(message)
    ) {
        return { kind: "quota_exceeded", status: status ?? 429, isRetryable: true, message };
    }

    if (
        status === 503 ||
        status === 502 ||
        status === 500 ||
        status === 504 ||
        /\b(503|504|502|500)\b|UNAVAILABLE|high demand|DEADLINE_EXCEEDED|overloaded|Service Unavailable/i.test(
            message
        )
    ) {
        return { kind: "overloaded", status, isRetryable: true, message };
    }

    if (
        errObj.name === "AbortError" ||
        errObj.code === "ECONNRESET" ||
        causeCode === "ECONNRESET" ||
        errObj.code === "ETIMEDOUT" ||
        causeCode === "ETIMEDOUT" ||
        /aborted|timeout|terminated|Incomplete JSON segment|Response body is empty|fetch failed/i.test(
            message
        )
    ) {
        return { kind: "stream_or_network", status, isRetryable: true, message };
    }

    return { kind: "fatal", status, isRetryable: false, message };
}

/**
 * Formats an error from Gemini generation/improvement into an accurate, user-safe message.
 */
export function formatUserFacingGeminiError(err: unknown): string {
    const classified = classifyGeminiError(err);

    switch (classified.kind) {
        case "quota_exceeded":
            return "You have reached your Gemini API quota or rate limit. Please wait 60 seconds (or check your Google AI Studio billing/quota limits) and try again.";
        case "overloaded":
            return "Gemini AI servers are experiencing high demand across fallback models. Please try again in a few moments.";
        case "model_unavailable":
            return "Configured Gemini AI model is no longer available. Please update GEMINI_MODEL to gemini-3.5-flash or gemini-3.8-flash.";
        case "stream_or_network":
            return "The AI connection timed out or was interrupted. Please try again.";
        default:
            return "Something went wrong while generating with Gemini AI. Please try again.";
    }
}

function buildThoughtConfig(useThinking: boolean, config: Omit<GenerateContentConfig, "abortSignal">) {
    if (!useThinking) {
        const rest = { ...config };
        delete rest.thinkingConfig;
        return rest;
    }

    return {
        ...config,
        thinkingConfig: {
            includeThoughts: true,
            thinkingLevel: ThinkingLevel.LOW,
            ...(config.thinkingConfig || {}),
        },
    };
}

function extractThoughtLabel(text: string): string | null {
    const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
    if (boldMatch) return boldMatch[1].trim();

    const sentence = text.split(/[.\n]/)[0].trim();
    if (sentence.length >= 8 && sentence.length <= 80) return sentence;

    return null;
}

function sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StreamWithFallbackOptions {
    client: GeminiModelsClient;
    preferredModel?: string | null;
    contents: GenerateContentParameters["contents"];
    config: Omit<GenerateContentConfig, "abortSignal">;
    onThoughtLabel?: (label: string) => void;
    onStatus?: (message: string) => void;
    canRecoverPartial?: (accumulatedText: string) => boolean;
    externalSignal?: AbortSignal;
    timeouts?: {
        firstChunkMs?: number;
        idleMs?: number;
        totalMs?: number;
        unaryMs?: number;
    };
    /** Delay scale (override to 0 in unit tests) */
    retryDelayMs?: number;
}

export interface StreamWithFallbackResult {
    text: string;
    modelUsed: string;
    finishReason?: string;
    recoveredPartial: boolean;
}

/**
 * Streams a Gemini response with automatic multi-model failover covering:
 * - Initial connection 503/429/404/504 errors
 * - Hung/stalled streams via first-chunk & inter-chunk inactivity watchdogs
 * - Mid-stream drops before usable JSON files are produced
 * - ThinkingConfig incompatibility auto-downgrade
 * - Non-streaming lite fallback if every streaming model fails
 */
export async function streamGeminiWithFallback(
    options: StreamWithFallbackOptions
): Promise<StreamWithFallbackResult> {
    const {
        client,
        preferredModel,
        contents,
        config,
        onThoughtLabel,
        onStatus,
        canRecoverPartial,
        externalSignal,
        timeouts,
        retryDelayMs = 450,
    } = options;

    const firstChunkMs = timeouts?.firstChunkMs ?? 35000;
    const idleMs = timeouts?.idleMs ?? 45000;
    const totalMs = timeouts?.totalMs ?? 150000;
    const unaryMs = timeouts?.unaryMs ?? 45000;

    const streamCandidates = getGeminiCandidateModels(preferredModel);
    let lastError: unknown;
    let lastEmitTime = 0;

    for (let idx = 0; idx < streamCandidates.length; idx++) {
        const model = streamCandidates[idx];
        let useThinking = config.thinkingConfig !== undefined;

        for (let thinkingPass = 0; thinkingPass < 2; thinkingPass++) {
            const attemptController = new AbortController();
            let gotAnyChunk = false;
            let idleTimer: ReturnType<typeof setTimeout> | undefined;

            const onExternalAbort = () => attemptController.abort();
            if (externalSignal) {
                if (externalSignal.aborted) {
                    throw new Error("Request aborted");
                }
                externalSignal.addEventListener("abort", onExternalAbort, { once: true });
            }

            const totalTimer = setTimeout(() => attemptController.abort(), totalMs);
            const firstChunkTimer = setTimeout(() => {
                if (!gotAnyChunk) attemptController.abort();
            }, firstChunkMs);

            const refreshIdleTimer = () => {
                if (idleTimer) clearTimeout(idleTimer);
                idleTimer = setTimeout(() => attemptController.abort(), idleMs);
            };

            let accumulated = "";
            let lastFinishReason: string | undefined;

            try {
                const attemptConfig = buildThoughtConfig(useThinking, config);
                const stream = await client.generateContentStream({
                    model,
                    contents,
                    config: {
                        ...attemptConfig,
                        abortSignal: attemptController.signal,
                        httpOptions: {
                            ...(attemptConfig.httpOptions || {}),
                            timeout: totalMs,
                        },
                    },
                });

                for await (const chunk of stream) {
                    if (!gotAnyChunk) {
                        gotAnyChunk = true;
                        if (firstChunkTimer) clearTimeout(firstChunkTimer);
                    }
                    refreshIdleTimer();

                    const candidate0 = chunk.candidates?.[0];
                    if (candidate0?.finishReason) {
                        lastFinishReason = candidate0.finishReason;
                    }
                    const parts = candidate0?.content?.parts ?? [];

                    for (const part of parts) {
                        if (!part.text) continue;
                        if (part.thought) {
                            const now = Date.now();
                            if (onThoughtLabel && now - lastEmitTime > 600) {
                                const label = extractThoughtLabel(part.text);
                                if (label) {
                                    onThoughtLabel(label);
                                    lastEmitTime = now;
                                }
                            }
                        } else {
                            accumulated += part.text;
                        }
                    }
                }

                if (accumulated.trim().length === 0) {
                    throw new Error(`Empty response stream from model ${model}`);
                }

                return {
                    text: accumulated,
                    modelUsed: model,
                    finishReason: lastFinishReason,
                    recoveredPartial: false,
                };
            } catch (err: unknown) {
                lastError = err;

                // If user explicitly canceled, rethrow immediately without fallback
                if (externalSignal?.aborted) {
                    throw err;
                }

                // If stream truncated near completion with parseable files, recover cleanly
                if (accumulated.length > 0 && canRecoverPartial?.(accumulated)) {
                    console.info(
                        `[gen-ai-code] Resilient stream recovery on ${model}: using valid accumulated files (${accumulated.length} bytes).`
                    );
                    return {
                        text: accumulated,
                        modelUsed: model,
                        finishReason: lastFinishReason,
                        recoveredPartial: true,
                    };
                }

                const classified = classifyGeminiError(err);

                if (classified.kind === "thinking_unsupported" && useThinking) {
                    console.warn(`[gen-ai-code] Model ${model} rejected thinkingConfig, retrying without thoughts...`);
                    useThinking = false;
                    continue;
                }

                if (!classified.isRetryable) {
                    throw err;
                }

                const nextModel = streamCandidates[idx + 1];
                console.warn(
                    `[gen-ai-code] Model ${model} failed (${classified.kind}${classified.status ? ` ${classified.status}` : ""}). ${
                        nextModel ? `Switching to ${nextModel}...` : "Trying unary lite fallback..."
                    }`
                );
                if (onStatus) {
                    onStatus(
                        nextModel
                            ? `Switching to ${nextModel}…`
                            : "Trying high-availability backup model…"
                    );
                }

                const waitMs = classified.kind === "model_unavailable" ? 0 : retryDelayMs;
                await sleep(waitMs);
                break; // Move to next model candidate
            } finally {
                clearTimeout(totalTimer);
                if (firstChunkTimer) clearTimeout(firstChunkTimer);
                if (idleTimer) clearTimeout(idleTimer);
                if (externalSignal) {
                    externalSignal.removeEventListener("abort", onExternalAbort);
                }
            }
        }
    }

    // Final safety net: non-streaming request on lightweight high-availability models
    const unaryFallbacks = ACTIVE_GEMINI_UNARY_FALLBACK_MODELS.filter(
        (m) => !streamCandidates.includes(m)
    );
    const allUnaryCandidates =
        unaryFallbacks.length > 0 ? unaryFallbacks : [...ACTIVE_GEMINI_UNARY_FALLBACK_MODELS];

    for (const model of allUnaryCandidates) {
        if (externalSignal?.aborted) throw lastError ?? new Error("Request aborted");
        try {
            if (onStatus) {
                onStatus(`Retrying with ${model}…`);
            }
            const unaryConfig = buildThoughtConfig(false, config);
            const response = await client.generateContent({
                model,
                contents,
                config: {
                    ...unaryConfig,
                    abortSignal: externalSignal,
                    httpOptions: {
                        ...(unaryConfig.httpOptions || {}),
                        timeout: unaryMs,
                    },
                },
            });
            const text = response.text || "";
            if (text.trim().length > 0) {
                return {
                    text,
                    modelUsed: model,
                    finishReason: response.candidates?.[0]?.finishReason,
                    recoveredPartial: false,
                };
            }
        } catch (err: unknown) {
            lastError = err;
            const classified = classifyGeminiError(err);
            console.warn(`[gen-ai-code] Unary fallback ${model} failed (${classified.kind}).`);
            if (!classified.isRetryable) throw err;
        }
    }

    throw lastError ?? new Error("All Gemini models are currently unavailable.");
}

export interface GenerateWithFallbackOptions {
    client: GeminiModelsClient;
    preferredModel?: string | null;
    contents: GenerateContentParameters["contents"];
    config: Omit<GenerateContentConfig, "abortSignal">;
    timeoutMs?: number;
    retryDelayMs?: number;
}

/**
 * Calls `ai.models.generateContent` across the active Gemini candidate chain
 * for targeted non-streaming tasks (e.g., AST syntax self-healing).
 */
export async function generateGeminiContentWithFallback(
    options: GenerateWithFallbackOptions
): Promise<{ text: string; modelUsed: string }> {
    const {
        client,
        preferredModel,
        contents,
        config,
        timeoutMs = 45000,
        retryDelayMs = 350,
    } = options;

    const candidates = [
        ...getGeminiCandidateModels(preferredModel),
        ...ACTIVE_GEMINI_UNARY_FALLBACK_MODELS.filter(
            (m) => !ACTIVE_GEMINI_STREAM_MODELS.includes(m as (typeof ACTIVE_GEMINI_STREAM_MODELS)[number])
        ),
    ];

    let lastError: unknown;

    for (const model of candidates) {
        try {
            const response = await client.generateContent({
                model,
                contents,
                config: {
                    ...config,
                    httpOptions: {
                        ...(config.httpOptions || {}),
                        timeout: timeoutMs,
                    },
                },
            });
            return {
                text: response.text || "",
                modelUsed: model,
            };
        } catch (err: unknown) {
            lastError = err;
            const classified = classifyGeminiError(err);
            if (!classified.isRetryable) throw err;
            console.warn(`[gen-ai-code] Repair call on ${model} failed (${classified.kind}), falling back...`);
            await sleep(classified.kind === "model_unavailable" ? 0 : retryDelayMs);
        }
    }

    throw lastError ?? new Error("All Gemini models failed during generation.");
}
