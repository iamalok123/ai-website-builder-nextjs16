// Workspace & Chat Types 

export type MessageRole = "user" | "assistant";

export interface AttachedFile {
    name: string;
    type: string;
    size: number;
    url?: string;
    content?: string;
    base64?: string;
}

export interface Message {
    role: MessageRole;
    content: string;
    displayContent?: string;
    imageUrl?: string;
    attachedFiles?: AttachedFile[];
}

// Files + Dependencies always travel together in one unit
// This is what gets saved to prisma as a single Json column 
export interface FileData {
    files: Record<string, { code: string }>;
    dependencies: Record<string, string>;
    title?: string;
}

export interface StatusStep {
    label: string;
    status: "running" | "done";
}

export interface WorkspaceData {
    id: string;
    title: string | null;
    messages: unknown;
    fileData: unknown;
}

export interface WorkspaceUser {
    id: string;
    credits: number;
    plan: string;
}
