"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

// Bumped version so old saved state (wrong order) is ignored
const STORAGE_KEY = "parkrating-visit-checklist-v3";

// Timer keys
const VISIT_START_KEY = "parkrating-visit-start-v1";
const VISIT_DURATION_KEY = "parkrating-visit-duration-v1";
const VISIT_FINISHED_KEY = "parkrating-visit-finished-v1";
const VISIT_END_KEY = "parkrating-visit-end-v1";

const defaultItems: ChecklistItem[] = [
  {
    id: "entrance-photo",
    label: "Take a stunning cover photo at the entrance",
    checked: false,
  },
  {
    id: "coaster-cover",
    label: "Take a great cover photo of the park’s best roller coaster",
    checked: false,
  },
  {
    id: "park-app",
    label: "Check out the park app",
    checked: false,
  },
  {
    id: "snack",
    label: "Have at least one snack",
    checked: false,
  },
  {
    id: "unique-snack",
    label: "Check for unique snacks or foods",
    checked: false,
  },
  {
    id: "top-coaster-rows",
    label: "Ride the top coaster in both the front and back row",
    checked: false,
  },
  {
    id: "mug-merch",
    label: "Buy a mug and rate the merchandise game",
    checked: false,
  },
  {
    id: "vekoma-hate",
    label: "Find a reason to dislike a Vekoma coaster 😈",
    checked: false,
  },
];

