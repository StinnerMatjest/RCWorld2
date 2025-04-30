"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MainPageButton from "@/app/components/MainPageButton";
import CoasterCreatorModal from "@/app/components/CoasterCreatorModal";

export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagepath: string;
}

export interface Rating {
  id: number;
  date: string;
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

export interface RollerCoaster {
  id: number;
  name: string;
  year: number;
  manufacturer: string;
  model: string;
  scale: string;
  haveridden: boolean;
  isbestcoaster: boolean;
  rcdbpath: string;
}

// Color coding function for ratings
const getRatingColor = (rating: number) => {
  if (rating >= 10.0) return "rainbow-animation"; // GOAT
  if (rating >= 9.0) return "text-blue-700 dark:text-blue-400"; // Excellent
  if (rating >= 7.5) return "text-green-600 dark:text-green-400"; // Great
  if (rating >= 6.5) return "text-green-400 dark:text-green-300"; // Good
  if (rating >= 5.5) return "text-yellow-400 dark:text-yellow-300"; // Average
  if (rating >= 4.5) return "text-yellow-600 dark:text-yellow-500"; // Mediocre
  if (rating >= 3.0) return "text-red-400 dark:text-red-300"; // Poor
  return "text-red-600 dark:text-red-500"; // Bad
};

// Dummy explanation for each category
const explanations: { [key: string]: string } = {
  parkAppearance: "The park's appearance is well-maintained, but a few areas could use some improvement.",
  bestCoaster: "The best coaster is thrilling but could benefit from smoother transitions.",
  waterRides: "Water rides are fun but can get overcrowded during peak hours.",
  rideLineup: "The ride lineup is diverse, but some older rides need maintenance.",
  food: "Food options are delicious and diverse, though a bit on the expensive side.",
  snacksAndDrinks: "Good variety of snacks and drinks, though lines can be long during peak times.",
  parkPracticality: "The park layout is easy to navigate with plenty of signage.",
  rideOperations: "Ride operations are generally efficient, though some lines can be long.",
  parkManagement: "The park management is responsive, but improvements can be made in queue management."
};

const ParkPage = () => {
  const { id: parkId } = useParams();
  const [park, setPark] = useState<Park | null>(null);
  const [coasters, setCoasters] = useState<RollerCoaster[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loadingCoasters, setLoadingCoasters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoaster, setEditingCoaster] = useState<RollerCoaster | undefined>(undefined);

  const sortedCoasters = [...coasters].sort((a, b) =>
    b.isbestcoaster === a.isbestcoaster ? 0 : b.isbestcoaster ? 1 : -1
  );
  const mainCoasters = sortedCoasters.filter(
    (coaster) => coaster.scale !== "Junior" && coaster.scale !== "Kiddie"
  );
  const optionalCoasters = sortedCoasters.filter(
    (coaster) => coaster.scale === "Junior" || coaster.scale === "Kiddie"
  );

  const refreshCoasters = async () => {
    const response = await fetch(`/api/park/${parkId}/coasters`);
    const data = await response.json();
    setCoasters(data);
  };

  useEffect(() => {
    if (!parkId) return;

    const fetchPark = async () => {
      const response = await fetch(`/api/park/${parkId}`);
      const data = await response.json();
      setPark(data);
    };

    const fetchCoasters = async () => {
      const response = await fetch(`/api/park/${parkId}/coasters`);
      const data = await response.json();
      setCoasters(data);
      setLoadingCoasters(false);
    };

    const fetchRatings = async () => {
      const response = await fetch(`/api/ratings?parkId=${parkId}`);
      const data = await response.json();
      setRatings(data.ratings.filter((rating: Rating) => rating.parkId === Number(parkId)));
    };

    fetchPark();
    fetchCoasters();
    fetchRatings();
  }, [parkId]);

  if (!park) return <div>Loading park...</div>;

  return (
    <div className="w-full">
      {/* Header Image */}
      <div className="relative w-full h-96">
        <img
          src={park.imagepath}
          alt={park.name}
          className="w-full h-full object-cover"
        />
        <h1 className="absolute bottom-4 left-6 text-7xl font-bold text-white p-4 rounded-md">
          {park.name}
        </h1>
      </div>

      {/* Main Section with Left and Right Columns */}
      <div className="flex flex-col md:flex-row gap-6 w-full py-10 px-6 md:px-20 bg-base-200">
        {/* Left Column: Park Information, Ratings, and Roller Coasters */}
        <div className="w-full md:w-[30%] space-y-6">
          {/* Park Info Section */}
          <div>
            <h2 className="text-3xl font-semibold mb-4">Park Information</h2>
            <div className="text-lg">
              <p><strong>Continent:</strong> {park.continent}</p>
              <p><strong>Country:</strong> {park.country}</p>
              <p><strong>City:</strong> {park.city}</p>
            </div>
          </div>

          {/* Ratings Section */}
          <div>
            <h2 className="text-3xl font-semibold mb-4">Ratings</h2>
            {ratings.length > 0 ? (
              <div className="space-y-4">
                {ratings.map((rating) => (
                  <div key={rating.id} className="flex flex-col items-center justify-center p-6 bg-blue-100 rounded-xl shadow-lg">
                    {/* Overall Rating */}
                    <h3 className="text-2xl font-semibold mb-4">Overall Rating</h3>
                    <div className="text-6xl font-bold py-4 mb-6">
                      <span className={`font-semibold py-4 ${getRatingColor(rating.overall)}`}>
                        {rating.overall.toFixed(2)}
                      </span>
                    </div>

                    {/* Individual Ratings in 3x3 Grid */}
                    <div className="grid grid-cols-3 gap-2 max-w-[380px] mx-auto mt-6">
                      {/* Park Appearance */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Park Appearance</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.parkAppearance)}`}>
                          {rating.parkAppearance}
                        </span>
                      </div>

                      {/* Best Coaster */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Best Coaster</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.bestCoaster)}`}>
                          {rating.bestCoaster}
                        </span>
                      </div>

                      {/* Water Rides */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Water Rides</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.waterRides)}`}>
                          {rating.waterRides}
                        </span>
                      </div>

                      {/* Ride Lineup */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Ride Lineup</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.rideLineup)}`}>
                          {rating.rideLineup}
                        </span>
                      </div>

                      {/* Food */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Food</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.food)}`}>
                          {rating.food}
                        </span>
                      </div>

                      {/* Snacks & Drinks */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Snacks & Drinks</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.snacksAndDrinks)}`}>
                          {rating.snacksAndDrinks}
                        </span>
                      </div>

                      {/* Park Practicality */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Park Practicality</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.parkPracticality)}`}>
                          {rating.parkPracticality}
                        </span>
                      </div>

                      {/* Ride Operations */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Ride Operations</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.rideOperations)}`}>
                          {rating.rideOperations}
                        </span>
                      </div>

                      {/* Park Management */}
                      <div className="flex flex-col items-center">
                        <strong className="text-sm">Park Management</strong>
                        <span className={`font-semibold text-2xl ${getRatingColor(rating.parkManagement)}`}>
                          {rating.parkManagement}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No ratings available yet.</p>
            )}
          </div>

          {/* Roller Coasters Section */}
          <div>
            <h2 className="text-3xl font-semibold mb-4">Roller Coasters</h2>
            <button
              onClick={() => {
                setEditingCoaster(undefined);
                setShowModal(true);
              }}
              className="h-7 w-28 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 cursor-pointer mb-2"
            >
              + Add Coaster
            </button>
            {loadingCoasters ? (
              <p>Loading coasters...</p>
            ) : coasters.length > 0 ? (
              <>
                <ul className="space-y-2 mb-8">
                  {mainCoasters.map((coaster) => (
                    <li key={coaster.id} className="text-lg flex items-center space-x-2">
                      <a
                        href={coaster.rcdbpath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {coaster.name}
                      </a>{" "}
                      - {coaster.year} {coaster.manufacturer} ({coaster.model} -{" "}
                      {coaster.scale})
                      <span
                        className={`ml-3 px-2 py-1 text-sm font-semibold rounded-md ${
                          coaster.haveridden
                            ? "bg-green-200 text-green-700"
                            : "bg-red-200 text-red-700"
                        }`}
                      >
                        {coaster.haveridden ? "Have ridden" : "Have not ridden"}
                      </span>
                      {coaster.isbestcoaster && (
                        <span className="ml-3 px-2 py-1 text-sm font-bold text-yellow-800 bg-yellow-200 rounded-md">
                          ⭐ Best Coaster
                        </span>
                      )}
                      <span
                        onClick={() => {
                          setEditingCoaster(coaster);
                          setShowModal(true);
                        }}
                        className="cursor-pointer text-xl ml-2"
                      >
                        🔧
                      </span>
                    </li>
                  ))}
                </ul>

                {optionalCoasters.length > 0 && (
                  <>
                    <h3 className="text-2xl font-semibold mt-8 mb-2">Optional Coasters</h3>
                    <ul className="space-y-2">
                      {optionalCoasters.map((coaster) => (
                        <li key={coaster.id} className="text-lg flex items-center space-x-2">
                          <a
                            href={coaster.rcdbpath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {coaster.name}
                          </a>{" "}
                          - {coaster.year} {coaster.manufacturer} ({coaster.model} -{" "}
                          {coaster.scale})
                          <span
                            className={`ml-3 px-2 py-1 text-sm font-semibold rounded-md ${
                              coaster.haveridden ? "bg-green-200 text-green-700" : "bg-red-200 text-red-700"
                            }`}
                          >
                            {coaster.haveridden ? "Have ridden" : "Have not ridden"}
                          </span>
                          <span
                            onClick={() => {
                              setEditingCoaster(coaster);
                              setShowModal(true);
                            }}
                            className="cursor-pointer text-xl ml-2"
                          >
                            🔧
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p>No roller coasters found.</p>
            )}
          </div>
        </div>

        {/* Right Column: Article Field */}
        <div className="w-[70%] space-y-6">
          <h2 className="text-3xl font-semibold mb-4">Rating Explanations</h2>
          <div className="space-y-6">
            {ratings.map((rating) => (
              <div key={rating.id} className="space-y-4">
                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Park Appearance</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.parkAppearance)}`}>{rating.parkAppearance}</p>
                </div>
                <p>{explanations.parkAppearance}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Best Coaster</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.bestCoaster)}`}>{rating.bestCoaster}</p>
                </div>
                <p>{explanations.bestCoaster}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Water Rides</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.waterRides)}`}>{rating.waterRides}</p>
                </div>
                <p>{explanations.waterRides}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Ride Lineup</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.rideLineup)}`}>{rating.rideLineup}</p>
                </div>
                <p>{explanations.rideLineup}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Food</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.food)}`}>{rating.food}</p>
                </div>
                <p>{explanations.food}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Snacks & Drinks</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.snacksAndDrinks)}`}>{rating.snacksAndDrinks}</p>
                </div>
                <p>{explanations.snacksAndDrinks}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Park Practicality</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.parkPracticality)}`}>{rating.parkPracticality}</p>
                </div>
                <p>{explanations.parkPracticality}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Ride Operations</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.rideOperations)}`}>{rating.rideOperations}</p>
                </div>
                <p>{explanations.rideOperations}</p>

                <div className="flex items-center">
                  <h3 className="text-xl font-semibold mr-4">Park Management</h3>
                  <p className={`font-semibold text-2xl ${getRatingColor(rating.parkManagement)}`}>{rating.parkManagement}</p>
                </div>
                <p>{explanations.parkManagement}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <CoasterCreatorModal
          parkId={Number(parkId)}
          coaster={editingCoaster}
          onClose={() => {
            setShowModal(false);
            setEditingCoaster(undefined);
            refreshCoasters();
          }}
          onCoasterAdded={() => {
            refreshCoasters();
          }}
        />
      )}

      <div className="flex justify-center py-10">
        <MainPageButton />
      </div>
    </div>
  );
};

export default ParkPage;
