import WorkspaceClient from "@/components/WorkspaceClient";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface WorkspacePageProps {
    searchParams: Promise<{ prompt?: string; id?: string }>;
}

const WorkspacePage = async ({ searchParams }: WorkspacePageProps) => {
    const user = await auth()
    if(!user){
        redirect("/")
    }
    const { prompt, id } = await searchParams

    // const user = await getWorkspaceById() 

    // let workspace = null;
    // if (id) {
    //     workspace = await getWorkspaceById(id, user.id);
    // }


    return (
        <WorkspaceClient />
    )
}

export default WorkspacePage