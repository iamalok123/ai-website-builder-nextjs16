import { describe, it, expect, vi } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import {
    ACTIVE_GEMINI_STREAM_MODELS,
    DEPRECATED_GEMINI_MODELS,
    classifyGeminiError,
    formatUserFacingGeminiError,
    generateGeminiContentWithFallback,
    getGeminiCandidateModels,
    getImproveCandidateModels,
    streamGeminiWithFallback,
    type GeminiModelsClient,
} from "@/lib/gemini-client";

function makeChunk(text: string, options?: { thought?: boolean; finishReason?: string }): GenerateContentResponse {
    return {
        candidates: [
            {
                finishReason: options?.finishReason as never,
                content: {
                    role: "model",
                    parts: [{ text, thought: options?.thought }],
                },
            },
        ],
    } as unknown as GenerateContentResponse;
}

async function* yieldChunks(chunks: GenerateContentResponse[], errorAfter?: Error): AsyncGenerator<GenerateContentResponse> {
    for (const c of chunks) {
        yield c;
    }
    if (errorAfter) {
        throw errorAfter;
    }
}

describe("Gemini Client Resilience & Failover", () => {
    it("never includes deprecated 2.5/2.0 models in candidate lists and keeps 3.5-flash native-first for improve", () => {
        const fromStaleEnv = getGeminiCandidateModels("gemini-2.5-flash");
        expect(fromStaleEnv[0]).toBe("gemini-3.6-flash");
        for (const deprecated of DEPRECATED_GEMINI_MODELS) {
            expect(fromStaleEnv).not.toContain(deprecated);
        }

        const fromStrippedPrefix = getGeminiCandidateModels("models/gemini-3.6-flash");
        expect(fromStrippedPrefix[0]).toBe("gemini-3.6-flash");
        expect(fromStrippedPrefix[1]).toBe("gemini-3.5-flash");
        expect(fromStrippedPrefix).toContain("gemini-3.8-flash");
        expect(fromStrippedPrefix.length).toBeGreaterThanOrEqual(ACTIVE_GEMINI_STREAM_MODELS.length);

        const improveCandidates = getImproveCandidateModels(undefined, "gemini-3.6-flash");
        expect(improveCandidates[0]).toBe("gemini-3.5-flash");
        expect(improveCandidates[1]).toBe("gemini-3.6-flash");
        expect(improveCandidates).not.toContain("gemini-2.5-flash");

        const improveStale = getImproveCandidateModels("gemini-2.5-flash", "gemini-3.6-flash");
        expect(improveStale[0]).toBe("gemini-3.5-flash");
        expect(improveStale).not.toContain("gemini-2.5-flash");
    });

    it("classifies 404 sunset, 503 overload, 429 quota, 504 timeout, and stream drops as retryable, while stopping on 401 fatal errors", () => {
        expect(classifyGeminiError({ status: 404, message: "models/gemini-2.5-flash is no longer available" })).toMatchObject({
            kind: "model_unavailable",
            isRetryable: true,
        });
        expect(classifyGeminiError({ status: 503, message: "This model is currently experiencing high demand" })).toMatchObject({
            kind: "overloaded",
            isRetryable: true,
        });
        expect(classifyGeminiError({ status: 429, message: "RESOURCE_EXHAUSTED quota exceeded" })).toMatchObject({
            kind: "quota_exceeded",
            isRetryable: true,
        });
        expect(classifyGeminiError({ status: 504, message: "DEADLINE_EXCEEDED" })).toMatchObject({
            kind: "overloaded",
            isRetryable: true,
        });
        expect(classifyGeminiError(new Error("Incomplete JSON segment at the end"))).toMatchObject({
            kind: "stream_or_network",
            isRetryable: true,
        });
        expect(classifyGeminiError({ status: 401, message: "API key not valid" })).toMatchObject({
            kind: "fatal",
            isRetryable: false,
        });
    });

    it("recovers seamlessly when primary model throws 503 and backup returns 404, succeeding on third active model", async () => {
        const triedModels: string[] = [];
        const statusMessages: string[] = [];

        const mockClient: GeminiModelsClient = {
            generateContentStream: vi.fn(async ({ model }) => {
                triedModels.push(model);
                if (model === "gemini-3.6-flash") {
                    const err = new Error("This model is currently experiencing high demand.") as Error & { status: number };
                    err.status = 503;
                    throw err;
                }
                if (model === "gemini-3.5-flash") {
                    const err = new Error("NOT_FOUND") as Error & { status: number };
                    err.status = 404;
                    throw err;
                }
                return yieldChunks([
                    makeChunk("**Planning UI**", { thought: true }),
                    makeChunk('{"assistantMessage":"Built app","files":{"/src/App.jsx":{"code":"export default function App(){return null;}"}}}'),
                ]);
            }),
            generateContent: vi.fn(),
        };

        const res = await streamGeminiWithFallback({
            client: mockClient,
            preferredModel: "gemini-3.6-flash",
            contents: [{ role: "user", parts: [{ text: "Build app" }] }],
            config: { responseMimeType: "application/json", thinkingConfig: { includeThoughts: true } },
            onStatus: (msg) => statusMessages.push(msg),
            retryDelayMs: 0,
        });

        expect(triedModels).toEqual(["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview"]);
        expect(res.modelUsed).toBe("gemini-3-flash-preview");
        expect(res.text).toContain("Built app");
        expect(statusMessages.some((m) => m.includes("Switching"))).toBe(true);
    });

    it("does not accept unrecoverable truncated mid-stream drops and fails over to the next healthy model", async () => {
        const triedModels: string[] = [];

        const mockClient: GeminiModelsClient = {
            generateContentStream: vi.fn(async ({ model }) => {
                triedModels.push(model);
                if (model === "gemini-3.5-flash") {
                    return yieldChunks(
                        [makeChunk('{"assistantMessage":"Starting...')] as GenerateContentResponse[],
                        new Error("Incomplete JSON segment at the end")
                    );
                }
                return yieldChunks([
                    makeChunk('{"assistantMessage":"Done","files":{"/src/App.jsx":{"code":"export default function App(){return null;}"}}}'),
                ]);
            }),
            generateContent: vi.fn(),
        };

        const res = await streamGeminiWithFallback({
            client: mockClient,
            preferredModel: "gemini-3.5-flash",
            contents: [{ role: "user", parts: [{ text: "Build app" }] }],
            config: { responseMimeType: "application/json" },
            canRecoverPartial: (text) => text.includes('"/src/App.jsx"'),
            retryDelayMs: 0,
        });

        expect(triedModels).toEqual(["gemini-3.5-flash", "gemini-3.6-flash"]);
        expect(res.modelUsed).toBe("gemini-3.6-flash");
        expect(res.recoveredPartial).toBe(false);
    });

    it("falls back to non-streaming lite model when all streaming candidates hit 503/stream errors", async () => {
        const mockClient: GeminiModelsClient = {
            generateContentStream: vi.fn(async () => {
                const err = new Error("503 Service Unavailable") as Error & { status: number };
                err.status = 503;
                throw err;
            }),
            generateContent: vi.fn(async ({ model }) => {
                expect(model).toBe("gemini-3.5-flash-lite");
                return {
                    text: '{"assistantMessage":"Recovered via lite","files":{"/src/App.jsx":{"code":"export default function App(){}"}}}',
                    candidates: [{ finishReason: "STOP" }],
                } as unknown as GenerateContentResponse;
            }),
        };

        const res = await streamGeminiWithFallback({
            client: mockClient,
            preferredModel: "gemini-3.6-flash",
            contents: [{ role: "user", parts: [{ text: "Fix bug" }] }],
            config: { responseMimeType: "application/json" },
            retryDelayMs: 0,
        });

        expect(res.modelUsed).toBe("gemini-3.5-flash-lite");
        expect(res.text).toContain("Recovered via lite");
    });

    it("aborts immediately on fatal non-retryable auth errors without burning quota across fallback models", async () => {
        const streamMock = vi.fn(async () => {
            const err = new Error("API key invalid") as Error & { status: number };
            err.status = 401;
            throw err;
        });

        await expect(
            streamGeminiWithFallback({
                client: { generateContentStream: streamMock, generateContent: vi.fn() },
                preferredModel: "gemini-3.5-flash",
                contents: [{ role: "user", parts: [{ text: "Hello" }] }],
                config: {},
                retryDelayMs: 0,
            })
        ).rejects.toThrow("API key invalid");

        expect(streamMock).toHaveBeenCalledTimes(1);
    });

    it("supports non-streaming AST syntax repair fallback via generateGeminiContentWithFallback", async () => {
        const calls: string[] = [];
        const mockClient: GeminiModelsClient = {
            generateContentStream: vi.fn(),
            generateContent: vi.fn(async ({ model }) => {
                calls.push(model);
                if (model === "gemini-3.5-flash") {
                    const err = new Error("503 high demand") as Error & { status: number };
                    err.status = 503;
                    throw err;
                }
                return { text: '{"files":{}}' } as unknown as GenerateContentResponse;
            }),
        };

        const res = await generateGeminiContentWithFallback({
            client: mockClient,
            preferredModel: "gemini-3.5-flash",
            contents: [{ role: "user", parts: [{ text: "Repair" }] }],
            config: { responseMimeType: "application/json" },
            retryDelayMs: 0,
        });

        expect(calls).toEqual(["gemini-3.5-flash", "gemini-3.6-flash"]);
        expect(res.modelUsed).toBe("gemini-3.6-flash");
        expect(res.text).toBe('{"files":{}}');
    });

    it("produces clear user-facing diagnostics for quota, overload, and sunset errors", () => {
        expect(formatUserFacingGeminiError({ status: 429, message: "RESOURCE_EXHAUSTED" })).toContain("quota");
        expect(formatUserFacingGeminiError({ status: 503, message: "UNAVAILABLE" })).toContain("high demand");
        expect(formatUserFacingGeminiError({ status: 404, message: "NOT_FOUND" })).toContain("GEMINI_MODEL");
    });
});
