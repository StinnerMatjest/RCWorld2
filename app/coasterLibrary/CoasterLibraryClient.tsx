"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getRatingColor } from "@/app/utils/design";
import { useSearch } from "@/app/context/SearchContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import type { RollerCoasterSpecs } from "@/app/types";

type Coaster = {
  id: number;
  name: string;
  manufacturer: string; // Keep this as string, it holds the mapped manufacturerName
  model: string;
  scale: string;
  haveRidden: boolean;
  isBestCoaster: boolean;
  rideCount: number;
  visitCount: number;
  rating: number | null;
  parkId: number;
  parkName: string;
  country: string;
  year: number;
  lastVisitDate: string | null;
  slug: string;
  specs?: RollerCoasterSpecs | null;
};

// ——— Helpers ———
// pinned locale AND timezone: server and client must format identically (hydration)
const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—";
const isDefined = (v: unknown) => v !== null && v !== undefined;

const compare = (a: unknown, b: unknown, dir: "asc" | "desc"): number => {
  if (a === b) return 0;
  if (!isDefined(a)) return 1;
  if (!isDefined(b)) return -1;
  const isParsableDate = (x: unknown) =>
    typeof x === "string" && !Number.isFinite(+x) && !Number.isNaN(Date.parse(x));
  if (isParsableDate(a) && isParsableDate(b)) {
    return dir === "asc"
      ? new Date(a as string).getTime() - new Date(b as string).getTime()
      : new Date(b as string).getTime() - new Date(a as string).getTime();
  }
  if (typeof a === "number" && typeof b === "number")
    return dir === "asc" ? a - b : b - a;
  const sa = String(a), sb = String(b);
  return dir === "asc"
    ? sa.localeCompare(sb, "en", { ignorePunctuation: true, sensitivity: "base" })
    : sb.localeCompare(sa, "en", { ignorePunctuation: true, sensitivity: "base" });
};

