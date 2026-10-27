"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
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

// The slots behind the top card, as the mocks drew them. Only transforms and
// an overlay's opacity are animated: both run on the compositor, so a phone
// never repaints the photo mid-gesture.
const SLOTS = [
  { x: 0, y: 0, rotate: 0, scale: 1, dim: 0, z: 3 },
  { x: -22, y: -14, rotate: -6, scale: 0.96, dim: 0.15, z: 2 },
  { x: 26, y: -26, rotate: 7, scale: 0.92, dim: 0.3, z: 1 },
  // Where a card enters from when it first appears at the back.
  { x: 0, y: -34, rotate: 0, scale: 0.88, dim: 0.45, z: 0 },
];
const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;
const THROW_PX = 90;
const THROW_VELOCITY = 500;

/**
 * The phone's photo section: a deck of cards. Flick the top one and it flies
 * off and goes to the back; tap it and it opens full size. Shows the photos
 * flagged for the top of the page, or every photo when none are flagged.
 */
export default function PhotoDeck({ images, parkName, onOpen, isAdminMode = false, onEdit }: Props) {
  const shown = useMemo(() => {
    const photos = images.filter((g) => !isVideo(g.path));
    const picked = photos.filter((g) => g.featured);
    return picked.length ? picked : photos;
  }, [images]);

  // Order of the deck as indexes into `shown`; the first is on top.
  const [order, setOrder] = useState<number[]>(() => shown.map((_, i) => i));
  useEffect(() => { setOrder(shown.map((_, i) => i)); }, [shown]);
  const [busy, setBusy] = useState(false);

  const x = useMotionValue(0);
  // Tilt follows the drag. The two inner stops match the back slots, so a card
  // springing from slot 1 (x -22) starts at exactly slot 1's tilt (-6°).
  const rotate = useTransform(x, [-220, SLOTS[1].x, 0, SLOTS[2].x, 220], [-14, SLOTS[1].rotate, 0, SLOTS[2].rotate, 14]);
  // A flick ends with a pointerup over the card, which framer also reports as a
  // tap. Remember that a drag happened so the viewer only opens on a real tap.
  const draggedRef = useRef(false);

  // Warm the next cards so a flick never shows an empty frame.
  useEffect(() => {
    for (const i of order.slice(3, 5)) {
      const src = shown[i]?.path;
      if (src && isR2Image(src)) { const img = new Image(); img.src = variantKey(src, 1200); }
    }
  }, [order, shown]);

  const throwCard = (dir: 1 | -1) => {
    if (busy) return;
    setBusy(true);
    animate(x, dir * (window.innerWidth + 120), { duration: 0.24, ease: [0.4, 0, 1, 1] }).then(() => {
      // Each card is keyed by its slot, so the reorder mounts the next card at
      // the front with `initial` = slot 1 and springs it to centre; the thrown
      // card simply leaves the DOM. Reset x for the new front card first.
      // jump(), not set(): set() would record the leap from the far edge as
      // velocity and the spring would fling the next card right off the screen.
      x.jump(SLOTS[1].x);
      setOrder((o) => [...o.slice(1), o[0]]);
      animate(x, 0, SPRING);
      setBusy(false);
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => { draggedRef.current = false; }, 0);
    const { offset, velocity } = info;
    if (Math.abs(offset.x) > THROW_PX || Math.abs(velocity.x) > THROW_VELOCITY) throwCard(offset.x + velocity.x * 0.1 < 0 ? -1 : 1);
    else animate(x, 0, SPRING);
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

      {/* The frame is the card plus the room the back cards and the tilt need. */}
      <div className="relative w-full" style={{ height: "min(104vw, 460px)" }}>
        {order.slice(0, 3).map((imgIdx, slot) => {
          const img = shown[imgIdx];
          const s = SLOTS[slot];
          const from = SLOTS[slot + 1];
          const isTop = slot === 0;
          return (
            <motion.div
              key={`${img.id}-${slot}`}
              className="absolute left-1/2 top-2 w-[78vw] max-w-[340px] aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 shadow-[0_10px_24px_rgba(0,0,0,0.4)] touch-pan-y select-none will-change-transform"
              style={isTop ? { x, rotate, zIndex: s.z, marginLeft: "-39vw" } : { zIndex: s.z, marginLeft: "-39vw" }}
              initial={isTop ? { y: from.y, scale: from.scale } : { x: from.x, y: from.y, rotate: from.rotate, scale: from.scale }}
              animate={isTop ? { y: 0, scale: 1 } : { x: s.x, y: s.y, rotate: s.rotate, scale: s.scale }}
              transition={SPRING}
              drag={isTop && !single ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              dragMomentum={false}
              onDragStart={isTop ? () => { draggedRef.current = true; } : undefined}
              onDragEnd={isTop ? onDragEnd : undefined}
              onTap={isTop ? () => { if (!draggedRef.current) onOpen(img); } : undefined}
            >
              <R2Image
                src={img.path}
                alt={img.description || `${parkName} photo`}
                fill
                sizes="(min-width: 640px) 340px, 78vw"
                priority={slot < 2}
                draggable={false}
                className="object-cover pointer-events-none"
              />
              {/* Dimming for the back cards: an overlay's opacity, not a filter on the photo. */}
              <motion.div className="absolute inset-0 bg-black pointer-events-none" initial={{ opacity: from.dim }} animate={{ opacity: s.dim }} transition={{ duration: 0.25 }} />
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
