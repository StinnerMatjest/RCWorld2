"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";
import { RATING_TIERS, getRatingColor } from "@/app/utils/design";
import { formatScore } from "@/app/utils/parkRanks";

interface Props {
  coasters: RollerCoaster[];
  loading?: boolean;
  /** Phones: rows beyond this many fold under a fade with a "Show all" button. 0 = no cap. */
  cap?: number;
  isAdminMode?: boolean;
  onAdd?: () => void;
  onEdit?: (c: RollerCoaster) => void;
  className?: string;
}

const rating = (c: RollerCoaster) => { const n = Number(c.rating); return Number.isFinite(n) ? n : 0; };
const ridden = (c: RollerCoaster) => rating(c) > 0;
const isOptional = (c: RollerCoaster) => /junior|kiddie/i.test(c.scale || "");
const tieRank = (c: RollerCoaster) => { const t = c.tieRank ?? (c as { tie_rank?: number }).tie_rank; return t == null ? Number.POSITIVE_INFINITY : Number(t); };

type Tier = { label: string; hex: string; items: RollerCoaster[]; muted?: boolean };

/** Group the park's coasters by the rating palette's tiers, best first. */
function buildTiers(coasters: RollerCoaster[]): Tier[] {
  const main = coasters.filter((c) => !isOptional(c));
  const optional = coasters.filter(isOptional);
  const sorted = [...main].sort((a, b) => {
    const ra = ridden(a) ? rating(a) : -1, rb = ridden(b) ? rating(b) : -1;
    if (ra !== rb) return rb - ra;
    const ta = tieRank(a), tb = tieRank(b);
    if (ta !== tb) return ta - tb;
    if (!!a.isbestcoaster !== !!b.isbestcoaster) return a.isbestcoaster ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });
  const tiers: Tier[] = [];
  for (const c of sorted) {
    const t = ridden(c) ? RATING_TIERS.find((x) => rating(c) >= x.min) : null;
    const label = t ? t.label : "Not ridden";
    const hex = t ? t.hex : "#64748b";
    let g = tiers.find((x) => x.label === label);
    if (!g) { g = { label, hex, items: [], muted: !t }; tiers.push(g); }
    g.items.push(c);
  }
  if (optional.length) {
    const opt = [...optional].sort((a, b) => rating(b) - rating(a) || String(a.name).localeCompare(String(b.name)));
    tiers.push({ label: "Optional", hex: "#64748b", items: opt, muted: true });
  }
  return tiers;
}

/**
 * The park's coasters, grouped by tier under white headings with a dot in the
 * tier colour. Each row: name, maker · year in grey,
 * the score at the right edge in its rating colour. Phones fold the list
 * after `cap` coasters: the next one shows through a fade, and a pill opens
 * the rest (optional coasters live inside the fold, never outside it).
 */
export default function ParkCoasterList({ coasters, loading = false, cap = 0, isAdminMode = false, onAdd, onEdit, className = "" }: Props) {
  const tiers = useMemo(() => buildTiers(coasters), [coasters]);
  const [expanded, setExpanded] = useState(false);
  const total = coasters.length;
  // Cap at `cap`, unless that would hide a single coaster: then show all.
  const capped = cap > 0 && !expanded && total > cap + 1;

  const header = (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="text-xl lg:text-[1.35rem] font-bold text-white leading-none">
        Coasters <span className="text-slate-500 font-semibold">({total})</span>
      </h2>
      <div className="flex items-baseline gap-4">
        {isAdminMode && onAdd && (
          <button type="button" onClick={onAdd} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">+ Add</button>
        )}
        <Link href="/coasterLibrary" className="text-[11px] font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">Library</Link>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={className}>
        {header}
        <div role="status" className="space-y-2 mt-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 rounded bg-white/5 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!total) {
    return (
      <div className={className}>
        {header}
        <p className="text-sm text-slate-500 mt-2">No coasters recorded for this park yet.</p>
      </div>
    );
  }

  // Flatten to rows so the cap can cut mid-tier.
  const rows: { tier: Tier; c: RollerCoaster; first: boolean }[] = [];
  for (const t of tiers) t.items.forEach((c, i) => rows.push({ tier: t, c, first: i === 0 }));
  const visible = capped ? rows.slice(0, cap) : rows;
  const peek = capped ? rows[cap] : null;

  const Row = ({ c }: { c: RollerCoaster }) => (
    <li className="group grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-[3px] lg:py-[3px] lg:border-t lg:border-white/[0.06] lg:first:border-t-0">
      {/* White name with a small orange chevron: the chevron is the "this opens" signal. */}
      <Link href={`/coasters/${c.slug}`} className="min-w-0 flex items-center gap-1.5 text-[15px] lg:text-[18px] text-slate-200 hover:text-white active:opacity-60 transition-colors">
        <span className="truncate">{c.name}</span>
        <svg className="w-[11px] h-[11px] flex-none text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
      </Link>
      <span className="text-xs lg:text-[14px] text-slate-400 lg:text-slate-300/90 whitespace-nowrap">
        {[c.manufacturerName, c.year].filter(Boolean).join(" · ")}
      </span>
      <span className="flex items-baseline gap-2">
        <span className={`min-w-[2.2em] text-right text-[1.05rem] lg:text-[1.3rem] font-bold tabular-nums tracking-tight ${ridden(c) ? getRatingColor(rating(c)) : "text-slate-600"}`}>
          {ridden(c) ? formatScore(rating(c)) : "NR"}
        </span>
        {isAdminMode && onEdit && (
          <button type="button" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}
            className="text-slate-600 hover:text-white transition-colors cursor-pointer text-xs leading-none">✎</button>
        )}
      </span>
    </li>
  );

  // The heading is white; the tier's colour is only a small dot before it,
  // so the list is not a rainbow and the scores stay the one thing in colour.
  const TierHead = ({ tier }: { tier: Tier }) => (
    <div className="flex items-center gap-2 mt-4 lg:mt-5 first:mt-1 mb-1">
      <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ backgroundColor: tier.muted ? "#475569" : tier.hex }} aria-hidden />
      <span className="text-[11px] lg:text-xs font-extrabold uppercase tracking-[0.14em] text-slate-300 lg:text-slate-200">{tier.label}</span>
      <span className="flex-1 h-px bg-white/[0.08]" />
    </div>
  );

  return (
    <div className={className}>
      {header}
      <div className="relative">
        {visible.map(({ tier, c, first }) => (
          <React.Fragment key={c.id}>
            {first && <TierHead tier={tier} />}
            <ul><Row c={c} /></ul>
          </React.Fragment>
        ))}
        {peek && (
          <>
            {peek.first && <TierHead tier={peek.tier} />}
            <div className="relative h-[26px] overflow-hidden" aria-hidden>
              <ul><Row c={peek.c} /></ul>
              <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/10 via-[#0f172a]/70 to-[#0f172a]" />
            </div>
          </>
        )}
      </div>
      {peek && (
        <div className="flex justify-center -mt-1 relative z-10">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full border border-white/20 bg-[#0f172a]/90 text-white text-[12px] font-bold uppercase tracking-[0.08em] hover:border-white/40 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand text-[#0f172a]">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
            Show all {total} coasters
          </button>
        </div>
      )}
    </div>
  );
}
