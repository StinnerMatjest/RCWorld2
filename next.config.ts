import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    domains: ['img.daisyui.com'],
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.splitChunks.maxSize = 200000;  // 200KB
    }
    return config;
  },
};

export default nextConfig;
