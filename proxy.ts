import arcjet, { detectBot, shield } from "@arcjet/next";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";


// Global Arcjet client 
// Runs on every request. Looser than the route-level client — allows search
// engines and link previews so the landing page gets indexed and
// Slack/Twitter unfurls work.

const aj = arcjet({
    key: process.env.ARCJET_KEY || "ajkey_placeholder",
    rules: [
        shield({ mode: "LIVE" }),
        detectBot({
            mode: "LIVE",
            allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
    ],
});

let hasWarnedMissingArcjetKey = false;

export default clerkMiddleware(async (auth, req) => {
    // Allow external cron pings to health check without Arcjet bot blocking
    if (req.nextUrl.pathname.startsWith("/api/health")) {
        return NextResponse.next();
    }

    if (process.env.ARCJET_KEY) {
        const decision = await aj.protect(req);
        if (decision.isDenied()) {
            if (req.nextUrl.pathname.startsWith("/api")) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            return new NextResponse(
                "<!doctype html><html><body style='background:#09090b;color:#f4f4f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0'><div style='text-align:center;padding:24px'><h2>Access Denied (403)</h2><p style='color:#a1a1aa'>Request blocked by security policy.</p></div></body></html>",
                { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
            );
        }
    } else if (process.env.NODE_ENV === "production" && !hasWarnedMissingArcjetKey) {
        hasWarnedMissingArcjetKey = true;
        console.warn("[Security] ARCJET_KEY is not configured in production; global bot/shield protection is inactive.");
    }

    // Clerk auth guard — redirect unauthenticated users away from /workspace and /projects
    const { userId, redirectToSignIn } = await auth();
    const pathname = req.nextUrl.pathname;
    const isProtected = pathname.startsWith("/workspace") || pathname.startsWith("/projects");

    if (!userId && isProtected) {
        return redirectToSignIn();
    }

    return NextResponse.next();
});


export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
        // Always run for Clerk-specific frontend API routes
        '/__clerk/(.*)',
    ],
}