import { describe, it, expect } from "vitest";

function generateViteConfig(): string {
  return `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
});
`.trim();
}

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
  it("should generate vite.config.js with allowedHosts: true to prevent 403 proxy blocks", () => {
    const config = generateViteConfig();
    expect(config).toContain("allowedHosts: true");
    expect(config).toContain("host: '0.0.0.0'");
    expect(config).toContain("port: 3000");
    expect(config).toContain("strictPort: true");
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
});
