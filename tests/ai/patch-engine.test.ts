import { describe, it, expect } from "vitest";
import { applyPatch, applyFileChanges } from "@/lib/ai-json-parser";

describe("Search/Replace Patch Engine", () => {
  it("should apply an exact match patch", () => {
    const original = 'const color = "blue";\nconst size = 10;';
    const patch = {
      search: 'const color = "blue";',
      replace: 'const color = "orange";',
    };
    const res = applyPatch(original, patch);
    expect(res.success).toBe(true);
    expect(res.code).toBe('const color = "orange";\nconst size = 10;');
  });

  it("should handle CRLF vs LF differences", () => {
    const original = "function test() {\r\n  return true;\r\n}";
    const patch = {
      search: "function test() {\n  return true;\n}",
      replace: "function test() {\n  return false;\n}",
    };
    const res = applyPatch(original, patch);
    expect(res.success).toBe(true);
    expect(res.code.replace(/\r\n/g, "\n")).toBe("function test() {\n  return false;\n}");
  });

  it("should handle indentation whitespace variations gracefully", () => {
    const original = "    const val = 123;\n    return val;";
    const patch = {
      search: "  const val = 123;\n  return val;",
      replace: "  const val = 456;\n  return val;",
    };
    const res = applyPatch(original, patch);
    expect(res.success).toBe(true);
    expect(res.code).toContain("456");
  });

  it("should not modify or corrupt the file if the search block is not found", () => {
    const original = "const originalCode = true;";
    const patch = {
      search: "nonexistent code block",
      replace: "new code block",
    };
    const res = applyPatch(original, patch);
    expect(res.success).toBe(false);
    expect(res.code).toBe(original);
  });

  it("should apply multiple sequential patches to the same file", () => {
    const original = "const a = 1;\nconst b = 2;\nconst c = 3;";
    const patches = [
      { search: "const a = 1;", replace: "const a = 10;" },
      { search: "const c = 3;", replace: "const c = 30;" },
    ];
    let current = original;
    for (const p of patches) {
      const res = applyPatch(current, p);
      expect(res.success).toBe(true);
      current = res.code;
    }
    expect(current).toBe("const a = 10;\nconst b = 2;\nconst c = 30;");
  });

  it("should support mixed full file additions and patches via applyFileChanges", () => {
    const existing = {
      "/src/components/Header.jsx": { code: "export function Header() { return <h1>Old</h1>; }" },
      "/src/lib/utils.js": { code: "export const x = 1;" }
    };
    const incoming = {
      "/src/components/Header.jsx": {
        patches: [
          { search: "<h1>Old</h1>", replace: "<h1>New</h1>" }
        ]
      },
      "/src/components/NewCard.jsx": {
        code: "export function NewCard() { return <div>Card</div>; }"
      }
    };

    const merged = applyFileChanges(existing, incoming);
    expect(merged["/src/components/Header.jsx"].code).toBe("export function Header() { return <h1>New</h1>; }");
    expect(merged["/src/components/NewCard.jsx"].code).toBe("export function NewCard() { return <div>Card</div>; }");
    expect(merged["/src/lib/utils.js"].code).toBe("export const x = 1;");
  });
});
