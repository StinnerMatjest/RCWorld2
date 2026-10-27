"use client";

import React from "react";
import type { Visit } from "@/app/types";
import type { ParkRanks } from "@/app/utils/parkRanks";
import { PARK_GROUPS, rankColorClass, formatScore } from "@/app/utils/parkRanks";
import { getRatingColor } from "@/app/utils/design";

interface Props {
  rating: Visit;
  ranks: ParkRanks | null;
  /** Rail version: a small label above the rows. */
  label?: string;
  className?: string;
}

/**
 * The five group scores of this visit with the park's rank worldwide for each
 * group. A row is a link to the first review section of that group.
 */
export default function ParkScorecard({ rating, ranks, label, className = "" }: Props) {
  const jump = (section: string) => {
    const el = document.getElementById(`section-${section}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const r = rating as unknown as Record<string, unknown>;

  return (
    <div className={className}>
      {label && <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>}
      <ul>
        {PARK_GROUPS.map((g) => {
          const score = (Number(r[g.visit[0]] ?? 0) + Number(r[g.visit[1]] ?? 0)) / 2;
          const rank = ranks?.groups[g.key]?.rank ?? null;
          return (
            <li key={g.key} className="border-b border-white/[0.07]">
              <button
                type="button"
                onClick={() => jump(g.section)}
                className="w-full grid grid-cols-[1fr_auto_auto] items-baseline gap-3.5 py-2.5 text-left cursor-pointer group"
              >
                <span className="text-[15px] text-slate-200 group-hover:text-white transition-colors">{g.key}</span>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {rank != null ? <><b className={`font-black text-[13px] ${rankColorClass(rank)}`}>#{rank}</b> world</> : ""}
                </span>
                <span className={`min-w-[2.2em] text-right text-[1.05rem] font-bold tabular-nums tracking-tight ${getRatingColor(score)}`}>{formatScore(score)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
