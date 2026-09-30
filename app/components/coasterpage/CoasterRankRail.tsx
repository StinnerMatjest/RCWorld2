"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

function Row({ rank, total, label, href }: { rank: number | null; total: number; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 px-3 py-2 md:py-3 hover:bg-slate-800/40 transition-colors group">
      <span className="text-xs md:text-sm font-medium text-slate-300 group-hover:text-white truncate">{label}</span>
      <span className="flex items-baseline gap-1 flex-shrink-0">
        <span className={`text-sm md:text-base font-bold tabular-nums ${rankColor(rank)}`}>{rank !== null ? `#${rank}` : "–"}</span>
        <span className="text-[11px] md:text-xs text-slate-500">/ {total}</span>
      </span>
    </Link>
  );
}

/**
 * The desktop left rail, in the place and style of the park page's visit
 * panel: a small label, then one row per ranking, and the ride count.
 */
export default function CoasterRankRail({ rideCount = 0, stats, parkName, parkSlug, parkId, manufacturerName, manufacturerId }: Props) {
  const parkHref = parkSlug ? `/park/${parkSlug}` : parkId ? `/park/${parkId}` : "/parks";
  const manufHref = manufacturerId ? `/manufacturers/directory?mfg=${manufacturerId}` : "/manufacturers";
  const ranked = !!stats && (stats.park.rank !== null || stats.manuf.rank !== null || stats.overall.rank !== null);
  return (
    <div className="space-y-6">
      <Link href={parkHref} className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors group">
        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
        {parkName || "Park"}
      </Link>

      {ranked && stats && (
        <div>
          <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Ranked</p>
          <div className="border-t border-slate-800 divide-y divide-slate-800/80">
            <Row rank={stats.park.rank} total={stats.park.total} label={parkName ?? "In park"} href={parkHref} />
            <Row rank={stats.manuf.rank} total={stats.manuf.total} label={manufacturerName ?? "Manufacturer"} href={manufHref} />
            <Row rank={stats.overall.rank} total={stats.overall.total} label="Worldwide" href="/coasterLibrary" />
          </div>
        </div>
      )}

      {rideCount > 0 && (
        <div>
          <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Ridden</p>
          <div className="border-t border-slate-800 px-3 py-2 md:py-3 flex items-baseline gap-1.5">
            <span className="text-sm md:text-base font-bold text-white tabular-nums">{rideCount}</span>
            <span className="text-xs md:text-sm text-slate-400">{rideCount === 1 ? "time" : "times"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
