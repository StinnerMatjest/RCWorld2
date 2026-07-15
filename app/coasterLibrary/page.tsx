import type { Metadata } from "next";
import CoasterLibraryClient from "./CoasterLibraryClient";

export const metadata: Metadata = {
  title: "Coaster Library | Ratings, Rankings & Ride Data | ParkRating",
  description:
    "Every roller coaster we've ridden, rated and ranked. Detailed ride counts, manufacturer breakdowns and enthusiast insights across every park we've visited.",
  alternates: { canonical: "https://parkrating.com/coasterratings" },
};

// Render at request time, not build time (Docker build has no env/API).
export const dynamic = "force-dynamic";

async function getCoasters() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}api/coasters`, {
      cache: "force-cache", next: { tags: ["content"] },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.coasters ?? []).filter((c: { rating?: number | null }) => (c.rating ?? 0) > 0);
  } catch {
    return [];
  }
}

export default async function Page() {
  const coasters = await getCoasters();

  const ranked = [...coasters]
    .sort((a: any, b: any) => (Number(b.rating) ?? 0) - (Number(a.rating) ?? 0));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Roller Coaster Ratings by ParkRating",
    "description":
      "Every roller coaster rated by ParkRating, ranked by score. Includes ride counts, manufacturer data, and enthusiast insights.",
    "url": "https://parkrating.com/coasterratings",
    "numberOfItems": coasters.length,
    "itemListElement": ranked.slice(0, 150).map((c: any, i: number) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name,
      "url": `https://parkrating.com/coasters/${c.slug}`,
      "description": `${c.name} at ${c.parkName} — Rated ${Number(c.rating).toFixed(1)}/10 by ParkRating. Manufacturer: ${c.manufacturer}. Ridden ${c.rideCount ?? 1} time${(c.rideCount ?? 1) !== 1 ? "s" : ""}.`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CoasterLibraryClient initialCoasters={coasters} />
    </>
  );
}
