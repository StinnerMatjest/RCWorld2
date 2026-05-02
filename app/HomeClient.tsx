"use client";

import React, {
  useEffect,
  useState,
  Suspense,
  useRef,
  UIEvent,
  useLayoutEffect,
} from "react";
import { RatingWarningType, Rating, Park } from "@/app/types";
import RatingCard from "./components/RatingCard";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";
import { useSearch } from "./context/SearchContext";
import LoadingSpinner from "./components/LoadingSpinner";

const DOTS_OFFSET = 10;

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

  const filteredRatings = React.useMemo(() => {
    // Sort all ratings by date descending (newest first)
    const sortedByDate = [...ratings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Use a Map to keep only the first (newest) rating for each parkId
    const latestRatingsMap = new Map<number, Rating>();
    sortedByDate.forEach((rating) => {
      if (!latestRatingsMap.has(rating.parkId)) {
        latestRatingsMap.set(rating.parkId, rating);
      }
    });

    // Convert back to array and sort by overall score
    const latestRatings = Array.from(latestRatingsMap.values());
    const sortedByOverall = latestRatings.sort((a, b) => b.overall - a.overall);

    // Filter by the search query
    return sortedByOverall.filter((rating) => {
      const park = parks.find((p) => p.id === rating.parkId);
      return park && park.name.toLowerCase().includes(query.toLowerCase());
    });
  }, [ratings, parks, query]);

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

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  const closeModal = () => {
    router.push("/", undefined);
  };

  return (
    <main
      id="top"
      className="relative z-0 bg-white dark:bg-[#0f172a] overflow-visible"
    >
      {/* Mobile: horizontal swipe carousel */}
      <div className="md:hidden px-4 py-3 relative">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="
            flex gap-3 overflow-x-auto pb-2
            snap-x snap-mandatory
            no-scrollbar
            overscroll-x-contain
            px-[11vw]
          "
          style={{ touchAction: "pan-x" }}
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
                  snap-center [scroll-snap-stop:always] shrink-0
                  transition-all duration-200 ease-in-out
                  ${active ? "scale-100 opacity-100" : "scale-95 opacity-80"}
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
                      severity: w.severity || "Moderate",
                    })) as RatingWarningType[]
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white dark:from-[#0f172a] to-transparent" />
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
              className={`h-2 rounded-full transition-all duration-300 ease-in-out ${
                i === currentIndex
                  ? "w-5 bg-blue-600 dark:bg-blue-400"
                  : "w-2 bg-gray-300 dark:bg-gray-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tablet & up: normal grid */}
      <div className="hidden md:grid relative z-10 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 px-6 flex-grow dark:bg-transparent py-2.5">
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
                  severity: w.severity || "Moderate",
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