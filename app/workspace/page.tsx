import { redirect } from "next/navigation";
import { WorkspaceClient } from "@/components/WorkspaceClient";
import { getWorkspaceUser, getWorkspaceById } from "@/actions/workspace";

interface WorkspacePageProps {
    searchParams: Promise<{ prompt?: string; id?: string }>;
}

export default async function WorkspacePage({
    searchParams,
}: WorkspacePageProps) {
    const { prompt, id } = await searchParams;

    const user = await getWorkspaceUser();
    const workspace = id ? await getWorkspaceById(id, user.id) : null;

    if (id && workspace && workspace.userId && workspace.userId !== user.id) {
        redirect("/");
    }

    return (
        <WorkspaceClient
            initialPrompt={prompt ?? null}
            workspace={workspace}
            userCredits={user.credits}
            userId={user.id}
            userPlan={user.plan}
        />
    );
}
