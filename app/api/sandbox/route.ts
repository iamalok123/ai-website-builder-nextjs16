import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
    createE2bSandbox,
    connectE2bSandbox,
    killE2bSandbox,
    writeFilesToSandbox,
    startSandboxApp,
    ensureSandboxSwap,
    E2B_SANDBOX_TIMEOUT_MS,
    STANDARD_VITE_CONFIG,
    SQLITE_SHIM_CODE,
} from "@/lib/e2b";
import { sanitizeSandboxPath } from "@/lib/security";
import type { FileData } from "@/types/workspace";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { action, sandboxId, previousSandboxId, fileData, changedFiles } = body as {
            action: "start" | "sync" | "stop" | "health" | "ping";
            sandboxId?: string;
            previousSandboxId?: string;
            fileData?: FileData;
            changedFiles?: Record<string, { code: string }>;
        };

        if (action === "start") {
            if (!fileData || !fileData.files || Object.keys(fileData.files).length === 0) {
                return NextResponse.json(
                    { error: "fileData with files is required to start sandbox" },
                    { status: 400 }
                );
            }

            // Clean up previous sandbox if provided to prevent lingering containers
            const oldId = previousSandboxId || sandboxId;
            if (oldId) {
                try {
                    await killE2bSandbox(oldId);
                } catch {
                    // Silently proceed if prior sandbox already expired or was deleted
                }
            }

            // Create new microVM sandbox with explicit public network access
            const sandbox = await createE2bSandbox();
            
            // Write project files to the container filesystem
            const { stack } = await writeFilesToSandbox(sandbox, fileData);

            // Start dev server and get exposed public URL
            const { previewUrl, trafficAccessToken, isPublic } = await startSandboxApp(sandbox, stack);

            return NextResponse.json({
                success: true,
                sandboxId: sandbox.sandboxId,
                previewUrl,
                trafficAccessToken,
                isPublic,
                stack,
            });
        }

        if (action === "sync") {
            if (!sandboxId) {
                return NextResponse.json({ error: "sandboxId is required to sync" }, { status: 400 });
            }

            const filesToSync = changedFiles || fileData?.files;
            if (!filesToSync || Object.keys(filesToSync).length === 0) {
                return NextResponse.json({ success: true, message: "Nothing to sync" });
            }

            let sandbox;
            try {
                sandbox = await connectE2bSandbox(sandboxId);
                // Extend sandbox timeout during active editing session
                await sandbox.setTimeout(E2B_SANDBOX_TIMEOUT_MS).catch(() => {});
            } catch (connErr: unknown) {
                console.warn(`[E2B Sandbox Sync] Sandbox ${sandboxId} could not be connected:`, connErr);
                return NextResponse.json(
                    {
                        error: "Sandbox is not running or has expired. Please re-boot.",
                        code: "SANDBOX_EXPIRED",
                    },
                    { status: 404 }
                );
            }

            const baseDir = "/home/user/app";
            const normalizedSync: Record<string, string> = {};
            let hasPackageJsonChange = false;
            let hasServerJsChange = false;

            for (const [rawPath, fileObj] of Object.entries(filesToSync)) {
                const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
                let codeToWrite = fileObj?.code ?? "";
                if (cleanPath.endsWith(".jsx") || cleanPath.endsWith(".tsx") || cleanPath.endsWith(".js") || cleanPath.endsWith(".ts")) {
                    codeToWrite = codeToWrite.replace(/\\\s*(\/?>)/g, " $1");
                }

                if (cleanPath.startsWith("vite.config")) {
                    if (
                        !codeToWrite.includes("allowedHosts: true") ||
                        !codeToWrite.includes("usePolling")
                    ) {
                        codeToWrite = STANDARD_VITE_CONFIG;
                    }
                }

                normalizedSync[cleanPath] = codeToWrite;

                if (cleanPath === "App.jsx" || cleanPath === "src/App.jsx") {
                    normalizedSync["App.jsx"] = codeToWrite;
                    normalizedSync["src/App.jsx"] = codeToWrite;
                } else if (cleanPath.startsWith("components/")) {
                    normalizedSync[`src/${cleanPath}`] = codeToWrite;
                } else if (cleanPath.startsWith("src/components/")) {
                    normalizedSync[cleanPath.replace(/^src\//, "")] = codeToWrite;
                } else if (cleanPath === "package.json") {
                    hasPackageJsonChange = true;
                } else if (cleanPath === "server.js") {
                    hasServerJsChange = true;
                    if (codeToWrite.includes("node:sqlite")) {
                        codeToWrite = codeToWrite.replace(/['"]node:sqlite['"]/g, "'./sqlite-shim.js'");
                    }
                    // Guarantee server.js always listens on port 3001
                    codeToWrite = codeToWrite
                        .replace(/const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*\d+/g, "const PORT = process.env.BACKEND_PORT || 3001")
                        .replace(/const\s+PORT\s*=\s*3000\b/g, "const PORT = 3001")
                        .replace(/app\.listen\(\s*3000\s*,/g, "app.listen(3001,");
                    normalizedSync["server.js"] = codeToWrite;
                    normalizedSync["sqlite-shim.js"] = SQLITE_SHIM_CODE;
                }
            }

            // Ensure parent directories exist before writing
            const dirsToCreate = new Set<string>();
            const safeSyncFiles: Record<string, string> = {};

            for (const [cleanPath, code] of Object.entries(normalizedSync)) {
                const safePath = sanitizeSandboxPath(cleanPath);
                if (!safePath) continue;
                safeSyncFiles[safePath] = code;

                const lastSlash = safePath.lastIndexOf("/");
                if (lastSlash !== -1) {
                    dirsToCreate.add(`${baseDir}/${safePath.slice(0, lastSlash)}`);
                }
            }

            if (dirsToCreate.size > 0) {
                const dirList = Array.from(dirsToCreate).map((d) => `"${d}"`).join(" ");
                await sandbox.commands.run(`mkdir -p ${dirList}`);
            }

            const promises = Object.entries(safeSyncFiles).map(([safePath, code]) =>
                sandbox.files.write(`${baseDir}/${safePath}`, code)
            );

            await Promise.all(promises);

            if (hasPackageJsonChange) {
                sandbox.commands.run(
                    `cd ${baseDir} && (npm install --silent --no-audit --no-fund --legacy-peer-deps || true)`,
                    { background: true }
                ).catch((err) => console.warn("[E2B Sandbox Sync] Background npm install warning:", err));
            }

            if (hasServerJsChange) {
                sandbox.commands.run(
                    `cd ${baseDir} && (fuser -k 3001/tcp 2>/dev/null || true); if [ -f server.js ]; then (nohup bash -c 'while true; do env PORT=3001 BACKEND_PORT=3001 node server.js >> /tmp/backend.log 2>&1; sleep 1; done' > /dev/null 2>&1 &); fi`,
                    { background: true }
                ).catch((err) => console.warn("[E2B Sandbox Sync] Backend restart warning:", err));
            }

            // Self-heal: ensure port 3000 is listening; if closed, restart Vite safely
            sandbox.commands.run(
                `if ! curl -s -f http://127.0.0.1:3000/ > /dev/null 2>&1; then
                    (fuser -k 3000/tcp 2>/dev/null || true);
                    cd ${baseDir} && (nohup bash -c 'while true; do env NODE_OPTIONS="--max-old-space-size=384" (./node_modules/.bin/vite --host 0.0.0.0 --port 3000 || npx --yes vite --host 0.0.0.0 --port 3000) >> /tmp/dev-server.log 2>&1; sleep 1; done' > /dev/null 2>&1 &);
                fi`,
                { background: true }
            ).catch(() => {});

            return NextResponse.json({ success: true, syncedCount: promises.length });
        }

        if (action === "health" || action === "ping") {
            if (!sandboxId) {
                return NextResponse.json({ error: "sandboxId is required" }, { status: 400 });
            }

            let sandbox;
            try {
                sandbox = await connectE2bSandbox(sandboxId);
                // Extend sandbox lifetime
                await sandbox.setTimeout(E2B_SANDBOX_TIMEOUT_MS).catch(() => {});
            } catch (connErr: unknown) {
                return NextResponse.json(
                    { error: "Sandbox is not running or has expired.", code: "SANDBOX_EXPIRED" },
                    { status: 404 }
                );
            }

            // Verify if Vite is responding on port 3000. If dead, auto-restart
            const baseDir = "/home/user/app";
            try {
                const checkRes = await sandbox.commands.run(
                    `if ! curl -s -f http://127.0.0.1:3000/ > /dev/null 2>&1; then
                        (fuser -k 3000/tcp 2>/dev/null || true);
                        cd ${baseDir} && (nohup bash -c 'while true; do env NODE_OPTIONS="--max-old-space-size=384" (./node_modules/.bin/vite --host 0.0.0.0 --port 3000 || npx --yes vite --host 0.0.0.0 --port 3000) >> /tmp/dev-server.log 2>&1; sleep 1; done' > /dev/null 2>&1 &);
                        echo "restarted";
                    else
                        echo "alive";
                    fi`
                );
                const host = sandbox.getHost(3000);
                return NextResponse.json({
                    success: true,
                    healthy: true,
                    previewUrl: `https://${host}`,
                    status: checkRes.stdout.trim(),
                });
            } catch {
                return NextResponse.json({ success: true, healthy: false });
            }
        }

        if (action === "stop") {
            if (!sandboxId) {
                return NextResponse.json({ error: "sandboxId is required to stop" }, { status: 400 });
            }

            await killE2bSandbox(sandboxId);
            return NextResponse.json({ success: true, stopped: true });
        }

        return NextResponse.json({ error: "Invalid action. Expected start, sync, stop, or health" }, { status: 400 });
    } catch (error: unknown) {
        console.error("[E2B Sandbox API Error]:", error);
        const errObj = error as { result?: { stderr?: string; stdout?: string }; message?: string };
        const detailedMessage =
            errObj?.result?.stderr?.trim() ||
            errObj?.message ||
            "Internal sandbox error";
        return NextResponse.json({ error: detailedMessage }, { status: 500 });
    }
}
