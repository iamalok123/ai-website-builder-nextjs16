import { describe, it, expect } from "vitest";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { FileData, Message } from "@/types/workspace";

describe("Workspace Data Schemas & Constants", () => {
  describe("Constants", () => {
    it("should charge 1 credit per generation", () => {
      expect(CREDIT_COST_PER_GENERATION).toBe(1);
    });
  });

  describe("FileData Schema Integrity", () => {
    it("should validate a complete Vite + React project structure", () => {
      const sampleFileData: FileData = {
        title: "Test Project",
        files: {
          "/index.html": { code: "<html></html>" },
          "/vite.config.js": { code: "export default {}" },
          "/package.json": { code: "{}" },
          "/src/main.jsx": { code: "console.log('main')" },
          "/src/App.jsx": { code: "export default function App() {}" },
        },
        dependencies: {
          "lucide-react": "^1.0.0",
          clsx: "^2.0.0",
        },
      };

      expect(sampleFileData.title).toBe("Test Project");
      expect(Object.keys(sampleFileData.files)).toHaveLength(5);
      expect(sampleFileData.dependencies["lucide-react"]).toBe("^1.0.0");
    });
  });

  describe("Message Schema Integrity", () => {
    it("should accept valid assistant and user messages with optional image attachments", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: "Build a landing page",
          imageUrl: "https://example.com/mockup.png",
        },
        {
          role: "assistant",
          content: "Created the landing page with Tailwind",
        },
      ];

      expect(messages[0].role).toBe("user");
      expect(messages[0].imageUrl).toBeDefined();
      expect(messages[1].role).toBe("assistant");
    });
  });
});
