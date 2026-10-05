import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on our own Coolify server (Vercel paused the deployment), so the
  // build emits a traced `.next/standalone` server with only the dependencies
  // each route actually uses.
  output: "standalone",
};

export default nextConfig;
