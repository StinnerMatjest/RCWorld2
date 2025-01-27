import "./globals.css";
import { ParksProvider } from "./context/ParksContext";
import { Inter, Roboto } from "next/font/google";

export const metadata = {
  title: "Your Application Title",
  description: "Your app description",
};


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: "400", // or "300", "500", etc.
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: "400", // or any of the valid font weights
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${roboto.variable} antialiased`}
      >
        <ParksProvider>{children}</ParksProvider>
      </body>
    </html>
  );
}

