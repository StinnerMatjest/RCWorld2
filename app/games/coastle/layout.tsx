import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coastle | ParkRating",
  description:
    "Guess the roller coaster in 5 tries. A daily coaster guessing game with hints from manufacturer, country, length, height and speed.",
  alternates: { canonical: "https://parkrating.com/games/coastle" },
};

export default function CoastleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
