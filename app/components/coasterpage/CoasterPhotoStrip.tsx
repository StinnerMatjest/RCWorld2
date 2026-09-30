"use client";

import React from "react";
import { R2Image } from "../R2Image";
import type { CoasterGalleryImage } from "./coasterPageTypes";

interface Props {
  images: CoasterGalleryImage[];
  coasterName: string;
  onOpen: (url: string) => void;
  isAdminMode?: boolean;
  /** Opens the editor that picks which photos make the strip. */
  onEdit?: () => void;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

/**
 * A swipeable film strip of photos right under the hero, so the pictures come
 * before the reading. Which photos: the ones picked in the strip editor, in
 * gallery order, or every photo when none are picked. Hidden when there are
 * fewer than two to show (the hero already shows one). Admins see exactly what
 * visitors see, plus an Edit link.
 */
export default function CoasterPhotoStrip({ images, coasterName, onOpen, isAdminMode = false, onEdit }: Props) {
  const picked = images.filter((g) => g.featured);
  const shown = picked.length ? picked : images;
  if (shown.length < 2 && !isAdminMode) return null;
  if (images.length === 0) return null;
  return (
    <section id="photos" className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-3 px-4 sm:px-0">
        <h2 className="text-lg sm:text-xl font-bold text-white">
          Photos <span className="text-slate-500 font-semibold">({shown.length})</span>
        </h2>
        <div className="flex items-baseline gap-4">
          {isAdminMode && onEdit && (
            <button type="button" onClick={onEdit} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">
              Edit
            </button>
          )}
          <a href="#gallery" className="text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">See all</a>
        </div>
      </div>
      <div className="flex gap-2 sm:gap-3 overflow-x-auto snap-x snap-mandatory px-4 sm:px-0 pb-1" style={{ scrollbarWidth: "none" }}>
        {shown.map((img, i) => (
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
