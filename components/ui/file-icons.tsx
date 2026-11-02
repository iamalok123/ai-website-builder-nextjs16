import React from "react";

interface IconProps {
    className?: string;
}

// ─── Individual Brand & File Type SVGs ─────────────────────────────────────

export function ReactIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="React">
            <circle cx="12" cy="12" r="2.2" fill="#00D8FF" />
            <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#00D8FF" strokeWidth="1.3" fill="none" />
            <ellipse
                cx="12"
                cy="12"
                rx="10"
                ry="4"
                stroke="#00D8FF"
                strokeWidth="1.3"
                fill="none"
                transform="rotate(60 12 12)"
            />
            <ellipse
                cx="12"
                cy="12"
                rx="10"
                ry="4"
                stroke="#00D8FF"
                strokeWidth="1.3"
                fill="none"
                transform="rotate(120 12 12)"
            />
        </svg>
    );
}

export function TypeScriptIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="TypeScript">
            <rect width="24" height="24" rx="4" fill="#3178C6" />
            <path
                d="M5.5 8.5H13.5M9.5 8.5V18"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M14.5 15.5C15 17 16.5 18 18.5 17.5C20 17 20 15.5 19 14.5C17.5 13.5 15.5 13.5 15 12C14.5 10.5 15.5 9 17.5 9C19 9 20 9.8 20.5 11"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function JavaScriptIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="JavaScript">
            <rect width="24" height="24" rx="4" fill="#F7DF1E" />
            <path
                d="M7 16C7.5 17.2 8.7 18 10 17.8C11.5 17.5 11.8 16 11.8 13.5V9.5"
                stroke="#000000"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M14.5 15.5C15 17 16.5 18 18.5 17.5C20 17 20 15.5 19 14.5C17.5 13.5 15.5 13.5 15 12C14.5 10.5 15.5 9 17.5 9C19 9 20 9.8 20.5 11"
                stroke="#000000"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function JsonIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="JSON">
            <path
                d="M8 5C6.5 5 6 6 6 7.5V10C6 11.5 5 12 4 12C5 12 6 12.5 6 14V16.5C6 18 6.5 19 8 19"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M16 5C17.5 5 18 6 18 7.5V10C18 11.5 19 12 20 12C19 12 18 12.5 18 14V16.5C18 18 17.5 19 16 19"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function NodeIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Node.js">
            <polygon points="12,2 21,7.2 21,16.8 12,22 3,16.8 3,7.2" fill="#5FA04E" />
            <path
                d="M8.5 14.5C9 15.2 9.8 15.6 10.5 15.4C11.3 15.2 11.5 14.2 11.5 12.8V10"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M13.5 13.8C14 14.8 15 15.3 16 15C17 14.7 17 13.8 16.5 13.2C15.8 12.5 14.2 12.3 14 11.2C13.8 10.2 14.5 9.2 15.8 9.2C16.8 9.2 17.5 9.7 17.8 10.5"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function NpmIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="NPM">
            <rect width="24" height="24" rx="3" fill="#CB3837" />
            <path
                d="M6 7H18V17H13.5V10.5H10.5V17H6V7Z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function GitIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Git">
            <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" transform="rotate(45 12 12)" fill="#F05032" />
            <circle cx="8" cy="12" r="1.8" fill="#FFFFFF" />
            <circle cx="16" cy="12" r="1.8" fill="#FFFFFF" />
            <circle cx="12" cy="16" r="1.8" fill="#FFFFFF" />
            <path d="M8 12H16M12 12V16" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

