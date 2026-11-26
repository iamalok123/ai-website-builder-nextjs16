import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockVerifySandboxOwnership = vi.fn();
const mockCreateE2bSandbox = vi.fn();
const mockConnectE2bSandbox = vi.fn();
const mockKillE2bSandbox = vi.fn();
const mockWriteFilesToSandbox = vi.fn();
const mockStartSandboxApp = vi.fn();
const mockUserFindUnique = vi.fn();
const mockWorkspaceFindUnique = vi.fn();
const mockWorkspaceUpdate = vi.fn();
const mockStreamGemini = vi.fn();

const mockAjProtect = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@cline/sdk", () => ({
  Agent: vi.fn(),
  createTool: vi.fn((def: unknown) => def),
}));

vi.mock("@/lib/e2b", () => ({
  verifySandboxOwnership: (...args: unknown[]) => mockVerifySandboxOwnership(...args),
  createE2bSandbox: (...args: unknown[]) => mockCreateE2bSandbox(...args),
  connectE2bSandbox: (...args: unknown[]) => mockConnectE2bSandbox(...args),
  killE2bSandbox: (...args: unknown[]) => mockKillE2bSandbox(...args),
  writeFilesToSandbox: (...args: unknown[]) => mockWriteFilesToSandbox(...args),
  startSandboxApp: (...args: unknown[]) => mockStartSandboxApp(...args),
  E2B_SANDBOX_TIMEOUT_MS: 900_000,
  STANDARD_VITE_CONFIG: "export default {}",
  normalizeClientApiUrls: (c: string) => c,
  prepareBackendServerFiles: (c: string) => ({ isCjs: false, files: { "server.js": c } }),
  buildBackendSupervisorCommand: () => "",
  buildViteSupervisorCommand: () => "",
}));

vi.mock("@/lib/prisma", () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    workspace: {
      findUnique: (...args: unknown[]) => mockWorkspaceFindUnique(...args),
      update: (...args: unknown[]) => mockWorkspaceUpdate(...args),
    },
  },
}));

vi.mock("@/lib/arcjet", () => ({
  aj: { protect: (...args: unknown[]) => mockAjProtect(...args) },
  warnIfArcjetUnconfigured: vi.fn(),
}));

vi.mock("@/lib/gemini-client", () => ({
  DEFAULT_GEMINI_MODEL: "gemini-3.6-flash",
  streamGeminiWithFallback: (...args: unknown[]) => mockStreamGemini(...args),
  generateGeminiContentWithFallback: vi.fn(),
  getImproveCandidateModels: () => ["gemini-3.5-flash"],
  classifyGeminiError: () => ({ kind: "fatal", isRetryable: false, message: "err" }),
  formatUserFacingGeminiError: () => "err",
}));

vi.mock("@/lib/checkUser", () => ({
  checkUser: vi.fn(),
}));

