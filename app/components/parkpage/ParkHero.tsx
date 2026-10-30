"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Park, Visit } from "@/app/types";
import type { ParkRanks } from "@/app/utils/parkRanks";
import ParkHeaderModal from "./ParkHeaderModal";
import { HeroStats } from "./HeroStats";
import { FocusedImage, parseFocusStr } from "../FocusedImage";
import { heroSources, phoneSource } from "@/app/lib/heroSources";

// Server-side placement of the photo (cover the frame, focus point at the
// FocusedImage replaces this with px values after hydration. The frame
// height comes from the .park-hero-frame CSS variable (it depends on the
// breakpoint), and the translate is clamped per breakpoint so a focus point
// saved for a frame of another shape never leaves a gap at an edge: the
// phone's values go in --hero-tx-m/--hero-ty-m, the desktop's in -d (globals.css).
function heroPlacement(size: { w: number; h: number }, focusStr?: string | null, phoneFocusStr?: string | null, phoneSize?: { w: number; h: number }): React.CSSProperties {
  const a = size.w / size.h;
  // A cover with its own phone photo: phones draw that photo, of its own shape.
  const ap = phoneSize ? phoneSize.w / phoneSize.h : a;
  // Each frame shape has its own framing, so its own zoom: the drawn width
  // goes in a CSS variable per breakpoint (.park-hero-img, globals.css).
  const widthFor = (f: string | null | undefined, aspect = a) => { const z = parseFocusStr(f).zoom; return `max(${(100 * z).toFixed(3)}%, calc(var(--frame-h) * ${(z * aspect).toFixed(4)}))`; };
  // Frame aspects: 4:5 on phones, 16:9 from sm, 21:9 from lg (the vh caps are handled after hydration).
  const clampFor = (frameAspect: number, f: string | null | undefined = focusStr, photoAspect = a) => {
    const { cx, cy, zoom } = parseFocusStr(f);
    // Drawn size relative to the frame: cover, then zoom.
    const dw = (photoAspect > frameAspect ? frameAspect ? (photoAspect / frameAspect) : 1 : 1) * zoom; // in frame widths
    const dh = (photoAspect > frameAspect ? 1 : frameAspect / photoAspect) * zoom;                  // in frame heights
    const kx = dw > 1 ? Math.min(Math.max(cx, 1 / (2 * dw)), 1 - 1 / (2 * dw)) : 0.5;
    const ky = dh > 1 ? Math.min(Math.max(cy, 1 / (2 * dh)), 1 - 1 / (2 * dh)) : 0.5;
    return { tx: (-kx * 100).toFixed(3) + "%", ty: (-ky * 100).toFixed(3) + "%" };
  };
  const m = clampFor(4 / 5, phoneFocusStr || focusStr, ap);
  const t = clampFor(16 / 9);
  const d = clampFor(21 / 9);
  return {
    ["--hero-w-m" as string]: widthFor(phoneFocusStr || focusStr, ap),
    ["--hero-w-d" as string]: widthFor(focusStr),
    height: "auto",
    // Two photos of different shapes: the aspect goes per breakpoint (.park-hero-img.hero-art, globals.css).
    ...(phoneSize
      ? { ["--hero-ar-m" as string]: `${phoneSize.w} / ${phoneSize.h}`, ["--hero-ar-d" as string]: `${size.w} / ${size.h}` }
      : { aspectRatio: `${size.w} / ${size.h}` }),
    left: "50%",
    top: "50%",
    ["--hero-tx-m" as string]: m.tx, ["--hero-ty-m" as string]: m.ty,
    ["--hero-tx-s" as string]: t.tx, ["--hero-ty-s" as string]: t.ty,
    ["--hero-tx-d" as string]: d.tx, ["--hero-ty-d" as string]: d.ty,
  } as React.CSSProperties;
}

/** True from 640 px, where the hero is wide (16:9, then 21:9). Read synchronously so the right framing is used from the first client render. */
function useWideHero(): boolean {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const set = () => setWide(mq.matches); set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return wide;
}

interface ParkHeroProps {
  park: Park;
  /** The visit on screen. Its own header wins; without one the park's header shows. */
  visit?: Visit | null;
  visitCount?: number;
  /** Visit whose scores the home card shows (for the card preview in the editor). */
  cardRating?: Visit | null;
  ranks: ParkRanks | null;
  isAdminMode?: boolean;
  onUpdate?: () => void;
  onOpenPhoto?: (url: string) => void;
}

/**
 * The park's opening: the header photo fills a tall 3:4 frame on phones and a
 * 21:9 frame on desktop, the nav floats over its top, and over the bottom
 * fade sit the name, the place and the figures (overall, #n country, #n world).
 */
