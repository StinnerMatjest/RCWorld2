import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ParksProvider } from "./context/ParksContext";

export const metadata = {
  title: "Your Application Title",
  description: "Your app description",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ParksProvider>{children}</ParksProvider>
      </body>
    </html>
  );
}

