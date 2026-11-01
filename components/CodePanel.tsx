"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
    Eye,
    Code2,
    Download,
    AlertTriangle,
    Bot,
    Loader2,
    ArrowUp,
    MessageSquare,
    ExternalLink,
    Copy,
    Check,
    RefreshCw,
    Smartphone,
    Tablet,
    Monitor,
    FileCode,
    FileJson,
    FileText,
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
} from "lucide-react";
import { RingLoader } from "react-spinners";
import JSZip from "jszip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { FileData, StatusStep } from "@/types/workspace";
import { CodeMirrorEditor } from "@/components/editor/CodeMirrorEditor";

// Types
type ActiveTab = "preview" | "code";
type Viewport = "desktop" | "tablet" | "mobile";

interface FileTreeNode {
    name: string;
    path: string;
    isFolder: boolean;
    children?: FileTreeNode[];
}

interface CodePanelProps {
    fileData: FileData | null;
    isGenerating: boolean;
    statusLog: StatusStep[];
    onImprove: (userRequest: string) => Promise<void>;
    onFixError: (error: string) => Promise<void>;
    onFilePatch: (patches: FileData) => void;
    appTitle: string | null;
    isImproving: boolean;
    isProUser: boolean;
    onToggleView: () => void;
}

// ─── Build Tree Structure from Flat File Paths ──────────────────────────────
function buildFileTree(paths: string[]): FileTreeNode[] {
    interface InternalTree {
        [key: string]: {
            __node: FileTreeNode;
            __children: InternalTree;
        };
    }

    const root: InternalTree = {};

    for (const rawPath of paths) {
        const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
        const parts = cleanPath.split("/").filter(Boolean);
        let current = root;

        let accumulated = "";
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            accumulated += "/" + part;

            if (!current[part]) {
                current[part] = {
                    __node: {
                        name: part,
                        path: isFile ? rawPath : accumulated,
                        isFolder: !isFile,
                    },
                    __children: {},
                };
            }
            current = current[part].__children;
        }
    }

    function convert(obj: InternalTree): FileTreeNode[] {
        const result: FileTreeNode[] = [];
        for (const key of Object.keys(obj)) {
            const entry = obj[key];
            const node: FileTreeNode = { ...entry.__node };
            if (node.isFolder) {
                node.children = convert(entry.__children);
                node.children.sort((a, b) => {
                    if (a.isFolder && !b.isFolder) return -1;
                    if (!a.isFolder && b.isFolder) return 1;
                    return a.name.localeCompare(b.name);
                });
            }
            result.push(node);
        }
        return result.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    return convert(root);
}

