import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Cloudflare Pages compatibility */
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      crypto: 'node:crypto',
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      crypto: 'node:crypto',
    },
  },
};

export default nextConfig;
