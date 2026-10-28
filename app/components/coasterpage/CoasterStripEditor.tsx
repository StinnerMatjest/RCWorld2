"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import { variantUrl } from "@/app/lib/imageVariants";
import { DEFAULT_FOCUS, hasCustomFocus } from "@/app/lib/coverPlacement";
import type { CropEditorProps } from "@/app/components/parkpage/ParkHeaderModal";
import type { CoasterGalleryImage } from "./coasterPageTypes";

// The hero's crop editor, loaded only when a framing is opened.
const CropEditor = dynamic<CropEditorProps>(() => import("@/app/components/parkpage/ParkHeaderModal").then((m) => m.CropEditor), { ssr: false });

interface Props {
  coasterId: number;
  coasterName: string;
  gallery: CoasterGalleryImage[];
  onClose: () => void;
  onSaved: () => void;
  /** Gallery API that takes PATCH {featuredIds} and PUT {reorderedIds}. Defaults to the coaster's. */
  endpoint?: string;
  /** Lets each picked photo be framed for its 4:5 card (the API must take PATCH {focus}). */
  focusEditing?: boolean;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

/** Picks and orders the photos that open a page (coaster strip, park deck and strip). */
export default function CoasterStripEditor({ coasterId, coasterName, gallery, onClose, onSaved, endpoint, focusEditing = false }: Props) {
  useScrollLock();
  const api = endpoint ?? `/api/coasters/${coasterId}/gallery`;

  const initialImages = gallery.filter((g) => !isVideo(g.path));
  const [localImages, setLocalImages] = useState<CoasterGalleryImage[]>(initialImages);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(initialImages.filter((g) => g.featured).map((g) => g.id)));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Framing per photo ("cx cy zoom"); only the changed ones are sent.
  const [focusMap, setFocusMap] = useState<Record<number, string | null>>(() => Object.fromEntries(initialImages.map((g) => [g.id, g.focus ?? null])));
  const [focusEdit, setFocusEdit] = useState<CoasterGalleryImage | null>(null);
  const [focusDraft, setFocusDraft] = useState<string>(DEFAULT_FOCUS);
  const focusEditRef = useRef<CoasterGalleryImage | null>(null);
  focusEditRef.current = focusEdit;
  const openFocus = (img: CoasterGalleryImage) => { setFocusDraft(focusMap[img.id] || DEFAULT_FOCUS); setFocusEdit(img); };
  const doneFocus = () => { if (focusEdit) setFocusMap((m) => ({ ...m, [focusEdit.id]: hasCustomFocus(focusDraft) ? focusDraft : null })); setFocusEdit(null); };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const wasDragged = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (focusEditRef.current) setFocusEdit(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: number) => {
    if (wasDragged.current) return;
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (saving) return;
    wasDragged.current = true;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex === null || draggedIndex === index || saving) return;
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => { wasDragged.current = false; }, 100);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const newImages = [...localImages];
    const [movedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, movedImage);

    setLocalImages(newImages);
    handleDragEnd();
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const focus: Record<number, string | null> = {};
      if (focusEditing) {
        for (const img of initialImages) {
          const was = img.focus ?? null, now = focusMap[img.id] ?? null;
          if (was !== now) focus[img.id] = now;
        }
      }
      const patchReq = fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuredIds: [...picked], ...(Object.keys(focus).length ? { focus } : {}) }),
      });

      const videoIds = gallery.filter((g) => isVideo(g.path)).map(v => v.id);
      const reorderedIds = [...localImages.map(img => img.id), ...videoIds];

      const putReq = fetch(api, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorderedIds }),
      });

      const [patchRes, putRes] = await Promise.all([patchReq, putReq]);

      if (!patchRes.ok || !putRes.ok) {
        throw new Error("Failed to save changes. Your session may have expired.");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const count = picked.size;
  const isDraggingAnything = draggedIndex !== null;

  return (
    // Removed backdrop-blur-sm, increased opacity to bg-black/95 for performance
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/95 pt-3 md:pt-0 md:p-4" onClick={onClose}>
      <div className="relative bg-slate-900 rounded-2xl w-full max-w-5xl h-[97dvh] md:h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-800 flex-shrink-0">
          <div className="min-w-0 flex items-baseline gap-2">
            <h2 className="font-bold text-white text-base truncate">Photos at the top</h2>
            <span className="hidden sm:inline text-sm text-slate-500 truncate">{coasterName}</span>
          </div>
          {error && <span className="hidden md:inline text-sm text-red-400 truncate">{error}</span>}
          <button onClick={onClose} aria-label="Close"
            className="ml-auto p-2 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        {error && <div className="md:hidden px-4 py-1.5 text-xs text-red-400 border-b border-slate-800">{error}</div>}

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <p className="text-sm text-slate-400 mb-6">
            Tap to select which photos open the page. <strong className="text-white">Click and drag (or long-press on mobile) to rearrange their order.</strong> With nothing picked, visitors see all of them.
            {focusEditing && <> Use the <span className="text-white">frame button</span> on a picked photo to choose which part of it the 4:5 card shows.</>}
          </p>
          {localImages.length === 0 ? (
            <p className="text-sm text-slate-500">No photos yet. Upload some in the gallery first.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
              {localImages.map((img, index) => {
                const on = picked.has(img.id);
                const isDraggingThis = draggedIndex === index;
                const isDragOverThis = dragOverIndex === index;

                return (
                  <div
                    key={img.id}
                    id={`strip-editor-img-${index}`}
                    draggable={!saving}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => handleDragLeave(index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => toggle(img.id)}
                    title={img.description || img.title}
                    // Added transform-gpu for hardware acceleration during drags
                    className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer select-none transform-gpu
                      ${isDraggingThis ? "opacity-30 grayscale scale-90 border-dashed border-slate-500 z-0" : ""}
                      ${!isDraggingThis && isDraggingAnything && !isDragOverThis ? "opacity-80 scale-95 border-transparent" : ""}
                      ${!isDraggingAnything && on ? "border-brand ring-2 ring-brand/30 scale-100" : ""}
                      ${!isDraggingAnything && !on ? "border-slate-700 hover:border-slate-500 scale-100" : ""}
                      ${isDragOverThis ? "!opacity-100 !scale-105 shadow-2xl !border-brand z-10" : ""}
                    `}
                  >
                    {/* A stored small size, not the multi-megabyte original, for a grid of thumbnails. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={variantUrl(img.path, 480)}
                      alt={img.title || "Gallery Image"}
                      className="w-full h-full object-cover pointer-events-none"
                      loading="lazy"
                    />

                    {/* DROP INDICATOR LINE */}
                    {isDragOverThis && draggedIndex !== null && (
                      <div className={`absolute inset-y-0 w-2.5 bg-brand shadow-[0_0_15px_rgba(255,255,255,0.4)] z-30 ${draggedIndex < index ? "right-0" : "left-0"}`} />
                    )}

                    {on && !isDraggingAnything && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center shadow pointer-events-none">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                    {img.description && !isDraggingAnything && (
                      <span className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/75 to-transparent text-left text-[10px] text-white/90 leading-snug line-clamp-2 pointer-events-none">
                        {img.description}
                      </span>
                    )}
                    {focusEditing && on && !isDraggingAnything && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openFocus(img); }}
                        title={hasCustomFocus(focusMap[img.id]) ? "Framing set · change it" : "Set the framing"}
                        aria-label="Set the framing"
                        className={`absolute top-1.5 left-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow transition-colors cursor-pointer ${hasCustomFocus(focusMap[img.id]) ? "bg-brand text-white" : "bg-black/60 text-white/90 hover:bg-black/80"}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Framing editor: the 4:5 card at phone size, dragged and zoomed like the hero. */}
        {focusEdit && (
          <div className="absolute inset-0 z-20 bg-slate-900 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-800 flex-shrink-0">
              <h2 className="font-bold text-white text-base truncate">Frame this photo</h2>
              <span className="hidden sm:inline text-sm text-slate-500 truncate">{focusEdit.description || focusEdit.title}</span>
              <button onClick={() => setFocusEdit(null)} aria-label="Back" className="ml-auto p-2 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-[min(78vw,340px)]">
                <CropEditor
                  key={`f-${focusEdit.id}`}
                  src={focusEdit.path}
                  aspectRatio="4/5"
                  focusStr={focusDraft}
                  onCommit={setFocusDraft}
                  onChange={setFocusDraft}
                  maxZoom={1}
                  className="w-full rounded-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
                >
                  <div className="absolute top-3 right-3 text-white/40 text-[9px] font-bold uppercase tracking-widest pointer-events-none">Drag to frame</div>
                </CropEditor>
              </div>
              <p className="text-xs text-slate-500 text-center">The card as it shows on a phone; the desktop strip uses the same framing. Drag only, no zoom.</p>
            </div>
            <div className="flex items-center gap-3 p-4 border-t border-slate-800 flex-shrink-0">
              <button type="button" onClick={() => setFocusDraft(DEFAULT_FOCUS)} className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-700 text-slate-300 hover:border-slate-500 transition-all cursor-pointer">Reset</button>
              <button type="button" onClick={doneFocus} className="ml-auto px-6 py-2.5 rounded-xl text-sm font-bold bg-brand hover:bg-brand-light text-white transition-colors cursor-pointer shadow-lg">Done</button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-4 border-t border-slate-800 flex-shrink-0 bg-slate-900">
          <span className="text-sm text-slate-400 flex-1">
            {count === 0 ? "Nothing picked: visitors see every photo." : `${count} ${count === 1 ? "photo" : "photos"} at the top.`}
          </span>
          {count > 0 && (
            <button type="button" onClick={() => setPicked(new Set())}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-700 text-slate-300 hover:border-slate-500 transition-all cursor-pointer">
              Show all
            </button>
          )}
          <button type="button" onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-brand hover:bg-brand-light disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shadow-lg">
            {saving ? "Saving…" : "Save Layout"}
          </button>
        </div>
      </div>
    </div>
  );
}