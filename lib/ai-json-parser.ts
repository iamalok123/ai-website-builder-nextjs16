import { jsonrepair } from "jsonrepair";
import { STANDARD_VITE_CONFIG, ZEPHYRE_ERROR_BRIDGE_SCRIPT } from "./e2b";

export interface FilePatch {
    search: string;
    replace: string;
}

export interface FileChange {
    code?: string;
    patches?: FilePatch[];
}

export interface ParsedLlmResponse {
    assistantMessage: string;
    title?: string;
    files: Record<string, FileChange>;
    dependencies?: Record<string, string>;
}

/**
 * Standard utility file providing the canonical `cn` helper
 */
export const STANDARD_UTILS_CODE = `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
`;

/**
 * Generates a standard README.md for the generated project
 */
export function generateReadme(title: string, hasServer: boolean): string {
    return `# ${title || "Zephyre Web Application"}

A production-grade, modular web application built with React 19, Tailwind CSS, and Vite.

## Architecture

- \`/src/App.jsx\` - Main application root & view router
- \`/src/components/\` - Modular, reusable feature components
- \`/src/components/ui/\` - Accessible UI primitives (Button, Card, Badge, Modal, etc.)
- \`/src/hooks/\` - Custom React hooks for state and side-effects
- \`/src/lib/utils.js\` - Utility functions (class merging, formatters)
${hasServer ? "- `/server.js` - Express backend with file-based persistence (`database.json`)\n" : ""}
- \`/vite.config.js\` - Vite configuration with HMR and polling

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run development server:
   \`\`\`bash
   npm run dev
   \`\`\`
`;
}

/**
 * Applies a single search-and-replace patch block to source code.
 * Uses exact matching, line-ending agnostic matching, and trimmed indentation matching.
 * Never corrupts the original file if the target block is not found.
 */
export function applyPatch(
    original: string,
    patch: { search: string; replace: string }
): { success: boolean; code: string } {
    if (!patch || typeof patch.search !== "string" || typeof patch.replace !== "string") {
        return { success: false, code: original };
    }

    const search = patch.search;
    const replace = patch.replace;

    // Strategy 1: Exact string match
    if (original.includes(search)) {
        return {
            success: true,
            code: original.replace(search, replace),
        };
    }

    // Strategy 2: Line-ending agnostic match (normalize \r\n to \n)
    const normOrig = original.replace(/\r\n/g, "\n");
    const normSearch = search.replace(/\r\n/g, "\n");
    const normReplace = replace.replace(/\r\n/g, "\n");

    if (normOrig.includes(normSearch)) {
        return {
            success: true,
            code: normOrig.replace(normSearch, normReplace),
        };
    }

    // Strategy 3: Trimmed line matching (handles indentation variations)
    const origLines = normOrig.split("\n");
    const searchLines = normSearch.split("\n");

    if (searchLines.length > 0) {
        let sStart = 0;
        while (sStart < searchLines.length && searchLines[sStart].trim() === "") sStart++;
        let sEnd = searchLines.length - 1;
        while (sEnd >= sStart && searchLines[sEnd].trim() === "") sEnd--;

        const trimmedSearch = searchLines.slice(sStart, sEnd + 1);
        if (trimmedSearch.length > 0) {
            for (let i = 0; i <= origLines.length - trimmedSearch.length; i++) {
                let match = true;
                for (let j = 0; j < trimmedSearch.length; j++) {
                    if (origLines[i + j].trim() !== trimmedSearch[j].trim()) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    const origIndentMatch = origLines[i].match(/^\s*/);
                    const origIndent = origIndentMatch ? origIndentMatch[0] : "";
                    const searchIndentMatch = trimmedSearch[0].match(/^\s*/);
                    const searchIndent = searchIndentMatch ? searchIndentMatch[0] : "";

                    const replaceLines = normReplace.split("\n").map((line) => {
                        if (line.startsWith(searchIndent)) {
                            return origIndent + line.slice(searchIndent.length);
                        }
                        return line;
                    });

                    const newLines = [
                        ...origLines.slice(0, i),
                        ...replaceLines,
                        ...origLines.slice(i + trimmedSearch.length),
                    ];

                    return {
                        success: true,
                        code: newLines.join("\n"),
                    };
                }
            }
        }
    }

    // If no match found, do NOT mutate original code
    return { success: false, code: original };
}

/**
 * Normalizes all file paths and changes:
 * - Ensures leading slash
 * - Eliminates duplicate root /App.jsx by canonicalizing to /src/App.jsx
 * - Normalizes root /components/* into /src/components/*
 * - Preserves both full-code entries and search/replace patch arrays
 */
