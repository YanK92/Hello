import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright and local tooling hit the dev server on 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
