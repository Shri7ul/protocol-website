import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: "/protocol",
  trailingSlash: false,
};

export default nextConfig;