"use client";

import React from "react";
import { R2Image } from "../R2Image";
import type { CoasterGalleryImage } from "./coasterPageTypes";

interface Props {
  images: CoasterGalleryImage[];
  coasterName: string;
  onOpen: (url: string) => void;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

/**
 * A swipeable film strip of every photo, right under the hero, so the pictures
 * come before the reading. Tiles are portrait because most coaster shots are;
 * the strip scrolls sideways on a phone and snaps tile by tile. Hidden when the
 * coaster has fewer than two images (the hero already shows the one).
 */
export default function CoasterPhotoStrip({ images, coasterName, onOpen }: Props) {
  if (images.length < 2) return null;
  return (
    <section id="photos" className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-3 px-4 sm:px-0">
        <h2 className="text-lg sm:text-xl font-bold text-white">Photos <span className="text-slate-500 font-semibold">({images.length})</span></h2>
        <a href="#gallery" className="text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">See all</a>
      </div>
      <div className="flex gap-2 sm:gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none px-4 sm:px-0 pb-1 -mx-0" style={{ scrollbarWidth: "none" }}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => onOpen(img.path)}
            className="relative flex-shrink-0 snap-start w-[62vw] max-w-[260px] sm:w-56 lg:w-64 aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 group cursor-zoom-in"
            title={img.description || img.title}
          >
            {isVideo(img.path) ? (
              <video src={img.path} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <R2Image
                src={img.path}
                alt={img.description || `${coasterName} photo ${i + 1}`}
                fill
                sizes="(min-width: 1024px) 256px, (min-width: 640px) 224px, 62vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            )}
            {img.description && (
              <span className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/75 to-transparent text-left text-[11px] sm:text-xs text-white/90 leading-snug line-clamp-2">
                {img.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
