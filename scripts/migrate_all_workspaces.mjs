import pg from "pg";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const connectionString = dbUrlMatch[1];

function migrateWorkspaceFiles(files, title) {
    const updated = { ...files };

    // 1. Ensure App.jsx exists
    if (!updated["/App.jsx"] && updated["/App.js"]) {
        updated["/App.jsx"] = { code: updated["/App.js"].code };
    }
    updated["/App.js"] = { code: `import App from "./App.jsx";\nexport default App;\n` };

    // 2. Remove legacy CRA-specific files
    delete updated["/public/index.html"];
    delete updated["public/index.html"];

    // 3. Ensure root /index.html exists for Vite
    updated["/index.html"] = {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || "Zephyre App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-black text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
    };

    // 4. Ensure /src/main.jsx exists for Vite
    updated["/src/main.jsx"] = {
        code: `import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Live mount handshake for Zephyre IDE
if (typeof window !== 'undefined') {
  window.__zephyre_mounted = true;
  try {
    window.parent.postMessage({ source: 'zephyre-preview-mounted' }, '*');
    var initLoader = document.getElementById('zephyre-initial-loader');
    if (initLoader) initLoader.remove();
  } catch (e) {}
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}`
    };

    // 5. Ensure /vite.config.js exists with allowedHosts, polling, and HMR
    updated["/vite.config.js"] = {
        code: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      clientPort: 443,
    },
  },
});`
    };

    // 6. Clean and modernize /package.json
    let existingDeps = {};
    if (updated["/package.json"]?.code) {
        try {
            const parsed = JSON.parse(updated["/package.json"].code);
            existingDeps = parsed.dependencies || {};
            delete existingDeps["react-scripts"];
        } catch { }
    }

    updated["/package.json"] = {
        code: JSON.stringify({
            name: "zephyre-app",
            version: "1.0.0",
            type: "module",
            scripts: {
                dev: "vite --host 0.0.0.0 --port 3000",
                build: "vite build",
                preview: "vite preview"
            },
            dependencies: {
                react: "^19.0.0",
                "react-dom": "^19.0.0",
                "lucide-react": "^1.16.0",
                clsx: "^2.1.1",
                "tailwind-merge": "^3.0.0",
                ...existingDeps
            },
            devDependencies: {
                "@vitejs/plugin-react": "^4.3.4",
                vite: "^6.0.0"
            }
        }, null, 2)
    };

    return updated;
}

async function migrateAll() {
    const pool = new pg.Pool({ connectionString });
    try {
        const res = await pool.query('SELECT id, title, "fileData" FROM "Workspace";');
        console.log(`Starting migration of ${res.rows.length} workspaces to E2B format...`);

        for (const ws of res.rows) {
            if (!ws.fileData || !ws.fileData.files) {
                console.log(`Skipping [${ws.id}] "${ws.title}": no files found.`);
                continue;
            }

            const migratedFiles = migrateWorkspaceFiles(ws.fileData.files, ws.title);
            const updatedFileData = {
                ...ws.fileData,
                files: migratedFiles,
            };

            await pool.query('UPDATE "Workspace" SET "fileData" = $1, "updatedAt" = NOW() WHERE id = $2;', [
                JSON.stringify(updatedFileData),
                ws.id,
            ]);

            console.log(`✓ Migrated [${ws.id}] "${ws.title}" (${Object.keys(migratedFiles).length} files)`);
        }

        console.log("\nAll workspaces successfully upgraded to E2B format!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrateAll();
