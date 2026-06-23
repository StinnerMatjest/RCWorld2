"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { getRatingColor } from "@/app/utils/design";
import { MarkdownText } from "./MarkdownText";

interface Park {
  id: number;
  name: string;
  imagePath?: string;
  slug?: string;
  value: number;
}

interface Props {
  category: string;
  newParkName: string;
  initialRating?: number | null;   // undefined/null => start at 0.0
  newParkImageUrl?: string;
  onSetRating: (rating: number) => void;
}

const snapHalf = (v: number) => {
  const snapped = Math.round(v * 2) / 2;
  return snapped > 10 ? 10 : snapped;
};
const clamp = (v: number, min = 0, max = 11) => Math.min(Math.max(v, min), max);
const NEW_PARK_ID = -1;

// Per-category caches to preserve order and ratings without reflow/flicker
const orderCache = new Map<string, Park[]>();
const ratingCache = new Map<string, number>();
// Latest review texts per park — fetched once per modal session when peeked
const reviewPeekCache = new Map<number, { date: string | null; texts: Record<string, string> }>();

const titleCase = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const insertByValueDesc = (others: Park[], entry: Park) => {
  const idx = others.findIndex((p) => p.value < entry.value);
  if (idx === -1) return [...others, entry];
  return [...others.slice(0, idx), entry, ...others.slice(idx)];
};

