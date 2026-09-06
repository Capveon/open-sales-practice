import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(here, "../.."),
  transpilePackages: ["@osp/core"],
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/isomorphic-ws",
    "yaml",
    "postgres",
  ],
};

export default nextConfig;
