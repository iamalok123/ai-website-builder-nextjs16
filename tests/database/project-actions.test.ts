import { describe, it, expect } from "vitest";

describe("Project Deletion Logic & Filtering Contracts", () => {
  it("should filter projects created before a specified boundary date regardless of update time", () => {
    const boundary = new Date("2026-11-01T00:00:00.000Z");

    const sampleWorkspaces = [
      {
        id: "w1",
        title: "Minimalist Todo App",
        createdAt: new Date("2026-11-01T01:11:18.033Z"),
        updatedAt: new Date("2026-11-01T03:00:26.458Z"),
      },
      {
        id: "w2",
        title: "Neon Tic Tac Toe",
        createdAt: new Date("2026-07-18T06:12:33.837Z"),
        updatedAt: new Date("2026-11-01T03:00:25.427Z"), // updated today but created earlier
      },
      {
        id: "w3",
        title: "Spotify Stats Dashboard",
        createdAt: new Date("2026-07-16T04:02:03.106Z"),
        updatedAt: new Date("2026-11-01T03:00:24.663Z"),
      },
    ];

    const kept = sampleWorkspaces.filter((w) => w.createdAt >= boundary);
    const deleted = sampleWorkspaces.filter((w) => w.createdAt < boundary);

    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("w1");
    expect(kept[0].title).toBe("Minimalist Todo App");

    expect(deleted).toHaveLength(2);
    expect(deleted.map((d) => d.id)).toEqual(["w2", "w3"]);
  });

  it("should return clean success payload when deleting an existing workspace", () => {
    function simulateDelete(workspaceId: string, availableIds: string[]) {
      if (!workspaceId) {
        return { success: false, error: "Workspace ID required" };
      }
      if (!availableIds.includes(workspaceId)) {
        return { success: false, error: "Project not found or already deleted" };
      }
      return { success: true };
    }

    const resValid = simulateDelete("proj-1", ["proj-1", "proj-2"]);
    expect(resValid.success).toBe(true);

    const resNotFound = simulateDelete("proj-999", ["proj-1", "proj-2"]);
    expect(resNotFound.success).toBe(false);
    expect(resNotFound.error).toContain("not found");
  });
});
