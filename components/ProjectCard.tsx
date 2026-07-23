"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Trash2, MessageSquare, ArrowUpRight, Loader2 } from "lucide-react";
import { ProjectSummary } from "@/actions/projects";
import { DeleteProjectModal } from "@/components/DeleteProjectModal";


interface ProjectCardProps {
    projects: ProjectSummary[];
}

export function ProjectCard({ projects }: ProjectCardProps) {
    const [navigatingId, setNavigatingId] = useState<string | null>(null);

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
                const title = project.title ?? "Untitled project";
                const timeAgo = formatDistanceToNow(new Date(project.updatedAt), {
                    addSuffix: true,
                });
                const msgCount = Math.floor(project.messageCount / 2);
                const isNavigating = navigatingId === project.id;

                return (
                    <div
                        key={project.id}
                        className={`group relative flex flex-col rounded-2xl border border-white/10 bg-[#0a0b14]/90 p-5 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-purple-500/60 hover:shadow-[0_15px_40px_rgba(168,85,247,0.2)] hover:-translate-y-1 justify-between min-h-47.5 ${
                            isNavigating ? "border-purple-500/80 shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-purple-950/20" : ""
                        }`}
                    >
                        <Link
                            href={`/workspace?id=${project.id}`}
                            prefetch={true}
                            onClick={() => setNavigatingId(project.id)}
                            className="absolute inset-0 rounded-2xl z-10 cursor-pointer"
                            aria-label={`Open ${title}`}
                        />

                        {/* Top Row: Title + Delete */}
                        <div className="mb-3 flex items-start justify-between gap-3 pointer-events-none relative z-0">
                            <div className="flex items-center gap-2">
                                <h3 className="line-clamp-1 text-base font-extrabold text-white group-hover:text-purple-300 transition-colors">
                                    {title}
                                </h3>
                                {isNavigating ? (
                                    <Loader2 className="h-4 w-4 text-purple-400 animate-spin shrink-0" />
                                ) : (
                                    <ArrowUpRight className="h-4 w-4 text-zinc-500 opacity-0 group-hover:opacity-100 group-hover:text-purple-400 transition-all -translate-x-1 group-hover:translate-x-0 shrink-0" />
                                )}
                            </div>

                            <DeleteProjectModal project={project}>
                                <span
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative z-20 pointer-events-auto p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </span>
                            </DeleteProjectModal>
                        </div>

                        {/* First prompt preview */}
                        {project.firstPrompt && (
                            <div className="mb-4 rounded-xl border border-white/5 bg-white/3 p-3 text-xs leading-relaxed text-zinc-400 line-clamp-2 font-normal pointer-events-none relative z-0">
                                {project.firstPrompt}
                            </div>
                        )}

                        {/* Meta footer */}
                        <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/10 pointer-events-none relative z-0">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                                <MessageSquare className="h-3 w-3 text-purple-400" />
                                {msgCount} message{msgCount !== 1 ? "s" : ""}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-500">{timeAgo}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
