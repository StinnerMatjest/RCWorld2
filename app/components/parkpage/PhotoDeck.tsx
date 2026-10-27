"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

/**
 * Where a card lies in the pile: its own fixed offset and tilt, from its id,
 * so every card has a resting place that never changes. Nothing in the pile
 * moves when a card is thrown; the thrown card leaves and reappears at the
 * bottom in its own place.
 */
function restingPlace(id: number) {
  const f = (v: number) => v - Math.floor(v);
  const r1 = f(Math.sin(id * 12.9898) * 43758.5453);
  const r2 = f(Math.sin(id * 78.233) * 43758.5453);
  const r3 = f(Math.sin(id * 37.719) * 43758.5453);
  return { x: (r1 - 0.5) * 28, y: (r2 - 0.5) * 20 - 8, rotate: (r3 - 0.5) * 14 };
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

  // The top card's drag. The card keeps its own resting offset and tilt even
  // on top; a drag adds to them and the tilt follows the finger.
  const topImg = shown[pile[0]];
  const topPlace = topImg ? restingPlace(topImg.id) : { x: 0, y: 0, rotate: 0 };
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

  const throwCard = (dir: 1 | -1) => {
    if (busy || pile.length < 2) return;
    setBusy(true);
    const top = shown[pile[0]];
    animate(x, dir * (window.innerWidth + 120), { duration: 0.22, ease: [0.4, 0, 1, 1] }).then(() => {
      const nextTop = shown[pile[1]];
      const place = nextTop ? restingPlace(nextTop.id) : { x: 0, rotate: 0 };
      // The next card stays exactly where it lies; only the motion values move
      // to its place (jump: no inherited velocity from the throw).
      x.jump(place.x);
      rotate.jump(place.rotate);
      setGen((g) => ({ ...g, [top.id]: (g[top.id] ?? 0) + 1 }));
      setOrder((o) => [...o.slice(1), o[0]]);
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
      <div className="relative w-full" style={{ height: "min(106vw, 470px)" }}>
        {pile.slice(0, VISIBLE).map((imgIdx, slot) => {
          const img = shown[imgIdx];
          if (!img) return null;
          const isTop = slot === 0;
          const place = restingPlace(img.id);
          const rest = { x: place.x, y: place.y, rotate: place.rotate, scale: 0.97 };
          return (
            <motion.div
              key={`${img.id}-${gen[img.id] ?? 0}`}
              className="absolute left-1/2 top-3 w-[78vw] max-w-[340px] aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 shadow-[0_10px_24px_rgba(0,0,0,0.4)] touch-pan-y select-none will-change-transform"
              style={isTop ? { x, rotate, zIndex: VISIBLE - slot, marginLeft: "-39vw" } : { zIndex: VISIBLE - slot, marginLeft: "-39vw" }}
              // Every card sits still at its resting place, the front one included:
              // coming to the front it only brightens and grows a touch. A card
              // entering at the bottom fades in there.
              initial={isTop ? false : { ...rest, opacity: slot === VISIBLE - 1 ? 0 : 1 }}
              animate={isTop ? { y: place.y, scale: 1, opacity: 1 } : { ...rest, opacity: 1 }}
              transition={isTop ? SPRING : { ...SPRING, opacity: { duration: 0.35 } }}
              drag={isTop && !single ? "x" : false}
              dragElastic={1}
              dragMomentum={false}
              onDragStart={isTop ? () => { draggingRef.current = true; draggedRef.current = true; } : undefined}
              onDragEnd={isTop ? onDragEnd : undefined}
              onTap={isTop ? () => { if (!draggedRef.current) onOpen(img); } : undefined}
            >
              <R2Image
                src={img.path}
                alt={img.description || `${parkName} photo`}
                fill
                sizes="(min-width: 640px) 340px, 78vw"
                priority={slot < 2}
                loading={slot < 2 ? "eager" : "lazy"}
                draggable={false}
                className="object-cover pointer-events-none"
              />
              {/* Back cards are dimmed by an overlay (opacity animates on the compositor). */}
              <motion.div className="absolute inset-0 bg-black pointer-events-none" initial={false} animate={{ opacity: isTop ? 0 : 0.22 }} transition={{ duration: 0.3 }} />
              {isTop && (
                <div className="absolute inset-x-0 bottom-0 px-3.5 pt-10 pb-3 bg-gradient-to-t from-black/75 to-transparent flex items-end justify-between gap-3 pointer-events-none">
                  <span className="text-[13px] text-white font-medium leading-snug line-clamp-2">{img.description || ""}</span>
                  {!single && <span className="text-[11px] text-slate-200 tabular-nums flex-shrink-0">{imgIdx + 1} / {shown.length}</span>}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      {!single && <p className="mt-1 text-center text-[11px] text-slate-600">Swipe for the next · tap to open</p>}
    </section>
  );
}
