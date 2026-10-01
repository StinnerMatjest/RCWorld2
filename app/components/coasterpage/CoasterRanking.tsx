"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";
import { computeCoasterRanks, type CoasterRankStats } from "@/app/utils/ranking";

type RankingCoaster = RollerCoaster & {
  lastVisitDate?: string | null;
  rideCount?: number;
};

// EXPORTED STATBLOCK
export const StatBlock = ({
  mainValue,
  subValue,
  label,
  subLabel,
  colorClass = "text-white",
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
        <span className="text-lg sm:text-xl md:text-2xl font-bold text-slate-600 ml-0.5">
          /{subValue}
        </span>
      )}
    </div>

    <div className="flex flex-col items-end">
      {label && (
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 text-right">
          {label}
        </span>
      )}

      {subLabel && (
        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide text-slate-400 text-right ${isLink ? 'group-hover:text-blue-400 transition-colors' : ''}`}>
          {subLabel}
        </span>
      )}
    </div>
  </div>
);

// EXPORTED SKELETON
export const SkeletonStatBlock = () => (
  <div className="flex flex-col items-end animate-pulse">
    <div className="flex items-baseline mb-1">
      <div className="h-8 w-12 sm:h-10 sm:w-16 md:h-14 md:w-20 bg-slate-800 rounded-lg"></div>
      <div className="h-5 w-6 sm:h-6 sm:w-8 md:h-8 md:w-10 bg-slate-800 rounded-lg ml-1"></div>
    </div>
    <div className="flex flex-col items-end gap-1 mt-1">
      <div className="h-2 w-16 sm:h-3 sm:w-24 bg-slate-800 rounded"></div>
    </div>
  </div>
);

interface CoasterRankingProps {
  coaster: RollerCoaster;
  allCoasters: RollerCoaster[];
  stats?: CoasterRankStats | null;
  parkName: string | null;
}

const CoasterRanking: React.FC<CoasterRankingProps> = ({ coaster, allCoasters, stats: propStats, parkName: propParkName }) => {
  const [showContent, setShowContent] = useState(false);
  const resolvedParkName = useMemo(() => {
    if (propParkName && propParkName !== "Unknown Park") return propParkName;
    const match = allCoasters.find(c => String(c.parkId) === String(coaster.parkId));
    return (match as any)?.parkName || propParkName || "Park";
  }, [propParkName, allCoasters, coaster.parkId]);

  const stats = useMemo(() => {
    if (!coaster) return null;
    // A client-side catalogue (admin refresh) wins over the server's numbers.
    if (allCoasters.length) return computeCoasterRanks(allCoasters, coaster);
    return propStats ?? null;
  }, [coaster, allCoasters, propStats]);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-slate-300";
    if (rank === 3) return "text-orange-400";
    return "text-white";
  };

  if (!stats) return null;

  const baseAnim = "transition-all duration-700 ease-out transform";
  const visible = "opacity-100 translate-y-0";
  const hidden = "opacity-0 translate-y-4";

  return (
    <div className="flex flex-wrap justify-end items-end gap-x-6 gap-y-4 sm:gap-8 md:gap-12 shrink-0">

      {/* PARK RANKING */}
      {stats.park.rank !== null && resolvedParkName && (
        <div className={`${baseAnim} ${showContent ? visible : hidden}`}>
          <Link
            // Use the resolved name for the filter
            href={`/coasterLibrary?q=${encodeURIComponent(resolvedParkName)}`}
            className="group cursor-pointer"
          >
            <StatBlock
              mainValue={stats.park.rank}
              subValue={stats.park.total}
              label={null}
              subLabel={resolvedParkName} // Use resolved name here
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
            // Use "?? ''" to ensure the string is never undefined
            href={`/coasterLibrary?q=${encodeURIComponent(coaster.manufacturerName ?? "")}`}
            className="group cursor-pointer"
          >
            <StatBlock
              mainValue={stats.manuf.rank}
              subValue={stats.manuf.total}
              label={null}
              // Use "??" to provide a fallback string
              subLabel={coaster.manufacturerName ?? "Unknown"}
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
            href="/coasterLibrary"
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