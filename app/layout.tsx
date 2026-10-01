import "./globals.css";
import { ParksProvider } from "./context/ParksContext";
import { SearchProvider } from "./context/SearchContext";
import { AdminModeProvider } from "./context/AdminModeContext";
import { Roboto } from "next/font/google";
import Header from "./components/Header";
import AdminToggle from "./components/admin/AdminToggle";
import Footer from "./components/Footer";
import Script from "next/script";

export const metadata = {
  metadataBase: new URL("https://parkrating.com"),
  // Set GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION in Railway to claim the
  // site in Search Console / Bing Webmaster Tools without a code change.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
  title: "ParkRating – ThemePark Reviews",
  description:
    "Explore theme park reviews and coaster rankings from dedicated enthusiasts 🎢 Discover top rides and plan your next visit with ParkRating.",
  icons: {
    icon: [{ url: "/logos/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/logos/favicon.svg"],
    apple: ["/logos/favicon.svg"],
  },
  openGraph: {
    siteName: "ParkRating",
    type: "website",
    title: "ParkRating – ThemePark Reviews",
    description:
      "Explore theme park reviews and coaster rankings from dedicated enthusiasts 🎢 Discover top rides and plan your next visit with ParkRating.",
    images: ["/images/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ParkRating – ThemePark Reviews",
    description:
      "Explore theme park reviews and coaster rankings from dedicated enthusiasts 🎢 Discover top rides and plan your next visit with ParkRating.",
    images: ["/images/og-default.png"],
  },
};

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: "400",
});

// Site-wide identity for answer engines: who runs the site and its social profiles.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://parkrating.com/#organization",
      "name": "ParkRating",
      "url": "https://parkrating.com",
      "logo": "https://parkrating.com/images/logo.png",
      "sameAs": [
        "https://www.instagram.com/parkratings/",
        "https://www.facebook.com/parkrating/",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://parkrating.com/#website",
      "name": "ParkRating",
      "url": "https://parkrating.com",
      "publisher": { "@id": "https://parkrating.com/#organization" },
    },
  ],
};

// Trip countdown + "under review" parks for the header. Same cached fetch
// pattern as the footer; a failure (or the env-less Docker build) returns null
// and the header falls back to fetching client-side.
async function getHeaderStatus(): Promise<{ tripStartDates: string[]; underReviewParks: string[] } | null> {
  const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}api/header-status`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return null;
    const data = await res.json();
    return { tripStartDates: data.tripStartDates ?? [], underReviewParks: data.underReviewParks ?? [] };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStatus = await getHeaderStatus();
  return (
    <html lang="en" className="dark">
      <head>
        {/* Umami Cloud analytics */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="acd51e6e-baaa-4194-aaf1-41851db17222"
          strategy="afterInteractive"
          defer
        />
      </head>
      <body
        className={`${roboto.variable} antialiased min-h-screen flex flex-col bg-[#0f172a] text-slate-200`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <AdminModeProvider>
          <ParksProvider>
            <SearchProvider>
              <Header initialStatus={headerStatus} />
              <AdminToggle />
              <main className="flex-grow">{children}</main>
              <Footer />
            </SearchProvider>
          </ParksProvider>
        </AdminModeProvider>
        <Script src="https://cdn.jsdelivr.net/npm/mobile-drag-drop@3.0.0-rc.0/index.min.js" strategy="lazyOnload" />
        <Script id="mobile-drag-drop-init" strategy="lazyOnload">
          {`
            window.addEventListener('load', function() {
              if (window.MobileDragDrop) {
                MobileDragDrop.polyfill({ holdToDrag: 500 }); // 500ms long-press to drag
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}