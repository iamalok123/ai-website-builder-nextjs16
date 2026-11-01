import { describe, it, expect } from "vitest";
import { GET, POST, HEAD } from "@/app/api/health/route";

describe("Health Check API (/api/health)", () => {
  it("should return HTTP 200 and valid status payload on GET request", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(["ok", "degraded"]).toContain(data.status);
    expect(["connected", "disconnected"]).toContain(data.database);
    expect(typeof data.uptime).toBe("number");
    expect(data.timestamp).toBeDefined();
  });

  it("should support POST requests for external monitoring systems with HTTP 200", async () => {
    const res = await POST();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(["ok", "degraded"]).toContain(data.status);
  });

  it("should support HEAD requests without payload and return HTTP 200", async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
  });
});
