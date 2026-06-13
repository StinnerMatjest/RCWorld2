"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Factory, MapPin, RotateCw, ChevronDown } from "lucide-react";
import { getRatingColor, getRatingHex, RATING_TIERS } from "@/app/utils/design";

// ——— Types ———
type Coaster = {
  id: number;
  name: string;
  slug: string;
  manufacturer: string;
  rating: number;
  isBest: boolean;
  parkId: number;
  parkName: string;
  year: number;
  rideCount: number;
};

type Manufacturer = {
  name: string;
  coasters: Coaster[];
  count: number;
  avg: number;
  awards: Coaster[];
  top: Coaster;
  parks: number;
  rides: number;
};

// ——— Helpers ———
function parseCoasters(raw: any[]): Coaster[] {
  return raw
    .map((c): Coaster => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      manufacturer: c.manufacturer || "Unknown",
      rating: Number(c.rating) || 0,
      isBest: Boolean(c.isbestcoaster ?? c.isBestCoaster),
      parkId: c.parkId,
      parkName: c.parkName,
      year: c.year ?? 0,
      rideCount: Number(c.rideCount ?? c.ridecount) || 0,
    }))
    .filter((c) => c.rating > 0);
}

function aggregate(coasters: Coaster[]): Manufacturer[] {
  const map = new Map<string, Coaster[]>();
  for (const c of coasters) {
    if (!map.has(c.manufacturer)) map.set(c.manufacturer, []);
    map.get(c.manufacturer)!.push(c);
  }
  return [...map.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => b.rating - a.rating);
    return {
      name,
      coasters: sorted,
      count: list.length,
      avg: list.reduce((s, c) => s + c.rating, 0) / list.length,
      awards: sorted.filter((c) => c.isBest),
      top: sorted[0],
      parks: new Set(list.map((c) => c.parkId)).size,
      rides: list.reduce((s, c) => s + c.rideCount, 0),
    };
  });
}

const tierLabel = (avg: number) =>
  RATING_TIERS.find((t) => avg >= t.min)?.label ?? "—";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

// ——— Page ———
export default function ManufacturersClient({ initialCoasters }: { initialCoasters: any[] }) {
  const coasters = useMemo(() => parseCoasters(initialCoasters), [initialCoasters]);
  const manufacturers = useMemo(() => aggregate(coasters), [coasters]);

  // Hall of Fame ranking: trophies first, average breaks ties
  const byAwards = useMemo(
    () => [...manufacturers].sort((a, b) => b.awards.length - a.awards.length || b.avg - a.avg),
    [manufacturers],
  );
  const totalAwards = manufacturers.reduce((s, m) => s + m.awards.length, 0);

  if (coasters.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">No rated coasters yet.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">
            ParkRating · Manufacturers
          </p>
          <h1 className="text-4xl sm:text-5xl font-black mb-3 leading-tight">
            Manufacturer <span className="text-brand">Hall of Fame</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl">
            Every park we review hands out one Best Coaster award. Here&apos;s who actually wins
            them, and how every manufacturer&apos;s coasters stack up across our ratings.
            Click any coaster for the full breakdown.
          </p>

          {/* Stats strip */}
          <div className="flex flex-wrap gap-6 mt-8">
            {[
              { label: "Manufacturers", value: manufacturers.length.toLocaleString() },
              { label: "Coasters rated", value: coasters.length.toLocaleString() },
              { label: "Best Coaster awards", value: totalAwards.toLocaleString() },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Podium ───────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        <SectionHeading
          eyebrow="Best Coaster Awards"
          title="The Podium"
          sub="One award per park, given to its single best coaster. These are the three biggest winners."
        />
        <Podium podium={byAwards.slice(0, 3)} />
      </section>

      {/* ── Trophy cabinet ───────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        <SectionHeading
          eyebrow="Trophy Cabinet"
          title="Who Won What"
          sub="Every Best Coaster award we've handed out. Click a bar to see which rides earned them."
        />
        <div className="mt-8 space-y-5">
          {byAwards.filter((m) => m.awards.length > 0).map((m, i) => (
            <TrophyRow
              key={m.name}
              manu={m}
              maxAwards={byAwards[0]?.awards.length || 1}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* ── Score ladder ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        <SectionHeading
          eyebrow="Score Ladder"
          title="Average Rating per Manufacturer"
        />
        <div className="mt-8 space-y-2.5">
          {[...manufacturers]
            .sort((a, b) => b.avg - a.avg)
            .map((m, i) => (
              <LadderRow key={m.name} manu={m} index={i} />
            ))}
        </div>
      </section>

      {/* ── All manufacturers ────────────────────────────────────────────── */}
      <FullField manufacturers={manufacturers} />
    </div>
  );
}

// ——— Sections ———

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
      <p className="text-brand text-xs font-bold uppercase tracking-widest mb-2">{eyebrow}</p>
      <h2 className="text-2xl sm:text-4xl font-black leading-tight">{title}</h2>
      <div className="w-12 h-1 bg-brand rounded-full mt-3" />
      {sub && <p className="text-slate-400 text-sm sm:text-base mt-3 max-w-xl">{sub}</p>}
    </motion.div>
  );
}

