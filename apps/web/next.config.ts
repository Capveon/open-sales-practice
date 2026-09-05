import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@osp/core"],
  serverExternalPackages: ["@libsql/client", "yaml", "postgres"],
};

export default nextConfig;
