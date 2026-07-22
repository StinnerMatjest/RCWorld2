import type { Metadata } from "next";
import ListsClient from "./ListsClient";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export const metadata: Metadata = {
  title: "Curated Lists & Rankings | ParkRating",
  description:
    "ParkRating's curated theme park lists and rankings — best parks, coasters, water rides, dark rides, flat rides and in-park attraction rankings, all scored by us.",
  alternates: { canonical: "https://parkrating.com/lists" },
};

// Render at request time, not build time (Docker build has no env/API).
export const dynamic = "force-dynamic";

// null = fetch failed (client will fetch and show its loading state);
// [] = genuinely no lists (client renders the real empty state, no spinner).
async function getLists(): Promise<any[] | null> {
  try {
    const res = await fetch(`${BASE}api/lists`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.rankingLists ?? [];
  } catch {
    return null;
  }
}

export default async function Page() {
  const fetched = await getLists();
  const lists = fetched ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "ParkRating Curated Lists & Rankings",
    "description":
      "Theme park lists and rankings curated by ParkRating — best parks, coasters, water rides and more.",
    "url": "https://parkrating.com/lists",
    "numberOfItems": lists.length,
    "itemListElement": lists.map((l: any, i: number) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `https://parkrating.com/lists/${l.slug}`,
      "name": l.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ListsClient initialLists={fetched ?? undefined} />
    </>
  );
}
