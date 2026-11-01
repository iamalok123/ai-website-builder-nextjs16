import { describe, it, expect } from "vitest";
import {
    getLanguageExtension,
    getLanguageName,
    formatBytes,
    pureBlackTheme,
    brightSyntaxHighlighting,
} from "@/components/editor/editor-theme";

describe("CodeMirror Editor Theme & Language Resolution", () => {
    it("should resolve correct human-readable language names from file extensions", () => {
        expect(getLanguageName("App.tsx")).toBe("TypeScript JSX");
        expect(getLanguageName("types/workspace.ts")).toBe("TypeScript");
        expect(getLanguageName("src/App.jsx")).toBe("React JSX");
        expect(getLanguageName("lib/utils.js")).toBe("JavaScript");
        expect(getLanguageName("index.html")).toBe("HTML");
        expect(getLanguageName("icon.svg")).toBe("SVG XML");
        expect(getLanguageName("globals.css")).toBe("CSS");
        expect(getLanguageName("package.json")).toBe("JSON");
        expect(getLanguageName("README.md")).toBe("Markdown");
        expect(getLanguageName(".gitignore")).toBe("Plain Text");
    });

    it("should instantiate CodeMirror 6 language extensions correctly", () => {
        expect(getLanguageExtension("App.tsx").length).toBe(1);
        expect(getLanguageExtension("types.ts").length).toBe(1);
        expect(getLanguageExtension("App.jsx").length).toBe(1);
        expect(getLanguageExtension("server.js").length).toBe(1);
        expect(getLanguageExtension("index.html").length).toBe(1);
        expect(getLanguageExtension("styles.css").length).toBe(1);
        expect(getLanguageExtension("config.json").length).toBe(1);
        expect(getLanguageExtension("notes.txt").length).toBe(0);
    });

    it("should format byte sizes accurately into human readable strings", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(1024)).toBe("1.0 KB");
        expect(formatBytes(2560)).toBe("2.5 KB");
    });

    it("should expose valid CodeMirror 6 theme and syntax extensions", () => {
        expect(pureBlackTheme).toBeDefined();
        expect(brightSyntaxHighlighting).toBeDefined();
    });
});
