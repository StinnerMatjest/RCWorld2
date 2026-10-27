"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import { isR2Image, variantKey, VARIANT_WIDTHS } from "@/app/lib/imageVariants";
import type { VisitGalleryImage } from "./VisitGallery";

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);
/** Slides this far from the current one carry their media; the rest are empty until you get near. */
const REACH = 2;

interface Props {
  images: VisitGalleryImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  parkName: string;
  isAdminMode?: boolean;
  /** Admin edits (caption, delete) changed the gallery; the page reloads it. */
  onImagesChanged?: () => void;
}

/**
 * Full-screen photo viewer. A horizontal track of slides that the browser
 * snaps between, so a swipe is the browser's own scroll: no gesture code, no
 * jump. Each photo is served at the stored size that matches the screen.
 */
export default function PhotoViewer({ images, index, onIndex, onClose, parkName, isAdminMode = false, onImagesChanged }: Props) {
  useScrollLock();
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  // Set when the index change came from the track itself, so the effect that
  // follows an index change never scrolls the track against the user's finger.
  const fromScrollRef = useRef(false);
  // Slides that have been near the current one keep their media, so going back is instant.
  const [warm, setWarm] = useState<Set<number>>(() => new Set());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const current = images[index];

  // Open on the right slide before the first paint.
  useLayoutEffect(() => {
    const t = trackRef.current;
    if (t) t.scrollLeft = index * t.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the index in step with where the track has settled. Read it once the
  // scrolling stops (scrollend where the browser has it, a short quiet period
  // otherwise), never mid-gesture.
  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    let timer = 0;
    const settle = (align: boolean) => {
      const w = t.clientWidth;
      const i = Math.max(0, Math.min(images.length - 1, Math.round(t.scrollLeft / w)));
      if (i !== indexRef.current) { fromScrollRef.current = true; onIndex(i); }
      // The gesture is over: if the browser left the track between slides, finish the snap.
      if (align && Math.abs(t.scrollLeft - i * w) > 1) t.scrollTo({ left: i * w, behavior: "smooth" });
    };
    // While a finger may still be down, only the index follows (a held finger
    // sends no scroll events, and aligning then would yank the track).
    const onScroll = () => { window.clearTimeout(timer); timer = window.setTimeout(() => settle(false), 150); };
    const onScrollEnd = () => { window.clearTimeout(timer); settle(true); };
    // A finger lifted past a fifth of the width commits to the next photo, so
    // a short, slow swipe does not snap back the way the browser's own rule
    // (past half) would.
    const onTouchEnd = () => {
      const w = t.clientWidth;
      const off = t.scrollLeft - indexRef.current * w;
      if (Math.abs(off) > w * 0.2) {
        const to = Math.max(0, Math.min(images.length - 1, indexRef.current + Math.sign(off)));
        t.scrollTo({ left: to * w, behavior: "smooth" });
      }
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    t.addEventListener("scrollend", onScrollEnd);
    t.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => { t.removeEventListener("scroll", onScroll); t.removeEventListener("scrollend", onScrollEnd); t.removeEventListener("touchend", onTouchEnd); window.clearTimeout(timer); };
  }, [images.length, onIndex]);

  // Arrow keys and buttons change the index; bring the track along.
  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    if (fromScrollRef.current) fromScrollRef.current = false;
    else {
      const at = Math.round(t.scrollLeft / t.clientWidth);
      if (at !== index) t.scrollTo({ left: index * t.clientWidth, behavior: "smooth" });
    }
    setWarm((w) => {
      let changed = false;
      const n = new Set(w);
      for (let i = index - REACH; i <= index + REACH; i++) if (i >= 0 && i < images.length && !n.has(i)) { n.add(i); changed = true; }
      return changed ? n : w;
    });
    setEditing(false);
  }, [index, images.length]);

  const prev = useCallback(() => { if (index > 0) onIndex(index - 1); }, [index, onIndex]);
  const next = useCallback(() => { if (index < images.length - 1) onIndex(index + 1); }, [index, images.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  // A resize (phone rotation) would leave the track between slides.
  useEffect(() => {
    const onResize = () => { const t = trackRef.current; if (t) t.scrollLeft = indexRef.current * t.clientWidth; };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const saveCaption = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/visit-gallery/${current.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: draft, title: `${parkName} - ${draft || "untitled"}` }),
      });
      if (!res.ok) throw new Error("save failed");
      setEditing(false);
      onImagesChanged?.();
    } catch { alert("Failed to save the caption."); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!current || busy || !window.confirm("Permanently delete this photo?")) return;
    setBusy(true);
    try {
      const r2 = await fetch("/api/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: current.path }) });
      if (!r2.ok) console.error("R2 delete failed; removing the row anyway.");
      const db = await fetch(`/api/image/${current.id}`, { method: "DELETE" });
      if (!db.ok) throw new Error("db delete failed");
      onImagesChanged?.();
      if (images.length <= 1) onClose(); else if (index === images.length - 1) onIndex(index - 1);
    } catch { alert("Failed to delete the photo."); } finally { setBusy(false); }
  };

  if (!current) return null;
  const multi = images.length > 1;

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white select-none" role="dialog" aria-modal="true">
      {/* The track: one slide per photo, the browser snaps between them. */}
      <div
        ref={trackRef}
        className="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {images.map((img, i) => {
          const live = warm.has(i) || Math.abs(i - index) <= REACH;
          return (
            <div key={img.id} className="relative w-full h-full flex-shrink-0 snap-center snap-always flex items-center justify-center px-2 pt-14 pb-24 sm:px-16" onClick={onClose}>
              {live && (isVideo(img.path) ? (
                <video src={img.path} controls playsInline preload={i === index ? "auto" : "metadata"} className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={isR2Image(img.path) ? variantKey(img.path, 1200) : img.path}
                  srcSet={isR2Image(img.path) ? [...VARIANT_WIDTHS.map((w) => `${variantKey(img.path, w)} ${w}w`), `${img.path} 4000w`].join(", ") : undefined}
                  sizes="100vw"
                  alt={img.description || ""}
                  decoding="async"
                  loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                  draggable={false}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 h-14 px-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <span className="text-xs text-white/70 tabular-nums pl-1">{multi ? `${index + 1} / ${images.length}` : ""}</span>
        <div className="flex items-center gap-2 pointer-events-auto">
          {isAdminMode && (
            <button type="button" onClick={remove} disabled={busy} title="Delete photo"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-red-600/80 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
          <a href={`/api/download?url=${encodeURIComponent(current.path)}`} download title="Download original"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
          </a>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      {/* Desktop arrows */}
      {multi && index > 0 && (
        <button type="button" onClick={prev} aria-label="Previous"
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      {multi && index < images.length - 1 && (
        <button type="button" onClick={next} aria-label="Next"
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Caption */}
      <div className="absolute bottom-0 inset-x-0 px-5 pt-8 pb-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus placeholder="Caption"
                className="w-full p-2.5 rounded-lg bg-black/60 text-white border border-white/20 focus:outline-none focus:border-brand text-sm resize-none" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm font-bold text-white/70 hover:text-white cursor-pointer">Cancel</button>
                <button type="button" onClick={saveCaption} disabled={busy} className="px-4 py-1.5 text-sm font-bold bg-brand hover:bg-brand-light rounded-md cursor-pointer disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm sm:text-base text-white/90 leading-snug min-h-[1.25rem] flex items-center justify-center gap-2">
              <span>{current.description || (isAdminMode ? <span className="text-white/40 italic">No caption</span> : "")}</span>
              {isAdminMode && (
                <button type="button" onClick={() => { setDraft(current.description || ""); setEditing(true); }} title="Edit caption"
                  className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
