"use client";

import React from "react";
import Link from "next/link";
import { R2Image } from "../R2Image";
import { getRatingColor } from "@/app/utils/design";
import type { RollerCoaster } from "@/app/types";

interface Props {
  coaster: RollerCoaster;
  parkName: string | null;
  parkSlug: string | null;
  headerImage: string | null;
  photoCount: number;
  isAdminMode: boolean;
  onPickHeader?: () => void;
  onOpenPhoto?: (url: string) => void;
}

const formatScore = (rating: number | string | null | undefined) => {
  const n = Number(rating);
  if (!rating || Number.isNaN(n) || n <= 0) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

/**
 * The coaster's opening: one photo, tall on a phone (coasters go up, and the
 * hero is the one place the photo gets the whole screen), wide on desktop,
 * with the name, where it is and the score laid over the bottom. Without a
 * photo the same block sits on a dark gradient with a faint track line, so a
 * coaster with no gallery still opens like every other.
 */
export default function CoasterHero({ coaster, parkName, parkSlug, headerImage, photoCount, isAdminMode, onPickHeader, onOpenPhoto }: Props) {
  const score = formatScore(coaster.rating);
  const scoreColor = score ? getRatingColor(Number(coaster.rating)) : "text-slate-500";
  const parkHref = parkSlug ? `/park/${parkSlug}` : coaster.parkId ? `/park/${coaster.parkId}` : "/parks";
  const eyebrow = [coaster.manufacturerName, coaster.year ? String(coaster.year) : null].filter(Boolean);

  return (
    <section className="relative w-full overflow-hidden bg-slate-950 aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9] max-h-[82vh] lg:max-h-[70vh]">
      {headerImage ? (
        <div
          className={`absolute inset-0 ${onOpenPhoto ? "cursor-zoom-in" : ""}`}
          onClick={onOpenPhoto ? () => onOpenPhoto(headerImage) : undefined}
        >
          {/* Shown from the first paint: an onLoad fade would miss images that are
              already complete when React hydrates, and leave the hero dark. */}
          <R2Image
            src={headerImage}
            alt={coaster.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-950">
          <svg className="absolute inset-0 w-full h-full text-white/[0.06]" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden>
            <path d="M-20 520 C 200 380, 300 120, 520 140 S 780 470, 980 300 S 1160 120, 1240 180" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
            <path d="M-20 560 C 200 420, 300 160, 520 180 S 780 510, 980 340 S 1160 160, 1240 220" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Legibility: dark from the bottom, never a flat tint over the whole photo. */}
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {isAdminMode && onPickHeader && (
        <button
          onClick={(e) => { e.stopPropagation(); onPickHeader(); }}
          className="absolute top-4 right-4 z-20 p-2.5 bg-black/60 hover:bg-brand text-white rounded-xl backdrop-blur-md border border-white/20 transition-all shadow-xl cursor-pointer"
          title="Select header image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
      )}

      {photoCount > 1 && (
        <a
          href="#photos"
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-sm text-white/90 text-xs font-semibold border border-white/15 hover:bg-black/65 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          {photoCount} photos
        </a>
      )}

      <div className="absolute inset-x-0 bottom-0 px-4 sm:px-8 lg:px-20 pb-5 sm:pb-8 lg:pb-10 pointer-events-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8">
          <div className="min-w-0 pointer-events-auto">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base text-slate-200/90 drop-shadow">
              {parkName && (
                <Link href={parkHref} className="font-semibold text-white hover:text-brand-light transition-colors">
                  {parkName}
                </Link>
              )}
              {eyebrow.map((part) => (
                <React.Fragment key={part}>
                  <span className="text-white/40">·</span>
                  <span>{part}</span>
                </React.Fragment>
              ))}
            </p>
            <h1 className="mt-1 text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.02] drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] break-words">
              {coaster.name}
            </h1>
            {(coaster.rideModel?.name || coaster.model) && (
              <p className="mt-1.5 text-sm sm:text-base text-slate-300/90 drop-shadow">
                {coaster.rideModel?.name || coaster.model}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between sm:justify-end gap-4 sm:gap-5 w-full sm:w-auto flex-shrink-0 pointer-events-auto">
            {coaster.isbestcoaster && (
              // Same tag the park page puts next to its best coaster.
              <span className="mb-3 rounded px-1.5 py-0.5 text-[12px] font-semibold bg-yellow-900/30 text-yellow-300">
                Best in park
              </span>
            )}
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className={`text-6xl sm:text-7xl lg:text-8xl font-black leading-none tracking-tighter ${scoreColor} drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]`}>
                  {score ?? "NR"}
                </span>
                {score && <span className="text-lg sm:text-xl font-bold text-slate-300/80">/10</span>}
              </div>
              <p className="text-xs sm:text-sm text-slate-300/90 mt-1 drop-shadow">
                {score ? (coaster.ridecount > 0 ? `Ridden ${coaster.ridecount} ${coaster.ridecount === 1 ? "time" : "times"}` : "Our score") : "Not rated yet"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
