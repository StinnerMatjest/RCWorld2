import React from "react";
import Link from "next/link"; // new import
import { Rating } from "../page";
import { Park } from "../page";

interface RatingCardProps {
  rating: Rating;
  park: Park;
  delayIndex?: number;
}

const RatingCard: React.FC<RatingCardProps> = ({ rating, park, delayIndex }) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 10.0) return "text-blue-700"; // GOAT
    if (rating >= 9.0) return "text-blue-700"; // Excellent
    if (rating >= 7.5) return "text-green-600"; // Great
    if (rating >= 6.5) return "text-green-400"; // Good
    if (rating >= 5.5) return "text-yellow-400"; // Average
    if (rating >= 4.5) return "text-yellow-600"; // Mediocre
    if (rating >= 3.0) return "text-red-400"; // Poor
    return "text-red-600"; // Bad
  };

  return (
    <Link href={`/parks/${rating.parkId}`} className="group">
      <div className={`mx-auto flex flex-col justify-between w-full max-w-[400px] py-2 animate-fade-in-up ${delayIndex !== undefined ? `delay-${delayIndex % 6}` : ""}`}>
        <div className="flex flex-col items-center justify-between bg-gray-50 rounded-2xl overflow-hidden shadow-md transition-transform duration-300 ease-in-out group-hover:scale-105 group-hover:shadow-xl">

          {/* Park Name */}
          <div className="flex flex-col items-center justify-center w-full min-h-[90px]">
            <div className="min-h-[50px] flex items-center justify-center text-center px-2">
              <h1 className="text-3xl font-bold text-center">
                {park.name}
              </h1>
            </div>
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
            <p className={`text-5xl font-semibold py-4 ${getRatingColor(rating.overall)}`}>
              {rating.overall.toFixed(2)}
            </p>

            {/* Individual Scores */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 max-w-[320px] mx-auto text-center text-base">
              {[
                { label: "Park Appearance", value: rating.parkAppearance },
                { label: "Best Coaster", value: rating.bestCoaster },
                { label: "Water Rides", value: rating.waterRides },
                { label: "Ride Lineup", value: rating.rideLineup },
                { label: "Food", value: rating.food },
                { label: "Snacks & Drinks", value: rating.snacksAndDrinks },
                { label: "Park Practicality", value: rating.parkPracticality },
                { label: "Ride Operations", value: rating.rideOperations },
                { label: "Park Management", value: rating.parkManagement },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 min-h-[90px]">
                  <div className="min-h-[40px] flex items-center justify-center text-center">
                    <span className="text-sm font-medium">
                      {item.label}
                    </span>
                  </div>
                  <span className={`text-lg font-semibold w-10 text-center ${getRatingColor(item.value)}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </Link>
  );
};

export default RatingCard;
