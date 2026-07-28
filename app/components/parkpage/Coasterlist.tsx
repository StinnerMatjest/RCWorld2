import React, { useState } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";
import { getRatingColor } from "@/app/utils/design";
import { AnimatePresence, motion } from "framer-motion";
import { useAdminMode } from "../../context/AdminModeContext";

interface CoasterListProps {
  coasters: RollerCoaster[];
  loading: boolean;
  onEdit: (c: RollerCoaster) => void;
  onAdd: () => void;
}

type SortKey = "name" | "year" | "manufacturerName" | "rating" | "default";
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

function getRating(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(11, n));
}

function hasRidden(val: unknown): boolean {
  if (val === true) return true;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

function isOptionalByScale(scale: unknown): boolean {
  if (typeof scale !== "string") return false;
  const s = scale.trim().toLowerCase();
  return s === "junior" || s === "kiddie";
}

const CoasterList: React.FC<CoasterListProps> = ({
  coasters,
  loading,
  onEdit,
  onAdd,
}) => {
  const { isAdminMode } = useAdminMode();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "default", direction: "desc" });

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    } else if (sortConfig.key === key && sortConfig.direction === "asc") {
      // Toggle back to desc
      direction = "desc";
    } else {
      // New key, set default smart direction
      direction = (key === "name" || key === "manufacturerName") ? "asc" : "desc";
    }
    setSortConfig({ key, direction });
  };

  /** Sorting */
  const sorted = React.useMemo(() => {
    return [...coasters].sort((a, b) => {
      // 1. Default Sort: Best Coaster -> Rating -> Year -> Name
      if (sortConfig.key === "default") {
        if (!!a.isbestcoaster !== !!b.isbestcoaster)
          return b.isbestcoaster ? 1 : -1;

        const ra = getRating(a.rating);
        const rb = getRating(b.rating);
        const rA = typeof ra === "number" ? ra : -Infinity;
        const rB = typeof rb === "number" ? rb : -Infinity;
        if (rA !== rB) return rB - rA;

        const ya = Number(a.year) || 0;
        const yb = Number(b.year) || 0;
        if (ya !== yb) return yb - ya;

        return String(a.name).localeCompare(String(b.name));
      }

      // 2. Name Sort
      if (sortConfig.key === "name") {
        const cmp = String(a.name).localeCompare(String(b.name));
        return sortConfig.direction === "asc" ? cmp : -cmp;
      }

      // 3. Manufacturer Sort
      if (sortConfig.key === "manufacturerName") {
        const mA = a.manufacturerName || "ZZZ"; // Push empty to bottom
        const mB = b.manufacturerName || "ZZZ";
        const cmp = mA.localeCompare(mB);
        if (cmp !== 0) return sortConfig.direction === "asc" ? cmp : -cmp;
        return String(a.name).localeCompare(String(b.name)); // Tie-breaker
      }

      // 4. Year Sort
      if (sortConfig.key === "year") {
        const ya = Number(a.year) || 0;
        const yb = Number(b.year) || 0;
        const cmp = ya - yb;
        if (cmp !== 0) return sortConfig.direction === "asc" ? cmp : -cmp;
        return String(a.name).localeCompare(String(b.name)); // Tie-breaker
      }

      // 5. Rating Sort
      if (sortConfig.key === "rating") {
        const ra = getRating(a.rating);
        const rb = getRating(b.rating);
        const rA = typeof ra === "number" ? ra : -1; // Treat NR as lowest
        const rB = typeof rb === "number" ? rb : -1;
        const cmp = rA - rB;
        if (cmp !== 0) return sortConfig.direction === "asc" ? cmp : -cmp;
        return String(a.name).localeCompare(String(b.name)); // Tie-breaker
      }

      return 0;
    });
  }, [coasters, sortConfig]);

  const mainCoasters = sorted.filter((c) => !isOptionalByScale(c.scale));
  const optionalCoasters = sorted.filter((c) => isOptionalByScale(c.scale));

  /** Sort Header Component */
  const SortHeader = ({ label, sortKey, className = "" }: { label: string; sortKey: SortKey; className?: string }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <div
        className={`flex items-center gap-1 cursor-pointer select-none text-[11px] md:text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? "text-blue-400" : "text-slate-500 hover:text-slate-300"} ${className}`}
        onClick={() => handleSort(sortKey)}
      >
        {label}
        {isActive && (
          <span className="text-[10px] leading-none mb-[1px]">
            {sortConfig.direction === "asc" ? "▲" : "▼"}
          </span>
        )}
      </div>
    );
  };

  /** One row */
  const Row: React.FC<{ c: RollerCoaster; showRating?: boolean }> = ({ c, showRating = true }) => {
    const [open, setOpen] = React.useState(false);
    const r = getRating(c.rating);
    const ratingClass = getRatingColor(r ?? "");
    const riddenStatus = hasRidden(c.haveridden);

    const toggleOpen = () => setOpen((v) => !v);

    return (
      <motion.li layout className="transition-colors duration-200">
        <div className="grid grid-cols-[minmax(0,1.1fr)_3.9rem_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto] items-center gap-1.5 md:gap-2 py-2 md:py-0.5 text-[16px] md:text-[18px] md:hover:bg-white/5 transition-colors">

          {/* Name */}
          <div className="min-w-0 flex items-center gap-2 cursor-pointer">
            <Link
              href={`/coasters/${c.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-400 hover:underline truncate"
            >
              {c.name}
            </Link>

            {c.isbestcoaster && (
              <span className="hidden md:inline-flex rounded px-1.5 py-0.5 text-[12px] font-semibold bg-yellow-900/30 text-yellow-300">
                Best
              </span>
            )}
          </div>

          {/* Year */}
          <div className="tabular-nums text-slate-200 text-left cursor-pointer pl-1 md:pl-0 text-[15px] md:text-[17px]" onClick={toggleOpen}>
            {c.year ?? "—"}
          </div>

          {/* Manufacturer */}
          <div className="text-slate-300 truncate cursor-pointer text-left text-[15px] md:text-[17px]" onClick={toggleOpen}>
            {c.manufacturerName ?? "—"}
          </div>

          {/* Ratings */}
          <div className="shrink-0 flex items-center justify-end gap-2">
            <span
              className={`inline-block w-12 text-right font-semibold tabular-nums ${ratingClass}`}
            >
              {!riddenStatus
                ? "NR"
                : typeof r === "number"
                  ? r.toFixed(1)
                  : "—"}
            </span>

            {/* Expand arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleOpen();
              }}
              className={`transition-transform duration-200 ${open ? "rotate-90" : "rotate-0"
                } text-slate-400 hover:text-slate-200 text-sm md:text-base`}
            >
              ▸
            </button>
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key={`details-${c.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden px-1"
            >
              <div className="mt-1 rounded-lg bg-white/5">
                <div className="border-t border-white/10 pt-2 pb-2 px-2 text-sm md:text-base text-slate-300 grid grid-cols-1 gap-y-1">
                  <div>
                    <span className="text-slate-400">Type: </span>
                    <span>{c.model ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Scale: </span>
                    <span>{c.scale ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Ride count: </span>
                    <span className="tabular-nums">{c.ridecount ?? 0}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.li>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl lg:text-3xl font-bold text-white">
            Roller Coasters{" "}
            <span className="font-medium text-slate-400">
              ({sorted.length})
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin-only top buttons */}
          {isAdminMode && (
            <button
              type="button"
              onClick={onAdd}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-all duration-200 shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
              title="Add Coaster"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lists */}
      {loading ? (
        <div role="status" className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-6 rounded bg-white/10 overflow-hidden"
            >
              <span className="block h-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 mb-2 flex items-center justify-between">
            <h3 className="text-lg lg:text-xl font-semibold text-white">
              Main Coasters{" "}
              <span className="font-medium text-slate-400">
                ({sorted.length - optionalCoasters.length})
              </span>
            </h3>
          </div>

          {/* Sortable Header Row */}
          {mainCoasters.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1.1fr)_3.9rem_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto] items-center gap-1.5 md:gap-2 pb-1 border-b border-white/10">
              <SortHeader label="Name" sortKey="name" />
              <SortHeader label="Year" sortKey="year" className="pl-1 md:pl-0" />
              <SortHeader label="Manufacturer" sortKey="manufacturerName" />

              {/* Mirroring the Row's flex container for pixel-perfect alignment */}
              <div className="shrink-0 flex items-center justify-end gap-2">
                <SortHeader label="Rating" sortKey="rating" className="justify-end w-12" />
                {/* Invisible chevron to perfectly match the width of the row's expand button */}
                <div className="invisible text-sm md:text-base select-none">▸</div>
              </div>
            </div>
          )}

          {mainCoasters.length ? (
            <ul className="divide-y divide-white/10">
              {mainCoasters.map((c) => (
                <Row key={c.id} c={c} showRating={true} />
              ))}
            </ul>
          ) : null}

          <h3 className="text-lg lg:text-xl font-semibold mt-6 text-white border-t border-white/10 pt-4">
            Optional Coasters{" "}
            <span className="font-medium text-slate-400">
              ({optionalCoasters.length})
            </span>
          </h3>

          {optionalCoasters.length ? (
            <ul className="divide-y divide-white/10 mt-2">
              {optionalCoasters.map((c) => (
                <Row key={c.id} c={c} showRating={false} />
              ))}
            </ul>
          ) : (
            <p className="text-base text-slate-400 mt-2">No other coasters found.</p>
          )}
        </>
      )}
    </div>
  );
};

export default CoasterList;