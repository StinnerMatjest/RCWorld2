"use client";

import { Rating, RollerCoaster } from "@/app/types";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getRatingColor } from "@/app/utils/design";
import RatingWarning from "../warnings/RatingWarning";
import { useAdminMode } from "@/app/context/AdminModeContext";

interface VisitPanelProps {
  ratings: Rating[];
  parkSlug: string;
  currentRatingId?: number;
  coasters: RollerCoaster[];
}

const VisitPanel: React.FC<VisitPanelProps> = ({
  ratings,
  parkSlug,
  currentRatingId,
  coasters,
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isAdminMode } = useAdminMode();

  const sorted = [...ratings]
    .filter((r) => isAdminMode || r.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeId = currentRatingId ?? sorted[0]?.id;
  const active = sorted.find((r) => r.id === activeId) ?? sorted[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!active) return null;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const hasMultiple = sorted.length > 1;

  return (
    <div ref={ref} className="relative">
      <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
        Visit
      </p>

      {/* Active visit trigger */}
      <button
        onClick={() => hasMultiple && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-2 py-2 md:px-3 md:py-3 rounded-xl text-left transition-colors ${hasMultiple ? "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" : "cursor-default"
          }`}
      >
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <p className="text-sm md:text-base font-medium text-gray-500 dark:text-gray-400 leading-tight truncate">
            {formatDate(active.date)}
          </p>
          {!active.published && (
            <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0">
              Draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          {(active.warnings?.length ?? 0) > 0 && (
            <RatingWarning warning={active.warnings!} coasters={coasters} />
          )}
          <div className="flex items-baseline gap-0.5">
            <span className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${getRatingColor(active.overall)}`}>
              {active.overall}
            </span>
            <span className="text-[11px] md:text-xs text-gray-400">/10</span>
          </div>
        </div>

        {hasMultiple && (
          <svg
            className={`w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 text-gray-300 dark:text-gray-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
            <p className="px-3 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
              Switch visit
            </p>
            <ul className="max-h-60 overflow-y-auto py-1">
              {sorted.map((r) => {
                const isCurrent = r.id === activeId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        if (!isCurrent) router.push(`/park/${parkSlug}?visit=${r.id}`);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 md:py-3 text-left transition-colors ${isCurrent
                          ? "bg-blue-50 dark:bg-blue-500/15 cursor-default"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        }`}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <p className={`text-xs md:text-sm font-medium leading-tight ${isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                          {formatDate(r.date)}
                        </p>
                        {!r.published && (
                          <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
                        <span className={`text-sm md:text-base font-bold tabular-nums ${getRatingColor(r.overall)}`}>
                          {r.overall}
                        </span>
                        <span className="text-[11px] md:text-xs text-gray-400">/10</span>
                        {(r.warnings?.length ?? 0) > 0 && (
                          <RatingWarning warning={r.warnings!} coasters={coasters} />
                        )}
                      </div>
                      {isCurrent && (
                        <svg className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.435a1 1 0 111.414-1.414l3.222 3.222 6.657-6.657a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisitPanel;