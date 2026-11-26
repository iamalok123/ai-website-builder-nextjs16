#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Strictly enforce standard production NODE_ENV across all platforms and CI/CD environments
process.env.NODE_ENV = "production";

// Prevent Windows Turbopack os error 80 ("The file exists") from stale external package junctions
try {
  fs.rmSync(path.resolve(process.cwd(), ".next", "node_modules"), {
    recursive: true,
    force: true,
  });
} catch {}

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
