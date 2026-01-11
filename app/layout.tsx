import "./globals.css";
import { ParksProvider } from "./context/ParksContext";
import { SearchProvider } from "./context/SearchContext";
import { AdminModeProvider } from "./context/AdminModeContext";
import { Inter, Roboto } from "next/font/google";
import Header from "./components/Header";
import AdminToggle from "./components/AdminToggle";
import Footer from "./components/Footer";
import Script from "next/script";

export const metadata = {
  title: "Parkrating",
  description: "We rate themeparks all around the world!",
  icons: {
    icon: "/images/Parkrating.png",
    shortcut: "/images/Parkrating.png",
  },
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: "400",
});

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
    <html lang="en">
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
        className={`${inter.variable} ${roboto.variable} antialiased min-h-screen flex flex-col`}
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
