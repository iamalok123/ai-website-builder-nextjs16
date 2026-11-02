"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useUser } from "@clerk/nextjs";
import {
    ArrowUp,
    Loader2,
    X,
    Sparkles,
    Wand2,
    Square,
    ExternalLink,
    PanelLeftClose,
    FileCode,
} from "lucide-react";
import { isDiagnosticPrompt, extractDiagnosticSummary } from "@/lib/error-fixer";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { PricingModal } from "@/components/PricingModal";
import type { Message, StatusStep, AttachedFile } from "@/types/workspace";
import {
    processFileAttachment,
    validateAttachment,
    formatFileSize,
    MAX_ATTACHMENTS_PER_REQUEST,
} from "@/lib/file-attachments";
import { AttachmentPlusMenu } from "@/components/AttachmentPlusMenu";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import { toast } from "sonner";



function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}




interface ChatPanelProps {
    messages: Message[];
    isGenerating: boolean;
    isImproving: boolean;
    statusLog: StatusStep[];
    credits: number;
    initialPrompt: string | null;
    onGenerate: (prompt: string, attachmentOrUrl?: AttachedFile[] | string) => Promise<void>;
    onStop: () => void;
    userId: string;
    workspaceId: string | null;
    appTitle: string | null;
    onToggleView: () => void;
    onToggleCollapse?: () => void;
}

