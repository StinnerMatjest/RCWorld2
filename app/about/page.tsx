import type { Metadata } from "next";
import AboutClient from "./AboutClient";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export const metadata: Metadata = {
  title: "About Us | ParkRating",
  description:
    "Two brothers passionate about theme parks and roller coasters. We share honest, first-hand reviews, ratings and insights from parks across the world.",
  alternates: { canonical: "https://parkrating.com/about" },
};

// Render at request time, not build time (Docker build has no env/API).
export const dynamic = "force-dynamic";

async function getTrips(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}api/trips`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.trips ?? [];
  } catch {
    return [];
  }
}

async function getVisits(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}api/visits`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.visits ?? [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const [trips, visits] = await Promise.all([getTrips(), getVisits()]);
  return <AboutClient initialTrips={trips} initialVisits={visits} />;
}
