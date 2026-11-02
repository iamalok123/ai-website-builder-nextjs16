import { describe, it, expect } from "vitest";
import { parseLlmJson, normalizeFilePaths, ensureStandardFiles } from "@/lib/ai-json-parser";

describe("AI Code Generation & LLM JSON Parser", () => {
  it("should parse pure valid JSON cleanly and canonicalize /App.jsx to /src/App.jsx", () => {
    const raw = JSON.stringify({
      assistantMessage: "Built a counter",
      title: "Counter App",
      files: { "/App.jsx": { code: "export default function App() {}" } },
      dependencies: { "lucide-react": "^1.0.0" },
    });

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Counter App");
    expect(parsed.files["/src/App.jsx"].code).toContain("export default");
    expect(parsed.files["/App.jsx"]).toBeUndefined();
  });

  it("should extract JSON wrapped in markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({
      assistantMessage: "Wrapped in markdown",
      title: "Fenced App",
      files: { "/src/App.jsx": { code: "const a = 1;" } },
    }) + "\n```";

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Fenced App");
    expect(parsed.files["/src/App.jsx"].code).toBe("const a = 1;");
  });

  it("should repair unclosed JSON with missing trailing braces", () => {
    const raw = `{\n  "assistantMessage": "Partial output",\n  "title": "Truncated App",\n  "files": {\n    "/src/App.jsx": { "code": "console.log('hello');"`;

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Truncated App");
    expect(parsed.files["/src/App.jsx"].code).toBe("console.log('hello');");
  });

  it("should sanitize unescaped control characters inside code blocks", () => {
    const raw = `{\n  "assistantMessage": "Fixed",\n  "title": "Control Char App",\n  "files": {\n    "/src/App.jsx": { "code": "line 1\u0007\u0008\u001Fline 2" }\n  }\n}`;

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Control Char App");
    expect(parsed.files["/src/App.jsx"].code).toContain("line 1");
  });

  it("should handle trailing commas in arrays and objects", () => {
    const raw = `{\n  "assistantMessage": "Commas",\n  "title": "Trailing Comma App",\n  "files": {\n    "/src/App.jsx": { "code": "export default App;" },\n  },\n  "dependencies": { "lucide-react": "latest", },\n}`;

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Trailing Comma App");
    expect(parsed.dependencies?.["lucide-react"]).toBe("latest");
  });

  it("should repair JSON truncated inside code string", () => {
    const raw = `{\n  "assistantMessage": "Streak tracker",\n  "title": "Streak App",\n  "files": {\n    "/src/App.jsx": { "code": "export default function App() { return <div>hello</div>;`;
    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Streak App");
    expect(parsed.files["/src/App.jsx"].code).toContain("export default");
  });

  it("should parse modular Lovable-style multi-file architecture with components and hooks", () => {
    const raw = JSON.stringify({
      assistantMessage: "Created habit streak tracker with modular architecture",
      title: "Habit Tracker",
      files: {
        "/src/App.jsx": { code: "import Header from './components/Header.jsx'; export default function App() {}" },
        "/src/components/Header.jsx": { code: "export default function Header() {}" },
        "/src/components/HeatmapGrid.jsx": { code: "export default function HeatmapGrid() {}" },
        "/src/components/ui/Button.jsx": { code: "export function Button() {}" },
        "/src/components/ui/Card.jsx": { code: "export function Card() {}" },
        "/src/hooks/useHabits.js": { code: "export function useHabits() {}" },
        "/src/lib/utils.js": { code: "export function cn() {}" },
        "/server.js": { code: "import express from 'express';" },
        "/README.md": { code: "# Habit Tracker" },
      },
      dependencies: {
        "lucide-react": "^1.16.0",
      },
    });

    const parsed = parseLlmJson(raw);
    expect(Object.keys(parsed.files)).toHaveLength(9);
    expect(parsed.files["/src/components/Header.jsx"]).toBeDefined();
    expect(parsed.files["/src/components/HeatmapGrid.jsx"]).toBeDefined();
    expect(parsed.files["/src/components/ui/Button.jsx"]).toBeDefined();
    expect(parsed.files["/src/hooks/useHabits.js"]).toBeDefined();
    expect(parsed.files["/server.js"]).toBeDefined();
  });

  it("should canonicalize root /components/* and eliminate root /App.jsx duplication", () => {
    const rawFiles = {
      "/App.jsx": { code: "root app" },
      "/src/App.jsx": { code: "src app canonical" },
      "/components/Header.jsx": { code: "header" },
      "/hooks/useStreak.js": { code: "streak hook" },
      "/lib/helpers.js": { code: "helpers" },
    };

    const normalized = normalizeFilePaths(rawFiles);
    expect(normalized["/App.jsx"]).toBeUndefined();
    expect(normalized["/src/App.jsx"].code).toBe("src app canonical");
    expect(normalized["/src/components/Header.jsx"]).toBeDefined();
    expect(normalized["/src/hooks/useStreak.js"]).toBeDefined();
    expect(normalized["/src/lib/helpers.js"]).toBeDefined();
  });

  it("should ensure standard files including utils.js and README.md", () => {
    const rawFiles = {
      "/src/App.jsx": { code: "export default function App() {}" },
    };

    const { files } = ensureStandardFiles(rawFiles, {}, "My Habit App");
    expect(files["/src/lib/utils.js"]).toBeDefined();
    expect(files["/src/lib/utils.js"].code).toContain("clsx");
    expect(files["/README.md"]).toBeDefined();
    expect(files["/README.md"].code).toContain("My Habit App");
    expect(files["/index.html"]).toBeDefined();
    expect(files["/vite.config.js"]).toBeDefined();
    expect(files["/package.json"]).toBeDefined();
    expect(files["/src/main.jsx"]).toBeDefined();
  });
});
