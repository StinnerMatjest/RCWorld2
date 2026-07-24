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
const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB") : "—";
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
const MOBILE_DEFAULT: ColumnKey[] = ["rating", "manufacturer"];
const DESC_BY_DEFAULT: ColumnKey[] = ["rating", "rideCount", "lastVisitDate"];

const ROW_H = 48;
const INDEX_W = 52;
const NAME_W_M = 130;
const NAME_W_D = 260;

const COL_MIN_W: Record<ColumnKey, number> = {
  rating: 80, manufacturer: 130, parkName: 150, country: 120,
  rideCount: 90, lastVisitDate: 130, year: 80,
};

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
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? MOBILE_DEFAULT : DESKTOP_DEFAULT
  );

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

          {/* Stats strip */}
          {coasters.length > 0 && (
            <div className="flex flex-wrap gap-6 mt-8">
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap justify-center gap-1.5 flex-1">
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
      </div>

      {/* ── Table ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-x-auto">
          <table className="w-full table-fixed text-sm text-left">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <th className="sticky left-0 z-[2] bg-slate-900 text-center font-semibold" style={{ width: INDEX_W }}>#</th>
                <ThSort label="Name" active={sortBy === "name"} dir={sortDir} onClick={() => handleSort("name")} sticky style={{ left: INDEX_W, width: NAME_W_D }} />
                {ALL_COLUMNS.map(({ key, label }) => colOn(key) ? (
                  <ThSort key={key} label={label} active={sortBy === key} dir={sortDir} onClick={() => handleSort(key)} />
                ) : null)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.map((c, i) => (
                <tr key={c.id} className="group hover:bg-slate-700/30 transition-colors">
                  <td className="sticky left-0 z-[1] bg-slate-800/60 group-hover:bg-slate-700/40 text-center text-slate-500 text-xs font-medium" style={{ width: INDEX_W }}>
                    {i + 1}
                  </td>
                  <td className="sticky z-[1] bg-slate-800/60 group-hover:bg-slate-700/40 py-0 pr-6 font-semibold text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis" style={{ left: INDEX_W, width: NAME_W_D, height: ROW_H }}>
                    <Link href={`/coasters/${c.slug}`} className="hover:text-brand transition-colors hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  {colOn("rating") && (
                    <td className="px-4" style={{ height: ROW_H }}><RatingBadge rating={c.rating} /></td>
                  )}
                  {colOn("manufacturer") && (
                    <td className="px-4 whitespace-nowrap text-slate-300" style={{ height: ROW_H }}>
                      {/* FIX: Now correctly uses the mapped 'manufacturer' property which holds the string name */}
                      <button onClick={() => setQuery?.(c.manufacturer)} className="hover:text-brand hover:underline cursor-pointer transition-colors">
                        {c.manufacturer}
                      </button>
                    </td>
                  )}
                  {colOn("parkName") && (
                    <td className="px-4 whitespace-nowrap" style={{ height: ROW_H }}>
                      <Link href={`/park/${c.parkId}`} className="text-slate-300 hover:text-brand hover:underline transition-colors">
                        {c.parkName}
                      </Link>
                    </td>
                  )}
                  {colOn("country") && (
                    <td className="px-4 whitespace-nowrap" style={{ height: ROW_H }}>
                      <button onClick={() => setQuery?.(c.country)} className="text-slate-300 hover:text-brand hover:underline transition-colors cursor-pointer">
                        {c.country}
                      </button>
                    </td>
                  )}
                  {colOn("year") && (
                    <td className="px-4 whitespace-nowrap text-slate-400" style={{ height: ROW_H }}>{c.year || "—"}</td>
                  )}
                  {colOn("rideCount") && (
                    <td className="px-4 whitespace-nowrap text-slate-300" style={{ height: ROW_H }}>
                      <div className="flex items-baseline gap-1">
                        <span>{c.rideCount}</span>
                      </div>
                    </td>
                  )}
                  {colOn("lastVisitDate") && (
                    <td className="px-4 whitespace-nowrap text-slate-400 text-xs" style={{ height: ROW_H }}>{formatDate(c.lastVisitDate)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-slate-600">—</span>;
  return (
    <span className={`inline-block tabular-nums font-bold text-sm ${getRatingColor(rating)}`}>
      {rating.toFixed(1)}
    </span>
  );
}

function ThSort({ label, active, dir, onClick, sticky, style }: ThSortProps) {
  return (
    <th
      scope="col"
      onClick={onClick}
      className={`px-4 py-3 select-none font-semibold cursor-pointer hover:text-white transition-colors ${active ? "text-brand" : "text-slate-300"
        } ${sticky ? "sticky z-[2] bg-slate-800/60" : ""}`}
      style={style}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}

interface ThSortProps {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  sticky?: boolean;
  style?: React.CSSProperties;
}

export default function CoasterRatingsPage({ initialCoasters }: { initialCoasters?: any[] }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
      <CoasterRatingsContent initialCoasters={initialCoasters} />
    </Suspense>
  );
}