"use client";

import React, { useCallback, useEffect, useMemo, useState, Suspense, useRef, UIEvent, useLayoutEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { RatingWarningType, Visit, Park } from "@/app/types";
import RatingCard from "./components/RatingCard";
import RatingWarning from "./components/warnings/RatingWarning";
import RatingModal from "./components/RatingModal";
import { useRouter } from "next/navigation";
import { useSearch } from "./context/SearchContext";
import { useAdminMode } from "@/app/context/AdminModeContext";
import { isR2Image, variantKey, coverVariantUrl, sharperSource, exactCoverSrc, COVER_UPSCALE_TOLERANCE } from "@/app/lib/imageVariants";
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
// Point an <img> at an entry: cuts carry srcset/sizes so the browser picks the
// copy that matches its density; anything else is a single src.
function applyEntryToImg(img: HTMLImageElement, entry: CardEntry, src: string) {
  if (entry.cut) {
    img.sizes = cutSizes(entry.cut);
    img.srcset = cutSrcSet(entry.cut);
  } else {
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
  }
  img.src = src;
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

const DOTS_OFFSET = 10;

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


const TeaserParkCard = React.memo(function TeaserParkCard({ rating, park, eager = false, assumedScreen = "desktop", onImgReady }: { rating: Visit; park: Park; eager?: boolean; assumedScreen?: keyof typeof ASSUMED_SCREEN; onImgReady?: () => void }) {
  const [imgReady, setImgReady] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[400px] py-3 md:py-4">
      <div className="relative rounded-2xl overflow-hidden min-h-[500px] bg-gray-900 shadow-md dark:shadow-lg">
        {!imgReady && (
          <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
          </div>
        )}
        <FocusedImage
          src={park.cardCut ? park.cardCut.url : (park.cardImagepath || park.imagepath || "/images/error.PNG")}
          srcSet={park.cardCut ? cutSrcSet(park.cardCut) : undefined}
          sizes={park.cardCut ? cutSizes(park.cardCut) : undefined}
          placement={park.cardCut ? ssrPlacement({ w: park.cardCut.w, h: park.cardCut.h }, park.cardCut.focus) : (park.cardImagepath ? park.cardImageSize : park.imageSize) ? ssrPlacement((park.cardImagepath ? park.cardImageSize : park.imageSize)!, park.imageFocus || "0.5 0.5 1") : undefined}
          alt={park.name}
          focusStr={park.cardCut ? park.cardCut.focus : park.imageFocus}
          size={park.cardCut ? undefined : (park.cardImagepath ? park.cardImageSize : park.imageSize)}
          assumedScreen={ASSUMED_SCREEN[assumedScreen]}
          className="absolute inset-0"
          imgClassName="opacity-85"
          priority={eager}
          variants={!park.cardCut}
          onLoad={() => {
            onImgReady?.();
            // Keep the shimmer under the image until its 500ms fade finishes
            setTimeout(() => setImgReady(true), 550);
          }}
        />

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

const CARD_CATS = ["coasters", "rides", "park", "food", "mgmt"] as const;
type CardCat = typeof CARD_CATS[number];

const FullBleedRatingCard = React.memo(function FullBleedRatingCard({ rating, park, isActive = false, autoCycle = true, delayIndex = 0, eager = false, first = false, assumedScreen = "desktop", onImgReady }: { rating: Visit; park: Park; isActive?: boolean; autoCycle?: boolean; delayIndex?: number; eager?: boolean; first?: boolean; assumedScreen?: keyof typeof ASSUMED_SCREEN; onImgReady?: () => void }) {
  const headerSrc = park.imagepath || "/images/error.PNG";
  // The card photo as framed in the editor, or its cut when one is ready.
  // Memoised: it feeds the hover/cycle callbacks and the mobile effect below,
  // and a fresh object per render made that effect cancel in-flight fades.
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
  const slotBFocusRef = useRef<string>(cardFocusStr);
  // Logical (un-optimized) src per slot — DOM .src now holds the /_next/image
  // rewrite, so "which image is this slot showing" must be tracked separately.
  const slotARawSrcRef = useRef<string>(cardSrc);
  const slotBRawSrcRef = useRef<string>(cardSrc);

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

  const getCardEntry = useCallback((label: string): CardEntry => {
    const key = label.toLowerCase() as CardCat;
    // Coasters is always the card photo itself, with the card's framing; the
    // picker's Coasters slot is ignored.
    if (key === "coasters") return header;
    const entry = park.cardImages?.[key];
    if (entry?.src) return resolveEntry(entry.src, entry.focus, entry.size, entry.cut);
    return header;
  }, [park.cardImages, header]);

  const getCycleImages = useCallback(() =>
    FULL_BLEED_GROUPS
      .map(g => ({ label: g.label, ...getCardEntry(g.label) })),
    [getCardEntry]);

  // Two-slot cross-fade — both slots always sum to opacity 0.7, no black ever shows
  const slotARef = useRef<HTMLImageElement>(null);
  const slotBRef = useRef<HTMLImageElement>(null);
  const activeSlotRef = useRef<"A" | "B">("A");
  // True while a category image (not the header) is displayed — lets us skip
  // pointless fade-to-header transitions that made the carousel blink on swipe
  const showingCategoryRef = useRef(false);
  const raf1Ref = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  // Drives the shimmer placeholder: true once the header image is showing.
  const [imgReady, setImgReady] = useState(false);
  // Reports image readiness to the page-level reveal gate without re-running
  // the mount effect below.
  const onImgReadyRef = useRef(onImgReady);
  useEffect(() => { onImgReadyRef.current = onImgReady; });

  useLayoutEffect(() => {
    const a = slotARef.current;
    const b = slotBRef.current;
    if (!a || !b) return;
    slotAFocusRef.current = cardFocusStr;
    slotBFocusRef.current = cardFocusStr;
    slotARawSrcRef.current = cardSrc;
    slotBRawSrcRef.current = cardSrc;
    // A photo of known size was positioned and shown by the server render; keep it on screen.
    const placed = a.dataset.placed === "1";
    a.style.opacity = placed ? "0.95" : "0"; a.style.transition = "none";
    b.style.opacity = "0"; b.style.transition = "none";
    // The SSR src was chosen for a generous assumed screen and may already be
    // downloading (eager, or lazy but near the viewport). Keep it unless this
    // screen needs more pixels: a downgrade would only add a second download.
    const exact = cardSrcFor(cardSrc, cardSize, imageContainerRef.current, eager, cardFocusStr, assumedScreen, cardDirect);
    const initialSrc = cardSize && a.src && atLeastAsLarge(a.src, exact) ? a.src : exact;
    // A cut already has srcset/sizes from the server render; leave the
    // browser's choice alone (re-setting src would not change it anyway).
    if (!header.cut) a.src = initialSrc;
    // Slot B only gets a src when a cross-fade needs it; giving it the header
    // image here made every card (lazy or not) download immediately.
    // Server-placed cut: already visible, just refine the position with the
    // real frame size and drop the shimmer. Otherwise: loaded by hydration ->
    // show instantly; loaded later (slow network, below-fold) -> fade in.
    const reveal = (fade: boolean) => {
      if (!a.naturalWidth) return;
      const scale = applyFocusToImg(a, cardFocusStr);
      if (upgradeIfSoft(a, cardSrc, scale, !!cardSize || cardDirect)) { a.onload = () => reveal(fade); return; }
      onImgReadyRef.current?.();
      if (placed) {
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
    if (a.complete && a.naturalWidth > 0) reveal(false);
    else a.onload = () => reveal(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isHoveringRef = useRef(false);
  const hoveredCatRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleFirstRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleIdxRef = useRef(0);
  const cycleListRef = useRef<{ label: string; src: string; focus: string }[]>([]);

  const cancelInFlight = useCallback(() => {
    if (raf1Ref.current) { cancelAnimationFrame(raf1Ref.current); raf1Ref.current = null; }
    if (raf2Ref.current) { cancelAnimationFrame(raf2Ref.current); raf2Ref.current = null; }
    // Snap slots back to a clean state so the next transition always starts correctly
    const activeEl = (activeSlotRef.current === "A" ? slotARef : slotBRef).current;
    const inactiveEl = (activeSlotRef.current === "A" ? slotBRef : slotARef).current;
    if (activeEl) { activeEl.style.transition = "none"; activeEl.style.opacity = "0.95"; }
    if (inactiveEl) { inactiveEl.style.transition = "none"; inactiveEl.style.opacity = "0"; }
    [slotARef, slotBRef].forEach(r => { if (r.current) { r.current.onload = null; r.current.onerror = null; } });
  }, []);

  const transitionTo = useCallback((entry: CardEntry | null, label: string | null) => {
    cancelInFlight();
    setActiveLabel(label);
    showingCategoryRef.current = entry != null;

    const target: CardEntry = entry ?? header;
    // Already showing this photo (e.g. Coasters = the card photo): nothing to
    // fade, just record the label. Avoids a cross-fade between identical images.
    const activeRaw = activeSlotRef.current === "A" ? slotARawSrcRef.current : slotBRawSrcRef.current;
    if (target.src === activeRaw) return;
    const [inactiveRef, activeRef, nextSlot] = activeSlotRef.current === "A"
      ? [slotBRef, slotARef, "B" as const]
      : [slotARef, slotBRef, "A" as const];

    const inactive = inactiveRef.current;
    const active = activeRef.current;
    if (!inactive || !active) return;

    applyEntryToImg(inactive, target, cardSrcFor(target.src, target.size, imageContainerRef.current, false, target.focus, assumedScreen, target.direct));
    if (inactiveRef === slotARef) {
      slotAFocusRef.current = target.focus;
      slotARawSrcRef.current = target.src;
    } else {
      slotBFocusRef.current = target.focus;
      slotBRawSrcRef.current = target.src;
    }

    const startFade = () => {
      inactive.onload = null;
      inactive.onerror = null;
      const scale = applyFocusToImg(inactive, target.focus);
      if (upgradeIfSoft(inactive, target.src, scale, !!target.size || !!target.direct)) { inactive.onload = startFade; inactive.onerror = startFade; return; }
      raf1Ref.current = requestAnimationFrame(() => {
        raf2Ref.current = requestAnimationFrame(() => {
          inactive.style.transition = "opacity 700ms ease-in-out";
          inactive.style.opacity = "0.95";
          active.style.transition = "opacity 700ms ease-in-out";
          active.style.opacity = "0";
          activeSlotRef.current = nextSlot;
        });
      });
    };

    if (inactive.complete && inactive.naturalWidth > 0) {
      startFade();
    } else {
      inactive.onload = startFade;
      inactive.onerror = startFade;
    }
  }, [cancelInFlight, cardSrc, cardFocusStr, applyFocusToImg, upgradeIfSoft]);

  const stopCycle = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (cycleFirstRef.current) { clearTimeout(cycleFirstRef.current); cycleFirstRef.current = null; }
  }, []);

  const startCycle = useCallback((initialDelay = 1500) => {
    if (intervalRef.current || cycleFirstRef.current) return;
    // Skip images that are the same src as the header — no point cycling to what's already shown
    const imgs = getCycleImages().filter(img => img.src !== cardSrc);
    cycleListRef.current = imgs;
    if (imgs.length === 0) return;
    cycleIdxRef.current = -1;
    cycleFirstRef.current = setTimeout(() => {
      cycleFirstRef.current = null;
      const list = cycleListRef.current;
      if (!list.length) return;
      cycleIdxRef.current = 0;
      transitionTo(list[0], list[0].label);
      intervalRef.current = setInterval(() => {
        const l = cycleListRef.current;
        if (!l.length) return;
        cycleIdxRef.current = (cycleIdxRef.current + 1) % l.length;
        transitionTo(l[cycleIdxRef.current], l[cycleIdxRef.current].label);
      }, 4500);
    }, initialDelay);
  }, [getCycleImages, transitionTo]);

  // Mobile: auto-cycle the active card's category images, but only once the
  // visitor has touched or scrolled the page (autoCycle). Cycling on its own
  // cost every phone visitor 2-4 MB of category images they might never look
  // at, and its cross-fades were what Google's speed test recorded as the
  // page's largest paint. Tapping a category still works immediately.
  useEffect(() => {
    if (isActive && autoCycle) {
      startCycle(3000);
    } else {
      stopCycle();
      // Only fade back if a category image is actually showing — blindly
      // transitioning re-faded the header onto itself on every swipe
      if (showingCategoryRef.current) transitionTo(null, null);
    }
  }, [isActive, autoCycle, startCycle, stopCycle, transitionTo]);

  // Re-apply absolute positioning on container resize
  useEffect(() => {
    const c = imageContainerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      if (slotARef.current) applyFocusToImg(slotARef.current, slotAFocusRef.current);
      if (slotBRef.current) applyFocusToImg(slotBRef.current, slotBFocusRef.current);
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [applyFocusToImg]);

  useEffect(() => () => {
    stopCycle();
    cancelInFlight();
    if (cardEnterTimerRef.current) clearTimeout(cardEnterTimerRef.current);
    if (catHoverTimerRef.current) clearTimeout(catHoverTimerRef.current);
    if (catLeaveTimerRef.current) clearTimeout(catLeaveTimerRef.current);
    if (cycleFirstRef.current) clearTimeout(cycleFirstRef.current);
    if (cycleRestartRef.current) clearTimeout(cycleRestartRef.current);
  }, [stopCycle, cancelInFlight]);

  const cardEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardEnter = useCallback(() => {
    isHoveringRef.current = true;
    // Short delay: if cursor entered directly onto a category pill,
    // handleCatEnter fires within ~16ms and sets hoveredCatRef, skipping the cycle
    if (cardEnterTimerRef.current) clearTimeout(cardEnterTimerRef.current);
    cardEnterTimerRef.current = setTimeout(() => {
      if (isHoveringRef.current && !hoveredCatRef.current) startCycle();
    }, 60);
  }, [startCycle]);

  const handleCardLeave = useCallback(() => {
    isHoveringRef.current = false;
    hoveredCatRef.current = null;
    if (cardEnterTimerRef.current) { clearTimeout(cardEnterTimerRef.current); cardEnterTimerRef.current = null; }
    if (catHoverTimerRef.current) { clearTimeout(catHoverTimerRef.current); catHoverTimerRef.current = null; }
    if (catLeaveTimerRef.current) { clearTimeout(catLeaveTimerRef.current); catLeaveTimerRef.current = null; }
    if (cycleRestartRef.current) { clearTimeout(cycleRestartRef.current); cycleRestartRef.current = null; }
    stopCycle();
    const activeEl = (activeSlotRef.current === "A" ? slotARef : slotBRef).current;
    const activeRawSrc = activeSlotRef.current === "A" ? slotARawSrcRef.current : slotBRawSrcRef.current;
    const isOnHeader = !activeEl || activeRawSrc === cardSrc || activeEl.src === "";
    if (isOnHeader) {
      // Already showing header — cancel silently, no visible transition
      cancelInFlight();
      setActiveLabel(null);
    } else {
      // A category image is showing — fade back to header gracefully
      transitionTo(null, null);
    }
  }, [stopCycle, cancelInFlight, transitionTo, cardSrc]);

  const cycleRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCatEnter = useCallback((label: string) => {
    if (catLeaveTimerRef.current) { clearTimeout(catLeaveTimerRef.current); catLeaveTimerRef.current = null; }
    if (catHoverTimerRef.current) { clearTimeout(catHoverTimerRef.current); catHoverTimerRef.current = null; }
    if (cycleRestartRef.current) { clearTimeout(cycleRestartRef.current); cycleRestartRef.current = null; }
    hoveredCatRef.current = label;
    stopCycle();
    // Only show image after intentional hover (500ms) — prevents accidental triggers
    catHoverTimerRef.current = setTimeout(() => {
      catHoverTimerRef.current = null;
      if (hoveredCatRef.current !== label) return;
      const entry = getCardEntry(label);
      transitionTo(entry, entry ? label : null);
    }, 500);
  }, [stopCycle, getCardEntry, transitionTo]);

  const handleCatLeave = useCallback(() => {
    if (catHoverTimerRef.current) { clearTimeout(catHoverTimerRef.current); catHoverTimerRef.current = null; }
    if (catLeaveTimerRef.current) clearTimeout(catLeaveTimerRef.current);
    catLeaveTimerRef.current = setTimeout(() => {
      catLeaveTimerRef.current = null;
      hoveredCatRef.current = null;
      stopCycle();
      transitionTo(getCardEntry("Coasters"), null);
      if (isHoveringRef.current) {
        if (cycleRestartRef.current) clearTimeout(cycleRestartRef.current);
        cycleRestartRef.current = setTimeout(() => {
          if (isHoveringRef.current && !hoveredCatRef.current) startCycle();
        }, 800);
      }
    }, 50);
  }, [stopCycle, getCardEntry, transitionTo, startCycle]);

  const handleCatTap = useCallback((e: React.MouseEvent, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (hoveredCatRef.current === label) {
      hoveredCatRef.current = null;
      startCycle();
    } else {
      hoveredCatRef.current = label;
      stopCycle();
      const entry = getCardEntry(label);
      transitionTo(entry, entry ? label : null);
    }
  }, [getCardEntry, startCycle, stopCycle, transitionTo]);

  return (
    <Link href={`/park/${park.slug}`}>
      <div
        className="mx-auto w-full max-w-[400px] py-3 md:py-4 [@media(hover:hover)]:hover:scale-105 transition-transform duration-300 ease-in-out will-change-transform"
        onPointerEnter={(e) => { if (e.pointerType === "mouse") handleCardEnter(); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") handleCardLeave(); }}
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
            src={cardSrcFor(cardSrc, cardSize, null, eager, cardFocusStr, assumedScreen, cardDirect)}
            srcSet={header.cut ? cutSrcSet(header.cut) : undefined}
            sizes={header.cut ? cutSizes(header.cut) : undefined}
            alt=""
            loading={eager ? "eager" : "lazy"}
            // The first card is the page's largest paint: ask the browser to fetch it ahead of scripts and styles.
            {...(first ? { fetchpriority: "high" } : {})}
            className="absolute max-w-none select-none"
            style={header.size ? { ...ssrPlacement(header.size, header.focus), opacity: 0.95 } : { opacity: 0 }}
            data-placed={header.size ? "1" : undefined}
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={slotBRef} alt="" loading="lazy" className="absolute max-w-none select-none" style={{ opacity: 0 }} draggable={false} />

          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent px-4 pt-4 pb-16 pointer-events-none">
            <div className="flex items-center gap-2">
              <Image src={getParkFlag(park.country)} alt="" width={20} height={14} className="rounded-sm shrink-0" unoptimized />
              <h2 className="text-white font-bold text-xl leading-tight drop-shadow-md">{park.name}</h2>
            </div>
            <p className="text-white/50 text-xs mt-1">{new Date(rating.date).toLocaleDateString("en-GB")}</p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-5 pt-16 pb-4 flex flex-col items-center gap-3">
            <span className={`text-[4rem] font-black tabular-nums leading-none drop-shadow-xl pointer-events-none ${getRatingColor(rating.overall)}`}>
              {rating.overall.toFixed(2)}
            </span>
            <div className="w-full grid grid-cols-5 gap-1 mt-1">
              {FULL_BLEED_GROUPS.map((g, index) => {
                const highlighted = activeLabel === g.label;

                // Find any warnings mapped to this specific group
                const warningsForGroup = rating.warnings?.filter((w: RatingWarningType) => {
                  const normalizedWarningCat = w.category.toLowerCase().replace(/\s+/g, '');
                  return g.keys.some(k => k.toLowerCase().replace(/\s+/g, '') === normalizedWarningCat);
                }) ?? [];

                return (
                  <div key={g.label} className="relative flex flex-col items-center gap-0.5 cursor-pointer"
                    onPointerEnter={(e) => { if (e.pointerType === "mouse") handleCatEnter(g.label); }}
                    onPointerLeave={(e) => { if (e.pointerType === "mouse") handleCatLeave(); }}
                    onClick={(e) => handleCatTap(e, g.label)}
                  >
                    {warningsForGroup.length > 0 && (
                      <RatingWarning
                        warning={warningsForGroup}
                        coasters={[]}
                        tooltipDirection="up"
                        align={index < 2 ? "left" : index === 2 ? "center" : "right"}
                        trigger="manual"
                        show={highlighted}
                      />
                    )}

                    <span className={`transition-transform duration-300 leading-none ${highlighted ? "scale-125" : "text-base"}`}>{g.emoji}</span>
                    <span className={`text-xs font-bold tabular-nums ${getRatingColor(parseFloat(g.getValue(rating)))}`}>
                      {g.getValue(rating)}
                    </span>
                    <div className={`flex items-center gap-[3px] text-[9px] uppercase tracking-wide transition-all duration-300 ${highlighted ? "text-white/90 border-b border-white/60 pb-px" : "text-white/40"}`}>
                      <span>{g.label}</span>
                      {warningsForGroup.length > 0 && !highlighted && (
                        <span className="w-[3px] h-[3px] rounded-full bg-red-400/50 mb-[1px]" />
                      )}
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
const EAGER_MOBILE = 2;
const EAGER_DESKTOP = 6;

const Home = ({ initialRatings, initialParks, initialAdminMode, initialIsMobile }: HomeProps) => {
  const router = useRouter();
  // Only one card layout is rendered at a time so a phone never downloads the
  // grid's images and a desktop never downloads the strip's.
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(initialIsMobile ?? false);
  // First touch, scroll, click or key: from then on the active phone card may
  // auto-cycle its category images (see FullBleedRatingCard).
  const [engaged, setEngaged] = useState(false);
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
      <div className={`md:hidden px-4 py-3 relative transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}>
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar overscroll-x-contain px-[11vw]"
          style={{ touchAction: "pan-x" }}
        >
          {displayItems.map((item, index) => {
            const active = index === currentIndex;
            return (
              <div
                key={item.id}
                className={`snap-center shrink-0 transition-all duration-200 ease-in-out ${active ? "scale-100 opacity-100" : "scale-95 opacity-80"} w-[78vw] min-[400px]:w-[72vw] min-[480px]:w-[68vw] min-[560px]:w-[64vw] max-w-sm`}
              >
                {item.type === "pending" ? (
                  <PendingParkCard park={item.park} />
                ) : item.type === "teaser" ? (
                  <TeaserParkCard rating={item.rating} park={item.park} eager={index < EAGER_MOBILE} assumedScreen="mobile" onImgReady={() => markImgReady(item.id)} />
                ) : item.type === "rating" ? (
                  <FullBleedRatingCard rating={item.rating} park={item.park} isActive={active} autoCycle={engaged} delayIndex={index} eager={index < EAGER_MOBILE} first={index === 0} assumedScreen="mobile" onImgReady={() => markImgReady(item.id)} />
                ) : (
                  <RatingCard
                    rating={item.rating}
                    park={item.park}
                    delayIndex={index}
                    ratingWarnings={item.rating.warnings?.map((w: any) => ({
                      ratingId: w.ratingId ?? item.rating.id,
                      category: w.category ?? "",
                      ride: w.ride,
                      note: w.note,
                      severity: w.severity || "Moderate",
                    })) as RatingWarningType[]}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-[#0f172a] to-transparent" />
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-2 py-1 bg-white/10 backdrop-blur-sm"
          style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${DOTS_OFFSET}px)` }}
        >
          {displayItems.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ease-in-out ${i === currentIndex ? "w-5 bg-brand" : "w-2 bg-gray-600"}`}
            />
          ))}
        </div>
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

      <Suspense fallback={null}>
        <RatingModal closeModal={closeModal} fetchRatingsAndParks={fetchRatingsAndParks} />
      </Suspense>
    </main>
  );
};

export default Home;