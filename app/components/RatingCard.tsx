import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { Rating } from "../page";
import { Park } from "../page";
import { getParkFlag, getRatingColor } from "@/app/utils/design";
import { fieldToGroupLabel } from "@/app/utils/ratings";
import { RatingWarningType } from "@/app/types";

interface RatingCardProps {
  rating: Rating;
  park: Park;
  ratingWarnings?: RatingWarningType[];
  delayIndex?: number;
}

const RatingCard: React.FC<RatingCardProps> = ({
  rating,
  park,
  ratingWarnings,
  delayIndex,
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setActiveIdx(null);
      }
    };
    const closeOnScroll = () => setActiveIdx(null);

    document.addEventListener("click", closeOnOutside);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("click", closeOnOutside);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, []);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const groupedRow1 = [
    {
      emoji: "🎢",
      label: "Coasters",
      average: avg([rating.bestCoaster, rating.coasterDepth]),
      details: [
        { label: "Best Coaster", value: rating.bestCoaster },
        { label: "Coaster Depth", value: rating.coasterDepth },
      ],
    },
    {
      emoji: "🎡",
      label: "Rides",
      average: avg([rating.waterRides, rating.flatridesAndDarkrides]),
      details: [
        { label: "Water Rides", value: rating.waterRides },
        { label: "Flatrides/Darkrides", value: rating.flatridesAndDarkrides },
      ],
    },
  ];

  const groupedRow2 = [
    {
      emoji: "🏞️",
      label: "Park",
      average: avg([rating.parkAppearance, rating.parkPracticality]),
      details: [
        { label: "Appearance", value: rating.parkAppearance },
        { label: "Practicality", value: rating.parkPracticality },
      ],
    },
    {
      emoji: "🍔",
      label: "Food",
      average: avg([rating.food, rating.snacksAndDrinks]),
      details: [
        { label: "Food", value: rating.food },
        { label: "Snacks & Drinks", value: rating.snacksAndDrinks },
      ],
    },
    {
      emoji: "📋",
      label: "Management",
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
        ref={cardRef}
        className={`mx-auto flex flex-col justify-between w-full max-w-[400px] ${
          isMobile ? "py-3" : "py-4"
        } animate-fade-in-up ${
          delayIndex !== undefined ? `delay-${delayIndex % 6}` : ""
        }`}
      >
        <div className="flex flex-col items-center justify-between bg-blue-50 dark:bg-[#1e293b] rounded-2xl overflow-hidden shadow-md dark:shadow-lg transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-xl transform-gpu will-change-transform">
          <div
            className={`flex flex-col items-center justify-center w-full ${
              isMobile ? "min-h-[56px] px-2" : "min-h-[80px]"
            }`}
          >
            <div className="flex items-center justify-center text-center min-w-0">
              <h1
                className={`${
                  isMobile
                    ? "text-[clamp(1.15rem,4vw,1.75rem)] truncate"
                    : "text-[1.75rem]"
                } font-bold text-gray-900 dark:text-white flex items-center gap-2`}
              >
                <Image
                  src={getParkFlag(park.country)}
                  alt={`${park.country} flag`}
                  width={isMobile ? 22 : 24}
                  height={16}
                  loading="lazy"
                  className="rounded-sm shrink-0"
                  unoptimized
                />
                {park.name}
              </h1>
            </div>
          </div>

          <figure
            className={`w-full aspect-[16/9] md:aspect-video overflow-hidden bg-gray-100 will-change-transform transition-transform duration-350 ease-[cubic-bezier(0.33,1,0.68,1)]`}
            style={{
              transform: isMobile
                ? "translateX(calc(var(--px, 0px) / 1))"
                : "translateX(0px)",
            }}
          >
            <Image
              src={park.imagePath || "/images/error.PNG"}
              alt={park.name}
              height={500}
              width={500}
              loading="lazy"
              className="w-full h-full object-cover"
              unoptimized
            />
          </figure>

          <div className="text-sm italic py-1 text-gray-600 dark:text-gray-400">
            Date: {new Date(rating.date).toLocaleDateString()}
          </div>

          <p
            className={`${
              isMobile
                ? "font-extrabold py-1 tabular-nums leading-none text-[clamp(2.25rem,7.5vw,3.25rem)]"
                : "text-5xl font-bold py-2"
            } ${getRatingColor(rating.overall)}`}
          >
            {rating.overall.toFixed(2)}
          </p>

          <div
            className={`${
              isMobile ? "w-10/12 my-1.5" : "w-3/4 my-2"
            } border-t border-gray-300 dark:border-gray-600`}
          />

          <div
            className={`w-full max-w-[360px] flex flex-col ${
              isMobile ? "px-3 pb-3 space-y-1" : "px-4 pb-4"
            }`}
          >
            {[...groupedRow1, ...groupedRow2].map((group, idx) => {
              const isActive = activeIdx === idx;

              const warningsForGroup: RatingWarningType[] =
                ratingWarnings?.filter(
                  (w: RatingWarningType) =>
                    fieldToGroupLabel[w.category] === group.label
                ) ?? [];

              const hasWarnings = warningsForGroup.length > 0;
              const multipleWarnings = warningsForGroup.length > 1;

              return (
                <React.Fragment key={idx}>
                  {idx !== 0 && (
                    <hr
                      className={`${
                        isMobile ? "my-1" : "my-2"
                      } border-t border-gray-300 dark:border-gray-600`}
                    />
                  )}

                  <div
                    className={`relative group cursor-pointer rounded-md ${
                      isMobile
                        ? "p-1 hover:bg-blue-100/60 dark:hover:bg-white/10"
                        : "p-2 hover:bg-blue-100 dark:hover:bg-white/10"
                    } transition duration-200 ease-in-out hover:shadow-md`}
                    onClick={(e) => {
                      if (isMobile) {
                        e.preventDefault();
                        setActiveIdx(isActive ? null : idx);
                      }
                    }}
                  >
                    {!isMobile && (
                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 text-sm shadow-xl rounded-lg p-3 z-[60] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-gray-300 dark:border-gray-700 min-w-[200px]">
                        <div className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                          {group.label} Breakdown
                        </div>
                        <div className="space-y-1 text-gray-700 dark:text-gray-300 text-sm">
                          {group.details.map((item, i) => (
                            <div key={i} className="flex justify-between gap-4">
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

                        {hasWarnings && (
                          <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                            <div className="text-gray-800 dark:text-gray-200 font-semibold">
                              Rating warning
                              {warningsForGroup.length > 1 ? "s" : ""}
                            </div>

                            {warningsForGroup.map((w, i) => (
                              <div
                                key={i}
                                className="space-y-0.5 whitespace-pre-line"
                              >
                                <div className="flex items-center gap-1">
                                  <p
                                    className={`font-semibold ${
                                      multipleWarnings
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-yellow-500 dark:text-yellow-400"
                                    }`}
                                  >
                                    {w.ride}
                                  </p>
                                  <AlertTriangle
                                    className={`ml-1 w-3.5 h-3.5 ${
                                      multipleWarnings
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-yellow-500 dark:text-yellow-400"
                                    }`}
                                  />
                                </div>
                                <p className="opacity-90">{w.note}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isMobile && isActive && (
                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 text-sm shadow-xl rounded-lg p-3 z-[60] border border-gray-300 dark:border-gray-700 min-w-[200px]">
                        <div className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                          {group.label} Breakdown
                        </div>
                        <div className="space-y-1 text-gray-700 dark:text-gray-300 text-sm">
                          {group.details.map((item, i) => (
                            <div key={i} className="flex justify-between gap-4">
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

                        {hasWarnings && (
                          <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                            <div className="text-gray-800 dark:text-gray-200 font-semibold">
                              Rating warning
                              {warningsForGroup.length > 1 ? "s" : ""}
                            </div>

                            {warningsForGroup.map((w, i) => (
                              <div
                                key={i}
                                className="space-y-0.5 whitespace-pre-line"
                              >
                                <div className="flex items-center gap-1">
                                  <p
                                    className={`font-semibold ${
                                      multipleWarnings
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-yellow-500 dark:text-yellow-400"
                                    }`}
                                  >
                                    {w.ride}
                                  </p>
                                  <AlertTriangle
                                    className={`ml-1 w-3.5 h-3.5 ${
                                      multipleWarnings
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-yellow-500 dark:text-yellow-400"
                                    }`}
                                  />
                                </div>
                                <p className="opacity-90">{w.note}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isMobile ? (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 w-full min-w-0">
                        <span className="text-[1.05rem] font-semibold truncate flex items-center gap-1">
                          {group.emoji} {group.label}
                          {hasWarnings && (
                            <AlertTriangle
                              className={`ml-1 w-4 h-4 ${
                                multipleWarnings
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-yellow-500 dark:text-yellow-400"
                              }`}
                            />
                          )}
                        </span>
                        <span
                          className={`text-[1.1rem] font-bold tabular-nums ${getRatingColor(
                            group.average
                          )}`}
                        >
                          {group.average.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-gray-800 dark:text-gray-200">
                        <span className="text-3xl hidden sm:inline">
                          {group.emoji}
                        </span>
                        <div className="flex items-center gap-6 w-full justify-between">
                          <span className="text-lg font-semibold flex items-center gap-1">
                            {group.label}
                            {hasWarnings && (
                              <AlertTriangle
                                className={`ml-2 w-4 h-4 ${
                                  multipleWarnings
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-yellow-500 dark:text-yellow-400"
                                }`}
                              />
                            )}
                          </span>
                          <span
                            className={`text-2xl font-bold ${getRatingColor(
                              group.average
                            )}`}
                          >
                            {group.average.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default RatingCard;
