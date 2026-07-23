"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import type { WorkspaceUser, WorkspaceData, FileData } from "@/types/workspace";


export type { WorkspaceUser, WorkspaceData } from "@/types/workspace";





// ─── Get the current authenticated user ──────────────────────────────────────

export async function getWorkspaceUser(): Promise<WorkspaceUser> {
    const { userId: clerkId } = await auth();
    if (!clerkId) redirect("/");

    const user = await db.user.findUnique({
        where: { clerkId },
        select: { id: true, credits: true, plan: true },
    });

    if (!user) redirect("/");

    return user;
}





// ─── Get a workspace by id (must belong to the current user) ─────────────────

export async function getWorkspaceById(
    workspaceId: string,
    userId?: string
): Promise<WorkspaceData & { userId?: string }> {
    const workspace = await db.workspace.findUnique({
        where: userId ? { id: workspaceId, userId } : { id: workspaceId },
        select: {
            id: true,
            title: true,
            messages: true,
            fileData: true,
            userId: true,
        },
    });

    if (!workspace) redirect("/");

    return workspace;
}






// ─── Update workspace file data directly ──────────────────────────────────────

export async function updateWorkspaceFileData(
    workspaceId: string,
    userId: string,
    fileData: FileData
): Promise<void> {
    const { userId: clerkId } = await auth();
    if (!clerkId) return; // Must be authenticated

    // Verify the caller owns this workspace via their Clerk ID
    const user = await db.user.findUnique({
        where: { clerkId },
        select: { id: true },
    });
    if (!user || user.id !== userId) return;

    try {
        await db.workspace.update({
            where: { id: workspaceId, userId },
            data: { fileData: fileData as any },
        });
        revalidatePath("/projects");
    } catch (e) {
        console.error("Failed to update workspace file data:", e);
    }
}
