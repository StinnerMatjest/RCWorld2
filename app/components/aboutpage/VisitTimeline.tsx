"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { FocusedImage } from "../FocusedImage";
import { getRatingColor, getRatingHex, getParkFlag, RATING_TIERS } from "@/app/utils/design";
import { getDaysUntil } from "@/app/utils/trips";
import type { Trip } from "./TripCard";

type Visit = {
  ratingId: number;
  date: string;
  overall: number | string;
  parkId: number;
  name: string;
  country: string;
  slug: string;
  imagepath?: string | null;
  headerFocus?: string | null;
  visitNumber: number;
  totalVisits: number;
};

const tierLabel = (r: number) => RATING_TIERS.find(t => r >= t.min)?.label ?? "";

function visitDateLabel(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function tripRangeLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
  }
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, ease: [0.33, 1, 0.68, 1] as const },
};

/*
 * Timeline geometry (shared by spine, dots and year chips):
 *   gutter  pl-16 (64px)  sm:pl-28 (112px)
 *   spine   centred at 48px / 80px
 */

// ─── Upcoming trip card (dashed — it hasn't happened yet) ─────────────────────

function UpcomingCard({ trip, isAdminMode, onEdit }: {
  trip: Trip;
  isAdminMode: boolean;
  onEdit: (t: Trip) => void;
}) {
  const booked = trip.status === "booked";
  const undecided = trip.startDate === "undecided" || trip.endDate === "undecided";
  const days = undecided ? null : getDaysUntil(trip.startDate);
  const countries = Array.isArray(trip.country) ? trip.country : [trip.country];

  return (
    <motion.div {...reveal} className="relative">
      <span
        className="absolute -left-[22px] sm:-left-[38px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-[#0f172a]"
        style={{ borderColor: booked ? "#34d399" : "#fbbf24" }}
      />
      <div className={`rounded-2xl border-2 border-dashed px-4 py-3.5 sm:px-5 transition-colors ${
        booked
          ? "border-emerald-500/40 bg-emerald-500/[0.04] hover:border-emerald-500/70"
          : "border-amber-500/30 bg-amber-500/[0.03] hover:border-amber-500/60"
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black uppercase tracking-widest ${booked ? "text-emerald-400" : "text-amber-400"}`}>
            {booked ? "Booked" : "Planned"}
          </span>
          <span className="text-xs text-slate-500 font-bold">
            {undecided ? "Dates TBD" : tripRangeLabel(trip.startDate, trip.endDate)}
          </span>
          {booked && days && Number(days) > 0 && (
            <span className="text-xs font-black text-emerald-400 ml-auto">in {days} days</span>
          )}
          {isAdminMode && (
            <button onClick={() => onEdit(trip)}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer ml-1"
              title="Edit trip">
              ✏️
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap">
          {countries.map(c => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <Image src={getParkFlag(c)} alt={c} width={22} height={15} className="rounded-[3px]" unoptimized />
              <span className="text-sm font-bold text-slate-300">{c.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
            </span>
          ))}
        </div>
        <p className="mt-1.5 font-bold text-slate-400 text-sm sm:text-base">
          {trip.parks.join(" · ")}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Past visit — photo and info side by side, text on a solid surface ────────

function VisitTile({ visit }: { visit: Visit }) {
  const overall = Number(visit.overall);
  const hasScore = Number.isFinite(overall);

  return (
    <motion.div {...reveal} className="relative">
      {/* Dot on the spine, coloured by score */}
      <span
        className="absolute -left-[22px] sm:-left-[38px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-4 ring-[#0f172a] z-10"
        style={{ background: getRatingHex(overall) }}
      />
      {/* Desktop: date on the rail, left of the dot */}
      <span className="hidden sm:block absolute right-full mr-[44px] top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 whitespace-nowrap">
        {visitDateLabel(visit.date)}
      </span>
      <Link href={`/park/${visit.slug}?visit=${visit.ratingId}`}
        className="group grid sm:grid-cols-[280px_1fr] rounded-2xl overflow-hidden border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600 transition-colors shadow-lg shadow-black/20">
        {/* Header image */}
        <div className="relative aspect-[16/9] sm:aspect-auto sm:h-full sm:min-h-[140px] overflow-hidden">
          {visit.imagepath ? (
            <FocusedImage src={visit.imagepath} alt={visit.name} focusStr={visit.headerFocus}
              className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-4xl">🎢</div>
          )}
        </div>

        {/* Info */}
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <div className="flex-1 min-w-0">
            {/* Desktop shows the date on the rail instead — avoid repeating it here */}
            <p className={`text-[11px] font-black uppercase tracking-widest text-orange-500 ${visit.totalVisits > 1 ? "" : "sm:hidden"}`}>
              <span className="sm:hidden">{visitDateLabel(visit.date)}</span>
              {visit.totalVisits > 1 && (
                <span className="text-slate-500"><span className="sm:hidden"> · </span>Visit #{visit.visitNumber}</span>
              )}
            </p>
            <p className="font-black text-white text-xl sm:text-2xl leading-tight truncate mt-1 group-hover:text-orange-400 transition-colors">
              {visit.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Image src={getParkFlag(visit.country)} alt={visit.country} width={18} height={13} className="rounded-[2px]" unoptimized />
              <p className="text-xs text-slate-400">{visit.country}</p>
            </div>
            <p className="hidden sm:block text-[11px] font-bold text-slate-600 group-hover:text-orange-400 transition-colors mt-2.5">
              Read the review →
            </p>
          </div>

          {/* Score + tier */}
          <div className="flex-shrink-0 text-right">
            <p className={`text-3xl sm:text-4xl font-black tabular-nums leading-none ${getRatingColor(overall)}`}>
              {hasScore ? overall.toFixed(2).replace(/\.?0+$/, "") : "—"}
            </p>
            {hasScore && (
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${getRatingColor(overall)} opacity-80`}>
                {tierLabel(overall)}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export default function VisitTimeline({ trips, isAdminMode, onEditTrip }: {
  trips: Trip[];
  isAdminMode: boolean;
  onEditTrip: (t: Trip) => void;
}) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/visits")
      .then(r => r.json())
      .then(d => setVisits(d.visits ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = trips
    .filter(t =>
      (t.status === "booked" || t.status === "planned") &&
      t.startDate !== "undecided" && t.endDate !== "undecided" &&
      new Date(t.endDate) >= today
    )
    // Future flows downward toward "now": farthest trip at the top
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const someday = trips.filter(t =>
    t.status !== "past" && (t.startDate === "undecided" || t.endDate === "undecided")
  );

  // Group visits (already newest-first) by year
  const years: { year: number; visits: Visit[] }[] = [];
  for (const v of visits) {
    const y = new Date(v.date).getFullYear();
    const last = years[years.length - 1];
    if (last && last.year === y) last.visits.push(v);
    else years.push({ year: y, visits: [v] });
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="aspect-[2/1] rounded-2xl bg-slate-800/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Year quick-nav — typographic, anchored by the brand orange */}
      {years.length > 1 && (
        <nav className="flex items-baseline gap-6 sm:gap-8 overflow-x-auto pb-6 mb-2 justify-start sm:justify-center [scrollbar-width:none]">
          {years.map(({ year, visits: yv }) => (
            <a key={year} href={`#year-${year}`}
              className="group/y flex-shrink-0 flex items-baseline gap-2 border-b-2 border-transparent hover:border-orange-500 pb-1.5 transition-colors">
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-slate-200 group-hover/y:text-white transition-colors">
                {year}
              </span>
              <span className="text-[11px] font-black uppercase tracking-wide text-orange-500 tabular-nums whitespace-nowrap">
                {yv.length} {yv.length === 1 ? "visit" : "visits"}
              </span>
            </a>
          ))}
        </nav>
      )}

      {/* The spine — year chips live in the gutter to its left */}
      <div className="relative pl-16 sm:pl-28">
        <div className="absolute left-[47px] sm:left-[79px] top-0 bottom-0 w-[2px] rounded-full bg-gradient-to-b from-emerald-500/50 via-slate-700 to-transparent" />

        {/* Upcoming — the future, above the NOW marker (dateless plans first) */}
        {(someday.length > 0 || upcoming.length > 0) && (
          <div className="flex flex-col gap-3 mb-6">
            {[...someday, ...upcoming].map(t => (
              <UpcomingCard key={t.id} trip={t} isAdminMode={isAdminMode} onEdit={onEditTrip} />
            ))}
          </div>
        )}

        {/* NOW divider */}
        <div className="relative flex items-center gap-3 mb-6">
          <span className="absolute -left-[25px] sm:-left-[41px] flex h-[18px] w-[18px]">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-30" />
            <span className="relative inline-flex rounded-full h-[18px] w-[18px] bg-emerald-500 border-4 border-[#0f172a]" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Today</span>
          <span className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
        </div>

        {/* Past visits, year by year */}
        {years.map(({ year, visits: yearVisits }) => (
          <section key={year} id={`year-${year}`} className="scroll-mt-20">
            {/* Sticky year chip — pinned in the gutter, left of the spine */}
            <div className="sticky top-3 z-20 h-0 -ml-16 sm:-ml-28 w-16 sm:w-28">
              {/* Year node travelling on the spine */}
              <span className="absolute top-[5px] left-[41px] sm:left-[73px] w-[14px] h-[14px] rounded-full border-2 border-slate-500 bg-[#0f172a]" />
              <div className="text-right pr-[26px] sm:pr-[44px] pt-0.5">
                <p className="text-lg sm:text-2xl font-black text-white leading-none tabular-nums">{year}</p>
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-orange-500/90 mt-1">
                  {yearVisits.length} {yearVisits.length === 1 ? "visit" : "visits"}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:gap-5 pb-10 sm:pb-14 pt-1">
              {yearVisits.map(v => (
                <VisitTile key={v.ratingId} visit={v} />
              ))}
            </div>
          </section>
        ))}

        {/* Origin marker */}
        {years.length > 0 && (
          <div className="relative flex items-center gap-3 pb-2">
            <span className="absolute -left-[22px] sm:-left-[38px] w-3 h-3 rounded-full bg-slate-700" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Where it all began 🎢
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