const ParkRankLane: React.FC<Props> = ({
  category,
  newParkName,
  initialRating = null,
  newParkImageUrl,
  onSetRating,
}) => {
  const startVal = typeof initialRating === "number" ? initialRating : 0;
  const [order, setOrder] = useState<Park[]>(() => orderCache.get(category) ?? []);
  const [pending, setPending] = useState<boolean>(order.length === 0);
  const [currentRating, setCurrentRating] = useState<number>(ratingCache.get(category) ?? startVal);
  const [manualText, setManualText] = useState<string>(
    (ratingCache.get(category) ?? startVal) > 0 ? String(ratingCache.get(category) ?? startVal) : ""
  );
  const [savedToast, setSavedToast] = useState(false);

  // Review peek — read an existing park's review without leaving the modal
  const [peekPark, setPeekPark] = useState<Park | null>(null);
  const [peekData, setPeekData] = useState<{ date: string | null; texts: Record<string, string> } | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);

  async function openPeek(p: Park) {
    setPeekPark(p);
    const cached = reviewPeekCache.get(p.id);
    if (cached) { setPeekData(cached); return; }
    setPeekData(null);
    setPeekLoading(true);
    try {
      const rRes = await fetch(`/api/park/${p.id}/ratings`);
      const rJson = await rRes.json();
      const latest = rJson.ratings?.[0];
      const texts: Record<string, string> = {};
      if (latest?.id) {
        const tRes = await fetch(`/api/park/${p.id}/parkTexts?ratingId=${latest.id}`);
        if (tRes.ok) {
          for (const row of (await tRes.json()) ?? []) texts[row.category] = row.text;
        }
      }
      const data = { date: latest?.date ?? null, texts };
      reviewPeekCache.set(p.id, data);
      setPeekData(data);
    } catch {
      setPeekData({ date: null, texts: {} });
    } finally {
      setPeekLoading(false);
    }
  }

  const label = useMemo(() => titleCase(category), [category]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = orderCache.get(category);
      if (cached && cached.length > 0) {
        setOrder(cached);
        setPending(false);
        return;
      } else {
        setPending(true);
      }

      try {
        const [parksRes, ratingsRes] = await Promise.all([fetch("/api/parks"), fetch("/api/ratings")]);
        const parksJson = await parksRes.json();
        const ratingsJson = await ratingsRes.json();

        const existing: Park[] = parksJson.parks
          .map((p: any) => {
            const r = ratingsJson.ratings.find((x: any) => x.parkId === p.id);
            return {
              id: p.id,
              name: p.name,
              imagePath: p.cardImagepath || p.imagepath,
              slug: p.slug,
              value: r ? (r[category] ?? 0) : 0,
            } as Park;
          })
          .filter((p: Park) => p.value > 0)
          .sort((a: Park, b: Park) => b.value - a.value);

        const base = ratingCache.get(category) ?? startVal ?? 0;
        const newEntry: Park = { id: NEW_PARK_ID, name: newParkName || "New Park", value: base };

        const nextOrder = base > 0 ? insertByValueDesc(existing, newEntry) : [newEntry, ...existing];

        if (cancelled) return;

        setOrder(nextOrder);
        setPending(false);

        orderCache.set(category, nextOrder);
        ratingCache.set(category, base);
        setCurrentRating(base);
        setManualText(base > 0 ? String(base) : "");
      } catch {
        if (!cancelled) setPending(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [category, startVal, newParkName]);

  const calcRatingFromNeighbors = (arr: Park[]) => {
    const idx = arr.findIndex((p) => p.id === NEW_PARK_ID);
    if (idx === -1) return currentRating;
    const higher = arr[idx - 1];
    const lower = arr[idx + 1];

    if (!higher && !lower) return currentRating;

    let next = currentRating;
    if (higher && lower) next = snapHalf((higher.value + lower.value) / 2);
    else if (higher) next = snapHalf(higher.value + 0.5);
    else if (lower) next = snapHalf(lower.value - 0.5);
    return snapHalf(clamp(next, 0, 11));
  };

  const handleReorder = (next: Park[]) => {
    setOrder(next);
    const live = calcRatingFromNeighbors(next);
    if (live !== currentRating) {
      setCurrentRating(live);
      setManualText(live > 0 ? String(live) : "");
      ratingCache.set(category, live);
    }
  };

  const commitCurrentRating = () => {
    setOrder((prev) => prev.map((p) => (p.id === NEW_PARK_ID ? { ...p, value: currentRating } : p)));
    onSetRating(currentRating);
    ratingCache.set(category, currentRating);

    const finalOrder = (prev: Park[]) => {
      const others = prev.filter((p) => p.id !== NEW_PARK_ID);
      const entry: Park = { id: NEW_PARK_ID, name: newParkName || "New Park", value: currentRating };
      return insertByValueDesc(others, entry);
    };
    setOrder(finalOrder);
    orderCache.set(category, finalOrder(order));
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 900);
  };

  const handleInputChange = (text: string) => {
    setManualText(text);
  };

  const handleInputCommit = () => {
    const normalized = manualText.toUpperCase().trim().replace(",", ".");

    if (normalized === "G" || normalized === "11") {
      const special = 11;
      setManualText("11");
      setCurrentRating(special);
      ratingCache.set(category, special);

      setOrder((prev) => {
        const others = prev.filter((p) => p.id !== NEW_PARK_ID);
        const newEntry: Park = { id: NEW_PARK_ID, name: newParkName || "New Park", value: special };
        const next = insertByValueDesc(others, newEntry);
        orderCache.set(category, next);
        return next;
      });

      onSetRating(special);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 900);
      return;
    }

    if (normalized === "") {
      setManualText("");
      setCurrentRating(0);
      ratingCache.set(category, 0);

      setOrder((prev) => {
        const others = prev.filter((p) => p.id !== NEW_PARK_ID);
        const next = [{ id: NEW_PARK_ID, name: newParkName || "New Park", value: 0 }, ...others];
        orderCache.set(category, next);
        return next;
      });

      onSetRating(0);
      return;
    }

    const num = parseFloat(normalized);
    if (!Number.isFinite(num)) return;

    const snapped = snapHalf(clamp(num, 0.5, 10));
    setManualText(snapped.toFixed(1));
    setCurrentRating(snapped);
    ratingCache.set(category, snapped);

    setOrder((prev) => {
      const others = prev.filter((p) => p.id !== NEW_PARK_ID);
      const newEntry: Park = { id: NEW_PARK_ID, name: newParkName || "New Park", value: snapped };
      const next = insertByValueDesc(others, newEntry);
      orderCache.set(category, next);
      return next;
    });

    onSetRating(snapped);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 900);
  };

  const displayValue = (v: number) => v.toFixed(1);

  return (
    <div className="relative flex flex-col items-center py-6 w-full">
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg"
          >
            <div className="animate-pulse text-slate-400">Loading…</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {savedToast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs px-2 py-1 rounded-md shadow z-30"
          >
            ✓ Saved
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="text-xl font-bold mb-4 text-center text-slate-200">
        Drag <span className="text-blue-400">{newParkName || "your park"}</span> to assign {label}
      </h2>

      <Reorder.Group axis="y" values={order} onReorder={handleReorder} className="w-full max-w-[360px] space-y-2 relative">
        {order.map((p) => (
          <Reorder.Item
            key={p.id}
            value={p}
            drag="y"
            dragListener={p.id === NEW_PARK_ID}
            dragMomentum={false}
            onDragEnd={commitCurrentRating}
            layout="position"
            layoutScroll
            whileDrag={
              p.id === NEW_PARK_ID
                ? { scale: 1.03, zIndex: 30, boxShadow: "0 0 12px rgba(96,165,250,0.65)" }
                : {}
            }
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            onClick={p.id !== NEW_PARK_ID ? () => openPeek(p) : undefined}
            title={p.id !== NEW_PARK_ID ? `Read the ${label} review for ${p.name}` : undefined}
            className={`group flex items-center justify-between px-3 py-2 lg:px-4 lg:py-3 rounded-lg shadow-md border select-none ${p.id === NEW_PARK_ID
              ? "bg-blue-600/90 text-white border-blue-400"
              : "bg-slate-800/70 border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors"
              }`}

            style={{ cursor: p.id === NEW_PARK_ID ? "grab" : "pointer", willChange: "transform" }}
          >
            <div className="flex items-center gap-3">
              {p.id !== NEW_PARK_ID && p.imagePath && (
                <Image
                  src={p.imagePath}
                  alt={p.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-cover rounded-md border border-slate-700"
                  draggable={false}
                />
              )}
              {p.id === NEW_PARK_ID && newParkImageUrl && (
                <img
                  src={newParkImageUrl}
                  alt={newParkName || "New Park"}
                  className="w-8 h-8 object-cover rounded-md border border-blue-300"
                  draggable={false}
                />
              )}
              <span className="font-medium">{p.id === NEW_PARK_ID ? (newParkName || p.name) : p.name}</span>
            </div>
            <div className="flex items-center gap-2.5">
              {p.id !== NEW_PARK_ID && (
                <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
                  📖
                </span>
              )}
              <motion.span
                layout="position"
                transition={{ type: "spring", stiffness: 600, damping: 35 }}
                className={`font-bold text-sm lg:text-lg ${getRatingColor(p.id === NEW_PARK_ID ? currentRating : p.value)}`}
              >
                {displayValue(p.id === NEW_PARK_ID ? currentRating : p.value)}
              </motion.span>
            </div>

          </Reorder.Item>
        ))}
      </Reorder.Group>

      <div className="mt-5 flex flex-col items-center">
        <div className="flex items-center gap-2 text-base lg:text-lg">
          <label className="text-sm text-slate-400 lg:text-lg">Enter value:</label>
          <input
            type="text"                  // allows letters
            inputMode="decimal"          // numeric keyboard on mobile
            autoComplete="off"
            placeholder="0 – 10 or G"
            value={manualText}
            onChange={(e) => handleInputChange(e.target.value)} // free typing
            onBlur={handleInputCommit}                         // snap & update on leaving input
            onKeyDown={(e) => e.key === "Enter" && handleInputCommit()} // snap & update on Enter
            className="w-24 p-2 rounded-md border border-slate-700 bg-slate-800 text-slate-200 text-center focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>
      <div className="h-16" />

      {/* Review peek — portalled to <body>: the modal's transformed ancestors
          would otherwise re-anchor position:fixed and strand the sheet off-screen */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {peekPark && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPeekPark(null)} />
              <motion.div
                initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="relative flex max-h-[80dvh] w-full flex-col rounded-t-3xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-h-[75vh] sm:max-w-lg sm:rounded-3xl"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                {/* Drag-handle hint (mobile) */}
                <div className="flex justify-center pt-2.5 sm:hidden">
                  <div className="h-1 w-10 rounded-full bg-slate-700" />
                </div>

                {/* Header */}
                <div className="flex items-start gap-3 border-b border-slate-800 px-5 py-3.5 sm:py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="truncate text-lg font-black text-white">{peekPark.name}</p>
                    {peekData?.date && (
                      <p className="text-xs text-slate-500">
                        Latest visit · {new Date(peekData.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <span className={`text-3xl font-black tabular-nums ${getRatingColor(peekPark.value)}`}>
                    {displayValue(peekPark.value)}
                  </span>
                  <button
                    onClick={() => setPeekPark(null)}
                    className="-mr-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                  {peekLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-slate-800" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
                    </div>
                  ) : peekData?.texts[category]?.trim() ? (
                    <MarkdownText text={peekData.texts[category]} className="text-sm leading-relaxed text-slate-300" />
                  ) : (
                    <p className="text-sm italic text-slate-500">
                      No written review for {label.toLowerCase()} yet.
                    </p>
                  )}
                </div>

                {/* Footer */}
                {peekPark.slug && (
                  <div className="border-t border-slate-800 px-5 py-3">
                    <a href={`/park/${peekPark.slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                      Open full review ↗
                    </a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default ParkRankLane;