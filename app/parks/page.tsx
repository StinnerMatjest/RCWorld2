import Link from "next/link";
import type { Metadata } from "next";
import ParksClient from "./ParksClient";
import type { RankedPark } from "./ParksClient";

export const metadata: Metadata = {
  title: "Theme Park Rankings | Parkrating",
  description:
    "Every theme park we've reviewed, ranked by overall score. Detailed ratings across 10 categories including coasters, food, ride operations and park management — scored out of 10.",
  alternates: { canonical: "https://parkrating.com/parks" },
};

async function getRankedParks(): Promise<RankedPark[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}api/parks/ranked`, { cache: "no-store" });
  if (!res.ok) return [];
  const { parks } = await res.json();
  return parks ?? [];
}

export default async function ParksRankingPage() {
  const parks = await getRankedParks();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Theme Park Rankings by ParkRating",
    "description": "Theme parks ranked by overall score across 10 categories, reviewed by ParkRating.",
    "url": "https://parkrating.com/parks",
    "numberOfItems": parks.length,
    "itemListElement": parks.map((park, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `https://parkrating.com/park/${park.slug}`,
      "name": park.name,
      "description": `${park.name} (${park.country}) — Overall: ${park.overall}/10. Best Coaster: ${park.bestCoaster}/10, Park Appearance: ${park.parkAppearance}/10, Food: ${park.food}/10.`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-slate-950 text-white">

        {/* Hero */}
        <div className="relative overflow-hidden border-b border-slate-800 px-4 sm:px-8 py-12 sm:py-16"
          style={{ background: "radial-gradient(ellipse at 60% 0%, rgba(249,115,22,0.08) 0%, transparent 70%), #020617" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-3">ParkRating · All parks</p>
            <h1 className="text-4xl sm:text-5xl font-black mb-3 leading-tight">
              Theme Park <span className="text-orange-500">Rankings</span>
            </h1>
            <p className="text-slate-400 text-base max-w-lg">
              An overview of all {parks.length} parks we&apos;ve rated across 10 categories — scores reflect our most recent visit.
              Head to the <a href="/" className="text-orange-500 hover:text-orange-400 transition-colors">home page</a> for the full visit feed.
            </p>
            <Link href="/" className="inline-block mt-4 text-sm text-slate-500 hover:text-orange-400 transition-colors">
              ← Back to visit feed
            </Link>
          </div>
        </div>

        <ParksClient parks={parks} />
      </div>
    </>
  );
}
