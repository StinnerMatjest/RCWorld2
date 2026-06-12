"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getRatingColor } from "@/app/utils/design";
import { useSearch } from "@/app/context/SearchContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import type { RollerCoasterSpecs } from "@/app/types";

// ——— Types ———
type Coaster = {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
  scale: string;
  haveRidden: boolean;
  isBestCoaster: boolean;
  rcdbPath: string;
  rideCount: number;
  visitCount: number;
  rating: number | null;
  parkId: number;
  parkName: string;
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
  rating: 80, manufacturer: 130, parkName: 150,
  rideCount: 90, lastVisitDate: 130, year: 80,
};

function parseCoasterList(raw: any[]): Coaster[] {
  return raw.map((c): Coaster => ({
    id: c.id, name: c.name, manufacturer: c.manufacturer, model: c.model,
    scale: c.scale, haveRidden: c.haveRidden, isBestCoaster: c.isBestCoaster,
    rcdbPath: c.rcdbPath,
    rideCount: c.rideCount ?? 0,
    visitCount: c.visitCount ?? 1,
    rating:
      c.rating === null || c.rating === undefined ? null
        : typeof c.rating === "string" ? parseFloat(c.rating) : c.rating,
    parkId: c.parkId, parkName: c.parkName,
    year: c.year ?? 0, lastVisitDate: c.lastVisitDate, slug: c.slug,
    specs: c.specs ? {
      type: c.specs.type, classification: c.specs.classification,
      length: c.specs.length, height: c.specs.height, drop: c.specs.drop,
      speed: c.specs.speed, inversions: c.specs.inversions,
      verticalAngle: c.specs.verticalAngle, gforce: c.specs.gforce,
      duration: c.specs.duration, notes: c.specs.notes,
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
        c.name, c.parkName, c.manufacturer, c.model, c.specs?.type,
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
        {/* Search */}
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

        {/* Column toggles + sort (sort hidden on mobile — click headers instead) */}
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

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">

        {/* MOBILE */}
        <div className="sm:hidden">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-hidden">
            <div className="grid" style={{ gridTemplateColumns: `${INDEX_W + NAME_W_M}px 1fr` }}>
              {/* Frozen left */}
              <div className="overflow-hidden">
                <table className="w-full text-sm text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-700">
                      <th style={{ width: INDEX_W, height: ROW_H }} className="text-center font-semibold">#</th>
                      <th
                        style={{ width: NAME_W_M, height: ROW_H }}
                        className={`pr-2 font-semibold cursor-pointer select-none hover:text-white transition-colors ${sortBy === "name" ? "text-brand" : ""}`}
                        onClick={() => handleSort("name")}
                      >
                        Name {sortBy === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c, i) => (
                      <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td style={{ width: INDEX_W, height: ROW_H }} className="text-center text-slate-500 text-xs">{i + 1}</td>
                        <td style={{ width: NAME_W_M }} className="pr-2 font-medium text-slate-100 text-[13px] truncate">
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            <Link href={`/coasters/${c.slug}`} className="text-slate-100 hover:text-brand truncate hover:underline">
                              {c.name}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-700">
                    <tr className="bg-slate-700/30 text-slate-300 font-semibold text-xs">
                      <td style={{ width: INDEX_W, height: ROW_H }} />
                      <td style={{ width: NAME_W_M }} className="pr-2">
                        <div className="flex items-center" style={{ height: ROW_H }}>Summary</div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Scrollable right */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-700">
                      {ALL_COLUMNS.map(({ key, label }) => colOn(key) ? (
                        <th
                          key={key}
                          className={`px-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors ${sortBy === key ? "text-brand" : ""}`}
                          style={{ minWidth: COL_MIN_W[key], height: ROW_H }}
                          onClick={() => handleSort(key)}
                        >
                          {label} {sortBy === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                      ) : null)}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(c => (
                      <tr key={c.id} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        {colOn("rating") && (
                          <td className="px-3 whitespace-nowrap" style={{ minWidth: COL_MIN_W.rating, height: ROW_H }}>
                            <RatingBadge rating={c.rating} />
                          </td>
                        )}
                        {colOn("manufacturer") && (
                          <td className="px-3 whitespace-nowrap text-[13px]" style={{ minWidth: COL_MIN_W.manufacturer }}>
                            <div className="flex items-center" style={{ height: ROW_H }}>
                              <button onClick={() => setQuery?.(c.manufacturer)} className="text-slate-300 hover:text-brand hover:underline truncate cursor-pointer" style={{ maxWidth: 200 }}>
                                {c.manufacturer}
                              </button>
                            </div>
                          </td>
                        )}
                        {colOn("parkName") && (
                          <td className="px-3 whitespace-nowrap text-[13px]" style={{ minWidth: COL_MIN_W.parkName }}>
                            <div className="flex items-center" style={{ height: ROW_H }}>
                              <Link href={`/park/${c.parkId}`} className="text-slate-300 hover:text-brand hover:underline truncate" style={{ maxWidth: 200 }}>
                                {c.parkName}
                              </Link>
                            </div>
                          </td>
                        )}
                        {colOn("year") && (
                          <td className="px-3 whitespace-nowrap text-slate-400" style={{ minWidth: COL_MIN_W.year }}>
                            <div className="flex items-center" style={{ height: ROW_H }}>{c.year || "—"}</div>
                          </td>
                        )}
                        {colOn("rideCount") && (
                          <td className="px-3 whitespace-nowrap text-slate-300" style={{ minWidth: COL_MIN_W.rideCount }}>
                            <div className="flex items-center gap-1" style={{ height: ROW_H }}>
                              <span>{c.rideCount}</span>
                              {c.visitCount > 1 && <span className="text-xs text-slate-600">({c.visitCount})</span>}
                            </div>
                          </td>
                        )}
                        {colOn("lastVisitDate") && (
                          <td className="px-3 whitespace-nowrap text-slate-400 text-xs" style={{ minWidth: COL_MIN_W.lastVisitDate }}>
                            <div className="flex items-center" style={{ height: ROW_H }}>{formatDate(c.lastVisitDate)}</div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-700">
                    <tr className="bg-slate-700/30 text-slate-300 font-semibold text-xs">
                      {ALL_COLUMNS.map(({ key }) => colOn(key) ? (
                        <td key={key} className="px-3 whitespace-nowrap" style={{ minWidth: COL_MIN_W[key] }}>
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            {key === "rideCount" ? totalRides.toLocaleString()
                              : key === "rating" && avgRating != null ? avgRating.toFixed(2)
                                : ""}
                          </div>
                        </td>
                      ) : null)}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
          <p className="text-right text-xs text-slate-500 mt-2">{sorted.length} results</p>
        </div>

        {/* DESKTOP */}
        <div className="hidden sm:block">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-x-auto">
            <table className="w-full table-fixed text-sm text-left">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-900 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                  <th className="sticky left-0 z-[2] bg-slate-900 text-center font-semibold" style={{ width: INDEX_W }}>
                    <span className="inline-block" style={{ width: INDEX_W }}>#</span>
                  </th>
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
                      <span className="inline-block" style={{ width: INDEX_W }}>{i + 1}</span>
                    </td>
                    <td className="sticky z-[1] bg-slate-800/60 group-hover:bg-slate-700/40 py-0 pr-6 font-semibold text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis" style={{ left: INDEX_W, width: NAME_W_D, height: ROW_H }}>
                      <Link href={`/coasters/${c.slug}`} className="hover:text-brand transition-colors hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    {colOn("rating") && (
                      <td className="px-4" style={{ height: ROW_H }}>
                        <RatingBadge rating={c.rating} />
                      </td>
                    )}
                    {colOn("manufacturer") && (
                      <td className="px-4 whitespace-nowrap text-slate-300" style={{ height: ROW_H }}>
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
                    {colOn("year") && (
                      <td className="px-4 whitespace-nowrap text-slate-400" style={{ height: ROW_H }}>
                        {c.year || "—"}
                      </td>
                    )}
                    {colOn("rideCount") && (
                      <td className="px-4 whitespace-nowrap text-slate-300" style={{ height: ROW_H }}>
                        <div className="flex items-baseline gap-1">
                          <span>{c.rideCount}</span>
                          {c.visitCount > 1 && <span className="text-xs text-slate-600">({c.visitCount})</span>}
                        </div>
                      </td>
                    )}
                    {colOn("lastVisitDate") && (
                      <td className="px-4 whitespace-nowrap text-slate-400 text-xs" style={{ height: ROW_H }}>
                        {formatDate(c.lastVisitDate)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-700">
                <tr className="bg-slate-700/30 text-slate-300 font-semibold text-xs">
                  <td className="sticky left-0 z-[1] bg-slate-700/30" style={{ width: INDEX_W }} />
                  <td className="sticky z-[1] bg-slate-700/30 py-3 pr-6 text-slate-400" style={{ left: INDEX_W, width: NAME_W_D }}>
                    {sorted.length} coasters · {uniqueParks} parks
                  </td>
                  {ALL_COLUMNS.map(({ key }) => colOn(key) ? (
                    <td key={key} className="px-4 py-3 whitespace-nowrap">
                      {key === "rideCount" ? totalRides.toLocaleString()
                        : key === "rating" && avgRating != null
                          ? <span className={getRatingColor(avgRating)}>{avgRating.toFixed(2)}</span>
                          : ""}
                    </td>
                  ) : null)}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-right text-xs text-slate-500 mt-2">{sorted.length} results</p>
        </div>
      </div>
    </div>
  );
}

// ——— Small sub-components ———

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-slate-600">—</span>;
  return (
    <span className={`inline-block tabular-nums font-bold text-sm ${getRatingColor(rating)}`}>
      {rating.toFixed(1)}
    </span>
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
function ThSort({ label, active, dir, onClick, sticky, style }: ThSortProps) {
  return (
    <th
      scope="col"
      onClick={onClick}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 select-none font-semibold cursor-pointer hover:text-white transition-colors ${active ? "text-brand" : "text-slate-300"
        } ${sticky ? "sticky z-[2] bg-slate-800/60" : ""}`}
      style={style}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? "opacity-100 text-brand" : "opacity-0"}`}>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      </span>
    </th>
  );
}

interface SortControlProps {
  sortBy: ColumnKey | "name";
  sortDir: "asc" | "desc";
  onChangeField: (c: ColumnKey | "name") => void;
  onToggleDir: () => void;
}
function SortControl({ sortBy, sortDir, onChangeField, onToggleDir }: SortControlProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.("#sort-ctrl")) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, [open]);

const OPTIONS: { key: ColumnKey | "name"; label: string }[] = [
    { key: "name", label: "Name" }, 
    { key: "rating", label: "Rating" },
    { key: "manufacturer", label: "Manufacturer" }, 
    { key: "parkName", label: "Park" },
    { key: "year", label: "Year" }, 
    { key: "rideCount", label: "Rides" }, 
    { key: "lastVisitDate", label: "Last Ridden" },
  ];
  const activeLabel = OPTIONS.find(o => o.key === sortBy)?.label ?? "Sort";

  return (
    <div id="sort-ctrl" className="relative inline-flex items-center gap-2 flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:border-slate-600 transition cursor-pointer"
      >
        <span className="font-medium text-slate-500">Sort</span>
        <span>{activeLabel}</span>
        <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.2l3.71-2.97a.75.75 0 011.04 1.08l-4.23 3.39a.75.75 0 01-.95 0L5.21 8.31a.75.75 0 01.02-1.1z" />
        </svg>
      </button>
      <button
        onClick={onToggleDir}
        className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 h-9 w-9 text-slate-400 hover:text-white hover:border-slate-600 transition cursor-pointer"
        aria-label="Toggle sort direction"
      >
        {sortDir === "asc" ? "↑" : "↓"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[115%] z-40 min-w-[200px] rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden"
        >
          <ul className="py-1">
            {OPTIONS.map(opt => {
              const active = opt.key === sortBy;
              return (
                <li key={opt.key}>
                  <button
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => { onChangeField(opt.key); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm cursor-pointer transition-colors ${active ? "text-brand/80 bg-brand/10" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                  >
                    {opt.label}
                    {active && <span className="text-brand">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ——— Exports ———
export default function CoasterRatingsPage({ initialCoasters }: { initialCoasters?: any[] }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
      <CoasterRatingsContent initialCoasters={initialCoasters} />
    </Suspense>
  );
}
