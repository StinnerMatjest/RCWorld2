"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { FocusedImage } from "../FocusedImage";
import { getRatingColor, getRatingHex, getParkFlag } from "@/app/utils/design";
import { getDaysUntil } from "@/app/utils/trips";
import type { Trip } from "./TripCard";

type Visit = {
  ratingId: number;
  date: string;
  overall: number | string;
  /** false = visited and scored, but the written review isn't out yet */
  published: boolean;
  parkId: number;
  name: string;
  country: string;
  slug: string;
  imagepath?: string | null;
  headerFocus?: string | null;
  visitNumber: number;
  totalVisits: number;
};

function visitDateLabel(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function tripRangeLabel(start: string, end: string) {
  if (start.length === 7) {
    return new Date(start + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

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
  const isMonthOnly = !undecided && trip.startDate.length === 7;

  // Hide the exact day countdown if we don't have exact dates
  const days = undecided || isMonthOnly ? null : getDaysUntil(trip.startDate);
  const countries = Array.isArray(trip.country) ? trip.country : [trip.country];

  return (
    <motion.div {...reveal} className="relative">
      <span
        className="absolute -left-[22px] sm:-left-[38px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-[#0f172a]"
        style={{ borderColor: booked ? "#34d399" : "#fbbf24" }}
      />
      <div className={`rounded-2xl border-2 border-dashed px-4 py-3.5 sm:px-5 transition-colors ${booked
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
  const published = visit.published !== false;

  // Unpublished visits are shown (the visit happened, the score is real) but
  // can't be opened: the park page only renders published reviews.
  const cardClass = "group grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[280px_minmax(0,1fr)] rounded-2xl overflow-hidden border shadow-lg shadow-black/20 transition-colors " +
    (published
      ? "border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600"
      : "border-dashed border-slate-700 bg-slate-800/20");

  const card = (
    <>
        {/* Header image */}
        <div className="relative aspect-[16/9] sm:aspect-auto sm:h-full sm:min-h-[140px] overflow-hidden">
          {visit.imagepath ? (
            <FocusedImage
              src={visit.imagepath}
              alt={visit.name}
              focusStr={visit.headerFocus}
              className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              optimizeWidth={1080}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-4xl">🎢</div>
          )}
        </div>

        {/* Info */}
        <div className="flex items-center gap-4 p-4 sm:p-5 min-w-0">
          <div className="flex-1 min-w-0">
            {/* Desktop shows the date on the rail instead, but we always want to show the visit number */}
            <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
              <span className="sm:hidden">{visitDateLabel(visit.date)}</span>
              <span className="text-slate-500"><span className="sm:hidden"> · </span>Visit #{visit.visitNumber}</span>
            </p>
            <p className="font-black text-white text-xl sm:text-2xl leading-tight line-clamp-2 break-words mt-1 group-hover:text-orange-400 transition-colors">
              {visit.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Image src={getParkFlag(visit.country)} alt={visit.country} width={18} height={13} className="rounded-[2px]" unoptimized />
              <p className="text-xs text-slate-400">{visit.country}</p>
            </div>
            {published ? (
              <p className="hidden sm:block text-[11px] font-bold text-slate-600 group-hover:text-orange-400 transition-colors mt-2.5">
                Read the review →
              </p>
            ) : (
              <p className="inline-flex items-center gap-1.5 mt-2.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                ✍️ Review coming soon
              </p>
            )}
          </div>

          {/* Score */}
          <div className="flex-shrink-0 flex items-center h-full pr-1">
            <p className={`text-3xl sm:text-4xl font-black tabular-nums leading-none ${getRatingColor(overall)}`}>
              {hasScore ? overall.toFixed(2).replace(/\.?0+$/, "") : "—"}
            </p>
          </div>
        </div>
    </>
  );

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
      {published ? (
        <Link href={`/park/${visit.slug}?visit=${visit.ratingId}`} className={cardClass}>
          {card}
        </Link>
      ) : (
        <div className={cardClass} title="We've visited and scored this park — the written review is on its way">
          {card}
        </div>
      )}
    </motion.div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export default function VisitTimeline({ trips, isAdminMode, onEditTrip, initialVisits }: {
  trips: Trip[];
  isAdminMode: boolean;
  onEditTrip: (t: Trip) => void;
  initialVisits?: Visit[];
}) {
  // undefined = server fetch failed → we fetch here. [] = genuinely no visits.
  const [visits, setVisits] = useState<Visit[]>(initialVisits ?? []);
  const [loading, setLoading] = useState(initialVisits === undefined);

  useEffect(() => {
    // Seeded server-side and kept fresh via the "content" tag — only fetch
    // when the seed is missing (SSR-time API failure).
    if (initialVisits !== undefined) return;
    fetch("/api/visits")
      .then(r => r.json())
      .then(d => setVisits(d.visits ?? []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [initialVisits]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = trips
    .filter(t => {
      if (t.status !== "booked" && t.status !== "planned") return false;
      if (t.startDate === "undecided" || t.endDate === "undecided") return false;

      let endObj = new Date(t.endDate);
      // If it's a month-only trip, evaluate against the final day of that month
      if (t.endDate.length === 7) {
        const [year, month] = t.endDate.split("-");
        // 0th day of the next month = last day of the current month
        endObj = new Date(parseInt(year), parseInt(month), 0);
      }
      return endObj >= today;
    })
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
