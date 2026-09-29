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
  experimental: {
    // Ship the page's CSS inside the HTML instead of as render-blocking
    // stylesheet requests: on a slow connection those cost ~1.5 s of blank
    // screen before anything could paint.
    inlineCss: true,
    // The admin-auth middleware matches /api/*, and Next caps request bodies
    // that pass through middleware at 10MB by default — which silently
    // truncated video uploads. Raised so gallery clips get through.
    middlewareClientMaxBodySize: "250mb",
  },
  async headers() {
    return [
      // Static assets under public/ were sent with max-age=0, so every visit
      // re-validated logos and the share image. Names rarely change; a day in
      // the browser plus a week of stale-while-revalidate keeps them cheap.
      {
        source: '/:dir(logos|images)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      // Baseline security headers the site was missing.
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // www -> apex. Only reachable once www.parkrating.com is added as a custom
      // domain in Railway; until then the www host does not resolve at all.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.parkrating.com' }],
        destination: 'https://parkrating.com/:path*',
        permanent: true,
      },
      // The coaster table used to live at /coasterratings; Google still has it.
      {
        source: '/coasterratings',
        destination: '/coasterLibrary',
        permanent: true,
      },
      {
        source: '/admin/carousel',
        destination: '/carousel',
        permanent: false,
      },
      {
        source: '/ConnectionsData',
        destination: '/games/connections/ConnectionsData',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;