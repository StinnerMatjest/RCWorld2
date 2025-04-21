import React from "react";
import { Rating } from "../page";
import { Park } from "../page";
import ToParkButton from "./ToParkButton";

interface RatingCardProps {
  ratings: Rating[];
  parks: Park[];
}

const RatingCard: React.FC<RatingCardProps> = ({ ratings = [], parks }) => {
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
    <div className="mx-auto flex flex-col justify-between w-full py-2">
      {ratings.map((rating) => {
        const park = parks.find((p) => p.id === rating.parkId);
        if (!park) {
          return <div key={rating.id}></div>; //PARK NOT FOUND ERROR - Currently suppressed
        }

        return (
          <div
            key={rating.id}
            className="flex flex-col items-center justify-between bg-white shadow-lg rounded-2g p-0"
          >
            <div className="flex flex-col items-center justify-center w-full">
              <h1 className="text-5xl font-bold text-center mb-3">
                {park.name}
              </h1>
            </div>

            <figure className="relative w-full overflow-hidden">
              {park.imagePath ? (
                <img
                  src={park.imagePath}
                  alt={park.name}
                  height="450px"
                  width="750px"
                />
              ) : (
                <img
                  src="/images/error.PNG"
                  alt="Placeholder"
                  height="450px"
                  width="750px"
                />
              )}
            </figure>
            <div className="rating-date text-m italic">
              {new Date(rating.date).toLocaleDateString() }
            </div>

            <div className="card-body items-center text-center flex flex-col justify-between w-full text-lg font-medium">
              <p
                className={`text-7xl font-semibold ${getRatingColor(
                  rating.overall
                )} mb-3`}
              >
                {rating.overall.toFixed(2)}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 text-center w-full">
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
                      rating.rideLineup
                    )}`}
                  >
                    {rating.rideLineup}
                  </p>
                </div>
                <div>
                  <p>Food:</p>
                  <p className={`text-center ${getRatingColor(rating.food)}`}>
                    {rating.food}
                  </p>
                </div>
                <div>
                  <p>Snacks & Drinks:</p>
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
              </div>
              <div className="flex justify-center w-full mt-6 mb-4">
                <ToParkButton parkId={rating.parkId} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RatingCard;