export function MarkdownIcon({ className = "h-3.5 w-3.5 shrink-0", color = "#38BDF8" }: IconProps & { color?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Markdown">
            <rect width="24" height="18" x="0" y="3" rx="3" stroke={color} strokeWidth="2" />
            <path d="M4 15V9L7 12.5L10 9V15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 9V15M14.5 12.5L17 15L19.5 12.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ReadmeIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="README">
            <circle cx="12" cy="12" r="10" fill="#0EA5E9" />
            <circle cx="12" cy="7.5" r="1.5" fill="#FFFFFF" />
            <path d="M12 11V17M10.5 11H12M10.5 17H13.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function HtmlIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="HTML">
            <path d="M4 3L5.6 20L12 22L18.4 20L20 3H4Z" fill="#E34F26" />
            <path d="M12 4.8V20.2L16.8 18.6L18.2 4.8H12Z" fill="#EF652A" />
            <path
                d="M8.5 8H15.5L15.2 11.2H8.8L9.1 14.5L12 15.3L14.9 14.5L15 13H16.8L16.5 16.2L12 17.5L7.5 16.2L7 11.2H13.5L13.7 9.6H7L8.5 8Z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function CssIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="CSS">
            <path d="M4 3L5.6 20L12 22L18.4 20L20 3H4Z" fill="#1572B6" />
            <path d="M12 4.8V20.2L16.8 18.6L18.2 4.8H12Z" fill="#33A9DC" />
            <path
                d="M8 8H16L15.6 11.5H10.5L10.8 14H15.3L14.8 16.5L12 17.3L9.2 16.5L9 14.5H7.2L7.6 17.8L12 19L16.4 17.8L17.2 9.6H8.2L8 8Z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function SassIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Sass">
            <rect width="24" height="24" rx="4" fill="#CF649A" />
            <path
                d="M6 14C7 16.5 11 16.5 11.5 14C12 11.5 7.5 11 8.5 8.5C9.2 6.5 12.5 6.5 13.5 8.5"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function NextJsIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Next.js">
            <circle cx="12" cy="12" r="11" fill="#000000" stroke="#3F3F46" strokeWidth="1.5" />
            <path d="M8 7.5V16.5M16 11V16.5M8 7.5L16.5 18" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function VitestIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Vitest">
            <path d="M4 13L9 18L20 6" stroke="#22C55E" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function TailwindIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Tailwind CSS">
            <path
                d="M12 6C9.6 6 8.1 7.2 7.5 9.6C8.4 8.4 9.45 8.1 10.65 8.7C11.55 9.15 12.2 9.85 12.95 10.6C14.15 11.8 15.5 13.2 18.5 13.2C20.9 13.2 22.4 12 23 9.6C22.1 10.8 21.05 11.1 19.85 10.5C18.95 10.05 18.3 9.35 17.55 8.6C16.35 7.4 15 6 12 6ZM5.5 12C3.1 12 1.6 13.2 1 15.6C1.9 14.4 2.95 14.1 4.15 14.7C5.05 15.15 5.7 15.85 6.45 16.6C7.65 17.8 9 19.2 12 19.2C14.4 19.2 15.9 18 16.5 15.6C15.6 16.8 14.55 17.1 13.35 16.5C12.45 16.05 11.8 15.35 11.05 14.6C9.85 13.4 8.5 12 5.5 12Z"
                fill="#38BDF8"
            />
        </svg>
    );
}

export function EslintIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="ESLint">
            <polygon points="12,2 21,7.2 21,16.8 12,22 3,16.8 3,7.2" fill="#4B32C3" />
            <polygon points="12,6 18,12 12,18 6,12" fill="#8080F2" />
        </svg>
    );
}

export function PrettierIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Prettier">
            <rect x="3" y="4" width="7" height="3" rx="1.5" fill="#F43F5E" />
            <rect x="12" y="4" width="9" height="3" rx="1.5" fill="#38BDF8" />
            <rect x="3" y="9.5" width="11" height="3" rx="1.5" fill="#F59E0B" />
            <rect x="16" y="9.5" width="5" height="3" rx="1.5" fill="#10B981" />
            <rect x="3" y="15" width="8" height="3" rx="1.5" fill="#A855F7" />
            <rect x="13" y="15" width="8" height="3" rx="1.5" fill="#EC4899" />
        </svg>
    );
}

export function PostCssIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="PostCSS">
            <circle cx="12" cy="12" r="10" fill="#DD3A0A" />
            <polygon points="12,5 18,17 6,17" fill="#FFFFFF" />
            <polygon points="12,8 16,16 8,16" fill="#DD3A0A" />
        </svg>
    );
}

export function PrismaIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Prisma">
            <path d="M13.5 3L20 18.5L8.5 21L3.5 16.5L13.5 3Z" fill="#16A39A" />
            <path d="M13.5 3L8.5 21L3.5 16.5L13.5 3Z" fill="#2DD4BF" />
        </svg>
    );
}

export function VercelIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Vercel">
            <polygon points="12,4 22,20 2,20" fill="#FFFFFF" />
        </svg>
    );
}

export function EnvIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Environment">
            <circle cx="12" cy="12" r="9" fill="#EAB308" />
            <circle cx="12" cy="10" r="3" fill="#18181B" />
            <path d="M10.5 12H13.5V17H10.5V12Z" fill="#18181B" />
        </svg>
    );
}

export function YamlIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="YAML">
            <path d="M5 3C4.4 3 4 3.4 4 4V20C4 20.6 4.4 21 5 21H19C19.6 21 20 20.6 20 20V8L15 3H5Z" fill="#EF4444" />
            <polygon points="15,3 15,8 20,8" fill="#FCA5A5" />
            <text x="6" y="17" fill="#FFFFFF" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
                YML
            </text>
        </svg>
    );
}

