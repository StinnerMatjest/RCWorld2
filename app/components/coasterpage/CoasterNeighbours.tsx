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

function Row({ c, current, showRank, showPark }: { c: CoasterMini; current: boolean; showRank: boolean; showPark: boolean }) {
  const s = score(c.rating);
  const inner = (
    <>
      {showRank && <span className={`w-9 text-right text-sm font-black tabular-nums ${current ? "text-brand" : "text-slate-500"}`}>#{c.rank}</span>}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm sm:text-base font-semibold ${current ? "text-white" : "text-slate-200 group-hover:text-white"}`}>{c.name}</span>
        {showPark && c.parkName && <span className="block truncate text-xs text-slate-500">{c.parkName}</span>}
        {!showPark && (c.manufacturerName || c.year) && (
          <span className="block truncate text-xs text-slate-500">{[c.manufacturerName, c.year].filter(Boolean).join(" · ")}</span>
        )}
      </span>
      <span className={`text-base sm:text-lg font-bold tabular-nums ${s ? getRatingColor(Number(c.rating)) : "text-slate-600"}`}>{s ?? "NR"}</span>
    </>
  );
  const cls = `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${current ? "bg-brand/10 border border-brand/40" : "hover:bg-slate-800/70"}`;
  if (current) return <div className={cls}>{inner}</div>;
  return <Link href={`/coasters/${c.slug}`} className={cls}>{inner}</Link>;
}

/**
 * Where this coaster sits and what else is worth riding: the two coasters
 * either side of it in the worldwide list, and the rest of its park's lineup.
 * Both are the questions a reader has next, and both are one tap away.
 */
export default function CoasterNeighbours({ currentId, ladder, siblings, parkName, parkSlug }: Props) {
  const hasLadder = ladder.length > 1;
  const hasSiblings = siblings.length > 0;
  if (!hasLadder && !hasSiblings) return null;
  return (
    <div className="space-y-8">
      {hasLadder && (
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-3">Where it ranks</h2>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-1.5 space-y-0.5">
            {ladder.map((c) => <Row key={c.id} c={c} current={c.id === currentId} showRank showPark />)}
          </div>
          <Link href="/coasterLibrary" className="inline-block mt-2 text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">
            Full ranking
          </Link>
        </section>
      )}
      {hasSiblings && (
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-3">More at {parkName ?? "this park"}</h2>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-1.5 space-y-0.5">
            {siblings.map((c) => <Row key={c.id} c={c} current={false} showRank={false} showPark={false} />)}
          </div>
          {parkSlug && (
            <Link href={`/park/${parkSlug}`} className="inline-block mt-2 text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">
              Park review
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
