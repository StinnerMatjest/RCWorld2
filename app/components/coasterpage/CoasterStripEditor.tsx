"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import { variantUrl } from "@/app/lib/imageVariants";
import { DEFAULT_FOCUS, hasCustomFocus, placeCover } from "@/app/lib/coverPlacement";
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
  /** Lets each picked photo be framed for its 4:5 card (the API must take PATCH {focus} / {stripFocus}). */
  focusEditing?: boolean;
  /**
   * Which framing the editor sets: "mobile" = the park page's phone deck
   * (focus), "desktop" = the strip on the park page on desktop and on the
   * coaster page (strip_focus, kept per photo). Default mobile.
   */
  framing?: "mobile" | "desktop";
  /** What the page shows when nothing is picked. */
  emptyNote?: string;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

/** A 4:5 thumbnail drawn with the photo's framing, as the deck card shows it. */
function FramedThumb({ src, focus, alt }: { src: string; focus: string | null | undefined; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const img = ref.current;
    if (!img) return;
    if (!hasCustomFocus(focus)) { img.style.objectPosition = ""; return; }
    if (img.complete && img.naturalWidth) placeCover(img, focus);
  }, [focus]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={variantUrl(src, 480)}
      alt={alt}
      draggable={false}
      loading="lazy"
      className="w-full h-full object-cover pointer-events-none select-none"
      onLoad={(e) => { if (hasCustomFocus(focus)) placeCover(e.currentTarget, focus); }}
    />
  );
}

const Icon = {
  left: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>,
  right: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>,
  frame: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>,
  close: <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>,
};

/**
 * Picks and orders the photos that open a page (coaster strip, park deck and
 * strip). The picked photos sit in their own grid at the top, in page order,
 * each with move-earlier / move-later buttons (and drag on desktop), framing
 * and remove; below, every photo of the gallery, where a tap adds or removes.
 */