const VEKOMA_ROASTS = [
  "Vekoma: giving chiropractors job security since 1980.",
  "So many turns, so few vertebrae left.",
  "Smooth… for the first three seconds.",
  "That moment when the theming rides better than the coaster.",
  "Vekoma: because who needs a straight spine anyway?",
  "More headbanging than a metal concert.",
  "At least the queue theming was nice.",
  "Vekoma..... SLAP!",
];

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>(defaultItems);
  const [showCelebration, setShowCelebration] = useState(false);

  // Timer state
  const [visitStart, setVisitStart] = useState<string | null>(null);
  const [visitEnd, setVisitEnd] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [visitFinished, setVisitFinished] = useState<boolean>(false);

  // Vekoma roast state
  const [showVekomaRoast, setShowVekomaRoast] = useState(false);
  const [vekomaRoast, setVekomaRoast] = useState("");

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

      const savedVisitStart = window.localStorage.getItem(VISIT_START_KEY);
      const savedVisitEnd = window.localStorage.getItem(VISIT_END_KEY);
      const savedVisitFinished =
        window.localStorage.getItem(VISIT_FINISHED_KEY) === "true";
      const savedDuration = window.localStorage.getItem(VISIT_DURATION_KEY);

      if (savedVisitStart) {
        setVisitStart(savedVisitStart);
      }
      if (savedVisitEnd) {
        setVisitEnd(savedVisitEnd);
      }
      if (savedVisitFinished) {
        setVisitFinished(true);
      }
      if (savedVisitFinished && savedDuration) {
        setElapsedSeconds(parseInt(savedDuration, 10) || 0);
      } else if (savedVisitStart && !savedVisitFinished) {
        const start = new Date(savedVisitStart).getTime();
        const now = Date.now();
        const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedSeconds(diffSeconds);
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

  // Timer interval
  useEffect(() => {
    if (!visitStart || visitFinished) return;

    const startMs = new Date(visitStart).getTime();
    const update = () => {
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(diffSeconds);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [visitStart, visitFinished]);

  // Auto-hide Vekoma roast after a few seconds
  useEffect(() => {
    if (!showVekomaRoast) return;
    const t = setTimeout(() => setShowVekomaRoast(false), 4500);
    return () => clearTimeout(t);
  }, [showVekomaRoast]);

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
    const vekomaItem = items.find((i) => i.id === "vekoma-hate");
    const wasVekomaChecked = vekomaItem?.checked;

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );

    if (id === "vekoma-hate" && !wasVekomaChecked) {
      const roast =
        VEKOMA_ROASTS[Math.floor(Math.random() * VEKOMA_ROASTS.length)];
      setVekomaRoast(roast);
      setShowVekomaRoast(true);
    }
  }

  function handleComplete() {
    if (!allCompleted) return;

    setShowCelebration(true);

    // Finish timer
    if (visitStart && !visitFinished) {
      const startMs = new Date(visitStart).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
      const endIso = new Date().toISOString();

      setElapsedSeconds(diffSeconds);
      setVisitFinished(true);
      setVisitEnd(endIso);

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            VISIT_DURATION_KEY,
            diffSeconds.toString()
          );
          window.localStorage.setItem(VISIT_FINISHED_KEY, "true");
          window.localStorage.setItem(VISIT_END_KEY, endIso);
        } catch (err) {
          console.error("Failed to save visit duration/end", err);
        }
      }
    }
  }

  function handleReset() {
    setItems(defaultItems);
    setShowCelebration(false);

    setVisitStart(null);
    setVisitEnd(null);
    setElapsedSeconds(0);
    setVisitFinished(false);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(VISIT_START_KEY);
        window.localStorage.removeItem(VISIT_DURATION_KEY);
        window.localStorage.removeItem(VISIT_FINISHED_KEY);
        window.localStorage.removeItem(VISIT_END_KEY);
      } catch (err) {
        console.error("Failed to reset checklist", err);
      }
    }
  }

  function handleBeginVisit() {
    const nowIso = new Date().toISOString();
    setVisitStart(nowIso);
    setVisitFinished(false);
    setVisitEnd(null);
    setElapsedSeconds(0);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(VISIT_START_KEY, nowIso);
        window.localStorage.setItem(VISIT_FINISHED_KEY, "false");
        window.localStorage.removeItem(VISIT_DURATION_KEY);
        window.localStorage.removeItem(VISIT_END_KEY);
      } catch (err) {
        console.error("Failed to save visit start", err);
      }
    }
  }

  const showBeginOverlay = !visitStart && !visitFinished;

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-50"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
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
          <div className="space-y-0.5">
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
            {visitStart && (
              <p className="text-[11px] text-slate-400 sm:text-xs">
                Time in park:{" "}
                <span className="font-semibold text-emerald-400">
                  {formatDuration(elapsedSeconds)}
                </span>
              </p>
            )}
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
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-slate-500 bg-slate-900 focus:outline-none focus-visible:outline-none"
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

        {/* Completed tasks */}
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
            {visitFinished && elapsedSeconds > 0 && (
              <p className="mt-1 text-[11px] text-slate-500">
                Time in park: {formatDuration(elapsedSeconds)}
              </p>
            )}
          </section>
        )}

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
                  className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 active:scale-95 focus:outline-none focus-visible:outline-none"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={handleComplete}
                disabled={!allCompleted}
                className={`flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform active:scale-[0.98] focus:outline-none focus-visible:outline-none
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

        {/* Begin visit overlay */}
        <AnimatePresence>
          {showBeginOverlay && (
            <motion.div
              className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-md"
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
                  <div className="mb-2 text-5xl">⏱️</div>
                  <h2 className="mb-1 text-2xl font-bold sm:text-3xl">
                    Ready to start your park day?
                  </h2>
                  <p className="mx-auto mb-4 max-w-xs text-sm text-slate-200">
                    We&apos;ll keep track of how long you spend in the park so
                    future-you doesn&apos;t have to guess.
                  </p>
                  <motion.button
                    type="button"
                    onClick={handleBeginVisit}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 active:scale-[0.98] focus:outline-none focus-visible:outline-none"
                    whileTap={{ scale: 0.97 }}
                  >
                    Begin visit
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    {visitStart && (
                      <p className="text-xs text-slate-400">
                        Park start:{" "}
                        {new Date(visitStart).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {visitEnd && (
                      <p className="mb-1 text-xs text-slate-400">
                        Park end:{" "}
                        {new Date(visitEnd).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {elapsedSeconds > 0 && (
                      <p className="mb-4 text-xs text-emerald-300">
                        Time in park: {formatDuration(elapsedSeconds)}
                      </p>
                    )}
                  </motion.div>

                  <motion.button
                    type="button"
                    onClick={() => setShowCelebration(false)}
                    className="relative mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 active:scale-[0.98] focus:outline-none focus-visible:outline-none"
                    whileTap={{ scale: 0.97 }}
                  >
                    Back to checklist
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vekoma Disappointment Generator toast */}
        <AnimatePresence>
          {showVekomaRoast && (
            <motion.div
              className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
            >
              <div className="pointer-events-auto max-w-xs rounded-2xl border border-rose-500/50 bg-slate-950/95 px-4 py-3 text-xs text-slate-100 shadow-lg shadow-rose-500/30">
                <div className="mb-1 flex items-center gap-2 font-semibold text-rose-300">
                  <span>🎢 Vekoma Disappointment Generator</span>
                </div>
                <p className="text-[11px] text-slate-200">{vekomaRoast}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
