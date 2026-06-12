import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import type { Rating, Park } from "@/app/types";

export const metadata: Metadata = {
  title: "ParkRating – ThemePark Reviews",
  description:
    "Explore theme park reviews and coaster rankings from dedicated enthusiasts 🎢 Discover top rides and plan your next visit with ParkRating.",
  alternates: { canonical: "https://parkrating.com" },
};

// Render at request time, not build time: the Docker build has no env vars and
// no running API, so a build-time prerender would bake in the empty fallback.
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function getInitialData(): Promise<{ ratings?: Rating[]; parks?: Park[] }> {
  try {
    const [ratingsRes, parksRes] = await Promise.all([
      fetch(`${BASE}api/ratings`, { cache: "force-cache", next: { tags: ["content"] } }),
      fetch(`${BASE}api/parks`, { cache: "force-cache", next: { tags: ["content"] } }),
    ]);
    if (!ratingsRes.ok || !parksRes.ok) return {};
    const [ratingsData, parksData] = await Promise.all([ratingsRes.json(), parksRes.json()]);
    return {
      ratings: Array.isArray(ratingsData.ratings) ? ratingsData.ratings : undefined,
      parks: Array.isArray(parksData.parks) ? parksData.parks : undefined,
    };
  } catch {
    // Fall back to client-side fetching (HomeClient handles missing props)
    return {};
  }
}

export default async function Page() {
  const { ratings, parks } = await getInitialData();
  return <HomeClient initialRatings={ratings} initialParks={parks} />;
}
