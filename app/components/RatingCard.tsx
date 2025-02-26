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
    if (rating >= 5.01) return "rainbow-animation"; // GOAT
    if (rating >= 3.95) return "text-blue-700"; // Excellent
    if (rating >= 3.45) return "text-green-500"; // Good
    if (rating >= 2.95) return "text-yellow-400"; // Average
    return "text-red-500"; // Poor
  };

  return (
    <div className="mx-auto flex flex-col justify-between w-full">
      {ratings.map((rating) => {
        const park = parks.find((p) => p.id === rating.parkId);
        if (!park) {
          return <div key={rating.id}></div>; //PARK NOT FOUND ERROR - Currently suppressed
        }

        return (
          <div
            key={rating.id}
            className="flex flex-col items-center justify-between bg-white shadow-lg rounded-lg p-3"
          >
            <div className="pt-6 flex flex-col items-center justify-center w-full">
              <h1 className="text-4xl font-bold text-center mb-6">
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
            <div className="rating-date text-sm italic">
              {new Date(rating.date).toLocaleDateString()}
            </div>

            <div className="card-body items-center text-center flex flex-col justify-between w-full">
              <p
                className={`text-6xl font-semibold ${getRatingColor(
                  rating.overall
                )} mb-8`}
              >
                {rating.overall.toFixed(2)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-center w-full">
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
                <div className="col-span-2 sm:col-span-3 md:col-span-2 justify-self-center">
                  <p>Park Management:</p>
                  <p
                    className={`text-center ${getRatingColor(
                      rating.parkManagement
                    )}`}
                  >
                    {rating.parkManagement}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-3 md:col-span-2 justify-self-center">
                  <p>Value:</p>
                  <p className={`text-center ${getRatingColor(rating.value)}`}>
                    {rating.value}
                  </p>
                </div>
              </div>
              <ToParkButton parkId={rating.parkId} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RatingCard;
