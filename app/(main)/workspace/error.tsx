"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw, LayoutGrid, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function WorkspaceError({ error, reset }: WorkspaceErrorProps) {
    useEffect(() => {
        // Log the error to diagnostics / console
        console.error("Workspace error caught by boundary:", error);
    }, [error]);

    return (
        <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center p-4 sm:p-6 bg-black text-white selection:bg-orange-500/30 selection:text-orange-200">
            {/* Ambient Background Glow */}
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-orange-600/15 blur-[120px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#09090e]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl text-center">
                {/* Warning Icon Badge */}
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-400 shadow-lg shadow-orange-500/10">
                    <AlertTriangle className="h-7 w-7" />
                </div>

                {/* Title & Description */}
                <h2 className="mb-2 text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    Workspace encountered an issue
                </h2>
                <p className="mb-6 text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
                    An unexpected error occurred while loading or rendering the workspace preview. Your project files and messages are saved.
                </p>

                {/* Optional error snippet if available */}
                {error?.message && (
                    <div className="mb-6 max-h-24 overflow-y-auto rounded-xl border border-white/5 bg-white/4 p-3 text-left font-mono text-[11px] text-zinc-400 leading-relaxed scrollbar-none">
                        {error.message}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2.5">
                    <Button
                        onClick={() => reset()}
                        className="h-10 w-full rounded-xl font-bold bg-linear-to-r from-amber-500 via-orange-500 to-red-500 hover:brightness-110 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border-0"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Try again
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={() => window.location.reload()}
                        className="h-10 w-full rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 border border-white/10 bg-white/5 cursor-pointer"
                    >
                        Reload full page
                    </Button>

                    <div className="mt-2 flex items-center justify-center gap-4 text-xs font-medium text-zinc-500">
                        <Link
                            href="/projects"
                            className="inline-flex items-center gap-1.5 hover:text-orange-400 transition-colors"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            My Projects
                        </Link>
                        <span>•</span>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 hover:text-orange-400 transition-colors"
                        >
                            <Home className="h-3.5 w-3.5" />
                            Return Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
