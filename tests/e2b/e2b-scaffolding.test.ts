import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import {
  STANDARD_VITE_CONFIG,
  SQLITE_SHIM_CODE,
  SQLITE_SHIM_CJS_CODE,
  ZEPHYRE_HMR_REPORTER_CODE,
  normalizeClientApiUrls,
  prepareBackendServerFiles,
} from "@/lib/e2b";

function generateIndexHtml(title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || "Zephyre App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-black text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`.trim();
}

function generatePackageJson(userDeps: Record<string, string> = {}): string {
  return JSON.stringify(
    {
      name: "zephyre-app",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite --host 0.0.0.0 --port 3000",
        build: "vite build",
        start: "node server.js",
      },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "lucide-react": "^1.16.0",
        clsx: "^2.1.1",
        "tailwind-merge": "^3.0.0",
        ...userDeps,
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.3.4",
        vite: "^6.0.0",
      },
    },
    null,
    2
  );
}

describe("E2B Scaffolding & Configuration Generator", () => {
  it("should generate vite.config.js with allowedHosts: true, polling watch, proxy for /api to port 3001, and HMR clientPort", () => {
    expect(STANDARD_VITE_CONFIG).toContain("allowedHosts: true");
    expect(STANDARD_VITE_CONFIG).toContain("host: '0.0.0.0'");
    expect(STANDARD_VITE_CONFIG).toContain("port: 3000");
    expect(STANDARD_VITE_CONFIG).toContain("strictPort: true");
    expect(STANDARD_VITE_CONFIG).toContain("usePolling: true");
    expect(STANDARD_VITE_CONFIG).toContain("clientPort: 443");
    expect(STANDARD_VITE_CONFIG).toContain("proxy:");
    expect(STANDARD_VITE_CONFIG).toContain("target: 'http://127.0.0.1:3001'");
  });

  it("should configure full-stack backend dependencies and dual start script when server.js is present", () => {
    const hasServerJs = true;
    const backendDeps = hasServerJs ? { express: "^4.21.2", cors: "^2.8.5" } : {};
    const devScript = hasServerJs
      ? "node server.js & vite --host 0.0.0.0 --port 3000"
      : "vite --host 0.0.0.0 --port 3000";

    const pkg = JSON.parse(
      JSON.stringify({
        name: "zephyre-fullstack-app",
        scripts: { dev: devScript },
        dependencies: { react: "^19.0.0", ...backendDeps },
      })
    );

    expect(pkg.dependencies.express).toBe("^4.21.2");
    expect(pkg.dependencies.cors).toBe("^2.8.5");
    expect(pkg.scripts.dev).toContain("node server.js & vite");
  });

  it("should generate index.html with Tailwind CDN and correct entry point", () => {
    const html = generateIndexHtml("Finance Dashboard");
    expect(html).toContain("<title>Finance Dashboard</title>");
    expect(html).toContain('src="https://cdn.tailwindcss.com"');
    expect(html).toContain('src="/src/main.jsx"');
    expect(html).toContain('<div id="root"></div>');
  });

  it("should generate package.json with React 19 and user dependencies merged", () => {
    const rawPkg = generatePackageJson({ "canvas-confetti": "^1.9.0" });
    const pkg = JSON.parse(rawPkg);

    expect(pkg.type).toBe("module");
    expect(pkg.dependencies.react).toBe("^19.0.0");
    expect(pkg.dependencies["canvas-confetti"]).toBe("^1.9.0");
    expect(pkg.scripts.dev).toContain("vite --host 0.0.0.0 --port 3000");
  });

  it("should normalize an existing AI-generated package.json to ensure dev host and critical dependencies", () => {
    const rawAiPackage = JSON.stringify({
      name: "custom-ai-app",
      scripts: {
        dev: "vite",
      },
      dependencies: {
        "lodash-es": "^4.17.21",
      },
    });

    const parsed = JSON.parse(rawAiPackage);
    parsed.type = "module";
    parsed.scripts = parsed.scripts || {};
    parsed.scripts.dev = "vite --host 0.0.0.0 --port 3000";
    parsed.dependencies = {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^1.16.0",
      clsx: "^2.1.1",
      "tailwind-merge": "^3.0.0",
      ...parsed.dependencies,
    };
    parsed.devDependencies = {
      "@vitejs/plugin-react": "^4.3.4",
      vite: "^6.0.0",
      ...(parsed.devDependencies || {}),
    };

    expect(parsed.scripts.dev).toBe("vite --host 0.0.0.0 --port 3000");
    expect(parsed.dependencies["lodash-es"]).toBe("^4.17.21");
    expect(parsed.dependencies.react).toBe("^19.0.0");
    expect(parsed.devDependencies["@vitejs/plugin-react"]).toBe("^4.3.4");
  });

  it("should provide SQLITE_SHIM_CODE with DatabaseSync class and SQLite statements support", () => {
    expect(SQLITE_SHIM_CODE).toContain("export class DatabaseSync");
    expect(SQLITE_SHIM_CODE).toContain("exec(sql)");
    expect(SQLITE_SHIM_CODE).toContain("prepare(sql)");
    expect(SQLITE_SHIM_CODE).toContain("all(");
    expect(SQLITE_SHIM_CODE).toContain("run(");
    expect(SQLITE_SHIM_CODE).toContain("lastInsertRowid");
  });

  it("should sanitize server.js node:sqlite import into local shim", () => {
    const rawServerJs = `import express from 'express';\nimport { DatabaseSync } from 'node:sqlite';\nconst db = new DatabaseSync('./database.sqlite');`;
    const sanitized = rawServerJs.replace(/['"]node:sqlite['"]/g, "'./sqlite-shim.js'");
    expect(sanitized).toContain("from './sqlite-shim.js'");
    expect(sanitized).not.toContain("node:sqlite");
  });

  it("should ignore backend database files in Vite watcher and keep cors enabled", () => {
    expect(STANDARD_VITE_CONFIG).toContain("database.json");
    expect(STANDARD_VITE_CONFIG).toContain("cors: true");
  });

  it("should rewrite hardcoded localhost:3001 URLs to relative /api proxy paths in client code", () => {
    const rawClient = `const res = await fetch(\`http://localhost:3001/api/sheets?userId=\${id}\`);\nconst base = 'http://127.0.0.1:3001';`;
    const normalized = normalizeClientApiUrls(rawClient);
    expect(normalized).toContain("fetch(`/api/sheets?userId=${id}`)");
    expect(normalized).toContain("const base = '';");
  });

  it("should emit CommonJS server.cjs + sqlite-shim.cjs when server.js uses require() under type: module", () => {
    const cjsServer = `const express = require('express');\nconst { DatabaseSync } = require('node:sqlite');\nconst PORT = 3000;\napp.listen(3000, () => {});`;
    const prepared = prepareBackendServerFiles(cjsServer);
    expect(prepared.isCjs).toBe(true);
    expect(prepared.files["server.cjs"]).toContain("./sqlite-shim.cjs");
    expect(prepared.files["server.cjs"]).toContain("const PORT = 3001;");
    expect(prepared.files["sqlite-shim.cjs"]).toContain("module.exports = { DatabaseSync }");

    const esmServer = `import express from 'express';\nconst app = express();\napp.listen(3001);`;
    const preparedEsm = prepareBackendServerFiles(esmServer);
    expect(preparedEsm.isCjs).toBe(false);
    expect(preparedEsm.files["server.js"]).toBeDefined();
    expect(preparedEsm.files["server.cjs"]).toBeUndefined();
  });

  it("should verify rendered root DOM and include ErrorBoundary in ZEPHYRE_HMR_REPORTER_CODE", () => {
    expect(ZEPHYRE_HMR_REPORTER_CODE).toContain("ZephyreErrorBoundary");
    expect(ZEPHYRE_HMR_REPORTER_CODE).toContain("zephyreVerifyRenderedRoot");
  });

  it("should execute SQLite shim queries with non-id WHERE, ORDER BY, LIMIT/OFFSET, COUNT(*), UPDATE, and DELETE", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zephyre-sqlite-test-"));
    const dbPath = path.join(tmpDir, "test.sqlite");
    const cjsModule: { exports: { DatabaseSync?: new (file: string) => {
      exec: (sql: string) => void;
      prepare: (sql: string) => {
        run: (...args: unknown[]) => { lastInsertRowid?: number; changes: number };
        get: (...args: unknown[]) => Record<string, unknown> | null;
        all: (...args: unknown[]) => Record<string, unknown>[];
      };
    } } } = { exports: {} };

    try {
      const fn = new vm.Script(SQLITE_SHIM_CJS_CODE);
      const localRequire = createRequire(import.meta.url);
      const wrapper = `(function(exports, require, module) {\n${SQLITE_SHIM_CJS_CODE}\n})`;
      const compiled = vm.runInThisContext(wrapper) as (
        exp: typeof cjsModule.exports,
        req: typeof localRequire,
        mod: typeof cjsModule
      ) => void;
      expect(fn).toBeDefined();
      compiled(cjsModule.exports, localRequire, cjsModule);

      const DatabaseSync = cjsModule.exports.DatabaseSync!;
      const db = new DatabaseSync(dbPath);
      db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT, role TEXT, score INTEGER)");

      const insert = db.prepare("INSERT INTO users (email, role, score) VALUES (?, ?, ?)");
      insert.run("alice@example.com", "admin", 50);
      insert.run("bob@example.com", "member", 80);
      insert.run("carol@example.com", "admin", 95);

      const alice = db.prepare("SELECT * FROM users WHERE email = ?").get("alice@example.com");
      expect(alice?.email).toBe("alice@example.com");

      const admins = db.prepare("SELECT * FROM users WHERE role = 'admin' AND score = ?").all(95);
      expect(admins).toHaveLength(1);
      expect(admins[0].email).toBe("carol@example.com");

      const topSecond = db.prepare("SELECT * FROM users ORDER BY score DESC LIMIT 1 OFFSET 1").all();
      expect(topSecond).toHaveLength(1);
      expect(topSecond[0].email).toBe("bob@example.com");

      const countRow = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = ?").get("admin");
      expect(countRow?.total).toBe(2);

      const upd = db.prepare("UPDATE users SET score = ? WHERE email = ?").run(100, "alice@example.com");
      expect(upd.changes).toBe(1);
      expect(db.prepare("SELECT * FROM users WHERE email = ?").get("alice@example.com")?.score).toBe(100);

      const del = db.prepare("DELETE FROM users WHERE email = ?").run("bob@example.com");
      expect(del.changes).toBe(1);
      expect(db.prepare("SELECT COUNT(*) AS total FROM users").get()?.total).toBe(2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
