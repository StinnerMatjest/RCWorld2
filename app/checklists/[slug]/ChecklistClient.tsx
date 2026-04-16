"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import type { Checklist, ChecklistItem } from "@/app/types";

export default function ChecklistClient({ checklist }: { checklist: Checklist }) {
  const [items, setItems] = useState<ChecklistItem[]>(checklist.items || []);
  const [showCelebration, setShowCelebration] = useState(checklist.is_finished || false);
  const [expandedPhotos, setExpandedPhotos] = useState<string[]>([]);

  const [visitStart, setVisitStart] = useState<string | null>(checklist.visit_start || null);
  const [visitEnd, setVisitEnd] = useState<string | null>(checklist.visit_end || null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(checklist.duration || 0);
  const [visitFinished, setVisitFinished] = useState<boolean>(checklist.is_finished || false);

  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  // This automatically freezes the UI if an item is uploading
  const isUIFrozen = !!uploadingItemId;

  const fileInputRef = useRef<HTMLInputElement>(null);

  function togglePhotoExpand(id: string) {
    setExpandedPhotos((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  useEffect(() => {
    if (!visitStart || visitFinished) return;
    const startMs = new Date(visitStart).getTime();
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [visitStart, visitFinished]);

  async function syncToDatabase(payload: Partial<Checklist>) {
    try {
      await fetch(`/api/checklists/${checklist.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items, visit_start: visitStart, visit_end: visitEnd,
          duration: elapsedSeconds, is_finished: visitFinished, ...payload,
        }),
      });
    } catch (error) {
      console.error("Failed to sync checklist to DB", error);
    }
  }

  function handleBeginVisit() {
    const nowIso = new Date().toISOString();
    setVisitStart(nowIso);
    setVisitFinished(false);
    setVisitEnd(null);
    setElapsedSeconds(0);
    syncToDatabase({ visit_start: nowIso, is_finished: false, visit_end: null, duration: 0 });
  }

  function handleComplete() {
    if (!allCompleted || isUIFrozen) return;
    setShowCelebration(true);
    if (visitStart && !visitFinished) {
      const startMs = new Date(visitStart).getTime();
      const diffSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const endIso = new Date().toISOString();
      setElapsedSeconds(diffSeconds);
      setVisitFinished(true);
      setVisitEnd(endIso);
      syncToDatabase({ duration: diffSeconds, is_finished: true, visit_end: endIso });
    }
  }

  function toggleItem(id: string) {
    if (isUIFrozen) return;
    const newItems = items.map((item) => item.id === id ? { ...item, checked: !item.checked } : item);
    setItems(newItems);
    syncToDatabase({ items: newItems });
  }

  function toggleSkipItem(id: string) {
    if (isUIFrozen) return;
    const newItems = items.map((item) => item.id === id ? { ...item, skipped: !item.skipped } : item);
    setItems(newItems);
    syncToDatabase({ items: newItems });
  }

  function updateRideCount(id: string, delta: number) {
    if (isUIFrozen) return;
    const newItems = items.map((item) => {
      if (item.id === id) {
        const currentCount = item.rideCount || 0;
        const newCount = Math.max(0, currentCount + delta); // Prevents negative rides
        return { ...item, rideCount: newCount };
      }
      return item;
    });
    setItems(newItems);
    syncToDatabase({ items: newItems });
  }

  function handlePhotoClick(id: string) {
    if (isUIFrozen || !visitStart) return;

    // This sets the ID, which automatically makes isUIFrozen = true
    setUploadingItemId(id);

    // Micro-delay ensures React registers the state change before firing the native click
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 0);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    // If the user opened the picker but hit "Cancel"
    if (!file || !uploadingItemId) {
      setUploadingItemId(null); // Unfreezes UI
      e.target.value = ""; // Resets input
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const { imagePath } = await res.json();

        const newItems = items.map((item) => {
          if (item.id === uploadingItemId) {
            return { ...item, checked: true, imageUrl: imagePath };
          }
          return item;
        });

        setItems(newItems);
        syncToDatabase({ items: newItems });
      } else {
        alert("Upload failed. Please try again.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("An error occurred during upload.");
    } finally {
      // Always unfreeze the UI and clear the input when done
      setUploadingItemId(null);
      e.target.value = "";
    }
  }

  function formatDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) return "0m";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }

  const remainingItems = useMemo(() => items.filter((item) => !item.checked && !item.skipped), [items]);
  const completedItems = useMemo(() => items.filter((item) => item.checked && !item.skipped), [items]);
  const skippedItems = useMemo(() => items.filter((item) => item.skipped), [items]);
  const validTotalTasks = items.length - skippedItems.length;
  const allCompleted = remainingItems.length === 0 && validTotalTasks > 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">

      {/* NOTE: I removed the duplicate <input> tag that was up here forcing the camera! */}

      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-32 pt-6">

        {/* Back Button */}
        <Link href="/checklists" className="mb-6 inline-flex w-fit items-center gap-2 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back to Dashboard
        </Link>

        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">{checklist.title} 🎢</h1>
          <p className="mt-1 text-sm text-slate-400">{checklist.description}</p>
        </header>

        {/* Progress pill */}
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
          <div className="space-y-1">
            <p className="font-bold text-slate-100">Tasks: {completedItems.length}/{validTotalTasks}</p>
            <p className="text-xs text-slate-400">
              {allCompleted ? "All done – time to celebrate!" : `${remainingItems.length} tasks left`}
            </p>
            {visitStart && (
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <p className="text-xs text-slate-400">
                  Time in park: <span className="font-semibold text-emerald-400">{formatDuration(elapsedSeconds)}</span>
                </p>
                <p className="hidden text-slate-600 sm:block">•</p>
                <p className="text-[11px] font-medium text-slate-500 sm:text-xs">
                  {new Date(visitStart).toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" })}
                  {" - "}
                  {visitFinished && visitEnd
                    ? new Date(visitEnd).toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" })
                    : "Now"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Remaining tasks */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
          <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-200">Remaining tasks</h2>
          {remainingItems.length === 0 ? (
            <p className="px-1 text-sm text-slate-500">No remaining tasks!</p>
          ) : (
            <AnimatePresence>
              <ul className="space-y-2">
                {remainingItems.map((item) => (
                  <motion.li key={item.id} layout className={`flex min-h-[56px] items-center justify-between gap-2 rounded-xl bg-slate-950/60 px-3 py-2 transition-opacity ${isUIFrozen && uploadingItemId !== item.id ? 'opacity-50' : 'opacity-100'}`}>

                    {/* Entire label acts as a huge hit area */}
                    <div
                      className="flex-1 cursor-pointer py-2 text-sm font-medium leading-snug text-slate-100"
                      onClick={() => !item.isPhotoTask && toggleItem(item.id)}
                    >
                      {item.label}
                    </div>

                    <div className="flex items-center gap-1">

                      {/* Ride Counter */}
                      {item.isCoaster && (
                        <div className="mr-1 flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateRideCount(item.id, -1); }}
                            disabled={!visitStart || isUIFrozen || (item.rideCount || 0) === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-emerald-400">
                            {item.rideCount || 0}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateRideCount(item.id, 1); }}
                            disabled={!visitStart || isUIFrozen || visitFinished}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      )}

                      <button onClick={() => toggleSkipItem(item.id)} disabled={!visitStart || isUIFrozen} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-rose-400 disabled:opacity-50">
                        Skip
                      </button>

                      {item.isPhotoTask ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePhotoClick(item.id);
                          }}
                          disabled={uploadingItemId === item.id || !visitStart}
                          className="flex h-10 items-center justify-center rounded-lg bg-emerald-500/20 px-4 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          {uploadingItemId === item.id ? "..." : "📸 Upload"}
                        </button>
                      ) : (
                        <button onClick={() => toggleItem(item.id)} disabled={!visitStart || isUIFrozen} className="ml-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-900 disabled:opacity-50">
                          <input type="checkbox" checked={item.checked} readOnly className="pointer-events-none h-5 w-5 accent-emerald-500" />
                        </button>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            </AnimatePresence>
          )}
        </section>

        {/* Skipped tasks */}
        {skippedItems.length > 0 && (
          <section className="mb-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 shadow-inner sm:p-4">
            <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Skipped tasks</h2>
            <ul className="space-y-2">
              {skippedItems.map((item) => (
                <motion.li key={item.id} layout className={`flex min-h-[48px] items-center justify-between rounded-lg px-2 text-sm transition-opacity ${isUIFrozen ? 'opacity-50' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="text-slate-600">⏭</span>
                    <span className="flex-1 line-through opacity-80">{item.label}</span>
                  </div>

                  {/* Wrapper for counter + Undo button */}
                  <div className="flex items-center gap-2">

                    {/* Ride Counter UI */}
                    {item.isCoaster && (
                      <div className="mr-1 flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateRideCount(item.id, -1); }}
                          disabled={!visitStart || isUIFrozen || visitFinished || (item.rideCount || 0) === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-emerald-400">
                          {item.rideCount || 0}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateRideCount(item.id, 1); }}
                          disabled={!visitStart || isUIFrozen || visitFinished}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button onClick={() => toggleSkipItem(item.id)} disabled={!visitStart || visitFinished || isUIFrozen} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 shadow-sm hover:bg-slate-700 disabled:opacity-50">
                      Undo
                    </button>
                  </div>
                </motion.li>
              ))}
            </ul>
          </section>
        )}

        {/* Completed tasks */}
        {completedItems.length > 0 && (
          <section className="mb-6 rounded-2xl border border-slate-900/80 bg-slate-950/60 p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">Completed today</h2>
            <ul className="space-y-4">
              {completedItems.map((item) => {
                const isExpanded = expandedPhotos.includes(item.id);
                return (
                  <motion.li key={item.id} layout className="flex flex-col px-1 text-sm">
                    <div className={`flex items-center gap-2 text-slate-400 transition-opacity ${isUIFrozen ? 'opacity-50' : 'opacity-100'}`}>
                      <span className="text-emerald-400">✓</span>
                      <span className="flex-1 line-through">{item.label}</span>

                      {/* Ride Counter UI */}
                      {item.isCoaster && (
                        <div className="mr-1 flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateRideCount(item.id, -1); }}
                            disabled={!visitStart || isUIFrozen || visitFinished || (item.rideCount || 0) === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-emerald-400">
                            {item.rideCount || 0}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateRideCount(item.id, 1); }}
                            disabled={!visitStart || isUIFrozen || visitFinished}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      )}

                      {item.imageUrl && (
                        <button onClick={() => togglePhotoExpand(item.id)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700">
                          {isExpanded ? "Hide" : "View"}
                        </button>
                      )}

                      {!item.isPhotoTask && !visitFinished && (
                        <button onClick={() => toggleItem(item.id)} disabled={isUIFrozen} className="ml-1 px-2 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 disabled:opacity-50">
                          Undo
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {item.imageUrl && isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: "auto", opacity: 1, marginTop: 12 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden">
                          <div className="relative aspect-video w-full rounded-xl border border-slate-800 bg-slate-900">
                            <img src={item.imageUrl} alt="Uploaded task" className="absolute inset-0 h-full w-full rounded-xl object-cover" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="flex-1" />

        {/* Dynamic Bottom Bar */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-8 pt-4 sm:pb-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />

          <div className="pointer-events-auto relative w-full max-w-xl px-4">
            {!visitStart ? (
              <button onClick={handleBeginVisit} className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 text-base font-bold text-slate-950 shadow-xl shadow-emerald-500/20 transition-transform hover:bg-emerald-400 active:scale-[0.98]">
                Start Visit ⏱️
              </button>
            ) : !visitFinished ? (
              <button onClick={handleComplete} disabled={!allCompleted || isUIFrozen} className={`flex min-h-[56px] w-full items-center justify-center rounded-2xl px-4 text-base font-bold shadow-xl transition-all ${allCompleted && !isUIFrozen ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98]" : "bg-slate-800 text-slate-500 shadow-none"}`}>
                {allCompleted ? "Complete Visit 🎉" : "Complete all tasks to finish"}
              </button>
            ) : (
              <Link href={`/?modal=true&importChecklist=${checklist.slug}`} className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-blue-500 px-4 text-base font-bold text-white shadow-xl shadow-blue-500/20 transition-transform hover:bg-blue-400 active:scale-[0.98]">
                Draft Review 📝
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center">
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 shadow-2xl sm:scale-[0.98] sm:border sm:border-emerald-500/20">
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
                    {visitStart && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Started:</span>
                        <span className="font-bold text-slate-200">
                          {new Date(visitStart).toLocaleString('en-US', { timeStyle: "short" })}
                        </span>
                      </div>
                    )}
                    {visitEnd && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Finished:</span>
                        <span className="font-bold text-slate-200">
                          {new Date(visitEnd).toLocaleString('en-US', { timeStyle: "short" })}
                        </span>
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

                <button type="button" onClick={() => setShowCelebration(false)} className="relative z-10 min-h-[56px] w-full rounded-xl bg-emerald-500 px-4 text-base font-bold text-slate-950 transition-transform hover:bg-emerald-400 active:scale-[0.98]">
                  Back to dashboard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />
    </main>
  );
}