"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, motionValue, animate, type MotionValue } from "framer-motion";
import { R2Image } from "../R2Image";
import { isR2Image, variantKey } from "@/app/lib/imageVariants";
import type { VisitGalleryImage } from "./VisitGallery";

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

interface Props {
  images: VisitGalleryImage[];
  parkName: string;
  /** Tap on the top card. */
  onOpen: (image: VisitGalleryImage) => void;
  isAdminMode?: boolean;
  onEdit?: () => void;
}

/** How many cards of the pile are drawn. */
const VISIBLE = 4;
const THROW_PX = 90;
const THROW_VELOCITY = 500;
/** After this many flicks the hint under the pile points to the full gallery. */
const GALLERY_NUDGE_AFTER = 8;
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

export default function PhotoDeck({ images, parkName, onOpen, isAdminMode = false, onEdit }: Props) {
  const shown = useMemo(() => {
    const photos = images.filter((g) => !isVideo(g.path));
    const picked = photos.filter((g) => g.featured);
    return picked.length ? picked : photos;
  }, [images]);

  // The pile as indexes into `shown`; the first is on top. Indexes that no
  // longer exist (the gallery changed under us) are dropped on read.
  const [order, setOrder] = useState<number[]>(() => shown.map((_, i) => i));
  useEffect(() => { setOrder(shown.map((_, i) => i)); }, [shown]);
  const pile = order.filter((i) => i < shown.length);
  const [busy, setBusy] = useState(false);
  const [throws, setThrows] = useState(0);
  // True while a thrown card is flying off: the card beneath already behaves
  // as the front card (bright, captioned), so the order swap afterwards
  // changes nothing on screen, however late the browser gets to it.
  const [leaving, setLeaving] = useState(false);
  const single = shown.length === 1;
  // Every fade in the pile is a CSS transition or keyframe, never a framer
  // opacity animation: on Android, opacity written from JavaScript each frame
  // blinked the whole card, while the browser's own transitions are clean
  // (bisected on the user's phone, 2026-10-27). framer only drives the drag
  // and the throw of the top card.

  // The gesture is the deck's own. A finger moving left drags the top card
  // out; a finger moving right drags the previous card (the bottom of the
  // pile) back in from the left, the way it went. Release decides: past the
  // threshold the move completes, otherwise it eases back.
  const topImg = shown[pile[0]];
  // Every card owns its x and tilt for good. The gesture drives the top
  // card's or the previous card's own values, so when the pile rotates no
  // card changes hands: the swap is a z-index, nothing else.
  const mvs = useRef(new Map<number, { x: MotionValue<number>; rotate: MotionValue<number> }>());
  const mvFor = (id: number, idx: number) => {
    let mv = mvs.current.get(id);
    if (!mv) { const pl = restingPlace(id, idx); mv = { x: motionValue(pl.x), rotate: motionValue(pl.rotate) }; mvs.current.set(id, mv); }
    return mv;
  };
  // The previous card while a finger drags it back in: lifted above the pile.
  const [raisedIdx, setRaisedIdx] = useState<number | null>(null);
  const pileRef = useRef(pile);
  pileRef.current = pile;

  // Warm the cards just below the mounted pile.
  useEffect(() => {
    for (const i of pile.slice(VISIBLE + 1, VISIBLE + 3)) {
      const src = shown[i]?.path;
      if (src && isR2Image(src)) { const img = new Image(); img.src = variantKey(src, 1200); }
    }
  }, [pile, shown]);
  const g = useRef({ active: false, dir: 0 as 0 | -1 | 1, startX: 0, startY: 0, lastX: 0, lastT: 0, vx: 0, moved: false });

  const finishLeft = () => {
    const pileNow = pileRef.current;
    const topIdx = pileNow[0];
    const mv = mvFor(shown[topIdx].id, topIdx);
    animate(mv.x, -(window.innerWidth + 120), { duration: 0.22, ease: [0.4, 0, 1, 1] }).then(() => {
      // The thrown card goes to the bottom of the order (hidden at the back),
      // and only then is put back in its own place, unseen.
      flushSync(() => {
        setLeaving(false);
        setOrder((o) => [...o.slice(1), o[0]]);
        setThrows((n) => n + 1);
      });
      mv.x.jump(restingPlace(shown[topIdx].id, topIdx).x);
      setBusy(false);
    });
  };

  const finishRight = (prevIdx: number) => {
    const mv = mvFor(shown[prevIdx].id, prevIdx);
    // The returning card settles into its own place; then it simply is the top card.
    animate(mv.x, restingPlace(shown[prevIdx].id, prevIdx).x, SPRING).then(() => {
      flushSync(() => {
        setRaisedIdx(null);
        setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
        setThrows((n) => Math.max(0, n - 1));
      });
      setBusy(false);
    });
  };

  const dropRaised = (prevIdx: number) => {
    const mv = mvFor(shown[prevIdx].id, prevIdx);
    animate(mv.x, -(window.innerWidth + 120), SPRING).then(() => {
      flushSync(() => setRaisedIdx(null));
      mv.x.jump(restingPlace(shown[prevIdx].id, prevIdx).x);
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy || single) return;
    const st = g.current;
    st.active = true; st.dir = 0; st.moved = false; st.startX = e.clientX; st.startY = e.clientY; st.lastX = e.clientX; st.lastT = performance.now(); st.vx = 0;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current;
    if (!st.active) return;
    const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
    const pileNow = pileRef.current;
    const topIdx = pileNow[0], prevIdx = pileNow[pileNow.length - 1];
    if (!st.dir) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { st.active = false; return; } // a scroll: leave it to the page
      st.dir = dx < 0 ? -1 : 1;
      st.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (st.dir > 0) {
        const pp = restingPlace(shown[prevIdx].id, prevIdx);
        mvFor(shown[prevIdx].id, prevIdx).x.jump(-window.innerWidth + pp.x);
        setRaisedIdx(prevIdx);
      }
    }
    const now = performance.now();
    const dt = now - st.lastT;
    if (dt > 0) st.vx = 0.7 * st.vx + 0.3 * ((e.clientX - st.lastX) / dt) * 1000;
    st.lastX = e.clientX; st.lastT = now;
    if (st.dir < 0) {
      // The card only slides with the finger; it keeps its own lean throughout.
      mvFor(shown[topIdx].id, topIdx).x.set(restingPlace(shown[topIdx].id, topIdx).x + dx);
    } else {
      mvFor(shown[prevIdx].id, prevIdx).x.set(-window.innerWidth + restingPlace(shown[prevIdx].id, prevIdx).x + Math.max(0, dx));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const st = g.current;
    if (!st.active) return;
    st.active = false;
    const dx = e.clientX - st.startX;
    if (!st.moved) { if (topImg) onOpen(topImg); return; }
    const pileNow = pileRef.current;
    const topIdx = pileNow[0], prevIdx = pileNow[pileNow.length - 1];
    const flung = Math.abs(dx) > THROW_PX || Math.abs(st.vx) > THROW_VELOCITY;
    if (st.dir < 0) {
      if (flung && dx < 0) { setBusy(true); setLeaving(true); finishLeft(); }
      else { animate(mvFor(shown[topIdx].id, topIdx).x, restingPlace(shown[topIdx].id, topIdx).x, SPRING); }
    } else {
      if (flung && dx > 0) { setBusy(true); finishRight(prevIdx); }
      else dropRaised(prevIdx);
    }
  };
  const onPointerCancel = () => {
    const st = g.current;
    if (!st.active) return;
    st.active = false;
    const pileNow = pileRef.current;
    const topIdx = pileNow[0], prevIdx = pileNow[pileNow.length - 1];
    animate(mvFor(shown[topIdx].id, topIdx).x, restingPlace(shown[topIdx].id, topIdx).x, SPRING);
    if (raisedIdx !== null) dropRaised(prevIdx);
  };

  if (shown.length === 0) return null;

  return (
    <section id="photo-deck" className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-bold text-white">
          Photos <span className="text-slate-500 font-semibold">({shown.length})</span>
        </h2>
        <div className="flex items-baseline gap-4">
          {isAdminMode && onEdit && (
            <button type="button" onClick={onEdit} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">Edit</button>
          )}
          <a href="#gallery" className="text-[11px] font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">See all {images.length}</a>
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
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 text-white/70 pointer-events-none" style={{ opacity: throws === 0 ? 1 : 0, transition: "opacity 300ms ease" }} aria-hidden>
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
        {[...pile.slice(0, VISIBLE + 1), ...(pile.length > VISIBLE + 1 ? [pile[pile.length - 1]] : [])]
          .map((imgIdx, slot) => ({ imgIdx, slot }))
          // DOM order is fixed (by photo), stacking is z-index only: if the DOM
          // order followed the pile, React would move card nodes when the pile
          // rotates, and a moved node drops its running CSS transitions.
          .sort((p, q) => p.imgIdx - q.imgIdx)
          .map(({ imgIdx, slot }) => {
          const img = shown[imgIdx];
          if (!img) return null;
          const isTop = slot === 0;
          const isPrev = slot === VISIBLE + 1;
          const raised = raisedIdx === imgIdx;
          const mv = mvFor(img.id, imgIdx);
          // The card that reads as the front one: the top card, or, while the
          // top card is flying off, the one beneath it.
          const front = isTop || (leaving && slot === 1);
          const place = restingPlace(img.id, imgIdx);
          const layer = { marginLeft: "-39vw", willChange: "transform", backfaceVisibility: "hidden" as const, WebkitBackfaceVisibility: "hidden" as const };
          const fade = isTop || raised
            ? { opacity: 1 }
            : isPrev
              ? { opacity: 0, visibility: "hidden" as const }
              : { opacity: slot < VISIBLE ? 1 : 0, transition: "opacity 300ms ease" };
          const zIndex = raised ? VISIBLE + 2 : isTop ? VISIBLE + 1 : Math.max(0, VISIBLE - slot);
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
            >
              {/* decode() keeps the bitmap ready, so a rebuilt layer never waits on a decode. */}
              <R2Image
                src={img.path}
                alt={img.description || `${parkName} photo`}
                fill
                // 4:5 card, mostly landscape photos scaled by height: ask for
                // 2.2x the card width so no variant is ever enlarged.
                sizes="(min-width: 640px) 760px, 174vw"
                loading="eager"
                draggable={false}
                className="object-cover rounded-2xl pointer-events-none"
                onLoad={(e) => { const el = e.currentTarget; if (el.decode) el.decode().catch(() => {}); }}
              />
              {/* Back cards are dimmed by an overlay; the front card lifts it as a CSS transition. */}
              <div className="absolute inset-0 rounded-2xl bg-black pointer-events-none" style={{ opacity: front || raised ? 0 : 0.22, transition: "opacity 300ms ease" }} />
              {/* The caption is on every card and fades with its turn at the front. */}
              <div
                className="absolute inset-x-0 bottom-0 px-3.5 pt-10 pb-3 rounded-b-2xl bg-gradient-to-t from-black/75 to-transparent flex items-end justify-between gap-3 pointer-events-none"
                style={{ opacity: front ? 1 : 0, transition: "opacity 300ms ease" }}
              >
                <span className="text-[13px] text-white font-medium leading-snug line-clamp-2">{img.description || ""}</span>
                {!single && <span className="text-[11px] text-slate-200 tabular-nums flex-shrink-0">{imgIdx + 1} / {shown.length}</span>}
              </div>
            </motion.div>
          );
        })}
      </div>
      {!single && (throws >= GALLERY_NUDGE_AFTER ? (
        <p className="mt-2 text-center">
          <a href="#gallery" className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-brand hover:text-brand-light transition-colors">
            Looking for more? Browse all {images.length} photos
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </a>
        </p>
      ) : (
        <p className="mt-1 text-center text-[11px] text-slate-600">Swipe left for the next · drag right to bring one back · tap to open</p>
      ))}
    </section>
  );
}
