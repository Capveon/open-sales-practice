import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@osp/core"],
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/isomorphic-ws",
    "yaml",
    "postgres",
  ],
  webpack: (config) => {
    if (process.env.OSP_CF_BUILD === "1") {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@libsql/client": path.join(here, "src/lib/libsql-stub.ts"),
      };
    }
    return config;
  },
};

export default nextConfig;
