"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";

export const StatBlock = ({ 
  mainValue, 
  subValue, 
  label, 
  subLabel, 
  colorClass = "text-gray-900 dark:text-white",
  isLink = false
}: { 
  mainValue: string | number | null;
  subValue?: string | number | null;
  label?: string | null;
  subLabel?: string | null;
  colorClass?: string;
  isLink?: boolean;
}) => (
    <div className="flex flex-col items-end">
      {/* Numbers Row */}
      <div className="flex items-baseline leading-none mb-1">
        <span className={`text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter ${colorClass}`}>
          {mainValue}
        </span>
        {subValue && (
          <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400 dark:text-gray-600 ml-0.5">
            /{subValue}
          </span>
        )}
      </div>
      
      <div className="flex flex-col items-end">
          {label && (
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 text-right">
                {label}
            </span>
          )}
          
          {subLabel && (
            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 text-right ${isLink ? 'group-hover:text-blue-500 transition-colors' : ''}`}>
                {subLabel}
            </span>
          )}
      </div>
    </div>
);

export const SkeletonStatBlock = () => (
  <div className="flex flex-col items-end animate-pulse">
    <div className="flex items-baseline mb-1">
      <div className="h-8 w-12 sm:h-10 sm:w-16 md:h-14 md:w-20 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
      <div className="h-5 w-6 sm:h-6 sm:w-8 md:h-8 md:w-10 bg-gray-200 dark:bg-gray-800 rounded-lg ml-1"></div>
    </div>
    <div className="flex flex-col items-end gap-1 mt-1">
      <div className="h-2 w-16 sm:h-3 sm:w-24 bg-gray-200 dark:bg-gray-800 rounded"></div>
    </div>
  </div>
);

interface CoasterRankingProps {
  coaster: RollerCoaster;
  allCoasters: RollerCoaster[];
  parkName: string | null;
}

const CoasterRanking: React.FC<CoasterRankingProps> = ({ coaster, allCoasters, parkName }) => {
  const [showContent, setShowContent] = useState(false);

  // 1. Calculate Ranks
  const stats = useMemo(() => {
    if (!coaster || !allCoasters.length) return null;

    const processList = (list: RollerCoaster[]) => {
      const sorted = list
        .filter((c) => (c.rating ?? 0) > 0)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      
      const rankIndex = sorted.findIndex((c) => c.id === coaster.id);
      
      return {
        total: sorted.length,
        rank: rankIndex !== -1 ? rankIndex + 1 : null,
      };
    };

    return {
      park: processList(allCoasters.filter((c) => c.parkId === coaster.parkId)),
      manuf: processList(allCoasters.filter((c) => c.manufacturer === coaster.manufacturer)),
      overall: processList(allCoasters),
    };
  }, [coaster, allCoasters]);

  // 2. Trigger Entry Animation
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-500 dark:text-yellow-400";
    if (rank === 2) return "text-gray-400 dark:text-gray-300";
    if (rank === 3) return "text-orange-500 dark:text-orange-400";
    return "text-gray-900 dark:text-white";
  };

  if (!stats) return null;

  const baseAnim = "transition-all duration-700 ease-out transform";
  const visible = "opacity-100 translate-y-0";
  const hidden = "opacity-0 translate-y-4";

  return (
    <div className="flex flex-wrap justify-end items-end gap-x-6 gap-y-4 sm:gap-8 md:gap-12 shrink-0">
      
      {/* PARK RANKING */}
      {stats.park.rank !== null && parkName && (
        <div className={`${baseAnim} ${showContent ? visible : hidden}`}>
            <Link 
            href={`/coasterratings?q=${encodeURIComponent(parkName)}`}
            className="group cursor-pointer"
            >
            <StatBlock 
                mainValue={stats.park.rank}
                subValue={stats.park.total}
                label={null}
                subLabel={parkName} 
                colorClass={getRankColor(stats.park.rank)}
                isLink={true}
            />
            </Link>
        </div>
      )}

      {/* MANUFACTURER RANKING */}
      {stats.manuf.rank !== null && (
        <div className={`${baseAnim} ${showContent ? visible : hidden} delay-100`}>
            <Link 
            href={`/coasterratings?q=${encodeURIComponent(coaster.manufacturer)}`}
            className="group cursor-pointer"
            >
            <StatBlock 
                mainValue={stats.manuf.rank}
                subValue={stats.manuf.total}
                label={null}
                subLabel={coaster.manufacturer}
                colorClass={getRankColor(stats.manuf.rank)}
                isLink={true}
            />
            </Link>
        </div>
      )}

      {/* WORLDWIDE RANKING */}
      {stats.overall.rank !== null && (
        <div className={`${baseAnim} ${showContent ? visible : hidden} delay-200`}>
            <Link 
            href="/coasterratings"
            className="group cursor-pointer"
            >
            <StatBlock 
                mainValue={stats.overall.rank}
                subValue={stats.overall.total}
                label={null}
                subLabel="Worldwide"
                colorClass={getRankColor(stats.overall.rank)}
                isLink={true}
            />
            </Link>
        </div>
      )}
    </div>
  );
};

export default CoasterRanking;