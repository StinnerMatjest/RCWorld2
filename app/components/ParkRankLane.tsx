"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { getRatingColor } from "@/app/utils/design";

interface Park {
  id: number;
  name: string;
  imagePath?: string;
  value: number;
}

interface Props {
  category: string;
  newParkName: string;
  initialRating?: number | null;   // undefined/null => start at 0.0
  newParkImageUrl?: string;
  onSetRating: (rating: number) => void;
}

const snapHalf = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, min = 0, max = 10) => Math.min(Math.max(v, min), max);
const NEW_PARK_ID = -1;

// Per-category caches to preserve order and ratings without reflow/flicker
const orderCache = new Map<string, Park[]>();
const ratingCache = new Map<string, number>();

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

  const label = useMemo(() => titleCase(category), [category]);

  // Load or hydrate list for this category
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
              imagePath: p.imagePath,
              value: r ? (r[category] ?? 0) : 0,
            } as Park;
          })
          .filter((p: Park) => p.value > 0)
          .sort((a: Park, b: Park) => b.value - a.value);

        // Determine starting value for this category: cached > prop > 0.0
        const base = ratingCache.get(category) ?? startVal ?? 0;
        const newEntry: Park = { id: NEW_PARK_ID, name: newParkName || "New Park", value: base };

        // If unrated (0), place at the very top; if rated, insert into correct position
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, startVal, newParkName]);

  const isNew = (p: Park) => p.id === NEW_PARK_ID;

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
    return clamp(next, 0, 10);
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

    // persist the visual order (with the new park's latest value)
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

  // Manual input (text so mobile can clear)
  const onManualChange = (text: string) => {
    setManualText(text);
    const normalized = text.replace(",", ".").trim();
    if (normalized === "") {
      // treat as 0.0 and move to top
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

    const raw = parseFloat(normalized);
    if (!Number.isFinite(raw)) return;

    const snapped = snapHalf(clamp(raw, 0, 10));
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

  const displayValue = (v: number) => v.toFixed(1); // always show 0.0 instead of dash

  return (
    <div className="relative flex flex-col items-center py-6 w-full">
      {/* Subtle blocking layer on first load to avoid any flicker */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg"
          >
            <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading…</div>
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

      <h2 className="text-xl font-bold mb-4 text-center">
        Drag <span className="text-blue-400">{newParkName || "your park"}</span> to assign {label}
      </h2>

      <Reorder.Group axis="y" values={order} onReorder={handleReorder} className="w-[360px] space-y-2 relative">
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
                ? { scale: 1.03, zIndex: 30, boxShadow: "0 0 12px rgba(0,150,255,0.65)" }
                : {}
            }
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className={`flex items-center justify-between px-3 py-2 rounded-lg shadow-md border select-none ${
              p.id === NEW_PARK_ID
                ? "bg-blue-600/90 text-white border-blue-400"
                : "bg-gray-800/70 border-gray-700 text-gray-100"
            }`}
            style={{ cursor: p.id === NEW_PARK_ID ? "grab" : "default", willChange: "transform" }}
          >
            <div className="flex items-center gap-3">
              {p.id !== NEW_PARK_ID && p.imagePath && (
                <img
                  src={p.imagePath}
                  alt={p.name}
                  className="w-8 h-8 object-cover rounded-md border border-gray-700"
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
            <motion.span
              layout="position"
              transition={{ type: "spring", stiffness: 600, damping: 35 }}
              className={`font-bold text-sm ${getRatingColor(p.id === NEW_PARK_ID ? currentRating : p.value)}`}
            >
              {displayValue(p.id === NEW_PARK_ID ? currentRating : p.value)}
            </motion.span>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {/* Assigned + manual numeric entry + spacer so it's never clipped */}
      <div className="mt-5 flex flex-col items-center">
        <div className="text-lg font-semibold text-blue-400 mb-2">
          Assigned: <span className="font-bold">{displayValue(currentRating)}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Enter value:</label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0 – 10"
            value={manualText}
            onChange={(e) => onManualChange(e.target.value)}
            className="w-24 p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-center"
          />
        </div>
      </div>

      {/* Spacer ensures the numeric input never sits at the very bottom edge */}
      <div className="h-16" />
    </div>
  );
};

export default ParkRankLane;