export function PythonIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Python">
            <path
                d="M11.8 2C6.8 2 7.1 4.2 7.1 4.2L7.1 6.5H12V7.2H5.1C5.1 7.2 2 6.8 2 11.8C2 16.8 4.7 16.6 4.7 16.6H6.3V14.3C6.3 14.3 6.2 11.6 8.9 11.6H13.8C13.8 11.6 16.4 11.7 16.4 9.1V4.3C16.4 4.3 16.8 2 11.8 2ZM9.5 3.5C10.1 3.5 10.6 4 10.6 4.6C10.6 5.2 10.1 5.7 9.5 5.7C8.9 5.7 8.4 5.2 8.4 4.6C8.4 4 8.9 3.5 9.5 3.5Z"
                fill="#387EB8"
            />
            <path
                d="M12.2 22C17.2 22 16.9 19.8 16.9 19.8L16.9 17.5H12V16.8H18.9C18.9 16.8 22 17.2 22 12.2C22 7.2 19.3 7.4 19.3 7.4H17.7V9.7C17.7 9.7 17.8 12.4 15.1 12.4H10.2C10.2 12.4 7.6 12.3 7.6 14.9V19.7C7.6 19.7 7.2 22 12.2 22ZM14.5 20.5C13.9 20.5 13.4 20 13.4 19.4C13.4 18.8 13.9 18.3 14.5 18.3C15.1 18.3 15.6 18.8 15.6 19.4C15.6 20 15.1 20.5 14.5 20.5Z"
                fill="#FFE052"
            />
        </svg>
    );
}

export function ImageIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Image">
            <rect width="20" height="16" x="2" y="4" rx="3" stroke="#A855F7" strokeWidth="2" />
            <circle cx="8" cy="9" r="1.5" fill="#A855F7" />
            <path d="M4 17L9 12L13 16L16 13L20 17" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function SvgIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="SVG">
            <rect width="20" height="16" x="2" y="4" rx="3" stroke="#F97316" strokeWidth="2" />
            <circle cx="8" cy="9" r="1.5" fill="#F97316" />
            <circle cx="16" cy="14" r="1.5" fill="#F97316" />
            <path d="M8 9C12 9 12 14 16 14" stroke="#F97316" strokeWidth="2" />
        </svg>
    );
}

export function DatabaseIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Database">
            <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#38BDF8" strokeWidth="2" />
            <path d="M4 6V12C4 13.6 7.6 15 12 15C16.4 15 20 13.6 20 12V6" stroke="#38BDF8" strokeWidth="2" />
            <path d="M4 12V18C4 19.6 7.6 21 12 21C16.4 21 20 19.6 20 18V12" stroke="#38BDF8" strokeWidth="2" />
        </svg>
    );
}

