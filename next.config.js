/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Validation builds can target a separate folder (NEXT_DIST_DIR=.next-build)
  // so they don't clobber the dev server's .next and crash HMR.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    domains: [
      "pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev",
      "img.daisyui.com",
      "cdn.pixabay.com",
      "flagcdn.com"
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/ConnectionsData',
        destination: '/games/connections/ConnectionsData',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;