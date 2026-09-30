import Link from "next/link";
import { R2Image } from "@/app/components/R2Image";
import { sortCoastersByRank } from "@/app/utils/ranking";
import { getRatingColor } from "@/app/utils/design";
import type { ApiCoaster } from "@/app/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const SITE = "https://parkrating.com";

type Entry = {
  rank: number;
  id: number;
  name: string;
  slug: string;
  park: string;
  manufacturer: string;
  score: string;
  rating: number;
  image: string | null;
};

const fmt = (r: ApiCoaster["rating"]) => {
  const n = Number(r);
  if (r === null || r === undefined || Number.isNaN(n)) return "NR";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

async function headerImage(id: number): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}api/coasters/${id}/gallery`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.headerImage ?? null;
  } catch {
    return null;
  }
}

async function getTop(n: number): Promise<{ top: Entry[]; total: number }> {
  try {
    const res = await fetch(`${BASE}api/coasters`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return { top: [], total: 0 };
    const { coasters } = await res.json();
    const ranked = sortCoastersByRank(Array.isArray(coasters) ? coasters : []) as ApiCoaster[];
    const top = ranked.slice(0, n);
    const images = await Promise.all(top.map((c) => headerImage(Number(c.id))));
    const total = ranked.length;
    const entries = top.map((c, i) => ({
      rank: i + 1,
      id: Number(c.id),
      name: c.name,
      slug: c.slug,
      park: c.parkName,
      manufacturer: c.manufacturerName,
      score: fmt(c.rating),
      rating: Number(c.rating),
      image: images[i],
    }));
    return { top: entries, total };
  } catch {
    return { top: [], total: 0 };
  }
}

// Same podium colours as the coaster library's rank column.
const rankColor = (rank: number) => (rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-orange-400" : "text-slate-400");

/** One coaster as a photo card, in the language of the park cards above it. */
function Card({ e, sizes }: { e: Entry; sizes: string }) {
  return (
    <Link href={`/coasters/${e.slug}`} className="group relative block aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 shadow-lg">
      {e.image ? (
        <R2Image src={e.image} alt={e.name} fill sizes={sizes} className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent" />
      <span className={`absolute top-3 left-4 text-4xl font-black tabular-nums leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] ${rankColor(e.rank)}`}>
        {e.rank}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold text-white leading-tight drop-shadow truncate">{e.name}</p>
          <p className="text-xs text-slate-300/90 truncate">{[e.park, e.manufacturer].filter(Boolean).join(" · ")}</p>
        </div>
        <span className={`text-5xl font-black tabular-nums leading-none tracking-tighter drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] ${getRatingColor(e.rating)}`}>
          {e.score}
        </span>
      </div>
    </Link>
  );
}

/**
 * The ten best coasters we've ridden, under the park cards on the home page.
 * Phones: a swipeable strip of ten photo cards, the same gesture as the park
 * strip above, ending in a card that leads to the full library. Tablets and
 * up: the top three as photo cards, four to ten as ranked rows. Server
 * rendered from the cached catalogue with an ItemList for search engines.
 */
export default async function TopCoasters() {
  const { top, total } = await getTop(10);
  if (top.length < 5) return null;
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const cols = [rest.slice(0, Math.ceil(rest.length / 2)), rest.slice(Math.ceil(rest.length / 2))];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Top 10 roller coasters on ParkRating",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: top.length,
    itemListElement: top.map((e) => ({ "@type": "ListItem", position: e.rank, name: e.name, url: `${SITE}/coasters/${e.slug}` })),
  };

  return (
    <section className="bg-[#0f172a] pt-10 pb-14 md:py-20 md:px-20 border-t border-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      <div className="px-4 md:px-0">
        <p className="text-brand text-xs font-bold uppercase tracking-widest mb-2 md:mb-3">ParkRating · Coasters</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white">
          The <span className="text-brand">Top 10</span> coasters
        </h2>
        <p className="mt-2 md:mt-3 text-slate-400 max-w-xl leading-relaxed text-sm md:text-base">
          The best rides we&apos;ve been on, ranked across every park we&apos;ve reviewed.
        </p>
      </div>

      {/* Phones: swipe, like the park cards. */}
      <div className="md:hidden mt-5 flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-2" style={{ scrollbarWidth: "none" }}>
        {top.map((e) => (
          <div key={e.id} className="snap-center shrink-0 w-[72vw] max-w-sm">
            <Card e={e} sizes="72vw" />
          </div>
        ))}
        <Link
          href="/coasterLibrary"
          className="snap-center shrink-0 w-[60vw] max-w-xs aspect-[3/4] rounded-2xl border border-slate-700 bg-slate-900/60 flex flex-col items-center justify-center gap-2 text-center px-6"
        >
          <span className="text-3xl font-black text-white">{total}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-brand">Every coaster we&apos;ve rated</span>
        </Link>
      </div>

      {/* Tablets and up: podium, then the rest as rows. */}
      <div className="hidden md:block mt-8 max-w-6xl">
        <div className="grid grid-cols-3 gap-4">
          {podium.map((e) => <Card key={e.id} e={e} sizes="(min-width: 1280px) 380px, 30vw" />)}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-12">
          {cols.map((col, c) => (
            <ol key={c} className="divide-y divide-slate-800 border-t border-slate-800">
              {col.map((e) => (
                <li key={e.id}>
                  <Link href={`/coasters/${e.slug}`} className="group flex items-center gap-4 py-3.5">
                    <span className={`w-7 text-lg font-black tabular-nums ${rankColor(e.rank)}`}>{e.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-slate-100 group-hover:text-white">{e.name}</span>
                      <span className="block truncate text-xs text-slate-500">{[e.park, e.manufacturer].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className={`text-lg font-bold tabular-nums ${getRatingColor(e.rating)}`}>{e.score}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ))}
        </div>
        <Link href="/coasterLibrary" className="inline-block mt-6 text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">
          Every coaster we&apos;ve rated
        </Link>
      </div>
    </section>
  );
}
