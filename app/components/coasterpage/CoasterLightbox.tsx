"use client";

import React, { useCallback, useEffect } from "react";

interface Props {
  /** Every photo on the page in strip order; arrows move through it. */
  urls: string[];
  index: number;
  captions?: Record<string, string>;
  onClose: () => void;
  onIndex: (i: number) => void;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

/** Full-screen viewer shared by the hero, the photo strip and the review images. */
export default function CoasterLightbox({ urls, index, captions = {}, onClose, onIndex }: Props) {
  const url = urls[index];
  const prev = useCallback(() => onIndex((index - 1 + urls.length) % urls.length), [index, urls.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % urls.length), [index, urls.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose, prev, next]);

  if (!url) return null;
  const caption = captions[url];
  const multi = urls.length > 1;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} aria-label="Close"
        className="absolute top-3 right-3 z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-colors cursor-pointer">
        ✕
      </button>
      {multi && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}
      <figure className="max-w-full max-h-full p-2 sm:p-6 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {isVideo(url) ? (
          <video src={url} controls autoPlay className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={caption || ""} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain select-none" draggable={false} />
        )}
        {(caption || multi) && (
          <figcaption className="text-center text-sm text-slate-300 px-4">
            {caption}
            {multi && <span className="block text-xs text-slate-500 mt-0.5">{index + 1} / {urls.length}</span>}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
