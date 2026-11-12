import Image from "next/image";
import {
    Code2,
    Download,
    Eye,
    Loader2,
    MessageSquare,
    PanelLeftClose,
    Plus,
    Square,
} from "lucide-react";
import { OrbitalRingLoader } from "@/components/OrbitalRingLoader";

export default function WorkspaceLoading() {
    return (
        <div className="relative flex h-screen max-h-dvh w-full overflow-hidden bg-[#0a0a0a] text-white">
            {/* Left Column: Monochrome Chat Panel Matching Workspace ChatPanel */}
            <div className="hidden md:flex md:w-87.5 lg:w-95 shrink-0 flex-col h-full min-h-0 bg-[#0d0d0d]">
                {/* Chat Header */}
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/6 px-3.5 sm:px-4">
                    <div className="h-4 w-32 rounded bg-white/15 animate-pulse" />
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <div className="h-6 w-20 rounded-full bg-white/6 animate-pulse" />
                        <div className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500">
                            <PanelLeftClose className="h-4 w-4" />
                        </div>
                    </div>
                </div>

                {/* Chat Messages Preview Skeleton */}
                <div className="flex-1 min-h-0 px-3 py-4 space-y-4 overflow-hidden">
                    {/* User Message Bubble Placeholder */}
                    <div className="flex items-start justify-end gap-2.5">
                        <div className="w-[78%] rounded-2xl rounded-br-sm bg-white/8 px-4 py-3 space-y-2 animate-pulse">
                            <div className="h-3 w-full rounded bg-white/15" />
                            <div className="h-3 w-5/6 rounded bg-white/10" />
                            <div className="h-3 w-2/3 rounded bg-white/10" />
                        </div>
                        <div className="h-7 w-7 rounded-full bg-white/12 shrink-0 animate-pulse" />
                    </div>

                    {/* Zephyre Assistant Thinking Pill */}
                    <div className="flex items-start gap-2.5">
                        <Image
                            src="/favicon.svg"
                            alt="Zephyre"
                            width={28}
                            height={28}
                            className="mt-0.5 h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 rounded-md"
                            priority
                        />
                        <div className="rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70 shrink-0" />
                                <span className="text-[13px] sm:text-sm text-white/85">
                                    Loading workspace...
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Chat Input Bar */}
                <div className="border-t border-white/6 p-3 sm:p-3.5 shrink-0 bg-[#0d0d0d]">
                    <div className="rounded-xl border border-white/8 bg-white/4">
                        <div className="px-4 pb-2.5 pt-3.5 text-sm sm:text-[15px] text-white/35 leading-relaxed">
                            Loading...
                        </div>
                        <div className="flex items-center justify-between px-2.5 pb-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-white/40">
                                <Plus className="h-4 w-4" />
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/12 text-white/70">
                                <Square className="h-3.5 w-3.5 fill-current" />
                            </div>
                        </div>
                    </div>
                    <p className="mt-2 text-center text-[11px] sm:text-xs text-white/25">
                        Preparing your project workspace…
                    </p>
                </div>
            </div>

            {/* Desktop Vertical Divider */}
            <div className="hidden md:block w-px shrink-0 bg-white/6" />

            {/* Right Column: Monochrome Preview / Code Panel */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-black">
                {/* Top Toolbar */}
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-[#121214] px-2 sm:px-4 gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <div className="h-8 gap-1 px-2 text-xs font-semibold text-zinc-500 flex items-center md:hidden">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Chat</span>
                        </div>
                        <div className="h-8 bg-black/40 p-0.5 border border-white/5 rounded-lg inline-flex items-center gap-0.5">
                            <div className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-2 sm:px-3 text-xs font-medium text-white">
                                <Eye className="h-3.5 w-3.5" />
                                <span>Preview</span>
                            </div>
                            <div className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 sm:px-3 text-xs font-medium text-zinc-500">
                                <Code2 className="h-3.5 w-3.5" />
                                <span>Code</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <div className="inline-flex h-8 items-center gap-1.5 px-2 sm:px-2.5 text-xs text-zinc-600">
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Export ZIP</span>
                        </div>
                    </div>
                </div>

                {/* Pure Black Center Canvas Matching "Generating Application..." Animation */}
                <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black text-center p-6">
                    <OrbitalRingLoader color="#ffffff" size={40} />
                    <div className="max-w-xs space-y-1">
                        <p className="text-sm font-semibold text-white">
                            Loading Workspace...
                        </p>
                        <p className="text-xs text-zinc-500">
                            Fetching project files and preparing preview...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
