import { describe, it, expect, vi } from "vitest";

describe("Editor Code Synchronization & HMR Dual-Mirroring", () => {
    it("should dual-mirror App.jsx across root and src/ paths for Vite HMR", () => {
        const initialFiles: Record<string, { code: string }> = {
            "/src/App.jsx": { code: "export default function App() { return <div>1</div>; }" },
            "App.jsx": { code: "export default function App() { return <div>1</div>; }" },
            "/package.json": { code: '{"name": "test"}' },
        };

        const targetKey = "/src/App.jsx";
        const newCode = "export default function App() { return <div>Updated</div>; }";

        const updatedFiles: Record<string, { code: string }> = {
            ...initialFiles,
            [targetKey]: { code: newCode },
        };

        const isApp = targetKey.endsWith("App.jsx") || targetKey.endsWith("App.js");
        if (isApp) {
            if (updatedFiles["/App.jsx"]) updatedFiles["/App.jsx"] = { code: newCode };
            if (updatedFiles["App.jsx"]) updatedFiles["App.jsx"] = { code: newCode };
            if (updatedFiles["/src/App.jsx"]) updatedFiles["/src/App.jsx"] = { code: newCode };
            if (updatedFiles["src/App.jsx"]) updatedFiles["src/App.jsx"] = { code: newCode };
        }

        expect(updatedFiles["/src/App.jsx"].code).toBe(newCode);
        expect(updatedFiles["App.jsx"].code).toBe(newCode);
        expect(updatedFiles["/package.json"].code).toBe('{"name": "test"}');
    });

    it("should resolve selected file code with leading-slash tolerance", () => {
        const files: Record<string, { code: string }> = {
            "/src/index.css": { code: "body { background: #000; }" },
            "package.json": { code: "{}" },
        };

        function resolveCode(selectedFile: string): string {
            if (files[selectedFile]) return files[selectedFile].code;
            if (selectedFile.startsWith("/") && files[selectedFile.slice(1)]) {
                return files[selectedFile.slice(1)].code;
            }
            if (!selectedFile.startsWith("/") && files["/" + selectedFile]) {
                return files["/" + selectedFile].code;
            }
            return "";
        }

        expect(resolveCode("src/index.css")).toBe("body { background: #000; }");
        expect(resolveCode("/src/index.css")).toBe("body { background: #000; }");
        expect(resolveCode("/package.json")).toBe("{}");
        expect(resolveCode("package.json")).toBe("{}");
        expect(resolveCode("unknown.js")).toBe("");
    });

    it("should debounce rapid edits to prevent E2B container sync flooding", async () => {
        vi.useFakeTimers();

        const syncFn = vi.fn();
        let timer: NodeJS.Timeout | null = null;

        function triggerEdit(val: string) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                syncFn(val);
            }, 300);
        }

        triggerEdit("h");
        triggerEdit("he");
        triggerEdit("hel");
        triggerEdit("hello");

        expect(syncFn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(299);
        expect(syncFn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(syncFn).toHaveBeenCalledTimes(1);
        expect(syncFn).toHaveBeenCalledWith("hello");

        vi.useRealTimers();
    });
});
