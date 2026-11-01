import { Sandbox } from "e2b";
import type { FileData } from "@/types/workspace";

export const E2B_SANDBOX_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes default idle timeout

export function getE2bApiKey(): string {
    const key = process.env.E2B_SANDBOX_API_KEY || process.env.E2B_API_KEY || "";
    if (!key) {
        throw new Error("Missing E2B_SANDBOX_API_KEY or E2B_API_KEY environment variable");
    }
    return key;
}

/**
 * Creates an isolated E2B cloud sandbox instance
 */
export async function createE2bSandbox(timeoutMs = E2B_SANDBOX_TIMEOUT_MS): Promise<Sandbox> {
    const apiKey = getE2bApiKey();
    return await Sandbox.create({
        apiKey,
        timeoutMs,
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

/**
 * Writes virtual files to disk inside the sandbox and ensures standard configuration files
 */
export async function writeFilesToSandbox(
    sandbox: Sandbox,
    fileData: FileData,
    baseDir = "/home/user/app"
): Promise<{ stack: "python" | "react-node" }> {
    const files = fileData.files ?? {};
    const stack = detectStack(files);

    // Ensure working directory exists
    await sandbox.commands.run(`mkdir -p ${baseDir}`);

    const writePromises: Promise<unknown>[] = [];

    // Write all project files
    for (const [rawPath, fileObj] of Object.entries(files)) {
        const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
        const targetPath = `${baseDir}/${cleanPath}`;
        writePromises.push(sandbox.files.write(targetPath, fileObj.code));
    }

    if (stack === "react-node") {
        // Ensure standard Vite + React config if not provided
        if (!files["/vite.config.js"] && !files["vite.config.js"]) {
            const viteConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
});
`;
            writePromises.push(sandbox.files.write(`${baseDir}/vite.config.js`, viteConfig));
        }

        // Ensure index.html exists
        if (!files["/index.html"] && !files["index.html"]) {
            const indexHtml = `
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
`;
            writePromises.push(sandbox.files.write(`${baseDir}/index.html`, indexHtml));
        }

        // Ensure main.jsx entry point exists
        if (!files["/src/main.jsx"] && !files["src/main.jsx"] && !files["/main.jsx"]) {
            const mainJsx = `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
            writePromises.push(sandbox.files.write(`${baseDir}/src/main.jsx`, mainJsx));
        }

        // Ensure package.json exists with all necessary dependencies
        if (!files["/package.json"] && !files["package.json"]) {
            const userDeps = fileData.dependencies ?? {};
            const packageJson = {
                name: "zephyre-app",
                version: "1.0.0",
                type: "module",
                scripts: {
                    dev: "vite --host 0.0.0.0 --port 3000",
                    build: "vite build",
                    start: "node server.js",
                },
                dependencies: {
                    react: "^19.0.0",
                    "react-dom": "^19.0.0",
                    "lucide-react": "^1.16.0",
                    "clsx": "^2.1.1",
                    "tailwind-merge": "^3.0.0",
                    ...userDeps,
                },
                devDependencies: {
                    "@vitejs/plugin-react": "^4.3.4",
                    vite: "^6.0.0",
                },
            };
            writePromises.push(
                sandbox.files.write(`${baseDir}/package.json`, JSON.stringify(packageJson, null, 2))
            );
        }
    }

    await Promise.all(writePromises);
    return { stack };
}

/**
 * Boots the dev server or application in the background and returns the public preview URL
 */
export async function startSandboxApp(
    sandbox: Sandbox,
    stack: "python" | "react-node",
    baseDir = "/home/user/app"
): Promise<{ previewUrl: string }> {
    if (stack === "python") {
        // Install requirements if present
        await sandbox.commands.run(`cd ${baseDir} && if [ -f requirements.txt ]; then pip install -r requirements.txt; fi`);
        // Start FastAPI / Flask / Python script
        await sandbox.commands.run(
            `cd ${baseDir} && if [ -f main.py ]; then python3 main.py; elif [ -f app.py ]; then python3 app.py; fi`,
            { background: true }
        );
    } else {
        // Install dependencies & start Vite dev server
        await sandbox.commands.run(`cd ${baseDir} && npm install --silent`);
        await sandbox.commands.run(`cd ${baseDir} && npm run dev`, { background: true });
    }

    // Port 3000 is the standard preview port
    const host = sandbox.getHost(3000);
    return {
        previewUrl: `https://${host}`,
    };
}
