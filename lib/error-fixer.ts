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
            const rawImport = match[1];
            // Resolve relative import to potential file names (.jsx, .js, .tsx, .ts, etc.)
            const base = rawImport.replace(/^\.\//, "");
            const candidates = [
                base,
                `${base}.jsx`,
                `${base}.js`,
                `${base}.tsx`,
                `${base}.ts`,
                `src/${base}`,
                `src/${base}.jsx`,
                `src/${base}.js`,
                `components/${base}`,
                `components/${base}.jsx`,
            ];
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

    prompt += `
CRITICAL FIX INSTRUCTIONS:
1. Pinpoint the exact syntax, import, or runtime issue indicated by the error code frame and line number.
   - For missing semicolon or unexpected token in imports (e.g. missing commas in import lists like "{ IconA IconB } from 'lucide-react'"), fix the syntax cleanly.
   - For missing components or unexported symbols, ensure they are properly exported or imported.
   - For Tailwind template literals, strictly format them as: className={\`my-class \${variable}\`}.
2. Only modify the specific lines necessary to fix the error; keep all existing features, styling, state, and functionality 100% intact.
3. Return the complete corrected file(s) in JSON format so the application compiles and renders without errors.`;

    return prompt;
}
