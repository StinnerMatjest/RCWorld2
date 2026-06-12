import type { Metadata } from "next";
import ManufacturersClient from "./ManufacturersClient";

export const metadata: Metadata = {
  title: "Manufacturer Hall of Fame | Best Coaster Makers Ranked | ParkRating",
  description:
    "Which roller coaster manufacturer builds the best rides? Best Coaster awards, average scores, and full fleet breakdowns for every manufacturer we've ridden: Intamin, B&M, Mack Rides, Vekoma and more.",
  alternates: { canonical: "https://parkrating.com/manufacturers" },
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

  // Aggregate per manufacturer for JSON-LD (ranked by awards, then avg rating)
  const byManu = new Map<string, any[]>();
  for (const c of coasters) {
    const key = c.manufacturer || "Unknown";
    if (!byManu.has(key)) byManu.set(key, []);
    byManu.get(key)!.push(c);
  }
  const ranked = [...byManu.entries()]
    .map(([name, list]) => {
      const ratings = list.map((c) => Number(c.rating)).filter((r) => r > 0);
      const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
      const awards = list.filter((c) => c.isbestcoaster).length;
      return { name, count: list.length, avg, awards };
    })
    .sort((a, b) => b.awards - a.awards || b.avg - a.avg);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Roller Coaster Manufacturers Ranked by ParkRating",
    "description":
      "Roller coaster manufacturers ranked by Best Coaster awards and average ride score across every coaster ParkRating has ridden and rated.",
    "url": "https://parkrating.com/manufacturers",
    "numberOfItems": ranked.length,
    "itemListElement": ranked.map((m, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": m.name,
      "description": `${m.name}: ${m.awards} Best Coaster award${m.awards !== 1 ? "s" : ""}, average score ${m.avg.toFixed(2)}/10 across ${m.count} rated coaster${m.count !== 1 ? "s" : ""}.`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ManufacturersClient initialCoasters={coasters} />
    </>
  );
}
