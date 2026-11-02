import type { AttachedFile } from "@/types/workspace";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS_PER_REQUEST = 5;

export type AttachmentCategory = "image" | "pdf" | "text" | "data" | "code";

const ALLOWED_EXTENSIONS: Record<string, AttachmentCategory> = {
    // Images (Gemini Vision)
    png: "image",
    jpg: "image",
    jpeg: "image",
    webp: "image",
    svg: "image",
    gif: "image",

    // Documents
    pdf: "pdf",

    // Documentation & Text
    md: "text",
    markdown: "text",
    txt: "text",

    // Data Schemas & Records
    json: "data",
    csv: "data",

    // Code & Markup
    js: "code",
    jsx: "code",
    ts: "code",
    tsx: "code",
    html: "code",
    css: "code",
    py: "code",
    sql: "code",
};

const BLOCKED_EXTENSIONS = new Set([
    "exe",
    "bat",
    "cmd",
    "sh",
    "bin",
    "dll",
    "msi",
    "vbs",
    "ps1",
    "apk",
    "dmg",
    "zip",
    "tar",
    "gz",
    "7z",
    "rar",
    "iso",
]);

/**
 * Validates a user-supplied file against security guardrails and Gemini input constraints
 */
export function validateAttachment(file: File): {
    valid: boolean;
    error?: string;
    category?: AttachmentCategory;
} {
    if (!file) {
        return { valid: false, error: "No file provided" };
    }

    if (file.size === 0) {
        return { valid: false, error: `"${file.name}" is empty (0 bytes).` };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            error: `"${file.name}" exceeds the 10MB limit (${formatFileSize(file.size)}). Please choose a smaller file.`,
        };
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();

    if (BLOCKED_EXTENSIONS.has(ext)) {
        return {
            valid: false,
            error: `Executable and archive files (.${ext}) are not allowed for security reasons.`,
        };
    }

    const category = ALLOWED_EXTENSIONS[ext] || (file.type.startsWith("image/") ? "image" : undefined);

    if (!category) {
        return {
            valid: false,
            error: `File type ".${ext || "unknown"}" is not supported. Please upload an image, PDF, Markdown, JSON, CSV, or code file.`,
        };
    }

    return { valid: true, category };
}

/**
 * Formats byte size into human readable string
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reads a File object into an AttachedFile structure with base64/content and optional Supabase URL
 */
export async function processFileAttachment(
    file: File,
    options?: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseClient?: any;
        userId?: string;
        workspaceId?: string;
    }
): Promise<AttachedFile> {
    const validation = validateAttachment(file);
    if (!validation.valid || !validation.category) {
        throw new Error(validation.error || "Invalid file");
    }

    const { category } = validation;
    const name = file.name;
    const type = file.type || `application/octet-stream`;
    const size = file.size;

    let content: string | undefined;
    let base64: string | undefined;
    let url: string | undefined;

    // 1. Extract content or base64 based on file category
    if (category === "text" || category === "data" || category === "code") {
        content = await file.text();
    } else {
        // Binary files (images, PDFs)
        base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const res = reader.result as string;
                // Strip the data URL prefix (e.g. "data:image/png;base64,")
                const commaIdx = res.indexOf(",");
                if (commaIdx !== -1) {
                    resolve(res.slice(commaIdx + 1));
                } else {
                    resolve(res);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    // 2. Best-effort Supabase upload for persistent URLs (images)
    if (options?.supabaseClient && options.userId && category === "image") {
        try {
            const rawExt = name.split(".").pop() || "png";
            const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
            const path = `${options.userId}/${options.workspaceId ?? "home"}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

            const { error: uploadError } = await options.supabaseClient.storage
                .from("workspace-images")
                .upload(path, file, { upsert: true });

            if (!uploadError) {
                const { data } = options.supabaseClient.storage
                    .from("workspace-images")
                    .getPublicUrl(path);
                if (data?.publicUrl) {
                    url = data.publicUrl;
                }
            }
        } catch {
            // Silently fall back to base64; Gemini will still receive the full binary payload
        }
    }

    return {
        name,
        type,
        size,
        content,
        base64,
        url,
    };
}
