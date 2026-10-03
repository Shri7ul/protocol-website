import type { NextConfig } from "next";

/**
 * Protocol Atlas — Next.js configuration.
 *
 * The whole experience is a single dark, presentation-grade surface, so there is
 * no image pipeline to configure and no basePath to worry about.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