export function ChatPanel({
    messages,
    isGenerating,
    isImproving,
    statusLog,
    credits,
    initialPrompt,
    onGenerate,
    onStop,
    userId,
    workspaceId,
    appTitle,
    onToggleView,
    onToggleCollapse,
}: ChatPanelProps) {
    const { user } = useUser();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [input, setInput] = useState("");
    const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const hasAutoSubmittedRef = useRef(false);
    const noCredits = credits <= 0;

    // The last message is the live-streaming assistant placeholder during improve
    const lastMsg = messages[messages.length - 1];
    const isStreamingAssistant = isImproving && lastMsg?.role === "assistant";

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 180) + "px";
    }, [input]);

    // Auto-scroll on new messages or streaming updates
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, [messages, isGenerating, isImproving]);

    useEffect(() => {
        if (hasAutoSubmittedRef.current || messages.length > 0)
            return;

        // Check if there are pending files and prompt passed from the home screen
        const pendingRaw = typeof window !== "undefined" ? sessionStorage.getItem("zephyre_pending_project") : null;
        if (pendingRaw) {
            try {
                const pending = JSON.parse(pendingRaw);
                sessionStorage.removeItem("zephyre_pending_project");
                if (pending.prompt) {
                    hasAutoSubmittedRef.current = true;
                    onGenerate(pending.prompt, pending.attachedFiles);
                    return;
                }
            } catch {}
        }

        if (initialPrompt) {
            hasAutoSubmittedRef.current = true;
            onGenerate(initialPrompt);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = async () => {
        const trimmed = input.trim();
        if (!trimmed || isGenerating || isImproving || noCredits) return;
        const toSend = [...pendingFiles];
        setInput("");
        setPendingFiles([]);
        await onGenerate(trimmed, toSend);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleFilesSelected = async (files: File[]) => {
        if (!files.length) return;

        if (pendingFiles.length + files.length > MAX_ATTACHMENTS_PER_REQUEST) {
            toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_REQUEST} files per prompt.`);
            return;
        }

        setIsUploading(true);
        const supabase = getSupabaseClient();

        for (const file of files) {
            const check = validateAttachment(file);
            if (!check.valid) {
                toast.error(check.error);
                continue;
            }

            try {
                const processed = await processFileAttachment(file, {
                    supabaseClient: supabase,
                    userId,
                    workspaceId: workspaceId ?? undefined,
                });
                setPendingFiles((prev) => [...prev, processed]);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to attach file";
                toast.error(message);
            }
        }

        setIsUploading(false);
    };

    const removePendingFile = (idx: number) => {
        setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const canSubmit = input.trim().length > 0 && !isGenerating && !isImproving && !noCredits;

    return (
        <div className="flex h-full w-full shrink-0 flex-col border-b border-white/6 bg-[#0d0d0d] md:border-b-0">
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/6 px-3.5 sm:px-4">
                <h2 className="font-semibold text-white tracking-tight truncate text-sm sm:text-[15px]">
                    {appTitle || "Zephyre Project"}
                </h2>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <PricingModal reason={noCredits ? "credits" : "upgrade"}>
                        <span
                            className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                                noCredits
                                    ? "bg-red-500/15 text-red-400/80 hover:bg-red-500/25"
                                    : "bg-white/6 text-white/40 hover:bg-white/10 hover:text-white/60"
                            )}
                        >
                            {noCredits
                                ? "No credits · Upgrade"
                                : `${credits} credit${credits !== 1 ? "s" : ""}`}
                        </span>
                    </PricingModal>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleView}
                        className="h-8 w-8 text-white/80 hover:bg-white/10 md:hidden"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                    {onToggleCollapse && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleCollapse}
                            title="Collapse Chat"
                            className="hidden md:flex h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg shrink-0 transition-colors"
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>


            {/* Messages */}
            <div
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto px-3 py-4 overscroll-contain [-webkit-overflow-scrolling:touch] no-scrollbar scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                {messages.length === 0 && !isGenerating && (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-center text-xs text-white/20">
                            Describe what you want to build…
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {messages.map((msg, i) => {
                        const isLast = i === messages.length - 1;
                        // This is the live-streaming assistant bubble during improve
                        const isLiveStream = isLast && isStreamingAssistant;

                        return (
                            <div key={i}>
                                {msg.role === "user" ?

                                    // User Chat Interface
                                    (
                                        <div className="flex items-start justify-end gap-2.5">
                                            <div className="max-w-[85%] space-y-1.5">
                                                {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-1.5 justify-end">
                                                        {msg.attachedFiles.map((file, idx) => (
                                                            file.base64 && (file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg|gif)$/i.test(file.name)) ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    key={idx}
                                                                    src={`data:${file.type};base64,${file.base64}`}
                                                                    alt={file.name}
                                                                    className="max-h-36 max-w-xs rounded-lg object-cover border border-white/10"
                                                                />
                                                            ) : file.url && file.type.startsWith("image/") ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    key={idx}
                                                                    src={file.url}
                                                                    alt={file.name}
                                                                    className="max-h-36 max-w-xs rounded-lg object-cover border border-white/10"
                                                                />
                                                            ) : (
                                                                <div
                                                                    key={idx}
                                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs text-white/90 font-mono"
                                                                >
                                                                    <FileCode className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                                                    <span className="truncate max-w-35">{file.name}</span>
                                                                    <span className="text-[10px] text-white/40">({formatFileSize(file.size)})</span>
                                                                </div>
                                                            )
                                                        ))}
                                                    </div>
                                                )}
                                                {!msg.attachedFiles?.length && msg.imageUrl && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={msg.imageUrl}
                                                        alt="uploaded"
                                                        className="max-h-40 w-full rounded-lg object-cover"
                                                    />
                                                )}
                                                {isDiagnosticPrompt(msg.content) ? (() => {
                                                    const summary = extractDiagnosticSummary(msg.content);
                                                    return (
                                                        <div className="rounded-2xl rounded-br-sm border border-rose-500/30 bg-linear-to-r from-rose-950/40 to-[#180a0e] p-3.5 sm:p-4 text-left shadow-lg">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/20 text-rose-400">
                                                                    <Wand2 className="h-3 w-3" />
                                                                </span>
                                                                <span className="text-xs font-semibold text-rose-300">
                                                                    {msg.displayContent || summary.title}
                                                                </span>
                                                            </div>
                                                            <p className="text-[13px] font-mono text-rose-200/90 truncate">
                                                                {summary.message}
                                                            </p>
                                                            <div className="mt-2 flex items-center gap-2 text-[11px] text-rose-400/70 font-mono">
                                                                <span>📍 {summary.location}</span>
                                                                <span>•</span>
                                                                <span className="uppercase">{summary.category}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })() : (
                                                    <div className="rounded-2xl rounded-br-sm bg-white/10 px-4 py-3 sm:px-4 sm:py-3">
                                                        <p className="text-[14px] sm:text-[15px] leading-relaxed text-white/90 wrap-break-word">
                                                            {msg.displayContent || msg.content}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            {user?.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={user.imageUrl}
                                                    alt={user.fullName ?? "You"}
                                                    className="mt-0.5 h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 rounded-full"
                                                />
                                            ) : (
                                                <div className="mt-0.5 flex h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/60">
                                                    {user?.firstName?.[0] ?? "U"}
                                                </div>
                                            )}
                                        </div>
                                    ) :

                                    // AI Chat Interface
                                    (
                                        <div className="flex items-start gap-2.5">
                                            <Image
                                                src="/favicon.svg"
                                                alt="Zephyre"
                                                width={28}
                                                height={28}
                                                className="mt-0.5 h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 rounded-md"
                                            />
                                            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3 sm:px-4 sm:py-3">
                                                {isLiveStream && !msg.content ? (
                                                    // Empty placeholder — show Zephyre thinking indicator
                                                    <div className="flex items-center gap-2">
                                                        <Wand2 className="h-3.5 w-3.5 shrink-0 text-white/60 animate-pulse" />
                                                        <span className="text-[13px] sm:text-sm text-white/60 animate-pulse">
                                                            Zephyre is thinking…
                                                        </span>
                                                    </div>
                                                ) : isLiveStream && msg.content ? (
                                                    // Streaming thinking text — show raw (not markdown)
                                                    // with a blinking cursor at the end
                                                    <div>
                                                        <div className="mb-2 flex items-center gap-1.5">
                                                            <Wand2 className="h-3.5 w-3.5 shrink-0 text-white/60" />
                                                            <span className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-white/60">
                                                                Agent reasoning
                                                            </span>
                                                        </div>
                                                        <p className="text-[13px] sm:text-sm leading-relaxed text-white/60 wrap-break-word whitespace-pre-wrap">
                                                            {msg.content}
                                                            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-[blink_1s_ease-in-out_infinite] bg-white/70 align-middle" />
                                                        </p>
                                                    </div>
                                                ) : (
                                                    // Normal completed assistant message
                                                    <div className="prose prose-sm prose-invert max-w-none wrap-break-word text-[14px] sm:text-[15px] leading-relaxed text-white/95 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-white [&_code]:text-[13px] [&_code]:break-all [&_li]:my-1 [&_p]:my-1.5 [&_pre]:overflow-x-auto! [&_pre]:whitespace-pre-wrap! [&_ul]:my-1.5">
                                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        );
                    })}

                    {/* Live status steps — only shown during normal generation */}
                    {isGenerating && (
                        <div className="flex items-start gap-2.5">
                            <Image
                                src="/favicon.svg"
                                alt="Zephyre"
                                width={28}
                                height={28}
                                className="mt-0.5 h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 rounded-md"
                            />
                            <div className="rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3.5 sm:px-4 sm:py-3.5">
                                <div className="space-y-2.5">
                                    {statusLog.map((step, i) => (
                                        <div key={i} className="flex items-center gap-2.5">
                                            <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                                                {step.status === "running" ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />
                                                ) : (
                                                    <svg
                                                        className="h-3.5 w-3.5 text-white/30"
                                                        viewBox="0 0 12 12"
                                                        fill="none"
                                                    >
                                                        <path
                                                            d="M2 6l3 3 5-5"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                )}
                                            </div>
                                            <span
                                                className={cn(
                                                    "text-[13px] sm:text-sm transition-colors duration-300",
                                                    step.status === "running"
                                                        ? "text-white/85"
                                                        : "text-white/30"
                                                )}
                                            >
                                                {step.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* No-credits upgrade banner */}
            {noCredits && (
                <div className="mx-3 mb-2 rounded-xl border border-red-500/15 bg-red-950/40 px-4 py-3">
                    <p className="mb-2 text-[12px] font-medium text-red-400/80">
                        You&apos;ve used all your credits
                    </p>
                    <PricingModal reason="credits">
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full text-xs active:scale-95 cursor-pointer bg-white text-black px-3">
                            <Sparkles className="h-3 w-3" />
                            Upgrade plan
                        </span>
                    </PricingModal>
                </div>
            )}

            {/* Input */}
            <div className="border-t border-white/6 p-3 sm:p-3.5 shrink-0 bg-[#0d0d0d]">

                {/* Uploaded Files Preview Row */}
                {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2.5">
                        {pendingFiles.map((file, idx) => (
                            <div
                                key={idx}
                                className="relative group flex items-center gap-1.5 p-1.5 pr-2.5 rounded-lg bg-white/8 border border-white/10 text-xs font-mono text-white/90"
                            >
                                {file.base64 && (file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg|gif)$/i.test(file.name)) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={`data:${file.type};base64,${file.base64}`}
                                        alt={file.name}
                                        className="h-7 w-7 rounded object-cover"
                                    />
                                ) : (
                                    <FileCode className="h-4 w-4 text-orange-400 shrink-0 ml-1" />
                                )}
                                <span className="max-w-30 truncate">{file.name}</span>
                                <span className="text-[10px] text-white/40">({formatFileSize(file.size)})</span>
                                <button
                                    type="button"
                                    onClick={() => removePendingFile(idx)}
                                    className="ml-1 p-0.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                    title="Remove file"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}



                {/* Text Input Field */}
                <div
                    className={cn(
                        "rounded-xl border bg-white/4 transition-colors",
                        isGenerating || isImproving
                            ? "border-white/4"
                            : noCredits
                                ? "border-white/4 opacity-60"
                                : "border-white/8 hover:border-white/12"
                    )}
                >
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isGenerating || isImproving || noCredits}
                        placeholder={
                            noCredits
                                ? "Upgrade to keep building…"
                                : isImproving
                                    ? "Zephyre is improving your app…"
                                    : isGenerating
                                        ? "Generating…"
                                        : "Ask AI to modify…"
                        }
                        rows={1}
                        className="w-full resize-none bg-transparent px-4 pb-2.5 pt-3.5 text-base sm:text-[15px] text-white placeholder:text-white/40 focus:outline-none leading-relaxed overflow-y-auto no-scrollbar scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        style={{ maxHeight: 180, scrollbarWidth: "none", msOverflowStyle: "none" }}
                    />

                    <div className="flex items-center justify-between px-2.5 pb-2.5">
                        <AttachmentPlusMenu
                            onSelectFiles={handleFilesSelected}
                            disabled={isGenerating || isImproving || isUploading || noCredits}
                            isUploading={isUploading}
                            direction="up"
                        />

                        {/* Stop button — shown while generating or improving */}
                        {isGenerating || isImproving ? (
                            <Button
                                size="icon"
                                onClick={onStop}
                                className="h-8 w-8 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white active:scale-95 transition-all"
                            >
                                <Square className="h-3.5 w-3.5 fill-current" />
                            </Button>
                        ) : (
                            <Button
                                size="icon"
                                onClick={handleSubmit}
                                disabled={!canSubmit}
                                className={cn(
                                    "h-8 w-8 rounded-lg transition-all",
                                    canSubmit
                                        ? "bg-white text-black hover:bg-white/90 active:scale-95"
                                        : "bg-white/8 text-white/20 shadow-none"
                                )}
                            >
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <p className="mt-2 text-center text-[11px] sm:text-xs text-white/25">
                    {isGenerating || isImproving
                        ? "Click ■ to stop generation"
                        : "⏎ to send · Shift+⏎ for new line"}
                </p>
            </div>
        </div>
    );
}
