"use client";

import React from "react";
import Link from "next/link";
import { R2Image } from "../R2Image";
import type { RollerCoaster } from "@/app/types";

interface Props {
  coaster: RollerCoaster;
  parkName: string | null;
  parkSlug: string | null;
  headerImage: string | null;
  isAdminMode: boolean;
  onPickHeader?: () => void;
  onOpenPhoto?: (url: string) => void;
}

/**
 * The coaster's opening: one photo, tall on a phone, wide on desktop, with
 * only the name and where it is laid over the bottom, the way the park page
 * opens. The score and ranks come in the row directly underneath. Without a
 * photo the same block sits on a dark gradient with a faint track line.
 */
export default function CoasterHero({ coaster, parkName, parkSlug, headerImage, isAdminMode, onPickHeader, onOpenPhoto }: Props) {
  const parkHref = parkSlug ? `/park/${parkSlug}` : coaster.parkId ? `/park/${coaster.parkId}` : "/parks";
  const eyebrow = [coaster.manufacturerName, coaster.year ? String(coaster.year) : null].filter(Boolean);

  return (
    <section className="relative w-full overflow-hidden bg-slate-950 aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9] max-h-[78vh] lg:max-h-[68vh]">
      {headerImage ? (
        <div
          className={`absolute inset-0 ${onOpenPhoto ? "cursor-zoom-in" : ""}`}
          onClick={onOpenPhoto ? () => onOpenPhoto(headerImage) : undefined}
        >
          {/* Shown from the first paint: an onLoad fade would miss images that are
              already complete when React hydrates, and leave the hero dark. */}
          <R2Image src={headerImage} alt={coaster.name} fill priority sizes="100vw" className="object-cover" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-950">
          <svg className="absolute inset-0 w-full h-full text-white/[0.06]" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden>
            <path d="M-20 520 C 200 380, 300 120, 520 140 S 780 470, 980 300 S 1160 120, 1240 180" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
            <path d="M-20 560 C 200 420, 300 160, 520 180 S 780 510, 980 340 S 1160 160, 1240 220" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Legibility for the name only: dark from the bottom edge, like the park hero. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent pointer-events-none" />

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

      <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 pointer-events-none">
        <div className="max-w-7xl mx-auto pointer-events-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.02] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] break-words">
            {coaster.name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm sm:text-base text-slate-200/90 drop-shadow">
            {parkName && (
              <Link href={parkHref} className="hover:text-white transition-colors">{parkName}</Link>
            )}
            {eyebrow.map((part) => (
              <React.Fragment key={part}>
                <span className="text-white/40">·</span>
                <span>{part}</span>
              </React.Fragment>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
