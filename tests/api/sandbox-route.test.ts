import { describe, it, expect } from "vitest";

interface SandboxRequestPayload {
  action: "start" | "sync" | "stop" | string;
  sandboxId?: string;
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

  it("should reject unsupported actions", () => {
    const invalid = validateSandboxRequest({ action: "restart" });
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain("Invalid action");
  });
});
