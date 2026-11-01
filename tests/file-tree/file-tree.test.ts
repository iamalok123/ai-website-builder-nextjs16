import { describe, it, expect } from "vitest";

interface FileTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileTreeNode[];
}

function buildFileTree(paths: string[]): FileTreeNode[] {
  interface InternalTree {
    [key: string]: {
      __node: FileTreeNode;
      __children: InternalTree;
    };
  }

  const root: InternalTree = {};

  for (const rawPath of paths) {
    const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
    const parts = cleanPath.split("/").filter(Boolean);
    let current = root;

    let accumulated = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      accumulated += "/" + part;

      if (!current[part]) {
        current[part] = {
          __node: {
            name: part,
            path: isFile ? rawPath : accumulated,
            isFolder: !isFile,
          },
          __children: {},
        };
      }
      current = current[part].__children;
    }
  }

  function convert(obj: InternalTree): FileTreeNode[] {
    const result: FileTreeNode[] = [];
    for (const key of Object.keys(obj)) {
      const entry = obj[key];
      const node: FileTreeNode = { ...entry.__node };
      if (node.isFolder) {
        node.children = convert(entry.__children);
        node.children.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });
      }
      result.push(node);
    }
    return result.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return convert(root);
}

describe("Hierarchical File Tree Builder", () => {
  it("should convert flat path list into nested hierarchy", () => {
    const paths = [
      "/index.html",
      "/src/main.jsx",
      "/src/components/Header.jsx",
      "/src/components/Footer.jsx",
      "/package.json",
    ];

    const tree = buildFileTree(paths);

    // Root should have 'src' folder first, followed by root files
    const srcFolder = tree.find((n) => n.name === "src");
    expect(srcFolder).toBeDefined();
    expect(srcFolder?.isFolder).toBe(true);

    const componentsFolder = srcFolder?.children?.find((n) => n.name === "components");
    expect(componentsFolder).toBeDefined();
    expect(componentsFolder?.isFolder).toBe(true);

    const headerFile = componentsFolder?.children?.find((n) => n.name === "Header.jsx");
    expect(headerFile).toBeDefined();
    expect(headerFile?.isFolder).toBe(false);
    expect(headerFile?.path).toBe("/src/components/Header.jsx");
  });

  it("should sort directories before files at every level", () => {
    const paths = [
      "/vite.config.js",
      "/src/App.jsx",
      "/src/components/Button.jsx",
      "/package.json",
      "/index.html",
    ];

    const tree = buildFileTree(paths);
    expect(tree[0].name).toBe("src");
    expect(tree[0].isFolder).toBe(true);

    // After folders, files should be alphabetized
    const fileNames = tree.slice(1).map((n) => n.name);
    expect(fileNames).toEqual(["index.html", "package.json", "vite.config.js"]);
  });

  it("should handle mixed leading slash and non-leading slash paths", () => {
    const paths = ["index.html", "/src/App.jsx", "src/components/Card.jsx"];
    const tree = buildFileTree(paths);

    const srcFolder = tree.find((n) => n.name === "src");
    expect(srcFolder).toBeDefined();
    expect(srcFolder?.children?.length).toBe(2);
  });
});
