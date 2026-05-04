"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Rating } from "@/app/types";
import { getRatingColor } from "@/app/utils/design";

const groups = [
  {
    emoji: "🎢",
    label: "Coasters",
    subs: [
      { key: "bestCoaster", label: "Best Coaster" },
      { key: "coasterDepth", label: "Coaster Depth" },
    ],
  },
  {
    emoji: "🎡",
    label: "Rides",
    subs: [
      { key: "waterRides", label: "Water Rides" },
      { key: "flatridesAndDarkrides", label: "Flatrides & Darkrides" },
    ],
  },
  {
    emoji: "🏞️",
    label: "Park",
    subs: [
      { key: "parkAppearance", label: "Park Appearance" },
      { key: "parkPracticality", label: "Park Practicality" },
    ],
  },
  {
    emoji: "🍔",
    label: "Food",
    subs: [
      { key: "food", label: "Food" },
      { key: "snacksAndDrinks", label: "Snacks & Drinks" },
    ],
  },
  {
    emoji: "📋",
    label: "Management",
    subs: [
      { key: "rideOperations", label: "Ride Operations" },
      { key: "parkManagement", label: "Park Management" },
    ],
  },
] as const;

const VisitPanelDropdown: React.FC<{ rating: Rating }> = ({ rating }) => {
  // Use an array to track multiple open categories
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const avg = (a: number, b: number) =>
    parseFloat(((a + b) / 2).toFixed(2));

  const scrollTo = (key: string) => {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
        Breakdown
      </p>
      <ul className="space-y-0.5">
        {groups.map((g) => {
          const score = avg(
            (rating as any)[g.subs[0].key] ?? 0,
            (rating as any)[g.subs[1].key] ?? 0
          );
          const isOpen = openGroups.includes(g.label);

          return (
            <li key={g.label}>
              <button
                onClick={() => toggleGroup(g.label)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left group"
              >
                <span className="text-base w-5 text-center flex-shrink-0">{g.emoji}</span>
                <span className="flex-1 text-base font-medium text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  {g.label}
                </span>
                <span className={`w-10 text-right text-base font-bold tabular-nums flex-shrink-0 ${getRatingColor(score)}`}>
                  {score.toFixed(2)}
                </span>
                <svg
                  className={`w-3 h-3 flex-shrink-0 text-gray-400 dark:text-gray-600 group-hover:text-blue-400 transition-colors duration-200 ${isOpen ? "rotate-90" : ""}`}
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
                    className="overflow-hidden ml-7 md:ml-0 space-y-0.5"
                  >
                    {g.subs.map((sub) => {
                      const subScore = (rating as any)[sub.key] ?? 0;
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
                            <span className="flex-1 min-w-0 text-[15px] font-medium text-gray-500 dark:text-gray-400 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {sub.label}
                            </span>
                            <span className={`w-12 text-right text-sm font-bold tabular-nums flex-shrink-0 ${getRatingColor(subScore)}`}>
                              {subScore.toFixed(1)}
                            </span>
                            <svg className="w-2.5 h-2.5 text-gray-400 dark:text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
  );
};

export default VisitPanelDropdown;