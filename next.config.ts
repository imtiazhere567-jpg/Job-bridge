import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "mammoth", "unpdf"],
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  // Poster fonts and logo files are read from disk at runtime; make sure Vercel ships them.
  outputFileTracingIncludes: {
    "/api/poster/[id]": ["./assets/fonts/**", "./public/brand/**"],
    "/api/poster/[id]/all": ["./assets/fonts/**", "./public/brand/**"],
  },
};

export default nextConfig;