export function RobotIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Agent / Robot">
            <rect x="4" y="6" width="16" height="14" rx="3" fill="#F43F5E" />
            <circle cx="9" cy="12" r="1.8" fill="#FFFFFF" />
            <circle cx="15" cy="12" r="1.8" fill="#FFFFFF" />
            <path d="M9 16H15" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M12 2V6M9 2H15" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export function ClaudeIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Claude">
            <circle cx="12" cy="12" r="2.5" fill="#D97706" />
            <path
                d="M12 2V6M12 18V22M2 12H6M18 12H22M5 5L8 8M16 16L19 19M19 5L16 8M8 16L5 19"
                stroke="#D97706"
                strokeWidth="2.4"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function DefaultFileIcon({ className = "h-3.5 w-3.5 shrink-0" }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="File">
            <path
                d="M6 3C4.9 3 4 3.9 4 5V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V8L15 3H6Z"
                stroke="#94A3B8"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <polyline points="14,3 14,8 20,8" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ─── Folder Icons ──────────────────────────────────────────────────────────

export function FolderIcon({
    folderName,
    isOpen = false,
    className = "h-3.5 w-3.5 shrink-0",
}: {
    folderName: string;
    isOpen?: boolean;
    className?: string;
}) {
    const lower = folderName.toLowerCase();

    // Folder color presets matching VS Code Material Theme
    let color = "#EAB308"; // default warm folder yellow

    if (lower === "components") {
        color = "#F59E0B";
    } else if (lower === "ui") {
        color = "#A855F7";
    } else if (lower === "app" || lower === "pages") {
        color = "#EF4444";
    } else if (
        lower === "actions" ||
        lower === "api" ||
        lower === "lib" ||
        lower === "utils" ||
        lower === "hooks" ||
        lower === "services"
    ) {
        color = "#38BDF8";
    } else if (lower === ".next") {
        color = "#71717A";
    } else if (lower === ".vscode") {
        color = "#0284C7";
    } else if (lower === "tests" || lower === "__tests__") {
        color = "#22C55E";
    } else if (lower === "styles" || lower === "css") {
        color = "#06B6D4";
    } else if (lower === "public" || lower === "assets") {
        color = "#EC4899";
    }

    if (isOpen) {
        return (
            <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Folder Open">
                <path
                    d="M2 6C2 4.9 2.9 4 4 4H9L11 6H19C20.1 6 21 6.9 21 8V9H5.2C4.3 9 3.5 9.6 3.3 10.5L2 16.5V6Z"
                    fill={color}
                    fillOpacity="0.75"
                />
                <path
                    d="M3.2 18.8L5.2 10.5C5.4 9.6 6.1 9 7 9H22.4C23.5 9 24.3 10.1 24 11.2L22 19.5C21.8 20.4 21.1 21 20.2 21H4.8C3.7 21 2.9 19.9 3.2 18.8Z"
                    fill={color}
                />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Folder Closed">
            <path
                d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z"
                fill={color}
            />
        </svg>
    );
}

// ─── Main FileIcon Component & Resolver ────────────────────────────────────

export function FileIcon({
    filename,
    className = "h-3.5 w-3.5 shrink-0",
}: {
    filename: string;
    className?: string;
}) {
    const cleanName = filename.split("/").pop() || filename;
    const lower = cleanName.toLowerCase();

    // 1. Exact Filename Matches
    if (lower === "package.json" || lower === "package-lock.json" || lower === ".node-version" || lower === ".nvmrc") {
        return <NodeIcon className={className} />;
    }
    if (lower === ".npmrc") {
        return <NpmIcon className={className} />;
    }
    if (lower === ".gitignore" || lower === ".gitattributes" || lower === ".gitmodules") {
        return <GitIcon className={className} />;
    }
    if (lower === "readme.md" || lower === "readme") {
        return <ReadmeIcon className={className} />;
    }
    if (lower === "agents.md") {
        return <RobotIcon className={className} />;
    }
    if (lower === "claude.md") {
        return <ClaudeIcon className={className} />;
    }
    if (lower.startsWith("next.config.")) {
        return <NextJsIcon className={className} />;
    }
    if (lower.startsWith("vitest.config.") || lower.startsWith("vite.config.")) {
        return <VitestIcon className={className} />;
    }
    if (lower.startsWith("tailwind.config.")) {
        return <TailwindIcon className={className} />;
    }
    if (lower.startsWith("postcss.config.")) {
        return <PostCssIcon className={className} />;
    }
    if (lower.startsWith("eslint.config.") || lower.startsWith(".eslintrc")) {
        return <EslintIcon className={className} />;
    }
    if (lower.startsWith(".prettierrc") || lower.startsWith("prettier.config.")) {
        return <PrettierIcon className={className} />;
    }
    if (lower.startsWith("prisma.config.") || lower.endsWith(".prisma")) {
        return <PrismaIcon className={className} />;
    }
    if (lower === "vercel.json") {
        return <VercelIcon className={className} />;
    }
    if (lower === "render.yaml" || lower === "render.yml") {
        return <YamlIcon className={className} />;
    }
    if (lower.startsWith(".env")) {
        return <EnvIcon className={className} />;
    }
    if (lower === "components.json" || lower === "tsconfig.tsbuildinfo") {
        return <JsonIcon className={className} />;
    }
    if (lower === "tsconfig.json" || lower === "next-env.d.ts") {
        return <TypeScriptIcon className={className} />;
    }

    // 2. Extension Matches
    if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) {
        return <ReactIcon className={className} />;
    }
    if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
        return <TypeScriptIcon className={className} />;
    }
    if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
        return <JavaScriptIcon className={className} />;
    }
    if (lower.endsWith(".json")) {
        return <JsonIcon className={className} />;
    }
    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
        return <HtmlIcon className={className} />;
    }
    if (lower.endsWith(".css")) {
        return <CssIcon className={className} />;
    }
    if (lower.endsWith(".scss") || lower.endsWith(".sass") || lower.endsWith(".less")) {
        return <SassIcon className={className} />;
    }
    if (lower.endsWith(".mdx") || lower.endsWith(".md")) {
        return <MarkdownIcon className={className} />;
    }
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
        return <YamlIcon className={className} />;
    }
    if (lower.endsWith(".py")) {
        return <PythonIcon className={className} />;
    }
    if (lower.endsWith(".svg")) {
        return <SvgIcon className={className} />;
    }
    if (
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".gif") ||
        lower.endsWith(".webp") ||
        lower.endsWith(".ico")
    ) {
        return <ImageIcon className={className} />;
    }
    if (lower.endsWith(".sql") || lower.endsWith(".sqlite") || lower.endsWith(".db")) {
        return <DatabaseIcon className={className} />;
    }

    return <DefaultFileIcon className={className} />;
}

export function getFileIcon(filename: string, className?: string): React.ReactNode {
    return <FileIcon filename={filename} className={className} />;
}