import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* Cloudflare Pages compatibility */
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      crypto: path.resolve(__dirname, 'src/lib/crypto-polyfill.ts'),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      crypto: path.resolve(__dirname, 'src/lib/crypto-polyfill.ts'),
    },
  },
};

export default nextConfig;
