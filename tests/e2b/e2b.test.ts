import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectStack, getE2bApiKey, E2B_SANDBOX_TIMEOUT_MS } from "@/lib/e2b";

describe("E2B Sandbox Configuration & Stack Detection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getE2bApiKey", () => {
    it("should return the key starting with e2b_", () => {
      process.env.E2B_SANDBOX_API_KEY = "e2b_test_valid_key_12345";
      expect(getE2bApiKey()).toBe("e2b_test_valid_key_12345");
    });

    it("should prefer valid e2b_ key when multiple env candidates exist", () => {
      process.env.E2B_SANDBOX_API_KEY = "non_prefixed_uuid";
      process.env.E2B_API_KEY = "e2b_valid_backup_key";
      expect(getE2bApiKey()).toBe("e2b_valid_backup_key");
    });

    it("should throw error when no API key is provided", () => {
      delete process.env.E2B_SANDBOX_API_KEY;
      delete process.env.E2B_API_KEY;
      expect(() => getE2bApiKey()).toThrow(/Missing valid E2B_SANDBOX_API_KEY/);
    });
  });

  describe("detectStack", () => {
    it("should identify standard React/Node stack", () => {
      const files = {
        "/App.jsx": { code: "export default function App() {}" },
        "/index.html": { code: "<html></html>" },
      };
      expect(detectStack(files)).toBe("react-node");
    });

    it("should identify Python stack when .py files are present", () => {
      const files = {
        "/main.py": { code: "from fastapi import FastAPI" },
        "/requirements.txt": { code: "fastapi" },
      };
      expect(detectStack(files)).toBe("python");
    });

    it("should identify Python stack when requirements.txt is present without .py", () => {
      const files = {
        "/requirements.txt": { code: "flask\nrequests" },
      };
      expect(detectStack(files)).toBe("python");
    });
  });

  describe("Constants", () => {
    it("should define a 15-minute default timeout", () => {
      expect(E2B_SANDBOX_TIMEOUT_MS).toBe(15 * 60 * 1000);
    });
  });
});
