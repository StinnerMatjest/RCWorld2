"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import type { Checklist, ChecklistSession } from "@/app/types";
import AuthenticationModal from "@/app/components/admin/AuthenticationModal";
import { useChecklistSync, type SyncStatus } from "./useChecklistSync";

// Note keys must match RatingModal's CATEGORIES so the review modal can show them
const NOTE_CATEGORIES = [
  { key: "parkAppearance",        label: "Park Appearance",   emoji: "🏞️" },
  { key: "bestCoaster",           label: "Best Coaster",      emoji: "🎢" },
  { key: "coasterDepth",          label: "Coaster Depth",     emoji: "🎠" },
  { key: "waterRides",            label: "Water Rides",       emoji: "💦" },
  { key: "flatridesAndDarkrides", label: "Flats & Darkrides", emoji: "🎡" },
  { key: "food",                  label: "Food",              emoji: "🍔" },
  { key: "snacksAndDrinks",       label: "Snacks & Drinks",   emoji: "🥨" },
  { key: "parkPracticality",      label: "Park Practicality", emoji: "🧭" },
  { key: "rideOperations",        label: "Ride Operations",   emoji: "⚙️" },
  { key: "parkManagement",        label: "Park Management",   emoji: "📋" },
] as const;

function formatDuration(s: number): string {
  if (s <= 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export default function ChecklistClient({ checklist }: { checklist: Checklist }) {
  const { view, status, pending, actions } = useChecklistSync(checklist);
  const { items, notes, sessions } = view;
  const visitFinished = view.is_finished;
  // Only when the visit is completed in this session: reopening a finished
  // checklist (to add notes during the review) should not celebrate again.
  const [showCelebration, setShowCelebration] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  const activeSession = sessions.length > 0 && !sessions[sessions.length - 1].end
    ? sessions[sessions.length - 1] : null;
  const isPaused = sessions.length > 0 && !activeSession && !visitFinished;
  const visitStart = sessions[0]?.start ?? null;
  const canEdit = !!activeSession && !visitFinished;

  // Single clock for running timer + "paused for" display
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (visitFinished || sessions.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visitFinished, sessions.length]);

  const sessionSeconds = (s: ChecklistSession) =>
    Math.max(0, Math.floor(((s.end ? new Date(s.end).getTime() : now) - new Date(s.start).getTime()) / 1000));

  const elapsedSeconds = visitFinished
    ? view.duration
    : sessions.reduce((sum, s) => sum + sessionSeconds(s), 0);

  const pausedForSeconds = isPaused
    ? Math.max(0, Math.floor((now - new Date(sessions[sessions.length - 1].end!).getTime()) / 1000))
    : 0;

  // Day numbering for multiday visits
  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    for (const s of sessions) {
      const k = new Date(s.start).toDateString();
      if (!keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [sessions]);
  const isMultiday = dayKeys.length > 1;
  const dayNumber = (iso: string) => dayKeys.indexOf(new Date(iso).toDateString()) + 1;

  function handleBeginVisit() {
    actions.timer("start");
  }

  function handlePause() {
    if (!activeSession) return;
    actions.timer("pause");
  }

  function handleResume() {
    if (!isPaused) return;
    actions.timer("resume");
  }

  function handleComplete() {
    if (!allCompleted || visitFinished) return;
    actions.timer("complete");
    setShowCelebration(true);
  }

  function toggleItem(id: string) {
    const target = items.find(i => i.id === id);
    if (!target) return;

    if (!target.checked) {
      // Play completion animation, then commit the state change
      setCompletingIds(prev => new Set([...prev, id]));
      setTimeout(() => {
        setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        actions.setItem(id, { checked: true });
      }, 420);
    } else {
      actions.setItem(id, { checked: false });
    }
  }

  function toggleSkipItem(id: string) {
    actions.toggleSkip(id);
  }

  function updateRideCount(id: string, delta: number) {
    actions.changeRideCount(id, delta);
  }

  function updateNote(key: string, value: string) {
    actions.setNote(key, value);
  }

  function timeAgo(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  const coasterItems = useMemo(() => items.filter(i => i.isCoaster && !i.isExtra), [items]);
  const photoItems = useMemo(() => items.filter(i => i.isPhotoTask && !i.isCoaster && !i.isExtra), [items]);
  const regularItems = useMemo(() => items.filter(i => !i.isCoaster && !i.isPhotoTask && !i.isExtra), [items]);

  const remainingRegular = useMemo(() => regularItems.filter(i => !i.checked && !i.skipped), [regularItems]);
  const remainingPhotos = useMemo(() => photoItems.filter(i => !i.checked && !i.skipped), [photoItems]);
  const completedRegular = useMemo(() => (
    [...regularItems, ...photoItems].filter(i => i.checked && !i.skipped)
  ), [regularItems, photoItems]);
  const skippedItems = useMemo(() => items.filter(i => i.skipped && !i.isExtra), [items]);

  const allNonExtra = items.filter(i => !i.isExtra);
  const validTotal = allNonExtra.length - skippedItems.length;
  const completedCount = allNonExtra.filter(i => i.checked && !i.skipped).length;
  const progressPercent = validTotal > 0 ? Math.round((completedCount / validTotal) * 100) : 0;
  const allCompleted = completedCount === validTotal && validTotal > 0;

  const notesWithContent = NOTE_CATEGORIES.filter(c => (notes[c.key] ?? "").trim().length > 0).length;

  function cleanLabel(label: string): string {
    return label.replace(/^take (a )?picture of /i, "").trim();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-32 pt-6">

        <Link href="/checklists" className="mb-6 inline-flex w-fit items-center gap-2 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Dashboard
        </Link>

        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">{checklist.title} 🎢</h1>
          <p className="mt-1 text-sm text-slate-400">{checklist.description}</p>
        </header>

        {/* ── Progress ── */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-100">
              {completedCount} / {validTotal} tasks
            </span>
            <div className="flex items-center gap-2">
              {isMultiday && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-400">
                  {dayKeys.length}-day visit
                </span>
              )}
              {isPaused && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-400">
                  ⏸ Paused
                </span>
              )}
              <span className="text-sm font-bold text-emerald-400">{progressPercent}%</span>
            </div>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
          </div>

          {visitStart ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-xs text-slate-400">
                  Time in park:{" "}
                  <span className="font-semibold text-emerald-400">{formatDuration(elapsedSeconds)}</span>
                </p>
                {isPaused && (
                  <>
                    <span className="text-slate-600 text-xs">•</span>
                    <p className="text-xs font-semibold text-amber-400">
                      Paused for {formatDuration(pausedForSeconds)}
                    </p>
                  </>
                )}
              </div>

              {/* Session log — every tracked segment with pauses in between */}
              <div className="mt-3 space-y-1 border-t border-slate-800 pt-2.5">
                {sessions.map((s, i) => {
                  const prev = sessions[i - 1];
                  const gapSec = prev?.end
                    ? Math.max(0, Math.floor((new Date(s.start).getTime() - new Date(prev.end).getTime()) / 1000))
                    : 0;
                  return (
                    <div key={i}>
                      {i > 0 && gapSec > 0 && (
                        <p className="py-0.5 text-[11px] font-medium text-amber-400/80">
                          {gapSec >= 6 * 3600 ? "🌙 Break" : "⏸ Paused"} · {formatDuration(gapSec)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {isMultiday && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                            Day {dayNumber(s.start)}
                          </span>
                        )}
                        {isMultiday && <span className="text-slate-600">{fmtDay(s.start)}</span>}
                        <span className="font-semibold text-slate-300">
                          {fmtTime(s.start)} – {s.end ? fmtTime(s.end) : "Now"}
                        </span>
                        <span>·</span>
                        <span>{formatDuration(sessionSeconds(s))}</span>
                        {!s.end && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Press Start Visit to begin tracking.</p>
          )}
        </div>

        {/* ── Coaster Rides ── */}
        {coasterItems.length > 0 && (
          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-200">
              🎢 Coaster Rides
              <span className="text-xs font-normal normal-case tracking-normal text-slate-500">
                {coasterItems.filter(i => (i.rideCount || 0) > 0 && !i.skipped).length}/{coasterItems.filter(i => !i.skipped).length} ridden
              </span>
            </h2>

            <ul className="space-y-2">
              {coasterItems.map((item) => {
                const isDone = item.checked && !item.skipped;
                const isSkipped = !!item.skipped;
                const ago = timeAgo(item.rideCountLastModified);

                return (
                  <li
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${isSkipped ? "opacity-40" : isDone ? "bg-emerald-950/30 border border-emerald-900/30" : "bg-slate-950/60"
                      }`}
                  >
                    {/* Photo checkmark — tap to mark photo taken */}
                    <button
                      onClick={() => toggleItem(item.id)}
                      disabled={!canEdit || isSkipped}
                      title={isDone ? "Photo taken ✓" : "Mark photo taken"}
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all disabled:opacity-30 ${isDone ? "border-emerald-500 bg-emerald-500" : "border-slate-600 hover:border-emerald-400"}`}
                    >
                      {isDone && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {/* Name + timestamp */}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium leading-tight ${isDone ? "text-emerald-300" : "text-slate-100"}`}>
                        {cleanLabel(item.label)}
                      </p>
                      {ago && (
                        <p className="mt-0.5 text-[10px] text-slate-500">Updated {ago}</p>
                      )}
                    </div>

                    {/* Skip (only if not yet ridden) */}
                    {!isDone && (
                      <button
                        onClick={() => toggleSkipItem(item.id)}
                        disabled={!canEdit}
                        className="text-xs font-bold text-slate-600 hover:text-rose-400 disabled:opacity-30 px-1"
                        title={isSkipped ? "Undo skip" : "Skip"}
                      >
                        {isSkipped ? "Undo" : "×"}
                      </button>
                    )}

                    {/* Ride counter */}
                    {!isSkipped && (
                      <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                        <button
                          onClick={() => updateRideCount(item.id, -1)}
                          disabled={!canEdit || (item.rideCount || 0) === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                        >−</button>
                        <span className={`w-7 text-center text-sm font-bold ${(item.rideCount || 0) > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                          {item.rideCount || 0}
                        </span>
                        <button
                          onClick={() => updateRideCount(item.id, 1)}
                          disabled={!canEdit}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                        >+</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Photo Reminders ── */}
        {remainingPhotos.length > 0 && (
          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-200">
              📸 Photo Reminders
              <span className="text-xs font-normal normal-case tracking-normal text-slate-500">
                {remainingPhotos.length} remaining
              </span>
            </h2>

            <ul className="space-y-2">
              <AnimatePresence mode="popLayout">
                {remainingPhotos.map((item) => {
                  const isSkipped = !!item.skipped;
                  const isCompleting = completingIds.has(item.id);

                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 1, scale: 1 }}
                      animate={isCompleting
                        ? { backgroundColor: "rgba(6,78,59,0.45)", scale: 1.015, borderColor: "rgba(16,185,129,0.35)" }
                        : { backgroundColor: "rgba(2,6,23,0.6)", scale: 1, borderColor: "transparent" }
                      }
                      exit={{ opacity: 0, x: 16, scale: 0.97, transition: { duration: 0.22, ease: "easeOut" } }}
                      transition={{ duration: 0.18 }}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isSkipped ? "opacity-40" : ""}`}
                    >
                      <span className="text-base">📸</span>
                      <span className={`flex-1 text-sm font-medium transition-colors ${isCompleting ? "text-emerald-300" : "text-slate-100"}`}>
                        {cleanLabel(item.label)}
                      </span>

                      {isSkipped ? (
                        <button
                          onClick={() => toggleSkipItem(item.id)}
                          disabled={!canEdit}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                        >Undo</button>
                      ) : (
                        <div className="flex items-center gap-1">
                          {!isCompleting && (
                            <button
                              onClick={() => toggleSkipItem(item.id)}
                              disabled={!canEdit}
                              className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-rose-400 disabled:opacity-50"
                            >Skip</button>
                          )}
                          <button
                            onClick={() => !isCompleting && toggleItem(item.id)}
                            disabled={!canEdit || isCompleting}
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all disabled:opacity-50 ${isCompleting ? "border-emerald-500 bg-emerald-500/20" : "border-slate-600 bg-slate-900"
                              }`}
                          >
                            {isCompleting ? (
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <motion.path
                                  d="M4 10.5l4.5 4.5 7.5-8"
                                  stroke="#10b981"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  initial={{ pathLength: 0 }}
                                  animate={{ pathLength: 1 }}
                                  transition={{ duration: 0.25 }}
                                />
                              </svg>
                            ) : null}
                          </button>
                        </div>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
        )}

        {/* ── Regular Tasks ── */}
        {(remainingRegular.length > 0 || completedRegular.length > 0) && (
          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
            <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-200">Tasks</h2>

            <ul className="space-y-2">
              <AnimatePresence mode="popLayout">
                {remainingRegular.map((item) => {
                  const isCompleting = completingIds.has(item.id);
                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 1, scale: 1 }}
                      animate={isCompleting
                        ? { backgroundColor: "rgba(6,78,59,0.45)", scale: 1.015, borderColor: "rgba(16,185,129,0.35)" }
                        : { backgroundColor: "rgba(2,6,23,0.6)", scale: 1, borderColor: "transparent" }
                      }
                      exit={{ opacity: 0, x: 16, scale: 0.97, transition: { duration: 0.22, ease: "easeOut" } }}
                      transition={{ duration: 0.18 }}
                      className="flex min-h-[52px] items-center justify-between gap-2 rounded-xl border px-3 py-2"
                    >
                      <div className={`flex-1 py-1 text-sm font-medium leading-snug transition-colors ${isCompleting ? "text-emerald-300" : "text-slate-100"}`}>
                        {item.label}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isCompleting && (
                          <button
                            onClick={() => toggleSkipItem(item.id)}
                            disabled={!canEdit}
                            className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-rose-400 disabled:opacity-50"
                          >Skip</button>
                        )}
                        <button
                          onClick={() => !isCompleting && toggleItem(item.id)}
                          disabled={!canEdit || isCompleting}
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all ${isCompleting ? "border-emerald-500 bg-emerald-500/20" : "border-slate-600 bg-slate-900 disabled:opacity-50"
                            }`}
                        >
                          {isCompleting ? (
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                              <motion.path
                                d="M4 10.5l4.5 4.5 7.5-8"
                                stroke="#10b981"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.25 }}
                              />
                            </svg>
                          ) : (
                            <input type="checkbox" checked={false} readOnly className="pointer-events-none h-5 w-5 accent-emerald-500" />
                          )}
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            {completedRegular.length > 0 && (
              <ul className={`space-y-1 ${remainingRegular.length > 0 ? "mt-3 border-t border-slate-800 pt-3" : ""}`}>
                {completedRegular.map((item) => (
                  <motion.li key={item.id} layout className="flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                    <span className={item.isPhotoTask ? "text-base" : "text-emerald-400"}>{item.isPhotoTask ? "📸" : "✓"}</span>
                    <span className="flex-1 line-through text-slate-500">{cleanLabel(item.label)}</span>
                    {canEdit && (
                      <button onClick={() => toggleItem(item.id)} className="px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-300">
                        Undo
                      </button>
                    )}
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Review Notes ── */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-200">
            📝 Review Notes
            <span className="text-xs font-normal normal-case tracking-normal text-slate-500">
              {notesWithContent}/{NOTE_CATEGORIES.length} categories
            </span>
          </h2>
          <p className="mb-3 text-[11px] text-slate-500">
            Jot down impressions per category — they&apos;ll be right there when you write the review.
          </p>

          <ul className="space-y-1.5">
            {NOTE_CATEGORIES.map((cat) => {
              const value = notes[cat.key] ?? "";
              const hasNote = value.trim().length > 0;
              const isOpen = openNote === cat.key;
              return (
                <li key={cat.key} className="overflow-hidden rounded-xl bg-slate-950/60">
                  <button
                    onClick={() => setOpenNote(isOpen ? null : cat.key)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                  >
                    <span className="text-base">{cat.emoji}</span>
                    <span className={`flex-1 text-sm font-medium ${hasNote ? "text-slate-100" : "text-slate-400"}`}>
                      {cat.label}
                    </span>
                    {hasNote && !isOpen && (
                      <span className="max-w-[40%] truncate text-[11px] text-slate-500">{value}</span>
                    )}
                    {hasNote && <span className="text-emerald-400 text-xs">●</span>}
                    <span className={`text-slate-600 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="px-3 pb-3">
                          <textarea
                            value={value}
                            onChange={(e) => updateNote(cat.key, e.target.value)}
                            onBlur={() => actions.flushNow()}
                            placeholder={`Notes on ${cat.label.toLowerCase()}…`}
                            rows={3}
                            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Skipped ── */}
        {skippedItems.length > 0 && (
          <section className="mb-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 sm:p-4">
            <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Skipped</h2>
            <ul className="space-y-2">
              {skippedItems.map((item) => (
                <motion.li key={item.id} layout className="flex min-h-[44px] items-center justify-between rounded-lg px-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="text-slate-600">⏭</span>
                    <span className="line-through opacity-80">{item.label}</span>
                  </div>
                  <button
                    onClick={() => toggleSkipItem(item.id)}
                    disabled={!canEdit}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >Undo</button>
                </motion.li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex-1" />

        {/* ── Fixed bottom CTA ── */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-8 pt-4 sm:pb-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          <div className="pointer-events-auto relative w-full max-w-xl px-4">
            <SyncNotice status={status} pending={pending} onLogin={() => setShowLogin(true)} />
            {!visitStart ? (
              <button onClick={handleBeginVisit} className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 text-base font-bold text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98] cursor-pointer">
                Start Visit ⏱️
              </button>
            ) : !visitFinished ? (
              <div className="flex gap-2">
                {isPaused ? (
                  <button onClick={handleResume}
                    className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-base font-bold text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98] cursor-pointer">
                    Resume ▶
                  </button>
                ) : (
                  <button onClick={handlePause}
                    className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-5 text-base font-bold text-slate-200 hover:bg-slate-800 active:scale-[0.98] cursor-pointer">
                    ⏸<span className="hidden sm:inline"> Pause</span>
                  </button>
                )}
                <button
                  onClick={handleComplete}
                  disabled={!allCompleted}
                  className={`flex min-h-[56px] flex-1 items-center justify-center rounded-2xl px-4 text-base font-bold shadow-xl transition-all cursor-pointer ${allCompleted
                      ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98]"
                      : "bg-slate-800 text-slate-500 shadow-none"
                    }`}
                >
                  {allCompleted ? "Complete Visit 🎉" : isPaused ? "Paused" : "Complete all tasks to finish"}
                </button>
              </div>
            ) : (
              <Link href={`/?modal=true&importChecklist=${checklist.slug}`} className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-blue-500 px-4 text-base font-bold text-white shadow-xl shadow-blue-500/20 hover:bg-blue-400 active:scale-[0.98] cursor-pointer">
                Draft Review 📝
              </Link>
            )}
          </div>
        </div>
      </div>

      {showLogin && (
        <AuthenticationModal
          onClose={() => setShowLogin(false)}
          onAuthenticated={() => {
            setShowLogin(false);
            actions.retryAfterLogin();
          }}
        />
      )}

      {/* ── Celebration modal ── */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center">
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 shadow-2xl sm:border sm:border-emerald-500/20">
              <div className="relative px-6 py-8 text-center">
                <div className="pointer-events-none absolute inset-0">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.span key={i} className="absolute text-2xl" initial={{ x: Math.random() * 320 - 160, y: 80, opacity: 0, scale: 0.4 }} animate={{ y: -120, opacity: [0, 1, 0], scale: [0.6, 1, 0.7] }} transition={{ duration: 2.2, delay: i * 0.08, repeat: Infinity, repeatType: "loop" }}>
                      {i % 3 === 0 ? "🎢" : i % 3 === 1 ? "🎉" : "📸"}
                    </motion.span>
                  ))}
                </div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="relative z-10">
                  <div className="mb-2 text-5xl">🎉</div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-50 sm:text-3xl">Park complete!</h2>
                  <p className="mx-auto mb-6 max-w-xs text-sm text-slate-300">
                    All mandatory tasks done. Future-you writing the review says thank you. 💚
                  </p>

                  <div className="mx-auto mb-6 flex w-full flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left text-sm text-slate-300">
                    {sessions.map((s, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="font-medium text-slate-500">
                          {isMultiday ? `Day ${dayNumber(s.start)} · ${fmtDay(s.start)}` : `Session ${sessions.length > 1 ? i + 1 : ""}`.trim() || "Session"}:
                        </span>
                        <span className="font-bold text-slate-200">
                          {fmtTime(s.start)} – {s.end ? fmtTime(s.end) : "…"}
                        </span>
                      </div>
                    ))}
                    {sessions.length > 1 && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Pauses:</span>
                        <span className="font-bold text-slate-200">{sessions.length - 1}</span>
                      </div>
                    )}
                    {elapsedSeconds > 0 && (
                      <div className="mt-1 flex justify-between border-t border-slate-800 pt-2">
                        <span className="font-medium text-slate-500">Total Time:</span>
                        <span className="font-bold text-emerald-400">{formatDuration(elapsedSeconds)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>

                <button type="button" onClick={() => setShowCelebration(false)} className="relative z-10 min-h-[56px] w-full rounded-xl bg-emerald-500 px-4 text-base font-bold text-slate-950 hover:bg-emerald-400 active:scale-[0.98] cursor-pointer">
                  Back to dashboard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/**
 * Quiet while everything is saved. Says so plainly when changes are only on
 * this phone: no connection (they sync on their own) or not logged in (they
 * wait for a login and are never dropped).
 */
function SyncNotice({ status, pending, onLogin }: { status: SyncStatus; pending: number; onLogin: () => void }) {
  const [showSaving, setShowSaving] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // A save normally takes a fraction of a second; only mention it if it lingers.
  useEffect(() => {
    if (status !== "saving") { setShowSaving(false); return; }
    const t = setTimeout(() => setShowSaving(true), 1500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status === "offline" || status === "unauthorized") { setWasOffline(true); return; }
    if (status === "saved" && wasOffline) {
      setWasOffline(false);
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 2500);
      return () => clearTimeout(t);
    }
  }, [status, wasOffline]);

  const changes = `${pending} change${pending === 1 ? "" : "s"}`;

  if (status === "unauthorized") {
    return (
      <div className="mb-2 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-slate-900/95 px-3 py-2.5 text-xs text-amber-200 shadow-lg">
        <span className="flex-1 leading-snug">
          This phone isn&apos;t logged in, so nothing reaches the site.
          {pending > 0 ? ` ${changes} kept on this phone.` : ""}
        </span>
        <button
          onClick={onLogin}
          className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
        >
          Log in
        </button>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-slate-900/95 px-3 py-2.5 text-xs leading-snug text-amber-200 shadow-lg">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
        <span>No connection. {changes} kept on this phone, sent as soon as you&apos;re back online.</span>
      </div>
    );
  }

  let line: ReactNode = null;
  if (showSaving) {
    line = <span className="text-slate-400">Saving…</span>;
  } else if (justSynced) {
    line = <span className="text-emerald-400">All changes synced</span>;
  }

  if (!line) return null;
  return <p className="mb-2 text-center text-[11px] font-medium">{line}</p>;
}
