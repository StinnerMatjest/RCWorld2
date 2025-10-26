// app/components/CoasterList.tsx
import React from "react";
import type { RollerCoaster } from "@/app/types";
import { AnimatePresence, motion } from "framer-motion";

interface CoasterListProps {
  coasters: RollerCoaster[];
  loading: boolean;
  onEdit: (c: RollerCoaster) => void;
  onAdd: () => void;
}

/** Parse rating; allow 0..11 (11 = special crown case). Return undefined if invalid */
function getRating(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(11, n));
}

/** Map various truthy values to "has ridden" */
function hasRidden(val: unknown): boolean {
  if (val === true) return true;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

/** A coaster is ALWAYS optional if scale is Junior/Kiddie (case-insensitive) */
function isOptionalByScale(scale: unknown): boolean {
  if (typeof scale !== "string") return false;
  const s = scale.trim().toLowerCase();
  return s === "junior" || s === "kiddie";
}

/** Text color / special class for rating, per user's palette */
function ratingTextClass(r?: number): string {
  if (typeof r !== "number") return "text-black dark:text-gray-100";
  if (r >= 10.0) return "rainbow-animation";
  if (r >= 9.0) return "text-blue-700 dark:text-blue-400";
  if (r >= 7.5) return "text-green-600 dark:text-green-400";
  if (r >= 6.5) return "text-green-400 dark:text-green-300";
  if (r >= 5.5) return "text-yellow-400 dark:text-yellow-300";
  if (r >= 4.5) return "text-yellow-600 dark:text-yellow-500";
  if (r >= 3.0) return "text-red-400 dark:text-red-300";
  if (r <= 2.9) return "text-red-600 dark:text-red-500";
  return "text-black dark:text-gray-100";
}

const CoasterList: React.FC<CoasterListProps> = ({
  coasters,
  loading,
  onEdit,
  onAdd,
}) => {
  const [showEdit, setShowEdit] = React.useState(false);

  // Sort: Best first, then rating desc, then year desc, then name A–Z
  const sorted = React.useMemo(() => {
    return [...coasters].sort((a, b) => {
      if (!!a.isbestcoaster !== !!b.isbestcoaster) return b.isbestcoaster ? 1 : -1;
      const ra = getRating(a.rating);
      const rb = getRating(b.rating);
      const rAnum = typeof ra === "number" ? ra : -Infinity;
      const rBnum = typeof rb === "number" ? rb : -Infinity;
      if (rAnum !== rBnum) return rBnum - rAnum;
      const ya = Number(a.year) || 0;
      const yb = Number(b.year) || 0;
      if (ya !== yb) return yb - ya;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [coasters]);

  // Groups
  const ridden = sorted.filter((c) => !isOptionalByScale(c.scale) && hasRidden(c.haveridden));
  const optional = sorted.filter((c) => isOptionalByScale(c.scale) || !hasRidden(c.haveridden));

  /** One row */
  const Row: React.FC<{ c: RollerCoaster }> = ({ c }) => {
    const [open, setOpen] = React.useState(false);
    const r = getRating(c.rating);
    const ratingClass = ratingTextClass(r);
    const riddenStatus = hasRidden(c.haveridden);

    const toggleOpen = () => setOpen((v) => !v);
    const onKeyToggle: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleOpen();
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    return (
      <motion.li layout className="transition-colors duration-200">
        {/* GRID: name | year | manufacturer | rating/actions */}
        <div
          className="
            grid
            grid-cols-[minmax(0,1.1fr)_3.9rem_minmax(0,1fr)_auto]
            md:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto]
            items-center gap-1.5 md:gap-2
            py-2 md:py-0.5
            text-[16px] md:text-[18px]
            md:hover:bg-gray-50 dark:md:hover:bg-white/5 transition-colors
          "
        >
          {/* Name */}
          <div
            className="min-w-0 flex items-center gap-2 cursor-pointer"
            role="button"
            tabIndex={0}
            aria-expanded={open}
            aria-controls={`coaster-details-${c.id}`}
            onClick={toggleOpen}
            onKeyDown={onKeyToggle}
          >
            {c.rcdbpath ? (
              <a
                href={c.rcdbpath}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline truncate dark:text-blue-400"
                title={c.name}
                onClick={(e) => e.stopPropagation()}
              >
                {c.name}
              </a>
            ) : (
              <span className="font-medium truncate" title={c.name}>
                {c.name}
              </span>
            )}
            {c.isbestcoaster && (
              <span className="hidden md:inline-flex rounded px-1.5 py-0.5 text-[12px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                Best
              </span>
            )}
          </div>

          {/* Year */}
          <div
            className="
              tabular-nums text-gray-800 dark:text-gray-200 text-left cursor-pointer
              pl-1 md:pl-0
              text-[15px] md:text-[17px]
            "
            onClick={toggleOpen}
            role="button"
            tabIndex={0}
          >
            {c.year ?? "—"}
          </div>

          {/* Manufacturer */}
          <div
            className="
              text-gray-700 dark:text-gray-300 truncate cursor-pointer text-left
              text-[15px] md:text-[17px]
            "
            onClick={toggleOpen}
            role="button"
            tabIndex={0}
            title={c.manufacturer ?? undefined}
          >
            {c.manufacturer ?? "—"}
          </div>

          {/* Rating + actions */}
          <div className="shrink-0 flex items-center justify-end gap-2">
            {typeof r === "number" && r === 11 && <span aria-hidden>👑</span>}

            <span
              className={`inline-block w-12 text-right font-semibold tabular-nums ${ratingClass}`}
              title={
                !riddenStatus
                  ? "Not ridden"
                  : typeof r === "number"
                  ? `Rating: ${r.toFixed(1)}`
                  : "No rating"
              }
            >
              {!riddenStatus
                ? "NR"
                : typeof r === "number"
                ? r.toFixed(1)
                : "—"}
            </span>

            {typeof r === "number" && r === 11 && <span aria-hidden>👑</span>}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleOpen();
              }}
              aria-expanded={open}
              aria-controls={`coaster-details-${c.id}`}
              className={`transition-transform duration-200 ${
                open ? "rotate-90" : "rotate-0"
              } text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 text-sm md:text-base`}
              title={open ? "Collapse details" : "Expand details"}
            >
              ▸
            </button>

            {showEdit && (
              <button
                type="button"
                onClick={() => onEdit(c)}
                className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 text-[15px]"
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
              id={`coaster-details-${c.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden px-1"
            >
              <div className="mt-1 rounded-lg bg-gray-100 dark:bg-white/5">
                <div className="border-t border-gray-100 dark:border-white/10 pt-2 pb-2 px-2 text-sm md:text-base text-gray-700 dark:text-gray-300 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
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
        <h2 className="text-2xl lg: text-3xl font-bold dark:text-white">
          Roller Coasters{" "}
          <span className="font-medium text-gray-500 dark:text-gray-400">
            ({sorted.length})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEdit((v) => !v)}
            aria-pressed={showEdit}
            className={`px-3 py-1.5 rounded border text-sm md:text-base transition cursor-pointer ${
              showEdit
                ? "border-gray-400 bg-gray-100 dark:border-white/20 dark:bg-white/10"
                : "border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/10"
            }`}
          >
            {showEdit ? "Done" : "Edit"}
          </button>

          <button
            type="button"
            onClick={onAdd}
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm md:text-base cursor-pointer"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Lists */}
      {loading ? (
        <div role="status" aria-live="polite" className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-gray-100 dark:bg-white/10 overflow-hidden">
              <span className="block h-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/10" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {ridden.length ? (
            <ul className="divide-y divide-gray-300 dark:divide-white/10">
              {ridden.map((c) => (
                <Row key={c.id} c={c} />
              ))}
            </ul>
          ) : null}

          <h3 className="text-lg lg: text-xl font-semibold mt-3 dark:text-white">
            Optional Coasters{" "}
            <span className="font-medium text-gray-500 dark:text-gray-400">
              ({optional.length})
            </span>
          </h3>
          {optional.length ? (
            <ul className="divide-y divide-gray-300 dark:divide-white/10">
              {optional.map((c) => (
                <Row key={c.id} c={c} />
              ))}
            </ul>
          ) : (
            <p className="text-base text-gray-600 dark:text-gray-400">
              No other coasters found.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default CoasterList;
