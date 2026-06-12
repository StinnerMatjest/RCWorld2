import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connections | ParkRating",
  description:
    "Group 16 coasters into 4 hidden categories. A daily coaster puzzle for theme park fans.",
  alternates: { canonical: "https://parkrating.com/games/connections" },
};

export default function ConnectionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
