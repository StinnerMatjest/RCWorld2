"use client";

import React, { useEffect, useState, Suspense } from "react";
import Header from "./components/Header";
import RatingCard from "./components/RatingCard";
import Footer from "./components/Footer";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";

export interface Rating {
  id: number;
  park: string;
  date: Date;
  parkAppearance: number;
  bestCoaster: number;
  waterRides: number;
  rideLineup: number;
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
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(""); // Search query state

  // Define the onSearch function that will be passed to Footer
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log("Search query:", query); // Replace with actual search logic
  };

  // Sort ratings by overall rating
  const sortedRatings = [...ratings].sort((a, b) => b.overall - a.overall);

  // Filter ratings based on the search query
  const filteredRatings = sortedRatings.filter((rating) => {
    const park = parks.find((p) => p.id === rating.parkId);
    return park && park.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  console.log("Filtered ratings:", filteredRatings);

  const fetchRatingsAndParks = async () => {
    try {
      const ratingsResponse = await fetch("/api/ratings");
      if (!ratingsResponse.ok) {
        throw new Error("Failed to fetch ratings");
      }
      const ratingsData = await ratingsResponse.json();
      console.log("Ratings data:", ratingsData);

      const parksResponse = await fetch("/api/parks");
      if (!parksResponse.ok) {
        throw new Error("Failed to fetch parks");
      }
      const parksData = await parksResponse.json();
      console.log("Parks data:", parksData);

      setParks(Array.isArray(parksData.parks) ? parksData.parks : []);
      setRatings(Array.isArray(ratingsData.ratings) ? ratingsData.ratings : []);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error fetching ratings or parks:", err.message);
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
    <main>
      <Header />
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 px-2 flex-grow bg-white rounded-xl py-6">
        {filteredRatings.map((rating, index) => {
          const park = parks.find((p) => p.id === rating.parkId);

          if (!park) {
            return null;
          }

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
      <Footer onSearch={handleSearch} />
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
