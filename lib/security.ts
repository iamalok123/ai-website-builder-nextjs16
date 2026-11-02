/**
 * Security utilities for Zephyre: SSRF mitigation, safe URL checking,
 * and sandbox path sanitization.
 */

// Private & reserved IPv4 blocks (CIDR representation)
const PRIVATE_IP_PATTERNS = [
    /^127\./,                         // Loopback (127.0.0.0/8)
    /^10\./,                          // Class A private (10.0.0.0/8)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private (172.16.0.0/12)
    /^192\.168\./,                    // Class C private (192.168.0.0/16)
    /^169\.254\./,                    // Link-local / Cloud metadata (169.254.0.0/16)
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
    /^0\./,                           // Reserved (0.0.0.0/8)
];

const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "metadata.google.internal",
    "metadata",
    "instance-data",
    "loopback",
]);

/**
 * Validates that an outbound target URL is a safe, publicly reachable HTTP/HTTPS resource,
 * preventing Server-Side Request Forgery (SSRF) against cloud metadata or internal services.
 */
export function isSafeExternalUrl(rawUrl: string, allowLocalhostInDev = false): boolean {
    if (!rawUrl || typeof rawUrl !== "string") return false;

    let parsed: URL;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        return false;
    }

    // Protocol must strictly be http or https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Allow local development endpoints only if explicitly flagged
    if (allowLocalhostInDev && process.env.NODE_ENV !== "production") {
        if (hostname === "localhost" || hostname === "127.0.0.1") {
            return true;
        }
    }

    // Block common internal / metadata hostnames
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".internal") || hostname.endsWith(".local")) {
        return false;
    }

    // Block IPv6 loopbacks / wildcards
    if (hostname === "::" || hostname === "::1" || hostname === "[::]" || hostname === "[::1]") {
        return false;
    }

    // Block private IPv4 addresses
    for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(hostname)) {
            return false;
        }
    }

    return true;
}

/**
 * Validates that a host is an authorized E2B sandbox hostname.
 * In production, strictly matches *.e2b.app and *.e2b.dev.
 */
export function isAllowedE2bProxyHost(hostname: string): boolean {
    if (!hostname || typeof hostname !== "string") return false;
    const cleanHost = hostname.toLowerCase().trim();

    // In development mode only, permit localhost and 127.0.0.1
    if (process.env.NODE_ENV !== "production") {
        if (cleanHost === "localhost" || cleanHost === "127.0.0.1") {
            return true;
        }
    }

    // Strictly match *.e2b.app or *.e2b.dev with valid subdomain characters
    const e2bRegex = /^[a-zA-Z0-9_\-]+\.e2b\.(app|dev)$/;
    return e2bRegex.test(cleanHost);
}

/**
 * Sanitizes a file path intended for container writing:
 * - Prevents directory traversal (../)
 * - Blocks null bytes and shell control characters
 * - Normalizes to relative path
 */
export function sanitizeSandboxPath(rawPath: string): string | null {
    if (!rawPath || typeof rawPath !== "string") return null;

    const clean = rawPath.trim().replace(/^\/+/, "");

    // Block null bytes or directory traversal attempts
    if (clean.includes("\0") || clean.includes("..") || clean.includes("\\")) {
        return null;
    }

    // Strictly permit only safe alphanumeric path characters
    if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(clean)) {
        return null;
    }

    return clean;
}
