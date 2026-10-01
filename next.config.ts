import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF export embeds these fonts at runtime; make sure Vercel ships them.
  outputFileTracingIncludes: { "/**": ["./lib/export/fonts/**"] },
};

export default nextConfig;
