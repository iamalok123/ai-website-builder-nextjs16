import { Sandbox } from "e2b";
import type { FileData } from "@/types/workspace";

export const E2B_SANDBOX_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes default idle timeout

export function getE2bApiKey(): string {
    const candidateKeys = [
        process.env.E2B_SANDBOX_API_KEY,
        process.env.E2B_API_KEY,
    ].filter((k): k is string => !!k && k.trim().length > 0);

    // E2B API keys start with "e2b_"
    const validKey = candidateKeys.find((k) => k.startsWith("e2b_")) || candidateKeys[0] || "";
    if (!validKey) {
        throw new Error("Missing valid E2B_SANDBOX_API_KEY (must start with 'e2b_')");
    }
    return validKey;
}

/**
 * Proactively kills oldest running sandboxes to stay comfortably under concurrent limits
 */
export async function pruneStaleSandboxes(keepCount = 10): Promise<number> {
    try {
        const apiKey = getE2bApiKey();
        const paginator = Sandbox.list({ apiKey });
        const items = await paginator.nextItems();
        if (!items || items.length <= keepCount) {
            return 0;
        }

        // Sort by startedAt ascending (oldest first)
        const sorted = [...items].sort((a, b) => {
            const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
            const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
            return timeA - timeB;
        });

        const toPruneCount = items.length - keepCount;
        const toPrune = sorted.slice(0, toPruneCount);

        let pruned = 0;
        await Promise.all(
            toPrune.map(async (s) => {
                try {
                    await Sandbox.kill(s.sandboxId, { apiKey });
                    pruned++;
                } catch {
                    // Silently ignore already terminated sandboxes
                }
            })
        );

        return pruned;
    } catch (err) {
        console.warn("[E2B Pruner] Failed to prune sandboxes:", err);
        return 0;
    }
}

/**
 * Creates an isolated E2B cloud sandbox instance with public web traffic enabled.
 * Automatically self-heals by pruning stale sandboxes if concurrent limit (20) is approached.
 */
export async function createE2bSandbox(timeoutMs = E2B_SANDBOX_TIMEOUT_MS): Promise<Sandbox> {
    const apiKey = getE2bApiKey();
    const createConfig = {
        apiKey,
        timeoutMs,
        envs: {
            PORT: "3000",
            HOST: "0.0.0.0",
        },
        network: {
            allowPublicTraffic: true,
            maskRequestHost: "localhost:${PORT}",
        },
        metadata: {
            app: "zephyre",
            timestamp: new Date().toISOString(),
        },
    };

    try {
        return await Sandbox.create(createConfig);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // If 20 concurrent limit or rate limit exceeded, proactively prune stale sandboxes and retry
        if (
            msg.includes("Rate limit exceeded") ||
            msg.includes("maximum number of concurrent") ||
            msg.includes("429")
        ) {
            console.warn(
                "[E2B] Concurrent sandbox limit (20) reached. Automatically pruning stale microVMs and retrying..."
            );
            await pruneStaleSandboxes(8);
            await new Promise((res) => setTimeout(res, 500));
            return await Sandbox.create(createConfig);
        }
        throw err;
    }
}

/**
 * Re-connects to an existing running sandbox by ID
 */
export async function connectE2bSandbox(sandboxId: string): Promise<Sandbox> {
    const apiKey = getE2bApiKey();
    return await Sandbox.connect(sandboxId, { apiKey });
}

/**
 * Gracefully shuts down a sandbox by ID
 */
export async function killE2bSandbox(sandboxId: string): Promise<boolean> {
    const apiKey = getE2bApiKey();
    try {
        return await Sandbox.kill(sandboxId, { apiKey });
    } catch {
        return false;
    }
}

/**
 * Detects whether the project stack is Python or standard Node/React
 */
export function detectStack(files: Record<string, { code: string }>): "python" | "react-node" {
    const paths = Object.keys(files);
    const hasPython = paths.some((p) => p.endsWith(".py") || p.includes("requirements.txt"));
    return hasPython ? "python" : "react-node";
}

