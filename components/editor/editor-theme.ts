import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { Extension } from "@codemirror/state";

/**
 * Pure Black Editor Chrome Theme
 * High contrast, deep pure black background (#000000) with subtle borders,
 * glowing active line numbers, and clean selection indicators.
 */
export const pureBlackTheme: Extension = EditorView.theme(
    {
        "&": {
            backgroundColor: "#000000 !important",
            color: "#f8fafc",
            height: "100%",
        },
        ".cm-scroller": {
            fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: "13px",
            lineHeight: "1.65",
            overflow: "auto",
        },
        ".cm-content": {
            caretColor: "#f97316",
            padding: "10px 0",
        },
        "&.cm-focused .cm-cursor": {
            borderLeftColor: "#f97316",
            borderLeftWidth: "2px",
        },
        "&.cm-focused .cm-selectionBackground, ::selection, .cm-selectionMatch": {
            backgroundColor: "rgba(249, 115, 22, 0.28) !important",
        },
        ".cm-gutters": {
            backgroundColor: "#000000 !important",
            color: "#52525b",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            paddingRight: "6px",
            minWidth: "42px",
        },
        ".cm-activeLineGutter": {
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            color: "#fb923c !important",
            fontWeight: "bold",
        },
        ".cm-activeLine": {
            backgroundColor: "rgba(255, 255, 255, 0.03) !important",
        },
        ".cm-foldGutter": {
            color: "#71717a",
        },
        ".cm-foldPlaceholder": {
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            color: "#a1a1aa",
            padding: "0 4px",
            borderRadius: "4px",
        },
        ".cm-panels": {
            backgroundColor: "#0e0e14",
            color: "#ffffff",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        },
        ".cm-panels.cm-panels-top": {
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        },
        ".cm-search": {
            backgroundColor: "#0e0e14 !important",
            color: "#ffffff !important",
        },
        ".cm-search input": {
            backgroundColor: "#181824 !important",
            border: "1px solid rgba(255, 255, 255, 0.15) !important",
            color: "#ffffff !important",
            borderRadius: "4px",
            padding: "2px 6px",
        },
        ".cm-search button": {
            backgroundColor: "rgba(255, 255, 255, 0.08) !important",
            color: "#ffffff !important",
            borderRadius: "4px",
            padding: "2px 8px",
            cursor: "pointer",
        },
        ".cm-tooltip": {
            backgroundColor: "#0e0e14 !important",
            border: "1px solid rgba(255, 255, 255, 0.15) !important",
            borderRadius: "6px",
            color: "#ffffff !important",
        },
    },
    { dark: true }
);

/**
 * Bright High-Contrast Syntax Highlighting
 * Rich neon/vivid color palette designed to pop against pure black.
 */
export const brightSyntaxHighlighting: Extension = syntaxHighlighting(
    HighlightStyle.define([
        // Keywords & Control: Hot Pink / Magenta (#ff79c6)
        {
            tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword],
            color: "#ff79c6",
            fontWeight: "bold",
        },
        // Functions & Methods: Bright Electric Cyan (#38bdf8)
        {
            tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
            color: "#38bdf8",
            fontWeight: "600",
        },
        // JSX / HTML Tags: Radiant Sunset Orange (#fb923c)
        {
            tag: [tags.tagName, tags.heading],
            color: "#fb923c",
            fontWeight: "bold",
        },
        // JSX / HTML Attributes: Bright Amber / Yellow (#facc15)
        {
            tag: [tags.attributeName, tags.propertyName],
            color: "#facc15",
        },
        // Strings & Attribute Values: Vibrant Emerald Green (#4ade80)
        {
            tag: [tags.string, tags.special(tags.string), tags.attributeValue],
            color: "#4ade80",
        },
        // Numbers, Booleans, Constants: Radiant Purple (#bd93f9)
        {
            tag: [tags.number, tags.integer, tags.float, tags.bool, tags.atom, tags.null],
            color: "#bd93f9",
            fontWeight: "bold",
        },
        // Types & Classes: Warm Tangerine / Gold (#fcd34d)
        {
            tag: [tags.typeName, tags.className, tags.labelName],
            color: "#fcd34d",
            fontWeight: "600",
        },
        // Operators & Punctuation: Neon Coral / Rose (#fb7185)
        {
            tag: [tags.operator, tags.derefOperator],
            color: "#fb7185",
        },
        // Brackets & Braces: Crisp Slate Light (#e2e8f0)
        {
            tag: [tags.brace, tags.bracket, tags.punctuation, tags.separator],
            color: "#cbd5e1",
        },
        // Variables & Defaults: Clean Ice White (#f8fafc)
        {
            tag: [tags.variableName, tags.name, tags.character],
            color: "#f8fafc",
        },
        // Comments: Elegant Zinc Muted (#71717a)
        {
            tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
            color: "#71717a",
            fontStyle: "italic",
        },
        // Meta / Decorators: Sky Blue (#7dd3fc)
        {
            tag: [tags.meta, tags.annotation, tags.modifier],
            color: "#7dd3fc",
        },
        // Links: Underlined Cyan (#38bdf8)
        {
            tag: tags.link,
            color: "#38bdf8",
            textDecoration: "underline",
        },
        // Invalid syntax: Warning Red (#f43f5e)
        {
            tag: tags.invalid,
            color: "#f43f5e",
            textDecoration: "underline wavy",
        },
    ])
);

/**
 * Resolves CodeMirror 6 language parser extension from file extension
 */
export function getLanguageExtension(filePath: string): Extension[] {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".tsx")) {
        return [javascript({ jsx: true, typescript: true })];
    }
    if (lower.endsWith(".ts")) {
        return [javascript({ jsx: false, typescript: true })];
    }
    if (lower.endsWith(".jsx")) {
        return [javascript({ jsx: true, typescript: false })];
    }
    if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
        return [javascript({ jsx: false, typescript: false })];
    }
    if (lower.endsWith(".html") || lower.endsWith(".svg")) {
        return [html()];
    }
    if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".less")) {
        return [css()];
    }
    if (lower.endsWith(".json") || lower.endsWith(".jsonc")) {
        return [json()];
    }
    return [];
}

/**
 * Human-readable language descriptor for status bar
 */
export function getLanguageName(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".tsx")) return "TypeScript JSX";
    if (lower.endsWith(".ts")) return "TypeScript";
    if (lower.endsWith(".jsx")) return "React JSX";
    if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "JavaScript";
    if (lower.endsWith(".html")) return "HTML";
    if (lower.endsWith(".svg")) return "SVG XML";
    if (lower.endsWith(".css")) return "CSS";
    if (lower.endsWith(".json")) return "JSON";
    if (lower.endsWith(".md")) return "Markdown";
    return "Plain Text";
}

/**
 * Format raw byte size into human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    const kb = (bytes / 1024).toFixed(1);
    return `${kb} KB`;
}
