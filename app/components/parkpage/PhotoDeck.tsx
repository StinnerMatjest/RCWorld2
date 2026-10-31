"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, motionValue, animate, type MotionValue } from "framer-motion";
import { R2Image } from "../R2Image";
import { isR2Image, variantKey } from "@/app/lib/imageVariants";
import { hasCustomFocus, placeCover, replaceCovers } from "@/app/lib/coverPlacement";
import type { VisitGalleryImage } from "./VisitGallery";

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

interface Props {
  images: VisitGalleryImage[];
  parkName: string;
  /** Tap on the top card. */
  onOpen: (image: VisitGalleryImage) => void;
  isAdminMode?: boolean;
  onEdit?: () => void;
  /** Photo id to open the pile on (the clean-up tool's preview); default the first. */
  startAt?: number;
}

/** How many cards of the pile are drawn. */
const VISIBLE = 4;
const THROW_PX = 90;
const THROW_VELOCITY = 500;
/** After this many swipes (either way), or this long after the first one, the
 *  hint under the pile points to the full gallery. */
const GALLERY_NUDGE_AFTER = 5;
const GALLERY_NUDGE_MS = 10_000;
/** A thrown card leaves and a brought-back card lands in the same time. */
const MOVE_S = 0.22;
/** A card surfacing at the back of the pile, or sinking out of it, fades this
 *  slowly so the eye never catches it appearing. */
