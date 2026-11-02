import { describe, it, expect } from "vitest";
import {
    validateAttachment,
    formatFileSize,
    MAX_FILE_SIZE_BYTES,
} from "@/lib/file-attachments";

describe("File Attachments & Gemini Guardrails", () => {
    it("should accept valid image files (png, jpg, webp, svg)", () => {
        const pngFile = new File(["dummy content"], "mockup.png", { type: "image/png" });
        const res = validateAttachment(pngFile);
        expect(res.valid).toBe(true);
        expect(res.category).toBe("image");
    });

    it("should accept PDF specification documents", () => {
        const pdfFile = new File(["%PDF-1.4 dummy"], "spec.pdf", { type: "application/pdf" });
        const res = validateAttachment(pdfFile);
        expect(res.valid).toBe(true);
        expect(res.category).toBe("pdf");
    });

    it("should accept JSON mock data and schema files", () => {
        const jsonFile = new File(['{"products": []}'], "data.json", { type: "application/json" });
        const res = validateAttachment(jsonFile);
        expect(res.valid).toBe(true);
        expect(res.category).toBe("data");
    });

    it("should accept CSV tabular records", () => {
        const csvFile = new File(["id,name,price\n1,Widget,10"], "items.csv", { type: "text/csv" });
        const res = validateAttachment(csvFile);
        expect(res.valid).toBe(true);
        expect(res.category).toBe("data");
    });

    it("should accept source code files (jsx, tsx, js, css, html)", () => {
        const jsxFile = new File(["export function Card() {}"], "Card.jsx", { type: "text/javascript" });
        const res = validateAttachment(jsxFile);
        expect(res.valid).toBe(true);
        expect(res.category).toBe("code");
    });

    it("should reject empty files (0 bytes)", () => {
        const emptyFile = new File([], "empty.txt", { type: "text/plain" });
        const res = validateAttachment(emptyFile);
        expect(res.valid).toBe(false);
        expect(res.error).toContain("empty");
    });

    it("should reject files exceeding 10MB limit", () => {
        // Create 11MB dummy slice
        const bigFile = {
            name: "giant-mockup.png",
            size: MAX_FILE_SIZE_BYTES + 1024,
            type: "image/png",
        } as unknown as File;

        const res = validateAttachment(bigFile);
        expect(res.valid).toBe(false);
        expect(res.error).toContain("exceeds the 10MB limit");
    });

    it("should reject malicious executables and dangerous archives as security guardrail", () => {
        const dangerousExtensions = ["virus.exe", "script.bat", "run.sh", "library.dll", "archive.zip", "setup.msi"];

        for (const filename of dangerousExtensions) {
            const badFile = new File(["payload"], filename, { type: "application/octet-stream" });
            const res = validateAttachment(badFile);
            expect(res.valid).toBe(false);
            expect(res.error).toContain("not allowed for security reasons");
        }
    });

    it("should correctly format byte sizes", () => {
        expect(formatFileSize(500)).toBe("500 B");
        expect(formatFileSize(2048)).toBe("2.0 KB");
        expect(formatFileSize(1572864)).toBe("1.5 MB");
    });
});
