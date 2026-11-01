"use client";

import React, { useMemo, useState, useCallback } from "react";
import CodeMirror, { ViewUpdate, EditorView } from "@uiw/react-codemirror";
import { Copy, Check, FileCode, FileText, FileJson } from "lucide-react";
import { toast } from "sonner";
import {
    pureBlackTheme,
    brightSyntaxHighlighting,
    getLanguageExtension,
    getLanguageName,
    formatBytes,
} from "./editor-theme";

interface CodeMirrorEditorProps {
    value: string;
    filePath: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
    isSyncing?: boolean;
    getFileIcon?: (filename: string) => React.ReactNode;
}

function defaultGetFileIcon(filename: string) {
    if (filename.endsWith(".jsx") || filename.endsWith(".tsx")) {
        return <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    }
    if (filename.endsWith(".js") || filename.endsWith(".ts") || filename.endsWith(".mjs")) {
        return <FileCode className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
    }
    if (filename.endsWith(".json")) {
        return <FileJson className="h-3.5 w-3.5 text-amber-300 shrink-0" />;
    }
    if (filename.endsWith(".html")) {
        return <FileCode className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
    }
    if (filename.endsWith(".css")) {
        return <FileText className="h-3.5 w-3.5 text-sky-300 shrink-0" />;
    }
    return <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />;
}

export function CodeMirrorEditor({
    value,
    filePath,
    onChange,
    readOnly = false,
    isSyncing = false,
    getFileIcon = defaultGetFileIcon,
}: CodeMirrorEditorProps) {
    const [copied, setCopied] = useState(false);
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

    // Copy current file content
    const handleCopyFile = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("File content copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy file content");
        }
    };

    // Calculate language and extensions dynamically based on active file
    const extensions = useMemo(() => {
        const langExt = getLanguageExtension(filePath);
        return [
            pureBlackTheme,
            brightSyntaxHighlighting,
            ...langExt,
            EditorView.lineWrapping,
        ];
    }, [filePath]);

    // Handle cursor position updates
    const handleUpdate = useCallback((viewUpdate: ViewUpdate) => {
        if (viewUpdate.selectionSet || viewUpdate.docChanged) {
            const state = viewUpdate.state;
            const mainPos = state.selection.main.head;
            const line = state.doc.lineAt(mainPos);
            setCursorPos({
                line: line.number,
                col: mainPos - line.from + 1,
            });
        }
    }, []);

    // Statistics
    const lineCount = useMemo(() => {
        if (!value) return 0;
        return value.split("\n").length;
    }, [value]);

    const byteSize = useMemo(() => {
        if (!value) return 0;
        return new TextEncoder().encode(value).length;
    }, [value]);

    const languageName = useMemo(() => getLanguageName(filePath), [filePath]);
    const fileNameOnly = useMemo(() => {
        const parts = filePath.split("/").filter(Boolean);
        return parts[parts.length - 1] || filePath;
    }, [filePath]);

    return (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-black select-none">
            {/* ── Editor Breadcrumbs & File Header Bar ── */}
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0f] px-3 text-xs font-mono text-zinc-400">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0">{getFileIcon(fileNameOnly)}</span>
                    <span className="text-zinc-200 font-medium truncate max-w-xs sm:max-w-md">
                        {filePath}
                    </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Live E2B Sandbox Sync Status Pill */}
                    {isSyncing ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                            <span>Syncing...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-normal">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="hidden sm:inline">Synced to Sandbox</span>
                        </div>
                    )}

                    {/* Copy File Content Button */}
                    <button
                        onClick={handleCopyFile}
                        title="Copy file content"
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        {copied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                            <Copy className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* ── CodeMirror 6 Pure Black Editor Container ── */}
            <div className="flex-1 relative min-h-0 min-w-0 bg-black overflow-hidden select-text">
                <CodeMirror
                    value={value}
                    height="100%"
                    className="h-full w-full overflow-hidden text-[13px]"
                    theme="dark"
                    extensions={extensions}
                    onChange={onChange}
                    onUpdate={handleUpdate}
                    readOnly={readOnly}
                    basicSetup={{
                        lineNumbers: true,
                        highlightActiveLineGutter: true,
                        highlightActiveLine: true,
                        foldGutter: true,
                        dropCursor: true,
                        allowMultipleSelections: true,
                        indentOnInput: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        autocompletion: false,
                        rectangularSelection: true,
                        crosshairCursor: true,
                        highlightSelectionMatches: true,
                        closeBracketsKeymap: true,
                        defaultKeymap: true,
                        searchKeymap: true,
                        historyKeymap: true,
                        foldKeymap: true,
                    }}
                    placeholder="// Select a file from the explorer on the left..."
                />
            </div>

            {/* ── Editor Status Bar Footer ── */}
            <div className="flex h-6 shrink-0 items-center justify-between border-t border-white/5 bg-[#050508] px-3 text-[11px] font-mono text-zinc-500">
                <div className="flex items-center gap-3">
                    <span>
                        Ln {cursorPos.line}, Col {cursorPos.col}
                    </span>
                    <span className="hidden sm:inline">
                        {lineCount} line{lineCount !== 1 ? "s" : ""}
                    </span>
                    <span className="hidden md:inline">{formatBytes(byteSize)}</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="hidden sm:inline">Spaces: 2</span>
                    <span>UTF-8</span>
                    <span className="text-zinc-400 font-semibold">{languageName}</span>
                </div>
            </div>
        </div>
    );
}
