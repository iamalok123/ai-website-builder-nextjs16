import { describe, it, expect } from "vitest";
import {
    isSafeExternalUrl,
    isAllowedE2bProxyHost,
    sanitizeSandboxPath,
} from "@/lib/security";

describe("Security Hardening & Guardrails", () => {
    describe("SSRF Mitigation (isSafeExternalUrl)", () => {
        it("should allow legitimate public HTTP and HTTPS URLs", () => {
            expect(isSafeExternalUrl("https://images.unsplash.com/photo-12345")).toBe(true);
            expect(isSafeExternalUrl("https://cdn.example.com/assets/logo.png")).toBe(true);
            expect(isSafeExternalUrl("http://example.com/spec.pdf")).toBe(true);
        });

        it("should block non-HTTP protocols", () => {
            expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
            expect(isSafeExternalUrl("ftp://files.example.com")).toBe(false);
            expect(isSafeExternalUrl("gopher://127.0.0.1")).toBe(false);
            expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
        });

        it("should block cloud metadata and link-local addresses", () => {
            expect(isSafeExternalUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
            expect(isSafeExternalUrl("http://metadata.google.internal/computeMetadata/v1/")).toBe(false);
            expect(isSafeExternalUrl("http://169.254.1.1/info")).toBe(false);
        });

        it("should block loopback and private IPv4 ranges", () => {
            expect(isSafeExternalUrl("http://127.0.0.1:3000/")).toBe(false);
            expect(isSafeExternalUrl("http://127.0.0.5:8080/")).toBe(false);
            expect(isSafeExternalUrl("http://localhost:5432/")).toBe(false);
            expect(isSafeExternalUrl("http://10.0.0.1/admin")).toBe(false);
            expect(isSafeExternalUrl("http://192.168.1.1/router")).toBe(false);
            expect(isSafeExternalUrl("http://172.16.0.1/secret")).toBe(false);
            expect(isSafeExternalUrl("http://172.31.255.255/secret")).toBe(false);
        });

        it("should block IPv6 loopbacks and wildcard addresses", () => {
            expect(isSafeExternalUrl("http://[::1]:3000/")).toBe(false);
            expect(isSafeExternalUrl("http://[::]/")).toBe(false);
        });
    });

    describe("E2B Reverse Proxy Host Allowlisting (isAllowedE2bProxyHost)", () => {
        it("should permit authentic *.e2b.app and *.e2b.dev domains", () => {
            expect(isAllowedE2bProxyHost("3000-i3s07nzhakjjvvkoih2b3.e2b.app")).toBe(true);
            expect(isAllowedE2bProxyHost("my-sandbox.e2b.dev")).toBe(true);
        });

        it("should reject malicious or spoofed domain variations", () => {
            expect(isAllowedE2bProxyHost("evile2b.app")).toBe(false);
            expect(isAllowedE2bProxyHost("attacker-e2b.dev.fake.com")).toBe(false);
            expect(isAllowedE2bProxyHost("google.com")).toBe(false);
            expect(isAllowedE2bProxyHost("169.254.169.254")).toBe(false);
        });
    });

    describe("Container Sandbox Path Sanitization (sanitizeSandboxPath)", () => {
        it("should accept safe, normalized relative paths", () => {
            expect(sanitizeSandboxPath("src/App.jsx")).toBe("src/App.jsx");
            expect(sanitizeSandboxPath("/src/components/Header.jsx")).toBe("src/components/Header.jsx");
            expect(sanitizeSandboxPath("server.js")).toBe("server.js");
            expect(sanitizeSandboxPath("public/favicon.ico")).toBe("public/favicon.ico");
        });

        it("should reject path traversal attempts", () => {
            expect(sanitizeSandboxPath("../../etc/passwd")).toBeNull();
            expect(sanitizeSandboxPath("src/../../../package.json")).toBeNull();
            expect(sanitizeSandboxPath("..")).toBeNull();
        });

        it("should reject null bytes and control/shell characters", () => {
            expect(sanitizeSandboxPath("src/App.jsx\0.evil")).toBeNull();
            expect(sanitizeSandboxPath('src/" && rm -rf / ;')).toBeNull();
            expect(sanitizeSandboxPath("src\\App.jsx")).toBeNull();
            expect(sanitizeSandboxPath("src/$(whoami).js")).toBeNull();
        });
    });
});
