"use client";

import React, { useEffect, useState } from "react";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import { R2Image } from "../R2Image";
import type { CoasterGalleryImage } from "./coasterPageTypes";

interface Props {
  coasterId: number;
  coasterName: string;
  gallery: CoasterGalleryImage[];
  onClose: () => void;
  /** Called after a successful save so the page re-fetches the gallery. */
  onSaved: () => void;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

/**
 * Choose which photos make the strip at the top of the page. Every photo is
 * always in the full gallery further down; this only decides the opening
 * few. Tap to pick, tap again to drop. With nothing picked, visitors see all.
 */
export default function CoasterStripEditor({ coasterId, coasterName, gallery, onClose, onSaved }: Props) {
  useScrollLock();
  const images = gallery.filter((g) => !isVideo(g.path));
  const [picked, setPicked] = useState<Set<number>>(() => new Set(images.filter((g) => g.featured).map((g) => g.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/coasters/${coasterId}/gallery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuredIds: [...picked] }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Session expired. Log in to admin mode again." : `Save failed (${res.status})`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const count = picked.size;

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/80 backdrop-blur-sm pt-3 md:pt-0 md:p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl w-full max-w-5xl h-[97dvh] md:h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700" onClick={(e) => e.stopPropagation()}>
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
          <p className="text-sm text-slate-400 mb-4">
            Tap the photos that should open the page. Every photo stays in the full gallery below the review; this only picks the strip at the top.
            {" "}With nothing picked, visitors see all of them.
          </p>
          {images.length === 0 ? (
            <p className="text-sm text-slate-500">No photos yet. Upload some in the gallery first.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {images.map((img) => {
                const on = picked.has(img.id);
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => toggle(img.id)}
                    title={img.description || img.title}
                    className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${on ? "border-brand ring-2 ring-brand/30" : "border-slate-700 hover:border-slate-500 opacity-75 hover:opacity-100"}`}
                  >
                    <R2Image src={img.path} alt="" fill sizes="(max-width: 640px) 33vw, 200px" quality={55} className="object-cover" />
                    {on && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center shadow">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                    {img.description && (
                      <span className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/75 to-transparent text-left text-[10px] text-white/90 leading-snug line-clamp-2">{img.description}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-4 border-t border-slate-800 flex-shrink-0">
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
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors cursor-pointer">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
