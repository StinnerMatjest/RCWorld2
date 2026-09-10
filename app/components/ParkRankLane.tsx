"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { getRatingColor } from "@/app/utils/design";
import { MarkdownText } from "./MarkdownText";
import { R2Image } from "./R2Image";

/** Brief coaster facts shown in the peek sheets. */
interface CoasterInfo {
  id: number;
  name: string;
  slug?: string;
  rating: number;
  haveRidden: boolean;
  parkId: number;
  parkName?: string;
  image?: string | null;
  manufacturerName?: string | null;
  model?: string | null;
  year?: number | null;
  specs: {
    type?: string | null;
    length?: number | string | null;
    height?: number | string | null;
    drop?: number | string | null;
    speed?: number | string | null;
    inversions?: number | string | null;
    duration?: number | string | null;
  };
}

/** One row in the lane: an existing park, an existing coaster, or the park being rated. */
interface LaneItem {
  id: number;
  name: string;
  subtitle?: string;
  imagePath?: string;
  slug?: string;
  value: number;
  coaster?: CoasterInfo;
}

interface Props {
  category: string;
  newParkName: string;
  initialRating?: number | null;   // undefined/null => start at 0.0
  newParkImageUrl?: string;
  /** Park being rated; its own coasters are left out of the Best Coaster lane. */
  excludeParkId?: number | null;
  onSetRating: (rating: number) => void;
}

const MAX_REGULAR = 10;   // highest normal score
const GOAT = 11;          // special "G" score, only reachable by tying with / topping a GOAT

const snapHalf = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, min = 0, max = GOAT) => Math.min(Math.max(v, min), max);

/**
 * Legal scores are 0–10 in half steps, plus 11 as the special GOAT score.
 * Anything strictly between 10 and 11 is not a real score: it falls back to 10.
 */
const legalize = (v: number) => {
  const c = clamp(v);
  if (c >= GOAT) return GOAT;
  return Math.min(snapHalf(c), MAX_REGULAR);
};

const NEW_PARK_ID = -1;

// Per-category caches to preserve order and ratings without reflow/flicker
const orderCache = new Map<string, LaneItem[]>();
const ratingCache = new Map<string, number>();
// Latest review texts per park — fetched once per modal session when peeked
const reviewPeekCache = new Map<number, { date: string | null; texts: Record<string, string> }>();
// Coaster line-ups per park for the Coaster Depth peek
const parkCoastersCache = new Map<number, CoasterInfo[]>();

/** Forget everything cached from a previous rating session. */
export function clearRankLaneCaches() {
  orderCache.clear();
  ratingCache.clear();
  reviewPeekCache.clear();
  parkCoastersCache.clear();
}

const titleCase = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const insertByValueDesc = (others: LaneItem[], entry: LaneItem) => {
  const idx = others.findIndex((p) => p.value < entry.value);
  if (idx === -1) return [...others, entry];
  return [...others.slice(0, idx), entry, ...others.slice(idx)];
};

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtStat = (v: unknown, unit?: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const text = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return unit ? `${text} ${unit}` : text;
};

const normalizeCoaster = (c: any): CoasterInfo => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  rating: toNum(c.rating),
  haveRidden: Boolean(c.haveRidden ?? c.haveridden),
  parkId: c.parkId,
  parkName: c.parkName,
  image: typeof c.image === "string" && c.image ? c.image : null,
  manufacturerName: c.manufacturerName,
  model: c.model && c.model !== "Unknown" ? c.model : null,
  year: c.year,
  specs: c.specs ?? {},
});

/** Label/value pairs for a coaster, skipping anything unknown. */
const coasterFacts = (c: CoasterInfo, includePark: boolean) => {
  const maker = [c.manufacturerName, c.model].filter(Boolean).join(" · ");
  const facts: [string, string][] = [];
  if (includePark && c.parkName) facts.push(["Park", c.parkName]);
  if (maker) facts.push(["Manufacturer", maker]);
  if (c.year && c.year > 1800) facts.push(["Opened", String(c.year)]);
  if (c.specs.type) facts.push(["Type", String(c.specs.type)]);
  const length = fmtStat(c.specs.length, "ft"); if (length) facts.push(["Length", length]);
  const height = fmtStat(c.specs.height, "ft"); if (height) facts.push(["Height", height]);
  const drop = fmtStat(c.specs.drop, "ft"); if (drop) facts.push(["Drop", drop]);
  const speed = fmtStat(c.specs.speed, "mph"); if (speed) facts.push(["Speed", speed]);
  if (c.specs.inversions != null && c.specs.inversions !== "") facts.push(["Inversions", String(c.specs.inversions)]);
  const duration = fmtStat(c.specs.duration, "sec"); if (duration) facts.push(["Duration", duration]);
  return facts;
};

