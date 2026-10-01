import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Read at runtime: PDF fonts for exports, and the Lens system prompt.
  outputFileTracingIncludes: { "/**": ["./lib/export/fonts/**", "./lib/ai/lens/system-prompt.md"] },
};

export default nextConfig;
