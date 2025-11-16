"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

const STORAGE_KEY = "parkrating-visit-checklist-v2";
const STORAGE_COMPLETE_KEY = "parkrating-visit-checklist-completed-v2";

const defaultItems: ChecklistItem[] = [
  {
    id: "mug-merch",
    label: "Buy a mug and rate the merchandise",
    checked: false,
  },
  {
    id: "cover-photo",
    label: "Take a cover photo for the park at the entrance",
    checked: false,
  },
  {
    id: "gallery-photos",
    label:
      "Take at least one picture of each major ride / attraction / food for the gallery",
    checked: false,
  },
  {
    id: "snack",
    label: "Have at least 1 snack",
    checked: false,
  },
  {
    id: "unique-snack",
    label: "Check for unique snacks or food",
    checked: false,
  },
  {
    id: "top-coasters-both-rows",
    label: "Ride the top coasters both front and back",
    checked: false,
  },
  {
    id: "vekoma-hate",
    label: "Find a reason to dislike a Vekoma coaster 😈",
    checked: false,
  },
  {
    id: "park-app",
    label: "Check out the park app",
    checked: false,
  },
];

export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>(defaultItems);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Load from localStorage once
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChecklistItem[];
        if (Array.isArray(parsed) && parsed.length) {
          setItems(parsed);
        }
      }

      const savedCompletedAt = window.localStorage.getItem(
        STORAGE_COMPLETE_KEY
      );
      if (savedCompletedAt) {
        setCompletedAt(savedCompletedAt);
      }
    } catch (err) {
      console.error("Failed to load checklist", err);
    }
  }, []);

  // Persist whenever items change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error("Failed to save checklist", err);
    }
  }, [items]);

  const remainingItems = useMemo(
    () => items.filter((item) => !item.checked),
    [items]
  );
  const completedItems = useMemo(
    () => items.filter((item) => item.checked),
    [items]
  );

  const allCompleted = remainingItems.length === 0 && items.length > 0;
  const progress = Math.round((completedItems.length / items.length) * 100);

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  }

  function handleComplete() {
    if (!allCompleted) return;

    const timestamp = new Date().toISOString();
    setCompletedAt(timestamp);
    setShowCelebration(true);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_COMPLETE_KEY, timestamp);
      } catch (err) {
        console.error("Failed to save completion time", err);
      }
    }
  }

  function handleReset() {
    setItems(defaultItems);
    setCompletedAt(null);
    setShowCelebration(false);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(STORAGE_COMPLETE_KEY);
      } catch (err) {
        console.error("Failed to reset checklist", err);
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-24 pt-6">
        {/* Header */}
        <header className="mb-4 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">
            ParkRating Checklist 🎢
          </h1>
          <p className="mt-1 text-xs text-slate-300 sm:text-sm">
            The days of forgetting are gone.
          </p>
        </header>

        {/* Progress pill */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs sm:text-sm">
          <div>
            <p className="font-semibold">
              Mandatory tasks: {completedItems.length}/{items.length}
            </p>
            <p className="text-[11px] text-slate-400 sm:text-xs">
              {remainingItems.length === 0
                ? "All done – time to celebrate!"
                : `${remainingItems.length} task${
                    remainingItems.length === 1 ? "" : "s"
                  } left`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              <svg viewBox="0 0 36 36" className="-rotate-90">
                <path
                  d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.4)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32"
                  fill="none"
                  stroke="rgb(52, 211, 153)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="100"
                  strokeDashoffset={100 - progress}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                {progress}%
              </div>
            </div>
          </div>
        </div>

        {/* Remaining tasks */}
        <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200 sm:text-base">
            Remaining tasks
          </h2>

          {remainingItems.length === 0 ? (
            <p className="text-xs text-slate-400 sm:text-sm">
              No remaining tasks – hit{" "}
              <span className="font-semibold text-emerald-400">
                Park complete
              </span>{" "}
              when you&apos;re ready.
            </p>
          ) : (
            <AnimatePresence>
              <ul className="space-y-2">
                {remainingItems.map((item) => (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="flex items-start gap-3 rounded-xl bg-slate-950/60 px-3 py-2.5 active:scale-[0.99]"
                    onClick={() => toggleItem(item.id)}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItem(item.id);
                      }}
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-slate-500 bg-slate-900"
                    >
                      <input
                        id={item.id}
                        type="checkbox"
                        checked={item.checked}
                        readOnly
                        className="h-4 w-4 cursor-pointer accent-emerald-500"
                      />
                    </button>
                    <label
                      htmlFor={item.id}
                      className="cursor-pointer text-[13px] leading-snug text-slate-100 sm:text-sm"
                    >
                      {item.label}
                    </label>
                  </motion.li>
                ))}
              </ul>
            </AnimatePresence>
          )}
        </section>

        {/* Completed tasks (collapsed style) */}
        {completedItems.length > 0 && (
          <section className="mb-4 rounded-2xl border border-slate-900/80 bg-slate-950/60 p-3 sm:p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Completed today
            </h2>
            <ul className="space-y-1.5">
              {completedItems.map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  className="flex items-center gap-2 text-[12px] text-slate-400 sm:text-xs"
                >
                  <span className="text-emerald-400">✓</span>
                  <span className="line-through">{item.label}</span>
                </motion.li>
              ))}
            </ul>
            {completedAt && (
              <p className="mt-2 text-[11px] text-slate-500">
                Last marked complete:{" "}
                {new Date(completedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            )}
          </section>
        )}

        {/* Spacer so bottom bar doesn't overlap */}
        <div className="flex-1" />

        {/* Bottom actions bar */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-3">
          <div className="pointer-events-auto w-full max-w-xl px-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-3 py-3 shadow-lg shadow-black/40 backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs">
                <span>
                  {remainingItems.length === 0
                    ? "All mandatory tasks completed"
                    : `${remainingItems.length} task${
                        remainingItems.length === 1 ? "" : "s"
                      } left`}
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 active:scale-95"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={handleComplete}
                disabled={!allCompleted}
                className={`flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform active:scale-[0.98]
                ${
                  allCompleted
                    ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {allCompleted ? "Park complete 🎉" : "Complete all tasks to finish"}
              </button>
            </div>
          </div>
        </div>

        {/* Celebration overlay */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 140, damping: 14 }}
                className="relative mx-4 max-w-md rounded-3xl bg-gradient-to-br from-emerald-400 via-sky-500 to-indigo-500 p-[2px]"
              >
                <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-center">
                  {/* Floating emojis */}
                  <div className="pointer-events-none absolute inset-0">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <motion.span
                        key={i}
                        className="absolute text-2xl"
                        initial={{
                          x: Math.random() * 320 - 160,
                          y: 80,
                          opacity: 0,
                          scale: 0.4,
                        }}
                        animate={{
                          y: -120,
                          opacity: [0, 1, 0],
                          scale: [0.6, 1, 0.7],
                        }}
                        transition={{
                          duration: 2.2,
                          delay: i * 0.08,
                          repeat: Infinity,
                          repeatType: "loop",
                        }}
                      >
                        {i % 3 === 0 ? "🎢" : i % 3 === 1 ? "🎉" : "🍿"}
                      </motion.span>
                    ))}
                  </div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="relative"
                  >
                    <div className="mb-2 text-5xl">🎉</div>
                    <h2 className="mb-1 text-2xl font-bold sm:text-3xl">
                      Park complete!
                    </h2>
                    <p className="mx-auto mb-4 max-w-xs text-sm text-slate-200">
                      All mandatory tasks done. Future-you writing the review
                      says thank you. 💚
                    </p>
                    {completedAt && (
                      <p className="mb-4 text-xs text-slate-400">
                        Completed at{" "}
                        {new Date(completedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </motion.div>

                  <motion.button
                    type="button"
                    onClick={() => setShowCelebration(false)}
                    className="relative mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 active:scale-[0.98]"
                    whileTap={{ scale: 0.97 }}
                  >
                    Back to checklist
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
