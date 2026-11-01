"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteProject, ProjectSummary } from "@/actions/projects";

interface DeleteProjectModalProps {
    project: ProjectSummary;
    children: React.ReactNode;
    className?: string;
    title?: string;
    onDeleted?: (id: string) => void;
}

export function DeleteProjectModal({
    project,
    children,
    className,
    title,
    onDeleted,
}: DeleteProjectModalProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        startTransition(async () => {
            try {
                const res = await deleteProject(project.id);
                if (res?.success === false) {
                    toast.error(res.error || "Failed to delete project.");
                    return;
                }
                toast.success(`"${project.title ?? "Project"}" deleted successfully.`);
                setOpen(false);
                onDeleted?.(project.id);
                router.refresh();
            } catch (err) {
                console.error("[DeleteProjectModal Error]:", err);
                toast.error("Failed to delete project. Please try again.");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                title={title}
                className={cn(
                    "p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center justify-center",
                    className
                )}
                onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                }}
            >
                {children}
            </DialogTrigger>
            <DialogContent
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="border-white/10 bg-[#0e0e14] text-white sm:max-w-sm rounded-2xl shadow-2xl"
            >
                <DialogHeader>
                    <DialogTitle className="text-base font-bold text-white">
                        Delete Project?
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400 mt-1">
                        &ldquo;{project.title ?? "Untitled project"}&rdquo; will be
                        permanently deleted. This cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 mt-4">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                        }}
                        className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isPending}
                        className="h-8 rounded-xl bg-red-600 hover:bg-red-500 px-4 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                    >
                        {isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
