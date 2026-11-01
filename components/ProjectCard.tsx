"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Trash2, MessageSquare, ArrowUpRight, Loader2, Zap, Sparkles } from "lucide-react";
import { ProjectSummary } from "@/actions/projects";
import { DeleteProjectModal } from "@/components/DeleteProjectModal";

interface ProjectCardProps {
    projects: ProjectSummary[];
}

export function ProjectCard({ projects }: ProjectCardProps) {
    const [projectList, setProjectList] = useState<ProjectSummary[]>(projects);
    const [navigatingId, setNavigatingId] = useState<string | null>(null);

    useEffect(() => {
        setProjectList(projects);
    }, [projects]);

    const handleDeleted = (id: string) => {
        setProjectList((prev) => prev.filter((p) => p.id !== id));
    };

    if (projectList.length === 0) {
        return (
            <div className="relative flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl border border-orange-500/25 bg-[#07070a]/90 backdrop-blur-xl shadow-2xl overflow-hidden my-6">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-orange-600/20 blur-[100px] pointer-events-none" />
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-linear-to-br from-amber-500/20 via-orange-500/20 to-red-500/20 text-orange-300 shadow-xl shadow-orange-500/20">
                    <Zap className="h-8 w-8 text-orange-300 animate-pulse" />
                </div>
                <h3 className="mb-2 text-xl font-extrabold text-white tracking-tight">No projects created yet</h3>
                <p className="mb-8 max-w-sm text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
                    Describe your business idea or website concept on the home page and let AI generate a full app for you.
                </p>
                <Link
                    href="/"
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-amber-500 via-orange-500 to-red-500 px-6 text-xs font-extrabold text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                    <Sparkles className="h-4 w-4 text-white" />
                    Start Building with AI
                </Link>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projectList.map((project) => {
                const title = project.title ?? "Untitled project";
                const timeAgo = project.updatedAt
                    ? formatDistanceToNow(new Date(project.updatedAt), {
                        addSuffix: true,
                    })
                    : "";
                const msgCount = Math.floor(project.messageCount / 2);
                const isNavigating = navigatingId === project.id;

                return (
                    <div
                        key={project.id}
                        className={`group relative flex flex-col rounded-2xl border border-white/10 bg-[#08080c]/90 p-5 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-orange-500/60 hover:shadow-[0_15px_40px_rgba(249,115,22,0.2)] hover:-translate-y-1 justify-between min-h-47.5 ${
                            isNavigating ? "border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.3)] bg-orange-950/20" : ""
                        }`}
                    >
                        {/* Background Card Click Target */}
                        <Link
                            href={`/workspace?id=${project.id}`}
                            prefetch={true}
                            onClick={() => setNavigatingId(project.id)}
                            className="absolute inset-0 rounded-2xl z-0 cursor-pointer"
                            aria-label={`Open ${title}`}
                        />

                        {/* Top Row: Title + Delete Trigger */}
                        <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
                            <Link
                                href={`/workspace?id=${project.id}`}
                                prefetch={true}
                                onClick={() => setNavigatingId(project.id)}
                                className="flex items-center gap-2 group/title cursor-pointer min-w-0"
                            >
                                <h3 className="line-clamp-1 text-base font-extrabold text-white group-hover/title:text-orange-300 transition-colors">
                                    {title}
                                </h3>
                                {isNavigating ? (
                                    <Loader2 className="h-4 w-4 text-orange-400 animate-spin shrink-0" />
                                ) : (
                                    <ArrowUpRight className="h-4 w-4 text-zinc-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-400 transition-all -translate-x-1 group-hover:translate-x-0 shrink-0" />
                                )}
                            </Link>

                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                                className="relative z-20 shrink-0"
                            >
                                <DeleteProjectModal project={project} onDeleted={handleDeleted}>
                                    <button
                                        type="button"
                                        title="Delete project"
                                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </DeleteProjectModal>
                            </div>
                        </div>

                        {/* First prompt preview */}
                        {project.firstPrompt && (
                            <div className="relative z-0 mb-4 rounded-xl border border-white/5 bg-white/3 p-3 text-xs leading-relaxed text-zinc-400 line-clamp-2 font-normal pointer-events-none">
                                {project.firstPrompt}
                            </div>
                        )}

                        {/* Meta footer */}
                        <div className="relative z-0 mt-auto flex items-center justify-between pt-3 border-t border-white/10 pointer-events-none">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-300 bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 rounded-full">
                                <MessageSquare className="h-3 w-3 text-orange-400" />
                                {msgCount} message{msgCount !== 1 ? "s" : ""}
                            </span>
                            <span suppressHydrationWarning className="text-[11px] font-medium text-zinc-500">
                                {timeAgo}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
