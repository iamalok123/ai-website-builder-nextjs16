import { describe, it, expect } from "vitest";
import { parseRawError, getConnectedFiles, buildErrorFixPrompt } from "@/lib/error-fixer";
import type { FileData } from "@/types/workspace";

describe("Error Recovery & Diagnostic Parser", () => {
    it("should parse Vite React-Babel compile error matching the user screenshot", () => {
        const rawViteError = `[plugin:vite:react-babel] /home/user/app/src/App.jsx: Missing semicolon. (26:6)
24 |   TrendingUp,
25 |   Award
26 | } from 'lucide-react';
   |      ^
27 |
28 | // Icon Map`;

        const parsed = parseRawError(rawViteError);

        expect(parsed.file).toBe("src/App.jsx");
        expect(parsed.line).toBe(26);
        expect(parsed.column).toBe(6);
        expect(parsed.message).toContain("Missing semicolon");
        expect(parsed.category).toBe("compile");
        expect(parsed.codeFrame).toContain("24 |   TrendingUp,");
        expect(parsed.codeFrame).toContain("26 | } from 'lucide-react';");
    });

    it("should parse standard runtime stack trace error", () => {
        const rawRuntimeError = `TypeError: Cannot read properties of undefined (reading 'map')
    at HabitList (src/components/HabitList.jsx:14:22)
    at App (src/App.jsx:45:10)`;

        const parsed = parseRawError(rawRuntimeError);

        expect(parsed.message).toContain("TypeError: Cannot read properties of undefined");
        expect(parsed.category).toBe("runtime");
        expect(parsed.file).toBe("src/components/HabitList.jsx");
        expect(parsed.line).toBe(14);
    });

    it("should resolve connected files and dependencies for a broken component", () => {
        const mockFileData: FileData = {
            title: "Habit Tracker",
            dependencies: {
                "lucide-react": "^1.16.0",
                "clsx": "^2.1.1",
            },
            files: {
                "/src/App.jsx": {
                    code: `import React from 'react';
import HabitList from './components/HabitList';
import Header from './components/Header';
import { Award } from 'lucide-react';
export default function App() { return <div />; }`,
                },
                "/src/components/HabitList.jsx": {
                    code: `export default function HabitList() { return <div />; }`,
                },
                "/src/components/Header.jsx": {
                    code: `export default function Header() { return <header />; }`,
                },
                "/src/main.jsx": {
                    code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`,
                },
                "/package.json": {
                    code: JSON.stringify({
                        dependencies: { "lucide-react": "^1.16.0" },
                    }),
                },
            },
        };

        const connected = getConnectedFiles(mockFileData, "src/App.jsx");

        // Should include App.jsx itself
        expect(connected["/src/App.jsx"]).toBeDefined();
        // Should include package.json
        expect(connected["/package.json"]).toBeDefined();
        // Should include imported components HabitList and Header
        expect(
            connected["/src/components/HabitList.jsx"] || connected["src/components/HabitList.jsx"]
        ).toBeDefined();
        expect(
            connected["/src/components/Header.jsx"] || connected["src/components/Header.jsx"]
        ).toBeDefined();
        // Should include main.jsx because main.jsx imports App.jsx
        expect(connected["/src/main.jsx"]).toBeDefined();
    });

    it("should generate a rich error recovery prompt with code frame and connected files", () => {
        const rawViteError = `[plugin:vite:react-babel] /home/user/app/src/App.jsx: Missing semicolon. (26:6)
24 |   TrendingUp,
25 |   Award
26 | } from 'lucide-react';
   |      ^`;

        const mockFileData: FileData = {
            title: "Habit Tracker",
            dependencies: { "lucide-react": "^1.16.0" },
            files: {
                "/src/App.jsx": {
                    code: `import React from 'react';\nimport { TrendingUp, Award } from 'lucide-react';`,
                },
                "/package.json": {
                    code: `{"dependencies":{"lucide-react":"^1.16.0"}}`,
                },
            },
        };

        const prompt = buildErrorFixPrompt(rawViteError, mockFileData);

        expect(prompt).toContain("🚨 DIAGNOSTIC ERROR REPORT & ONE-CLICK AUTO-FIX REQUEST");
        expect(prompt).toContain("src/App.jsx (Line 26, Column 6)");
        expect(prompt).toContain("Missing semicolon");
        expect(prompt).toContain("26 | } from 'lucide-react';");
        expect(prompt).toContain("--- /src/App.jsx ---");
        expect(prompt).toContain("--- /package.json ---");
        expect(prompt).toContain("CRITICAL FIX INSTRUCTIONS");
    });
});
