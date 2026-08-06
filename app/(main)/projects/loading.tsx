import { LayoutGrid, PlusCircle } from "lucide-react";

export default function ProjectsLoading() {
    return (
        <main className="min-h-screen bg-black text-white pt-16 sm:pt-20 pb-16 px-4 sm:px-6 lg:px-8 selection:bg-orange-500/30 selection:text-orange-200">
            {/* Ambient Spotlight Backgrounds */}
            <div className="fixed top-12 left-1/2 -translate-x-1/2 h-96 w-225 rounded-full bg-orange-600/15 blur-[140px] pointer-events-none" />
            <div className="fixed top-24 right-1/4 h-80 w-80 rounded-full bg-amber-500/15 blur-[110px] pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-6xl">
                {/* Header Skeleton */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-semibold text-orange-300 mb-3">
                            <LayoutGrid className="h-3.5 w-3.5 text-orange-400" />
                            Dashboard Workspace
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-linear-to-r from-white via-orange-100 to-amber-200 bg-clip-text text-transparent">
                            My Projects
                        </h1>
                        <p className="mt-2 text-xs sm:text-sm text-zinc-400 font-normal">
                            Loading...
                        </p>
                    </div>

                    <div className="h-11 w-36 rounded-xl bg-orange-500/20 border border-orange-500/20 animate-pulse" />
                </div>

                {/* Skeleton Cards Grid */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="relative flex flex-col rounded-2xl border border-white/10 bg-[#08080c]/90 p-5 backdrop-blur-xl shadow-xl justify-between min-h-47.5 animate-pulse"
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="h-5 w-40 rounded-md bg-white/10" />
                                <div className="h-4 w-4 rounded-md bg-white/5" />
                            </div>
                            <div className="mb-4 rounded-xl border border-white/5 bg-white/3 p-3 space-y-2">
                                <div className="h-3 w-full rounded bg-white/10" />
                                <div className="h-3 w-3/4 rounded bg-white/5" />
                            </div>

                            <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/10">
                                <div className="h-4 w-20 rounded-full bg-orange-500/20" />
                                <div className="h-3 w-16 rounded bg-white/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
