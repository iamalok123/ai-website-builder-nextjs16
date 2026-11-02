"use client";

import React, { useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
    Plus,
    Paperclip,
    Camera,
    Image as ImageIcon,
    FileText,
    FileCode,
    Database,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AttachmentPlusMenuProps {
    onSelectFiles: (files: File[]) => Promise<void> | void;
    disabled?: boolean;
    isUploading?: boolean;
    direction?: "up" | "down";
    className?: string;
    buttonClassName?: string;
}

export function AttachmentPlusMenu({
    onSelectFiles,
    disabled = false,
    isUploading = false,
    direction = "up",
    className,
    buttonClassName,
}: AttachmentPlusMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );

    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeAccept, setActiveAccept] = useState(
        "image/*,.pdf,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css"
    );

    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

    // Reposition menu smoothly based on trigger position and viewport boundaries
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuEl = menuRef.current;
        const menuWidth = menuEl ? menuEl.offsetWidth : 305;
        const menuHeight = menuEl ? menuEl.offsetHeight : 340;

        // Clamp horizontally so it never bleeds off viewport on any mobile/desktop screen
        const idealLeft = rect.left;
        const maxLeft = Math.max(12, window.innerWidth - menuWidth - 12);
        const clampedLeft = Math.max(12, Math.min(idealLeft, maxLeft));

        // Intelligent vertical flipping: check available space above vs below
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;

        let top: number;
        if (direction === "up") {
            // Prefer up, flip down if space above is too cramped
            if (spaceAbove >= menuHeight + 12 || spaceAbove >= spaceBelow) {
                top = rect.top - menuHeight - 8;
            } else {
                top = rect.bottom + 8;
            }
        } else {
            // Prefer down, flip up if space below is too cramped
            if (spaceBelow >= menuHeight + 12 || spaceBelow >= spaceAbove) {
                top = rect.bottom + 8;
            } else {
                top = rect.top - menuHeight - 8;
            }
        }

        // Clamp vertically so menu is never offscreen
        const clampedTop = Math.max(12, Math.min(top, window.innerHeight - menuHeight - 12));

        setCoords({ top: clampedTop, left: clampedLeft });
    }, [direction]);

    useEffect(() => {
        if (!isOpen) return;

        updatePosition();
        const raf = requestAnimationFrame(updatePosition);

        const handleScrollOrResize = () => {
            updatePosition();
        };

        window.addEventListener("scroll", handleScrollOrResize, true);
        window.addEventListener("resize", handleScrollOrResize);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("scroll", handleScrollOrResize, true);
            window.removeEventListener("resize", handleScrollOrResize);
        };
    }, [isOpen, updatePosition]);

    // Lock page scroll when dialog is open
    useEffect(() => {
        if (!isOpen) return;

        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        const originalTouchAction = document.body.style.touchAction;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.body.style.touchAction = "none";

        const preventTouchMove = (e: TouchEvent) => {
            if (menuRef.current && menuRef.current.contains(e.target as Node)) {
                return;
            }
            e.preventDefault();
        };

        const preventWheel = (e: WheelEvent) => {
            if (menuRef.current && menuRef.current.contains(e.target as Node)) {
                return;
            }
            e.preventDefault();
        };

        window.addEventListener("touchmove", preventTouchMove, { passive: false });
        window.addEventListener("wheel", preventWheel, { passive: false });

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
            document.body.style.touchAction = originalTouchAction;
            window.removeEventListener("touchmove", preventTouchMove);
            window.removeEventListener("wheel", preventWheel);
        };
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    // Global Ctrl+U / Cmd+U shortcut for file attachment
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
                e.preventDefault();
                setActiveAccept("image/*,.pdf,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css");
                setTimeout(() => {
                    fileInputRef.current?.click();
                }, 20);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleSelectFilesClick = useCallback((accept: string) => {
        setActiveAccept(accept);
        setIsOpen(false);
        setTimeout(() => {
            if (fileInputRef.current) {
                fileInputRef.current.accept = accept;
                fileInputRef.current.click();
            }
        }, 30);
    }, []);

    const handleTakeScreenshot = useCallback(async () => {
        setIsOpen(false);
        try {
            if (typeof navigator !== "undefined" && navigator.mediaDevices?.getDisplayMedia) {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                });
                const video = document.createElement("video");
                video.srcObject = stream;
                await video.play();

                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth || 1280;
                canvas.height = video.videoHeight || 720;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

                stream.getTracks().forEach((track) => track.stop());

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `screenshot-${Date.now()}.png`, {
                            type: "image/png",
                        });
                        onSelectFiles([file]);
                        toast.success("Screenshot captured and attached");
                    }
                }, "image/png");
            } else {
                // Fallback to image selector
                if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                }
            }
        } catch {
            // User cancelled screen capture or permission denied - fallback to image selector
            if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*";
                fileInputRef.current.click();
            }
        }
    }, [onSelectFiles]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onSelectFiles(files);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className={cn("relative inline-flex items-center", className)}>
            {/* Hidden Input with dynamic accept attribute */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={activeAccept}
                className="hidden"
                onChange={handleInputChange}
            />

            {/* Plus Icon Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                disabled={disabled || isUploading}
                aria-label="Add attachments and tools"
                title="Add attachments (Ctrl+U)"
                className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed select-none",
                    isOpen
                        ? "bg-[#323238] text-white border border-white/20 shadow-md"
                        : "bg-[#242428] text-zinc-300 hover:text-white hover:bg-[#2e2e34] border border-white/10",
                    buttonClassName
                )}
            >
                {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                ) : (
                    <Plus
                        className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            isOpen && "rotate-45 text-white"
                        )}
                    />
                )}
            </button>

            {/* Floating Dropdown Menu mounted via Portal directly to body */}
            {mounted &&
                isOpen &&
                createPortal(
                    <>
                        {/* Backdrop: Prevents background clicks and enforces focus on the dialog */}
                        <div
                            className="fixed inset-0 z-99998 bg-black/40 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
                            onClick={() => setIsOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Dropdown Menu Container */}
                        <div
                            ref={menuRef}
                            style={{
                                position: "fixed",
                                top: coords?.top ?? 0,
                                left: coords?.left ?? 0,
                                visibility: coords ? "visible" : "hidden",
                            }}
                            className="z-99999 w-73.75 sm:w-78.75 max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-white/12 bg-[#1b1b1e]/98 backdrop-blur-2xl p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150 select-none"
                        >
                            {/* Section 1: All Files & Screen Capture */}
                            <div className="space-y-0.5">
                                {/* Upload or add files */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleSelectFilesClick(
                                            "image/*,.pdf,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css"
                                        )
                                    }
                                    className="group w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/8 active:bg-white/12 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Paperclip className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-white transition-colors" />
                                        <span className="text-[13px] font-normal text-zinc-200 group-hover:text-white truncate transition-colors">
                                            Upload or add files
                                        </span>
                                    </div>

                                </button>

                                {/* Take a screenshot */}
                                <button
                                    type="button"
                                    onClick={handleTakeScreenshot}
                                    className="group w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/8 active:bg-white/12 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Camera className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-white transition-colors" />
                                        <span className="text-[13px] font-normal text-zinc-200 group-hover:text-white truncate transition-colors">
                                            Take a screenshot
                                        </span>
                                    </div>
                                    <span className="text-xs text-zinc-500 shrink-0 ml-2">
                                        Screen / Tab
                                    </span>
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="my-1 h-px bg-white/8" />

                            {/* Section 2: Real Available File Categories for Zephyre AI */}
                            <div className="space-y-0.5">
                                {/* Photos & Image Mockups */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectFilesClick("image/*")}
                                    className="group w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/8 active:bg-white/12 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <ImageIcon className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-white transition-colors" />
                                        <span className="text-[13px] font-normal text-zinc-200 group-hover:text-white truncate transition-colors">
                                            Photos & UI Mockups
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500 shrink-0 ml-2">
                                        PNG, JPG, SVG
                                    </span>
                                </button>

                                {/* Documents & Specifications */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleSelectFilesClick(".pdf,.txt,.md,.markdown")
                                    }
                                    className="group w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/8 active:bg-white/12 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <FileText className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-white transition-colors" />
                                        <span className="text-[13px] font-normal text-zinc-200 group-hover:text-white truncate transition-colors">
                                            Documents & Specs
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500 shrink-0 ml-2">
                                        PDF, TXT, MD
                                    </span>
                                </button>

                                {/* Code & Components */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleSelectFilesClick(
                                            ".tsx,.jsx,.ts,.js,.html,.css,.py,.sql"
                                        )
                                    }
                                    className="group w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/8 active:bg-white/12 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <FileCode className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-white transition-colors" />
                                        <span className="text-[13px] font-normal text-zinc-200 group-hover:text-white truncate transition-colors">
                                            Code & Components
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500 shrink-0 ml-2">
                                        TSX, JSX, CSS
                                    </span>
                                </button>

                                {/* Data & Schemas */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleSelectFilesClick(".json,.csv,.sql")
                                    }
                                    className="group w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/8 active:bg-white/12 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Database className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-white transition-colors" />
                                        <span className="text-[13px] font-normal text-zinc-200 group-hover:text-white truncate transition-colors">
                                            Data & Schemas
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500 shrink-0 ml-2">
                                        JSON, CSV
                                    </span>
                                </button>
                            </div>

                            {/* Subtle Info Footer */}
                            <div className="mt-1 pt-1.5 px-3 pb-1 border-t border-white/6 flex items-center justify-between text-[11px] text-zinc-400">
                                <span>Accepted: Images, Docs, Code, Data</span>
                                <span className="font-mono text-zinc-300 font-medium">
                                    Max 10MB
                                </span>
                            </div>
                        </div>
                    </>,
                    document.body
                )}
        </div>
    );
}
