"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
  useRef,
  UIEvent,
  useLayoutEffect,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { RatingWarningType, Rating, Park } from "@/app/types";
import RatingCard from "./components/RatingCard";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";
import { useSearch } from "./context/SearchContext";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "./components/LoadingSpinner";
import { getParkFlag, getRatingColor } from "@/app/utils/design";

const DOTS_OFFSET = 10;

const PendingParkCard = ({ park }: { park: Park }) => (
  <Link
    href={`/?modal=true&pendingParkId=${park.id}`}
    className="mx-auto flex flex-col justify-between w-full max-w-[400px] py-3 md:py-4 h-full animate-fade-in-up"
  >
    <div className="flex flex-col justify-center items-center text-center w-full h-full min-h-[450px] bg-slate-50 dark:bg-[#1e293b]/40 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all duration-300 p-6 shadow-sm group cursor-pointer">
      <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">⏳</span>
      </div>
      <h3 className="text-[1.75rem] font-bold text-slate-900 dark:text-white mb-4 px-2">{park.name}</h3>
      <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wider">
        Pending Setup
      </span>
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400 font-medium">Click to finish setting up park details and log your first rating.</p>
    </div>
  </Link>
);


const TeaserParkCard = ({ rating, park }: { rating: Rating; park: Park }) => (
  <div className="mx-auto w-full max-w-[400px] py-3 md:py-4 animate-fade-in-up">
    <div className="relative rounded-2xl overflow-hidden min-h-[500px] bg-gray-900 shadow-md dark:shadow-lg">
      {/* Full-bleed image */}
      <Image src={park.imagepath || "/images/error.PNG"} alt={park.name} fill className="object-cover opacity-70" unoptimized />

      {/* Top: park name */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent px-4 pt-4 pb-14">
        <div className="flex items-center gap-2">
          <Image src={getParkFlag(park.country)} alt="" width={20} height={14} className="rounded-sm shrink-0" unoptimized />
          <h1 className="text-white font-bold text-xl leading-tight drop-shadow-md">{park.name}</h1>
        </div>
      </div>

      {/* Bottom: score + CTA */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-5 pt-20 pb-5 flex flex-col items-center gap-3">
        <span className={`text-[4rem] font-black tabular-nums leading-none drop-shadow-xl ${getRatingColor(rating.overall)}`}>
          {rating.overall.toFixed(2)}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Review in progress</span>
        </div>

        <p className="text-[11px] text-center text-white/50 leading-relaxed">
          Follow us to know when the full review drops.
        </p>

        <a
          href="https://www.instagram.com/parkratings/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:opacity-90 transition-opacity shadow-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          @parkratings
        </a>
      </div>
    </div>
  </div>
);

const avg = (a: number, b: number) => ((a + b) / 2).toFixed(2);

const FULL_BLEED_GROUPS = [
  { emoji: "🎢", label: "Coasters", getValue: (r: Rating) => avg(r.bestCoaster, r.coasterDepth) },
  { emoji: "🎡", label: "Rides",    getValue: (r: Rating) => avg(r.waterRides, r.flatridesAndDarkrides) },
  { emoji: "🏞️", label: "Park",     getValue: (r: Rating) => avg(r.parkAppearance, r.parkPracticality) },
  { emoji: "🍔", label: "Food",     getValue: (r: Rating) => avg(r.food, r.snacksAndDrinks) },
  { emoji: "📋", label: "Mgmt",     getValue: (r: Rating) => avg(r.rideOperations, r.parkManagement) },
];

const CARD_CATS = ["coasters", "rides", "park", "food", "mgmt"] as const;
type CardCat = typeof CARD_CATS[number];

function FullBleedRatingCard({ rating, park, isActive = false }: { rating: Rating; park: Park; isActive?: boolean }) {
  const headerSrc   = park.imagepath || "/images/error.PNG";
  const headerFocus = park.imageFocus ?? "50% 50%";

  const getCardEntry = useCallback((label: string): { src: string; focus: string } | null => {
    const key = label.toLowerCase() as CardCat;
    const entry = park.cardImages?.[key];
    if (entry?.src) return entry;
    if (key === "coasters") return { src: headerSrc, focus: headerFocus };
    return null;
  }, [park.cardImages, headerSrc, headerFocus]);

  const getCycleImages = useCallback(() =>
    FULL_BLEED_GROUPS
      .map(g => { const e = getCardEntry(g.label); return e ? { label: g.label, ...e } : null; })
      .filter((x): x is { label: string; src: string; focus: string } => x !== null),
  [getCardEntry]);

  // Two-slot cross-fade — both slots always sum to opacity 0.7, no black ever shows
  const slotARef      = useRef<HTMLImageElement>(null);
  const slotBRef      = useRef<HTMLImageElement>(null);
  const activeSlotRef = useRef<"A" | "B">("A");
  const raf1Ref       = useRef<number | null>(null);
  const raf2Ref       = useRef<number | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useLayoutEffect(() => {
    const a = slotARef.current;
    const b = slotBRef.current;
    if (!a || !b) return;
    a.src = headerSrc; a.style.objectPosition = headerFocus; a.style.opacity = "0.88"; a.style.transition = "none";
    b.src = headerSrc; b.style.objectPosition = headerFocus; b.style.opacity = "0";   b.style.transition = "none";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isHoveringRef = useRef(false);
  const hoveredCatRef = useRef<string | null>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleFirstRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleIdxRef   = useRef(0);
  const cycleListRef  = useRef<{ label: string; src: string; focus: string }[]>([]);

  const cancelInFlight = useCallback(() => {
    if (raf1Ref.current) { cancelAnimationFrame(raf1Ref.current); raf1Ref.current = null; }
    if (raf2Ref.current) { cancelAnimationFrame(raf2Ref.current); raf2Ref.current = null; }
    // Snap slots back to a clean state so the next transition always starts correctly
    const activeEl   = (activeSlotRef.current === "A" ? slotARef : slotBRef).current;
    const inactiveEl = (activeSlotRef.current === "A" ? slotBRef : slotARef).current;
    if (activeEl)   { activeEl.style.transition = "none";   activeEl.style.opacity = "0.88"; }
    if (inactiveEl) { inactiveEl.style.transition = "none"; inactiveEl.style.opacity = "0"; }
    [slotARef, slotBRef].forEach(r => { if (r.current) { r.current.onload = null; r.current.onerror = null; } });
  }, []);

  const transitionTo = useCallback((entry: { src: string; focus: string } | null, label: string | null) => {
    cancelInFlight();
    setActiveLabel(label);

    const target = entry ?? { src: headerSrc, focus: headerFocus };
    const [inactiveRef, activeRef, nextSlot] = activeSlotRef.current === "A"
      ? [slotBRef, slotARef, "B" as const]
      : [slotARef, slotBRef, "A" as const];

    const inactive = inactiveRef.current;
    const active   = activeRef.current;
    if (!inactive || !active) return;

    inactive.src = target.src;
    inactive.style.objectPosition = target.focus;
    // Already at opacity 0 (reset by cancelInFlight), transition stays "none"

    const startFade = () => {
      inactive.onload = null;
      inactive.onerror = null;
      raf1Ref.current = requestAnimationFrame(() => {
        raf2Ref.current = requestAnimationFrame(() => {
          inactive.style.transition = "opacity 700ms ease-in-out";
          inactive.style.opacity    = "0.88";
          active.style.transition   = "opacity 700ms ease-in-out";
          active.style.opacity      = "0";
          activeSlotRef.current = nextSlot;
        });
      });
    };

    if (inactive.complete && inactive.naturalWidth > 0) {
      startFade();
    } else {
      inactive.onload  = startFade;
      inactive.onerror = startFade;
    }
  }, [cancelInFlight, headerSrc, headerFocus]);

  const stopCycle = useCallback(() => {
    if (intervalRef.current)   { clearInterval(intervalRef.current);   intervalRef.current = null; }
    if (cycleFirstRef.current) { clearTimeout(cycleFirstRef.current);  cycleFirstRef.current = null; }
  }, []);

  const startCycle = useCallback((initialDelay = 1500) => {
    if (intervalRef.current || cycleFirstRef.current) return;
    // Skip images that are the same src as the header — no point cycling to what's already shown
    const imgs = getCycleImages().filter(img => img.src !== headerSrc);
    cycleListRef.current = imgs;
    if (imgs.length === 0) return;
    cycleIdxRef.current = -1;
    cycleFirstRef.current = setTimeout(() => {
      cycleFirstRef.current = null;
      const list = cycleListRef.current;
      if (!list.length) return;
      cycleIdxRef.current = 0;
      transitionTo(list[0], list[0].label);
      intervalRef.current = setInterval(() => {
        const l = cycleListRef.current;
        if (!l.length) return;
        cycleIdxRef.current = (cycleIdxRef.current + 1) % l.length;
        transitionTo(l[cycleIdxRef.current], l[cycleIdxRef.current].label);
      }, 4500);
    }, initialDelay);
  }, [getCycleImages, transitionTo]);

  // Mobile: auto-cycle when active
  useEffect(() => {
    if (isActive) {
      startCycle(3000);
    } else {
      stopCycle();
      transitionTo(null, null);
    }
  }, [isActive, startCycle, stopCycle, transitionTo]);

  useEffect(() => () => {
    stopCycle();
    cancelInFlight();
    if (cardEnterTimerRef.current) clearTimeout(cardEnterTimerRef.current);
    if (catHoverTimerRef.current)  clearTimeout(catHoverTimerRef.current);
    if (catLeaveTimerRef.current)  clearTimeout(catLeaveTimerRef.current);
    if (cycleFirstRef.current)     clearTimeout(cycleFirstRef.current);
    if (cycleRestartRef.current)   clearTimeout(cycleRestartRef.current);
  }, [stopCycle, cancelInFlight]);

  const cardEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catHoverTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catLeaveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardEnter = useCallback(() => {
    isHoveringRef.current = true;
    // Short delay: if cursor entered directly onto a category pill,
    // handleCatEnter fires within ~16ms and sets hoveredCatRef, skipping the cycle
    if (cardEnterTimerRef.current) clearTimeout(cardEnterTimerRef.current);
    cardEnterTimerRef.current = setTimeout(() => {
      if (isHoveringRef.current && !hoveredCatRef.current) startCycle();
    }, 60);
  }, [startCycle]);

  const handleCardLeave = useCallback(() => {
    isHoveringRef.current = false;
    hoveredCatRef.current = null;
    if (cardEnterTimerRef.current) { clearTimeout(cardEnterTimerRef.current); cardEnterTimerRef.current = null; }
    if (catHoverTimerRef.current)  { clearTimeout(catHoverTimerRef.current);  catHoverTimerRef.current = null; }
    if (catLeaveTimerRef.current)  { clearTimeout(catLeaveTimerRef.current);  catLeaveTimerRef.current = null; }
    if (cycleRestartRef.current)   { clearTimeout(cycleRestartRef.current);   cycleRestartRef.current = null; }
    stopCycle();
    const activeEl = (activeSlotRef.current === "A" ? slotARef : slotBRef).current;
    const isOnHeader = !activeEl || activeEl.src === headerSrc || activeEl.src === "";
    if (isOnHeader) {
      // Already showing header — cancel silently, no visible transition
      cancelInFlight();
      setActiveLabel(null);
    } else {
      // A category image is showing — fade back to header gracefully
      transitionTo(null, null);
    }
  }, [stopCycle, cancelInFlight, transitionTo, headerSrc]);

  const cycleRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCatEnter = useCallback((label: string) => {
    if (catLeaveTimerRef.current) { clearTimeout(catLeaveTimerRef.current); catLeaveTimerRef.current = null; }
    if (catHoverTimerRef.current) { clearTimeout(catHoverTimerRef.current); catHoverTimerRef.current = null; }
    if (cycleRestartRef.current)  { clearTimeout(cycleRestartRef.current);  cycleRestartRef.current = null; }
    hoveredCatRef.current = label;
    stopCycle();
    // Only show image after intentional hover (500ms) — prevents accidental triggers
    catHoverTimerRef.current = setTimeout(() => {
      catHoverTimerRef.current = null;
      if (hoveredCatRef.current !== label) return;
      const entry = getCardEntry(label);
      transitionTo(entry, entry ? label : null);
    }, 500);
  }, [stopCycle, getCardEntry, transitionTo]);

  const handleCatLeave = useCallback(() => {
    if (catHoverTimerRef.current) { clearTimeout(catHoverTimerRef.current); catHoverTimerRef.current = null; }
    if (catLeaveTimerRef.current) clearTimeout(catLeaveTimerRef.current);
    catLeaveTimerRef.current = setTimeout(() => {
      catLeaveTimerRef.current = null;
      hoveredCatRef.current = null;
      stopCycle();
      transitionTo(getCardEntry("Coasters"), null);
      if (isHoveringRef.current) {
        if (cycleRestartRef.current) clearTimeout(cycleRestartRef.current);
        cycleRestartRef.current = setTimeout(() => {
          if (isHoveringRef.current && !hoveredCatRef.current) startCycle();
        }, 800);
      }
    }, 50);
  }, [stopCycle, getCardEntry, transitionTo, startCycle]);

  const handleCatTap = useCallback((e: React.MouseEvent, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (hoveredCatRef.current === label) {
      hoveredCatRef.current = null;
      startCycle();
    } else {
      hoveredCatRef.current = label;
      stopCycle();
      const entry = getCardEntry(label);
      transitionTo(entry, entry ? label : null);
    }
  }, [getCardEntry, startCycle, stopCycle, transitionTo]);

  return (
    <Link href={`/park/${park.slug}`}>
      <div
        className="mx-auto w-full max-w-[400px] py-3 md:py-4 animate-fade-in-up [@media(hover:hover)]:hover:scale-105 transition-transform duration-300 ease-in-out"
        onPointerEnter={(e) => { if (e.pointerType === "mouse") handleCardEnter(); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") handleCardLeave(); }}
      >
        <div className="relative rounded-2xl overflow-hidden min-h-[500px] bg-gray-900 shadow-md dark:shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={slotARef} alt="" className="absolute inset-0 w-full h-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={slotBRef} alt="" className="absolute inset-0 w-full h-full object-cover" />

          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent px-4 pt-4 pb-16 pointer-events-none">
            <div className="flex items-center gap-2">
              <Image src={getParkFlag(park.country)} alt="" width={20} height={14} className="rounded-sm shrink-0" unoptimized />
              <h1 className="text-white font-bold text-xl leading-tight drop-shadow-md">{park.name}</h1>
            </div>
            <p className="text-white/50 text-xs mt-1">{new Date(rating.date).toLocaleDateString()}</p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-5 pt-16 pb-4 flex flex-col items-center gap-3">
            <span className={`text-[4rem] font-black tabular-nums leading-none drop-shadow-xl pointer-events-none ${getRatingColor(rating.overall)}`}>
              {rating.overall.toFixed(2)}
            </span>
            <div className="w-full grid grid-cols-5 gap-1 mt-1">
              {FULL_BLEED_GROUPS.map((g) => {
                const highlighted = activeLabel === g.label;
                return (
                  <div key={g.label} className="flex flex-col items-center gap-0.5 cursor-pointer"
                    onPointerEnter={(e) => { if (e.pointerType === "mouse") handleCatEnter(g.label); }}
                    onPointerLeave={(e) => { if (e.pointerType === "mouse") handleCatLeave(); }}
                    onClick={(e) => handleCatTap(e, g.label)}
                  >
                    <span className={`transition-transform duration-300 leading-none ${highlighted ? "scale-125" : "text-base"}`}>{g.emoji}</span>
                    <span className={`text-xs font-bold tabular-nums ${getRatingColor(parseFloat(g.getValue(rating)))}`}>{g.getValue(rating)}</span>
                    <span className={`text-[9px] uppercase tracking-wide transition-all duration-300 ${highlighted ? "text-white/90 border-b border-white/60 pb-px" : "text-white/40"}`}>
                      {g.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

const Home = () => {
  const router = useRouter();
  const { query } = useSearch();
  const { isAdminMode } = useAdminMode();

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [parallaxByIndex, setParallaxByIndex] = useState<number[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(0);

  const pendingParks = React.useMemo(() => {
    if (!isAdminMode) return [];
    return parks.filter((p) => !ratings.some((r) => r.parkId === p.id));
  }, [parks, ratings, isAdminMode]);

  const filteredRatings = React.useMemo(() => {
    const visibleRatings = isAdminMode ? ratings : ratings.filter((r) => r.published);

    const sortedByDate = [...visibleRatings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestRatingsMap = new Map<number, Rating>();
    sortedByDate.forEach((rating) => {
      if (!latestRatingsMap.has(rating.parkId)) latestRatingsMap.set(rating.parkId, rating);
    });

    const latestRatings = Array.from(latestRatingsMap.values());
    const sortedByOverall = latestRatings.sort((a, b) => b.overall - a.overall);

    return sortedByOverall.filter((rating) => {
      const park = parks.find((p) => p.id === rating.parkId);
      return park && park.name.toLowerCase().includes(query.toLowerCase());
    });
  }, [ratings, parks, query, isAdminMode]);

  const teaserItems = React.useMemo(() => {
    if (isAdminMode) return [];
    const publishedParkIds = new Set(ratings.filter((r) => r.published).map((r) => r.parkId));
    const latestDraftByPark = new Map<number, Rating>();
    [...ratings]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((r) => {
        if (!r.published && !publishedParkIds.has(r.parkId) && !latestDraftByPark.has(r.parkId))
          latestDraftByPark.set(r.parkId, r);
      });
    return Array.from(latestDraftByPark.entries()).flatMap(([parkId, rating]) => {
      const park = parks.find((p) => p.id === parkId);
      if (!park || !park.imagepath || park.imagepath.toLowerCase().includes("error")) return [];
      if (!park.name.toLowerCase().includes(query.toLowerCase())) return [];
      return [{ type: "teaser" as const, rating, park, id: `teaser-${parkId}` }];
    });
  }, [ratings, parks, isAdminMode, query]);

  const displayItems = React.useMemo(() => {
    const ratedItems = filteredRatings.flatMap((r) => {
      const p = parks.find((park) => park.id === r.parkId);
      return p ? [{ type: "rating" as const, rating: r, park: p, id: `rating-${r.id}` }] : [];
    });

    const scored = [...ratedItems, ...teaserItems].sort((a, b) => b.rating.overall - a.rating.overall);

    const items: any[] = [];
    pendingParks.forEach((p) => items.push({ type: "pending", park: p, id: `pending-${p.id}` }));
    scored.forEach((item) => items.push(item));
    return items;
  }, [pendingParks, filteredRatings, teaserItems, parks]);

  const fetchRatingsAndParks = async () => {
    try {
      const ratingsResponse = await fetch("/api/ratings");
      const ratingsData = await ratingsResponse.json();

      const parksResponse = await fetch("/api/parks");
      const parksData = await parksResponse.json();

      setParks(Array.isArray(parksData.parks) ? parksData.parks : []);
      setRatings(Array.isArray(ratingsData.ratings) ? ratingsData.ratings : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatingsAndParks();
  }, []);

  useLayoutEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const recalc = () => handleScrollInternal(el);
    window.addEventListener("resize", recalc);
    recalc();
    return () => window.removeEventListener("resize", recalc);
  }, []);

  const handleScrollInternal = (el: HTMLDivElement) => {
    const containerCenter = el.scrollLeft + el.clientWidth / 2;

    let closestIdx = 0;
    let closestDist = Number.POSITIVE_INFINITY;
    const kids = Array.from(el.children) as HTMLElement[];

    const nextParallax: number[] = new Array(kids.length).fill(0);

    kids.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = childCenter - containerCenter;

      if (Math.abs(dist) < closestDist) {
        closestDist = Math.abs(dist);
        closestIdx = idx;
      }

      const ratio = dist / el.clientWidth;
      const px = Math.max(-14, Math.min(14, -ratio * 28));
      nextParallax[idx] = Math.round(px);
    });

    setCurrentIndex(closestIdx);
    setParallaxByIndex(nextParallax);
  };

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    handleScrollInternal(el);
  };

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  function scrollToIndex(idx: number) {
    const el = carouselRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const child = children[Math.max(0, Math.min(idx, children.length - 1))];
    if (!child) return;
    el.scrollTo({
      left: child.offsetLeft + child.offsetWidth / 2 - el.clientWidth / 2,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    let startX = 0;
    let startTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startTime = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - startX;
      if (Math.abs(deltaX) < 50) return;

      const velocity = Math.abs(deltaX) / Math.max(1, Date.now() - startTime);
      const direction = deltaX < 0 ? 1 : -1;
      const cards = velocity > 1.5 ? 3 : velocity > 0.8 ? 2 : 1;
      const maxIdx = el.children.length - 1;
      const target = Math.max(0, Math.min(maxIdx, currentIndexRef.current + direction * cards));
      scrollToIndex(target);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  const closeModal = () => {
    router.push("/", undefined);
  };

  return (
    <main id="top" className="relative z-0 bg-white dark:bg-[#0f172a] overflow-visible">
      {/* Mobile: horizontal swipe carousel */}
      <div className="md:hidden px-4 py-3 relative">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar overscroll-x-contain px-[11vw]"
          style={{ touchAction: "pan-x" }}
        >
          {displayItems.map((item, index) => {
            const active = index === currentIndex;
            return (
              <div
                key={item.id}
                style={{ "--px": `${parallaxByIndex[index] ?? 0}px` } as React.CSSProperties}
                className={`snap-center shrink-0 transition-all duration-200 ease-in-out ${active ? "scale-100 opacity-100" : "scale-95 opacity-80"} w-[78vw] min-[400px]:w-[72vw] min-[480px]:w-[68vw] min-[560px]:w-[64vw] max-w-sm`}
              >
                {item.type === "pending" ? (
                  <PendingParkCard park={item.park} />
                ) : item.type === "teaser" ? (
                  <TeaserParkCard rating={item.rating} park={item.park} />
                ) : item.type === "rating" ? (
                  <FullBleedRatingCard rating={item.rating} park={item.park} isActive={active} />
                ) : (
                  <RatingCard
                    rating={item.rating}
                    park={item.park}
                    delayIndex={index}
                    ratingWarnings={item.rating.warnings?.map((w: any) => ({
                      ratingId: w.ratingId ?? item.rating.id,
                      category: w.category ?? "",
                      ride: w.ride,
                      note: w.note,
                      severity: w.severity || "Moderate",
                    })) as RatingWarningType[]}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white dark:from-[#0f172a] to-transparent" />
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-2 py-1 bg-black/20 dark:bg-white/10 backdrop-blur-sm"
          style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${DOTS_OFFSET}px)` }}
        >
          {displayItems.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ease-in-out ${i === currentIndex ? "w-5 bg-blue-600 dark:bg-blue-400" : "w-2 bg-gray-300 dark:bg-gray-600"}`}
            />
          ))}
        </div>
      </div>

      {/* Tablet & up: normal grid */}
      <div className="hidden md:grid relative z-10 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 px-6 flex-grow dark:bg-transparent py-2.5">
        {displayItems.map((item, index) => {
          if (item.type === "pending") {
            return <PendingParkCard key={item.id} park={item.park} />;
          }
          if (item.type === "teaser") {
            return <TeaserParkCard key={item.id} rating={item.rating} park={item.park} />;
          }
          return <FullBleedRatingCard key={item.id} rating={item.rating} park={item.park} />;
        })}
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <RatingModal closeModal={closeModal} fetchRatingsAndParks={fetchRatingsAndParks} />
      </Suspense>
    </main>
  );
};

export default Home;