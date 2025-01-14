"use client";
import React, { useState, Suspense } from "react";
import RatingCard from "./components/RatingCard";
import Footer from "./components/Footer";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";

export interface Rating {
  id: number;
  date: Date;
  park: string;
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
  imagePath: string;
}

const getOverallRating = (ratings: Rating[]) => {
  ratings.forEach((rating) => {
    rating.overall =
      (rating.parkAppearance +
        rating.bestCoaster +
        rating.waterRides +
        rating.otherRides +
        rating.food +
        rating.snacksAndDrinks +
        rating.parkPracticality +
        rating.rideOperations +
        rating.parkManagement +
        rating.value) /
      10;
  });
};

const Home = () => {
  const router = useRouter();
  const [ratings, setRatings] = useState<Rating[]>([
    {
      id: 1,
      date: new Date(),
      park: "Toverland",
      parkAppearance: 3.5,
      bestCoaster: 4.5,
      waterRides: 3.0,
      otherRides: 3.0,
      food: 3.5,
      snacksAndDrinks: 4.0,
      parkPracticality: 3.5,
      rideOperations: 3.0,
      parkManagement: 4.5,
      value: 2.5,
      overall: 0,
      imagePath: "/images/parks/Toverland.PNG",
    },
    {
      id: 2,
      date: new Date(),
      park: "Walibi Belgium",
      parkAppearance: 4.0,
      bestCoaster: 5.0,
      waterRides: 5.0,
      otherRides: 3.5,
      food: 3.0,
      snacksAndDrinks: 2.5,
      parkPracticality: 4.0,
      rideOperations: 4.0,
      parkManagement: 2.0,
      value: 3.0,
      overall: 0,
      imagePath: "/images/parks/Walibi Belgium.PNG",
    },
    {
      id: 3,
      date: new Date(),
      park: "Phantasialand",
      parkAppearance: 5.0,
      bestCoaster: 4.0,
      waterRides: 5.0,
      otherRides: 4.0,
      food: 4.5,
      snacksAndDrinks: 3.5,
      parkPracticality: 2.5,
      rideOperations: 4.5,
      parkManagement: 3.0,
      value: 3.0,
      overall: 0,
      imagePath: "/images/parks/Phantasialand.PNG",
    },
  ]);

  getOverallRating(ratings);

  const closeModal = () => {
    router.push("/", undefined);
  };

  const addNewRating = (newRating: Rating) => {
    setRatings((prevRatings) => [...prevRatings, newRating]);
  };

  return (
    <main className="text-center">
      {/* Title at the top */}
      <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 shadow-lg my-12">
        RCWorld
      </h1>
      <div>
        <RatingCard ratings={ratings} />
      </div>

      <Footer />
      <Suspense fallback={<div>Loading...</div>}>
        <RatingModal closeModal={closeModal} addNewRating={addNewRating} />
      </Suspense>
    </main>
  );
};

export default Home;
