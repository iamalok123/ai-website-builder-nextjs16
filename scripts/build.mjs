#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Strictly enforce standard production NODE_ENV across all platforms and CI/CD environments
process.env.NODE_ENV = "production";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextCli, "build", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