export const STANDARD_VITE_CONFIG = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      clientPort: 443,
    },
  },
});
`.trim();

export const ZEPHYRE_ERROR_BRIDGE_SCRIPT = `
<script id="zephyre-error-bridge">
(function() {
  var lastErrorKey = '';
  function sendError(data) {
    if (!data || !data.message) return;
    var key = (data.file || '') + ':' + (data.line || '') + ':' + data.message;
    if (key === lastErrorKey) return;
    lastErrorKey = key;
    try {
      window.parent.postMessage({
        source: 'zephyre-preview-error',
        category: data.category || 'runtime',
        message: data.message,
        file: data.file || '',
        line: data.line,
        column: data.column,
        codeFrame: data.codeFrame || '',
        stack: data.stack || data.message
      }, '*');
    } catch(e) {}
  }

  function clearError() {
    if (lastErrorKey) {
      lastErrorKey = '';
      try {
        window.parent.postMessage({ source: 'zephyre-preview-clear' }, '*');
      } catch(e) {}
    }
  }

  window.addEventListener('error', function(e) {
    var msg = e.message || 'Script error';
    sendError({
      category: 'runtime',
      message: msg,
      file: e.filename || '',
      line: e.lineno,
      column: e.colno,
      stack: e.error ? (e.error.stack || e.error.message) : msg
    });
  });

  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason;
    var msg = reason ? (reason.stack || reason.message || String(reason)) : 'Unhandled Promise Rejection';
    sendError({
      category: 'runtime',
      message: msg,
      stack: msg
    });
  });

  function checkViteOverlay() {
    var overlay = document.querySelector('vite-error-overlay');
    if (overlay) {
      var root = overlay.shadowRoot || overlay;
      var text = (root.textContent || '').trim();
      if (text) {
        var fileMatch = text.match(/(?:\\/home\\/user\\/app\\/|src\\/|\\b)([a-zA-Z0-9_\\-\\.\\/]+\\.(?:jsx?|tsx?|css|json|html|py))/i);
        var lineMatch = text.match(/\\((\\d+):(\\d+)\\)/);
        sendError({
          category: 'compile',
          message: text.split('\\n')[0] || 'Build error',
          file: fileMatch ? fileMatch[1] : '',
          line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
          column: lineMatch ? parseInt(lineMatch[2], 10) : undefined,
          codeFrame: text,
          stack: text
        });
        return;
      }
    }
    if (lastErrorKey && lastErrorKey.includes('plugin:vite')) {
      clearError();
    }
  }

  var observer = new MutationObserver(function() {
    checkViteOverlay();
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
})();
</script>
`.trim();

export const ZEPHYRE_HMR_REPORTER_CODE = `
// Live HMR compilation error reporter for Zephyre IDE
if (import.meta.hot) {
  import.meta.hot.on('vite:error', (payload) => {
    try {
      const err = payload.err || {};
      const fullText = [
        err.plugin ? \`[plugin:\${err.plugin}]\` : '',
        err.id ? \`\${err.id}:\` : '',
        err.message,
        err.frame
      ].filter(Boolean).join('\\n');
      window.parent.postMessage({
        source: 'zephyre-preview-error',
        category: 'compile',
        message: err.message || 'Build error',
        file: err.id ? err.id.replace(/^.*\\/src\\//, 'src/').replace(/^.*\\/app\\//, '') : '',
        line: err.loc?.line,
        column: err.loc?.column,
        codeFrame: err.frame || '',
        stack: fullText
      }, '*');
    } catch (e) {}
  });

  import.meta.hot.on('vite:beforeUpdate', () => {
    try {
      window.parent.postMessage({ source: 'zephyre-preview-clear' }, '*');
    } catch (e) {}
  });
}
`.trim();

export const SQLITE_SHIM_CODE = `
import fs from 'node:fs';
import path from 'node:path';

export class DatabaseSync {
  constructor(filename = './database.sqlite') {
    this.jsonFile = filename.endsWith('.json') ? filename : filename.replace(/\\.[^.]+$/, '') + '.json';
    this.store = {};
    try {
      if (fs.existsSync(this.jsonFile)) {
        this.store = JSON.parse(fs.readFileSync(this.jsonFile, 'utf-8'));
      }
    } catch {
      this.store = {};
    }
  }

  _persist() {
    try {
      fs.writeFileSync(this.jsonFile, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DatabaseSync Shim] Persist error:', e);
    }
  }

  exec(sql) {
    const match = sql.match(/CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-zA-Z0-9_]+)/i);
    if (match && match[1]) {
      const table = match[1].toLowerCase();
      if (!this.store[table]) {
        this.store[table] = [];
        this._persist();
      }
    }
  }

  prepare(sql) {
    const trimmed = sql.trim();
    const self = this;

    if (/^SELECT/i.test(trimmed)) {
      const match = trimmed.match(/FROM\\s+([a-zA-Z0-9_]+)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      return {
        all(...args) {
          const rows = self.store[table] || [];
          if (/WHERE\\s+id\\s*=\\s*\\?/i.test(trimmed) && args.length > 0) {
            return rows.filter(r => Number(r.id) === Number(args[0]));
          }
          return [...rows];
        },
        get(...args) {
          const rows = self.store[table] || [];
          if (/WHERE\\s+id\\s*=\\s*\\?/i.test(trimmed) && args.length > 0) {
            return rows.find(r => Number(r.id) === Number(args[0])) || null;
          }
          return rows[0] || null;
        },
        run() { return { changes: 0 }; }
      };
    }

    if (/^INSERT/i.test(trimmed)) {
      const match = trimmed.match(/INTO\\s+([a-zA-Z0-9_]+)\\s*\\(([^)]+)\\)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      const cols = match ? match[2].split(',').map(c => c.trim()) : [];
      return {
        run(...args) {
          if (!self.store[table]) self.store[table] = [];
          const rows = self.store[table];
          const nextId = rows.length > 0 ? Math.max(...rows.map(r => Number(r.id) || 0)) + 1 : 1;
          const newRow = { id: nextId };
          cols.forEach((col, idx) => {
            newRow[col] = args[idx] !== undefined ? args[idx] : null;
          });
          newRow.created_at = newRow.created_at || new Date().toISOString();
          rows.push(newRow);
          self._persist();
          return { lastInsertRowid: nextId, changes: 1 };
        },
        all() { return []; },
        get() { return null; }
      };
    }

    if (/^UPDATE/i.test(trimmed)) {
      const match = trimmed.match(/UPDATE\\s+([a-zA-Z0-9_]+)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      return {
        run(...args) {
          const rows = self.store[table] || [];
          const id = Number(args[args.length - 1]);
          const row = rows.find(r => Number(r.id) === id);
          if (row) {
            const setMatches = [...trimmed.matchAll(/([a-zA-Z0-9_]+)\\s*=\\s*\\?/gi)];
            setMatches.forEach((m, idx) => {
              if (idx < args.length - 1) {
                row[m[1]] = args[idx];
              }
            });
            self._persist();
            return { changes: 1 };
          }
          return { changes: 0 };
        },
        all() { return []; },
        get() { return null; }
      };
    }

    if (/^DELETE/i.test(trimmed)) {
      const match = trimmed.match(/FROM\\s+([a-zA-Z0-9_]+)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      return {
        run(...args) {
          if (!self.store[table]) return { changes: 0 };
          if (/WHERE\\s+id\\s*=\\s*\\?/i.test(trimmed) && args.length > 0) {
            const id = Number(args[0]);
            self.store[table] = self.store[table].filter(r => Number(r.id) !== id);
          } else if (/WHERE\\s+completed\\s*=\\s*1/i.test(trimmed)) {
            self.store[table] = self.store[table].filter(r => !r.completed);
          }
          self._persist();
          return { changes: 1 };
        },
        all() { return []; },
        get() { return null; }
      };
    }

    return {
      run() { return { changes: 0 }; },
      all() { return []; },
      get() { return null; }
    };
  }
}
`.trim();

/**
 * Writes virtual files to disk inside the sandbox and ensures standard configuration files
 */
export async function writeFilesToSandbox(
    sandbox: Sandbox,
    fileData: FileData,
    baseDir = "/home/user/app"
): Promise<{ stack: "python" | "react-node" }> {
    const rawFiles = fileData.files ?? {};
    const stack = detectStack(rawFiles);

    // Normalize paths and store unique file contents
    const normalizedFiles: Record<string, string> = {};
    for (const [rawPath, fileObj] of Object.entries(rawFiles)) {
        const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
        normalizedFiles[cleanPath] = fileObj?.code ?? "";
    }

    if (stack === "react-node") {
        // App.jsx dual compatibility (root App.jsx and src/App.jsx)
        if (normalizedFiles["App.jsx"] && !normalizedFiles["src/App.jsx"]) {
            normalizedFiles["src/App.jsx"] = normalizedFiles["App.jsx"];
        } else if (normalizedFiles["src/App.jsx"] && !normalizedFiles["App.jsx"]) {
            normalizedFiles["App.jsx"] = normalizedFiles["src/App.jsx"];
        }

        // Strictly enforce allowedHosts: true, polling, and HMR in vite.config
        let hasViteConfig = false;
        for (const [key, code] of Object.entries(normalizedFiles)) {
            if (key === "vite.config.js" || key === "vite.config.ts" || key === "vite.config.mjs") {
                hasViteConfig = true;
                if (
                    !code.includes("allowedHosts: true") ||
                    !code.includes("usePolling") ||
                    !code.includes("clientPort: 443")
                ) {
                    normalizedFiles[key] = STANDARD_VITE_CONFIG;
                }
            }
        }
        if (!hasViteConfig) {
            normalizedFiles["vite.config.js"] = STANDARD_VITE_CONFIG;
        }

        // Ensure index.html exists and has the Zephyre Error Bridge attached
        let indexHtml = normalizedFiles["index.html"] || normalizedFiles["public/index.html"];
        if (!indexHtml) {
            indexHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${fileData.title || "Zephyre App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${ZEPHYRE_ERROR_BRIDGE_SCRIPT}
  </head>
  <body class="bg-black text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`.trim();
            normalizedFiles["index.html"] = indexHtml;
        } else if (!indexHtml.includes("zephyre-error-bridge")) {
            if (indexHtml.includes("</head>")) {
                indexHtml = indexHtml.replace("</head>", `${ZEPHYRE_ERROR_BRIDGE_SCRIPT}\n</head>`);
            } else {
                indexHtml = `${ZEPHYRE_ERROR_BRIDGE_SCRIPT}\n${indexHtml}`;
            }
            normalizedFiles["index.html"] = indexHtml;
        }

        // Ensure main.jsx entry point exists and attaches HMR compilation error reporting
        const mainJsx = normalizedFiles["src/main.jsx"] || normalizedFiles["main.jsx"];
        if (!mainJsx) {
            normalizedFiles["src/main.jsx"] = `
import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

${ZEPHYRE_HMR_REPORTER_CODE}

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`.trim();
        } else if (!mainJsx.includes("zephyre-preview-error")) {
            normalizedFiles["src/main.jsx"] = `${ZEPHYRE_HMR_REPORTER_CODE}\n\n${mainJsx}`;
        }

        // Ensure package.json exists and is normalized
        const rawPkgCode = normalizedFiles["package.json"];
        const hasServerJs = Boolean(normalizedFiles["server.js"]);
        const backendDeps: Record<string, string> = hasServerJs
            ? { express: "^4.21.2", cors: "^2.8.5" }
            : {};
        const devScript = hasServerJs
            ? "node server.js & vite --host 0.0.0.0 --port 3000"
            : "vite --host 0.0.0.0 --port 3000";

        let packageJson: {
            name?: string;
            version?: string;
            type?: string;
            scripts?: Record<string, string>;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        } | null = null;

        if (rawPkgCode) {
            try {
                packageJson = JSON.parse(rawPkgCode);
            } catch {
                packageJson = null;
            }
        }

        const userDeps = fileData.dependencies ?? {};
        if (!packageJson) {
            packageJson = {
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
                    ...userDeps,
                },
                devDependencies: {
                    "@vitejs/plugin-react": "^4.3.4",
                    vite: "^6.0.0",
                },
            };
        } else {
            packageJson.type = "module";
            packageJson.scripts = packageJson.scripts || {};
            packageJson.scripts.dev = devScript;
            packageJson.dependencies = {
                react: "^19.0.0",
                "react-dom": "^19.0.0",
                "lucide-react": "^1.16.0",
                clsx: "^2.1.1",
                "tailwind-merge": "^3.0.0",
                ...backendDeps,
                ...(packageJson.dependencies || {}),
                ...userDeps,
            };
            packageJson.devDependencies = {
                "@vitejs/plugin-react": "^4.3.4",
                vite: "^6.0.0",
                ...(packageJson.devDependencies || {}),
            };
        }

        normalizedFiles["package.json"] = JSON.stringify(packageJson, null, 2);

        // Provide sqlite-shim.js and sanitize node:sqlite imports for Node 20 runtime compatibility
        if (normalizedFiles["server.js"]) {
            normalizedFiles["sqlite-shim.js"] = SQLITE_SHIM_CODE;
            if (normalizedFiles["server.js"].includes("node:sqlite")) {
                normalizedFiles["server.js"] = normalizedFiles["server.js"].replace(/['"]node:sqlite['"]/g, "'./sqlite-shim.js'");
            }
        }
    }

    // Ensure working directory exists and any standard directories
    await sandbox.commands.run(`mkdir -p ${baseDir}/src ${baseDir}/components ${baseDir}/public`);

    // Create subdirectories for nested files in a single batched command
    const dirs = new Set<string>();
    for (const cleanPath of Object.keys(normalizedFiles)) {
        const lastSlash = cleanPath.lastIndexOf("/");
        if (lastSlash !== -1) {
            dirs.add(`${baseDir}/${cleanPath.slice(0, lastSlash)}`);
        }
    }
    if (dirs.size > 0) {
        const dirList = Array.from(dirs).map((d) => `"${d}"`).join(" ");
        await sandbox.commands.run(`mkdir -p ${dirList}`);
    }

    // Write all normalized files exactly once (zero race conditions)
    const writePromises = Object.entries(normalizedFiles).map(([cleanPath, code]) =>
        sandbox.files.write(`${baseDir}/${cleanPath}`, code)
    );
    await Promise.all(writePromises);

    // Cross-mirror components between root /components and /src/components so all relative imports resolve
    if (stack === "react-node") {
        await sandbox.commands.run(`mkdir -p ${baseDir}/components ${baseDir}/src/components`);
        await sandbox.commands.run(
            `if [ -d ${baseDir}/components ]; then cp -rn ${baseDir}/components/* ${baseDir}/src/components/ 2>/dev/null || true; fi`
        );
        await sandbox.commands.run(
            `if [ -d ${baseDir}/src/components ]; then cp -rn ${baseDir}/src/components/* ${baseDir}/components/ 2>/dev/null || true; fi`
        );
    }

    return { stack };
}

/**
 * Boots the dev server or application in the background, waits for port readiness,
 * and returns the live preview URL along with traffic token details
 */
export async function startSandboxApp(
    sandbox: Sandbox,
    stack: "python" | "react-node",
    baseDir = "/home/user/app"
): Promise<{ previewUrl: string; trafficAccessToken?: string; isPublic: boolean }> {
    if (stack === "python") {
        // Install requirements if present
        await sandbox.commands.run(`cd ${baseDir} && if [ -f requirements.txt ]; then pip install -r requirements.txt; fi`);
        // Start FastAPI / Flask / Python script with log redirection
        await sandbox.commands.run(
            `cd ${baseDir} && if [ -f main.py ]; then python3 main.py > /tmp/app.log 2>&1; elif [ -f app.py ]; then python3 app.py > /tmp/app.log 2>&1; fi`,
            { background: true }
        );
    } else {
        // Install dependencies with legacy peer deps and safe fallback
        await sandbox.commands.run(
            `cd ${baseDir} && (npm install --silent --no-audit --no-fund --legacy-peer-deps || npm install --silent --no-audit --no-fund --force || true)`
        );
        // Ensure port 3001 is clean and start Node/Express backend if server.js exists
        await sandbox.commands.run(
            `cd ${baseDir} && (fuser -k 3001/tcp 2>/dev/null || true); if [ -f server.js ]; then (nohup node server.js > /tmp/backend.log 2>&1 &); fi`
        );
        // Start Vite dev server in background with log redirection for diagnosis
        await sandbox.commands.run(`cd ${baseDir} && npm run dev > /tmp/dev-server.log 2>&1`, { background: true });
    }

    // Wait up to 20 seconds for the dev server to start responding on port 3000
    try {
        await sandbox.commands.run(
            `for i in $(seq 1 60); do if curl -s -f http://127.0.0.1:3000/ > /dev/null 2>&1 || curl -s -f http://localhost:3000/ > /dev/null 2>&1; then exit 0; fi; sleep 0.25; done; exit 0`,
            { timeoutMs: 22000 }
        );
    } catch {
        // Dev server startup verification timed out; preview URL will still be returned
    }

    // Port 3000 is the standard preview port
    const host = sandbox.getHost(3000);
    const trafficAccessToken = sandbox.trafficAccessToken;
    return {
        previewUrl: `https://${host}`,
        trafficAccessToken,
        isPublic: !trafficAccessToken,
    };
}
