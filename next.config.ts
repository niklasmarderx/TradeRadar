import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next.js build output off exFAT (exFAT breaks Turbopack's SQLite cache)
  distDir: "/tmp/traderar-next",
};

export default nextConfig;
