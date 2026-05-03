"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Rating, RollerCoaster } from "@/app/types";
import { getRatingColor } from "@/app/utils/design";
import RatingWarning from "../warnings/RatingWarning";

interface VisitPanelProps {
  ratings: Rating[];
  parkSlug: string;
  currentRatingId?: number;
  coasters: RollerCoaster[];
}

const groups = [
  {
    emoji: "🎢", label: "Coasters",
    subs: [
      { key: "bestCoaster",   label: "Best Coaster" },
      { key: "coasterDepth",  label: "Coaster Depth" },
    ],
  },
  {
    emoji: "🎡", label: "Rides",
    subs: [
      { key: "waterRides",            label: "Water Rides" },
      { key: "flatridesAndDarkrides", label: "Flatrides & Darkrides" },
    ],
  },
  {
    emoji: "🏞️", label: "Park",
    subs: [
      { key: "parkAppearance",   label: "Park Appearance" },
      { key: "parkPracticality", label: "Park Practicality" },
    ],
  },
  {
    emoji: "🍔", label: "Food",
    subs: [
      { key: "food",           label: "Food" },
      { key: "snacksAndDrinks", label: "Snacks & Drinks" },
    ],
  },
  {
    emoji: "📋", label: "Management",
    subs: [
      { key: "rideOperations", label: "Ride Operations" },
      { key: "parkManagement", label: "Park Management" },
    ],
  },
] as const;

type GroupLabel = typeof groups[number]["label"];

const VisitPanel: React.FC<VisitPanelProps> = ({
  ratings,
  parkSlug,
  currentRatingId,
  coasters,
}) => {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<GroupLabel | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const sorted = [...ratings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const activeId = currentRatingId ?? sorted[0]?.id;
  const active = sorted.find((r) => r.id === activeId) ?? sorted[0];

  const hasMultiple = sorted.length > 1;

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDropdownOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dropdownOpen]);

  const scrollTo = (key: string) => {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
  };

  const avg = (a: number, b: number) => parseFloat(((a + b) / 2).toFixed(2));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  if (!active) return null;

  return (
    <div ref={ref} className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 overflow-visible shadow-sm">

      {/* ── Visit header ── */}
      <button
        onClick={() => hasMultiple && setDropdownOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-3 text-left transition-colors rounded-t-2xl ${
          hasMultiple ? "hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <p className="text-sm md:text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight truncate">
            {formatDate(active.date)}
          </p>
          {(active.warnings?.length ?? 0) > 0 && (
            <RatingWarning warning={active.warnings!} coasters={coasters} />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="flex items-baseline gap-0.5">
            <span className={`text-2xl font-black tabular-nums leading-none ${getRatingColor(active.overall)}`}>
              {active.overall}
            </span>
            <span className="text-[11px] text-gray-400">/10</span>
          </div>
          {hasMultiple && (
            <svg
              className={`w-3.5 h-3.5 text-gray-300 dark:text-gray-600 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* ── Visit dropdown ── */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
          >
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
              Switch visit
            </p>
            <ul className="max-h-60 overflow-y-auto py-1">
              {sorted.map((r) => {
                const isCurrent = r.id === activeId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => { if (!isCurrent) router.push(`/park/${parkSlug}?visit=${r.id}`); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isCurrent ? "bg-blue-50 dark:bg-blue-500/15 cursor-default" : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      }`}
                    >
                      <p className={`flex-1 text-xs font-medium leading-tight ${isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                        {formatDate(r.date)}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(r.warnings?.length ?? 0) > 0 && (
                          <RatingWarning warning={r.warnings!} coasters={coasters} />
                        )}
                        <span className={`text-sm font-bold tabular-nums ${getRatingColor(r.overall)}`}>{r.overall}</span>
                        <span className="text-[11px] text-gray-400">/10</span>
                      </div>
                      {isCurrent && (
                        <svg className="w-3 h-3 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
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

      {/* ── Divider ── */}
      <div className="border-t border-gray-100 dark:border-gray-700/60 mx-3" />

      {/* ── Score accordion ── */}
      <div className="px-1 py-2">
        <ul className="space-y-0.5">
          {groups.map((g) => {
            const score = avg((active as any)[g.subs[0].key] ?? 0, (active as any)[g.subs[1].key] ?? 0);
            const isOpen = openGroup === g.label;

            return (
              <li key={g.label}>
                <button
                  onClick={() => setOpenGroup(isOpen ? null : g.label)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left"
                >
                  <span className="text-base w-5 text-center flex-shrink-0">{g.emoji}</span>
                  <span className="flex-1 text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{g.label}</span>
                  <span className={`text-base font-bold tabular-nums flex-shrink-0 ${getRatingColor(score)}`}>
                    {score.toFixed(2)}
                  </span>
                  <svg
                    className={`w-3 h-3 flex-shrink-0 text-gray-300 dark:text-gray-600 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul
                      key="subs"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden ml-7 space-y-0.5"
                    >
                      {g.subs.map((sub) => {
                        const subScore = (active as any)[sub.key] ?? 0;
                        return (
                          <motion.li
                            key={sub.key}
                            initial={{ x: -6, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                          >
                            <button
                              onClick={() => scrollTo(sub.key)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left group"
                            >
                              <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {sub.label}
                              </span>
                              <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${getRatingColor(subScore)}`}>
                                {subScore.toFixed(1)}
                              </span>
                              <svg className="w-2.5 h-2.5 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default VisitPanel;
