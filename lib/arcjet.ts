import arcjet, {
    tokenBucket,
    detectPromptInjection,
    sensitiveInfo,
} from "@arcjet/next";

// Note: Route-level Arcjet client for /api/gen-ai-code and /api/improve.
// shield + detectBot handled globally in proxy.ts,
// Characteristics: "userId" means each Clerk user gets their own token bucket,
// so corporate offices / VPNs sharing an IP don't share rate limits.

const warnedContexts = new Set<string>();

/**
 * Emits a once-per-context warning in production when ARCJET_KEY is missing,
 * so silent protection bypasses are visible in server logs.
 */
export function warnIfArcjetUnconfigured(context: string): void {
    if (process.env.ARCJET_KEY || process.env.NODE_ENV !== "production") {
        return;
    }
    if (!warnedContexts.has(context)) {
        warnedContexts.add(context);
        console.warn(
            `[Arcjet] ARCJET_KEY is unset in production (${context}); rate limiting and prompt injection protection are bypassed.`
        );
    }
}

export const aj = arcjet({
    key: process.env.ARCJET_KEY || "ajkey_placeholder",
    characteristics: ["userId"],
    rules: [
        // ── Per-user rate limit ────────────────────────────────────────────────
        // Token bucket: 5 generations per 60 seconds per user.
        // Each call to aj.protect() costs `requested` tokens (we pass 1).
        // Adjust refillRate / capacity for your plans as needed.
        tokenBucket({
            mode: "LIVE",
            refillRate: 5, // refill 5 tokens every...
            interval: 60, // ...60 seconds
            capacity: 5, // max burst = 5
        }),

        // ── Prompt injection detection ─────────────────────────────────────────
        // Blocks jailbreak attempts before they hit Gemini.
        // Arcjet inspects the request body automatically — no extra params needed.
        detectPromptInjection({
            mode: "LIVE",
        }),

        // ── Sensitive information ──────────────────────────────────────────────
        // Prevents users from accidentally leaking secrets into Gemini prompts
        // e.g. pasting a .env file with DB credentials or API keys.
        sensitiveInfo({
            mode: "LIVE",
            deny: ["CREDIT_CARD_NUMBER", "API_KEY", "AWS_SECRET_KEY"],
        }),
    ],
});
