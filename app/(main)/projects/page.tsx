import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Zap, Sparkles, LayoutGrid } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import Link from "next/link";
import { getUserProjects } from "@/actions/projects";
import { Button } from "@/components/ui/button";



// Empty state 
function EmptyState() {
    return (
        <div className="relative flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl border border-white/10 bg-[#0a0b14]/90 backdrop-blur-xl shadow-2xl overflow-hidden my-6">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-purple-600/15 blur-[90px] pointer-events-none" />
            
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-linear-to-br from-purple-500/20 via-indigo-500/20 to-pink-500/20 text-purple-300 shadow-xl shadow-purple-500/20">
                <Zap className="h-8 w-8 text-purple-300 animate-pulse" />
            </div>
            
            <h3 className="mb-2 text-xl font-extrabold text-white tracking-tight">No projects created yet</h3>
            <p className="mb-8 max-w-sm text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
                Describe your business idea or website concept on the home page and let AI generate a full app for you.
            </p>
            
            <Link
                href="/"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 via-purple-600 to-pink-600 px-6 text-xs font-extrabold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
                <Sparkles className="h-4 w-4 text-white" />
                Start Building with AI
            </Link>
        </div>
    );
}


// Page 
export default async function ProjectsPage() {
    const { userId } = await auth();
    if (!userId) redirect("/");

    const projects = await getUserProjects();

    return (
        <main className="min-h-screen bg-[#07080c] text-white pt-12 sm:pt-12 pb-16 px-4 sm:px-6 lg:px-8 selection:bg-purple-500/30 selection:text-purple-200">
            {/* Ambient Spotlight Backgrounds */}
            <div className="fixed top-12 left-1/2 -translate-x-1/2 h-96 w-225 rounded-full bg-purple-600/10 blur-[130px] pointer-events-none" />
            <div className="fixed top-24 right-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-6xl">
                
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-semibold text-purple-300 mb-3">
                            <LayoutGrid className="h-3.5 w-3.5 text-purple-400" />
                            Dashboard Workspace
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-linear-to-r from-white via-purple-100 to-zinc-300 bg-clip-text text-transparent">
                            My Projects
                        </h1>
                        <p className="mt-2 text-xs sm:text-sm text-zinc-400 font-normal">
                            All your AI-generated websites, sitemaps, and wireframes in one workspace
                        </p>
                    </div>

                    <Link href="/">
                        <Button className="h-11 rounded-xl px-5 font-bold bg-linear-to-r from-indigo-500 via-purple-600 to-pink-600 hover:brightness-110 text-white shadow-lg shadow-purple-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95">
                            <Zap className="h-4 w-4" />
                            New Project
                        </Button>
                    </Link>
                </div>

                {/* Grid */}
                {projects.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ProjectCard projects={projects} />
                )}
            </div>
        </main>
    );
}
