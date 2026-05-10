"use client";

import React, {
  useEffect,
  useState,
  Suspense,
  useRef,
  UIEvent,
  useLayoutEffect,
} from "react";
import Link from "next/link";
import { RatingWarningType, Rating, Park } from "@/app/types";
import RatingCard from "./components/RatingCard";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";
import { useSearch } from "./context/SearchContext";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "./components/LoadingSpinner";

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

  const displayItems = React.useMemo(() => {
    const items: any[] = [];
    pendingParks.forEach((p) => items.push({ type: "pending", park: p, id: `pending-${p.id}` }));
    filteredRatings.forEach((r) => {
      const p = parks.find(park => park.id === r.parkId);
      if (p) items.push({ type: "rating", rating: r, park: p, id: `rating-${r.id}` });
    });
    return items;
  }, [pendingParks, filteredRatings, parks]);

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
          return (
            <RatingCard
              key={item.id}
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
          );
        })}
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <RatingModal closeModal={closeModal} fetchRatingsAndParks={fetchRatingsAndParks} />
      </Suspense>
    </main>
  );
};

export default Home;