import Link from "next/link";
import { sortCoastersByRank } from "@/app/utils/ranking";
import { getRatingColor } from "@/app/utils/design";
import type { ApiCoaster } from "@/app/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function getTop(n: number): Promise<ApiCoaster[]> {
  try {
    const res = await fetch(`${BASE}api/coasters`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return [];
    const { coasters } = await res.json();
    return sortCoastersByRank(Array.isArray(coasters) ? coasters : []).slice(0, n) as ApiCoaster[];
  } catch {
    return [];
  }
}

const score = (r: ApiCoaster["rating"]) => {
  const n = Number(r);
  if (r === null || r === undefined || Number.isNaN(n)) return "NR";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

// Same podium colours as the coaster library's rank column.
const rankColor = (i: number) => (i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-slate-500");

/**
 * The ten best coasters we've ridden, under the park cards on the home page.
 * Set like the library and manufacturer pages: eyebrow, headline with the
 * orange word, then plain ranked rows in two columns on wide screens.
 * Server-rendered from the cached catalogue, so it costs the visitor nothing.
 */
export default async function TopCoasters() {
  const top = await getTop(10);
  if (top.length < 5) return null;
  const total = top.length;
  const cols = [top.slice(0, Math.ceil(total / 2)), top.slice(Math.ceil(total / 2))];

  return (
    <section className="bg-[#0f172a] px-6 md:px-20 py-14 md:py-20 border-t border-slate-800">
      <div className="max-w-6xl">
        <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">ParkRating · Coasters</p>
        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
          The <span className="text-brand">Top 10</span> coasters
        </h2>
        <p className="mt-3 text-slate-400 max-w-xl leading-relaxed">
          The best rides we&apos;ve been on, ranked across every park we&apos;ve reviewed. Click a name for the full review.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-12">
          {cols.map((col, c) => (
            <ol key={c} className="divide-y divide-slate-800 border-t border-slate-800">
              {col.map((coaster, i) => {
                const rank = c * cols[0].length + i;
                return (
                  <li key={coaster.id}>
                    <Link href={`/coasters/${coaster.slug}`} className="group flex items-center gap-4 py-3.5">
                      <span className={`w-7 text-lg font-black tabular-nums ${rankColor(rank)}`}>{rank + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-slate-100 group-hover:text-white">{coaster.name}</span>
                        <span className="block truncate text-xs text-slate-500">{[coaster.parkName, coaster.manufacturerName].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className={`text-lg font-bold tabular-nums ${getRatingColor(Number(coaster.rating))}`}>{score(coaster.rating)}</span>
                    </Link>
                  </li>
                );
              })}
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
