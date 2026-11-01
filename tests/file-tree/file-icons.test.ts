import { describe, it, expect } from "vitest";

function getFileCategory(filename: string): "react" | "javascript" | "python" | "json" | "html" | "css" | "generic" {
  if (filename.endsWith(".jsx") || filename.endsWith(".tsx")) return "react";
  if (filename.endsWith(".js") || filename.endsWith(".ts") || filename.endsWith(".mjs")) return "javascript";
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".html")) return "html";
  if (filename.endsWith(".css")) return "css";
  return "generic";
}

describe("File Category & Icon Resolver", () => {
  it("should classify JSX and TSX as react components", () => {
    expect(getFileCategory("App.jsx")).toBe("react");
    expect(getFileCategory("Header.tsx")).toBe("react");
  });

  it("should classify JS, TS, and MJS as javascript", () => {
    expect(getFileCategory("server.js")).toBe("javascript");
    expect(getFileCategory("utils.ts")).toBe("javascript");
    expect(getFileCategory("build.mjs")).toBe("javascript");
  });

  it("should classify Python, JSON, HTML, and CSS properly", () => {
    expect(getFileCategory("main.py")).toBe("python");
    expect(getFileCategory("package.json")).toBe("json");
    expect(getFileCategory("index.html")).toBe("html");
    expect(getFileCategory("globals.css")).toBe("css");
  });

  it("should fallback to generic for unknown extensions", () => {
    expect(getFileCategory("README.md")).toBe("generic");
    expect(getFileCategory("Dockerfile")).toBe("generic");
    expect(getFileCategory(".gitignore")).toBe("generic");
  });
});
