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
  otherRides: number;
  food: number;
  snacksAndDrinks: number;
  parkPracticality: number;
  rideOperations: number;
  parkManagement: number;
  value: number;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5 px-10 flex-grow bg-gray-200">
        {ratings.map((rating) => {
          const park = parks.find((p) => p.id === Number(rating.parkId));

          console.log("Rating parkId:", rating.parkId);
          console.log("Found park:", park);

          if (!park) {
            return <div key={rating.id}>Park not found for {rating.park}</div>;
          }

          console.log("Park id:", park.id);

          return (
            <RatingCard key={rating.id} ratings={[rating]} parks={[park]} />
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
