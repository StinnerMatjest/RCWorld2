import React from "react";
import { Rating } from "../page";
import { Park } from "../page";
import ToParkButton from "./ToParkButton";

interface RatingCardProps {
  rating: Rating;
  park: Park;
  delayIndex?: number; // NEW: Accepts a delay index
}

const RatingCard: React.FC<RatingCardProps> = ({ rating, park, delayIndex }) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 10.0) return "rainbow-animation"; // GOAT
    if (rating >= 9.0) return "text-blue-700"; // Excellent
    if (rating >= 7.5) return "text-green-600"; // Great
    if (rating >= 6.5) return "text-green-400"; // Good
    if (rating >= 5.5) return "text-yellow-400"; // Average
    if (rating >= 4.5) return "text-yellow-600"; // Mediocre
    if (rating >= 3.0) return "text-red-400"; // Poor
    return "text-red-600"; // Bad
  };

  return (
    <div className={`mx-auto flex flex-col justify-between w-full max-w-[400px] py-2 animate-fade-in-up ${delayIndex !== undefined ? `delay-${delayIndex % 6}` : ""}`}>
      <div className="flex flex-col items-center justify-between bg-gray-50 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:scale-105 transition-transform duration-300 ease-in-out">
        
        {/* Park Name */}
        <div className="flex flex-col items-center justify-center w-full min-h-[70px]">
          <h1 className="text-3xl font-bold text-center py-2 mb-1">
            {park.name}
          </h1>
        </div>

        {/* Park Image */}
        <figure className="w-full flex justify-center">
          <img
            className="w-full h-60 object-cover rounded-t-lg"
            src={park.imagePath || "/images/error.PNG"}
            alt={park.name}
            loading="lazy"
          />
        </figure>

        {/* Rating Date */}
        <div className="text-sm italic py-1">
          {new Date(rating.date).toLocaleDateString()}
        </div>

        {/* Rating Details */}
        <div className="flex flex-col items-center text-center justify-between w-full text-base font-medium p-2">
          {/* Overall Rating */}
          <p className={`text-4xl font-semibold py-2 ${getRatingColor(rating.overall)}`}>
            {rating.overall.toFixed(2)}
          </p>

          {/* Individual Scores */}
          <div className="grid grid-cols-3 gap-x-2 gap-y-1 max-w-[300px] mx-auto text-center text-sm">
            <div className="flex flex-col items-center">
              <span className="text-xs">Park Appearance</span>
              <span className={getRatingColor(rating.parkAppearance)}>
                {rating.parkAppearance}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Best Coaster</span>
              <span className={getRatingColor(rating.bestCoaster)}>
                {rating.bestCoaster}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Water Rides</span>
              <span className={getRatingColor(rating.waterRides)}>
                {rating.waterRides}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Ride Lineup</span>
              <span className={getRatingColor(rating.rideLineup)}>
                {rating.rideLineup}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Food</span>
              <span className={getRatingColor(rating.food)}>
                {rating.food}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Snacks & Drinks</span>
              <span className={getRatingColor(rating.snacksAndDrinks)}>
                {rating.snacksAndDrinks}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Park Practicality</span>
              <span className={getRatingColor(rating.parkPracticality)}>
                {rating.parkPracticality}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Ride Operations</span>
              <span className={getRatingColor(rating.rideOperations)}>
                {rating.rideOperations}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs">Park Management</span>
              <span className={getRatingColor(rating.parkManagement)}>
                {rating.parkManagement}
              </span>
            </div>
          </div>

          {/* Button */}
          <div className="flex justify-center w-full mt-4">
            <ToParkButton parkId={rating.parkId} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RatingCard;
