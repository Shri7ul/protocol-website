import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // App is publicly served under:
  // https://shriful.tech/protocol
  basePath: "/protocol",

  trailingSlash: false,
};

export default nextConfig;