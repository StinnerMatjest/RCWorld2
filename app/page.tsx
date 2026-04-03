import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "ParkRating – ThemePark Reviews",
  description:
    "Explore theme park reviews and coaster rankings from dedicated enthusiasts 🎢 Discover top rides and plan your next visit with ParkRating.",
};

export default function Page() {
  return <HomeClient />;
}