export function normalizeFileChanges(
    files: Record<string, FileChange | { code: string }>
): Record<string, FileChange> {
    const normalized: Record<string, FileChange> = {};

    for (const [rawPath, fileObj] of Object.entries(files)) {
        if (!fileObj) continue;
        const hasPatches = "patches" in fileObj && Array.isArray(fileObj.patches) && fileObj.patches.length > 0;
        if (typeof fileObj.code !== "string" && !hasPatches) {
            continue;
        }

        let clean = rawPath.trim();
        if (!clean.startsWith("/")) clean = "/" + clean;

        // Canonicalize root /App.jsx or /App.js -> /src/App.jsx
        if (clean === "/App.jsx" || clean === "/App.js" || clean === "/App.tsx") {
            clean = "/src/App.jsx";
        }
        // Canonicalize root /components/* -> /src/components/*
        else if (clean.startsWith("/components/")) {
            clean = "/src/components/" + clean.slice("/components/".length);
        }
        // Canonicalize root /hooks/* -> /src/hooks/*
        else if (clean.startsWith("/hooks/")) {
            clean = "/src/hooks/" + clean.slice("/hooks/".length);
        }
        // Canonicalize root /lib/* -> /src/lib/*
        else if (clean.startsWith("/lib/")) {
            clean = "/src/lib/" + clean.slice("/lib/".length);
        }

        if (typeof fileObj.code === "string") {
            let code = fileObj.code;
            // Clean up accidental LLM escape artifacts in JSX code (e.g. `\ />` or `\ >`)
            if (clean.endsWith(".jsx") || clean.endsWith(".tsx") || clean.endsWith(".js") || clean.endsWith(".ts")) {
                code = code.replace(/\\\s*(\/?>)/g, " $1");
            }

            // Guarantee server.js never binds to port 3000 (which belongs to Vite)
            if (clean === "/server.js") {
                code = code
                    .replace(/const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*\d+/g, "const PORT = process.env.BACKEND_PORT || 3001")
                    .replace(/const\s+PORT\s*=\s*3000\b/g, "const PORT = 3001")
                    .replace(/app\.listen\(\s*3000\s*,/g, "app.listen(3001,");
            }

            normalized[clean] = { code };
        } else if ("patches" in fileObj && Array.isArray(fileObj.patches)) {
            normalized[clean] = { patches: fileObj.patches };
        }
    }

    // Strict de-duplication: If /src/App.jsx exists, never allow a lingering /App.jsx
    if (normalized["/src/App.jsx"] && normalized["/App.jsx"]) {
        delete normalized["/App.jsx"];
    }

    return normalized;
}

/**
 * Legacy wrapper: Normalizes file paths and returns strictly Record<string, { code: string }>.
 */
export function normalizeFilePaths(
    files: Record<string, FileChange | { code: string }>
): Record<string, { code: string }> {
    const changes = normalizeFileChanges(files);
    const result: Record<string, { code: string }> = {};
    for (const [path, obj] of Object.entries(changes)) {
        if (typeof obj.code === "string") {
            result[path] = { code: obj.code };
        }
    }
    return result;
}

/**
 * Merges incoming LLM file changes (both full files and surgical patch blocks)
 * into an existing codebase and returns a fully normalized file map.
 */
export function applyFileChanges(
    existingFiles: Record<string, { code: string }>,
    incomingChanges: Record<string, FileChange | { code: string }>
): Record<string, { code: string }> {
    const result: Record<string, { code: string }> = { ...existingFiles };

    for (const [rawPath, change] of Object.entries(incomingChanges)) {
        if (!change) continue;
        let cleanPath = rawPath.trim();
        if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;

        if (cleanPath === "/App.jsx" || cleanPath === "/App.js") cleanPath = "/src/App.jsx";
        else if (cleanPath.startsWith("/components/")) cleanPath = "/src/components/" + cleanPath.slice("/components/".length);
        else if (cleanPath.startsWith("/hooks/")) cleanPath = "/src/hooks/" + cleanPath.slice("/hooks/".length);
        else if (cleanPath.startsWith("/lib/")) cleanPath = "/src/lib/" + cleanPath.slice("/lib/".length);

        // Case 1: Full code replacement or brand new file
        if (typeof change.code === "string") {
            let code = change.code;
            if (cleanPath.endsWith(".jsx") || cleanPath.endsWith(".tsx") || cleanPath.endsWith(".js") || cleanPath.endsWith(".ts")) {
                code = code.replace(/\\\s*(\/?>)/g, " $1");
            }
            if (cleanPath === "/server.js") {
                code = code
                    .replace(/const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*\d+/g, "const PORT = process.env.BACKEND_PORT || 3001")
                    .replace(/const\s+PORT\s*=\s*3000\b/g, "const PORT = 3001")
                    .replace(/app\.listen\(\s*3000\s*,/g, "app.listen(3001,");
            }
            result[cleanPath] = { code };
        }
        // Case 2: Patch search/replace array
        else if ("patches" in change && Array.isArray(change.patches) && change.patches.length > 0) {
            const currentCode = result[cleanPath]?.code || "";
            let patchedCode = currentCode;
            for (const patch of change.patches) {
                const patchResult = applyPatch(patchedCode, patch);
                if (patchResult.success) {
                    patchedCode = patchResult.code;
                } else {
                    console.warn(`[Patch Engine] Could not match search block in ${cleanPath}:`, patch.search.slice(0, 80));
                }
            }
            result[cleanPath] = { code: patchedCode };
        }
    }

    return normalizeFilePaths(result);
}

/**
 * Fallback regex extractor for severely truncated or malformed LLM responses.
 * Recovers whatever files and properties were successfully generated.
 */
function extractPartialLlmResponse(raw: string): ParsedLlmResponse | null {
    try {
        const files: Record<string, { code: string }> = {};

        // Extract assistantMessage
        const msgMatch = raw.match(/"assistantMessage"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const assistantMessage = msgMatch ? msgMatch[1] : "Generated application files.";

        // Extract title
        const titleMatch = raw.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const title = titleMatch ? titleMatch[1] : "Zephyre App";

        // Match file blocks: "filePath": { "code": "..." }
        const fileRegex = /"(\/[^"]+)"\s*:\s*\{\s*"code"\s*:\s*"((?:[^"\\]|\\.)*)"?/g;
        let match;
        while ((match = fileRegex.exec(raw)) !== null) {
            const filePath = match[1];
            let code = match[2];
            try {
                // Unescape JSON string content safely
                code = JSON.parse(`"${code}"`);
            } catch {
                code = code.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
            }
            files[filePath] = { code };
        }

        if (Object.keys(files).length > 0) {
            return {
                assistantMessage,
                title,
                files: normalizeFilePaths(files),
                dependencies: {},
            };
        }
    } catch {
        // Fallback extraction failed
    }
    return null;
}

/**
 * Robust LLM JSON Parser that guarantees valid output across all token-length and streaming edge cases.
 */
export function parseLlmJson(raw: string): ParsedLlmResponse {
    let clean = raw.trim();

    // Strip markdown code fences
    if (clean.startsWith("```json")) clean = clean.slice(7);
    else if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    clean = clean.trim();

    // Locate outer JSON boundary
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    let candidate = clean;
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        candidate = clean.substring(firstBrace, lastBrace + 1);
    } else if (firstBrace !== -1) {
        candidate = clean.substring(firstBrace);
    }

    // Attempt 1: Standard JSON.parse on candidate
    try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && parsed.files) {
            return {
                ...parsed,
                files: normalizeFileChanges(parsed.files),
            };
        }
    } catch {}

    // Attempt 2: jsonrepair on candidate
    try {
        const repaired = jsonrepair(candidate);
        const parsed = JSON.parse(repaired);
        if (parsed && typeof parsed === "object" && parsed.files) {
            return {
                ...parsed,
                files: normalizeFileChanges(parsed.files),
            };
        }
    } catch {}

    // Attempt 3: Sanitize control characters (except tab, newline, carriage return) + jsonrepair
    const sanitized = candidate.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
    try {
        const repaired = jsonrepair(sanitized);
        const parsed = JSON.parse(repaired);
        if (parsed && typeof parsed === "object" && parsed.files) {
            return {
                ...parsed,
                files: normalizeFileChanges(parsed.files),
            };
        }
    } catch {}

    // Attempt 4: Auto-close truncated string or object
    const autoClosedAttempts = [
        sanitized + '"}',
        sanitized + '"} }',
        sanitized + '"}} }',
        sanitized + '}}',
        sanitized + '}}}',
        sanitized + '"\n}\n}',
        sanitized + '"\n}\n}\n}',
    ];
    for (const attempt of autoClosedAttempts) {
        try {
            const repaired = jsonrepair(attempt);
            const parsed = JSON.parse(repaired);
            if (parsed && typeof parsed === "object" && parsed.files) {
                return {
                    ...parsed,
                    files: normalizeFileChanges(parsed.files),
                };
            }
        } catch {}
    }

    // Attempt 5: Fallback regex extractor for partially generated files
    const partial = extractPartialLlmResponse(clean);
    if (partial) {
        return partial;
    }

    // Final attempt: jsonrepair on full sanitized raw string
    const rawSanitized = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
    const finalRepaired = jsonrepair(rawSanitized);
    const finalParsed = JSON.parse(finalRepaired);
    return {
        ...finalParsed,
        files: normalizeFileChanges(finalParsed.files || {}),
    };
}

/**
 * Ensures complete, modular, production-grade project hierarchy:
 * - /src/App.jsx as canonical React entry component
 * - /src/lib/utils.js with cn() helper
 * - /README.md with architecture notes
 * - /index.html with error bridge
 * - /vite.config.js with allowedHosts, polling, and HMR
 * - /src/main.jsx mounting /src/App.jsx
 * - /package.json with React 19 and necessary dependencies
 * - Complete de-duplication of root /App.jsx
 */
export function ensureStandardFiles(
    files: Record<string, { code: string }>,
    dependencies: Record<string, string>,
    title: string
): { files: Record<string, { code: string }>; dependencies: Record<string, string> } {
    const updatedFiles = normalizeFilePaths(files);
    const isPython = Object.keys(updatedFiles).some((p) => p.endsWith(".py") || p.includes("requirements.txt"));

    if (isPython) {
        if (!updatedFiles["/requirements.txt"]) {
            updatedFiles["/requirements.txt"] = { code: "fastapi\nuvicorn\njinja2\n" };
        }
        return { files: updatedFiles, dependencies };
    }

    // Ensure root index.html with Error Bridge attached
    if (!updatedFiles["/index.html"]) {
        updatedFiles["/index.html"] = {
            code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || "Zephyre App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${ZEPHYRE_ERROR_BRIDGE_SCRIPT}
  </head>
  <body class="bg-black text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
        };
    } else if (!updatedFiles["/index.html"].code.includes('id="zephyre-error-bridge"')) {
        let code = updatedFiles["/index.html"].code;
        if (code.includes("</head>")) {
            code = code.replace("</head>", `${ZEPHYRE_ERROR_BRIDGE_SCRIPT}\n</head>`);
        } else {
            code = `${ZEPHYRE_ERROR_BRIDGE_SCRIPT}\n${code}`;
        }
        updatedFiles["/index.html"] = { code };
    }

    // Ensure root vite.config.js with allowedHosts: true, polling, and HMR
    const viteKey = Object.keys(updatedFiles).find(
        (k) => k === "/vite.config.js" || k === "/vite.config.ts"
    );
    if (
        !viteKey ||
        !updatedFiles[viteKey].code.includes("allowedHosts: true") ||
        !updatedFiles[viteKey].code.includes("usePolling")
    ) {
        updatedFiles["/vite.config.js"] = {
            code: STANDARD_VITE_CONFIG,
        };
    }

    // Ensure /src/lib/utils.js exists for clean cn() helper
    if (!updatedFiles["/src/lib/utils.js"] && !updatedFiles["/src/lib/utils.ts"]) {
        updatedFiles["/src/lib/utils.js"] = {
            code: STANDARD_UTILS_CODE,
        };
    }

    // Ensure /README.md exists
    const hasServerJs = Boolean(updatedFiles["/server.js"]);
    if (!updatedFiles["/README.md"]) {
        updatedFiles["/README.md"] = {
            code: generateReadme(title, hasServerJs),
        };
    }

    // Ensure /src/main.jsx entry point exists
    if (!updatedFiles["/src/main.jsx"]) {
        updatedFiles["/src/main.jsx"] = {
            code: `import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);`,
        };
    }

    // Ensure canonical /src/App.jsx exists
    if (!updatedFiles["/src/App.jsx"]) {
        if (updatedFiles["/App.jsx"]) {
            updatedFiles["/src/App.jsx"] = updatedFiles["/App.jsx"];
            delete updatedFiles["/App.jsx"];
        } else {
            updatedFiles["/src/App.jsx"] = {
                code: `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1 className="text-2xl font-bold">${title || "Zephyre App"}</h1>
    </div>
  );
}`,
            };
        }
    } else {
        // Delete root /App.jsx so it never duplicates in file explorer
        delete updatedFiles["/App.jsx"];
    }

    // Ensure package.json
    const backendDeps = hasServerJs ? { express: "^4.21.2", cors: "^2.8.5" } : {};
    const devScript = hasServerJs
        ? "PORT=3001 node server.js & vite --host 0.0.0.0 --port 3000"
        : "vite --host 0.0.0.0 --port 3000";

    if (!updatedFiles["/package.json"]) {
        updatedFiles["/package.json"] = {
            code: JSON.stringify(
                {
                    name: "zephyre-app",
                    version: "1.0.0",
                    type: "module",
                    scripts: {
                        dev: devScript,
                        build: "vite build",
                        start: "node server.js",
                    },
                    dependencies: {
                        react: "^19.0.0",
                        "react-dom": "^19.0.0",
                        "lucide-react": "^1.16.0",
                        clsx: "^2.1.1",
                        "tailwind-merge": "^3.0.0",
                        ...backendDeps,
                        ...dependencies,
                    },
                    devDependencies: {
                        "@vitejs/plugin-react": "^4.3.4",
                        vite: "^6.0.0",
                    },
                },
                null,
                2
            ),
        };
    }

    return { files: updatedFiles, dependencies };
}
