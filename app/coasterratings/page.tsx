"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getRatingColor } from "@/app/utils/design";
import { useSearch } from "@/app/context/SearchContext";

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
  rating: number | null;
  parkId: number;
  parkName: string;
  year: number;
  lastVisitDate: string | null; // ISO string
};

// ——— Helpers ———
const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";
const isDefined = (v: unknown) => v !== null && v !== undefined;

const compare = (a: unknown, b: unknown, dir: "asc" | "desc"): number => {
  if (a === b) return 0;
  if (!isDefined(a)) return 1;
  if (!isDefined(b)) return -1;

  const isParsableDate = (x: unknown) =>
    typeof x === "string" && !Number.isFinite(+x) && !Number.isNaN(Date.parse(x));
  if (isParsableDate(a) && isParsableDate(b)) {
    const da = new Date(a as string).getTime();
    const db = new Date(b as string).getTime();
    return dir === "asc" ? da - db : db - da;
  }

  if (typeof a === "number" && typeof b === "number")
    return dir === "asc" ? a - b : b - a;

  const sa = String(a);
  const sb = String(b);
  return dir === "asc"
    ? sa.localeCompare(sb, "en", { ignorePunctuation: true, sensitivity: "base" })
    : sb.localeCompare(sa, "en", { ignorePunctuation: true, sensitivity: "base" });
};

