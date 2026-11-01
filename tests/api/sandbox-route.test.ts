import { describe, it, expect } from "vitest";

interface SandboxRequestPayload {
  action: "start" | "sync" | "stop" | string;
  sandboxId?: string;
  previousSandboxId?: string;
  fileData?: { files?: Record<string, { code: string }> };
  changedFiles?: Record<string, { code: string }>;
}

function validateSandboxRequest(body: SandboxRequestPayload): { valid: boolean; error?: string } {
  if (body.action === "start") {
    if (!body.fileData || !body.fileData.files || Object.keys(body.fileData.files).length === 0) {
      return { valid: false, error: "fileData with files is required to start sandbox" };
    }
    return { valid: true };
  }

  if (body.action === "sync") {
    if (!body.sandboxId) {
      return { valid: false, error: "sandboxId is required to sync" };
    }
    return { valid: true };
  }

  if (body.action === "stop") {
    if (!body.sandboxId) {
      return { valid: false, error: "sandboxId is required to stop" };
    }
    return { valid: true };
  }

  return { valid: false, error: "Invalid action. Expected start, sync, or stop" };
}

describe("Sandbox Endpoint Validation Contract", () => {
  it("should reject start action without files", () => {
    const check1 = validateSandboxRequest({ action: "start" });
    expect(check1.valid).toBe(false);
    expect(check1.error).toContain("fileData with files is required");

    const check2 = validateSandboxRequest({ action: "start", fileData: { files: {} } });
    expect(check2.valid).toBe(false);
  });

  it("should validate start action when files are present", () => {
    const check = validateSandboxRequest({
      action: "start",
      fileData: { files: { "/App.jsx": { code: "export default function App() {}" } } },
    });
    expect(check.valid).toBe(true);
  });

  it("should require sandboxId for sync and stop actions", () => {
    const syncNoId = validateSandboxRequest({ action: "sync" });
    expect(syncNoId.valid).toBe(false);
    expect(syncNoId.error).toContain("sandboxId is required to sync");

    const stopNoId = validateSandboxRequest({ action: "stop" });
    expect(stopNoId.valid).toBe(false);
    expect(stopNoId.error).toContain("sandboxId is required to stop");

    const syncOk = validateSandboxRequest({ action: "sync", sandboxId: "sb-12345" });
    expect(syncOk.valid).toBe(true);

    const stopOk = validateSandboxRequest({ action: "stop", sandboxId: "sb-12345" });
    expect(stopOk.valid).toBe(true);
  });

  it("should accept previousSandboxId on start action for safe container teardown", () => {
    const check = validateSandboxRequest({
      action: "start",
      previousSandboxId: "sb-old-9999",
      fileData: { files: { "/App.jsx": { code: "export default function App() {}" } } },
    });
    expect(check.valid).toBe(true);
  });

  it("should reject unsupported actions", () => {
    const invalid = validateSandboxRequest({ action: "restart" });
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain("Invalid action");
  });
});

describe("Sandbox Proxy Endpoint Host & Security Validation", () => {
  function validateProxyTarget(targetUrl: string | null): { allowed: boolean; error?: string } {
    if (!targetUrl) {
      return { allowed: false, error: "Missing required 'url' query parameter" };
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return { allowed: false, error: "Invalid target URL format" };
    }

    const hostname = parsed.hostname.toLowerCase();
    const isE2bHost =
      hostname.endsWith(".e2b.app") ||
      hostname.endsWith(".e2b.dev") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1";

    if (!isE2bHost) {
      return { allowed: false, error: "Forbidden: target host is not a valid E2B sandbox domain" };
    }

    return { allowed: true };
  }

  it("should allow valid E2B sandbox domains", () => {
    const res1 = validateProxyTarget("https://3000-i4n459zqj1f7dbf9vudul.e2b.app");
    expect(res1.allowed).toBe(true);

    const res2 = validateProxyTarget("https://test.e2b.dev/preview");
    expect(res2.allowed).toBe(true);
  });

  it("should reject non-E2B external hosts to prevent SSRF vulnerabilities", () => {
    const res = validateProxyTarget("https://malicious-site.com/steal-data");
    expect(res.allowed).toBe(false);
    expect(res.error).toContain("Forbidden");
  });

  it("should reject missing or malformed URLs", () => {
    const missing = validateProxyTarget(null);
    expect(missing.allowed).toBe(false);
    expect(missing.error).toContain("Missing required");

    const malformed = validateProxyTarget("not-a-url");
    expect(malformed.allowed).toBe(false);
    expect(malformed.error).toContain("Invalid target URL format");
  });
});
