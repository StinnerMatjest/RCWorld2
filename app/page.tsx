"use client";
import React, { useEffect, useState, Suspense } from "react";
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
  
      // Ensure parksData is an array (access the parks property)
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
    <main className="text-center">
      {/* Title at the top */}
      <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 shadow-lg my-12">
        RCWorld
      </h1>

      {/* Grid container for RatingCards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
        {ratings.map((rating) => {
          const park = parks.find((p) => p.id === Number(rating.parkId)); // Ensure both are numbers

          console.log("Rating parkId:", rating.parkId);
          console.log("Found park:", park); // Log the entire park object or `undefined`

          if (!park) {
            return <div key={rating.id}>Park not found for {rating.park}</div>;
          }

          console.log("Park id:", park.id); // Log park.id only if park is found

          return (
            <RatingCard key={rating.id} ratings={[rating]} parks={[park]} />
          );
        })}
      </div>

      <Footer />
      <Suspense fallback={<div>Loading...</div>}>
        <RatingModal closeModal={closeModal} fetchRatingsAndParks={fetchRatingsAndParks} />
      </Suspense>
    </main>
  );
};

export default Home;
