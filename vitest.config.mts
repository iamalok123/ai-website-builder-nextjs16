import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env = { ...process.env, ...env };

  return {
    test: {
      globals: true,
      environment: "node",
      include: ["tests/**/*.test.ts"],
      testTimeout: 20000,
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./"),
      },
    },
  };
});
