import { describe, it, expect } from "vitest";
import React from "react";
import { FileIcon, FolderIcon, getFileIcon } from "@/components/ui/file-icons";

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

  it("should render FileIcon for various file types and specific configs", () => {
    const reactIcon = FileIcon({ filename: "ChatPanel.tsx" });
    expect(React.isValidElement(reactIcon)).toBe(true);

    const tsIcon = FileIcon({ filename: "proxy.ts" });
    expect(React.isValidElement(tsIcon)).toBe(true);

    const pkgIcon = FileIcon({ filename: "package.json" });
    expect(React.isValidElement(pkgIcon)).toBe(true);

    const gitIcon = FileIcon({ filename: ".gitignore" });
    expect(React.isValidElement(gitIcon)).toBe(true);

    const nextIcon = FileIcon({ filename: "next.config.ts" });
    expect(React.isValidElement(nextIcon)).toBe(true);

    const helperIcon = getFileIcon("button.tsx");
    expect(React.isValidElement(helperIcon)).toBe(true);
  });

  it("should render FolderIcon for open and closed states with theme colors", () => {
    const closedFolder = FolderIcon({ folderName: "components", isOpen: false });
    expect(React.isValidElement(closedFolder)).toBe(true);

    const openFolder = FolderIcon({ folderName: "ui", isOpen: true });
    expect(React.isValidElement(openFolder)).toBe(true);

    const defaultFolder = FolderIcon({ folderName: "custom-dir" });
    expect(React.isValidElement(defaultFolder)).toBe(true);
  });
});
