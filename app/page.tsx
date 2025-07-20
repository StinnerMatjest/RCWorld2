"use client";

import React, { useEffect, useState, Suspense } from "react";
import RatingCard from "./components/RatingCard";
import Footer from "./components/Footer";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";
import { useSearch } from "./context/SearchContext";

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

const Home = () => {
  const router = useRouter();
  const { query } = useSearch();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (err instanceof Error) {
        console.error("Error fetching data:", err.message);
        setError(err.message);
      } else {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatingsAndParks();
  }, []);

  if (isLoading) {
    return <div>Loading ratings and parks...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const closeModal = () => {
    router.push("/", undefined);
  };

  return (
    <main className="relative z-0 bg-gray-100 dark:bg-[#0f172a] min-h-screen overflow-visible">
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-6 flex-grow bg-white dark:bg-transparent overflow-visible py-2.5">
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

      <Footer />

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
