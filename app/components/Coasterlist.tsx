// app/components/CoasterList.tsx
import React from "react";
import type { RollerCoaster } from "@/app/types";
import { getRatingColor } from "@/app/utils/design";
import { AnimatePresence, motion } from "framer-motion";
import { useAdminMode } from "../context/AdminModeContext";

interface CoasterListProps {
  coasters: RollerCoaster[];
  loading: boolean;
  onEdit: (c: RollerCoaster) => void;
  onAdd: () => void;
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

/** Always optional if Junior/Kiddie */
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

  /** Sorting */
  const sorted = React.useMemo(() => {
    return [...coasters].sort((a, b) => {
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
    });
  }, [coasters]);

  const mainCoasters = sorted.filter((c) => !isOptionalByScale(c.scale));
  const optionalCoasters = sorted.filter((c) => isOptionalByScale(c.scale));

  /** One row */
  const Row: React.FC<{ c: RollerCoaster; showRating?: boolean }> = ({ c, showRating = true }) => {
    const [open, setOpen] = React.useState(false);
    const r = getRating(c.rating);
    const ratingClass = getRatingColor(r ?? "");
    const riddenStatus = hasRidden(c.haveridden);

    const toggleOpen = () => setOpen((v) => !v);

    return (
      <motion.li layout className="transition-colors duration-200">
        <div className="grid grid-cols-[minmax(0,1.1fr)_3.9rem_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto] items-center gap-1.5 md:gap-2 py-2 md:py-0.5 text-[16px] md:text-[18px] md:hover:bg-gray-50 dark:md:hover:bg-white/5 transition-colors">

          {/* Name */}
          <div className="min-w-0 flex items-center gap-2 cursor-pointer" onClick={toggleOpen} role="button" tabIndex={0}>
            {c.rcdbpath ? (
              <a
                href={c.rcdbpath}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline truncate dark:text-blue-400"
                onClick={(e) => e.stopPropagation()}
              >
                {c.name}
              </a>
            ) : (
              <span className="font-medium truncate">{c.name}</span>
            )}
            {c.isbestcoaster && (
              <span className="hidden md:inline-flex rounded px-1.5 py-0.5 text-[12px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                Best
              </span>
            )}
          </div>

          {/* Year */}
          <div className="tabular-nums text-gray-800 dark:text-gray-200 text-left cursor-pointer pl-1 md:pl-0 text-[15px] md:text-[17px]" onClick={toggleOpen}>
            {c.year ?? "—"}
          </div>

          {/* Manufacturer */}
          <div className="text-gray-700 dark:text-gray-300 truncate cursor-pointer text-left text-[15px] md:text-[17px]" onClick={toggleOpen}>
            {c.manufacturer ?? "—"}
          </div>

          {/* Ratings */}
          <div className="shrink-0 flex items-center justify-end gap-2">
            {showRating && (
              <span
                className={`inline-block w-12 text-right font-semibold tabular-nums ${ratingClass}`}
              >
                {!riddenStatus ? "NR" : typeof r === "number" ? r.toFixed(1) : "—"}
              </span>
            )}
            {isAdminMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(c);
                }}
                className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200
               dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10
               text-[15px] cursor-pointer"
                aria-label={`Edit ${c.name}`}
                title="Edit coaster"
              >
                🔧
              </button>
            )}
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
              <div className="mt-1 rounded-lg bg-gray-100 dark:bg-white/5">
                <div className="border-t border-gray-100 dark:border-white/10 pt-2 pb-2 px-2 text-sm md:text-base text-gray-700 dark:text-gray-300 grid grid-cols-1 gap-y-1">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Type: </span>
                    <span>{c.model ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Scale: </span>
                    <span>{c.scale ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Ride count: </span>
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl lg:text-3xl font-bold dark:text-white">
          Roller Coasters{" "}
          <span className="font-medium text-gray-500 dark:text-gray-400">
            ({sorted.length})
          </span>
        </h2>

        {/* Admin-only top buttons */}
        {isAdminMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm md:text-base cursor-pointer"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {/* Lists */}
      {loading ? (
        <div role="status" className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-6 rounded bg-gray-100 dark:bg:white/10 overflow-hidden"
            >
              <span className="block h-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/10" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {mainCoasters.length ? (
            <ul className="divide-y divide-gray-300 dark:divide-white/10">
              {mainCoasters.map((c) => (
                <Row key={c.id} c={c} showRating={true} />
              ))}
            </ul>
          ) : null}

          <h3 className="text-lg lg:text-xl font-semibold mt-3 dark:text:white">
            Optional Coasters{" "}
            <span className="font-medium text-gray-500 dark:text-gray-400">
              ({optionalCoasters.length})
            </span>
          </h3>

          {optionalCoasters.length ? (
            <ul className="divide-y divide-gray-300 dark:divide-white/10">
              {optionalCoasters.map((c) => (
                <Row key={c.id} c={c} showRating={false} />
              ))}
            </ul>
          ) : (
            <p className="text-base text-gray-600 dark:text-gray-400">No other coasters found.</p>
          )}
        </>
      )}
    </div>
  );
};

export default CoasterList;
