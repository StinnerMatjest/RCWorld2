"use client";

import React from "react";
import Link from "next/link";
import type { CoasterRankStats } from "@/app/utils/ranking";

interface Props {
  stats: CoasterRankStats | null;
  parkName: string | null;
  parkSlug: string | null;
  parkId: number | null;
  manufacturerName?: string | null;
  manufacturerId?: number | null;
}

const rankColor = (rank: number | null) => {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-slate-200";
  if (rank === 3) return "text-orange-400";
  return "text-white";
};

function RankCard({ rank, total, label, href }: { rank: number | null; total: number; label: string; href: string }) {
  const inner = (
    <>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl sm:text-4xl font-black tracking-tighter leading-none ${rankColor(rank)}`}>
          {rank !== null ? `#${rank}` : "–"}
        </span>
        {rank !== null && <span className="text-xs sm:text-sm font-semibold text-slate-500">of {total}</span>}
      </div>
      <p className="mt-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest text-slate-400 leading-tight line-clamp-2">{label}</p>
    </>
  );
  const cls = "block min-w-0 rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-3 sm:px-4 sm:py-4 hover:border-slate-600 transition-colors";
  return <Link href={href} className={cls} title={`${label}: rank ${rank ?? "–"} of ${total}`}>{inner}</Link>;
}

/**
 * The three ranks a reader actually asks about (in its park, among its
 * manufacturer's coasters, worldwide). Each links to the list it ranks in.
 */
export default function CoasterRankStrip({ stats, parkName, parkSlug, parkId, manufacturerName, manufacturerId }: Props) {
  if (!stats) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-3 sm:px-4 sm:py-4 animate-pulse">
            <div className="h-8 w-14 bg-slate-800 rounded" />
            <div className="h-3 w-20 bg-slate-800 rounded mt-2.5" />
          </div>
        ))}
      </div>
    );
  }
  // Unrated coasters rank nowhere; three dashes would only say so three times.
  if (stats.park.rank === null && stats.manuf.rank === null && stats.overall.rank === null) return null;
  const parkHref = parkSlug ? `/park/${parkSlug}` : parkId ? `/park/${parkId}` : "/parks";
  const manufHref = manufacturerId ? `/manufacturers/directory?mfg=${manufacturerId}` : "/manufacturers";
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <RankCard rank={stats.park.rank} total={stats.park.total} label={parkName ?? "in park"} href={parkHref} />
      <RankCard rank={stats.manuf.rank} total={stats.manuf.total} label={manufacturerName ? `${manufacturerName}` : "manufacturer"} href={manufHref} />
      <RankCard rank={stats.overall.rank} total={stats.overall.total} label="worldwide" href="/coasterLibrary" />
    </div>
  );
}
