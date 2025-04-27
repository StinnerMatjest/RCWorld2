import React from "react";
import { Rating } from "../page";
import { Park } from "../page";
import ToParkButton from "./ToParkButton";

interface RatingCardProps {
  rating: Rating;
  park: Park;
}

const RatingCard: React.FC<RatingCardProps> = ({ rating, park }) => {
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
    <div className="mx-auto flex flex-col justify-between w-full max-w-[400px] py-2">
      <div className="flex flex-col items-center justify-between bg-white shadow-lg rounded-2xl overflow-hidden">
        {/* Park Name */}
        <div className="flex flex-col items-center justify-center w-full">
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
          <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto text-center text-sm">
            <div>
              <p>Park Appearance:</p>
              <p className={getRatingColor(rating.parkAppearance)}>
                {rating.parkAppearance}
              </p>
            </div>
            <div>
              <p>Best Coaster:</p>
              <p className={getRatingColor(rating.bestCoaster)}>
                {rating.bestCoaster}
              </p>
            </div>
            <div>
              <p>Water Rides:</p>
              <p className={getRatingColor(rating.waterRides)}>
                {rating.waterRides}
              </p>
            </div>
            <div>
              <p>Ride Lineup:</p>
              <p className={getRatingColor(rating.rideLineup)}>
                {rating.rideLineup}
              </p>
            </div>
            <div>
              <p>Food:</p>
              <p className={getRatingColor(rating.food)}>
                {rating.food}
              </p>
            </div>
            <div>
              <p>Snacks & Drinks:</p>
              <p className={getRatingColor(rating.snacksAndDrinks)}>
                {rating.snacksAndDrinks}
              </p>
            </div>
            <div>
              <p>Park Practicality:</p>
              <p className={getRatingColor(rating.parkPracticality)}>
                {rating.parkPracticality}
              </p>
            </div>
            <div>
              <p>Ride Operations:</p>
              <p className={getRatingColor(rating.rideOperations)}>
                {rating.rideOperations}
              </p>
            </div>
            <div>
              <p>Park Management:</p>
              <p className={getRatingColor(rating.parkManagement)}>
                {rating.parkManagement}
              </p>
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
