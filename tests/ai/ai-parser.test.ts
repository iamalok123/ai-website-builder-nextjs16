import { describe, it, expect } from "vitest";
import { jsonrepair } from "jsonrepair";

// LLM JSON Parser implementation test
function parseLlmJson(raw: string): {
  assistantMessage: string;
  title?: string;
  files: Record<string, { code: string }>;
  dependencies?: Record<string, string>;
} {
  let clean = raw.trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  else if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  clean = clean.trim();

  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  let candidate = clean;
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    candidate = clean.substring(firstBrace, lastBrace + 1);
  }

  // Attempt 1: Standard JSON.parse on candidate
  try {
    return JSON.parse(candidate);
  } catch {}

  // Attempt 2: jsonrepair on candidate
  try {
    const repaired = jsonrepair(candidate);
    return JSON.parse(repaired);
  } catch {}

  // Attempt 3: Sanitize control characters + jsonrepair
  const sanitized = candidate.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
  try {
    const repaired = jsonrepair(sanitized);
    return JSON.parse(repaired);
  } catch {}

  // Attempt 4: If truncated mid-string, try auto-closing open quotes and objects
  const autoClosedAttempts = [
    sanitized + '"}',
    sanitized + '"} }',
    sanitized + '"}} }',
    sanitized + '}}',
    sanitized + '}}}',
  ];
  for (const attempt of autoClosedAttempts) {
    try {
      const repaired = jsonrepair(attempt);
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === "object" && parsed.files) {
        return parsed;
      }
    } catch {}
  }

  // Final attempt: jsonrepair on full sanitized raw string
  const rawSanitized = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
  const finalRepaired = jsonrepair(rawSanitized);
  return JSON.parse(finalRepaired);
}

describe("AI Code Generation & LLM JSON Parser", () => {
  it("should parse pure valid JSON cleanly", () => {
    const raw = JSON.stringify({
      assistantMessage: "Built a counter",
      title: "Counter App",
      files: { "/App.jsx": { code: "export default function App() {}" } },
      dependencies: { "lucide-react": "^1.0.0" },
    });

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Counter App");
    expect(parsed.files["/App.jsx"].code).toContain("export default");
  });

  it("should extract JSON wrapped in markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({
      assistantMessage: "Wrapped in markdown",
      title: "Fenced App",
      files: { "/App.jsx": { code: "const a = 1;" } },
    }) + "\n```";

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Fenced App");
    expect(parsed.files["/App.jsx"].code).toBe("const a = 1;");
  });

  it("should repair unclosed JSON with missing trailing braces", () => {
    // Missing root closing brace and file object brace
    const raw = `{\n  "assistantMessage": "Partial output",\n  "title": "Truncated App",\n  "files": {\n    "/App.jsx": { "code": "console.log('hello');"`;

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Truncated App");
    expect(parsed.files["/App.jsx"].code).toBe("console.log('hello');");
  });

  it("should sanitize unescaped control characters inside code blocks", () => {
    // String containing raw control chars
    const raw = `{\n  "assistantMessage": "Fixed",\n  "title": "Control Char App",\n  "files": {\n    "/App.jsx": { "code": "line 1\u0007\u0008\u001Fline 2" }\n  }\n}`;

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Control Char App");
    expect(parsed.files["/App.jsx"].code).toContain("line 1");
  });

  it("should handle trailing commas in arrays and objects", () => {
    const raw = `{\n  "assistantMessage": "Commas",\n  "title": "Trailing Comma App",\n  "files": {\n    "/App.jsx": { "code": "export default App;" },\n  },\n  "dependencies": { "lucide-react": "latest", },\n}`;

    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Trailing Comma App");
    expect(parsed.dependencies?.["lucide-react"]).toBe("latest");
  });

  it("should repair JSON truncated inside code string", () => {
    const raw = `{\n  "assistantMessage": "Streak tracker",\n  "title": "Streak App",\n  "files": {\n    "/App.jsx": { "code": "export default function App() { return <div>hello</div>;`;
    const parsed = parseLlmJson(raw);
    expect(parsed.title).toBe("Streak App");
    expect(parsed.files["/App.jsx"].code).toContain("export default");
  });
});