// File icon helper
function getFileIcon(filename: string) {
    if (filename.endsWith(".jsx") || filename.endsWith(".tsx")) {
        return <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    }
    if (filename.endsWith(".js") || filename.endsWith(".ts") || filename.endsWith(".mjs")) {
        return <FileCode className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
    }
    if (filename.endsWith(".py")) {
        return <FileCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
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

// Recursive Tree Node Renderer
function FileTreeNodeItem({
    node,
    depth,
    selectedFile,
    onSelectFile,
    collapsedFolders,
    onToggleFolder,
}: {
    node: FileTreeNode;
    depth: number;
    selectedFile: string;
    onSelectFile: (path: string) => void;
    collapsedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
}) {
    if (node.isFolder) {
        const isCollapsed = collapsedFolders.has(node.path);
        return (
            <div>
                <button
                    onClick={() => onToggleFolder(node.path)}
                    style={{ paddingLeft: `${depth * 14 + 8}px` }}
                    className="w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-md text-xs font-mono text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    )}
                    {isCollapsed ? (
                        <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : (
                        <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="truncate font-medium">{node.name}</span>
                </button>
                {!isCollapsed && node.children && (
                    <div className="space-y-0.5">
                        {node.children.map((child) => (
                            <FileTreeNodeItem
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                selectedFile={selectedFile}
                                onSelectFile={onSelectFile}
                                collapsedFolders={collapsedFolders}
                                onToggleFolder={onToggleFolder}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const isSelected =
        selectedFile === node.path ||
        (node.path.startsWith("/") && selectedFile === node.path.slice(1)) ||
        (!node.path.startsWith("/") && selectedFile === "/" + node.path);

    return (
        <button
            onClick={() => onSelectFile(node.path)}
            style={{ paddingLeft: `${depth * 14 + 16}px` }}
            className={`w-full flex items-center gap-2 py-1.5 pr-2.5 rounded-md text-xs font-mono transition-colors text-left truncate ${
                isSelected
                    ? "bg-orange-500/20 text-orange-300 font-medium border-l-2 border-orange-500"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
        >
            {getFileIcon(node.name)}
            <span className="truncate">{node.name}</span>
        </button>
    );
}

export function CodePanel({
    fileData,
    isGenerating,
    statusLog,
    onImprove,
    onFixError,
    onFilePatch,
    appTitle,
    isImproving,
    isProUser,
    onToggleView,
}: CodePanelProps) {
    const [activeTab, setActiveTab] = useState<ActiveTab>("preview");
    const [viewport, setViewport] = useState<Viewport>("desktop");
    const [selectedFile, setSelectedFile] = useState<string>("/src/App.jsx");
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
    const [sandboxId, setSandboxId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isStartingSandbox, setIsStartingSandbox] = useState(false);
    const [sandboxError, setSandboxError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [improveInput, setImproveInput] = useState("");
    const [showImproveInput, setShowImproveInput] = useState(false);
    const [isIframeLoading, setIsIframeLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const files = useMemo(() => fileData?.files ?? {}, [fileData?.files]);
    const fileList = useMemo(() => Object.keys(files), [files]);
    const fileTree = useMemo(() => buildFileTree(fileList), [fileList]);

    // Active file resolution with fallback to entry files if selectedFile is not in file tree
    const activeFile = useMemo(() => {
        if (fileList.length === 0) return selectedFile;
        const hasExact = files[selectedFile];
        const hasAlt1 = selectedFile.startsWith("/") && files[selectedFile.slice(1)];
        const hasAlt2 = !selectedFile.startsWith("/") && files["/" + selectedFile];

        if (hasExact || hasAlt1 || hasAlt2) {
            return selectedFile;
        }

        return (
            files["/src/App.jsx"] ? "/src/App.jsx" :
            files["/App.jsx"] ? "/App.jsx" :
            files["/main.py"] ? "/main.py" :
            files["/server.js"] ? "/server.js" :
            files["/index.html"] ? "/index.html" :
            fileList[0] || selectedFile
        );
    }, [fileList, files, selectedFile]);

    // Auto-patch legacy vite.config to enforce allowedHosts: true, polling, and HMR for Vite 6 preview
    useEffect(() => {
        if (!fileData || !fileData.files) return;
        const viteKey = Object.keys(fileData.files).find((k) => k.endsWith("vite.config.js") || k.endsWith("vite.config.ts"));
        const currentCode = viteKey ? fileData.files[viteKey]?.code : null;
        const needsPatch = !currentCode || !currentCode.includes("allowedHosts: true") || !currentCode.includes("usePolling");

        if (needsPatch) {
            const patchedViteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      clientPort: 443,
    },
  },
});`;
            const keyToPatch = viteKey || "/vite.config.js";
            onFilePatch({
                ...fileData,
                files: {
                    ...fileData.files,
                    [keyToPatch]: { code: patchedViteConfig },
                },
            });
        }
    }, [fileData, onFilePatch]);

    // ─── E2B Sandbox Lifecycle: Start or Sync ─────────────────────────────────────

    const startSandbox = useCallback(async (data: FileData, previousId?: string | null) => {
        if (!data.files || Object.keys(data.files).length === 0) return;

        setIsStartingSandbox(true);
        setSandboxError(null);

        try {
            const res = await fetch("/api/sandbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "start",
                    fileData: data,
                    previousSandboxId: previousId || sandboxId || undefined,
                }),
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || "Failed to boot cloud sandbox");
            }

            setSandboxId(result.sandboxId);

            // If private traffic token exists, use reverse-proxy endpoint to ensure seamless iframe embedding
            if (!result.isPublic && result.trafficAccessToken) {
                const proxyUrl = `/api/sandbox/proxy?url=${encodeURIComponent(result.previewUrl)}&token=${encodeURIComponent(result.trafficAccessToken)}`;
                setPreviewUrl(proxyUrl);
            } else {
                setPreviewUrl(result.previewUrl);
            }
        } catch (err: unknown) {
            console.error("[CodePanel] Failed to start E2B Sandbox:", err);
            const msg = err instanceof Error ? err.message : "Failed to start sandbox";
            setSandboxError(msg);
        } finally {
            setIsStartingSandbox(false);
        }
    }, [sandboxId]);

    const syncSandboxFiles = useCallback(async (id: string, changedFiles: Record<string, { code: string }>) => {
        try {
            const res = await fetch("/api/sandbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sync",
                    sandboxId: id,
                    changedFiles,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 404 || data.code === "SANDBOX_EXPIRED") {
                    console.warn("[CodePanel] Sandbox expired or unreachable, resetting for automatic re-boot...");
                    setSandboxId(null);
                }
            }
        } catch (err) {
            console.warn("[CodePanel] Failed to sync files to sandbox:", err);
        }
    }, []);

    // Track file contents to detect both structural and content modifications from AI generations
    const prevFilesRef = useRef<Record<string, { code: string }>>({});
    useEffect(() => {
        if (isGenerating || !fileData || !fileData.files || Object.keys(fileData.files).length === 0) {
            return;
        }

        const currentFiles = fileData.files;
        if (!sandboxId) {
            prevFilesRef.current = currentFiles;
            queueMicrotask(() => {
                startSandbox(fileData);
            });
            return;
        }

        // Calculate diff between previous files and new incoming files
        const changedFiles: Record<string, { code: string }> = {};
        for (const [path, fileObj] of Object.entries(currentFiles)) {
            if (!prevFilesRef.current[path] || prevFilesRef.current[path].code !== fileObj?.code) {
                changedFiles[path] = fileObj;
            }
        }

        if (Object.keys(changedFiles).length > 0) {
            prevFilesRef.current = currentFiles;
            queueMicrotask(() => {
                syncSandboxFiles(sandboxId, changedFiles);
            });
        }
    }, [fileData, isGenerating, sandboxId, startSandbox, syncSandboxFiles]);

    // Resolve code of selected file with leading-slash tolerance
    const selectedCode = useMemo(() => {
        if (files[activeFile]) return files[activeFile].code;
        if (activeFile.startsWith("/") && files[activeFile.slice(1)]) return files[activeFile.slice(1)].code;
        if (!activeFile.startsWith("/") && files["/" + activeFile]) return files["/" + activeFile].code;
        return "";
    }, [files, activeFile]);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // Handle manual code edits with debounced container sync
    const handleCodeChange = (newCode: string) => {
        if (!fileData || !activeFile) return;

        let targetKey = activeFile;
        if (!files[targetKey]) {
            if (targetKey.startsWith("/") && files[targetKey.slice(1)]) targetKey = targetKey.slice(1);
            else if (!targetKey.startsWith("/") && files["/" + targetKey]) targetKey = "/" + targetKey;
        }

        const updatedFiles = {
            ...files,
            [targetKey]: { code: newCode },
        };

        // Dual-mirror App.jsx across root and src/ so Vite resolves immediate HMR
        const isApp = targetKey.endsWith("App.jsx") || targetKey.endsWith("App.js");
        if (isApp) {
            if (updatedFiles["/App.jsx"]) updatedFiles["/App.jsx"] = { code: newCode };
            if (updatedFiles["App.jsx"]) updatedFiles["App.jsx"] = { code: newCode };
            if (updatedFiles["/src/App.jsx"]) updatedFiles["/src/App.jsx"] = { code: newCode };
            if (updatedFiles["src/App.jsx"]) updatedFiles["src/App.jsx"] = { code: newCode };
        }

        onFilePatch({
            files: updatedFiles,
            dependencies: fileData.dependencies ?? {},
            title: fileData.title,
        });

        // Update local tracking ref so generation effect doesn't duplicate the sync
        prevFilesRef.current = updatedFiles;

        setIsSyncing(true);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (sandboxId) {
            debounceTimerRef.current = setTimeout(async () => {
                try {
                    await syncSandboxFiles(sandboxId, { [targetKey]: { code: newCode } });
                } finally {
                    setIsSyncing(false);
                }
            }, 300);
        } else {
            setIsSyncing(false);
        }
    };

    // Instant tab switch with immediate debounce flush
    const handleTabChange = (val: string) => {
        if (val === "preview") {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            setIsSyncing(false);
            if (sandboxId && activeFile) {
                let targetKey = activeFile;
                if (!files[targetKey]) {
                    if (targetKey.startsWith("/") && files[targetKey.slice(1)]) targetKey = targetKey.slice(1);
                    else if (!targetKey.startsWith("/") && files["/" + targetKey]) targetKey = "/" + targetKey;
                }
                const fileObj = files[targetKey] || (selectedCode ? { code: selectedCode } : null);
                if (fileObj) {
                    syncSandboxFiles(sandboxId, { [targetKey]: fileObj });
                }
            }
        }
        setActiveTab(val as ActiveTab);
    };

    // Toggle folder collapse
    const handleToggleFolder = (folderPath: string) => {
        setCollapsedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderPath)) {
                next.delete(folderPath);
            } else {
                next.add(folderPath);
            }
            return next;
        });
    };

    // Reload iframe with cache-busting timestamp
    const handleRefreshIframe = () => {
        if (iframeRef.current && previewUrl) {
            setIsIframeLoading(true);
            const separator = previewUrl.includes("?") ? "&" : "?";
            iframeRef.current.src = `${previewUrl}${separator}_t=${Date.now()}`;
            toast.info("Reloading preview frame...");
        }
    };

    // Copy live shareable URL
    const handleCopyUrl = async () => {
        if (!previewUrl) return;
        try {
            await navigator.clipboard.writeText(previewUrl);
            setCopied(true);
            toast.success("Live URL copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy URL");
        }
    };

    // Export ZIP
    const handleExportZip = async () => {
        if (isExporting || !fileData?.files) return;
        setIsExporting(true);

        try {
            const zip = new JSZip();
            for (const [path, fileObj] of Object.entries(fileData.files)) {
                const cleanPath = path.startsWith("/") ? path.slice(1) : path;
                zip.file(cleanPath, fileObj.code);
            }

            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(fileData.title || "zephyre-app").toLowerCase().replace(/\s+/g, "-")}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Project ZIP downloaded!");
        } catch (err) {
            console.error("ZIP export failed:", err);
            toast.error("Failed to export project ZIP");
        } finally {
            setIsExporting(false);
        }
    };

    // Submit AI improve request
    const handleImproveSubmit = async () => {
        const trimmed = improveInput.trim();
        if (!trimmed || isImproving) return;
        setImproveInput("");
        setShowImproveInput(false);
        await onImprove(trimmed);
    };

    return (
        <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0d0d12] text-white">
            <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="flex h-full w-full flex-col overflow-hidden"
            >
                {/* ── Header Toolbar ── */}
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-[#12121a] px-2 sm:px-4 gap-1.5 sm:gap-2">
                    {/* Left: View Tabs & Mobile Menu */}
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {/* Mobile view toggle */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleView}
                            className="h-8 gap-1 px-2 text-xs font-semibold text-zinc-400 hover:text-white md:hidden"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Chat</span>
                        </Button>

                        {/* View Tabs */}
                        <TabsList className="h-8 bg-black/40 p-0.5 border border-white/5 rounded-lg">
                            <TabsTrigger
                                value="preview"
                                className="h-7 gap-1.5 rounded-md px-2 sm:px-3 text-xs font-medium data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300"
                            >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Preview</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="code"
                                className="h-7 gap-1.5 rounded-md px-2 sm:px-3 text-xs font-medium data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300"
                            >
                                <Code2 className="h-3.5 w-3.5" />
                                <span>Code</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Middle: Browser Address Bar & Preview Navigation */}
                    <div className="flex flex-1 items-center justify-center min-w-0 px-1 sm:px-2">
                        {activeTab === "preview" && previewUrl ? (
                            <div className="flex items-center gap-1 sm:gap-1.5 w-full max-w-lg justify-center min-w-0">
                                {/* Responsive Viewport Controls */}
                                <div className="hidden md:flex items-center gap-0.5 p-0.5 bg-black/40 border border-white/5 rounded-lg shrink-0">
                                    <button
                                        onClick={() => setViewport("desktop")}
                                        title="Desktop view"
                                        className={`p-1.5 rounded-md transition-colors ${viewport === "desktop" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                    >
                                        <Monitor className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setViewport("tablet")}
                                        title="Tablet view (768px)"
                                        className={`p-1.5 rounded-md transition-colors ${viewport === "tablet" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                    >
                                        <Tablet className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setViewport("mobile")}
                                        title="Mobile view (375px)"
                                        className={`p-1.5 rounded-md transition-colors ${viewport === "mobile" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                    >
                                        <Smartphone className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {/* Browser Reload Preview Button */}
                                <button
                                    onClick={handleRefreshIframe}
                                    title="Reload preview"
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${isIframeLoading ? "animate-spin text-orange-400" : ""}`} />
                                </button>

                                {/* Central Omnibar Link Pill (hidden on small mobile screens to prevent overlapping) */}
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/10 rounded-full text-xs font-mono text-zinc-300 min-w-0 flex-1 max-w-xs sm:max-w-sm justify-between shadow-inner">
                                    <div className="flex items-center gap-2 min-w-0 truncate">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                        <span className="truncate select-all text-[11px] text-zinc-300">{previewUrl}</span>
                                    </div>
                                    <button
                                        onClick={handleCopyUrl}
                                        title="Copy URL"
                                        className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 cursor-pointer p-0.5"
                                    >
                                        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                    </button>
                                </div>

                                {/* Open in New Tab Button */}
                                <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open in new tab"
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        ) : activeTab === "code" && activeFile ? (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-black/40 border border-white/5 rounded-full text-xs font-mono text-zinc-400">
                                <span className="text-zinc-300 truncate max-w-xs">{activeFile}</span>
                            </div>
                        ) : null}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        {previewUrl && (
                            <>
                                {/* Restart Container (hidden on mobile, visible on desktop/tablet) */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => fileData && startSandbox(fileData, sandboxId)}
                                    title="Restart cloud sandbox container"
                                    className="hidden md:inline-flex h-8 gap-1.5 px-2 text-xs text-zinc-400 hover:text-orange-300 hover:bg-orange-500/10 cursor-pointer"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span className="hidden lg:inline">Restart</span>
                                </Button>

                                {/* Share / Copy URL */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyUrl}
                                    title="Share live URL"
                                    className="h-8 gap-1.5 px-2 sm:px-2.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-300 cursor-pointer"
                                >
                                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">Share URL</span>
                                </Button>
                            </>
                        )}

                        {/* Export to ZIP */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportZip}
                            disabled={isExporting || fileList.length === 0}
                            title="Export ZIP"
                            className="h-8 gap-1.5 px-2 sm:px-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                        >
                            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">Export ZIP</span>
                        </Button>
                    </div>
                </div>

                {/* ── Content: Preview Tab (keepMounted prevents iframe unmount/reload) ── */}
                <TabsContent
                    value="preview"
                    keepMounted
                    className={cn(
                        "relative flex-1 min-h-0 min-w-0 m-0 p-0 flex flex-col items-center justify-center bg-black overflow-hidden",
                        activeTab !== "preview" && "hidden!"
                    )}
                >
                    {/* State 1: Generation in progress */}
                    {isGenerating && (
                        <div className="flex flex-col items-center justify-center gap-4 text-center p-6">
                            <RingLoader color="#f97316" size={54} />
                            <div className="max-w-xs space-y-1">
                                <p className="text-sm font-semibold text-white">Generating Application...</p>
                                <p className="text-xs text-zinc-500">
                                    {statusLog[statusLog.length - 1]?.label || "Constructing virtual file tree and styling components..."}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* State 2: Booting E2B Cloud Sandbox */}
                    {!isGenerating && isStartingSandbox && (
                        <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
                            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                            <div className="max-w-xs space-y-1">
                                <p className="text-sm font-semibold text-white">Booting E2B Cloud MicroVM...</p>
                                <p className="text-xs text-zinc-500">
                                    Installing dependencies and starting live server container on port 3000...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* State 3: Empty / No Files */}
                    {!isGenerating && !isStartingSandbox && !previewUrl && !sandboxError && (
                        <div className="flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                            <div className="text-4xl mb-3">⚡</div>
                            <p className="text-sm font-medium text-zinc-400">Your live application will appear here</p>
                            <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                                Enter a prompt in the chat panel to generate your full-stack app.
                            </p>
                        </div>
                    )}

                    {/* State 4: Sandbox Error */}
                    {sandboxError && (
                        <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 mb-4">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <h3 className="text-base font-bold text-white mb-1">Sandbox Execution Failed</h3>
                            <p className="text-xs text-zinc-400 mb-4">{sandboxError}</p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => fileData && startSandbox(fileData)}
                                    className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                    Retry Boot
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onFixError(sandboxError)}
                                    className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                    <Bot className="h-3.5 w-3.5 mr-1.5" />
                                    Fix with AI
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* State 5: Active Preview Frame */}
                    {previewUrl && !isGenerating && !isStartingSandbox && (
                        <div
                            className={`h-full w-full flex flex-col transition-all duration-300 ${
                                viewport === "desktop" ? "max-w-full" :
                                viewport === "tablet" ? "max-w-3xl border-x border-white/10 shadow-2xl" :
                                "max-w-93.75 border-x border-white/10 shadow-2xl"
                            }`}
                        >
                            <div className="relative flex-1 w-full min-h-0 bg-[#0e0e14]">
                                {isIframeLoading && (
                                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-orange-500 via-amber-400 to-emerald-400 animate-pulse z-10" />
                                )}
                                <iframe
                                    ref={iframeRef}
                                    src={previewUrl}
                                    onLoad={() => setIsIframeLoading(false)}
                                    title={appTitle || "Zephyre Preview"}
                                    className="h-full w-full border-0 bg-white"
                                    allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write"
                                />
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ── Content: Code Tab (keepMounted preserves editor state & scroll) ── */}
                <TabsContent
                    value="code"
                    keepMounted
                    className={cn(
                        "flex-1 min-h-0 min-w-0 m-0 p-0 flex flex-row overflow-hidden bg-[#09090e]",
                        activeTab !== "code" && "hidden!"
                    )}
                >
                    {/* Left: Hierarchical File Explorer */}
                    <div className="w-64 shrink-0 border-r border-white/5 bg-[#0e0e14] flex flex-col overflow-hidden">
                        <div className="h-9 shrink-0 px-3 border-b border-white/5 flex items-center justify-between text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                            <span>Explorer</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                                {fileList.length} files
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                            {fileTree.map((node) => (
                                <FileTreeNodeItem
                                    key={node.path}
                                    node={node}
                                    depth={0}
                                    selectedFile={activeFile}
                                    onSelectFile={setSelectedFile}
                                    collapsedFolders={collapsedFolders}
                                    onToggleFolder={handleToggleFolder}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Right: Code Editor powered by CodeMirror 6 */}
                    <CodeMirrorEditor
                        value={selectedCode}
                        filePath={activeFile}
                        onChange={handleCodeChange}
                        readOnly={isGenerating}
                        isSyncing={isSyncing}
                        getFileIcon={getFileIcon}
                    />
                </TabsContent>
            </Tabs>

            {/* ── AI Improve Drawer (For Pro Users) ── */}
            {isProUser && (
                <div className="border-t border-white/5 bg-[#12121a] px-4 py-2.5">
                    {showImproveInput ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={improveInput}
                                onChange={(e) => setImproveInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleImproveSubmit()}
                                placeholder="Describe what you want AI to improve (e.g. 'Add dark mode toggle')..."
                                className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-orange-500/50"
                            />
                            <Button
                                size="sm"
                                onClick={handleImproveSubmit}
                                disabled={isImproving || !improveInput.trim()}
                                className="h-8 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs px-3"
                            >
                                {isImproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowImproveInput(false)}
                                className="h-8 text-xs text-zinc-500 hover:text-white"
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowImproveInput(true)}
                            className="flex items-center gap-2 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
                        >
                            <Bot className="h-3.5 w-3.5" />
                            Ask AI to improve this project...
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