/** Toggleable columns (Name is always shown) */
const ALL_COLUMNS = [
  { key: "rating", label: "Rating" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "parkName", label: "Park" },
  { key: "rideCount", label: "Ride Count" },
  { key: "lastVisitDate", label: "Last Ridden" },
  { key: "year", label: "Year" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

/** Defaults: mobile shows Rating + Manufacturer; desktop will preselect all 6 via effect */
const DEFAULT_VISIBLE: ColumnKey[] = ["rating", "manufacturer"];
const DESC_BY_DEFAULT: ColumnKey[] = ["rating", "rideCount", "lastVisitDate"];

/** Column widths (px) */
const INDEX_COL_W_MOBILE = 48; // # column (mobile)
const NAME_COL_W_MOBILE = 112; // mobile name width
const NAME_COL_W_SM = 200;
const NAME_COL_W_LG = 300;

/** Shared fixed row height on mobile to keep the two tables perfectly aligned */
const ROW_H = 44; // px

/** Mobile min-widths so added columns extend table width (scroll to see) */
const COL_MIN_W_MOBILE: Record<ColumnKey, number> = {
  rating: 72,
  manufacturer: 120,
  parkName: 140,
  rideCount: 96,
  lastVisitDate: 128,
  year: 80,
};

export default function CoasterRatingsPage() {
  const [coasters, setCoasters] = useState<Coaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<ColumnKey | "name">("rating");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(DEFAULT_VISIBLE);

  const searchCtx = useSearch() as { query: string; setQuery?: (q: string) => void };
  const query = (searchCtx?.query ?? "").trim();
  const setQuery = searchCtx?.setQuery;
  const searchParams = useSearchParams();

  // FIX 1: Sync URL Query -> Search State
  useEffect(() => {
    const urlQuery = searchParams.get("q");
    if (urlQuery && setQuery) {
      setQuery(urlQuery);
    }
  }, [searchParams, setQuery]);

  // FIX 2: Clear Search State -> ONLY on Unmount (Leaving the page)
  useEffect(() => {
    return () => {
      // This runs only when the component is destroyed (navigating away)
      if (setQuery) setQuery("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array is CRITICAL here to prevent accidental clearing

  // ——— Data fetch ———
  useEffect(() => {
    const fetchCoasters = async () => {
      try {
        const res = await fetch("/api/coasters");
        const data = await res.json();
        if (!data || !Array.isArray(data.coasters))
          throw new Error("Unexpected data format from API");

        // Normalize first, then filter unridden: rating <= 0 means not ridden
        const structured: Coaster[] = (data.coasters as Coaster[])
          .map((c: Coaster): Coaster => ({
            id: c.id,
            name: c.name,
            manufacturer: c.manufacturer,
            model: c.model,
            scale: c.scale,
            haveRidden: c.haveRidden,
            isBestCoaster: c.isBestCoaster,
            rcdbPath: c.rcdbPath,
            rideCount: c.rideCount ?? 0,
            rating:
              c.rating === null || c.rating === undefined
                ? null
                : typeof c.rating === "string"
                ? parseFloat(c.rating)
                : c.rating,
            parkId: c.parkId,
            parkName: c.parkName,
            year: c.year ?? 0,
            lastVisitDate: c.lastVisitDate,
          }))
          .filter((c: Coaster) => (c.rating ?? 0) > 0);

        setCoasters(structured);
      } catch (err: any) {
        console.error("Error fetching data:", err?.message ?? err);
        setError(err?.message ?? "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchCoasters();
  }, []);

  // ——— Defaults by viewport ———
  useEffect(() => {
    // On desktop (≥ sm), preselect all 6; on mobile keep Rating + Manufacturer
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      setVisibleCols(ALL_COLUMNS.map((c) => c.key));
    }
  }, []);

  // ——— Filtering ———
  const q = query.toLowerCase();
  const filteredCoasters = useMemo<Coaster[]>(
    () => {
      if (!q) return coasters;
      return coasters.filter((c: Coaster) => {
        const hay = [
          c.name,
          c.parkName,
          c.manufacturer,
          String(c.year),
          String(c.rating ?? ""),
          String(c.rideCount ?? ""),
          formatDate(c.lastVisitDate),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    },
    [coasters, q]
  );

  // ——— Sorting ———
  const sortedCoasters = useMemo<Coaster[]>(
    () => {
      return [...filteredCoasters].sort((a: Coaster, b: Coaster) =>
        compare(
          a[sortBy as keyof Coaster] ?? (sortBy === "name" ? a.name : undefined),
          b[sortBy as keyof Coaster] ?? (sortBy === "name" ? b.name : undefined),
          sortDirection
        )
      );
    },
    [filteredCoasters, sortBy, sortDirection]
  );

  // ——— Summary ———
  const totalRideCount = useMemo(
    () => sortedCoasters.reduce((sum: number, c: Coaster) => sum + (c.rideCount ?? 0), 0),
    [sortedCoasters]
  );
  const avgRating = useMemo(() => {
    const vals = sortedCoasters
      .map((c: Coaster) => c.rating)
      .filter((r): r is number => r !== null && r !== undefined);
    if (!vals.length) return null;
    return vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
  }, [sortedCoasters]);

  // ——— Handlers ———
  function handleSort(column: ColumnKey | "name") {
    if (sortBy === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection(
        column === "name" || !DESC_BY_DEFAULT.includes(column as ColumnKey) ? "asc" : "desc"
      );
    }
  }

  function toggleColumn(col: ColumnKey) {
    setVisibleCols((prev) => {
      const has = prev.includes(col);
      if (has) return prev.filter((c) => c !== col);
      return [...prev, col];
    });
  }

  // ——— UI ———
  if (loading) return <p className="p-4 text-gray-500">Loading coasters…</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  const colIsVisible = (key: ColumnKey) => visibleCols.includes(key);

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-gradient-to-b from-white to-gray-50 dark:from-neutral-950 dark:to-neutral-900 min-h-[100dvh]">
      {/* Intro */}
      <div className="max-w-4xl mx-auto text-center mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-fuchsia-500">
          ParkRating's Coaster Library
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
        Explore every coaster we’ve ridden with detailed ratings, ride counts, and insights, <br />
        including average scores by park and manufacturer.
</p>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-30 mb-4 sm:mb-6">
        <div className="mx-auto max-w-2xl px-2">
          <div className="relative group">
            <div className="absolute -inset-[1.5px] rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500 opacity-40 blur-sm group-focus-within:opacity-70 transition" />
            <div className="relative rounded-2xl bg-white/80 dark:bg-neutral-950/70 backdrop-blur border border-gray-200 dark:border-neutral-700 shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  value={query}
                  onChange={(e) => setQuery?.(e.target.value)}
                  placeholder="Search by name, park, manufacturer, rating, year…"
                  className="w-full bg-transparent outline-none text-base placeholder:text-gray-400"
                  aria-label="Search coasters"
                />
                {query && (
                  <button
                    onClick={() => setQuery?.("")}
                    className="text-xs px-3 py-1 rounded-full border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900"
                    aria-label="Clear search"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="max-w-7xl mx-auto mb-3 sm:mb-4 flex flex-col gap-3">
        {/* Column chips (no card; centered mobile & desktop) */}
        <div className="px-1">
          <ColumnChips
            columns={ALL_COLUMNS}
            visibleCols={visibleCols}
            onToggle={toggleColumn}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Tip: On mobile, keep two columns visible (Name is always shown) for a clean 3-column view.
          </p>
        </div>

        {/* Sort control */}
        <div className="flex items-center justify-center sm:justify-end">
          <SortControl
            sortBy={sortBy}
            sortDirection={sortDirection}
            onChangeField={(col) => handleSort(col)}
            onToggleDir={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
          />
        </div>
      </div>

      {/* ===== MOBILE (two-table, aligned) ===== */}
      <div className="sm:hidden">
        <div className="relative max-w-7xl mx-auto rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `${INDEX_COL_W_MOBILE + NAME_COL_W_MOBILE}px 1fr`,
            }}
          >
            {/* Left: frozen # + Name */}
            <div className="overflow-hidden">
              <table className="w-full text-sm text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white dark:bg-neutral-950 shadow-sm border-b border-gray-300 dark:border-neutral-700">
                  <tr className="text-[11px] uppercase text-gray-600 dark:text-gray-300">
                    <th
                      className="px-0 text-center font-semibold"
                      style={{ width: INDEX_COL_W_MOBILE, height: ROW_H }}
                    >
                      <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                        <span style={{ width: INDEX_COL_W_MOBILE, display: "inline-block" }}>#</span>
                      </div>
                    </th>
                    <th
                      className="pr-2 font-semibold"
                      style={{ width: NAME_COL_W_MOBILE, height: ROW_H }}
                    >
                      <div className="flex items-center" style={{ height: ROW_H }}>
                        Name
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCoasters.map((c: Coaster, index: number) => (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-neutral-900/70 border-b border-gray-100 dark:border-neutral-700"
                    >
                      <td className="px-0 text-center font-medium" style={{ width: INDEX_COL_W_MOBILE }}>
                        <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                          <span style={{ width: INDEX_COL_W_MOBILE, display: "inline-block" }}>
                            {index + 1}
                          </span>
                        </div>
                      </td>
                      <td
                        className="pr-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis text-[13px]"
                        style={{ width: NAME_COL_W_MOBILE }}
                      >
                        <div className="flex items-center" style={{ height: ROW_H }}>
                          <a
                            href={c.rcdbPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {c.name}
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-300 dark:border-neutral-700">
                  <tr className="bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-gray-200 font-semibold">
                    <td className="px-0 text-center" style={{ width: INDEX_COL_W_MOBILE }}>
                      <div style={{ height: ROW_H }} />
                    </td>
                    <td className="pr-2" style={{ width: NAME_COL_W_MOBILE }}>
                      <div className="flex items-center" style={{ height: ROW_H }}>
                        Summary
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Right: horizontally scrollable extra columns */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white dark:bg-neutral-950 shadow-sm border-b border-gray-300 dark:border-neutral-700">
                  <tr className="text-[11px] uppercase text-gray-600 dark:text-gray-300">
                    {ALL_COLUMNS.map(({ key, label }) =>
                      colIsVisible(key) ? (
                        <th
                          key={key}
                          className="px-2 font-semibold whitespace-nowrap"
                          style={{ minWidth: COL_MIN_W_MOBILE[key], height: ROW_H }}
                        >
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            {label}
                          </div>
                        </th>
                      ) : null
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedCoasters.map((c: Coaster) => (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-neutral-900/70 border-b border-gray-100 dark:border-neutral-700"
                    >
                      {/* Rating */}
                      {colIsVisible("rating") && (
                        <td
                          className={`px-2 font-semibold whitespace-nowrap ${
                            c.rating !== null ? getRatingColor(c.rating) : ""
                          }`}
                          style={{ minWidth: COL_MIN_W_MOBILE.rating }}
                        >
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            {c.rating !== null ? c.rating.toFixed(1) : "—"}
                          </div>
                        </td>
                      )}
                      {/* Manufacturer */}
                      {colIsVisible("manufacturer") && (
                        <td
                          className="px-2 whitespace-nowrap text-[13px] overflow-hidden text-ellipsis"
                          style={{ minWidth: COL_MIN_W_MOBILE.manufacturer, maxWidth: 240 }}
                        >
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            <button
                              onClick={() => setQuery?.(c.manufacturer)}
                              className="underline text-blue-600 dark:text-blue-400 truncate"
                              style={{ maxWidth: 220 }}
                            >
                              {c.manufacturer}
                            </button>
                          </div>
                        </td>
                      )}
                      {/* Park */}
                      {colIsVisible("parkName") && (
                        <td
                          className="px-2 whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ minWidth: COL_MIN_W_MOBILE.parkName, maxWidth: 240 }}
                        >
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            <Link
                              href={`/park/${c.parkId}`}
                              className="underline text-blue-600 dark:text-blue-400 truncate"
                              style={{ maxWidth: 220 }}
                            >
                              {c.parkName}
                            </Link>
                          </div>
                        </td>
                      )}
                      {/* Ride Count */}
                      {colIsVisible("rideCount") && (
                        <td className="px-2 whitespace-nowrap" style={{ minWidth: COL_MIN_W_MOBILE.rideCount }}>
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            {c.rideCount}
                          </div>
                        </td>
                      )}
                      {/* Last Ridden */}
                      {colIsVisible("lastVisitDate") && (
                        <td className="px-2 whitespace-nowrap" style={{ minWidth: COL_MIN_W_MOBILE.lastVisitDate }}>
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            {formatDate(c.lastVisitDate)}
                          </div>
                        </td>
                      )}
                      {/* Year */}
                      {colIsVisible("year") && (
                        <td className="px-2 whitespace-nowrap" style={{ minWidth: COL_MIN_W_MOBILE.year }}>
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            {c.year || "—"}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-300 dark:border-neutral-700">
                  <tr className="bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-gray-200 font-semibold">
                    {ALL_COLUMNS.map(({ key }) =>
                      colIsVisible(key) ? (
                        <td key={key} className="px-2 whitespace-nowrap" style={{ minWidth: COL_MIN_W_MOBILE[key] }}>
                          <div className="flex items-center" style={{ height: ROW_H }}>
                            {key === "rideCount"
                              ? totalRideCount.toLocaleString()
                              : key === "rating"
                              ? avgRating !== null
                                ? avgRating.toFixed(2)
                                : "—"
                              : ""}
                          </div>
                        </td>
                      ) : null
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer result count */}
        <div className="max-w-7xl mx-auto flex justify-end text-xs text-gray-600 dark:text-gray-300 mt-3">
          {sortedCoasters.length} results
        </div>
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="hidden sm:block">
        <div className="relative max-w-7xl mx-auto overflow-x-auto overflow-y-hidden rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm">
          <table className="w-full table-fixed text-sm sm:text-base text-left">
            {/* Head */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-white dark:bg-neutral-950 text-xs uppercase text-gray-600 dark:text-gray-300 shadow-sm border-b border-gray-300 dark:border-neutral-700">
                <th className="sticky left-0 z-[2] bg-white dark:bg-neutral-950 px-0 text-center font-semibold" style={{ width: 64 }}>
                  <span className="inline-block w-16">#</span>
                </th>
                <ThSortableDesktop
                  label="Name"
                  active={sortBy === "name"}
                  dir={sortDirection}
                  onClick={() => handleSort("name")}
                  sticky
                  style={{ width: NAME_COL_W_SM }}
                  styleLg={{ width: NAME_COL_W_LG }}
                />
                {ALL_COLUMNS.map(({ key, label }) =>
                  colIsVisible(key) ? (
                    <ThSortableDesktop
                      key={key}
                      label={label}
                      active={sortBy === key}
                      dir={sortDirection}
                      onClick={() => handleSort(key)}
                    />
                  ) : null
                )}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {sortedCoasters.map((c: Coaster, index: number) => (
                <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-neutral-900/70">
                  <td className="sticky left-0 z-[1] bg-white dark:bg-neutral-950 px-0 text-center font-medium" style={{ width: 64 }}>
                    <span className="inline-block w-16">{index + 1}</span>
                  </td>
                  <td
                    className="sticky z-[1] bg-white dark:bg-neutral-950 py-3 pr-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ left: 64, width: NAME_COL_W_SM }}
                  >
                    <a href={c.rcdbPath} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                      {c.name}
                    </a>
                  </td>
                  {colIsVisible("rating") && (
                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${c.rating !== null ? getRatingColor(c.rating) : ""}`}>
                      {c.rating !== null ? c.rating.toFixed(1) : "—"}
                    </td>
                  )}
                  {colIsVisible("manufacturer") && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => setQuery?.(c.manufacturer)} className="underline text-blue-600 dark:text-blue-400">
                        {c.manufacturer}
                      </button>
                    </td>
                  )}
                  {colIsVisible("parkName") && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/park/${c.parkId}`} className="underline text-blue-600 dark:text-blue-400">
                        {c.parkName}
                      </Link>
                    </td>
                  )}
                  {colIsVisible("rideCount") && <td className="px-4 py-3 whitespace-nowrap">{c.rideCount}</td>}
                  {colIsVisible("lastVisitDate") && <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.lastVisitDate)}</td>}
                  {colIsVisible("year") && <td className="px-4 py-3 whitespace-nowrap">{c.year || "—"}</td>}
                </tr>
              ))}
            </tbody>

            {/* Footer summary */}
            <tfoot className="border-t border-gray-300 dark:border-neutral-700">
              <tr className="bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-gray-200 font-semibold">
                <td className="sticky z-[1] bg-gray-50 dark:bg-neutral-900 px-0 text-center" style={{ left: 0, width: 64 }} />
                <td className="sticky z-[1] bg-gray-50 dark:bg-neutral-900 py-3 pr-4" style={{ left: 64, width: NAME_COL_W_SM }}>
                  Summary
                </td>
                {ALL_COLUMNS.map(({ key }) =>
                  colIsVisible(key) ? (
                    <td key={key} className="px-4 py-3 whitespace-nowrap">
                      {key === "rideCount"
                        ? totalRideCount.toLocaleString()
                        : key === "rating"
                        ? avgRating !== null
                          ? avgRating.toFixed(2)
                          : "—"
                        : ""}
                    </td>
                  ) : null
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer result count */}
        <div className="max-w-7xl mx-auto flex justify-end text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-3">
          {sortedCoasters.length} results
        </div>
      </div>
    </div>
  );
}

/* ——— Desktop header cell ——— */
function ThSortableDesktop({
  label,
  active,
  dir,
  onClick,
  sticky = false,
  className = "",
  style,
  styleLg,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  sticky?: boolean;
  className?: string;
  style?: React.CSSProperties;
  styleLg?: React.CSSProperties;
}) {
  return (
    <th
      scope="col"
      onClick={onClick}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={[
        "px-4 py-3 select-none cursor-pointer font-semibold hover:underline text-gray-700 dark:text-gray-200",
        sticky ? "sticky z-[2] bg-white dark:bg-neutral-950" : "",
        className,
      ].join(" ")}
      style={style}
    >
      <div className="inline-flex items-center">
        {label}
        <span className={`ml-1 w-4 ${active ? "opacity-100" : "opacity-0"}`}>{dir === "asc" ? "▲" : "▼"}</span>
      </div>
      <style jsx>{`
        @media (min-width: 1024px) {
          th[aria-sort] {
            ${styleLg?.width !== undefined ? `width: ${Number(styleLg.width)}px !important;` : ""}
          }
        }
      `}</style>
    </th>
  );
}

/* ——— ColumnChips (centered mobile & desktop, improved dark mode) ——— */
function ColumnChips({
  columns,
  visibleCols,
  onToggle,
}: {
  columns: readonly { key: ColumnKey; label: string }[];
  visibleCols: ColumnKey[];
  onToggle: (c: ColumnKey) => void;
}) {
  const isOn = (k: ColumnKey) => visibleCols.includes(k);

  return (
    <div className="w-full flex justify-center">
      <div
        className="
          grid grid-cols-2 sm:grid-cols-3
          gap-2 items-center justify-center
        "
      >
        {columns.map(({ key, label }) => {
          const active = isOn(key);
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              aria-pressed={active}
              className={[
                // base
                "group inline-flex items-center gap-2 rounded-full",
                "px-3.5 py-1.5 text-xs sm:text-sm",
                "border shadow-sm transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
                // surface colors
                active
                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-800 dark:text-white dark:border-neutral-600"
                  : "bg-white/90 dark:bg-neutral-950/80 border-gray-300/80 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900",
              ].join(" ")}
            >
              {/* status dot */}
              <span
                className={[
                  "inline-block h-2 w-2 rounded-full",
                  active
                    ? "bg-emerald-400 group-hover:bg-emerald-300"
                    : "bg-gray-300 dark:bg-neutral-600 group-hover:bg-gray-400 dark:group-hover:bg-neutral-500",
                ].join(" ")}
                aria-hidden
              />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ——— SortControl ——— */
function SortControl({
  sortBy,
  sortDirection,
  onChangeField,
  onToggleDir,
}: {
  sortBy: ColumnKey | "name";
  sortDirection: "asc" | "desc";
  onChangeField: (c: ColumnKey | "name") => void;
  onToggleDir: () => void;
}) {
  const [open, setOpen] = useState(false);

  // close on outside click / Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.("#sort-popover")) setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      window.addEventListener("click", onClick);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [open]);

  const OPTIONS: Array<{ key: ColumnKey | "name"; label: string }> = [
    { key: "name", label: "Name" },
    { key: "rating", label: "Rating" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "parkName", label: "Park" },
    { key: "rideCount", label: "Ride Count" },
    { key: "lastVisitDate", label: "Last Ridden" },
    { key: "year", label: "Year" },
  ];

  const activeLabel = OPTIONS.find((o) => o.key === sortBy)?.label ?? "Sort";

  return (
    <div id="sort-popover" className="relative inline-flex items-center gap-2">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="
          inline-flex items-center gap-2 rounded-xl
          border border-gray-300 dark:border-neutral-700
          bg-white/90 dark:bg-neutral-950/80 backdrop-blur
          px-3.5 py-2 text-sm shadow-sm
          hover:bg-gray-50 dark:hover:bg-neutral-900
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60
        "
      >
        <span className="font-medium">Sort</span>
        <span className="text-gray-600 dark:text-gray-300">{activeLabel}</span>
        <ChevronDown aria-hidden />
      </button>

      {/* Direction toggle */}
      <button
        onClick={onToggleDir}
        className="
          inline-flex items-center justify-center rounded-xl
          border border-gray-300 dark:border-neutral-700
          bg-white/90 dark:bg-neutral-950/80 backdrop-blur
          h-9 w-9 shadow-sm
          hover:bg-gray-50 dark:hover:bg-neutral-900
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60
        "
        aria-label="Toggle sort direction"
        title={sortDirection === "asc" ? "Ascending" : "Descending"}
      >
        {sortDirection === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
      </button>

      {/* Menu */}
      {open && (
        <div
          role="menu"
          aria-label="Sort by"
          className="
            absolute right-0 top-[115%] z-40 min-w-[220px]
            rounded-2xl border border-gray-200 dark:border-neutral-700
            bg-white/95 dark:bg-neutral-950/95 backdrop-blur
            shadow-lg overflow-hidden
          "
        >
          <ul className="max-h-[320px] overflow-auto py-1">
            {OPTIONS.map((opt) => {
              const active = opt.key === sortBy;
              return (
                <li key={opt.key}>
                  <button
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      onChangeField(opt.key);
                      setOpen(false);
                    }}
                    className={[
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm",
                      active
                        ? "bg-gray-100/70 dark:bg-neutral-900/70 text-gray-900 dark:text-gray-100"
                        : "hover:bg-gray-50 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-200",
                    ].join(" ")}
                  >
                    <span>{opt.label}</span>
                    {active ? <Check aria-hidden /> : null}
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

/* ——— Minimal inline icons (no extra deps) ——— */
function ChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-500" {...props}>
      <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.2l3.71-2.97a.75.75 0 011.04 1.08l-4.23 3.39a.75.75 0 01-.95 0L5.21 8.31a.75.75 0 01.02-1.1z" />
    </svg>
  );
}
function ArrowUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-600 dark:text-gray-300" {...props}>
      <path d="M10 4l5 6H5l5-6zm-5 8h10v2H5v-2z" />
    </svg>
  );
}
function ArrowDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-600 dark:text-gray-300" {...props}>
      <path d="M5 8h10v2H5V8zm5 8l-5-6h10l-5 6z" />
    </svg>
  );
}
function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-500" {...props}>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.435a1 1 0 111.414-1.414l3.222 3.222 6.657-6.657a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}