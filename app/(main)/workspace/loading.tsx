import { Zap, Loader2, Code2, Eye, Sparkles, MessageSquare } from "lucide-react";

export default function WorkspaceLoading() {
    return (
        <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#0a0a0a] text-white">
            {/* Ambient Background Spotlights */}
            <div className="fixed top-12 left-1/3 -translate-x-1/2 h-96 w-96 rounded-full bg-purple-600/10 blur-[140px] pointer-events-none" />
            <div className="fixed bottom-12 right-1/3 h-96 w-96 rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none" />

            {/* Left Column: Chat Panel Skeleton */}
            <div className="hidden md:flex w-[320px] shrink-0 flex-col border-r border-white/10 bg-[#07080c]/90 backdrop-blur-xl p-4 justify-between animate-pulse">
                <div className="space-y-4">
                    {/* Workspace Header Skeleton */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-purple-400" />
                            </div>
                            <div className="h-4 w-32 rounded bg-white/10" />
                        </div>
                        <div className="h-4 w-12 rounded-full bg-purple-500/20" />
                    </div>

                    {/* Chat Messages Skeleton */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-start gap-2.5">
                            <div className="h-6 w-6 rounded-full bg-purple-500/20 shrink-0" />
                            <div className="space-y-1.5 flex-1">
                                <div className="h-3 w-3/4 rounded bg-white/10" />
                                <div className="h-3 w-1/2 rounded bg-white/5" />
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5 pl-6">
                            <div className="space-y-1.5 flex-1 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="h-3 w-full rounded bg-white/10" />
                                <div className="h-3 w-5/6 rounded bg-white/10" />
                                <div className="h-3 w-2/3 rounded bg-white/5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Input Skeleton */}
                <div className="pt-3 border-t border-white/10">
                    <div className="h-12 w-full rounded-xl bg-white/5 border border-white/10" />
                </div>
            </div>

            {/* Right Column: Code / Preview Panel Skeleton */}
            <div className="flex-1 flex flex-col bg-[#07080c]/60 backdrop-blur-md">
                {/* Workspace Top Toolbar */}
                <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[#0a0b14]/80">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                            <Eye className="h-3.5 w-3.5" />
                            <span>Preview</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 text-zinc-500 text-xs font-medium">
                            <Code2 className="h-3.5 w-3.5" />
                            <span>Code</span>
                        </div>
                    </div>
                    <div className="h-7 w-24 rounded-lg bg-purple-500/20 animate-pulse" />
                </div>

                {/* Main Workspace Preview Loading Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                    <div className="relative flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-[#0a0b14]/90 backdrop-blur-xl shadow-2xl max-w-sm w-full text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-xl shadow-purple-500/20">
                            <Loader2 className="h-7 w-7 text-purple-400 animate-spin" />
                        </div>
                        <h3 className="text-lg font-extrabold text-white tracking-tight mb-1 flex items-center justify-center gap-2">
                            <span>Loading Workspace</span>
                            <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
                        </h3>
                        <p className="text-xs text-zinc-400 font-normal">
                            Fetching project files and preparing live preview environment...
                        </p>
                        <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-linear-to-r from-purple-500 via-indigo-500 to-purple-500 animate-pulse rounded-full w-2/3" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
