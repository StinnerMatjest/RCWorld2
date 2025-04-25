import "./globals.css";
import { ParksProvider } from "./context/ParksContext";
import { Inter, Roboto } from "next/font/google";

export const metadata = {
  title: "Parkrating",
  description: "We rate themeparks all around the world!",
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

