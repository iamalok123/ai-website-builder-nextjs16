import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Universal fallback reverse-proxy for E2B sandboxes.
 * Ensures sandboxes with traffic access tokens or cross-origin restrictions
 * can be embedded reliably in browser iframes without 403 errors.
 */
export async function GET(req: NextRequest) {
    return handleProxy(req);
}

export async function HEAD(req: NextRequest) {
    return handleProxy(req);
}

async function handleProxy(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");
    const token = searchParams.get("token") || "";

    if (!targetUrl) {
        return NextResponse.json({ error: "Missing required 'url' query parameter" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        return NextResponse.json({ error: "Invalid target URL format" }, { status: 400 });
    }

    // Security check: Only proxy to E2B sandboxes or local dev
    const hostname = parsedUrl.hostname.toLowerCase();
    const isE2bHost = hostname.endsWith(".e2b.app") || hostname.endsWith(".e2b.dev") || hostname === "localhost" || hostname === "127.0.0.1";
    if (!isE2bHost) {
        return NextResponse.json({ error: "Forbidden: target host is not a valid E2B sandbox domain" }, { status: 403 });
    }

    try {
        const upstreamHeaders = new Headers();
        // Forward standard client headers
        const accept = req.headers.get("accept");
        if (accept) upstreamHeaders.set("accept", accept);
        const userAgent = req.headers.get("user-agent");
        if (userAgent) upstreamHeaders.set("user-agent", userAgent);

        // Inject E2B traffic access token if provided
        if (token) {
            upstreamHeaders.set("e2b-traffic-access-token", token);
        }

        const upstreamRes = await fetch(parsedUrl.toString(), {
            method: req.method,
            headers: upstreamHeaders,
            cache: "no-store",
            redirect: "follow",
        });

        // Copy response headers
        const responseHeaders = new Headers();
        upstreamRes.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            // Strip restrictive frame headers to permit iframe embedding
            if (lowerKey === "x-frame-options" || lowerKey === "content-security-policy") {
                return;
            }
            responseHeaders.set(key, value);
        });

        // Ensure permissive frame display
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new NextResponse(upstreamRes.body, {
            status: upstreamRes.status,
            statusText: upstreamRes.statusText,
            headers: responseHeaders,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Proxy request failed";
        return NextResponse.json(
            { error: `Failed to reach E2B sandbox upstream: ${message}` },
            { status: 502 }
        );
    }
}