const ALL_COLUMNS = [
  { key: "rating", label: "Rating" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "parkName", label: "Park" },
  { key: "country", label: "Country" },
  { key: "year", label: "Year" },
  { key: "rideCount", label: "Rides" },
  { key: "lastVisitDate", label: "Last Ridden" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

const DESKTOP_DEFAULT: ColumnKey[] = ["rating", "manufacturer", "parkName", "year", "rideCount"];
const DESC_BY_DEFAULT: ColumnKey[] = ["rating", "rideCount", "lastVisitDate"];

// rank colours: podium ranks pop, the rest stay quiet
const rankClass = (i: number) =>
  i === 0 ? "text-yellow-400 font-black"
  : i === 1 ? "text-slate-300 font-black"
  : i === 2 ? "text-amber-600 font-black"
  : "text-slate-500 font-semibold";

// mobile lenses: one segmented control that both sorts the list and decides
// which stat each row displays — you can never sort by something you can't see
// (maker lives in every row's subline instead of being a lens)
const LENSES = [
  { key: "rating", label: "Score" },
  { key: "year", label: "Year" },
  { key: "rideCount", label: "Rides" },
  { key: "lastVisitDate", label: "Last" },
] as const;

function parseCoasterList(raw: any[]): Coaster[] {
  return raw.map((c): Coaster => ({
    id: c.id,
    name: c.name,
    manufacturer: c.manufacturerName || "Unknown",
    model: c.model,
    scale: c.scale,
    haveRidden: c.haveRidden,
    isBestCoaster: c.isBestCoaster,
    rideCount: c.rideCount ?? 0,
    visitCount: c.visitCount ?? 1,
    rating: c.rating === null || c.rating === undefined ? null : typeof c.rating === "string" ? parseFloat(c.rating) : c.rating,
    parkId: c.parkId,
    parkName: c.parkName,
    country: c.country ?? "Unknown",
    year: c.year ?? 0,
    lastVisitDate: c.lastVisitDate,
    slug: c.slug,
    specs: c.specs ? {
      type: c.specs.type,
      classification: c.specs.classification,
      length: c.specs.length,
      height: c.specs.height,
      drop: c.specs.drop,
      speed: c.specs.speed,
      inversions: c.specs.inversions,
      verticalAngle: c.specs.verticalAngle,
      gforce: c.specs.gforce,
      duration: c.specs.duration,
      notes: c.specs.notes,
    } : null,
  })).filter(c => (c.rating ?? 0) > 0);
}

// ——— Inner Component ———
function CoasterRatingsContent({ initialCoasters }: { initialCoasters?: any[] }) {
  const [coasters, setCoasters] = useState<Coaster[]>(() =>
    initialCoasters ? parseCoasterList(initialCoasters) : []
  );
  const [loading, setLoading] = useState(!initialCoasters);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<ColumnKey | "name">("rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // must be identical on server and client (hydration) — the mobile layout is
  // handled by responsive classes, not by trimming this list at first render
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(DESKTOP_DEFAULT);

  const searchCtx = useSearch() as { query: string; setQuery?: (q: string) => void };
  const rawQuery = searchCtx?.query ?? "";
  const q = rawQuery.trim().toLowerCase();
  const setQuery = searchCtx?.setQuery;
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlQ = searchParams.get("q");
    if (urlQ && setQuery) setQuery(urlQ);
  }, [searchParams, setQuery]);

  useEffect(() => () => { if (setQuery) setQuery(""); }, []);

  useEffect(() => {
    if (initialCoasters) return;
    (async () => {
      try {
        const res = await fetch("/api/coasters");
        const data = await res.json();
        if (!data || !Array.isArray(data.coasters)) throw new Error("Unexpected data");
        setCoasters(parseCoasterList(data.coasters));
      } catch (err: any) {
        setError(err?.message ?? "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo<Coaster[]>(() => {
    if (!q) return coasters;
    return coasters.filter(c => {
      const hay = [
        c.name, c.parkName, c.country, c.manufacturer, c.model, c.specs?.type,
        c.specs?.classification?.replace(/\|/g, " "), String(c.year),
        c.rating != null ? c.rating.toFixed(1) : "",
        String(c.rideCount ?? ""), formatDate(c.lastVisitDate),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [coasters, q]);

  const sorted = useMemo<Coaster[]>(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "rating") {
        const d = sortDir === "asc" ? 1 : -1;
        const rDiff = ((a.rating ?? 0) - (b.rating ?? 0)) * d;
        if (rDiff !== 0) return rDiff;
        const cDiff = ((a.rideCount ?? 0) - (b.rideCount ?? 0)) * d;
        if (cDiff !== 0) return cDiff;
        const aT = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
        const bT = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
        return (aT - bT) * d;
      }
      return compare(
        a[sortBy as keyof Coaster] ?? (sortBy === "name" ? a.name : undefined),
        b[sortBy as keyof Coaster] ?? (sortBy === "name" ? b.name : undefined),
        sortDir,
      );
    });
  }, [filtered, sortBy, sortDir]);

  const totalRides = useMemo(
    () => sorted.reduce((s, c) => s + (c.rideCount ?? 0), 0), [sorted],
  );
  const avgRating = useMemo(() => {
    const vals = sorted.map(c => c.rating).filter((r): r is number => r != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }, [sorted]);
  const uniqueParks = useMemo(
    () => new Set(sorted.map(c => c.parkId)).size, [sorted],
  );

  function handleSort(col: ColumnKey | "name") {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir(col === "name" || !DESC_BY_DEFAULT.includes(col as ColumnKey) ? "asc" : "desc"); }
  }
  function toggleCol(col: ColumnKey) {
    setVisibleCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }
  const colOn = (k: ColumnKey) => visibleCols.includes(k);

  // one shared grid template so header labels and row values stay column-aligned
  const gridTemplate = useMemo(() => [
    "44px",                                        // rank
    "minmax(0, 1.4fr)",                            // name
    visibleCols.includes("manufacturer") ? "minmax(110px, 0.8fr)" : null,
    visibleCols.includes("parkName") ? "minmax(120px, 0.9fr)" : null,
    visibleCols.includes("country") ? "minmax(90px, 0.6fr)" : null,
    visibleCols.includes("year") ? "60px" : null,
    visibleCols.includes("rideCount") ? "60px" : null,
    visibleCols.includes("lastVisitDate") ? "105px" : null,
    visibleCols.includes("rating") ? "84px" : null, // score anchors the right
  ].filter(Boolean).join(" "), [visibleCols]);

  if (loading) return <LoadingSpinner className="pt-24" />;
  if (error) return <p className="p-4 text-red-400">Error: {error}</p>;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">
            ParkRating · Coaster Library
          </p>
          <h1 className="text-4xl sm:text-5xl font-black mb-3 leading-tight">
            Coaster <span className="text-brand">Rankings</span>
          </h1>
          <p className="text-slate-400 text-base max-w-xl">
            Every coaster we&apos;ve ridden, rated across ride quality, intensity and reridability.
            Click any name for the full breakdown.
          </p>

          {/* Stats strip: 2x2 on phones, one row from sm up */}
          {coasters.length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-6 mt-8">
              {[
                { label: "Coasters rated", value: coasters.length.toLocaleString() },
                { label: "Parks visited", value: new Set(coasters.map(c => c.parkId)).size.toLocaleString() },
                { label: "Total rides", value: coasters.reduce((s, c) => s + (c.rideCount ?? 0), 0).toLocaleString() },
                { label: "Avg rating", value: (() => { const vals = coasters.map(c => c.rating).filter((r): r is number => r != null); return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : "—"; })() },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-black text-brand">{s.value}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 space-y-4">
        <div className="relative group max-w-2xl mx-auto">
          <div className="absolute -inset-[1.5px] rounded-xl bg-gradient-to-r from-brand via-amber-500 to-orange-600 opacity-30 blur-sm group-focus-within:opacity-60 transition" />
          <div className="relative rounded-xl bg-slate-900 border border-slate-700">
            <div className="flex items-center gap-3 px-4 py-3">
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                value={rawQuery}
                onChange={e => setQuery?.(e.target.value)}
                placeholder="Search by name, park, manufacturer, rating, year…"
                className="w-full bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500"
                aria-label="Search coasters"
              />
              {rawQuery && (
                <button
                  onClick={() => setQuery?.("")}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* detail toggles: which extras show on each row */}
        <div className="hidden sm:flex flex-wrap justify-center gap-1.5">
          {ALL_COLUMNS.map(({ key, label }) => {
            const on = colOn(key);
            return (
              <button
                key={key}
                onClick={() => toggleCol(key)}
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

      {/* ── Leaderboard: aligned columns, list skin, score anchored right ── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
          {/* header: real aligned column labels on desktop, sort pills on mobile */}
          <div className="sticky top-0 z-20 rounded-t-2xl bg-slate-900/95 backdrop-blur border-b border-slate-800">
            <div
              className="hidden md:grid items-center gap-x-4 px-5 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-slate-400"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span className="text-right text-slate-600">#</span>
              <HeadSort label="Coaster" k="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              {colOn("manufacturer") && <HeadSort label="Manufacturer" k="manufacturer" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
              {colOn("parkName") && <HeadSort label="Park" k="parkName" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
              {colOn("country") && <HeadSort label="Country" k="country" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
              {colOn("year") && <HeadSort label="Year" k="year" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
              {colOn("rideCount") && <HeadSort label="Rides" k="rideCount" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
              {colOn("lastVisitDate") && <HeadSort label="Last ridden" k="lastVisitDate" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
              {colOn("rating") && <HeadSort label="Score" k="rating" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} right />}
            </div>
            {/* mobile: the lens — picking a stat sorts by it AND makes it the row value */}
            <div className="md:hidden px-2 py-2">
              <div className="flex rounded-full bg-slate-800/80 border border-slate-700/60 p-1">
                {LENSES.map((l) => {
                  const active = sortBy === l.key;
                  return (
                    <button
                      key={l.key}
                      onClick={() => handleSort(l.key)}
                      className={`flex-1 py-1.5 rounded-full text-[10.5px] font-black uppercase tracking-wide transition cursor-pointer ${active ? "bg-brand text-slate-950" : "text-slate-400"}`}
                    >
                      {l.label}
                      {active && <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ranked list: ol keeps the ranking semantic for crawlers */}
          <ol className="divide-y divide-slate-800/60">
            {sorted.map((c, i) => (
              <li key={c.id} className="group hover:bg-slate-800/40 transition-colors last:rounded-b-2xl">
                <div
                  className="flex items-center gap-2.5 px-3 py-2 md:grid md:gap-x-4 md:px-5 md:py-2.5"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {/* rank */}
                  <span className={`w-7 md:w-auto shrink-0 text-right tabular-nums text-sm ${rankClass(i)}`}>
                    {i + 1}
                  </span>

                  {/* name (+ mobile-only subline): truncate so long names never blow up the row */}
                  <div className="min-w-0 flex-1 md:flex-none">
                    <Link
                      href={`/coasters/${c.slug}`}
                      className="block truncate text-[14px] sm:text-[15px] font-semibold text-slate-100 group-hover:text-brand-light hover:text-brand transition-colors"
                    >
                      {c.name}
                    </Link>
                    <div className="md:hidden truncate text-[11px] text-slate-500">
                      <Link href={`/park/${c.parkId}`} className="hover:text-brand transition-colors">
                        {c.parkName}
                      </Link>
                      {colOn("country") && (
                        <>
                          {" · "}
                          <button onClick={() => setQuery?.(c.country)} className="hover:text-brand transition-colors cursor-pointer">
                            {c.country}
                          </button>
                        </>
                      )}
                      {" · "}
                      <span className="text-slate-400">{c.manufacturer}</span>
                    </div>
                  </div>

                  {/* aligned data columns, desktop only */}
                  {colOn("manufacturer") && (
                    <button
                      onClick={() => setQuery?.(c.manufacturer)}
                      className="hidden md:block truncate text-left text-[13px] text-slate-300 hover:text-brand-light transition cursor-pointer"
                    >
                      {c.manufacturer}
                    </button>
                  )}
                  {colOn("parkName") && (
                    <Link
                      href={`/park/${c.parkId}`}
                      className="hidden md:block truncate text-[13px] text-slate-300 hover:text-brand-light transition-colors"
                    >
                      {c.parkName}
                    </Link>
                  )}
                  {colOn("country") && (
                    <button
                      onClick={() => setQuery?.(c.country)}
                      className="hidden md:block truncate text-left text-[13px] text-slate-400 hover:text-brand-light transition cursor-pointer"
                    >
                      {c.country}
                    </button>
                  )}
                  {colOn("year") && (
                    <span className="hidden md:block text-[13px] text-slate-400 tabular-nums">{c.year || "—"}</span>
                  )}
                  {colOn("rideCount") && (
                    <span className="hidden md:block text-[13px] text-slate-300 tabular-nums">{c.rideCount}</span>
                  )}
                  {colOn("lastVisitDate") && (
                    <span className="hidden md:block text-[13px] text-slate-400 tabular-nums">{formatDate(c.lastVisitDate)}</span>
                  )}

                  {/* desktop: score anchors the right */}
                  {colOn("rating") && (
                    <div className={`hidden md:block text-right ${c.rating != null ? getRatingColor(c.rating) : "text-slate-600"}`}>
                      <div className="text-lg font-black tabular-nums leading-tight">
                        {c.rating != null ? c.rating.toFixed(1) : "—"}
                      </div>
                      {c.rating != null && (
                        <div className="h-[3px] mt-0.5 rounded-full bg-slate-700/60 overflow-hidden">
                          <div className="h-full bg-current rounded-full" style={{ width: `${Math.min(100, c.rating * 10)}%` }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* mobile: the active lens is the row value; score rides along small */}
                  <div className="md:hidden shrink-0 text-right max-w-[120px]">
                    {sortBy === "rating" || !LENSES.some((l) => l.key === sortBy) ? (
                      <div className={`w-12 ml-auto ${c.rating != null ? getRatingColor(c.rating) : "text-slate-600"}`}>
                        <div className="text-[15px] font-black tabular-nums leading-tight">
                          {c.rating != null ? c.rating.toFixed(1) : "—"}
                        </div>
                        {c.rating != null && (
                          <div className="h-[3px] mt-0.5 rounded-full bg-slate-700/60 overflow-hidden">
                            <div className="h-full bg-current rounded-full" style={{ width: `${Math.min(100, c.rating * 10)}%` }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="text-[14px] font-black text-slate-100 tabular-nums truncate leading-tight">
                          {sortBy === "year"
                            ? c.year || "—"
                            : sortBy === "rideCount"
                              ? `${c.rideCount} ${c.rideCount === 1 ? "ride" : "rides"}`
                              : formatDate(c.lastVisitDate)}
                        </div>
                        <div className={`text-[11px] font-bold tabular-nums ${c.rating != null ? getRatingColor(c.rating) : "text-slate-600"}`}>
                          {c.rating != null ? c.rating.toFixed(1) : "—"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function HeadSort({ label, k, sortBy, sortDir, onSort, right }: {
  label: string;
  k: ColumnKey | "name";
  sortBy: ColumnKey | "name";
  sortDir: "asc" | "desc";
  onSort: (k: ColumnKey | "name") => void;
  right?: boolean;
}) {
  const active = sortBy === k;
  return (
    <button
      onClick={() => onSort(k)}
      className={`select-none cursor-pointer uppercase tracking-wider font-semibold transition-colors ${right ? "text-right" : "text-left"} ${active ? "text-brand" : "text-slate-400 hover:text-slate-200"}`}
    >
      {label}
      {active && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

export default function CoasterRatingsPage({ initialCoasters }: { initialCoasters?: any[] }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
      <CoasterRatingsContent initialCoasters={initialCoasters} />
    </Suspense>
  );
}