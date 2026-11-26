import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractE2bSandboxIdFromHost, isAllowedE2bProxyHost } from "@/lib/security";

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

export async function POST(req: NextRequest) {
    return handleProxy(req);
}

export async function PUT(req: NextRequest) {
    return handleProxy(req);
}

export async function PATCH(req: NextRequest) {
    return handleProxy(req);
}

export async function DELETE(req: NextRequest) {
    return handleProxy(req);
}

export async function OPTIONS(req: NextRequest) {
    return handleProxy(req);
}

async function handleProxy(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");
    const queryToken = searchParams.get("token") || "";

    if (!targetUrl) {
        return NextResponse.json({ error: "Missing required 'url' query parameter" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        return NextResponse.json({ error: "Invalid target URL format" }, { status: 400 });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json({ error: "Forbidden: target protocol must be HTTP or HTTPS" }, { status: 403 });
    }

    // Security check: Strictly proxy to authorized E2B sandbox hosts
    if (!isAllowedE2bProxyHost(parsedUrl.hostname)) {
        return NextResponse.json({ error: "Forbidden: target host is not a valid E2B sandbox domain" }, { status: 403 });
    }

    try {
        const upstreamHeaders = new Headers();
        // Forward standard client headers
        const accept = req.headers.get("accept");
        if (accept) upstreamHeaders.set("accept", accept);
        const contentType = req.headers.get("content-type");
        if (contentType) upstreamHeaders.set("content-type", contentType);
        const userAgent = req.headers.get("user-agent");
        if (userAgent) upstreamHeaders.set("user-agent", userAgent);

        const e2bSandboxId = extractE2bSandboxIdFromHost(parsedUrl.hostname);
        const cookieToken = e2bSandboxId
            ? req.cookies.get(`zephyre_e2b_${e2bSandboxId}`)?.value || ""
            : "";
        const token = cookieToken || queryToken;

        // Inject E2B traffic access token if provided
        if (token) {
            upstreamHeaders.set("e2b-traffic-access-token", token);
        }

        const hasBody =
            req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
        const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;

        const upstreamRes = await fetch(parsedUrl.toString(), {
            method: req.method,
            headers: upstreamHeaders,
            body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
            cache: "no-store",
            redirect: "manual",
        });

        // Prevent SSRF via upstream 3xx redirects pointing outside allowed E2B domains
        if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
            const location = upstreamRes.headers.get("location");
            if (location) {
                try {
                    const redirectUrl = new URL(location, parsedUrl);
                    if (
                        (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") ||
                        !isAllowedE2bProxyHost(redirectUrl.hostname)
                    ) {
                        return NextResponse.json(
                            { error: "Forbidden: blocked redirect outside E2B sandbox domains" },
                            { status: 403 }
                        );
                    }
                } catch {
                    return NextResponse.json({ error: "Invalid upstream redirect URL" }, { status: 400 });
                }
            }
        }

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
        if (req.method === "OPTIONS") {
            responseHeaders.set(
                "Access-Control-Allow-Methods",
                "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
            );
            responseHeaders.set(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization, e2b-traffic-access-token"
            );
        }

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
