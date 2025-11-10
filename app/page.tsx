export const metadata = {
  title: "ParkRating, Ride, Rate, Repeat",
  description:
    "Honest and fun reviews of theme parks across the world — with ratings, photos, and personal insights.",
};


"use client";

import React, {
  useEffect,
  useState,
  Suspense,
  useRef,
  UIEvent,
  useLayoutEffect,
} from "react";
import RatingCard from "./components/RatingCard";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";
import { useSearch } from "./context/SearchContext";
import LoadingSpinner from "./components/LoadingSpinner";

export interface Rating {
  id: number;
  park: string;
  date: Date;
  parkAppearance: number;
  bestCoaster: number;
  coasterDepth: number;
  waterRides: number;
  flatridesAndDarkrides: number;
  food: number;
  snacksAndDrinks: number;
  parkPracticality: number;
  rideOperations: number;
  parkManagement: number;
  overall: number;
  parkId: number;
}

export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagePath: string;
}

const SETTLE_DELAY = 110; // wait before snapping to nearest
const DOTS_OFFSET = 10; // distance above safe area for dots

const Home = () => {
  const router = useRouter();
  const { query } = useSearch();

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [parallaxByIndex, setParallaxByIndex] = useState<number[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

  const settleTimer = useRef<number | null>(null);
  const isAutoScrolling = useRef(false);

  const sortedRatings = [...ratings].sort((a, b) => b.overall - a.overall);
  const filteredRatings = sortedRatings.filter((rating) => {
    const park = parks.find((p) => p.id === rating.parkId);
    return park && park.name.toLowerCase().includes(query.toLowerCase());
  });

  const fetchRatingsAndParks = async () => {
    try {
      const ratingsResponse = await fetch("/api/ratings");
      if (!ratingsResponse.ok) throw new Error("Failed to fetch ratings");
      const ratingsData = await ratingsResponse.json();

      const parksResponse = await fetch("/api/parks");
      if (!parksResponse.ok) throw new Error("Failed to fetch parks");
      const parksData = await parksResponse.json();

      setParks(Array.isArray(parksData.parks) ? parksData.parks : []);
      setRatings(Array.isArray(ratingsData.ratings) ? ratingsData.ratings : []);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
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

  // compute active index + small parallax on scroll
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

      const ratio = dist / el.clientWidth; // ~[-1..1]
      const px = Math.max(-14, Math.min(14, -ratio * 28));
      nextParallax[idx] = Math.round(px);
    });

    setCurrentIndex(closestIdx);
    setParallaxByIndex(nextParallax);
  };

  const settleToNearest = () => {
    const el = carouselRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const target = kids[currentIndex];
    if (!target) return;

    isAutoScrolling.current = true;
    const targetLeft =
      target.offsetLeft + target.offsetWidth / 2 - el.clientWidth / 2;
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
    window.setTimeout(() => {
      isAutoScrolling.current = false;
    }, 200);
  };

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    handleScrollInternal(el);

    // Debounce: when scroll pauses, snap to nearest
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!isAutoScrolling.current) {
        settleToNearest();
      }
    }, SETTLE_DELAY) as unknown as number;
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  const closeModal = () => {
    router.push("/", undefined);
  };

  return (
    <main className="relative z-0 bg-gray-100 dark:bg-[#0f172a] min-h-screen overflow-visible">
      {/* -------- Mobile: horizontal swipe carousel -------- */}
      <div className="md:hidden px-4 py-3 relative">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="
            flex gap-3 overflow-x-auto pb-2
            snap-x snap-proximity
            no-scrollbar
            scroll-pl-4
          "
          style={{ scrollBehavior: "smooth", scrollPadding: "0 7vw" }}
        >
          {filteredRatings.map((rating, index) => {
            const park = parks.find((p) => p.id === rating.parkId);
            if (!park) return null;

            const active = index === currentIndex;

            return (
              <div
                key={rating.id}
                style={
                  {
                    "--px": `${parallaxByIndex[index] ?? 0}px`,
                  } as React.CSSProperties
                }
                className={`
                  snap-center shrink-0
                  transition-transform duration-150 ease-out
                  ${active ? "scale-100 opacity-100" : "scale-95 opacity-80"}
                  w-[74vw]
                  min-[400px]:w-[68vw]
                  min-[480px]:w-[64vw]
                  min-[560px]:w-[60vw]
                  max-w-sm
                  `}
              >
                <RatingCard rating={rating} park={park} delayIndex={index} />
              </div>
            );
          })}
        </div>

        {/* Right gradient hint */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-gray-100 dark:from-[#0f172a] to-transparent" />

        {/* Pagination dots */}
        <div
          className="
            pointer-events-none absolute left-1/2 -translate-x-1/2
            flex items-center gap-1.5 rounded-full px-2 py-1
            bg-black/20 dark:bg-white/10 backdrop-blur-sm
          "
          style={{
            bottom: `calc(env(safe-area-inset-bottom, 0px) + ${DOTS_OFFSET}px)`,
          }}
        >
          {filteredRatings.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === currentIndex
                  ? "bg-blue-600 dark:bg-blue-400"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* -------- Tablet & up: normal grid -------- */}
      <div className="hidden md:grid relative z-10 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 px-6 flex-grow bg-white dark:bg-transparent py-2.5">
        {filteredRatings.map((rating, index) => {
          const park = parks.find((p) => p.id === rating.parkId);
          if (!park) return null;

          return (
            <RatingCard
              key={rating.id}
              rating={rating}
              park={park}
              delayIndex={index}
            />
          );
        })}
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <RatingModal
          closeModal={closeModal}
          fetchRatingsAndParks={fetchRatingsAndParks}
        />
      </Suspense>
    </main>
  );
};

export default Home;
