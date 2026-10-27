"use client";

import React from "react";
import type { ParkRanks } from "@/app/utils/parkRanks";
import { rankColorClass, formatScore } from "@/app/utils/parkRanks";
import { getRatingColor } from "@/app/utils/design";

/** The three figures that follow the name: overall, rank in the country, rank worldwide. */
export function HeroStats({ overall, ranks, desktop = false }: { overall: number | null; ranks: ParkRanks | null; desktop?: boolean }) {
  const scoreColor = overall != null && overall > 0 ? getRatingColor(overall) : "text-slate-500";
  if (desktop) {
    // Desktop: three figures in a row, labels under, bottom right across from the name.
    return (
      <div className="flex items-end gap-10 xl:gap-12 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
        <div>
          <div className={`text-6xl xl:text-7xl font-black leading-none tracking-tighter tabular-nums ${scoreColor}`}>
            {overall != null ? formatScore(overall) : "NR"}
            {overall != null && <span className="ml-1 text-base font-bold text-slate-300/80 tracking-normal">/10</span>}
          </div>
          <div className="mt-1.5 text-xs uppercase tracking-widest text-slate-300 text-right">Overall</div>
        </div>
        {ranks?.country && (
          <div>
            <div className={`text-5xl xl:text-6xl font-black leading-none tracking-tighter tabular-nums ${rankColorClass(ranks.country.rank)}`}>#{ranks.country.rank}</div>
            <div className="mt-1.5 text-xs uppercase tracking-widest text-slate-300 text-right">{ranks.country.name}</div>
          </div>
        )}
        {ranks && (
          <div>
            <div className={`text-5xl xl:text-6xl font-black leading-none tracking-tighter tabular-nums ${rankColorClass(ranks.world.rank)}`}>#{ranks.world.rank}</div>
            <div className="mt-1.5 text-xs uppercase tracking-widest text-slate-300 text-right">World</div>
          </div>
        )}
      </div>
    );
  }
  // Phone: the score as the headline, the ranks inline on its baseline. No rules, no boxes.
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
      <span className={`text-[2.6rem] font-black leading-none tracking-tighter tabular-nums ${scoreColor}`}>
        {overall != null ? formatScore(overall) : "NR"}
        {overall != null && <span className="ml-1 text-xs font-bold text-slate-300/80 tracking-normal">/10</span>}
      </span>
      {ranks?.country && (
        <span className="inline-flex items-baseline gap-1.5">
          <span className={`text-2xl font-black leading-none tracking-tight tabular-nums ${rankColorClass(ranks.country.rank)}`}>#{ranks.country.rank}</span>
          <span className="text-[10px] uppercase tracking-widest text-slate-300">{ranks.country.name}</span>
        </span>
      )}
      {ranks && (
        <span className="inline-flex items-baseline gap-1.5">
          <span className={`text-2xl font-black leading-none tracking-tight tabular-nums ${rankColorClass(ranks.world.rank)}`}>#{ranks.world.rank}</span>
          <span className="text-[10px] uppercase tracking-widest text-slate-300">World</span>
        </span>
      )}
    </div>
  );
}
