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
 * Creates an isolated E2B cloud sandbox instance with public web traffic enabled
 */
export async function createE2bSandbox(timeoutMs = E2B_SANDBOX_TIMEOUT_MS): Promise<Sandbox> {
    const apiKey = getE2bApiKey();
    return await Sandbox.create({
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
    });
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

        // Ensure index.html exists
        if (!normalizedFiles["index.html"] && !normalizedFiles["public/index.html"]) {
            normalizedFiles["index.html"] = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${fileData.title || "Zephyre App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-black text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`.trim();
        }

        // Ensure main.jsx entry point exists
        if (!normalizedFiles["src/main.jsx"] && !normalizedFiles["main.jsx"]) {
            normalizedFiles["src/main.jsx"] = `
import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`.trim();
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
        // Start Node/Express backend if server.js exists
        await sandbox.commands.run(
            `cd ${baseDir} && if [ -f server.js ]; then node server.js > /tmp/backend.log 2>&1 & fi`
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
