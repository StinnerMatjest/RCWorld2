/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.daisyui.com", pathname: "/**" },
      { protocol: "https", hostname: "pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev", port: "", pathname: "/**" },
      { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
      { protocol: "https", hostname: "flagcdn.com", pathname: "/**" },
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