export default function ParkHero({ park, visit, visitCount, cardRating, ranks, isAdminMode, onUpdate, onOpenPhoto }: ParkHeroProps) {
  const ownHeader = visit?.headerImagepath || null;
  const headerSrc = ownHeader ?? park.imagepath;
  const headerFocus = (ownHeader ? visit?.headerFocus : park.headerFocus) ?? undefined;
  // A cover can have its own phone photo; phones then show that one.
  const phoneOwn = (ownHeader ? visit?.headerImagepathMobile : park.imagepathMobile) || null;
  const phoneSrc = phoneOwn && phoneOwn !== headerSrc ? phoneOwn : null;
  const phoneSize = phoneSrc ? (ownHeader ? visit?.headerImageMobileSize : park.imageMobileSize) : undefined;
  // The tall phone frame has its own framing: of the phone photo when there is one
  // (centred until set), else of the same photo (falls back to the wide framing).
  const headerFocusMobile = phoneSrc
    ? (ownHeader ? visit?.headerFocusMobile : park.headerFocusMobile) || "0.5 0.5 1"
    : (ownHeader ? visit?.headerFocusMobile : park.headerFocusMobile) || headerFocus;
  const wideHero = useWideHero();
  const headerSize = ownHeader ? visit?.headerImageSize : park.imageSize;
  // The photo is never painted half-arrived: it stays invisible until the
  // whole file is in, then fades up over 700 ms. The inline script after the
  // image flips it in the server HTML the moment it loads (no waiting for
  // hydration); at hydration the state takes over so React's class matches.
  const [imageLoaded, setImageLoaded] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const overall = visit ? Number(visit.overall) : null;

  useLayoutEffect(() => {
    const img = frameRef.current?.querySelector("img");
    // Before paint, so a photo the inline script already revealed never blinks.
    if (img && img.complete && img.naturalWidth > 0) setImageLoaded(true);
  }, []);
  const revealPhoto = () => setImageLoaded(true);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, [showToast]);

  return (
    <>
      <section
        ref={frameRef}
        className="park-hero-frame relative w-full overflow-hidden bg-slate-950 aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9] max-h-[82vh] lg:max-h-[68vh]"
        data-framing="park-cover"
        data-framing-math="focused"
      >
        <div
          className={`absolute inset-0 ${onOpenPhoto && headerSrc ? "cursor-zoom-in" : ""}`}
          onClick={onOpenPhoto && headerSrc ? () => onOpenPhoto(headerSrc) : undefined}
        >
          {headerSrc && (
            <FocusedImage
              key={headerSrc}
              src={headerSrc}
              alt={park.name}
              focusStr={wideHero ? headerFocus : headerFocusMobile}
              placement={headerSize && (!phoneSrc || phoneSize) ? heroPlacement(headerSize, headerFocus, headerFocusMobile, phoneSize) : undefined}
              {...(headerSize ? heroSources(headerSrc, headerSize, { phone: parseFocusStr(headerFocusMobile).zoom, wide: parseFocusStr(headerFocus).zoom }) : {})}
              {...(phoneSrc ? { pictureSources: [phoneSource(phoneSrc, phoneSize, parseFocusStr(headerFocusMobile).zoom)] } : {})}
              className="absolute inset-0"
              imgClassName={`park-hero-img hero-reveal framing-photo ${phoneSrc ? "hero-art " : ""}${imageLoaded ? "is-loaded" : ""}`}
              priority
              // The inline script below may add is-loaded before React hydrates.
              suppressHydrationWarning
              onLoad={revealPhoto}
            />
          )}
          {/* Reveals the photo as soon as it has fully loaded, before React runs. */}
          {headerSrc && (
            <script
              dangerouslySetInnerHTML={{ __html: "(function(){var s=document.currentScript,c=s&&s.previousElementSibling,i=c&&c.querySelector('img');if(!i)return;var r=function(){i.classList.add('is-loaded')};if(i.complete&&i.naturalWidth>0)r();else i.addEventListener('load',r,{once:true})})();" }}
            />
          )}
        </div>

        {/* Dark from the bottom edge for the text; the top is the nav's own shade. */}
        <div className="absolute inset-x-0 bottom-0 h-[70%] lg:h-[58%] bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent pointer-events-none" />

        {isAdminMode && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
            className="absolute top-24 right-4 lg:top-32 lg:right-8 z-20 p-2.5 bg-black/60 hover:bg-brand text-white rounded-xl backdrop-blur-md border border-white/20 transition-all shadow-xl cursor-pointer"
            title="Header photo and crop"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-20 pb-6 lg:pb-10 pointer-events-none">
          <div className="flex items-end justify-between gap-6 pointer-events-auto">
            <div className="min-w-0">
              <h1 className="text-[2.75rem] leading-[0.95] sm:text-6xl lg:text-7xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] break-words">
                {park.name}
              </h1>
              <p className="mt-2 lg:mt-3 flex flex-wrap items-center gap-x-1.5 text-sm sm:text-base lg:text-lg text-slate-300 drop-shadow">
                {park.city && <span>{park.city}</span>}
                {park.city && park.country && <span className="text-slate-500">·</span>}
                {park.country && <span>{park.country}</span>}
                {park.continent && <><span className="text-slate-500">·</span><span>{park.continent}</span></>}
              </p>
              <div className="lg:hidden"><HeroStats overall={overall} ranks={ranks} /></div>
            </div>
            <div className="hidden lg:block flex-shrink-0"><HeroStats overall={overall} ranks={ranks} desktop /></div>
          </div>
        </div>

        <div
          className={`absolute top-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full shadow-2xl transition-all duration-500 pointer-events-none ${showToast ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span className="text-sm font-medium">Header updated</span>
        </div>
      </section>

      {showModal && (
        <ParkHeaderModal
          key={visit?.id ?? "park"}
          parkId={park.id}
          parkName={park.name}
          parkCountry={park.country}
          parkCity={park.city}
          parkContinent={park.continent}
          visitId={visit?.id ?? null}
          visitDate={visit?.date ?? null}
          visitCount={visitCount}
          currentImagePath={headerSrc}
          currentHeaderFocus={headerFocus}
          currentHeaderFocusMobile={(ownHeader ? visit?.headerFocusMobile : park.headerFocusMobile) ?? null}
          currentImagePathMobile={phoneSrc}
          parkImagePath={park.imagepath}
          currentCardImagepath={park.cardImagepath}
          currentFocus={park.imageFocus}
          cardRating={cardRating}
          heroOverall={overall}
          heroRanks={ranks}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowToast(true); onUpdate?.(); }}
        />
      )}
    </>
  );
}