describe("Route Ownership, Proxy Methods & Workspace Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAjProtect.mockResolvedValue({ isDenied: () => false });
  });

  it("blocks cross-user sandbox access with 403 and sets HttpOnly proxy cookie without leaking token in JSON", async () => {
    const { POST } = await import("@/app/api/sandbox/route");

    mockAuth.mockResolvedValue({ userId: "clerk_user_a" });
    mockVerifySandboxOwnership.mockResolvedValue("forbidden");

    const forbiddenReq = new NextRequest("http://localhost/api/sandbox", {
      method: "POST",
      body: JSON.stringify({ action: "sync", sandboxId: "sb-user-b", changedFiles: { "/src/App.jsx": { code: "" } } }),
      headers: { "Content-Type": "application/json" },
    });

    const forbiddenRes = await POST(forbiddenReq);
    expect(forbiddenRes.status).toBe(403);
    expect(mockConnectE2bSandbox).not.toHaveBeenCalled();

    mockCreateE2bSandbox.mockResolvedValue({ sandboxId: "sb-owned-1" });
    mockWriteFilesToSandbox.mockResolvedValue({ stack: "react-node" });
    mockStartSandboxApp.mockResolvedValue({
      previewUrl: "https://3000-sb-owned-1.e2b.app",
      trafficAccessToken: "secret-e2b-token",
      isPublic: false,
    });

    const startReq = new NextRequest("http://localhost/api/sandbox", {
      method: "POST",
      body: JSON.stringify({
        action: "start",
        fileData: { files: { "/src/App.jsx": { code: "export default function App() {}" } } },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const startRes = await POST(startReq);
    expect(startRes.status).toBe(200);
    const json = await startRes.json();
    expect(json.trafficAccessToken).toBeUndefined();
    expect(startRes.headers.get("set-cookie")).toContain("zephyre_e2b_sb-owned-1=secret-e2b-token");
    expect(startRes.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("supports POST in /api/sandbox/proxy, reads HttpOnly cookie token, and blocks external 3xx SSRF redirects", async () => {
    const { POST } = await import("@/app/api/sandbox/proxy/route");
    mockAuth.mockResolvedValue({ userId: "clerk_user_a" });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        })
      );

    try {
      const proxyPostReq = new NextRequest(
        "http://localhost/api/sandbox/proxy?url=https%3A%2F%2F3000-sb123.e2b.app%2Fapi%2Fitems",
        {
          method: "POST",
          body: JSON.stringify({ name: "Widget" }),
          headers: {
            "Content-Type": "application/json",
            cookie: "zephyre_e2b_sb123=cookie-secret-tok",
          },
        }
      );

      const postRes = await POST(proxyPostReq);
      expect(postRes.status).toBe(200);
      const sentInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const sentHeaders = sentInit.headers as Headers;
      expect(sentInit.method).toBe("POST");
      expect(sentHeaders.get("e2b-traffic-access-token")).toBe("cookie-secret-tok");

      const ssrfRedirectReq = new NextRequest(
        "http://localhost/api/sandbox/proxy?url=https%3A%2F%2F3000-sb123.e2b.app%2Fredir",
        { method: "POST" }
      );
      const redirRes = await POST(ssrfRedirectReq);
      expect(redirRes.status).toBe(403);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("verifies workspaceId ownership before calling Gemini or Cline SDK in /api/gen-ai-code and /api/improve", async () => {
    const { POST: genPost } = await import("@/app/api/gen-ai-code/route");
    const { POST: improvePost } = await import("@/app/api/improve/route");

    mockAuth.mockResolvedValue({ userId: "clerk_user_a" });
    mockUserFindUnique.mockResolvedValue({ id: "db_user_a", credits: 10, plan: "pro" });
    mockWorkspaceFindUnique.mockResolvedValue(null);

    const genReq = new NextRequest("http://localhost/api/gen-ai-code", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_other_user",
        userId: "db_user_a",
        messages: [{ role: "user", content: "Build an app" }],
        fileData: null,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const genRes = await genPost(genReq);
    expect(genRes.status).toBe(404);
    expect(mockStreamGemini).not.toHaveBeenCalled();

    const improveReq = new NextRequest("http://localhost/api/improve", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_other_user",
        userId: "db_user_a",
        userRequest: "Add dark mode",
        fileData: { files: { "/src/App.jsx": { code: "export default function App() {}" } }, dependencies: {} },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const improveRes = await improvePost(improveReq);
    expect(improveRes.status).toBe(404);
  });

  it("rejects malformed fileData payloads in updateWorkspaceFileData via Zod schema", async () => {
    const { updateWorkspaceFileData } = await import("@/actions/workspace");

    mockAuth.mockResolvedValue({ userId: "clerk_user_a" });
    mockUserFindUnique.mockResolvedValue({ id: "db_user_a" });

    await updateWorkspaceFileData(
      "ws_1",
      "db_user_a",
      { files: "corrupted" } as never
    );

    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });
});
