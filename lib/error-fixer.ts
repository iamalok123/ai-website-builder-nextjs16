import type { FileData } from "@/types/workspace";

export interface ErrorInfo {
    message: string;
    category?: "compile" | "runtime" | "sandbox" | string;
    file?: string;
    line?: number;
    column?: number;
    codeFrame?: string;
    stack?: string;
}

/**
 * Normalizes file paths for matching across different conventions
 * (e.g. "/src/App.jsx", "src/App.jsx", "/App.jsx", "App.jsx")
 */
export function normalizePath(path: string): string {
    return path.replace(/^\/+/, "").replace(/^home\/user\/app\//, "");
}

/**
 * Parses raw error strings or objects into a structured ErrorInfo object.
 * Robustly matches Vite compile/Babel errors, runtime stack traces, and standard error messages.
 */
export function parseRawError(raw: unknown): ErrorInfo {
    if (typeof raw === "object" && raw !== null) {
        const obj = raw as Record<string, unknown>;
        return {
            message: String(obj.message || obj.error || "An error occurred"),
            category: (obj.category as string) || "runtime",
            file: obj.file ? normalizePath(String(obj.file)) : undefined,
            line: typeof obj.line === "number" ? obj.line : undefined,
            column: typeof obj.column === "number" ? obj.column : undefined,
            codeFrame: obj.codeFrame ? String(obj.codeFrame) : undefined,
            stack: obj.stack ? String(obj.stack) : undefined,
        };
    }

    const str = String(raw || "").trim();
    const firstLine = str.split("\n")[0] || str;

    let file: string | undefined;
    let line: number | undefined;
    let column: number | undefined;
    let message = firstLine;

    // 1. Vite Babel/esbuild compile error:
    // e.g. [plugin:vite:react-babel] /home/user/app/src/App.jsx: Missing semicolon. (26:6)
    const isViteCompile = str.includes("[plugin:vite") || str.includes("vite-error-overlay");
    if (isViteCompile) {
        const viteMatch = str.match(
            /(?:\[plugin:[^\]]+\]\s*)?(?:(?:\/home\/user\/app\/|\/src\/|\b))([a-zA-Z0-9_\-\.\/]+\.(?:jsx?|tsx?|css|json|html|py))(?::\s*|\s+)([^(\n]+)(?:\((\d+):(\d+)\))?/i
        );
        if (viteMatch) {
            file = normalizePath(viteMatch[1]);
            const matchedMsg = viteMatch[2]?.trim();
            if (matchedMsg) {
                message = matchedMsg;
            }
            if (viteMatch[3]) line = parseInt(viteMatch[3], 10);
            if (viteMatch[4]) column = parseInt(viteMatch[4], 10);
        }
    } else {
        // 2. Runtime stack trace matching:
        // e.g. at HabitList (src/components/HabitList.jsx:14:22)
        const stackMatch = str.match(
            /(?:at\s+.*?\s*\(|\bat\s+)?([a-zA-Z0-9_\-\.\/]+\.(?:jsx?|tsx?|css|json|html|py)):(\d+):?(\d+)?\)?/i
        );
        if (stackMatch) {
            file = normalizePath(stackMatch[1]);
            line = parseInt(stackMatch[2], 10);
            if (stackMatch[3]) column = parseInt(stackMatch[3], 10);
        }
    }

    // Extract code frame if present (marked by line numbers like "24 | ... 25 | ... ^")
    let codeFrame: string | undefined;
    const frameIndex = str.indexOf("|");
    if (frameIndex !== -1) {
        const lines = str.split("\n");
        const frameLines = lines.filter((l) => l.includes("|") || l.includes("^"));
        if (frameLines.length > 0) {
            codeFrame = frameLines.join("\n");
        }
    }

    return {
        message,
        category: str.includes("plugin:vite") ? "compile" : "runtime",
        file,
        line,
        column,
        codeFrame: codeFrame || str,
        stack: str,
    };
}

/**
 * Resolves a relative import path like "../lib/utils" from "/src/components/Foo.jsx"
 * to normalized path candidates like "src/lib/utils".
 */
function resolveRelativeImportCandidates(importerPath: string, relImport: string): string[] {
    const cleanImporter = normalizePath(importerPath);
    const dirParts = cleanImporter.includes("/") ? cleanImporter.split("/").slice(0, -1) : [];
    const relParts = relImport.split("/");
    const resolved = [...dirParts];
    for (const part of relParts) {
        if (!part || part === ".") continue;
        if (part === "..") resolved.pop();
        else resolved.push(part);
    }
    const base = resolved.join("/");
    const stripped = relImport.replace(/^(?:\.\.?\/)+/, "");
    return [
        base,
        `${base}.jsx`,
        `${base}.js`,
        `${base}.tsx`,
        `${base}.ts`,
        `${base}/index.jsx`,
        `${base}/index.js`,
        stripped,
        `${stripped}.jsx`,
        `${stripped}.js`,
        `src/${stripped}`,
        `src/${stripped}.jsx`,
        `src/${stripped}.js`,
    ];
}

/**
 * Lightweight client-safe scanner that checks every file in the workspace for
 * obvious truncation, unbalanced delimiters, invalid JSON, or incomplete HTML docs.
 */
export function findSuspiciousProjectFiles(
    fileData: FileData
): { path: string; reason: string; code: string }[] {
    const issues: { path: string; reason: string; code: string }[] = [];
    const allFiles = fileData.files || {};

    for (const [path, fileObj] of Object.entries(allFiles)) {
        const code = fileObj?.code;
        if (typeof code !== "string") continue;
        const lower = path.toLowerCase();

        if (lower.endsWith(".json")) {
            try {
                JSON.parse(code);
            } catch {
                issues.push({ path, reason: "Invalid JSON syntax", code });
            }
            continue;
        }

        if (
            !lower.endsWith(".js") &&
            !lower.endsWith(".jsx") &&
            !lower.endsWith(".ts") &&
            !lower.endsWith(".tsx")
        ) {
            continue;
        }

        if ((lower.endsWith("/src/app.jsx") || lower.endsWith("/app.jsx")) && !code.trim()) {
            issues.push({ path, reason: "Empty root App component", code });
            continue;
        }

        if ((/<!DOCTYPE\s+html/i.test(code) || /<html[\s>]/i.test(code)) && !/<\/html>/i.test(code)) {
            issues.push({ path, reason: "Incomplete HTML template literal (missing </html>)", code });
            continue;
        }

        if (/\breturn\s*\(\s*(?:null)?\s*\)\s*;?\s*\}$/.test(code.trimEnd())) {
            issues.push({ path, reason: "Truncated JSX return block", code });
            continue;
        }

        // Fast bracket/brace/paren/template parity scan ignoring comments & string literals
        const stack: string[] = [];
        let inStr: string | null = null;
        let inLineComment = false;
        let inBlockComment = false;
        let mismatchReason: string | null = null;

        for (let i = 0; i < code.length; i++) {
            const ch = code[i];
            const next = code[i + 1] ?? "";
            if (inLineComment) {
                if (ch === "\n") inLineComment = false;
                continue;
            }
            if (inBlockComment) {
                if (ch === "*" && next === "/") {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (inStr) {
                if (ch === "\\") {
                    i++;
                    continue;
                }
                if (inStr === "`" && ch === "$" && next === "{") {
                    stack.push("${");
                    inStr = null;
                    i++;
                    continue;
                }
                if (ch === inStr) {
                    inStr = null;
                    continue;
                }
                if ((inStr === "'" || inStr === '"') && ch === "\n") {
                    inStr = null;
                }
                continue;
            }
            if (ch === "/" && next === "/") {
                inLineComment = true;
                i++;
                continue;
            }
            if (ch === "/" && next === "*") {
                inBlockComment = true;
                i++;
                continue;
            }
            if (ch === "'" || ch === '"' || ch === "`") {
                if (ch === "'" && i > 0 && /[A-Za-z]/.test(code[i - 1]) && /[A-Za-z]/.test(next)) {
                    continue;
                }
                inStr = ch;
                continue;
            }
            if (ch === "{" || ch === "[" || ch === "(") {
                stack.push(ch);
            } else if (ch === "}") {
                const top = stack.pop();
                if (top === "${") {
                    inStr = "`";
                } else if (top !== "{") {
                    mismatchReason = `Mismatched brace '}' (expected closing for '${top || "none"}')`;
                    break;
                }
            } else if (ch === "]") {
                const top = stack.pop();
                if (top !== "[") {
                    mismatchReason = `Mismatched bracket ']' (expected closing for '${top || "none"}')`;
                    break;
                }
            } else if (ch === ")") {
                const top = stack.pop();
                if (top !== "(") {
                    mismatchReason = `Mismatched parenthesis ')' (expected closing for '${top || "none"}')`;
                    break;
                }
            }
        }

        if (mismatchReason) {
            issues.push({ path, reason: mismatchReason, code });
        } else if (inStr === "`") {
            issues.push({ path, reason: "Unclosed template literal", code });
        } else if (stack.length > 0) {
            issues.push({ path, reason: `Unclosed delimiters: ${stack.join(", ")}`, code });
        }
    }

    return issues;
}

/**
 * Finds all connected files for a target broken file:
 * - The broken file itself
 * - Files imported by the broken file (relative imports)
 * - Files that import the broken file
 * - package.json (for dependency version context)
 */
export function getConnectedFiles(
    fileData: FileData,
    targetFile?: string
): Record<string, string> {
    const allFiles = fileData.files || {};
    const result: Record<string, string> = {};

    // Helper to find file content with path normalization
    const findFile = (name: string): [string, string] | null => {
        const cleanName = normalizePath(name);
        for (const [p, f] of Object.entries(allFiles)) {
            if (normalizePath(p) === cleanName) {
                return [p, f.code];
            }
        }
        return null;
    };

    // Always include package.json if present
    const pkg = findFile("package.json");
    if (pkg) {
        result[pkg[0]] = pkg[1];
    }

    if (!targetFile) {
        // If target file isn't specified, include App.jsx and server.js as defaults
        const app = findFile("App.jsx") || findFile("src/App.jsx");
        if (app) result[app[0]] = app[1];
        const server = findFile("server.js");
        if (server) result[server[0]] = server[1];
        return result;
    }

    const primary = findFile(targetFile);
    if (primary) {
        result[primary[0]] = primary[1];

        // 1. Scan target file for relative imports: import ... from './...' or '../...'
        const importRegex = /(?:import|export)\s+(?:.*?from\s+)?['"](\.[^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(primary[1])) !== null) {
            const candidates = resolveRelativeImportCandidates(primary[0], match[1]);
            for (const cand of candidates) {
                const found = findFile(cand);
                if (found && !result[found[0]]) {
                    result[found[0]] = found[1];
                    break;
                }
            }
        }
    }

    // 2. Scan other project files to see if any import the target file
    const targetBase = normalizePath(targetFile).replace(/\.[^/.]+$/, "");
    const simpleName = targetBase.split("/").pop() || targetBase;
    for (const [path, fileObj] of Object.entries(allFiles)) {
        if (result[path]) continue;
        if (
            fileObj.code.includes(targetBase) ||
            fileObj.code.includes(`./${simpleName}`) ||
            fileObj.code.includes(`/${simpleName}`) ||
            fileObj.code.includes(`'${simpleName}'`) ||
            fileObj.code.includes(`"${simpleName}"`)
        ) {
            result[path] = fileObj.code;
        }
    }

    return result;
}

/**
 * Builds a comprehensive, high-precision prompt for LLMs to diagnose and fix
 * the exact syntax or runtime error in the application.
 */
export function buildErrorFixPrompt(
    rawError: unknown,
    fileData: FileData
): string {
    const error = parseRawError(rawError);
    const connected = getConnectedFiles(fileData, error.file);
    const additionalBroken = findSuspiciousProjectFiles(fileData).filter(
        (issue) => !connected[issue.path]
    );

    const locationText = error.file
        ? `${error.file}${error.line ? ` (Line ${error.line}${error.column ? `, Column ${error.column}` : ""})` : ""}`
        : "Preview Runtime";

    let prompt = `🚨 DIAGNOSTIC ERROR REPORT & ONE-CLICK AUTO-FIX REQUEST

Location: ${locationText}
Category: ${error.category || "Runtime"}
Error Message: ${error.message}
`;

    if (error.codeFrame) {
        prompt += `\nError Code Frame:\n\`\`\`\n${error.codeFrame}\n\`\`\`\n`;
    }

    if (error.stack && error.stack !== error.codeFrame) {
        prompt += `\nStack Trace Snippet:\n\`\`\`\n${error.stack.slice(0, 1000)}\n\`\`\`\n`;
    }

    prompt += `\n📁 Connected Files & Dependencies Context:\n`;
    for (const [filePath, code] of Object.entries(connected)) {
        prompt += `\n--- ${filePath} ---\n\`\`\`${filePath.endsWith(".json") ? "json" : "jsx"}\n${code}\n\`\`\`\n`;
    }

    if (additionalBroken.length > 0) {
        prompt += `\n⚠️ ADDITIONAL CORRUPTED OR TRUNCATED FILES DETECTED IN PROJECT (MUST ALSO BE FIXED):\n`;
        for (const issue of additionalBroken) {
            prompt += `\n--- ${issue.path} (${issue.reason}) ---\n\`\`\`${issue.path.endsWith(".json") ? "json" : "jsx"}\n${issue.code}\n\`\`\`\n`;
        }
    }

    prompt += `
CRITICAL FIX INSTRUCTIONS:
1. Pinpoint the exact syntax, truncation, import, or runtime issue indicated by the error code frame AND inspect all other listed broken/truncated files above.
   - If any function, JSX block, HTML template string, or object/array was cut off or closed with mismatched brackets, restore the complete valid implementation without placeholders.
   - For missing semicolon or unexpected token in imports (e.g. missing commas in import lists like "{ IconA IconB } from 'lucide-react'"), fix the syntax cleanly.
   - For missing components or unexported symbols, ensure they are properly exported or imported.
   - For Tailwind template literals, strictly format them as: className={\`my-class \${variable}\`}.
2. Keep all existing features, styling, state, and working components 100% intact. Do NOT redesign or rewrite unbroken files unnecessarily.
3. Return FULL complete corrected "code" (NOT "patches") in valid JSON format for EVERY file that needed fixing, properly escaping all inner double quotes as \\" inside JSON strings.`;

    return prompt;
}

/**
 * Returns a human-friendly label for chat UI display when an error fix is triggered
 */
export function formatErrorFixDisplay(error: ErrorInfo): string {
    const loc = error.file
        ? `${error.file}${error.line ? `:${error.line}` : ""}`
        : "application";
    const cleanMsg = (error.message || "Unknown error").split("\n")[0].trim();
    const typeLabel = error.category === "compile" ? "compile error" : "runtime error";
    return `🔧 Fix ${typeLabel} in ${loc}: ${cleanMsg}`;
}

/**
 * Detects if a chat message content string is an internal diagnostic error prompt
 */
export function isDiagnosticPrompt(content?: string): boolean {
    if (!content) return false;
    return (
        content.includes("🚨 DIAGNOSTIC ERROR REPORT") ||
        (content.includes("CRITICAL FIX INSTRUCTIONS:") && content.includes("Location:"))
    );
}

/**
 * Extracts human-friendly summary metadata from a raw diagnostic prompt string
 */
export function extractDiagnosticSummary(content: string): {
    title: string;
    location: string;
    message: string;
    category: string;
} {
    const locationMatch = content.match(/Location:\s*([^\n]+)/i);
    const categoryMatch = content.match(/Category:\s*([^\n]+)/i);
    const errorMatch = content.match(/Error Message:\s*([^\n]+)/i);

    const location = locationMatch ? locationMatch[1].trim() : "Application";
    const category = categoryMatch ? categoryMatch[1].trim() : "Runtime";
    const message = errorMatch ? errorMatch[1].trim() : "Runtime exception detected";

    return {
        title: `One-Click Auto-Fix: ${category} in ${location}`,
        location,
        message,
        category,
    };
}

