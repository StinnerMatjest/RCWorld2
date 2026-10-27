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

// The slots behind the top card, as the mocks drew them.
const SLOTS = [
  { x: 0, y: 0, rotate: 0, scale: 1, brightness: 1, z: 3 },
  { x: -22, y: -14, rotate: -6, scale: 0.96, brightness: 0.85, z: 2 },
  { x: 26, y: -26, rotate: 7, scale: 0.92, brightness: 0.7, z: 1 },
];
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
  const [thrown, setThrown] = useState<number | null>(null); // index that just went to the back: no slide-in
  const [busy, setBusy] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-12, 0, 12]);
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
    const top = order[0];
    animate(x, dir * (window.innerWidth + 120), { duration: 0.26, ease: [0.4, 0, 1, 1] }).then(() => {
      setThrown(top);
      setOrder((o) => [...o.slice(1), o[0]]);
      x.set(0);
      setBusy(false);
      setTimeout(() => setThrown(null), 50);
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => { draggedRef.current = false; }, 0);
    const { offset, velocity } = info;
    if (Math.abs(offset.x) > THROW_PX || Math.abs(velocity.x) > THROW_VELOCITY) throwCard(offset.x + velocity.x * 0.1 < 0 ? -1 : 1);
    else animate(x, 0, { type: "spring", stiffness: 500, damping: 36 });
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
          const isTop = slot === 0;
          const justThrown = thrown === imgIdx;
          return (
            <motion.div
              key={img.id}
              className="absolute left-1/2 top-2 w-[78vw] max-w-[340px] aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 shadow-[0_18px_40px_rgba(0,0,0,0.45)] touch-pan-y select-none"
              style={isTop ? { x, rotate, zIndex: s.z, marginLeft: "-39vw", filter: `brightness(${s.brightness})` } : { zIndex: s.z, marginLeft: "-39vw" }}
              initial={false}
              animate={isTop ? { scale: 1 } : { x: s.x, y: s.y, rotate: s.rotate, scale: s.scale, filter: `brightness(${s.brightness})` }}
              transition={justThrown ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
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
