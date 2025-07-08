import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Rating } from "../page";
import { Park } from "../page";
import { getParkFlag } from "@/app/utils/design";

interface RatingCardProps {
  rating: Rating;
  park: Park;
  delayIndex?: number;
}

const RatingCard: React.FC<RatingCardProps> = ({
  rating,
  park,
  delayIndex,
}) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 10.0) return "rainbow-animation";
    if (rating >= 9.0) return "text-blue-700 dark:text-blue-400";
    if (rating >= 7.5) return "text-green-600 dark:text-green-400";
    if (rating >= 6.5) return "text-green-400 dark:text-green-300";
    if (rating >= 5.5) return "text-yellow-400 dark:text-yellow-300";
    if (rating >= 4.5) return "text-yellow-600 dark:text-yellow-500";
    if (rating >= 3.0) return "text-red-400 dark:text-red-300";
    return "text-red-600 dark:text-red-500";
  };

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const groupedRow1 = [
    {
      label: "🎢 Coasters",
      average: avg([rating.bestCoaster, rating.coasterDepth]),
      details: [
        { label: "Best Coaster", value: rating.bestCoaster },
        { label: "Coaster Depth", value: rating.coasterDepth },
      ],
    },
    {
      label: "🎡 Rides",
      average: avg([rating.waterRides, rating.flatridesAndDarkRides]),
      details: [
        { label: "Water Rides", value: rating.waterRides },
        { label: "Flatrides/Darkrides", value: rating.flatridesAndDarkRides },
      ],
    },
  ];

  const groupedRow2 = [
    {
      label: "🏞️ Park",
      average: avg([rating.parkAppearance, rating.parkPracticality]),
      details: [
        { label: "Appearance", value: rating.parkAppearance },
        { label: "Practicality", value: rating.parkPracticality },
      ],
    },
    {
      label: "🍔 Food",
      average: avg([rating.food, rating.snacksAndDrinks]),
      details: [
        { label: "Food", value: rating.food },
        { label: "Snacks & Drinks", value: rating.snacksAndDrinks },
      ],
    },
    {
      label: "📋 Management",
      average: avg([rating.rideOperations, rating.parkManagement]),
      details: [
        { label: "Operations", value: rating.rideOperations },
        { label: "Management", value: rating.parkManagement },
      ],
    },
  ];

  return (
    <Link href={`/park/${rating.parkId}`}>
      <div
        className={`mx-auto flex flex-col justify-between w-full max-w-[400px] py-2 animate-fade-in-up ${
          delayIndex !== undefined ? `delay-${delayIndex % 6}` : ""
        }`}
      >
        <div className="flex flex-col items-center justify-between bg-blue-50 dark:bg-gray-800 rounded-2xl overflow-visible shadow-md dark:shadow-lg transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-xl">
          {/* Park Name */}
          <div className="flex flex-col items-center justify-center w-full min-h-[90px]">
            <div className="min-h-[50px] flex items-center justify-center text-center px-2">
              <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white flex items-center justify-center gap-2">
                <Image
                  src={getParkFlag(park.country)}
                  alt={`${park.country} flag`}
                  width={24}
                  height={16}
                  loading="lazy"
                  unoptimized
                  className="rounded-sm"
                />
                {park.name}
              </h1>
            </div>
          </div>

          {/* Park Image */}
          <figure className="w-full aspect-video overflow-hidden flex justify-center items-center bg-gray-100">
            <Image
              src={park.imagePath || "/images/error.PNG"}
              alt={park.name}
              height={500}
              width={500}
              loading="lazy"
              unoptimized
              className="w-full h-full object-cover"
            />
          </figure>

          {/* Rating Date */}
          <div className="text-sm italic py-1 text-gray-600 dark:text-gray-400">
            Date:
            {new Date(rating.date).toLocaleDateString()}
          </div>

          {/* Overall Score */}
          <p
            className={`text-6xl font-bold py-4 ${getRatingColor(
              rating.overall
            )}`}
          >
            {rating.overall.toFixed(2)}
          </p>

          {/* Separator */}
          <div className="w-3/4 border-t border-gray-300 dark:border-gray-600 my-2"></div>

          {/* Grouped Ratings Grid */}
          <div className="w-full max-w-[360px] px-0">
            {/* Row 1 - 2 Columns */}
            <div className="grid grid-cols-2 text-center text-base font-medium w-full">
              {groupedRow1.map((group, idx) => (
                <div
                  key={idx}
                  className={`relative group grid grid-rows-2 place-items-center text-center px-2 ${
                    idx > 0
                      ? "border-l border-gray-300 dark:border-gray-600"
                      : ""
                  }`}
                >
                  {/* Hover Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 text-sm shadow-xl rounded-lg p-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto whitespace-nowrap border border-gray-300 dark:border-gray-700 min-w-[180px]">
                    <div className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                      {group.label} Breakdown
                    </div>
                    <div className="space-y-1 text-gray-700 dark:text-gray-300">
                      {group.details.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{item.label}</span>
                          <span
                            className={`font-semibold ${getRatingColor(
                              item.value
                            )}`}
                          >
                            {item.value.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Label */}
                  <span className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {group.label}
                  </span>

                  {/* Score */}
                  <span
                    className={`text-2xl sm:text-3xl font-bold ${getRatingColor(
                      group.average
                    )}`}
                  >
                    {group.average.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Row 2 - 3 Columns */}
            <div className="grid grid-cols-3 text-center text-base font-medium w-full border-t border-gray-300 dark:border-gray-600">
              {groupedRow2.map((group, idx) => (
                <div
                  key={idx}
                  className={`relative group grid grid-rows-2 place-items-center text-center px-2 ${
                    idx > 0
                      ? "border-l border-gray-300 dark:border-gray-600"
                      : ""
                  }`}
                >
                  {/* Hover Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 text-sm shadow-xl rounded-lg p-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto whitespace-nowrap border border-gray-300 dark:border-gray-700 min-w-[180px]">
                    <div className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                      {group.label} Breakdown
                    </div>
                    <div className="space-y-1 text-gray-700 dark:text-gray-300">
                      {group.details.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{item.label}</span>
                          <span
                            className={`font-semibold ${getRatingColor(
                              item.value
                            )}`}
                          >
                            {item.value.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Label */}
                  <span className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {group.label}
                  </span>

                  {/* Score */}
                  <span
                    className={`text-2xl sm:text-3xl font-bold ${getRatingColor(
                      group.average
                    )}`}
                  >
                    {group.average.toFixed(2)}
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
