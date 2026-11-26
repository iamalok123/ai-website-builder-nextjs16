import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
    createE2bSandbox,
    connectE2bSandbox,
    killE2bSandbox,
    verifySandboxOwnership,
    writeFilesToSandbox,
    startSandboxApp,
    E2B_SANDBOX_TIMEOUT_MS,
    STANDARD_VITE_CONFIG,
    normalizeClientApiUrls,
    prepareBackendServerFiles,
    buildBackendSupervisorCommand,
    buildViteSupervisorCommand,
} from "@/lib/e2b";
import { sanitizeSandboxPath } from "@/lib/security";
import type { FileData } from "@/types/workspace";

export const dynamic = "force-dynamic";

async function ensureOwnedSandbox(
    sandboxId: string,
    ownerId: string,
    expiredMessage = "Sandbox is not running or has expired. Please re-boot."
): Promise<{ expired: boolean; errorResponse?: NextResponse }> {
    const access = await verifySandboxOwnership(sandboxId, ownerId);
    if (access === "forbidden") {
        return {
            expired: false,
            errorResponse: NextResponse.json(
                { error: "Forbidden: you do not own this sandbox" },
                { status: 403 }
            ),
        };
    }
    if (access === "not_found") {
        return {
            expired: true,
            errorResponse: NextResponse.json(
                { error: expiredMessage, code: "SANDBOX_EXPIRED" },
                { status: 404 }
            ),
        };
    }
    return { expired: false };
}

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

            // Clean up previous sandbox only if owned by the requesting user
            const oldId = previousSandboxId || sandboxId;
            if (oldId) {
                const access = await ensureOwnedSandbox(oldId, userId);
                if (!access.expired && access.errorResponse) {
                    return access.errorResponse;
                }
                if (!access.expired) {
                    try {
                        await killE2bSandbox(oldId);
                    } catch {
                        // Silently proceed if prior sandbox already expired or was deleted
                    }
                }
            }

            // Create new microVM sandbox bound to the requesting user
            const sandbox = await createE2bSandbox(E2B_SANDBOX_TIMEOUT_MS, userId);
            
            // Write project files to the container filesystem
            const { stack } = await writeFilesToSandbox(sandbox, fileData);

            // Start dev server and get exposed public URL
            const { previewUrl, trafficAccessToken, isPublic } = await startSandboxApp(sandbox, stack);

            const response = NextResponse.json({
                success: true,
                sandboxId: sandbox.sandboxId,
                previewUrl,
                isPublic,
                stack,
            });

            if (!isPublic && trafficAccessToken) {
                response.cookies.set(`zephyre_e2b_${sandbox.sandboxId}`, trafficAccessToken, {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    path: "/api/sandbox/proxy",
                    maxAge: 3600,
                });
            }

            return response;
        }

        if (action === "sync") {
            if (!sandboxId) {
                return NextResponse.json({ error: "sandboxId is required to sync" }, { status: 400 });
            }

            const filesToSync = changedFiles || fileData?.files;
            if (!filesToSync || Object.keys(filesToSync).length === 0) {
                return NextResponse.json({ success: true, message: "Nothing to sync" });
            }

            const ownership = await ensureOwnedSandbox(sandboxId, userId);
            if (ownership.errorResponse) {
                return ownership.errorResponse;
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
            let serverIsCjs = false;

            for (const [rawPath, fileObj] of Object.entries(filesToSync)) {
                let cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
                if (cleanPath === "App.jsx" || cleanPath === "App.js") cleanPath = "src/App.jsx";
                else if (cleanPath.startsWith("components/")) cleanPath = `src/${cleanPath}`;

                let codeToWrite = fileObj?.code ?? "";
                if (cleanPath.endsWith(".jsx") || cleanPath.endsWith(".tsx") || cleanPath.endsWith(".js") || cleanPath.endsWith(".ts")) {
                    codeToWrite = codeToWrite.replace(/\\\s*(\/?>)/g, " $1");
                    if (cleanPath.startsWith("src/")) {
                        codeToWrite = normalizeClientApiUrls(codeToWrite);
                    }
                }

                if (cleanPath.startsWith("vite.config")) {
                    if (
                        !codeToWrite.includes("allowedHosts: true") ||
                        !codeToWrite.includes("usePolling") ||
                        !codeToWrite.includes("database.json")
                    ) {
                        codeToWrite = STANDARD_VITE_CONFIG;
                    }
                }

                if (cleanPath === "server.js") {
                    hasServerJsChange = true;
                    const prepared = prepareBackendServerFiles(codeToWrite);
                    serverIsCjs = prepared.isCjs;
                    Object.assign(normalizedSync, prepared.files);
                } else {
                    if (cleanPath === "package.json") {
                        hasPackageJsonChange = true;
                    }
                    normalizedSync[cleanPath] = codeToWrite;
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
                const cleanupStaleCjs = serverIsCjs ? "" : `rm -f ${baseDir}/server.cjs; `;
                sandbox.commands.run(
                    `(fuser -k 3001/tcp 2>/dev/null || true); ${cleanupStaleCjs}${buildBackendSupervisorCommand(baseDir)}`,
                    { background: true }
                ).catch((err) => console.warn("[E2B Sandbox Sync] Backend restart warning:", err));
            }

            // Self-heal: ensure port 3000 is listening; if closed, restart Vite safely
            sandbox.commands.run(
                `if ! curl -s -f http://127.0.0.1:3000/ > /dev/null 2>&1; then
                    (fuser -k 3000/tcp 2>/dev/null || true);
                    touch /tmp/dev-server.log;
                    ${buildViteSupervisorCommand(baseDir)}
                fi`,
                { background: true }
            ).catch(() => {});

            return NextResponse.json({ success: true, syncedCount: promises.length });
        }

        if (action === "health" || action === "ping") {
            if (!sandboxId) {
                return NextResponse.json({ error: "sandboxId is required" }, { status: 400 });
            }

            const ownership = await ensureOwnedSandbox(
                sandboxId,
                userId,
                "Sandbox is not running or has expired."
            );
            if (ownership.errorResponse) {
                return ownership.errorResponse;
            }

            let sandbox;
            try {
                sandbox = await connectE2bSandbox(sandboxId);
                // Extend sandbox lifetime
                await sandbox.setTimeout(E2B_SANDBOX_TIMEOUT_MS).catch(() => {});
            } catch {
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
                        touch /tmp/dev-server.log;
                        ${buildViteSupervisorCommand(baseDir)}
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

            const ownership = await ensureOwnedSandbox(sandboxId, userId);
            if (!ownership.expired && ownership.errorResponse) {
                return ownership.errorResponse;
            }
            if (!ownership.expired) {
                await killE2bSandbox(sandboxId);
            }
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
