import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
    createE2bSandbox,
    connectE2bSandbox,
    killE2bSandbox,
    writeFilesToSandbox,
    startSandboxApp,
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

            const sandbox = await connectE2bSandbox(sandboxId);
            const baseDir = "/home/user/app";

            const promises: Promise<unknown>[] = [];
            for (const [rawPath, fileObj] of Object.entries(filesToSync)) {
                const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
                let codeToWrite = fileObj.code;
                if (cleanPath.startsWith("vite.config") && !codeToWrite.includes("allowedHosts")) {
                    codeToWrite = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
});
`.trim();
                }
                promises.push(sandbox.files.write(`${baseDir}/${cleanPath}`, codeToWrite));
            }

            await Promise.all(promises);
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
