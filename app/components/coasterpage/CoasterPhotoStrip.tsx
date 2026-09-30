"use client";

import React from "react";
import { R2Image } from "../R2Image";
import type { CoasterGalleryImage } from "./coasterPageTypes";

interface Props {
  images: CoasterGalleryImage[];
  coasterName: string;
  onOpen: (url: string) => void;
  /** Admin mode shows every photo with a toggle for whether it belongs in the strip. */
  isAdminMode?: boolean;
  onToggleFeatured?: (img: CoasterGalleryImage, featured: boolean) => void;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

/**
 * A swipeable film strip of photos right under the hero, so the pictures come
 * before the reading. Which photos: the ones flagged "show at top" in gallery
 * order, or every photo when none are flagged. Hidden when there are fewer
 * than two to show (the hero already shows one). In admin mode every photo
 * is listed with its toggle, flagged ones bright and the rest dimmed.
 */
export default function CoasterPhotoStrip({ images, coasterName, onOpen, isAdminMode = false, onToggleFeatured }: Props) {
  const flagged = images.filter((g) => g.featured);
  const shown = isAdminMode ? images : flagged.length ? flagged : images;
  if (shown.length < 2 && !isAdminMode) return null;
  if (images.length === 0) return null;
  const count = flagged.length ? flagged.length : images.length;
  return (
    <section id="photos" className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-3 px-4 sm:px-0">
        <h2 className="text-lg sm:text-xl font-bold text-white">
          Photos <span className="text-slate-500 font-semibold">({count})</span>
          {isAdminMode && (
            <span className="ml-3 text-xs font-normal text-slate-500">
              {flagged.length ? "Starred photos show here; the rest are hidden for visitors." : "No photos starred: visitors see all of them. Star some to choose."}
            </span>
          )}
        </h2>
        <a href="#gallery" className="text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors">See all</a>
      </div>
      <div className="flex gap-2 sm:gap-3 overflow-x-auto snap-x snap-mandatory px-4 sm:px-0 pb-1" style={{ scrollbarWidth: "none" }}>
        {shown.map((img, i) => {
          const dim = isAdminMode && flagged.length > 0 && !img.featured;
          return (
            <div key={img.id} className={`relative flex-shrink-0 snap-start w-[62vw] max-w-[260px] sm:w-56 lg:w-64 aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 group ${dim ? "opacity-40" : ""}`}>
              <button
                type="button"
                onClick={() => onOpen(img.path)}
                className="absolute inset-0 w-full h-full cursor-zoom-in"
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
              {isAdminMode && onToggleFeatured && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleFeatured(img, !img.featured); }}
                  title={img.featured ? "Remove from the top strip" : "Show in the top strip"}
                  className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center border backdrop-blur-sm transition-colors cursor-pointer ${img.featured ? "bg-brand border-brand text-white" : "bg-black/50 border-white/20 text-white/80 hover:bg-black/70"}`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill={img.featured ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinejoin="round" d="M10 2.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.8l-4.8 2.6.9-5.4L2.2 8.2l5.4-.8z" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
