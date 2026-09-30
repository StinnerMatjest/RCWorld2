"use client";

import React from "react";
import Link from "next/link";
import type { CoasterRankStats } from "@/app/utils/ranking";

interface Props {
  rideCount?: number;
  stats: CoasterRankStats | null;
  parkName: string | null;
  parkSlug: string | null;
  parkId: number | null;
  manufacturerName?: string | null;
  manufacturerId?: number | null;
}

// Same podium colours as the coaster library's rank column.
const rankColor = (rank: number | null) => (rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-orange-400" : "text-white");

function Rank({ rank, total, label, href }: { rank: number | null; total: number; label: string; href: string }) {
  return (
    <Link href={href} className="group min-w-0" title={`${label}: ${rank !== null ? `#${rank}` : "unranked"} of ${total}`}>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl sm:text-4xl font-black tabular-nums leading-none ${rankColor(rank)}`}>{rank !== null ? `#${rank}` : "–"}</span>
        <span className="text-[11px] sm:text-xs text-slate-500">of {total}</span>
      </div>
      <div className="mt-1 text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider leading-tight truncate group-hover:text-slate-200 transition-colors">{label}</div>
    </Link>
  );
}

/**
 * The line under the hero: where the coaster stands in its park, among its
 * manufacturer's rides and worldwide, plus how often we've ridden it.
 */
export default function CoasterScoreRow({ rideCount = 0, stats, parkName, parkSlug, parkId, manufacturerName, manufacturerId }: Props) {
  const ranked = !!stats && (stats.park.rank !== null || stats.manuf.rank !== null || stats.overall.rank !== null);
  if (!ranked || !stats) return null;
  const parkHref = parkSlug ? `/park/${parkSlug}` : parkId ? `/park/${parkId}` : "/parks";
  const manufHref = manufacturerId ? `/manufacturers/directory?mfg=${manufacturerId}` : "/manufacturers";

  return (
    <div className="flex items-end justify-between gap-4 border-b border-slate-800 pb-5">
      <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-x-12 md:gap-x-16 flex-1 min-w-0">
        <Rank rank={stats.park.rank} total={stats.park.total} label={parkName ?? "in park"} href={parkHref} />
        <Rank rank={stats.manuf.rank} total={stats.manuf.total} label={manufacturerName ?? "manufacturer"} href={manufHref} />
        <Rank rank={stats.overall.rank} total={stats.overall.total} label="Worldwide" href="/coasterLibrary" />
      </div>
      {rideCount > 0 && (
        <div className="hidden sm:block text-right flex-shrink-0">
          <div className="text-3xl sm:text-4xl font-black tabular-nums leading-none text-white">{rideCount}</div>
          <div className="mt-1 text-xs text-slate-400 uppercase tracking-wider">{rideCount === 1 ? "ride" : "rides"}</div>
        </div>
      )}
    </div>
  );
}
