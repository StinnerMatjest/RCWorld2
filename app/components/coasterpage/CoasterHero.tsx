"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FocusedImage } from "../FocusedImage";
import { getRatingColor } from "@/app/utils/design";
import type { RollerCoaster } from "@/app/types";

export type HeaderFocus = { mobile: string | null; desktop: string | null };

interface Props {
  coaster: RollerCoaster;
  parkName: string | null;
  parkSlug: string | null;
  headerImage: string | null;
  /** Separate crops for the portrait phone hero and the wide desktop hero. */
  headerFocus?: HeaderFocus;
  isAdminMode: boolean;
  onPickHeader?: () => void;
  onOpenPhoto?: (url: string) => void;
}

const formatScore = (rating: number | string | null | undefined) => {
  const n = Number(rating);
  if (!rating || Number.isNaN(n) || n <= 0) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

/** True at the desktop breakpoint (lg). Starts false so the server renders the phone crop. */
function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

/**
 * The coaster's opening. The photo fills a tall frame on a phone and a wide
 * one on desktop, each with its own crop. Over the bottom: the name as big
 * as the frame allows, the model, where it is, and the score the way the
 * home cards wear theirs: huge, in its rating colour, on the photo.
 */
export default function CoasterHero({ coaster, parkName, parkSlug, headerImage, headerFocus, isAdminMode, onPickHeader, onOpenPhoto }: Props) {
  const desktop = useDesktop();
  const focus = (desktop ? headerFocus?.desktop : headerFocus?.mobile) ?? "0.5 0.5 1";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 40) setScrolled(true); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const score = formatScore(coaster.rating);
  const scoreColor = score ? getRatingColor(Number(coaster.rating)) : "text-slate-500";
  const parkHref = parkSlug ? `/park/${parkSlug}` : coaster.parkId ? `/park/${coaster.parkId}` : "/parks";
  const model = coaster.rideModel?.name || coaster.model;
  const where = [parkName, coaster.manufacturerName, coaster.year ? String(coaster.year) : null].filter(Boolean) as string[];

  return (
    <section className="relative w-full overflow-hidden bg-slate-950 aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9] max-h-[82vh] lg:max-h-[68vh]">
      {headerImage ? (
        <div
          className={`absolute inset-0 ${onOpenPhoto ? "cursor-zoom-in" : ""}`}
          onClick={onOpenPhoto ? () => onOpenPhoto(headerImage) : undefined}
        >
          <FocusedImage
            key={desktop ? "d" : "m"}
            src={headerImage}
            alt={coaster.name}
            focusStr={focus}
            priority
            variants
            className="absolute inset-0"
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

      {/* Dark from the bottom edge for the text; the top of the photo stays clean. */}
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-[#0f172a] via-[#0f172a]/65 to-transparent pointer-events-none" />

      {/* A quiet nudge that the page goes on; gone after the first scroll. */}
      {!scrolled && (
        <a
          href="#below-hero"
          aria-label="Scroll down"
          className="absolute left-1/2 -translate-x-1/2 bottom-2 sm:bottom-3 z-10 text-white/60 hover:text-white motion-safe:animate-bounce transition-colors"
          onClick={() => setScrolled(true)}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
        </a>
      )}

      {isAdminMode && onPickHeader && (
        <button
          onClick={(e) => { e.stopPropagation(); onPickHeader(); }}
          className="absolute top-4 right-4 z-20 p-2.5 bg-black/60 hover:bg-brand text-white rounded-xl backdrop-blur-md border border-white/20 transition-all shadow-xl cursor-pointer"
          title="Header photo and crop"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-8 pb-11 sm:pb-7 pointer-events-none">
        <div className="max-w-7xl mx-auto flex items-end justify-between gap-4 pointer-events-auto">
          <div className="min-w-0">
            <h1 className="text-[2.75rem] leading-[0.95] sm:text-6xl lg:text-7xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] break-words">
              {coaster.name}
            </h1>
            {model && (
              <p className="mt-2 text-base sm:text-lg text-white/90 font-medium drop-shadow">{model}</p>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm sm:text-base text-slate-300/90 drop-shadow">
              {where.map((part, i) => (
                <React.Fragment key={part}>
                  {i > 0 && <span className="text-white/40">·</span>}
                  {i === 0 && parkName ? (
                    <Link href={parkHref} className="hover:text-white transition-colors">{part}</Link>
                  ) : (
                    <span>{part}</span>
                  )}
                </React.Fragment>
              ))}
            </p>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="flex items-baseline justify-end">
              <span className={`text-[5.5rem] sm:text-8xl lg:text-9xl font-black leading-none tracking-tighter tabular-nums ${scoreColor} drop-shadow-[0_3px_14px_rgba(0,0,0,0.65)]`}>
                {score ?? "NR"}
              </span>
              {score && <span className="ml-1 text-lg sm:text-xl font-bold text-slate-300/80">/10</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
