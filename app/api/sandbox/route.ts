import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
    createE2bSandbox,
    connectE2bSandbox,
    killE2bSandbox,
    writeFilesToSandbox,
    startSandboxApp,
    STANDARD_VITE_CONFIG,
} from "@/lib/e2b";
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
            action: "start" | "sync" | "stop";
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

            for (const [rawPath, fileObj] of Object.entries(filesToSync)) {
                const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
                let codeToWrite = fileObj?.code ?? "";

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
                }
            }

            // Ensure parent directories exist before writing
            const dirsToCreate = new Set<string>();
            for (const cleanPath of Object.keys(normalizedSync)) {
                const lastSlash = cleanPath.lastIndexOf("/");
                if (lastSlash !== -1) {
                    dirsToCreate.add(`${baseDir}/${cleanPath.slice(0, lastSlash)}`);
                }
            }

            if (dirsToCreate.size > 0) {
                const dirList = Array.from(dirsToCreate).map((d) => `"${d}"`).join(" ");
                await sandbox.commands.run(`mkdir -p ${dirList}`);
            }

            const promises = Object.entries(normalizedSync).map(([cleanPath, code]) =>
                sandbox.files.write(`${baseDir}/${cleanPath}`, code)
            );

            await Promise.all(promises);

            if (hasPackageJsonChange) {
                sandbox.commands.run(
                    `cd ${baseDir} && (npm install --silent --no-audit --no-fund --legacy-peer-deps || true)`,
                    { background: true }
                ).catch((err) => console.warn("[E2B Sandbox Sync] Background npm install warning:", err));
            }

            return NextResponse.json({ success: true, syncedCount: promises.length });
        }

        if (action === "stop") {
            if (!sandboxId) {
                return NextResponse.json({ error: "sandboxId is required to stop" }, { status: 400 });
            }

            await killE2bSandbox(sandboxId);
            return NextResponse.json({ success: true, stopped: true });
        }

        return NextResponse.json({ error: "Invalid action. Expected start, sync, or stop" }, { status: 400 });
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
