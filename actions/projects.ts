"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { checkUser } from "@/lib/checkUser";
import type { ProjectSummary } from "@/types/project";

export type { ProjectSummary } from "@/types/project";

// ─── Get all workspaces for the current user ──────────────────────────────────

export async function getUserProjects(): Promise<ProjectSummary[]> {
    const { userId: clerkId } = await auth();
    if (!clerkId) redirect("/");

    let userWithWorkspaces = await db.user.findUnique({
        where: { clerkId },
        select: {
            workspaces: {
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    updatedAt: true,
                    messages: true,
                },
                orderBy: { updatedAt: "desc" },
            },
        },
    });

    if (!userWithWorkspaces) {
        // User record may not exist yet in DB; auto-provision
        await checkUser();
        userWithWorkspaces = await db.user.findUnique({
            where: { clerkId },
            select: {
                workspaces: {
                    select: {
                        id: true,
                        title: true,
                        createdAt: true,
                        updatedAt: true,
                        messages: true,
                    },
                    orderBy: { updatedAt: "desc" },
                },
            },
        });
    }

    // Return empty array if user has no workspaces (renders EmptyState component cleanly)
    if (!userWithWorkspaces?.workspaces) return [];

    const workspaces = userWithWorkspaces.workspaces;

    return workspaces.map((w) => {
        const msgs = Array.isArray(w.messages) ? w.messages : [];
        const firstUserMsg = msgs.find(
            (m): m is { role: string; content: string } =>
                typeof m === "object" &&
                m !== null &&
                (m as Record<string, unknown>).role === "user"
        );

        return {
            id: w.id,
            title: w.title,
            firstPrompt: firstUserMsg?.content?.slice(0, 120) ?? null,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
            messageCount: Array.isArray(w.messages) ? w.messages.length : 0,
        };
    });
}

// ─── Delete a workspace ───────────────────────────────────────────────────────

export async function deleteProject(workspaceId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return { success: false, error: "Unauthorized" };
        }

        let user = await db.user.findUnique({
            where: { clerkId },
            select: { id: true },
        });
        if (!user) {
            const synced = await checkUser();
            if (synced) user = { id: synced.id };
        }
        if (!user) {
            return { success: false, error: "User account not found" };
        }

        const deleteOp = await db.workspace.deleteMany({
            where: { id: workspaceId, userId: user.id },
        });

        if (deleteOp.count === 0) {
            return { success: false, error: "Project not found or already deleted" };
        }

        revalidatePath("/projects");
        return { success: true };
    } catch (err: unknown) {
        console.error("[deleteProject Error]:", err);
        const msg = err instanceof Error ? err.message : "Failed to delete project";
        return { success: false, error: msg };
    }
}
