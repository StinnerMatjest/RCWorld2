"use client";

import React, {
  useEffect,
  useState,
  Suspense,
  useRef,
  UIEvent,
  useLayoutEffect,
} from "react";
import { RatingWarningType } from "@/app/types";
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
  warnings?: { ride: string; note: string }[];
}

export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagePath: string;
}

// removed SETTLE_DELAY – we no longer force snapping with JS
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

  // removed settleTimer + isAutoScrolling – we rely on native scroll-snap now

  const [ratingWarnings, setRatingWarnings] = useState<RatingWarningType[]>([]);
  const sortedRatings = [...ratings].sort((a, b) => b.overall - a.overall);
  const filteredRatings = sortedRatings.filter((rating) => {
    const park = parks.find((p) => p.id === rating.parkId);
    return park && park.name.toLowerCase().includes(query.toLowerCase());
  });

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

  // ❌ removed settleToNearest + timer-based snapping
  // ✅ let scroll-snap CSS do the snapping instead
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    handleScrollInternal(el);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  const closeModal = () => {
    router.push("/", undefined);
  };

  return (
    <main className="relative z-0 bg-gray-100 dark:bg-[#0f172a] min-h-screen overflow-visible">
      {/* Mobile: horizontal swipe carousel */}
      <div className="md:hidden px-4 py-3 relative">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="
            flex gap-3 overflow-x-auto pb-2
            snap-x snap-mandatory
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
                  snap-start shrink-0
                  transition-transform duration-150 ease-out
                  ${active ? "scale-100 opacity-100" : "scale-95 opacity-80"}
                  w-[74vw]
                  w-[78vw]
                  min-[400px]:w-[72vw]
                  min-[480px]:w-[68vw]
                  min-[560px]:w-[64vw]

                  max-w-sm
                  `}
              >
                <RatingCard
                  key={rating.id}
                  rating={rating}
                  park={park}
                  delayIndex={index}
                  ratingWarnings={
                    rating.warnings?.map((w: any) => ({
                      ratingId: w.ratingId ?? rating.id,
                      category: w.category ?? "",
                      ride: w.ride,
                      note: w.note,
                    })) as RatingWarningType[]
                  }
                />
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

      {/* Tablet & up: normal grid */}
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
              ratingWarnings={
                rating.warnings?.map((w: any) => ({
                  ratingId: w.ratingId ?? rating.id,
                  category: w.category ?? "",
                  ride: w.ride,
                  note: w.note,
                })) as RatingWarningType[]
              }
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
