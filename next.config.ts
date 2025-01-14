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
    config.devtool = false;  // Disable source maps for production
    return config;
  },
};


export default nextConfig;