export default function CoasterStripEditor({ coasterId, coasterName, gallery, onClose, onSaved, endpoint, focusEditing = false, framing = "mobile", emptyNote }: Props) {
  const desktopFraming = framing === "desktop";
  // The framing as the page shows it now: the strip falls back to the deck's.
  const shownFocus = (g: CoasterGalleryImage) => (desktopFraming ? g.strip_focus || g.focus : g.focus) ?? null;
  useScrollLock();
  const api = endpoint ?? `/api/coasters/${coasterId}/gallery`;

  const photos = gallery.filter((g) => !isVideo(g.path));
  const byId = new Map(photos.map((g) => [g.id, g]));
  // The picked photos, in the order the page will show them.
  const [order, setOrder] = useState<number[]>(() => photos.filter((g) => g.featured).map((g) => g.id));
  const pickedSet = new Set(order);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Framing per photo ("cx cy zoom"); only the changed ones are sent.
  const [focusMap, setFocusMap] = useState<Record<number, string | null>>(() => Object.fromEntries(photos.map((g) => [g.id, shownFocus(g)])));
  const [focusEdit, setFocusEdit] = useState<CoasterGalleryImage | null>(null);
  const [focusDraft, setFocusDraft] = useState<string>(DEFAULT_FOCUS);
  const focusEditRef = useRef<CoasterGalleryImage | null>(null);
  focusEditRef.current = focusEdit;
  const openFocus = (img: CoasterGalleryImage) => { setFocusDraft(focusMap[img.id] || DEFAULT_FOCUS); setFocusEdit(img); };
  // A centred desktop framing is stored as such, so it does not fall back to the deck's.
  const doneFocus = () => { if (focusEdit) setFocusMap((m) => ({ ...m, [focusEdit.id]: hasCustomFocus(focusDraft) || desktopFraming ? focusDraft : null })); setFocusEdit(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (focusEditRef.current) setFocusEdit(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: number) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const remove = (id: number) => setOrder((o) => o.filter((x) => x !== id));
  const move = (id: number, by: number) => setOrder((o) => {
    const i = o.indexOf(id), j = i + by;
    if (i < 0 || j < 0 || j >= o.length) return o;
    const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  // Desktop: drag inside the picked grid. Touch uses the arrow buttons.
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const dropOn = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    setOrder((o) => {
      const n = o.filter((x) => x !== dragId);
      n.splice(n.indexOf(targetId) + (o.indexOf(dragId) < o.indexOf(targetId) ? 1 : 0), 0, dragId);
      return n;
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const focus: Record<number, string | null> = {};
      if (focusEditing) {
        for (const img of photos) {
          const was = shownFocus(img), now = focusMap[img.id] ?? null;
          if (was !== now) focus[img.id] = now;
        }
      }
      const reqs: Promise<Response>[] = [
        fetch(api, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featuredIds: order, ...(Object.keys(focus).length ? (desktopFraming ? { stripFocus: focus } : { focus }) : {}) }),
        }),
      ];
      // The page shows the picked photos in gallery order, so the chosen order is
      // written into the gallery: the places the picked photos hold are refilled
      // in the new order, and every other photo and video keeps its place.
      const current = gallery.map((g) => g.id);
      const slots = current.map((id, i) => (pickedSet.has(id) ? i : -1)).filter((i) => i >= 0);
      const next = [...current];
      slots.forEach((slot, k) => { next[slot] = order[k]; });
      if (next.some((id, i) => id !== current[i])) {
        reqs.push(fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorderedIds: next }) }));
      }
      const res = await Promise.all(reqs);
      if (res.some((r) => !r.ok)) throw new Error("Failed to save changes. Your session may have expired.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const count = order.length;
  const tileBtn = "w-7 h-7 rounded-full flex items-center justify-center bg-black/65 text-white hover:bg-black/85 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow";

  return (
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
          {photos.length === 0 ? (
            <p className="text-sm text-slate-500">No photos yet. Upload some in the gallery first.</p>
          ) : (
            <>
              {/* ── Picked, in page order ── */}
              <section className="mb-8">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">Picked <span className="text-slate-500">· {count}</span></h3>
                  {count > 1 && <span className="text-xs text-slate-500 text-right">Arrows move a photo earlier or later<span className="hidden md:inline"> · or drag</span></span>}
                </div>
                {count === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">Tap photos below to add them here.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                    {order.map((id, i) => {
                      const img = byId.get(id);
                      if (!img) return null;
                      const framed = hasCustomFocus(focusMap[id]);
                      return (
                        <div
                          key={id}
                          draggable={!saving}
                          onDragStart={(e) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragOver={(e) => { e.preventDefault(); if (dragId !== null && overId !== id) setOverId(id); }}
                          onDragLeave={() => { if (overId === id) setOverId(null); }}
                          onDrop={(e) => { e.preventDefault(); dropOn(id); setDragId(null); setOverId(null); }}
                          onDragEnd={() => { setDragId(null); setOverId(null); }}
                          title={img.description || img.title}
                          className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 bg-slate-800 select-none transition-[opacity,border-color] ${dragId === id ? "opacity-40 border-dashed border-slate-500" : overId === id ? "border-brand" : "border-brand/60"}`}
                        >
                          <FramedThumb src={img.path} focus={focusMap[id]} alt={img.title || "Picked photo"} />
                          <span className="absolute top-1.5 left-1.5 min-w-6 h-6 px-1.5 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shadow pointer-events-none">{i + 1}</span>
                          <button type="button" onClick={() => remove(id)} aria-label="Remove from the picked photos" title="Remove" className={`absolute top-1.5 right-1.5 ${tileBtn}`}>{Icon.close}</button>
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent pt-6">
                            <button type="button" onClick={() => move(id, -1)} disabled={i === 0} aria-label="Move earlier" title="Earlier" className={tileBtn}>{Icon.left}</button>
                            {focusEditing && (
                              <button type="button" onClick={() => openFocus(img)} aria-label="Set the framing" title={framed ? "Framing set · change it" : "Set the framing"}
                                className={`${tileBtn} ${framed ? "!bg-brand" : ""}`}>{Icon.frame}</button>
                            )}
                            <button type="button" onClick={() => move(id, 1)} disabled={i === count - 1} aria-label="Move later" title="Later" className={tileBtn}>{Icon.right}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── Every photo: tap to add or remove ── */}
              <section>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">All photos <span className="text-slate-500">· {photos.length}</span></h3>
                  <span className="text-xs text-slate-500">Tap to add or remove</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                  {photos.map((img) => {
                    const pos = order.indexOf(img.id);
                    const on = pos >= 0;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => toggle(img.id)}
                        title={img.description || img.title}
                        aria-pressed={on}
                        className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 transition-colors cursor-pointer select-none ${on ? "border-brand" : "border-slate-700 hover:border-slate-500"}`}
                      >
                        {/* A stored small size, not the multi-megabyte original, for a grid of thumbnails. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={variantUrl(img.path, 480)} alt={img.title || "Gallery photo"} loading="lazy" draggable={false}
                          className={`w-full h-full object-cover pointer-events-none transition-opacity ${on ? "opacity-60" : ""}`} />
                        {on && (
                          <span className="absolute top-1.5 right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shadow pointer-events-none">{pos + 1}</span>
                        )}
                        {img.description && (
                          <span className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/75 to-transparent text-left text-[10px] text-white/90 leading-snug line-clamp-2 pointer-events-none">
                            {img.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Framing editor: the 4:5 card at phone size. */}
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
              <p className="text-xs text-slate-500 text-center">
                {desktopFraming
                  ? "The card in the desktop strip (the coaster page shows the same). Phones have their own framing. Drag only, no zoom."
                  : "The card in the phone deck. The desktop strip has its own framing. Drag only, no zoom."}
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 border-t border-slate-800 flex-shrink-0">
              <button type="button" onClick={() => setFocusDraft(DEFAULT_FOCUS)} className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-700 text-slate-300 hover:border-slate-500 transition-all cursor-pointer">Reset</button>
              <button type="button" onClick={doneFocus} className="ml-auto px-6 py-2.5 rounded-xl text-sm font-bold bg-brand hover:bg-brand-light text-white transition-colors cursor-pointer shadow-lg">Done</button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-4 border-t border-slate-800 flex-shrink-0 bg-slate-900">
          <span className="text-sm text-slate-400 flex-1">
            {count === 0 ? (emptyNote ?? "Nothing picked: visitors see every photo.") : `${count} ${count === 1 ? "photo" : "photos"} at the top.`}
          </span>
          {count > 0 && (
            <button type="button" onClick={() => setOrder([])}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-700 text-slate-300 hover:border-slate-500 transition-all cursor-pointer">
              Clear
            </button>
          )}
          <button type="button" onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-brand hover:bg-brand-light disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shadow-lg">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
