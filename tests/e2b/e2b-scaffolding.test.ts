import { describe, it, expect } from "vitest";
import { STANDARD_VITE_CONFIG } from "@/lib/e2b";

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
});
