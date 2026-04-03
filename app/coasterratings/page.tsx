import type { Metadata } from "next";
import CoasterLibraryClient from "./CoasterLibraryClient";

export const metadata: Metadata = {
  title: "Coaster Library | Ratings, Rankings & Ride Data | ParkRating",
  description:
    "Explore our coaster library with detailed ratings, ride counts and enthusiast insights. Compare rides across parks and manufacturers.",
};

export default function Page() {
  return <CoasterLibraryClient />;
}