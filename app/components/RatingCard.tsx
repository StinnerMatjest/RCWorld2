import React from "react";
import Image from "next/image";
import { Rating } from "../page";
import ToParkButton from "./ToParkButton";

interface RatingCardProps {
  ratings: Rating[];
}

const RatingCard: React.FC<RatingCardProps> = ({ ratings = [] }) => {
  // Function to calculate color for ratings
  const getRatingColor = (rating: number) => {
    if (rating >= 3.95) return "text-blue-700"; // Excellent
    if (rating >= 3.45) return "text-green-500"; // Good
    if (rating >= 2.95) return "text-yellow-400"; // Average
    return "text-red-500"; // Poor
  };

  return (
    <div className="flex flex-wrap gap-8 justify-center">
      {/* Map over ratings and generate a card for each */}
      {ratings.map((rating) => {
        return (
          <div
            key={rating.id}
            className="card bg-base-100 w-[600px] shadow-xl mx-auto flex flex-col justify-between h-[900px]"
          >
            <div className="pt-6 flex flex-col items-center justify-center">
              <h1 className="text-3xl font-bold text-center mb-6">
                {rating.park}
              </h1>
            </div>

            <figure className="relative w-full h-[800px]">
              <Image
                src={rating.imagePath}
                alt="Park Image"
                className="rounded-xl object-cover"
                layout="fill"
              />
            </figure>

            <div className="card-body items-center text-center flex flex-col justify-between flex-grow">
              <p
                className={`text-5xl font-semibold ${getRatingColor(
                  rating.overall
                )} mb-4`}
              >
                {rating.overall.toFixed(1)}
              </p>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p>Park Appearance:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.parkAppearance
                    )}`}
                  >
                    {rating.parkAppearance}
                  </p>
                </div>
                <div>
                <p>Best Coaster:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.bestCoaster
                    )}`}
                  >
                    {rating.bestCoaster}
                  </p>
                </div>
                <div>
                <p>Water Rides:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.waterRides
                    )}`}
                  >
                    {rating.waterRides}
                  </p>
                </div>
                <div>
                <p>Other Rides:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.otherRides
                    )}`}
                  >
                    {rating.otherRides}
                  </p>
                </div>
                <div>
                <p>Food:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.food
                    )}`}
                  >
                    {rating.food}
                  </p>
                </div>
                <div>
                <p>SnacksAndDrinks:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.snacksAndDrinks
                    )}`}
                  >
                    {rating.snacksAndDrinks}
                  </p>
                </div>
                <div>
                <p>Park Practicality:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.parkPracticality
                    )}`}
                  >
                    {rating.parkPracticality}
                  </p>
                </div>
                <div>
                <p>Ride Operations:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.rideOperations
                    )}`}
                  >
                    {rating.rideOperations}
                  </p>
                </div>
                <div>
                <p>Park Management:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.parkManagement
                    )}`}
                  >
                    {rating.parkManagement}
                  </p>
                </div>
                <div>
                <p>Value:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.value
                    )}`}
                  >
                    {rating.value}
                  </p>
                </div>
                <ToParkButton ratingId={rating.id} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RatingCard;
