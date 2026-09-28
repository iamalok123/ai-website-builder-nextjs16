import path from "path";
import type { NextConfig } from "next";

// Ensure NODE_ENV is strictly standard ('production', 'development', or 'test')
// to prevent React development/production dispatcher mismatch and prerender crashes
const env = process.env as Record<string, string | undefined>;
if (env.NODE_ENV && !["production", "development", "test"].includes(env.NODE_ENV.trim().toLowerCase())) {
  env.NODE_ENV = "production";
} else if (env.NODE_ENV) {
  env.NODE_ENV = env.NODE_ENV.trim().toLowerCase();
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: [
    "@arcjet/next",
    "@cline/sdk",
    "@cline/core",
    "@cline/agents",
    "@cline/llms",
    "@cline/shared",
  ],
};

export default nextConfig;
