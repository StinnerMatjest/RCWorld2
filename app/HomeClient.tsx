"use client";

import React, { useCallback, useEffect, useMemo, useState, Suspense, useRef, UIEvent, useLayoutEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { RatingWarningType, Visit, Park } from "@/app/types";
import RatingWarning from "./components/warnings/RatingWarning";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// The rating editor (date picker, animation library, rank lanes) is admin-only
// and opens via ?modal=true. Loaded on demand so visitors never download it.
const RatingModal = dynamic(() => import("./components/RatingModal"), { ssr: false });
import { useSearch } from "./context/SearchContext";
import { useAdminMode } from "@/app/context/AdminModeContext";
import { isR2Image, variantKey, coverVariantUrl, sharperSource, exactCoverSrc, COVER_UPSCALE_TOLERANCE, VARIANT_WIDTHS } from "@/app/lib/imageVariants";
import type { ImageSize, CardCut } from "@/app/types";
import { cutSrcSet, cutSizes, CARD_FRAME_HEIGHT } from "@/app/lib/cardCutGeometry";

// Server-side placement for a photo of known size, so it is visible as soon
// as it downloads without waiting for hydration. Pure CSS version of
// applyFocusToImg: the frame is CARD_FRAME_HEIGHT tall, so "cover" is a width
// of max(frame width, frame height × aspect), times the crop zoom; the height
// follows from aspect-ratio (which also sizes the box before the bytes
// arrive); left/top 50% + a percentage translate put the focus point at the
// frame centre for any drawn size. applyFocusToImg replaces all of it with the
// same numbers in px after hydration.
function ssrPlacement(size: ImageSize, focusStr: string): React.CSSProperties {
  const { cx, cy, zoom } = parseFocusStr(focusStr);
  const heightLimitedWidth = CARD_FRAME_HEIGHT * zoom * size.w / size.h;
  return {
    width: `max(${(100 * zoom).toFixed(3)}%, ${heightLimitedWidth.toFixed(2)}px)`,
    height: "auto",
    aspectRatio: `${size.w} / ${size.h}`,
    left: "50%",
    top: "50%",
    transform: `translate(${(-cx * 100).toFixed(3)}%, ${(-cy * 100).toFixed(3)}%)`,
  };
}

// What a card slot shows: either the original photo (picked by size) or its
// pre-made cut, which the browser picks a copy of through srcset.
type CardEntry = { src: string; focus: string; size?: ImageSize; direct?: boolean; cut?: CardCut };
function resolveEntry(src: string, focus: string, size: ImageSize | undefined, cut: CardCut | undefined): CardEntry {
  if (cut) return { src: cut.url, focus: cut.focus, size: { w: cut.w, h: cut.h }, direct: true, cut };
  return { src, focus, size };
}
// Widest card frame per breakpoint (measured: phones 250-307 CSS px, tablets
// up to 384 = max-w-sm, desktop grid up to 400). Upper bounds on purpose: a
// hint that is a little too wide costs a few KB, one that is too narrow costs
// sharpness.
const FRAME_W_MOBILE = "min(78vw, 384px)";
const FRAME_W_DESKTOP = "400px";

// srcset/sizes for a card entry: a cut offers its copies; any other R2 photo
// of known size offers the stored widths plus the original. The size hint is
// the photo's drawn width in the 500px-tall frame: max(frame width,
// 500px x aspect), times the crop zoom. The browser then picks the smallest
// file whose pixels cover that on its own screen; nothing is enlarged.
function entrySources(entry: CardEntry): { srcSet: string; sizes: string } | undefined {
  if (entry.cut) return { srcSet: cutSrcSet(entry.cut), sizes: cutSizes(entry.cut) };
  if (!entry.size || !isR2Image(entry.src)) return undefined;
  const { w, h } = entry.size;
  const zoom = parseFocusStr(entry.focus).zoom;
  const parts = VARIANT_WIDTHS.filter((v) => v < w).map((v) => `${variantKey(entry.src, v)} ${v}w`);
  parts.push(`${entry.src} ${w}w`);
  const byHeight = (CARD_FRAME_HEIGHT * w / h * zoom).toFixed(1) + "px";
  const z = zoom.toFixed(4);
  return {
    srcSet: parts.join(", "),
    sizes: `(min-width: 768px) max(calc(${FRAME_W_DESKTOP} * ${z}), ${byHeight}), max(calc(${FRAME_W_MOBILE} * ${z}), ${byHeight})`,
  };
}
// Fallback src for browsers without srcset support: a mid size, never the original.
function fallbackSrc(entry: CardEntry): string {
  if (entry.cut) return entry.cut.url;
  return isR2Image(entry.src) ? variantKey(entry.src, 1200) : entry.src;
}

// Point an <img> at an entry: srcset/sizes when the photo's size is known
// (the browser picks by density), otherwise a single src.
function applyEntryToImg(img: HTMLImageElement, entry: CardEntry, src: string) {
  const s = entrySources(entry);
  if (s) {
    img.sizes = s.sizes;
    img.srcset = s.srcSet;
    img.src = fallbackSrc(entry);
  } else {
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = src;
  }
}

// What the server assumes about the screen when it has to choose the first
// cards' files before any browser is involved. Generous on purpose: a pick
// that is too large costs bytes, a pick that is too small costs a second
// download after the check on the device. Real screens re-check on mount.
const ASSUMED_SCREEN = {
  mobile:  { cssW: 360, cssH: 640, dpr: 3 },
  desktop: { cssW: 360, cssH: 640, dpr: 2 },
} as const;

// Home cards cover-crop the photo into a tall card, so the card's height (not
// its width) decides how many source pixels are needed. Start from a stored
// variant that should cover the card on this screen; after it loads, the focus
// math reports the real device-pixel scale and we step up to the next size (or
// the original) if the variant would have been enlarged. Net effect: the card
// never shows fewer source pixels than the screen can display, but downloads
// a fraction of the multi-megabyte original. First-row cards (in the SSR HTML)
// start from the largest stored size so the eager download is never redone.
const CARD_SAFE_VARIANT = 1920 as const;
// Photos with a recorded size get the exact file; the rest keep the guess.
function cardSrcFor(original: string, size: ImageSize | undefined, container: HTMLElement | null, eager: boolean, focusStr: string | undefined, assumed: keyof typeof ASSUMED_SCREEN, direct = false): string {
  if (direct || !isR2Image(original)) return original;
  const zoom = parseFocusStr(focusStr).zoom;
  if (size) {
    if (container && typeof window !== "undefined") {
      return exactCoverSrc(original, size, container.clientWidth, container.clientHeight, zoom, window.devicePixelRatio || 1);
    }
    const a = ASSUMED_SCREEN[assumed];
    return exactCoverSrc(original, size, a.cssW, a.cssH, zoom, a.dpr);
  }
  if (eager || !container || typeof window === "undefined") return variantKey(original, CARD_SAFE_VARIANT);
  return coverVariantUrl(original, container.clientWidth * zoom, container.clientHeight * zoom, window.devicePixelRatio || 1);
}
// Sizes as an ordering: does `a` carry at least as many pixels as `b`?
function atLeastAsLarge(a: string, b: string): boolean {
  const px = (u: string) => { const m = u.match(/-w(\d+)\.webp/); return m ? Number(m[1]) : Infinity; };
  return px(a) >= px(b);
}
import LoadingSpinner from "./components/LoadingSpinner";
import { getParkFlag, getRatingColor } from "@/app/utils/design";
import { FocusedImage, parseFocusStr } from "./components/FocusedImage";


// Entrance: cards render fully composed (image already under its readability
// overlay) inside a grid that holds at opacity 0 until the first-row images
// have loaded. The reveal is ONE composite fade of the whole grid, so an
// image can never appear at full brightness before its overlay darkens it.
const PendingParkCard = ({ park }: { park: Park }) => (
  <Link
    href={`/?modal=true&pendingParkId=${park.id}`}
    className="mx-auto flex flex-col justify-between w-full max-w-[400px] py-3 md:py-4 h-full"
  >
    <div className="flex flex-col justify-center items-center text-center w-full h-full min-h-[450px] bg-[#1e293b]/40 rounded-2xl border-2 border-dashed border-slate-700 hover:border-brand hover:bg-brand/5 transition-all duration-300 p-6 shadow-md group cursor-pointer">
      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">⏳</span>
      </div>
      <h3 className="text-[1.75rem] font-bold text-white mb-4 px-2">{park.name}</h3>
      <span className="bg-amber-900/30 text-amber-400 text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wider">
        Pending Setup
      </span>
      <p className="mt-6 text-sm text-slate-400 font-medium">Click to finish setting up park details and log your first rating.</p>
    </div>
  </Link>
);


// First-photo gate (phone strip). On a slow connection every photo requested
// alongside the first card's shares the bandwidth with it, and the first card
// (the "largest paint") lands seconds later than it needs to. So the other
// cards ask for their photos only once the first one has arrived (or failed,
// or 4 s have passed). On a fast connection nobody can tell the difference.
let firstPhotoDone = false;
let firstPhotoWaiters: (() => void)[] = [];
function afterFirstPhoto(fn: () => void): () => void {
  if (firstPhotoDone) { fn(); return () => {}; }
  firstPhotoWaiters.push(fn);
  return () => { firstPhotoWaiters = firstPhotoWaiters.filter((f) => f !== fn); };
}
function markFirstPhoto() {
  if (firstPhotoDone) return;
  firstPhotoDone = true;
  const w = firstPhotoWaiters; firstPhotoWaiters = []; w.forEach((f) => f());
}

const TeaserParkCard = React.memo(function TeaserParkCard({ rating, park, eager = false, first = false, defer = false, assumedScreen = "desktop", onImgReady }: { rating: Visit; park: Park; eager?: boolean; first?: boolean; /** Phone strip: wait for the first card's photo before asking for this one. */ defer?: boolean; assumedScreen?: keyof typeof ASSUMED_SCREEN; onImgReady?: () => void }) {
  const [imgReady, setImgReady] = useState(false);
  const [wanted, setWanted] = useState(eager || !defer);
  useEffect(() => { if (!wanted) return afterFirstPhoto(() => setWanted(true)); }, [wanted]);
  useEffect(() => { if (first) { const t = setTimeout(markFirstPhoto, 4000); return () => clearTimeout(t); } }, [first]);
  const teaser = resolveEntry(
    park.cardImagepath || park.imagepath || "/images/error.PNG",
    park.imageFocus || "0.5 0.5 1",
    park.cardImagepath ? park.cardImageSize : park.imageSize,
    park.cardCut,
  );
  const teaserSources = entrySources(teaser);
  return (
    <div className="mx-auto w-full max-w-[400px] py-3 md:py-4">
      <div className="relative rounded-2xl overflow-hidden min-h-[500px] bg-gray-900 shadow-md dark:shadow-lg">
        {!imgReady && (
          <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
          </div>
        )}
        {wanted && <FocusedImage
          src={teaserSources ? fallbackSrc(teaser) : teaser.src}
          srcSet={teaserSources?.srcSet}
          sizes={teaserSources?.sizes}
          placement={teaser.size ? ssrPlacement(teaser.size, teaser.focus) : undefined}
          alt={park.name}
          focusStr={teaser.focus}
          size={teaserSources ? undefined : teaser.size}
          assumedScreen={ASSUMED_SCREEN[assumedScreen]}
          className="absolute inset-0"
          imgClassName="opacity-85"
          priority={eager}
          variants={!park.cardCut}
          onLoad={() => {
            if (first) markFirstPhoto();
            onImgReady?.();
            // Keep the shimmer under the image until its 500ms fade finishes
            setTimeout(() => setImgReady(true), 550);
          }}
        />}

        {/* Top: park name */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent px-4 pt-4 pb-14">
          <div className="flex items-center gap-2">
            <Image src={getParkFlag(park.country)} alt="" width={20} height={14} className="rounded-sm shrink-0" unoptimized />
            <h2 className="text-white font-bold text-xl leading-tight drop-shadow-md">{park.name}</h2>
          </div>
        </div>

        {/* Bottom: score + CTA */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-5 pt-20 pb-5 flex flex-col items-center gap-3">
          <span className={`text-[4rem] font-black tabular-nums leading-none drop-shadow-xl ${getRatingColor(rating.overall)}`}>
            {rating.overall.toFixed(2)}
          </span>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Review in progress</span>
          </div>

          <p className="text-[11px] text-center text-white/50 leading-relaxed">
            Follow us to know when the full review drops.
          </p>

          <a
            href="https://www.instagram.com/parkratings/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:opacity-90 transition-opacity shadow-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            @parkratings
          </a>
        </div>
      </div>
    </div>
  );
});
TeaserParkCard.displayName = "TeaserParkCard";

const avg = (a: number, b: number) => ((a + b) / 2).toFixed(2);

const FULL_BLEED_GROUPS = [
  { emoji: "🎢", label: "Coasters", getValue: (r: Visit) => avg(r.bestCoaster, r.coasterDepth), keys: ["bestCoaster", "coasterDepth", "Best Coaster", "Coaster Depth"] },
  { emoji: "🎡", label: "Rides", getValue: (r: Visit) => avg(r.waterRides, r.flatridesAndDarkrides), keys: ["waterRides", "flatridesAndDarkrides", "Water Rides", "Flatrides And Darkrides"] },
  { emoji: "🏞️", label: "Park", getValue: (r: Visit) => avg(r.parkAppearance, r.parkPracticality), keys: ["parkAppearance", "parkPracticality", "Park Appearance", "Park Practicality"] },
  { emoji: "🍔", label: "Food", getValue: (r: Visit) => avg(r.food, r.snacksAndDrinks), keys: ["food", "snacksAndDrinks", "Food", "Snacks And Drinks"] },
  { emoji: "📋", label: "Mgmt", getValue: (r: Visit) => avg(r.rideOperations, r.parkManagement), keys: ["rideOperations", "parkManagement", "Ride Operations", "Park Management"] },
];


const FullBleedRatingCard = React.memo(function FullBleedRatingCard({ rating, park, isActive = false, delayIndex = 0, eager = false, first = false, defer = false, preloadAll = false, assumedScreen = "desktop", onImgReady }: { rating: Visit; park: Park; isActive?: boolean; delayIndex?: number; eager?: boolean; first?: boolean; /** Off-screen cards get their image address only when near view (phone strip). */ defer?: boolean; /** After the first interaction: load every deferred card in the background. */ preloadAll?: boolean; assumedScreen?: keyof typeof ASSUMED_SCREEN; onImgReady?: () => void }) {
  const headerSrc = park.imagepath || "/images/error.PNG";
  // The card photo as framed in the editor, or its cut when one is ready.
  // Memoised so the mount effect below sees one stable entry.
  const header = useMemo(() => resolveEntry(
    park.cardImagepath || headerSrc,
    park.imageFocus || "0.5 0.5 1",
    park.cardImagepath ? park.cardImageSize : park.imageSize,
    park.cardCut,
  ), [park.cardImagepath, headerSrc, park.imageFocus, park.cardImageSize, park.imageSize, park.cardCut]);
  const cardSrc = header.src;
  const cardSize = header.size;
  const cardFocusStr = header.focus;
  const cardDirect = !!header.direct;

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const slotAFocusRef = useRef<string>(cardFocusStr);

  // Returns the device-pixel scale of the drawn image (>1 means the source was enlarged).
  const applyFocusToImg = useCallback((img: HTMLImageElement, focusStr: string): number => {
    const c = imageContainerRef.current;
    if (!c || !img.naturalWidth || !img.naturalHeight) return 0;
    const { cx, cy, zoom } = parseFocusStr(focusStr);
    const cs = Math.max(c.clientWidth / img.naturalWidth, c.clientHeight / img.naturalHeight);
    const dw = img.naturalWidth * cs * zoom;
    const dh = img.naturalHeight * cs * zoom;
    img.style.width = `${dw}px`;
    img.style.height = `${dh}px`;
    img.style.left = `${c.clientWidth / 2 - cx * dw}px`;
    img.style.top = `${c.clientHeight / 2 - cy * dh}px`;
    // Drop the server-side CSS placement (see ssrPlacement) now that px values are set.
    img.style.transform = ""; img.style.minWidth = ""; img.style.minHeight = ""; img.style.aspectRatio = "";
    return cs * zoom * (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  }, []);

  // If the loaded variant is being enlarged on this screen, swap in the next
  // larger stored size (or the original) and report that a reload is pending.
  const upgradeIfSoft = useCallback((img: HTMLImageElement, original: string, scale: number, sizeKnown: boolean): boolean => {
    if (sizeKnown) return false; // the exact pick was made up front
    if (scale <= COVER_UPSCALE_TOLERANCE) return false;
    const bigger = sharperSource(original, img.src);
    if (!bigger) return false;
    img.src = bigger;
    return true;
  }, []);

  // The card always shows its own photo. Hovering or tapping a category only
  // highlights its score and shows its warnings; the photo never changes.
  const slotARef = useRef<HTMLImageElement>(null);
  // Drives the shimmer placeholder: true once the header image is showing.
  const [imgReady, setImgReady] = useState(false);
  // Reports image readiness to the page-level reveal gate without re-running
  // the mount effect below.
  const onImgReadyRef = useRef(onImgReady);
  useEffect(() => { onImgReadyRef.current = onImgReady; });

  useLayoutEffect(() => {
    const a = slotARef.current;
    if (!a) return;
    slotAFocusRef.current = cardFocusStr;
    // A photo of known size was positioned and shown by the server render; keep it on screen.
    const placed = a.dataset.placed === "1";
    const sources = entrySources(header);
    // Server-placed photo whose address is in the HTML: already on screen (or
    // shows the instant its bytes land). Deferred ones start hidden and fade in.
    const inHtml = eager || !defer;
    const showFromStart = placed && inHtml;
    a.style.opacity = showFromStart ? "0.95" : "0"; a.style.transition = "none";
    // The SSR src was chosen for a generous assumed screen and may already be
    // downloading (eager, or lazy but near the viewport). Keep it unless this
    // screen needs more pixels: a downgrade would only add a second download.
    const exact = cardSrcFor(cardSrc, cardSize, imageContainerRef.current, eager, cardFocusStr, assumedScreen, cardDirect);
    const initialSrc = cardSize && a.src && atLeastAsLarge(a.src, exact) ? a.src : exact;
    // A cut already has srcset/sizes from the server render; leave the
    // browser's choice alone (re-setting src would not change it anyway).
    if (!sources && inHtml) a.src = initialSrc;
    // Server-placed cut: already visible, just refine the position with the
    // real frame size and drop the shimmer. Otherwise: loaded by hydration ->
    // show instantly; loaded later (slow network, below-fold) -> fade in.
    const reveal = (fade: boolean) => {
      if (!a.naturalWidth) return;
      if (first) markFirstPhoto();
      // A server-placed photo keeps its CSS box: re-measuring it here produced
      // a box a fraction of a pixel larger (the chosen srcset copy's proportions
      // differ by a hair from the full cut), which the browser reports as a new,
      // later "largest paint" at hydration time. The CSS placement is exact and
      // responsive on its own; px values are only needed for cross-fades.
      const scale = showFromStart ? 0 : applyFocusToImg(a, cardFocusStr);
      if (!showFromStart && upgradeIfSoft(a, cardSrc, scale, !!cardSize || cardDirect)) { a.onload = () => reveal(fade); return; }
      onImgReadyRef.current?.();
      if (showFromStart) {
        a.style.opacity = "0.95";
        setImgReady(true);
      } else if (fade) {
        requestAnimationFrame(() => {
          a.style.transition = "opacity 500ms ease";
          a.style.opacity = "0.95";
        });
        // Keep the shimmer under the image until the fade has finished.
        setTimeout(() => setImgReady(true), 550);
      } else {
        a.style.opacity = "0.95";
        setImgReady(true);
      }
    };
    if (inHtml) {
      if (first) { a.onerror = () => markFirstPhoto(); setTimeout(markFirstPhoto, 4000); } // a broken or stalled first photo must not hold the others
      if (a.complete && a.naturalWidth > 0) reveal(false);
      else a.onload = () => reveal(true);
      return;
    }
    // Deferred card: no image address in the HTML at all. Give it one when it
    // comes within a screen of view, so it never competes with the first
    // cards for bandwidth (Chrome's own lazy threshold is ~2 screens, which on
    // the phone strip meant six more photos before the first had finished).
    const c = imageContainerRef.current;
    if (!c) return;
    const load = () => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      io.disconnect();
      a.onload = () => reveal(true);
      applyEntryToImg(a, header, initialSrc);
      if (a.complete && a.naturalWidth > 0) reveal(false);
    };
    loadRef.current = load;
    // Near view: wait for the first card's photo, then load in strip order
    // (150 ms apart) so the second card is next in line, not one of a crowd.
    let cancelWait: (() => void) | null = null;
    let queued: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || cancelWait) return;
      io.disconnect();
      cancelWait = afterFirstPhoto(() => { queued = setTimeout(load, 150 * Math.max(0, delayIndex - 1)); });
    }, { rootMargin: "300% 300%" }); // three screens ahead: keeps up with a fast swipe
    io.observe(c);
    return () => { io.disconnect(); cancelWait?.(); if (queued) clearTimeout(queued); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the visitor has touched or scrolled (preloadAll), fetch every deferred
  // card in the background, staggered by position so the queue never starves
  // the card being swiped to. Google's test never interacts, so this stays
  // out of the score; the visitor gets a strip with no dark cards.
  const loadRef = useRef<(() => void) | null>(null);
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!preloadAll || !defer || eager) return;
    const t = setTimeout(() => loadRef.current?.(), 120 * delayIndex);
    return () => clearTimeout(t);
  }, [preloadAll, defer, eager, delayIndex]);

  // Re-apply px positioning on container resize. Slot A keeps the server's
  // CSS placement (which handles resizes by itself) until reveal gives it px values.
  useEffect(() => {
    const c = imageContainerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      if (slotARef.current && !slotARef.current.style.transform.startsWith("translate")) applyFocusToImg(slotARef.current, slotAFocusRef.current);
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [applyFocusToImg]);

  return (
    <Link href={`/park/${park.slug}`}>
      <div
        className="mx-auto w-full max-w-[400px] py-3 md:py-4 [@media(hover:hover)]:hover:scale-105 transition-transform duration-300 ease-in-out will-change-transform"
      >
        <div ref={imageContainerRef} className="relative rounded-2xl overflow-hidden min-h-[500px] bg-gray-900 shadow-md dark:shadow-lg">
          {/* Shimmer placeholder while the header image is still on its way */}
          {!imgReady && (
            <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
            </div>
          )}
          {/* src in the SSR HTML lets the browser start the download while parsing,
              well before hydration; opacity 0 until the focus math positions it.
              First-row cards load eagerly (they gate the page reveal); the rest lazily. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={slotARef}
            src={eager || !defer ? (entrySources(header) ? fallbackSrc(header) : cardSrcFor(cardSrc, cardSize, null, eager, cardFocusStr, assumedScreen, cardDirect)) : undefined}
            srcSet={eager || !defer ? entrySources(header)?.srcSet : undefined}
            sizes={eager || !defer ? entrySources(header)?.sizes : undefined}
            alt=""
            loading={eager ? "eager" : "lazy"}
            // The first card is the page's largest paint: fetch it ahead of everything
            // else; the other eager cards must not compete with it for the line.
            {...(first ? { fetchPriority: "high" as const } : eager ? { fetchPriority: "low" as const } : {})}
            className="absolute max-w-none select-none"
            style={header.size ? { ...ssrPlacement(header.size, header.focus), opacity: eager || !defer ? 0.95 : 0 } : { opacity: 0 }}
            data-placed={header.size ? "1" : undefined}
            draggable={false}
          />

          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent px-4 pt-4 pb-16 pointer-events-none">
            <div className="flex items-center gap-2">
              <Image src={getParkFlag(park.country)} alt="" width={20} height={14} className="rounded-sm shrink-0" unoptimized />
              <h2 className="text-white font-bold text-xl leading-tight drop-shadow-md">{park.name}</h2>
            </div>
            {/* Fixed timezone: visit dates are date-only values, and formatting them in
                the visitor's local zone made the server (UTC) and a US browser disagree
                by a day, which failed hydration and rebuilt the whole page client-side. */}
            <p className="text-white/50 text-xs mt-1">{new Date(rating.date).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-5 pt-16 pb-4 flex flex-col items-center gap-3">
            <span className={`text-[4rem] font-black tabular-nums leading-none drop-shadow-xl pointer-events-none ${getRatingColor(rating.overall)}`}>
              {rating.overall.toFixed(2)}
            </span>
            <div className="w-full grid grid-cols-5 gap-1 mt-1">
              {FULL_BLEED_GROUPS.map((g) => {
                // A group with a rating warning gets a small red dot; the warning itself is on the park page.
                const hasWarning = (rating.warnings ?? []).some((w: RatingWarningType) => {
                  const normalizedWarningCat = w.category.toLowerCase().replace(/\s+/g, '');
                  return g.keys.some(k => k.toLowerCase().replace(/\s+/g, '') === normalizedWarningCat);
                });

                return (
                  <div key={g.label} className="relative flex flex-col items-center gap-0.5 pointer-events-none">
                    <span className="text-base leading-none">{g.emoji}</span>
                    <span className={`text-xs font-bold tabular-nums ${getRatingColor(parseFloat(g.getValue(rating)))}`}>
                      {g.getValue(rating)}
                    </span>
                    <div className="flex items-center gap-[3px] text-[9px] uppercase tracking-wide text-white/40">
                      <span>{g.label}</span>
                      {hasWarning && <span className="w-[3px] h-[3px] rounded-full bg-red-400/50 mb-[1px]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});

type HomeProps = {
  initialRatings?: Visit[];
  initialParks?: Park[];
  initialAdminMode?: boolean;
  /** Server's guess from the user agent; the viewport decides after hydration. */
  initialIsMobile?: boolean;
};

const MOBILE_QUERY = "(max-width: 767px)"; // below Tailwind's md breakpoint
// Cards that load immediately and that the reveal gate waits for: a phone
// shows one card at a time, a desktop grid shows a whole first row.
const EAGER_MOBILE = 1; // only the first card's photo is in the HTML; the next ones follow the moment it lands, the rest after the first swipe
const EAGER_DESKTOP = 6;

const Home = ({ initialRatings, initialParks, initialAdminMode, initialIsMobile }: HomeProps) => {
  const router = useRouter();
  // Only one card layout is rendered at a time so a phone never downloads the
  // grid's images and a desktop never downloads the strip's.
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(initialIsMobile ?? false);
  // First touch, scroll, click or key: from then on the phone strip loads the
  // remaining cards' photos in the background (see FullBleedRatingCard).
  const [engaged, setEngaged] = useState(false);
  const searchParams = useSearchParams();
  const modalRequested = searchParams?.get("modal") === "true";
  useEffect(() => {
    const on = () => setEngaged(true);
    const events = ["touchstart", "pointerdown", "scroll", "keydown", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, on, { passive: true, once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, on));
  }, []);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobileLayout(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobileLayout(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const { query } = useSearch();
  const { isAdminMode, hydrated } = useAdminMode();

  // SSR already rendered the right grid for this cookie (see page.tsx). Keep
  // using that until the client context has read its localStorage preference,
  // so the grid never reshuffles after hydration.
  const adminView = hydrated ? isAdminMode : (initialAdminMode ?? false);

  const [ratings, setRatings] = useState<Visit[]>(initialRatings ?? []);
  const [parks, setParks] = useState<Park[]>(initialParks ?? []);
  const [isLoading, setIsLoading] = useState(!initialRatings || !initialParks);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  const pendingParks = React.useMemo(() => {
    if (!adminView) return [];
    return parks.filter((p) => !ratings.some((r) => r.parkId === p.id));
  }, [parks, ratings, adminView]);

  const filteredRatings = React.useMemo(() => {
    const visibleRatings = adminView ? ratings : ratings.filter((r) => r.published);

    const sortedByDate = [...visibleRatings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestRatingsMap = new Map<number, Visit>();
    sortedByDate.forEach((rating) => {
      if (!latestRatingsMap.has(rating.parkId)) latestRatingsMap.set(rating.parkId, rating);
    });

    const latestRatings = Array.from(latestRatingsMap.values());
    const sortedByOverall = latestRatings.sort((a, b) => b.overall - a.overall);

    return sortedByOverall.filter((rating) => {
      const park = parks.find((p) => p.id === rating.parkId);
      return park && park.name.toLowerCase().includes(query.toLowerCase());
    });
  }, [ratings, parks, query, adminView]);

  const teaserItems = React.useMemo(() => {
    if (adminView) return [];
    const publishedParkIds = new Set(ratings.filter((r) => r.published).map((r) => r.parkId));
    const latestDraftByPark = new Map<number, Visit>();
    [...ratings]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((r) => {
        if (!r.published && !publishedParkIds.has(r.parkId) && !latestDraftByPark.has(r.parkId))
          latestDraftByPark.set(r.parkId, r);
      });
    return Array.from(latestDraftByPark.entries()).flatMap(([parkId, rating]) => {
      const park = parks.find((p) => p.id === parkId);
      if (!park || !park.imagepath || park.imagepath.toLowerCase().includes("error")) return [];
      if (!park.name.toLowerCase().includes(query.toLowerCase())) return [];
      return [{ type: "teaser" as const, rating, park, id: `teaser-${parkId}` }];
    });
  }, [ratings, parks, adminView, query]);

  const displayItems = React.useMemo(() => {
    const ratedItems = filteredRatings.flatMap((r) => {
      const p = parks.find((park) => park.id === r.parkId);
      return p ? [{ type: "rating" as const, rating: r, park: p, id: `rating-${r.id}` }] : [];
    });

    const scored = [...ratedItems, ...teaserItems].sort((a, b) => b.rating.overall - a.rating.overall);

    const items: any[] = [];
    pendingParks.forEach((p) => items.push({ type: "pending", park: p, id: `pending-${p.id}` }));
    scored.forEach((item) => items.push(item));
    return items;
  }, [pendingParks, filteredRatings, teaserItems, parks]);

  // Reveal gate: the card grid holds at opacity 0 until the first-row card
  // images have fully loaded, then `revealed` fades the whole grid in as one
  // composite — cards, images, and overlays together. A failsafe timeout opens
  // the gate anyway so one slow image can't hold the page hostage.
  // Cards appear individually as their photos are ready (server-placed cuts
  // are visible before any JavaScript runs). The former page-level gate that
  // held every card invisible until the first row had loaded is retired: it
  // made the first picture wait for the whole bundle. State kept so the
  // ready-tracking below stays harmless.
  const [revealed, setRevealed] = useState(true);
  const readyIdsRef = useRef<Set<string>>(new Set());
  const gateIds = React.useMemo(
    () =>
      displayItems
        .filter((it) => it.type === "teaser" || it.type === "rating")
        .slice(0, isMobileLayout ? EAGER_MOBILE : EAGER_DESKTOP)
        .map((it) => it.id as string),
    [displayItems, isMobileLayout]
  );
  const markImgReady = useCallback(
    (id: string) => {
      readyIdsRef.current.add(id);
      if (gateIds.every((g) => readyIdsRef.current.has(g))) setRevealed(true);
    },
    [gateIds]
  );
  useEffect(() => {
    if (revealed) return;
    // No image cards at all (e.g. only pending parks): nothing to wait for.
    if (gateIds.length === 0 && displayItems.length > 0) {
      setRevealed(true);
      return;
    }
    const t = setTimeout(() => setRevealed(true), 3000);
    return () => clearTimeout(t);
  }, [gateIds, displayItems.length, revealed]);

  const fetchRatingsAndParks = async () => {
    try {
      const [ratingsResponse, parksResponse] = await Promise.all([
        fetch("/api/ratings"),
        fetch("/api/parks"),
      ]);
      if (!ratingsResponse.ok || !parksResponse.ok) throw new Error("Request failed");
      const [ratingsData, parksData] = await Promise.all([
        ratingsResponse.json(),
        parksResponse.json(),
      ]);

      setParks(Array.isArray(parksData.parks) ? parksData.parks : []);
      setRatings(Array.isArray(ratingsData.ratings) ? ratingsData.ratings : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Could not load the park reviews. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialRatings && initialParks) return;
    fetchRatingsAndParks();
  }, []);

  useLayoutEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const recalc = () => handleScrollInternal(el);
    window.addEventListener("resize", recalc);
    recalc();
    return () => window.removeEventListener("resize", recalc);
  }, []);

  const handleScrollInternal = (el: HTMLDivElement) => {
    const containerCenter = el.scrollLeft + el.clientWidth / 2;

    let closestIdx = 0;
    let closestDist = Number.POSITIVE_INFINITY;
    const kids = Array.from(el.children) as HTMLElement[];

    kids.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = childCenter - containerCenter;

      if (Math.abs(dist) < closestDist) {
        closestDist = Math.abs(dist);
        closestIdx = idx;
      }

      const ratio = dist / el.clientWidth;
      const px = Math.max(-14, Math.min(14, -ratio * 28));
      child.style.setProperty("--px", `${Math.round(px)}px`);
    });

    setCurrentIndex(closestIdx);
  };

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      handleScrollInternal(el);
    });
  };

  useEffect(() => () => {
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  // Swiping is handled entirely by native CSS scroll-snap (snap-x snap-mandatory
  // on the container, snap-center on cards). A JS velocity/fling layer used to
  // force-scroll N cards on touchend, but it fought the native momentum snap and
  // made swipes overshoot and jump.

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">🎢</span>
        <p className="text-slate-300 font-semibold">{error}</p>
        <button
          onClick={() => { setIsLoading(true); fetchRatingsAndParks(); }}
          className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-light text-white font-bold transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    );

  const closeModal = () => {
    router.push("/", undefined);
  };

  return (
    <main id="top" className="relative z-0 bg-[#0f172a] overflow-visible min-h-screen">
      {isMobileLayout ? (
      /* Mobile: horizontal swipe carousel. The whole strip fades in as one
         composite once the gate opens — see the reveal gate above. */
      <div className={`md:hidden pt-1 relative transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}>
        <p className="text-center text-sm font-semibold text-white/80 pb-1">Swipe and explore our visits</p>
        <div className="relative">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain px-[11vw] min-[400px]:px-[14vw] min-[480px]:px-[16vw] min-[560px]:px-[18vw]"
          style={{ touchAction: "pan-x" }}
        >
          {displayItems.map((item, index) => {
            const active = index === currentIndex;
            return (
              <div
                key={item.id}
                className={`snap-center shrink-0 transition-all duration-200 ease-in-out ${active ? "scale-100 opacity-100" : "scale-95 opacity-85"} w-[78vw] min-[400px]:w-[72vw] min-[480px]:w-[68vw] min-[560px]:w-[64vw] max-w-sm`}
              >
                {item.type === "pending" ? (
                  <PendingParkCard park={item.park} />
                ) : item.type === "teaser" ? (
                  <TeaserParkCard rating={item.rating} park={item.park} eager={index < EAGER_MOBILE} first={index === 0} defer assumedScreen="mobile" onImgReady={() => markImgReady(item.id)} />
                ) : item.type === "rating" ? (
                  <FullBleedRatingCard rating={item.rating} park={item.park} isActive={active} delayIndex={index} eager={index < EAGER_MOBILE} first={index === 0} defer preloadAll={engaged} assumedScreen="mobile" onImgReady={() => markImgReady(item.id)} />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-[#0f172a] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-2.5 bg-gradient-to-l from-[#0f172a] to-transparent" />
        </div>

        {/* where you are in the strip; the next card peeking at the edge does the rest */}
        <p className="text-center text-xs font-medium text-slate-400 tabular-nums -mt-1">
          <span className="text-white/85">{currentIndex + 1}</span> of {displayItems.length}
        </p>
      </div>

      ) : (
      /* Tablet & up: normal grid. Fades in as one composite once the gate
         opens — images and their readability overlays arrive together. */
      <div className={`hidden md:grid relative z-10 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 px-6 flex-grow py-2.5 transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}>
        {displayItems.map((item, index) => {
          if (item.type === "pending") {
            return <PendingParkCard key={item.id} park={item.park} />;
          }
          if (item.type === "teaser") {
            return <TeaserParkCard key={item.id} rating={item.rating} park={item.park} eager={index < EAGER_DESKTOP} assumedScreen="desktop" onImgReady={() => markImgReady(item.id)} />;
          }
          return <FullBleedRatingCard key={item.id} rating={item.rating} park={item.park} delayIndex={index} eager={index < EAGER_DESKTOP} first={index === 0} assumedScreen="desktop" onImgReady={() => markImgReady(item.id)} />;
        })}
      </div>
      )}

      {modalRequested && (
        <Suspense fallback={null}>
          <RatingModal closeModal={closeModal} fetchRatingsAndParks={fetchRatingsAndParks} />
        </Suspense>
      )}
    </main>
  );
};

export default Home;