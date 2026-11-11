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
    ChevronRight,
    ChevronDown,
    PanelLeftOpen,
    Wand2,
    X,
    Search,
    Crosshair,
} from "lucide-react";
import { RingLoader } from "react-spinners";
import JSZip from "jszip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { FileData, StatusStep } from "@/types/workspace";
import { CodeMirrorEditor } from "@/components/editor/CodeMirrorEditor";
import { FolderIcon, getFileIcon } from "@/components/ui/file-icons";
import { ErrorInfo, parseRawError, buildErrorFixPrompt, formatErrorFixDisplay } from "@/lib/error-fixer";

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
    onFixError: (error: string, displayMessage?: string) => Promise<void>;
    onFilePatch: (patches: FileData) => void;
    appTitle: string | null;
    isImproving: boolean;
    isProUser: boolean;
    onToggleView: () => void;
    isChatOpen?: boolean;
    onToggleChat?: () => void;
    onInspectElement?: (targetLabel: string) => void;
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

// Recursive Tree Node Renderer
function FileTreeNodeItem({
    node,
    depth,
    selectedFile,
    onSelectFile,
    collapsedFolders,
    onToggleFolder,
    isSearching = false,
}: {
    node: FileTreeNode;
    depth: number;
    selectedFile: string;
    onSelectFile: (path: string) => void;
    collapsedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    isSearching?: boolean;
}) {
    if (node.isFolder) {
        const isCollapsed = isSearching ? false : collapsedFolders.has(node.path);
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
                    <FolderIcon folderName={node.name} isOpen={!isCollapsed} className="h-3.5 w-3.5 shrink-0" />
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
                                isSearching={isSearching}
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
    isChatOpen,
    onToggleChat,
    onInspectElement,
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
    const [previewError, setPreviewError] = useState<ErrorInfo | null>(null);
    const [showErrorDetails, setShowErrorDetails] = useState(false);
    const [isFixingError, setIsFixingError] = useState(false);
    const [isInspectorActive, setIsInspectorActive] = useState(false);
    const previewErrorRef = useRef<ErrorInfo | null>(null);
    const previewUrlRef = useRef<string | null>(null);
    const pendingFixSyncRef = useRef(false);
    const postFixReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        previewErrorRef.current = previewError;
    }, [previewError]);
    useEffect(() => {
        previewUrlRef.current = previewUrl;
    }, [previewUrl]);
    useEffect(() => {
        return () => {
            if (postFixReloadTimerRef.current) {
                clearTimeout(postFixReloadTimerRef.current);
            }
        };
    }, []);
    const fileDataRef = useRef(fileData);
    useEffect(() => {
        fileDataRef.current = fileData;
    }, [fileData]);
    const sandboxIdRef = useRef<string | null>(sandboxId);
    useEffect(() => {
        sandboxIdRef.current = sandboxId;
    }, [sandboxId]);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const startSandboxRef = useRef<(data: FileData, prevId?: string | null) => Promise<void>>(() => Promise.resolve());

    // Listen for live compile & runtime error events and inspector selections
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!event.data || typeof event.data !== "object") return;
            if (event.data.source === "zephyre-preview-error") {
                const parsed = parseRawError(event.data);
                setPreviewError(parsed);
            } else if (event.data.source === "zephyre-preview-clear") {
                if (postFixReloadTimerRef.current) {
                    clearTimeout(postFixReloadTimerRef.current);
                    postFixReloadTimerRef.current = null;
                }
                setPreviewError(null);
                setShowErrorDetails(false);
            } else if (event.data.source === "zephyre-preview-mounted") {
                if (postFixReloadTimerRef.current) {
                    clearTimeout(postFixReloadTimerRef.current);
                    postFixReloadTimerRef.current = null;
                }
                setIsIframeLoading(false);
                setPreviewError(null);
            } else if (event.data.source === "zephyre-request-restart") {
                if (fileDataRef.current) {
                    toast.info("Restarting cloud sandbox...");
                    startSandboxRef.current(fileDataRef.current, sandboxIdRef.current);
                }
            } else if (event.data.source === "zephyre-element-inspected") {
                setIsInspectorActive(false);
                const tag = event.data.tagName || "element";
                const text = event.data.textSnippet ? ` "${event.data.textSnippet}"` : "";
                const label = event.data.componentHint
                    ? `${event.data.componentHint} (<${tag}>)`
                    : `<${tag}>${text}`;
                onInspectElement?.(label);
                toast.success(`Target element selected: ${label}`);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onInspectElement]);

    const handleToggleInspector = useCallback(() => {
        setIsInspectorActive((prev) => {
            const next = !prev;
            try {
                iframeRef.current?.contentWindow?.postMessage({
                    type: "zephyre-toggle-inspector",
                    enabled: next,
                }, "*");
            } catch {}
            if (next) {
                toast.info("Click any element in the preview to target it in your prompt");
            }
            return next;
        });
    }, []);

    // Combine preview runtime/compile error with initial boot sandbox error
    const activeError = useMemo(() => {
        if (previewError) return previewError;
        if (sandboxError) return parseRawError(sandboxError);
        return null;
    }, [previewError, sandboxError]);

    const handleFixActiveError = useCallback(async () => {
        if (!activeError || !fileData) return;
        setIsFixingError(true);
        pendingFixSyncRef.current = true;
        try {
            const prompt = buildErrorFixPrompt(activeError, fileData);
            const display = formatErrorFixDisplay(activeError);
            await onFixError(prompt, display);
        } catch (err) {
            pendingFixSyncRef.current = false;
            console.error("[CodePanel] Fix error failed:", err);
            toast.error("Auto-fix failed. Please try again.");
        } finally {
            setIsFixingError(false);
        }
    }, [activeError, fileData, onFixError]);

    const [searchQuery, setSearchQuery] = useState("");

    // De-duplicate files: If /src/App.jsx exists, suppress any legacy root /App.jsx
    const files = useMemo(() => {
        const raw = fileData?.files ?? {};
        const cleaned: Record<string, { code: string }> = {};
        for (const [k, v] of Object.entries(raw)) {
            if (k === "/App.jsx" && (raw["/src/App.jsx"] || raw["src/App.jsx"])) continue;
            cleaned[k] = v;
        }
        return cleaned;
    }, [fileData?.files]);

    const fileList = useMemo(() => Object.keys(files), [files]);

    const filteredFileList = useMemo(() => {
        if (!searchQuery.trim()) return fileList;
        const q = searchQuery.toLowerCase();
        return fileList.filter((path) => path.toLowerCase().includes(q));
    }, [fileList, searchQuery]);

    const fileTree = useMemo(() => buildFileTree(filteredFileList), [filteredFileList]);

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
    const isStartingRef = useRef(false);

    const startSandbox = useCallback(async (data: FileData, previousId?: string | null) => {
        if (!data.files || Object.keys(data.files).length === 0) return;
        if (isStartingRef.current) return;
        isStartingRef.current = true;
        pendingFixSyncRef.current = false;

        setIsStartingSandbox(true);
        setSandboxError(null);

        try {
            const res = await fetch("/api/sandbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "start",
                    fileData: data,
                    previousSandboxId: previousId || sandboxIdRef.current || undefined,
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
            isStartingRef.current = false;
            setIsStartingSandbox(false);
        }
    }, []);

    useEffect(() => {
        startSandboxRef.current = startSandbox;
    }, [startSandbox]);

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
            } else if (pendingFixSyncRef.current || previewErrorRef.current?.category === "compile") {
                pendingFixSyncRef.current = false;
                if (postFixReloadTimerRef.current) {
                    clearTimeout(postFixReloadTimerRef.current);
                }
                // Give Vite HMR 1200ms to clear/remount naturally; if still stuck on a fatal boot error, soft-reload iframe
                postFixReloadTimerRef.current = setTimeout(() => {
                    postFixReloadTimerRef.current = null;
                    const currentUrl = previewUrlRef.current;
                    if (iframeRef.current && currentUrl && previewErrorRef.current) {
                        const sep = currentUrl.includes("?") ? "&" : "?";
                        iframeRef.current.src = `${currentUrl}${sep}_fix=${Date.now()}`;
                    }
                }, 1200);
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

    // Self-healing preview watchdog: verifies container and dev-server health
    useEffect(() => {
        if (!sandboxId || !previewUrl || isGenerating || isStartingSandbox) return;

        let isCancelled = false;
        const checkHealth = async () => {
            if (isCancelled) return;
            try {
                const res = await fetch("/api/sandbox", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "health", sandboxId }),
                });
                const data = await res.json();
                if (isCancelled) return;

                if (!res.ok) {
                    if (res.status === 404 || data.code === "SANDBOX_EXPIRED") {
                        console.warn("[CodePanel] Sandbox expired during health check, reviving...");
                        if (fileDataRef.current) {
                            startSandboxRef.current(fileDataRef.current, null);
                        }
                    }
                } else if (data.status === "restarted") {
                    console.info("[CodePanel] Vite dev server was revived by supervisor, refreshing preview...");
                    if (iframeRef.current && previewUrl) {
                        const separator = previewUrl.includes("?") ? "&" : "?";
                        iframeRef.current.src = `${previewUrl}${separator}_t=${Date.now()}`;
                    }
                }
            } catch {}
        };

        // Dual-pass health check (3s and 10s) to auto-heal cold boots and transient 502s
        const timer1 = setTimeout(checkHealth, 3000);
        const timer2 = setTimeout(checkHealth, 10000);

        return () => {
            isCancelled = true;
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [sandboxId, previewUrl, isGenerating, isStartingSandbox]);

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

    // Reload iframe with cache-busting timestamp & container health verification
    const handleRefreshIframe = async () => {
        if (!previewUrl) return;
        setIsIframeLoading(true);
        if (sandboxId) {
            try {
                await fetch("/api/sandbox", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "health", sandboxId }),
                });
            } catch {}
        }
        if (iframeRef.current) {
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
                        {/* Desktop Chat Open Toggle */}
                        {onToggleChat && !isChatOpen && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onToggleChat}
                                title="Open Chat"
                                className="hidden md:flex h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
                            >
                                <PanelLeftOpen className="h-4 w-4" />
                            </Button>
                        )}

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

                                {/* Click-to-Inspect Element Selector */}
                                <button
                                    onClick={handleToggleInspector}
                                    title={isInspectorActive ? "Click any element in preview to target it (Active)" : "Inspect element to target in prompt"}
                                    className={cn(
                                        "p-1.5 rounded-lg border transition-all shrink-0 cursor-pointer flex items-center gap-1",
                                        isInspectorActive
                                            ? "border-orange-500/60 bg-orange-500/20 text-orange-400 shadow-sm shadow-orange-500/30"
                                            : "border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    <Crosshair className={`h-3.5 w-3.5 ${isInspectorActive ? "animate-spin text-orange-400" : ""}`} />
                                    <span className="hidden xl:inline text-[10px] font-mono font-medium">Inspect</span>
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
                    {/* Preview Frame Container (Kept mounted to preserve live HMR & prevent 502/reload flash) */}
                    {previewUrl ? (
                        <div
                            className={`relative h-full w-full flex flex-col transition-all duration-300 ${
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

                                {/* Non-destructive Generation / Booting Overlay */}
                                {(isGenerating || isStartingSandbox) && (
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-xs p-6 text-center animate-in fade-in duration-200">
                                        <RingLoader color="#f97316" size={54} />
                                        <div className="max-w-xs space-y-1">
                                            <p className="text-sm font-semibold text-white">
                                                {isGenerating ? "Updating Application…" : "Booting sandbox…"}
                                            </p>
                                            <p className="text-xs text-zinc-400">
                                                {statusLog[statusLog.length - 1]?.label || "Applying changes and synchronizing sandbox…"}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ─── Floating Horizontal Error Recovery Bar in Preview ─── */}
                                {activeError && (
                                    <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-col rounded-xl border border-rose-500/40 bg-[#14080b]/95 backdrop-blur-md shadow-2xl p-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                                    <AlertTriangle className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-rose-200">
                                                            {activeError.file ? `${activeError.file}${activeError.line ? `:${activeError.line}` : ""}` : "Runtime Error"}
                                                        </span>
                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300">
                                                            {activeError.category || "compile error"}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-rose-300/80 truncate font-mono mt-0.5 max-w-lg">
                                                        {activeError.message}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {activeError.codeFrame && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setShowErrorDetails((prev) => !prev)}
                                                        className="h-7 px-2 text-[11px] text-rose-300 hover:text-white hover:bg-rose-500/20"
                                                    >
                                                        {showErrorDetails ? "Hide Details" : "View Details"}
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    disabled={isGenerating || isImproving || isFixingError}
                                                    onClick={handleFixActiveError}
                                                    className="h-7.5 px-3 text-xs font-medium text-white bg-linear-to-r from-orange-500 via-rose-500 to-amber-500 hover:opacity-90 shadow-md shadow-rose-950/50 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                                                >
                                                    {isGenerating || isImproving || isFixingError ? (
                                                        <>
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            <span>Fixing…</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wand2 className="h-3.5 w-3.5" />
                                                            <span>Fix now</span>
                                                        </>
                                                    )}
                                                </Button>
                                                <button
                                                    onClick={() => {
                                                        setPreviewError(null);
                                                        setSandboxError(null);
                                                    }}
                                                    className="p-1 rounded-md text-rose-400/80 hover:text-white hover:bg-rose-500/20 transition-colors cursor-pointer"
                                                    title="Dismiss"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Collapsible Error Code Frame & Stack Trace Details */}
                                        {showErrorDetails && (
                                            <div className="mt-2.5 pt-2.5 border-t border-rose-500/20 text-xs font-mono">
                                                {activeError.codeFrame ? (
                                                    <pre className="p-2.5 rounded bg-black/70 text-rose-200 overflow-x-auto text-[11px] leading-relaxed max-h-36 no-scrollbar">
                                                        {activeError.codeFrame}
                                                    </pre>
                                                ) : activeError.stack ? (
                                                    <pre className="p-2.5 rounded bg-black/70 text-rose-300/80 overflow-x-auto text-[11px] leading-relaxed max-h-36 no-scrollbar">
                                                        {activeError.stack}
                                                    </pre>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Empty or Pre-booting states when no previewUrl yet */}
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

                            {!isGenerating && isStartingSandbox && (
                                <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                                    <div className="max-w-xs space-y-1">
                                        <p className="text-sm font-semibold text-white">Loading...</p>
                                    </div>
                                </div>
                            )}

                            {!isGenerating && !isStartingSandbox && sandboxError && (
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
                                            disabled={isGenerating || isImproving || isFixingError}
                                            onClick={handleFixActiveError}
                                            className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        >
                                            <Bot className="h-3.5 w-3.5 mr-1.5" />
                                            {isFixingError ? "Fixing…" : "Fix with AI"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {!isGenerating && !isStartingSandbox && !sandboxError && (
                                <div className="flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                                    <div className="text-4xl mb-3">⚡</div>
                                    <p className="text-sm font-medium text-zinc-400">Your live application will appear here</p>
                                    <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                                        Enter a prompt in the chat panel to generate your full-stack app.
                                    </p>
                                </div>
                            )}
                        </>
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
                        {/* Search code input */}
                        <div className="p-2 border-b border-white/5">
                            <div className="relative flex items-center">
                                <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search code"
                                    className="w-full h-8 pl-8 pr-7 rounded-lg bg-black/40 border border-white/8 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2 p-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="h-8 shrink-0 px-3 border-b border-white/5 flex items-center justify-between text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                            <span>Explorer</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                                {filteredFileList.length} {filteredFileList.length === 1 ? "file" : "files"}
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
                                    isSearching={Boolean(searchQuery.trim())}
                                />
                            ))}
                            {filteredFileList.length === 0 && (
                                <div className="p-4 text-center text-xs text-zinc-500">
                                    No files matching &quot;{searchQuery}&quot;
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Code Editor powered by CodeMirror 6 */}
                    <div className="relative flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                        <CodeMirrorEditor
                            value={selectedCode}
                            filePath={activeFile}
                            onChange={handleCodeChange}
                            readOnly={isGenerating}
                            isSyncing={isSyncing}
                            getFileIcon={getFileIcon}
                        />

                        {/* Floating Horizontal Error Recovery Bar in Code Editor */}
                        {activeError && (
                            <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-col rounded-xl border border-rose-500/40 bg-[#14080b]/95 backdrop-blur-md shadow-2xl p-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-rose-200">
                                                    {activeError.file ? `${activeError.file}${activeError.line ? `:${activeError.line}` : ""}` : "Syntax Error"}
                                                </span>
                                                <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300">
                                                    {activeError.category || "compile error"}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-rose-300/80 truncate font-mono mt-0.5 max-w-lg">
                                                {activeError.message}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {activeError.codeFrame && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setShowErrorDetails((prev) => !prev)}
                                                className="h-7 px-2 text-[11px] text-rose-300 hover:text-white hover:bg-rose-500/20"
                                            >
                                                {showErrorDetails ? "Hide Details" : "View Details"}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            disabled={isGenerating || isImproving || isFixingError}
                                            onClick={handleFixActiveError}
                                            className="h-7.5 px-3 text-xs font-medium text-white bg-linear-to-r from-orange-500 via-rose-500 to-amber-500 hover:opacity-90 shadow-md shadow-rose-950/50 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            {isGenerating || isImproving || isFixingError ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>Fixing…</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Wand2 className="h-3.5 w-3.5" />
                                                    <span>Fix now</span>
                                                </>
                                            )}
                                        </Button>
                                        <button
                                            onClick={() => {
                                                setPreviewError(null);
                                                setSandboxError(null);
                                            }}
                                            className="p-1 rounded-md text-rose-400/80 hover:text-white hover:bg-rose-500/20 transition-colors cursor-pointer"
                                            title="Dismiss"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {showErrorDetails && (
                                    <div className="mt-2.5 pt-2.5 border-t border-rose-500/20 text-xs font-mono">
                                        {activeError.codeFrame ? (
                                            <pre className="p-2.5 rounded bg-black/70 text-rose-200 overflow-x-auto text-[11px] leading-relaxed max-h-36 no-scrollbar">
                                                {activeError.codeFrame}
                                            </pre>
                                        ) : activeError.stack ? (
                                            <pre className="p-2.5 rounded bg-black/70 text-rose-300/80 overflow-x-auto text-[11px] leading-relaxed max-h-36 no-scrollbar">
                                                {activeError.stack}
                                            </pre>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
