import { describe, it, expect } from "vitest";
import {
  parseLlmJson,
  normalizeFilePaths,
  ensureStandardFiles,
  repairTruncatedCode,
  validateProjectSyntax,
  isJsSyntaxValid,
} from "@/lib/ai-json-parser";

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

  it("should automatically repair truncated arrays and missing named exports across project files", () => {
    const rawFiles = {
      "/src/data/mockData.js": {
        code: `export const INITIAL_MEDIA = [\n  { id: '1', title: 'Movie 1' },\n  { id: '2', title: 'Movie 2' }`,
      },
      "/src/components/AICineMind.jsx": {
        code: `import React from 'react';\nimport { MOOD_CATEGORIES } from '../data/mockData';\nexport function AICineMind() { return null; }`,
      },
      "/src/components/TruncatedCard.jsx": {
        code: `export function TruncatedCard() {\n  return <div className="card" size=`,
      },
    };

    const { files } = ensureStandardFiles(rawFiles, {}, "Streaming App");

    // Array should be auto-closed with ];
    expect(files["/src/data/mockData.js"].code).toContain("];");
    // MOOD_CATEGORIES should be auto-exported as a fallback
    expect(files["/src/data/mockData.js"].code).toContain("export const MOOD_CATEGORIES =");
    // Truncated size= should be stripped and closed cleanly
    expect(files["/src/components/TruncatedCard.jsx"].code).not.toContain("size=");
    expect(isJsSyntaxValid(files["/src/components/TruncatedCard.jsx"].code, "/src/components/TruncatedCard.jsx")).toBe(true);
  });

  it("should recover full files without truncation when LLM emits unescaped inner double quotes in JSON code values", () => {
    const appCode = `export default function App() {\n  const commitMsg = "init";\n  const log = \`Git commit pushed (2 files): "\${commitMsg}"\`;\n  return <div>{log}</div>;\n}`;
    const panelCode = `export default function BottomPanel() {\n  const hint = 'Type "help" for available commands.';\n  return <p>{hint}</p>;\n}`;
    const utilsCode = `export function buildHtml() {\n  return \`<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>Ok</body></html>\`;\n}`;

    // Construct malformed JSON where internal " inside JS strings/templates/HTML are NOT JSON-escaped
    const malformedJson =
      `{\n` +
      `  "assistantMessage": "Built VS Code Web Studio with terminal & git",\n` +
      `  "title": "VS Code Web Studio",\n` +
      `  "files": {\n` +
      `    "/src/App.jsx": {\n      "code": "${appCode.replace(/\n/g, "\\n")}"\n    },\n` +
      `    "/src/components/BottomPanel.jsx": {\n      "code": "${panelCode.replace(/\n/g, "\\n")}"\n    },\n` +
      `    "/src/lib/utils.js": {\n      "code": "${utilsCode.replace(/\n/g, "\\n")}"\n    }\n` +
      `  },\n` +
      `  "dependencies": { "lucide-react": "^1.0.0" }\n` +
      `}`;

    const parsed = parseLlmJson(malformedJson);
    expect(parsed.title).toBe("VS Code Web Studio");
    expect(parsed.dependencies?.["lucide-react"]).toBe("^1.0.0");
    expect(parsed.files["/src/App.jsx"].code).toContain('Git commit pushed (2 files): "${commitMsg}"');
    expect(parsed.files["/src/App.jsx"].code).toContain("return <div>{log}</div>;");
    expect(parsed.files["/src/components/BottomPanel.jsx"].code).toContain("'Type \"help\" for available commands.'");
    expect(parsed.files["/src/lib/utils.js"].code).toContain('<meta charset="UTF-8" />');
    expect(isJsSyntaxValid(parsed.files["/src/App.jsx"].code!, "/src/App.jsx")).toBe(true);
    expect(isJsSyntaxValid(parsed.files["/src/components/BottomPanel.jsx"].code!, "/src/components/BottomPanel.jsx")).toBe(true);
    expect(isJsSyntaxValid(parsed.files["/src/lib/utils.js"].code!, "/src/lib/utils.js")).toBe(true);
  });

  it("should repair nested truncated callbacks/objects/arrays in strict LIFO order without Babel syntax errors", () => {
    const truncated = `export default function App() {
  const handleCommitGit = (msg) => {
    setOutputLogs((prev) => [
      { time: new Date().toLocaleTimeString(), message: \`Git commit pushed:`;

    const repaired = repairTruncatedCode(truncated, "/src/App.jsx");
    expect(isJsSyntaxValid(repaired, "/src/App.jsx")).toBe(true);
    expect(repaired).not.toContain(":`)");
  });

  it("should close nested JSX style expression braces before closing tag and leave valid JSX with contractions untouched", () => {
    const validWithContraction = `export function Banner() {\n  return <p className="text-sm">We're ready to deploy</p>;\n}`;
    expect(repairTruncatedCode(validWithContraction, "/src/Banner.jsx")).toBe(validWithContraction);

    const truncatedJsxProp = `export function Box() {\n  return (\n    <div style={{ color: 'red'`;
    const repairedJsx = repairTruncatedCode(truncatedJsxProp, "/src/Box.jsx");
    expect(isJsSyntaxValid(repairedJsx, "/src/Box.jsx")).toBe(true);
    expect(repairedJsx).toContain("/>");
  });

  it("should validate project syntax across JS/JSX/JSON and detect incomplete HTML templates", () => {
    const errors = validateProjectSyntax({
      "/src/App.jsx": { code: "export default function App() { return <div>ok</div>; }" },
      "/src/Broken.jsx": { code: "export function Broken() { return [{ msg: `hi`) ]; }" },
      "/src/lib/utils.js": { code: "export const doc = () => `<!DOCTYPE html><html><head>`;" },
      "/package.json": { code: "{ invalid json" },
    });

    const paths = errors.map((e) => e.path);
    expect(paths).not.toContain("/src/App.jsx");
    expect(paths).toContain("/src/Broken.jsx");
    expect(paths).toContain("/src/lib/utils.js");
    expect(paths).toContain("/package.json");
  });

  it("should recover patch blocks in fallback extraction even when replacement code has unescaped double quotes", () => {
    const raw = `{
  "assistantMessage": "Updated log line",
  "title": "Patch App",
  "files": {
    "/src/App.jsx": {
      "patches": [
        {
          "search": "const msg = 'hi';",
          "replace": "const msg = 'Type "help" now';"
        }
      ]
    }
  }
}`;
    const parsed = parseLlmJson(raw);
    expect(parsed.files["/src/App.jsx"].patches).toHaveLength(1);
    expect(parsed.files["/src/App.jsx"].patches?.[0].replace).toBe(`const msg = 'Type "help" now';`);
  });
});
