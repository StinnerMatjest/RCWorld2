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
    images: ["/images/Parkrating.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ParkRating – ThemePark Reviews",
    description:
      "Explore theme park reviews and coaster rankings from dedicated enthusiasts 🎢 Discover top rides and plan your next visit with ParkRating.",
    images: ["/images/Parkrating.png"],
  },
};

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: "400",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <AdminModeProvider>
          <ParksProvider>
            <SearchProvider>
              <Header />
              <AdminToggle />
              <main className="flex-grow">{children}</main>
              <Footer />
            </SearchProvider>
          </ParksProvider>
        </AdminModeProvider>
      </body>
    </html>
  );
}