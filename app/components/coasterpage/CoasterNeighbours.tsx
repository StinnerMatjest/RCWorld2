"use client";

import React from "react";
import Link from "next/link";
import { getRatingColor } from "@/app/utils/design";
import type { CoasterMini } from "./coasterPageTypes";

interface Props {
  currentId: number;
  /** Ranked neighbours worldwide, including the coaster itself, in rank order. */
  ladder: CoasterMini[];
  /** Other coasters at the same park, best first. */
  siblings: CoasterMini[];
  parkName: string | null;
  parkSlug: string | null;
}

const score = (r: number | null) => {
  if (r === null || Number.isNaN(Number(r)) || Number(r) <= 0) return null;
  const n = Number(r);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

// Same podium colours as the coaster library's rank column.
const rankColor = (rank?: number) => (rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-orange-400" : "text-slate-500");

function Row({ c, current, showRank, showPark }: { c: CoasterMini; current: boolean; showRank: boolean; showPark: boolean }) {
  const s = score(c.rating);
  const sub = showPark ? c.parkName : [c.manufacturerName, c.year].filter(Boolean).join(" · ");
  const inner = (
    <>
      {showRank && <span className={`w-7 text-sm font-bold tabular-nums ${rankColor(c.rank)}`}>{c.rank}</span>}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm md:text-[15px] font-semibold ${current ? "text-brand" : "text-slate-100 group-hover:text-white"}`}>{c.name}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
      <span className={`text-sm md:text-base font-bold tabular-nums ${s ? getRatingColor(Number(c.rating)) : "text-slate-600"}`}>{s ?? "NR"}</span>
    </>
  );
  const cls = "group flex items-center gap-3 py-2.5";
  if (current) return <div className={cls}>{inner}</div>;
  return <Link href={`/coasters/${c.slug}`} className={cls}>{inner}</Link>;
}

/**
 * The two coasters either side of this one in the worldwide list, and the
 * rest of its park's lineup: the two things a reader looks for next. Set as
 * plain ranked rows with thin rules, like the coaster library.
 */
export default function CoasterNeighbours({ currentId, ladder, siblings, parkName, parkSlug }: Props) {
  const hasLadder = ladder.length > 1;
  const hasSiblings = siblings.length > 0;
  if (!hasLadder && !hasSiblings) return null;
  return (
    <div className="space-y-8">
      {hasLadder && (
        <section>
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400">Where it ranks</p>
            <Link href="/coasterLibrary" className="text-[11px] font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">Full list</Link>
          </div>
          <div className="divide-y divide-slate-800 border-t border-slate-800">
            {ladder.map((c) => <Row key={c.id} c={c} current={c.id === currentId} showRank showPark />)}
          </div>
        </section>
      )}
      {hasSiblings && (
        <section>
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400">More at {parkName ?? "this park"}</p>
            {parkSlug && (
              <Link href={`/park/${parkSlug}`} className="text-[11px] font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">Park review</Link>
            )}
          </div>
          <div className="divide-y divide-slate-800 border-t border-slate-800">
            {siblings.map((c) => <Row key={c.id} c={c} current={false} showRank={false} showPark={false} />)}
          </div>
        </section>
      )}
    </div>
  );
}
