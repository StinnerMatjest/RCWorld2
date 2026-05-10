import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { getParkFlag, getRatingColor } from "@/app/utils/design";
import { fieldToGroupLabel } from "@/app/utils/ratings";
import { RatingWarningType, Park, Rating } from "@/app/types";

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

  // Detect mobile once + on resize
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close popup on outside click, and on scroll only for desktop
  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setActiveIdx(null);
      }
    };

    document.addEventListener("click", closeOnOutside);

    // Only close on scroll for non-mobile, to avoid fighting horizontal swipe
    let closeOnScroll: (() => void) | null = null;

    if (!isMobile) {
      closeOnScroll = () => setActiveIdx(null);
      window.addEventListener("scroll", closeOnScroll, true);
    }

    return () => {
      document.removeEventListener("click", closeOnOutside);
      if (closeOnScroll) {
        window.removeEventListener("scroll", closeOnScroll, true);
      }
    };
  }, [isMobile]);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const groupedRow1 = [
    {
      emoji: "🎢",
      label: "Coasters",
      keys: ["bestCoaster", "coasterDepth", "Best Coaster", "Coaster Depth"],
      average: avg([rating.bestCoaster, rating.coasterDepth]),
      details: [
        { label: "Best Coaster", value: rating.bestCoaster },
        { label: "Coaster Depth", value: rating.coasterDepth },
      ],
    },
    {
      emoji: "🎡",
      label: "Rides",
      keys: ["waterRides", "flatridesAndDarkrides", "Water Rides", "Flatrides And Darkrides"],
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
      keys: ["parkAppearance", "parkPracticality", "Park Appearance", "Park Practicality"],
      average: avg([rating.parkAppearance, rating.parkPracticality]),
      details: [
        { label: "Appearance", value: rating.parkAppearance },
        { label: "Practicality", value: rating.parkPracticality },
      ],
    },
    {
      emoji: "🍔",
      label: "Food",
      keys: ["food", "snacksAndDrinks", "Food", "Snacks And Drinks"],
      average: avg([rating.food, rating.snacksAndDrinks]),
      details: [
        { label: "Food", value: rating.food },
        { label: "Snacks & Drinks", value: rating.snacksAndDrinks },
      ],
    },
    {
      emoji: "📋",
      label: "Management",
      keys: ["rideOperations", "parkManagement", "Ride Operations", "Park Management"],
      average: avg([rating.rideOperations, rating.parkManagement]),
      details: [
        { label: "Operations", value: rating.rideOperations },
        { label: "Management", value: rating.parkManagement },
      ],
    },
  ];

  return (
    <Link href={`/park/${park.slug}`}>
      <div
        ref={cardRef}
        className={`mx-auto flex flex-col justify-between w-full max-w-[400px] ${isMobile ? "py-3" : "py-4"
          } animate-fade-in-up ${delayIndex !== undefined ? `delay-${delayIndex % 6}` : ""
          }`}
      >
        <div className="flex flex-col items-center justify-between 
    bg-blue-50 dark:bg-[#1e293b] rounded-2xl overflow-hidden 
    shadow-md dark:shadow-lg transition-transform duration-300 ease-in-out 
    hover:scale-105 hover:shadow-xl transform-gpu will-change-transform">

          {/* Park Name */}
          <div
            className={`flex flex-col items-center justify-center w-full ${isMobile ? "min-h-[56px] px-2" : "min-h-[80px]"
              }`}
          >
            <div className="flex items-center justify-center text-center min-w-0">
              <h1
                className={`${isMobile
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

          {/* Park Image */}
          <figure
            className={`w-full aspect-[16/9] md:aspect-video overflow-hidden bg-gray-200 dark:bg-gray-800 will-change-transform transition-transform duration-350 ease-[cubic-bezier(0.33,1,0.68,1)]`}
            style={{
              transform: isMobile
                ? "translateX(calc(var(--px, 0px) / 1))"
                : "translateX(0px)",
            }}
          >
            <Image
              src={park.imagepath || "/images/error.PNG"}
              alt={park.name}
              height={500}
              width={500}
              priority={typeof delayIndex === 'number' && delayIndex < 6}
              className="w-full h-full object-cover"
              unoptimized
            />
          </figure>

          {/* Rating Date & Status */}
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="text-sm italic text-gray-600 dark:text-gray-400">
              Date: {new Date(rating.date).toLocaleDateString()}
            </div>
            {!rating.published && (
              <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-red-200 dark:border-red-800">
                Draft
              </span>
            )}
          </div>

          {/* Overall Score */}
          <p
            className={`${isMobile
              ? "font-extrabold py-1 tabular-nums leading-none text-[clamp(2.25rem,7.5vw,3.25rem)]"
              : "text-5xl font-bold py-2"
              } ${getRatingColor(rating.overall)}`}
          >
            {rating.overall.toFixed(2)}
          </p>

          {/* Separator */}
          <div
            className={`${isMobile ? "w-10/12 my-1.5" : "w-3/4 my-2"
              } border-t border-gray-300 dark:border-gray-600`}
          />

          {/* Grouped Ratings */}
          <div
            className={`w-full max-w-[360px] flex flex-col ${isMobile ? "px-3 pb-3 space-y-1" : "px-4 pb-4"
              }`}
          >
            {[...groupedRow1, ...groupedRow2].map((group, idx) => {
              const isActive = activeIdx === idx;

              const warningsForGroup: RatingWarningType[] =
                ratingWarnings?.filter((w: RatingWarningType) => {
                  const normalizedWarningCat = w.category.toLowerCase().replace(/\s+/g, '');
                  return group.keys?.some(k => k.toLowerCase().replace(/\s+/g, '') === normalizedWarningCat);
                }) ?? [];

              const hasWarnings = warningsForGroup.length > 0;

              let highestSeverityLevel = 0;
              warningsForGroup.forEach((w) => {
                const sev = w.severity || "Moderate";
                if (sev === "Major") highestSeverityLevel = Math.max(highestSeverityLevel, 2);
                else if (sev === "Moderate") highestSeverityLevel = Math.max(highestSeverityLevel, 1);
              });

              let warningColorClass = "";
              if (warningsForGroup.length === 1) {
                if (highestSeverityLevel === 2) warningColorClass = "text-red-600 dark:text-red-400";
                else if (highestSeverityLevel === 1) warningColorClass = "text-yellow-500 dark:text-yellow-400";
                else warningColorClass = "text-gray-400 dark:text-gray-500";
              } else if (warningsForGroup.length >= 2) {
                if (highestSeverityLevel === 2) warningColorClass = "text-slate-900 dark:text-white drop-shadow-sm";
                else if (highestSeverityLevel === 1) warningColorClass = "text-red-600 dark:text-red-400";
                else warningColorClass = "text-yellow-500 dark:text-yellow-400";
              }

              return (
                <React.Fragment key={idx}>
                  {idx !== 0 && (
                    <hr
                      className={`${isMobile ? "my-1" : "my-2"
                        } border-t border-gray-300 dark:border-gray-600`}
                    />
                  )}

                  <div
                    className={`relative group cursor-pointer rounded-md ${isMobile
                      ? "p-1 hover:bg-blue-100/60 dark:hover:bg-white/10"
                      : "p-2 hover:bg-blue-100 dark:hover:bg-white/10"
                      } transition duration-200 ease-in-out hover:shadow-md`}
                    onClick={(e) => {
                      if (isMobile) {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveIdx(isActive ? null : idx);
                      }
                    }}
                  >
                    {/* Desktop hover tooltip */}
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
                              Rating warning{warningsForGroup.length > 1 ? "s" : ""}
                            </div>

                            {warningsForGroup.map((w, i) => {
                              const indColor = w.severity === "Major" ? "text-red-600 dark:text-red-400" :
                                w.severity === "Minor" ? "text-gray-500 dark:text-gray-400" :
                                  "text-yellow-500 dark:text-yellow-400";
                              return (
                                <div key={i} className="space-y-0.5 whitespace-pre-line">
                                  <div className="flex items-center gap-1">
                                    <p className={`font-semibold ${indColor}`}>
                                      {w.ride}
                                    </p>
                                    <AlertTriangle className={`ml-1 w-3.5 h-3.5 ${indColor}`} />
                                  </div>
                                  <p className="opacity-90">{w.note}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile click tooltip */}
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
                              Rating warning{warningsForGroup.length > 1 ? "s" : ""}
                            </div>

                            {warningsForGroup.map((w, i) => {
                              const indColor = w.severity === "Major" ? "text-red-600 dark:text-red-400" :
                                w.severity === "Minor" ? "text-gray-500 dark:text-gray-400" :
                                  "text-yellow-500 dark:text-yellow-400";
                              return (
                                <div key={i} className="space-y-0.5 whitespace-pre-line">
                                  <div className="flex items-center gap-1">
                                    <p className={`font-semibold ${indColor}`}>
                                      {w.ride}
                                    </p>
                                    <AlertTriangle className={`ml-1 w-3.5 h-3.5 ${indColor}`} />
                                  </div>
                                  <p className="opacity-90">{w.note}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row Content */}
                    {isMobile ? (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 w-full min-w-0">
                        <span className="text-[1.05rem] font-semibold truncate flex items-center gap-1">
                          {group.emoji} {group.label}
                          {hasWarnings && (
                            <AlertTriangle className={`ml-1 w-4 h-4 ${warningColorClass}`} />
                          )}
                        </span>
                        <span className={`text-[1.1rem] font-bold tabular-nums ${getRatingColor(group.average)}`}>
                          {group.average.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-gray-800 dark:text-gray-200">
                        <span className="text-3xl hidden sm:inline">{group.emoji}</span>
                        <div className="flex items-center gap-6 w-full justify-between">
                          <span className="text-lg font-semibold flex items-center gap-1">
                            {group.label}
                            {hasWarnings && (
                              <AlertTriangle className={`ml-2 w-4 h-4 ${warningColorClass}`} />
                            )}
                          </span>
                          <span className={`text-2xl font-bold ${getRatingColor(group.average)}`}>
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

export default React.memo(RatingCard);