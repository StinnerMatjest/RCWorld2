"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Visit } from "@/app/types";
import { getRatingColor } from "@/app/utils/design";
import { formatScore } from "@/app/utils/parkRanks";

// Fixed timezone: the server and a visitor in another timezone must render
// the same text, or hydration fails and the page is rebuilt client-side.
export const formatVisitDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

interface Props {
  /** Visits the reader may see (drafts only in admin mode), newest first. */
  visits: Visit[];
  active: Visit;
  parkSlug: string;
  className?: string;
}

/**
 * One line under the hero: "Visited 24 Aug 2026 · 3 visits" and, when there
 * are several, a "Switch visit" link that opens the list.
 */
export default function VisitSwitcher({ visits, active, parkSlug, className = "" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasMultiple = visits.length > 1;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className={`relative flex items-baseline justify-between gap-4 ${className}`}>
      <p className="text-sm text-slate-400 min-w-0 truncate">
        Visited <span className="text-slate-200 font-medium">{formatVisitDate(active.date)}</span>
        {hasMultiple && <span className="text-slate-500"> · {visits.length} visits</span>}
        {!active.published && (
          <span className="ml-2 bg-red-900/30 text-red-400 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded align-middle">Draft</span>
        )}
      </p>
      {hasMultiple && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors cursor-pointer"
        >
          Switch visit
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden"
          >
            <ul className="max-h-72 overflow-y-auto py-1">
              {visits.map((v) => {
                const isCurrent = v.id === active.id;
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => { if (!isCurrent) router.push(`/park/${parkSlug}?visit=${v.id}`); setOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${isCurrent ? "bg-brand/10 cursor-default" : "hover:bg-slate-800 cursor-pointer"}`}
                    >
                      <span className={`flex-1 text-sm ${isCurrent ? "text-white font-medium" : "text-slate-300"}`}>{formatVisitDate(v.date)}</span>
                      {!v.published && <span className="bg-red-900/30 text-red-400 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded">Draft</span>}
                      <span className={`text-sm font-bold tabular-nums ${getRatingColor(Number(v.overall))}`}>{formatScore(v.overall)}</span>
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
}
