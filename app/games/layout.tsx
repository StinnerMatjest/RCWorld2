import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Games | ParkRating",
  description:
    "Daily theme park games. Guess the coaster in Coastle, spot the park in Zoomle and solve coaster Connections.",
  alternates: { canonical: "https://parkrating.com/games" },
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
