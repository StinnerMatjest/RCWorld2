"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, useMotionValue, useMotionValueEvent, animate, type PanInfo } from "framer-motion";
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
  // A thrown card gets a new generation, so it re-enters the pile as a fresh
  // element (fading in at the bottom) instead of flying back across the screen.
  const [gen, setGen] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [throws, setThrows] = useState(0);
  // Cards that just (re)entered the pile fade in rather than pop.
  const [entering, setEntering] = useState<number[]>([]);
  // Every fade in the pile is a CSS transition or keyframe, never a framer
  // opacity animation: on Android, opacity written from JavaScript each frame
  // blinked the whole card, while the browser's own transitions are clean
  // (bisected on the user's phone, 2026-10-27). framer only drives the drag
  // and the throw of the top card.

  // The top card's drag. The card keeps its own resting offset and tilt even
  // on top; a drag adds to them and the tilt follows the finger.
  const topImg = shown[pile[0]];
  const topPlace = topImg ? restingPlace(topImg.id, pile[0]) : { x: 0, y: 0, rotate: 0 };
  const topPlaceRef = useRef(topPlace);
  topPlaceRef.current = topPlace;
  const x = useMotionValue(topPlace.x);
  const rotate = useMotionValue(topPlace.rotate);
  const draggingRef = useRef(false);
  const draggedRef = useRef(false);
  useMotionValueEvent(x, "change", (v) => {
    if (!draggingRef.current) return;
    const p = topPlaceRef.current;
    rotate.set(p.rotate + Math.max(-14, Math.min(14, (v - p.x) / 220 * 14)));
  });

  // Warm the cards below the visible pile so a throw never shows an empty frame.
  useEffect(() => {
    for (const i of pile.slice(VISIBLE, VISIBLE + 2)) {
      const src = shown[i]?.path;
      if (src && isR2Image(src)) { const img = new Image(); img.src = variantKey(src, 1200); }
    }
  }, [pile, shown]);

  /**
   * A flick throws the top card off that side, the same way in both
   * directions, and the pile turns the other way: left shows the next photo,
   * right the previous one (from the bottom of the pile).
   */
  const throwCard = (dir: 1 | -1) => {
    if (busy || pile.length < 2) return;
    setBusy(true);
    const top = shown[pile[0]];
    animate(x, dir * (window.innerWidth + 120), { duration: 0.22, ease: [0.4, 0, 1, 1] }).then(() => {
      const nextIdx = dir < 0 ? pile[1] : pile[pile.length - 1];
      const next = shown[nextIdx];
      const place = next ? restingPlace(next.id, nextIdx) : { x: 0, rotate: 0 };
      // Who fades in: the thrown card (it re-enters the pile) and, flicking
      // left, the card that surfaces at the bottom; flicking right, the one
      // that comes to the top from the bottom. Cards merely shifting a slot don't.
      const surfacing = dir < 0 ? shown[pile[VISIBLE]] : next;
      const enter = [top.id, ...(surfacing ? [surfacing.id] : [])];
      // Swap the order synchronously first, so the thrown card is unbound from
      // the drag values before they move: otherwise it would show up at the
      // front for a frame. The card coming to the top stays where it lies.
      flushSync(() => {
        setGen((g) => ({ ...g, [top.id]: (g[top.id] ?? 0) + 1 }));
        setEntering(enter);
        setOrder((o) => (dir < 0 ? [...o.slice(1), o[0]] : [o[o.length - 1], ...o.slice(0, -1)]));
        setThrows((n) => Math.max(0, n + (dir < 0 ? 1 : -1)));
      });
      x.jump(place.x);
      rotate.jump(place.rotate);
      setBusy(false);
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    draggingRef.current = false;
    setTimeout(() => { draggedRef.current = false; }, 0);
    const { offset, velocity } = info;
    if (Math.abs(offset.x) > THROW_PX || Math.abs(velocity.x) > THROW_VELOCITY) throwCard(offset.x + velocity.x * 0.1 < 0 ? -1 : 1);
    else { const p = topPlaceRef.current; animate(x, p.x, SPRING); animate(rotate, p.rotate, SPRING); }
  };

  if (shown.length === 0) return null;
  const single = shown.length === 1;

  return (
    <section id="photo-deck" className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-bold text-white">
          Photos <span className="text-slate-500 font-semibold">({images.length})</span>
        </h2>
        <div className="flex items-baseline gap-4">
          {isAdminMode && onEdit && (
            <button type="button" onClick={onEdit} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">Edit</button>
          )}
          <a href="#gallery" className="text-[11px] font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">See all {images.length}</a>
        </div>
      </div>

      {/* The frame is the card plus the room the spread of the pile needs. */}
      <div className="relative w-full" style={{ height: "min(108vw, 480px)" }}>
        {/* Swipe hint: a chevron at the edge of the pile, until the first throw. */}
        {!single && throws === 0 && (
          <div className="deck-nudge absolute right-0 top-1/2 -translate-y-1/2 z-10 text-white/70 pointer-events-none" aria-hidden>
            <svg className="w-7 h-7 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </div>
        )}
        {pile.slice(0, VISIBLE).map((imgIdx, slot) => {
          const img = shown[imgIdx];
          if (!img) return null;
          const isTop = slot === 0;
          const place = restingPlace(img.id, imgIdx);
          // No scale: when a scale animation ends the browser re-rasterises the
          // layer at the new size, and that repaint of the photo is a black frame.
          const rest = { x: place.x, y: place.y, rotate: place.rotate };
          return (
            <motion.div
              key={`${img.id}-${gen[img.id] ?? 0}`}
              // No overflow clipping on the card: a rounded clip around an animated
              // layer makes Android rebuild its mask when an animation starts or
              // ends, which blinks the whole card. The image and overlays carry
              // the corners themselves, and translateZ keeps each card on its own
              // layer for good, so nothing is promoted or demoted mid-animation.
              // No background on the card either: a dark backing behind a rounded
              // image shows as a fringe along the anti-aliased edge of a rotated
              // card whenever the edge is re-rasterised, which reads as a blink.
              className={`absolute left-1/2 top-3 w-[78vw] max-w-[340px] aspect-[4/5] rounded-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)] touch-pan-y select-none ${entering.includes(img.id) ? "deck-enter" : ""}`}
              // willChange set by hand: framer would otherwise add it for the length
              // of each animation and remove it after, and that demotion rebuilds
              // the layer (another repaint of the photo).
              style={isTop
                ? { x, rotate, zIndex: VISIBLE - slot, marginLeft: "-39vw", willChange: "transform", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }
                : { zIndex: VISIBLE - slot, marginLeft: "-39vw", willChange: "transform", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              // Every card sits still at its resting place, the front one included:
              // coming to the front it only brightens (CSS). A card entering at the
              // bottom fades in there (CSS keyframe via .deck-enter). No framer
              // transition on the card itself: nothing it owns ever moves.
              initial={isTop ? false : rest}
              animate={isTop ? { y: place.y } : rest}
              transition={{ duration: 0 }}
              drag={isTop && !single ? "x" : false}
              dragElastic={1}
              dragMomentum={false}
              onDragStart={isTop ? () => { draggingRef.current = true; draggedRef.current = true; } : undefined}
              onDragEnd={isTop ? onDragEnd : undefined}
              onTap={isTop ? () => { if (!draggedRef.current) onOpen(img); } : undefined}
            >
              {/* decode() keeps the bitmap ready, so a rebuilt layer never waits on a decode. */}
              <R2Image
                src={img.path}
                alt={img.description || `${parkName} photo`}
                fill
                sizes="(min-width: 640px) 340px, 78vw"
                priority={slot < 2}
                loading="eager"
                draggable={false}
                className="object-cover rounded-2xl pointer-events-none"
                onLoad={(e) => { const el = e.currentTarget; if (el.decode) el.decode().catch(() => {}); }}
              />
              {/* Back cards are dimmed by an overlay (opacity animates on the compositor). */}
              <div className="absolute inset-0 rounded-2xl bg-black pointer-events-none" style={{ opacity: isTop ? 0 : 0.22, transition: "opacity 300ms ease" }} />
              {isTop && (
                <div className="deck-enter absolute inset-x-0 bottom-0 px-3.5 pt-10 pb-3 rounded-b-2xl bg-gradient-to-t from-black/75 to-transparent flex items-end justify-between gap-3 pointer-events-none">
                  <span className="text-[13px] text-white font-medium leading-snug line-clamp-2">{img.description || ""}</span>
                  {!single && <span className="text-[11px] text-slate-200 tabular-nums flex-shrink-0">{imgIdx + 1} / {shown.length}</span>}
                </div>
              )}
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
        <p className="mt-1 text-center text-[11px] text-slate-600">Swipe left or right · tap to open</p>
      ))}
    </section>
  );
}