/** One-line summary used in the Coaster Depth list. */
const coasterSummary = (c: CoasterInfo) => {
  const bits = [
    c.manufacturerName,
    fmtStat(c.specs.speed, "mph"),
    fmtStat(c.specs.height, "ft"),
    c.specs.inversions != null && c.specs.inversions !== "" ? `${c.specs.inversions} inv` : null,
  ].filter(Boolean);
  return bits.join(" · ");
};

const ParkRankLane: React.FC<Props> = ({
  category,
  newParkName,
  initialRating = null,
  newParkImageUrl,
  excludeParkId = null,
  onSetRating,
}) => {
  const isCoasterLane = category === "bestCoaster";
  const isDepthLane = category === "coasterDepth";

  const startVal = typeof initialRating === "number" ? initialRating : 0;
  const [order, setOrder] = useState<LaneItem[]>(() => orderCache.get(category) ?? []);
  const [pending, setPending] = useState<boolean>(order.length === 0);
  const [currentRating, setCurrentRating] = useState<number>(ratingCache.get(category) ?? startVal);
  const [manualText, setManualText] = useState<string>(
    (ratingCache.get(category) ?? startVal) > 0 ? String(ratingCache.get(category) ?? startVal) : ""
  );
  const [savedToast, setSavedToast] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Peek sheet — read an existing park's review / a coaster's stats without leaving the modal
  const [peekItem, setPeekItem] = useState<LaneItem | null>(null);
  const [peekData, setPeekData] = useState<{ date: string | null; texts: Record<string, string> } | null>(null);
  const [peekCoasters, setPeekCoasters] = useState<CoasterInfo[] | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);

  async function loadReview(p: LaneItem) {
    const cached = reviewPeekCache.get(p.id);
    if (cached) return cached;
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
    return data;
  }

  async function loadParkCoasters(parkId: number) {
    const cached = parkCoastersCache.get(parkId);
    if (cached) return cached;
    const res = await fetch(`/api/park/${parkId}/coasters`);
    const json = await res.json();
    const list: CoasterInfo[] = (Array.isArray(json) ? json : [])
      .map(normalizeCoaster)
      .sort((a, b) => {
        // rated first (high to low), then ridden-but-unrated, then unridden, alphabetical within
        if (a.rating !== b.rating) return b.rating - a.rating;
        if (a.haveRidden !== b.haveRidden) return a.haveRidden ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    parkCoastersCache.set(parkId, list);
    return list;
  }

  async function openPeek(p: LaneItem) {
    setPeekItem(p);
    setPeekData(null);
    setPeekCoasters(null);

    // Coaster rows carry their stats already — nothing to fetch.
    if (p.coaster) return;

    setPeekLoading(true);
    try {
      if (isDepthLane) {
        const [coasters, review] = await Promise.all([loadParkCoasters(p.id), loadReview(p)]);
        setPeekCoasters(coasters);
        setPeekData(review);
      } else {
        setPeekData(await loadReview(p));
      }
    } catch {
      setPeekData({ date: null, texts: {} });
      if (isDepthLane) setPeekCoasters([]);
    } finally {
      setPeekLoading(false);
    }
  }

  const label = useMemo(() => titleCase(category), [category]);

  useEffect(() => {
    let cancelled = false;

    async function loadParks(): Promise<LaneItem[]> {
      const [parksRes, ratingsRes] = await Promise.all([fetch("/api/parks"), fetch("/api/ratings")]);
      if (!parksRes.ok || !ratingsRes.ok) throw new Error("parks/ratings request failed");
      const parksJson = await parksRes.json();
      const ratingsJson = await ratingsRes.json();

      return parksJson.parks
        .map((p: any) => {
          const r = ratingsJson.ratings.find((x: any) => x.parkId === p.id);
          return {
            id: p.id,
            name: p.name,
            imagePath: p.cardImagepath || p.imagepath,
            slug: p.slug,
            value: r ? toNum(r[category]) : 0,
          } as LaneItem;
        })
        .filter((p: LaneItem) => p.value > 0)
        .sort((a: LaneItem, b: LaneItem) => b.value - a.value);
    }

    async function loadCoasters(): Promise<LaneItem[]> {
      const res = await fetch("/api/coasters");
      if (!res.ok) throw new Error("coasters request failed");
      const json = await res.json();
      const list = Array.isArray(json) ? json : Array.isArray(json?.coasters) ? json.coasters : null;
      if (!list) throw new Error("unexpected coasters response");
      return list
        .map(normalizeCoaster)
        .filter((c: CoasterInfo) => c.rating > 0 && c.parkId !== excludeParkId)
        .sort((a: CoasterInfo, b: CoasterInfo) => b.rating - a.rating || a.name.localeCompare(b.name))
        .map((c: CoasterInfo) => ({
          id: c.id,
          name: c.name,
          subtitle: c.parkName,
          imagePath: c.image ?? undefined,
          slug: c.slug,
          value: c.rating,
          coaster: c,
        } as LaneItem));
    }

    async function load() {
      // A cached order holding only the park being rated means an earlier load
      // failed — try again rather than showing an empty lane.
      const cached = orderCache.get(category);
      if (cached && cached.length > 1) {
        setOrder(cached);
        setPending(false);
        return;
      } else {
        setPending(true);
      }
      setLoadError(false);

      try {
        const existing = isCoasterLane ? await loadCoasters() : await loadParks();
        if (existing.length === 0) throw new Error("empty list");

        const base = ratingCache.get(category) ?? startVal ?? 0;
        const newEntry: LaneItem = { id: NEW_PARK_ID, name: newParkName || "New Park", value: base };

        const nextOrder = base > 0 ? insertByValueDesc(existing, newEntry) : [newEntry, ...existing];

        if (cancelled) return;

        setOrder(nextOrder);
        setPending(false);

        orderCache.set(category, nextOrder);
        ratingCache.set(category, base);
        setCurrentRating(base);
        setManualText(base > 0 ? String(base) : "");
      } catch {
        if (cancelled) return;
        const base = ratingCache.get(category) ?? startVal ?? 0;
        setOrder((prev) => (prev.length ? prev : [{ id: NEW_PARK_ID, name: newParkName || "New Park", value: base }]));
        setLoadError(true);
        setPending(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [category, startVal, newParkName, isCoasterLane, excludeParkId, retryKey]);

  /**
   * Score implied by where the dragged entry sits:
   *  - between two neighbours: their midpoint
   *  - at the top: half a step above the one below it
   *  - at the bottom: half a step below the one above it
   * then legalized (see `legalize`) so the entry stays where it was dropped.
   */
  const calcRatingFromNeighbors = (arr: LaneItem[]) => {
    const idx = arr.findIndex((p) => p.id === NEW_PARK_ID);
    if (idx === -1) return currentRating;
    const higher = arr[idx - 1];
    const lower = arr[idx + 1];

    if (!higher && !lower) return currentRating;

    let next = currentRating;
    if (higher && lower) next = (higher.value + lower.value) / 2;
    else if (lower) next = lower.value + 0.5;          // dropped at the very top
    else if (higher) next = higher.value - 0.5;        // dropped at the very bottom
    return legalize(next);
  };

  const handleReorder = (next: LaneItem[]) => {
    setOrder(next);
    const live = calcRatingFromNeighbors(next);
    if (live !== currentRating) {
      setCurrentRating(live);
      setManualText(live > 0 ? String(live) : "");
      ratingCache.set(category, live);
    }
  };

  // After a drag the entry keeps the slot it was dropped in. Its score is always
  // consistent with both neighbours (ties allowed), so no re-sort is needed and
  // the entry no longer jumps away from where the user put it.
  const commitCurrentRating = () => {
    setOrder((prev) => {
      const next = prev.map((p) => (p.id === NEW_PARK_ID ? { ...p, value: currentRating } : p));
      orderCache.set(category, next);
      return next;
    });
    onSetRating(currentRating);
    ratingCache.set(category, currentRating);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 900);
  };

  const handleInputChange = (text: string) => {
    setManualText(text);
  };

  /** Typed scores re-sort the lane so the entry lands among its equals. */
  const applyTypedRating = (value: number) => {
    setCurrentRating(value);
    ratingCache.set(category, value);

    setOrder((prev) => {
      const others = prev.filter((p) => p.id !== NEW_PARK_ID);
      const newEntry: LaneItem = { id: NEW_PARK_ID, name: newParkName || "New Park", value };
      const next = value > 0 ? insertByValueDesc(others, newEntry) : [newEntry, ...others];
      orderCache.set(category, next);
      return next;
    });

    onSetRating(value);
  };

  const handleInputCommit = () => {
    const normalized = manualText.toUpperCase().trim().replace(",", ".");

    if (normalized === "G" || normalized === String(GOAT)) {
      setManualText(String(GOAT));
      applyTypedRating(GOAT);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 900);
      return;
    }

    if (normalized === "") {
      setManualText("");
      applyTypedRating(0);
      return;
    }

    const num = parseFloat(normalized);
    if (!Number.isFinite(num)) return;

    const snapped = snapHalf(clamp(num, 0, MAX_REGULAR));
    setManualText(snapped.toFixed(1));
    applyTypedRating(snapped);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 900);
  };

  const displayValue = (v: number) => v.toFixed(1);

  const heading = isCoasterLane ? (
    <>Drag <span className="text-blue-400">{newParkName || "your park"}</span> to where its best coaster ranks</>
  ) : (
    <>Drag <span className="text-blue-400">{newParkName || "your park"}</span> to assign {label}</>
  );

  const rowTitle = (p: LaneItem) => {
    if (p.id === NEW_PARK_ID) return undefined;
    if (p.coaster) return `Stats for ${p.name}`;
    if (isDepthLane) return `Coaster line-up for ${p.name}`;
    return `Read the ${label} review for ${p.name}`;
  };

  // ---- Peek sheet body variants ----

  const ratedPeekCoasters = (peekCoasters ?? []).filter((c) => c.rating > 0);
  const peekAverage = ratedPeekCoasters.length
    ? ratedPeekCoasters.reduce((sum, c) => sum + c.rating, 0) / ratedPeekCoasters.length
    : null;

  const renderCoasterStats = (c: CoasterInfo) => {
    const facts = coasterFacts(c, true);
    const photo = c.image ? (
      <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-800">
        <R2Image src={c.image} alt={c.name} fill sizes="(max-width: 640px) 100vw, 512px" className="object-cover" draggable={false} />
      </div>
    ) : null;
    return facts.length ? (
      <>{photo}<dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">{k}</dt>
            <dd className="truncate text-sm font-semibold text-slate-200" title={v}>{v}</dd>
          </div>
        ))}
      </dl></>
    ) : (
      <>{photo}<p className="text-sm italic text-slate-500">No stats recorded for this coaster yet.</p></>
    );
  };

  const renderDepthOverview = () => {
    if (!peekCoasters) return null;
    if (peekCoasters.length === 0) {
      return <p className="text-sm italic text-slate-500">No coasters recorded for this park.</p>;
    }
    const ridden = peekCoasters.filter((c) => c.haveRidden).length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800/60 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Coasters</p>
            <p className="text-lg font-black text-white">{peekCoasters.length}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ridden</p>
            <p className="text-lg font-black text-white">{ridden}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Average</p>
            <p className={`text-lg font-black tabular-nums ${peekAverage != null ? getRatingColor(peekAverage) : "text-slate-500"}`}>
              {peekAverage != null ? peekAverage.toFixed(1) : "–"}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/40">
          {peekCoasters.map((c) => {
            const summary = coasterSummary(c);
            return (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${c.haveRidden ? "text-slate-100" : "text-slate-400"}`}>
                    {c.name}
                    {!c.haveRidden && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">not ridden</span>}
                  </p>
                  {summary && <p className="truncate text-xs text-slate-500">{summary}</p>}
                </div>
                <span className={`text-base font-black tabular-nums ${c.rating > 0 ? getRatingColor(c.rating) : "text-slate-600"}`}>
                  {c.rating > 0 ? c.rating.toFixed(1) : "–"}
                </span>
              </li>
            );
          })}
        </ul>

        {peekData?.texts[category]?.trim() && (
          <div className="border-t border-slate-800 pt-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Your {label.toLowerCase()} review</p>
            <MarkdownText text={peekData.texts[category]} className="text-sm leading-relaxed text-slate-300" />
          </div>
        )}
      </div>
    );
  };

  const renderPeekBody = () => {
    if (peekItem?.coaster) return renderCoasterStats(peekItem.coaster);
    if (peekLoading) {
      return (
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
        </div>
      );
    }
    if (isDepthLane) return renderDepthOverview();
    if (peekData?.texts[category]?.trim()) {
      return <MarkdownText text={peekData.texts[category]} className="text-sm leading-relaxed text-slate-300" />;
    }
    return (
      <p className="text-sm italic text-slate-500">
        No written review for {label.toLowerCase()} yet.
      </p>
    );
  };

  const peekHref = peekItem?.coaster
    ? (peekItem.slug ? `/coasters/${peekItem.slug}` : null)
    : (peekItem?.slug ? `/park/${peekItem.slug}` : null);

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

      <h2 className="text-xl font-bold mb-4 text-center text-slate-200">{heading}</h2>

      {loadError && !pending && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span>Couldn&apos;t load the {isCoasterLane ? "coasters" : "parks"} to compare against.</span>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="ml-auto rounded-md bg-amber-500/20 px-2.5 py-1 font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

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
            title={rowTitle(p)}
            className={`group flex items-center justify-between px-3 py-2 lg:px-4 lg:py-3 rounded-lg shadow-md border select-none ${p.id === NEW_PARK_ID
              ? "bg-blue-600/90 text-white border-blue-400"
              : "bg-slate-800/70 border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors"
              }`}

            style={{ cursor: p.id === NEW_PARK_ID ? "grab" : "pointer", willChange: "transform" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {p.id !== NEW_PARK_ID && p.imagePath && p.coaster && (
                <R2Image
                  src={p.imagePath}
                  alt={p.name}
                  width={32}
                  height={32}
                  sizes="64px"
                  className="w-8 h-8 object-cover rounded-md border border-slate-700 flex-shrink-0"
                  draggable={false}
                />
              )}
              {p.id !== NEW_PARK_ID && p.imagePath && !p.coaster && (
                <Image
                  src={p.imagePath}
                  alt={p.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-cover rounded-md border border-slate-700 flex-shrink-0"
                  draggable={false}
                />
              )}
              {p.id !== NEW_PARK_ID && p.coaster && !p.imagePath && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-base" aria-hidden>
                  🎢
                </div>
              )}
              {p.id === NEW_PARK_ID && newParkImageUrl && (
                <img
                  src={newParkImageUrl}
                  alt={newParkName || "New Park"}
                  className="w-8 h-8 object-cover rounded-md border border-blue-300 flex-shrink-0"
                  draggable={false}
                />
              )}
              <div className="min-w-0">
                <span className="block truncate font-medium">{p.id === NEW_PARK_ID ? (newParkName || p.name) : p.name}</span>
                {p.subtitle && <span className="block truncate text-[11px] text-slate-400">{p.subtitle}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {p.id !== NEW_PARK_ID && (
                <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
                  {p.coaster || isDepthLane ? "ℹ️" : "📖"}
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

      {/* Peek sheet — portalled to <body>: the modal's transformed ancestors
          would otherwise re-anchor position:fixed and strand the sheet off-screen */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {peekItem && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPeekItem(null)} />
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {peekItem.coaster ? "Coaster" : label}
                    </p>
                    <p className="truncate text-lg font-black text-white">{peekItem.name}</p>
                    {peekItem.coaster?.parkName && (
                      <p className="truncate text-xs text-slate-500">{peekItem.coaster.parkName}</p>
                    )}
                    {!peekItem.coaster && peekData?.date && (
                      <p className="text-xs text-slate-500">
                        Latest visit · {new Date(peekData.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <span className={`text-3xl font-black tabular-nums ${getRatingColor(peekItem.value)}`}>
                    {displayValue(peekItem.value)}
                  </span>
                  <button
                    onClick={() => setPeekItem(null)}
                    className="-mr-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                  {renderPeekBody()}
                </div>

                {/* Footer */}
                {peekHref && (
                  <div className="border-t border-slate-800 px-5 py-3">
                    <a href={peekHref} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                      {peekItem.coaster ? "Open coaster page ↗" : "Open full review ↗"}
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