// True podium: 2nd · 1st · 3rd at every screen size, blocks rising from the ground
const PODIUM_STYLES = [
  {
    medal: "text-yellow-300",
    glow: "drop-shadow-[0_0_8px_rgba(250,204,21,0.45)]",
    base: "from-yellow-400/30 to-yellow-400/[0.03] border-yellow-400/50",
    height: "h-28 sm:h-36",
  },
  {
    medal: "text-slate-300",
    glow: "",
    base: "from-slate-300/20 to-slate-300/[0.03] border-slate-400/40",
    height: "h-20 sm:h-24",
  },
  {
    medal: "text-amber-600",
    glow: "",
    base: "from-amber-700/25 to-amber-700/[0.03] border-amber-700/50",
    height: "h-14 sm:h-16",
  },
];

function Podium({ podium }: { podium: Manufacturer[] }) {
  // Visual order: runner-up left, champion center, third right
  const arranged = [podium[1], podium[0], podium[2]]
    .map((m, col) => ({ m, place: col === 1 ? 1 : col === 0 ? 2 : 3 }))
    .filter((x) => x.m);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end mt-10">
        {arranged.map(({ m, place }) => {
          const s = PODIUM_STYLES[place - 1];
          return (
            <motion.div
              key={m.name}
              {...fadeUp}
              transition={{ duration: 0.5, delay: place * 0.1 }}
              className="flex flex-col items-center text-center min-w-0"
            >
              <Trophy className={`w-6 h-6 sm:w-8 sm:h-8 mb-1.5 ${s.medal} ${s.glow}`} />
              <div className={`text-3xl sm:text-5xl font-black tabular-nums leading-none ${s.medal}`}>
                {m.awards.length}
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500 font-semibold mt-0.5 mb-2">
                award{m.awards.length !== 1 ? "s" : ""}
              </div>
              <h3 className="font-black text-sm sm:text-xl leading-tight break-words w-full px-1">
                {m.name}
              </h3>
              <p className="text-[11px] sm:text-sm text-slate-400 mt-1 mb-3">
                avg <span className={`font-bold ${getRatingColor(m.avg)}`}>{m.avg.toFixed(2)}</span>
                <span className="hidden sm:inline"> · {m.count} coasters</span>
              </p>
              <motion.div
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: place * 0.1, ease: "easeOut" }}
                style={{ transformOrigin: "bottom" }}
                className={`w-full ${s.height} rounded-t-2xl border-t-2 bg-gradient-to-b ${s.base} flex items-start justify-center pt-2.5`}
              >
                <span className={`text-2xl sm:text-3xl font-black ${s.medal} opacity-80`}>{place}</span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Best Coaster winners per manufacturer, aligned under each podium column */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 border-t-2 border-slate-700/60 pt-3">
        {arranged.map(({ m, place }) => (
          <motion.ul
            key={m.name}
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.3 + place * 0.1 }}
            className="space-y-1 min-w-0"
          >
            {m.awards.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/coasters/${c.slug}`}
                  title={`${c.name} — Best Coaster at ${c.parkName}`}
                  className="flex items-center justify-between gap-1.5 rounded-md border border-yellow-400/20 bg-slate-800/70 px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs hover:border-yellow-400/50 transition group"
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <Trophy className="w-3 h-3 flex-shrink-0 text-yellow-300/80" />
                    <span className="truncate text-slate-300 group-hover:text-white">{c.name}</span>
                  </span>
                  <span className={`tabular-nums font-bold flex-shrink-0 ${getRatingColor(c.rating)}`}>
                    {c.rating.toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </motion.ul>
        ))}
      </div>
    </>
  );
}

function TrophyRow({ manu, maxAwards, index }: { manu: Manufacturer; maxAwards: number; index: number }) {
  const [open, setOpen] = useState(false);
  const pct = (manu.awards.length / maxAwards) * 100;
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.4, delay: index * 0.05 }}>
      <div className="flex items-start gap-3">
        <span className="w-24 sm:w-44 flex-shrink-0 text-[13px] sm:text-sm font-semibold text-slate-200 text-right leading-9 truncate">
          {manu.name}
        </span>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="relative block w-full h-9 rounded-lg bg-slate-800/60 border border-slate-800 overflow-hidden cursor-pointer text-left group"
          >
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: index * 0.05, ease: "easeOut" }}
              className="h-full min-w-fit rounded-lg bg-gradient-to-r from-amber-500/30 to-yellow-400/40 border-r border-yellow-400/40 flex items-center gap-1.5 px-2.5"
            >
              {manu.awards.map((c) => (
                <Trophy
                  key={c.id}
                  className="w-4 h-4 flex-shrink-0 text-yellow-300 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]"
                />
              ))}
            </motion.div>
            <ChevronDown
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <ul className="pt-2 space-y-1.5">
                  {manu.awards.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/coasters/${c.slug}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[13px] hover:border-slate-500 transition group/award"
                      >
                        <span className="flex items-baseline gap-2 min-w-0">
                          <span className="truncate text-slate-200 group-hover/award:text-white">{c.name}</span>
                          <span className="text-xs text-slate-500 truncate hidden sm:inline">{c.parkName}</span>
                        </span>
                        <span className={`tabular-nums font-bold flex-shrink-0 ${getRatingColor(c.rating)}`}>
                          {c.rating.toFixed(1)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="w-6 flex-shrink-0 text-sm font-black text-yellow-300 tabular-nums leading-9">
          {manu.awards.length}
        </span>
      </div>
    </motion.div>
  );
}

function LadderRow({ manu, index }: { manu: Manufacturer; index: number }) {
  const pct = (manu.avg / 11) * 100;
  const hex = getRatingHex(manu.avg);
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}>
      <div className="flex items-center gap-3">
        <span className="w-24 sm:w-44 flex-shrink-0 text-[13px] sm:text-sm font-semibold text-slate-200 truncate text-right">
          {manu.name}
        </span>
        <div className="flex-1 h-7 rounded-md bg-slate-800/60 border border-slate-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
            className="h-full rounded-md"
            style={{ backgroundColor: hex }}
          />
        </div>
        <span className="w-20 sm:w-28 flex-shrink-0 text-sm tabular-nums">
          <span className={`font-black ${getRatingColor(manu.avg)}`}>{manu.avg.toFixed(2)}</span>
          <span className="text-slate-600 text-xs"> · {manu.count}×</span>
        </span>
      </div>
    </motion.div>
  );
}

// ——— All manufacturers grid ———

const SORTS = [
  { key: "awards", label: "Awards" },
  { key: "avg", label: "Avg rating" },
  { key: "count", label: "Most coasters" },
  { key: "top", label: "Top coaster" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function FullField({ manufacturers }: { manufacturers: Manufacturer[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("awards");

  const sorted = useMemo(() => {
    const list = [...manufacturers];
    switch (sortBy) {
      case "awards": return list.sort((a, b) => b.awards.length - a.awards.length || b.avg - a.avg);
      case "avg": return list.sort((a, b) => b.avg - a.avg);
      case "count": return list.sort((a, b) => b.count - a.count || b.avg - a.avg);
      case "top": return list.sort((a, b) => b.top.rating - a.top.rating);
    }
  }, [manufacturers, sortBy]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <SectionHeading
          eyebrow="All Manufacturers"
          title="The Full Breakdown"
          sub="Explore every manufacturer's full line-up below. Each square is one coaster, colored by its rating."
        />
        <div className="flex flex-wrap gap-1.5 flex-shrink-0">
          {SORTS.map(({ key, label }) => {
            const on = sortBy === key;
            return (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${on
                  ? "bg-brand/10 border-brand/40 text-brand/80"
                  : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-brand" : "bg-slate-600"}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {sorted.map((m, i) => (
          <ManufacturerCard key={m.name} manu={m} index={i} />
        ))}
      </div>
    </section>
  );
}

function ManufacturerCard({ manu, index }: { manu: Manufacturer; index: number }) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
      className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 flex flex-col gap-4 hover:border-slate-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-black leading-snug">{manu.name}</h3>
        {manu.awards.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-xs font-bold flex-shrink-0">
            <Trophy className="w-3 h-3" /> {manu.awards.length}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-black tabular-nums ${getRatingColor(manu.avg)}`}>
          {manu.avg.toFixed(2)}
        </span>
        <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
          {tierLabel(manu.avg)} average
        </span>
      </div>

      {/* One square per coaster, best first, palette colors */}
      <div className="flex flex-wrap gap-1">
        {manu.coasters.map((c) => (
          <Link
            key={c.id}
            href={`/coasters/${c.slug}`}
            title={`${c.name}: ${c.rating.toFixed(1)}`}
            className="w-4 h-4 rounded-[4px] hover:scale-125 hover:ring-2 hover:ring-white/60 transition-transform"
            style={{ backgroundColor: getRatingHex(c.rating) }}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Factory className="w-3.5 h-3.5 text-slate-600" /> {manu.count} coaster{manu.count !== 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-600" /> {manu.parks} park{manu.parks !== 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <RotateCw className="w-3.5 h-3.5 text-slate-600" /> {manu.rides} ride{manu.rides !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-auto pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2 text-sm">
        <Link
          href={`/coasters/${manu.top.slug}`}
          className="min-w-0 flex items-baseline gap-2 text-slate-300 hover:text-indigo-300 hover:underline transition-colors"
        >
          <span className="text-slate-600 text-xs flex-shrink-0">Best:</span>
          <span className="truncate">{manu.top.name}</span>
          <span className={`tabular-nums font-bold flex-shrink-0 ${getRatingColor(manu.top.rating)}`}>
            {manu.top.rating.toFixed(1)}
          </span>
        </Link>
        <Link
          href={`/coasterratings?q=${encodeURIComponent(manu.name)}`}
          className="flex-shrink-0 text-xs text-slate-500 hover:text-brand transition-colors"
        >
          See all {manu.count} →
        </Link>
      </div>
    </motion.div>
  );
}