const DEPTH_FADE_MS = 1200;
/** Without a curated set, the deck shows this many of the visit's photos. */
const FALLBACK_COUNT = 12;
const EASE_OUT = [0.2, 0, 0, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

/**
 * Where a card lies in the pile: its own fixed offset and tilt, from its id,
 * so every card has a resting place that never changes. Nothing in the pile
 * moves when a card is thrown; the thrown card leaves and reappears at the
 * bottom in its own place.
 */
function restingPlace(id: number, index: number) {
  const f = (v: number) => v - Math.floor(v);
  const r1 = f(Math.sin(id * 12.9898) * 43758.5453);
  const r2 = f(Math.sin(id * 78.233) * 43758.5453);
  const r3 = f(Math.sin(id * 37.719) * 43758.5453);
  // Successive cards lean to alternate sides, so the pile always reads as a
  // fan rather than a run of cards tilted the same way; the amount is the card's own.
  const side = index % 2 === 0 ? -1 : 1;
  return { x: side * (8 + r1 * 14), y: (r2 - 0.5) * 20 - 8, rotate: side * (2 + r3 * 5) };
}

/** Both gallery links scroll there smoothly; the hash stays as the fallback. */
const goToGallery = (e: React.MouseEvent) => {
  const g = document.getElementById("gallery");
  if (g) { e.preventDefault(); g.scrollIntoView({ behavior: "smooth", block: "start" }); }
};

/** The size hint for a deck card's photo (see the R2Image below). */
function deckSizes(g: VisitGalleryImage): string {
  const k = g.w && g.h ? Math.max(1, 1.25 * (g.w / g.h)) : 2.23;
  return `(min-width: 640px) 760px, min(${Math.ceil(78 * k)}vw, ${Math.ceil(340 * k)}px)`;
}

export default function PhotoDeck({ images, parkName, onOpen, isAdminMode = false, onEdit, startAt }: Props) {
  const shown = useMemo(() => {
    const photos = images.filter((g) => !isVideo(g.path));
    const picked = photos.filter((g) => g.featured);
    return picked.length ? picked : photos.slice(0, FALLBACK_COUNT);
  }, [images]);

  // The pile as indexes into `shown`; the first is on top. Indexes that no
  // longer exist (the gallery changed under us) are dropped on read.
  // Opened on startAt's photo when given, as if the ones before it had been swiped away.
  const startIdx = useMemo(() => (startAt == null ? 0 : Math.max(0, shown.findIndex((g) => g.id === startAt))), [shown, startAt]);
  const [order, setOrder] = useState<number[]>(() => shown.map((_, i) => (i + startIdx) % shown.length));
  useEffect(() => {
    setOrder(shown.map((_, i) => (i + startIdx) % shown.length));
    flyingRef.current = []; setFlyingState([]);
    raisedRef.current = null; setRaisedState(null);
  }, [shown, startIdx]);
  const pile = order.filter((i) => i < shown.length);
  // Swipes in either direction, for the gallery nudge.
  const [swipes, setSwipes] = useState(0);
  const [nudgeTime, setNudgeTime] = useState(false);
  const swiped = swipes > 0;
  useEffect(() => {
    if (!swiped) return;
    const t = window.setTimeout(() => setNudgeTime(true), GALLERY_NUDGE_MS);
    return () => window.clearTimeout(t);
  }, [swiped]);
  const single = shown.length === 1;
  // Every fade in the pile is a CSS transition, never a framer opacity
  // animation: on Android, opacity written from JavaScript each frame blinked
  // the whole card, while the browser's own transitions are clean (bisected on
  // the user's phone, 2026-10-27). framer only moves cards sideways.

  // The order changes the moment a finger lets go, in both directions, so the
  // next swipe can start at once. Cards still in motion stay drawn above the
  // pile until they land: a thrown card flies off (flying), the previous card
  // being dragged back in rides on top (raised). Both read as front cards,
  // caption and all, and either can be caught mid-air by the next gesture.
  const flyingRef = useRef<number[]>([]);
  const [flying, setFlyingState] = useState<number[]>([]);
  const setFlying = (f: (prev: number[]) => number[]) => { flyingRef.current = f(flyingRef.current); setFlyingState(flyingRef.current); };
  const raisedRef = useRef<number | null>(null);
  const [raisedIdx, setRaisedState] = useState<number | null>(null);
  const setRaised = (v: number | null) => { raisedRef.current = v; setRaisedState(v); };

  const topImg = shown[pile[0]];
  // Every card owns its x and tilt for good, so when the pile rotates no card
  // changes hands: a swap is a z-index, nothing else.
  const mvs = useRef(new Map<number, { x: MotionValue<number>; rotate: MotionValue<number> }>());
  const mvFor = (idx: number) => {
    const id = shown[idx].id;
    let mv = mvs.current.get(id);
    if (!mv) { const pl = restingPlace(id, idx); mv = { x: motionValue(pl.x), rotate: motionValue(pl.rotate) }; mvs.current.set(id, mv); }
    return mv;
  };
  const placeOf = (idx: number) => restingPlace(shown[idx].id, idx);
  // One live move per card: a newer move or a grab makes an older move's
  // completion a no-op.
  const moveIds = useRef(new Map<number, number>());
  const claim = (idx: number) => { const t = (moveIds.current.get(idx) ?? 0) + 1; moveIds.current.set(idx, t); mvFor(idx).x.stop(); return t; };
  const live = (idx: number, t: number) => moveIds.current.get(idx) === t;
  const pileRef = useRef(pile);
  pileRef.current = pile;

  // Focused photos are placed in px for the card's size: on mount (server-drawn
  // photos are already loaded, so onLoad never fires), when the pile changes,
  // and when the card's size changes.
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => { if (sectionRef.current) replaceCovers(sectionRef.current); });
  useEffect(() => {
    const onResize = () => { if (sectionRef.current) replaceCovers(sectionRef.current); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Warm the cards just below the mounted pile.
  useEffect(() => {
    for (const i of pile.slice(VISIBLE + 1, VISIBLE + 3)) {
      const src = shown[i]?.path;
      if (src && isR2Image(src)) { const img = new Image(); img.src = variantKey(src, 1200); }
    }
  }, [pile, shown]);
  const g = useRef({ active: false, dir: 0 as 0 | -1 | 1, idx: -1, base: 0, startX: 0, startY: 0, lastX: 0, lastT: 0, vx: 0, moved: false });

  // Throw the top card: it goes to the bottom of the order now and flies off.
  const throwTop = (idx: number) => {
    flushSync(() => {
      setFlying((f) => [...f.filter((i) => i !== idx), idx]);
      setOrder((o) => [...o.slice(1), o[0]]);
      setSwipes((n) => n + 1);
    });
    const t = claim(idx);
    animate(mvFor(idx).x, -(window.innerWidth + 120), { duration: MOVE_S, ease: EASE_IN }).then(() => {
      if (!live(idx, t)) return;
      flushSync(() => setFlying((f) => f.filter((i) => i !== idx)));
      // In a small pile the card lands in sight at the back: it slides in under
      // the pile. Otherwise it is hidden at the bottom and simply put back.
      const slot = pileRef.current.indexOf(idx);
      if (slot > 0 && slot < VISIBLE) {
        const t2 = claim(idx);
        animate(mvFor(idx).x, placeOf(idx).x, { duration: 0.35, ease: EASE_OUT }).then(() => { if (live(idx, t2)) moveIds.current.delete(idx); });
      } else {
        mvFor(idx).x.jump(placeOf(idx).x);
      }
    });
  };

  // Bring the previous card back: it is the top card now and lands in its place.
  const bringBack = (idx: number) => {
    flushSync(() => {
      setRaised(null);
      setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
      setSwipes((n) => n + 1);
    });
    claim(idx);
    animate(mvFor(idx).x, placeOf(idx).x, { duration: MOVE_S, ease: EASE_OUT });
  };

  // A bring-back let go too early: the card goes back out the way it came.
  const dropRaised = (idx: number) => {
    const t = claim(idx);
    animate(mvFor(idx).x, -(window.innerWidth + 120), { duration: 0.18, ease: EASE_IN }).then(() => {
      if (!live(idx, t)) return;
      flushSync(() => { if (raisedRef.current === idx) setRaised(null); });
      mvFor(idx).x.jump(placeOf(idx).x);
    });
  };

  const settleTop = (idx: number) => {
    claim(idx);
    animate(mvFor(idx).x, placeOf(idx).x, SPRING);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (single) return;
    const st = g.current;
    st.active = true; st.dir = 0; st.moved = false; st.startX = e.clientX; st.startY = e.clientY; st.lastX = e.clientX; st.lastT = performance.now(); st.vx = 0;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current;
    if (!st.active) return;
    const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
    if (!st.dir) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { st.active = false; return; } // a scroll: leave it to the page
      st.dir = dx < 0 ? -1 : 1;
      st.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const pileNow = pileRef.current;
      if (st.dir < 0) {
        // The top card, from wherever it is (it may still be landing).
        st.idx = pileNow[0];
        claim(st.idx);
        st.base = mvFor(st.idx).x.get();
      } else {
        // The previous card: caught mid-air if it is still flying off or
        // dropping out, otherwise brought from just off the left edge.
        st.idx = pileNow[pileNow.length - 1];
        const airborne = flyingRef.current.includes(st.idx) || raisedRef.current === st.idx;
        claim(st.idx);
        if (!airborne) mvFor(st.idx).x.jump(-window.innerWidth + placeOf(st.idx).x);
        st.base = mvFor(st.idx).x.get();
        flushSync(() => {
          setFlying((f) => f.filter((i) => i !== st.idx));
          setRaised(st.idx);
        });
      }
    }
    const now = performance.now();
    const dt = now - st.lastT;
    if (dt > 0) st.vx = 0.7 * st.vx + 0.3 * ((e.clientX - st.lastX) / dt) * 1000;
    st.lastX = e.clientX; st.lastT = now;
    // The card only slides with the finger; it keeps its own lean throughout.
    mvFor(st.idx).x.set(st.base + (st.dir < 0 ? dx : Math.max(0, dx)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const st = g.current;
    if (!st.active) return;
    st.active = false;
    const dx = e.clientX - st.startX;
    if (!st.moved) { if (topImg) onOpen(topImg); return; }
    const flung = Math.abs(dx) > THROW_PX || Math.abs(st.vx) > THROW_VELOCITY;
    if (st.dir < 0) {
      if (flung && dx < 0) throwTop(st.idx);
      else settleTop(st.idx);
    } else {
      if (flung && dx > 0) bringBack(st.idx);
      else dropRaised(st.idx);
    }
  };
  const onPointerCancel = () => {
    const st = g.current;
    if (!st.active) return;
    st.active = false;
    if (!st.dir) return;
    if (st.dir < 0) settleTop(st.idx);
    else dropRaised(st.idx);
  };

  if (shown.length === 0) return null;

  return (
    <section id="photo-deck" ref={sectionRef} className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-xl font-bold text-white">
          Curated photos
        </h2>
        <div className="flex items-baseline gap-4">
          {isAdminMode && onEdit && (
            <button type="button" onClick={onEdit} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">Edit</button>
          )}
          <a href="#gallery" onClick={goToGallery} className="text-[11px] font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">Go to gallery</a>
        </div>
      </div>

      {/* The frame is the card plus the room the spread of the pile needs. */}
      <div
        className="relative w-full touch-pan-y select-none"
        style={{ height: "min(108vw, 480px)" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      >
        {/* Swipe hint: a chevron at the edge of the pile, until the first throw.
            Always mounted; it fades, so it never pops in or out mid-gesture. */}
        {!single && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 text-white/70 pointer-events-none" style={{ opacity: swiped ? 0 : 1, transition: "opacity 300ms ease" }} aria-hidden>
            <div className="deck-nudge">
              <svg className="w-7 h-7 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        )}
        {/* The pile: VISIBLE cards drawn, one more mounted beneath them at
            opacity 0, and the previous card (the bottom of the order) mounted
            hidden at the very back. Every card a gesture can reveal is already
            in the DOM and decoded, so the order swap after a gesture creates
            and destroys nothing in view: a card surfacing into the pile fades
            in by CSS transition, a card sinking out of it fades out, the thrown
            card is simply hidden at the back, and the brought-back card takes
            over from the ghost that dragged it in, pixel for pixel. */}
        {[...new Set([...pile.slice(0, VISIBLE + 1), pile[pile.length - 1], ...flying, ...(raisedIdx !== null ? [raisedIdx] : [])])]
          .filter((imgIdx) => imgIdx !== undefined && shown[imgIdx])
          // DOM order is fixed (by photo), stacking is z-index only: if the DOM
          // order followed the pile, React would move card nodes when the pile
          // rotates, and a moved node drops its running CSS transitions.
          .sort((a, b) => a - b)
          .map((imgIdx) => {
          const img = shown[imgIdx];
          const slot = pile.indexOf(imgIdx);
          const mv = mvFor(imgIdx);
          const place = restingPlace(img.id, imgIdx);
          // In motion above the pile: a thrown card on its way out, or the
          // previous card on its way in. Both look like the front card.
          const isFlying = flying.includes(imgIdx);
          const raised = raisedIdx === imgIdx;
          const airborne = isFlying || raised;
          const isTop = slot === 0;
          const front = isTop || airborne;
          const inPile = !airborne && slot >= 0 && slot <= VISIBLE;
          // Fades run only for cards changing places inside the pile; a card
          // leaving for or arriving from off screen switches its look at once,
          // out of sight.
          const ease = inPile ? "opacity 300ms ease" : "none";
          const depthEase = inPile ? `opacity ${DEPTH_FADE_MS}ms ease` : "none";
          const layer = { marginLeft: "-39vw", willChange: "transform", backfaceVisibility: "hidden" as const, WebkitBackfaceVisibility: "hidden" as const };
          const fade = airborne || isTop
            ? { opacity: 1, transition: ease }
            : inPile
              ? { opacity: slot < VISIBLE ? 1 : 0, transition: depthEase }
              : { opacity: 0, visibility: "hidden" as const };
          const zIndex = isFlying ? VISIBLE + 3 : raised ? VISIBLE + 2 : isTop ? VISIBLE + 1 : inPile ? Math.max(0, VISIBLE - slot) : 0;
          return (
            <motion.div
              key={img.id}
              // No overflow clipping on the card: a rounded clip around an animated
              // layer makes Android rebuild its mask when an animation starts or
              // ends, which blinks the whole card. The image and overlays carry
              // the corners themselves, and translateZ keeps each card on its own
              // layer for good, so nothing is promoted or demoted mid-animation.
              // No background on the card either: a dark backing behind a rounded
              // image shows as a fringe along the anti-aliased edge of a rotated
              // card whenever the edge is re-rasterised, which reads as a blink.
              className="absolute left-1/2 top-3 w-[78vw] max-w-[340px] aspect-[4/5] rounded-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
              // willChange set by hand: framer would otherwise add it for the length
              // of each animation and remove it after, and that demotion rebuilds
              // the layer (another repaint of the photo).
              // Every card sits in its own place, the front one included: coming
              // to the front it only brightens (CSS). Only a gesture moves a card,
              // through its own motion value.
              style={{ x: mv.x, rotate: mv.rotate, y: place.y, zIndex, ...layer, ...fade }}
              {...(hasCustomFocus(img.focus) ? { "data-focus": img.focus as string } : {})}
              data-framing={`deck:${img.id}`}
              data-framing-math="cover"
            >
              {/* decode() keeps the bitmap ready, so a rebuilt layer never waits on a decode. */}
              <R2Image
                src={img.path}
                alt={img.description || `${parkName} photo`}
                fill
                // The 4:5 card (78vw, at most 340px) is covered by the photo, so a photo of
                // aspect a is drawn max(1, 1.25a) card widths wide: exact when its size is
                // known; otherwise as for a wide photo (and it steps up after load if wider).
                sizes={deckSizes(img)}
                // The front card is eager so the pile is ready to swipe; the cards
                // beneath wait for layout (lazy), so none of them is discovered by
                // the preload scanner alongside the hero. All sit behind it in the queue.
                loading={isTop ? "eager" : "lazy"}
                fetchPriority="low"
                draggable={false}
                className="object-cover rounded-2xl pointer-events-none framing-photo"
                // A saved framing places the photo as the editor showed it (the card
                // carries data-focus; see the mount effect for already-loaded photos).
                onLoad={(e) => { const el = e.currentTarget; if (hasCustomFocus(img.focus)) placeCover(el, img.focus); if (el.decode) el.decode().catch(() => {}); }}
              />
              {/* Back cards are dimmed by an overlay; the front card lifts it as a CSS transition. */}
              <div className="absolute inset-0 rounded-2xl bg-black pointer-events-none" style={{ opacity: front ? 0 : 0.22, transition: ease }} />
              {/* The caption is on every card and fades with its turn at the front. */}
              <div
                className="absolute inset-x-0 bottom-0 px-3.5 pt-10 pb-3 rounded-b-2xl bg-gradient-to-t from-black/75 to-transparent flex items-end justify-between gap-3 pointer-events-none"
                style={{ opacity: front ? 1 : 0, transition: ease }}
              >
                <span className="text-[13px] text-white font-medium leading-snug line-clamp-2">{img.description || ""}</span>
                {!single && <span className="text-[11px] text-slate-200 tabular-nums flex-shrink-0">{imgIdx + 1} / {shown.length}</span>}
              </div>
            </motion.div>
          );
        })}
      </div>
      {!single && (swipes >= GALLERY_NUDGE_AFTER || nudgeTime ? (
        /* The hint becomes the invitation: it rises in, the chevron bobs a few
           times, then everything settles so it does not keep nagging. */
        <p className="mt-2 text-center deck-more">
          <a
            href="#gallery"
            onClick={goToGallery}
            className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-brand hover:text-brand-light transition-colors"
          >
            Explore the full gallery
            <svg className="w-4 h-4 deck-more-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </a>
        </p>
      ) : (
        <p className="mt-1 text-center text-[11px] text-slate-600">Swipe left for the next · drag right to bring one back · tap to open</p>
      ))}
    </section>
  );
}
