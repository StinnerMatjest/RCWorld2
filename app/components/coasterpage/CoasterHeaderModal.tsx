"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import { CropEditor } from "../parkpage/ParkHeaderModal";
import { ImagePickerGrid } from "../editor/SectionMediaEditor";
import { mediaCaptions } from "../parkpage/SectionBody";
import type { CoasterGalleryImage } from "./coasterPageTypes";

/** The hero's frames. Keep in step with CoasterHero. */
export const HERO_ASPECT = { mobile: "4/5", desktop: "21/9" } as const;
const FOCUS_DEFAULT = "0.5 0.5 1";

interface Props {
  coasterId: number;
  coasterName: string;
  gallery: CoasterGalleryImage[];
  /** The current header row, if any. */
  current: { imageId: number | null; focusMobile: string | null; focusDesktop: string | null };
  onClose: () => void;
  /** Called after a successful save so the page re-fetches the gallery. */
  onSaved: () => void;
}

/**
 * Header photo editor for a coaster: pick a gallery image, then position and
 * zoom it once for the phone hero (portrait) and once for the desktop hero
 * (wide). Same drag/scroll/pinch editor as the park header.
 */
export default function CoasterHeaderModal({ coasterId, coasterName, gallery, current, onClose, onSaved }: Props) {
  useScrollLock();
  const images = useMemo(() => gallery.filter((g) => !/\.(mp4|webm|ogg)$/i.test(g.path)), [gallery]);
  const [imageId, setImageId] = useState<number | null>(current.imageId ?? images[0]?.id ?? null);
  const [focusMobile, setFocusMobile] = useState(current.focusMobile ?? FOCUS_DEFAULT);
  const [focusDesktop, setFocusDesktop] = useState(current.focusDesktop ?? FOCUS_DEFAULT);
  const [frame, setFrame] = useState<"mobile" | "desktop">("mobile");
  const [picking, setPicking] = useState(images.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mobileRef = useRef<{ getFocus: () => string } | null>(null);
  const desktopRef = useRef<{ getFocus: () => string } | null>(null);
  const captions = useMemo(() => mediaCaptions(images), [images]);

  const image = images.find((g) => g.id === imageId) ?? null;

  // Changing the photo starts both crops from centre unless it already had crops saved.
  const pick = (path: string | null) => {
    const img = images.find((g) => g.path === path);
    if (!img) return;
    setImageId(img.id);
    setFocusMobile(img.focus_mobile ?? FOCUS_DEFAULT);
    setFocusDesktop(img.focus_desktop ?? FOCUS_DEFAULT);
    setPicking(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!image || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/coasters/${coasterId}/gallery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: image.id,
          focusMobile: mobileRef.current?.getFocus() ?? focusMobile,
          focusDesktop: desktopRef.current?.getFocus() ?? focusDesktop,
        }),
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

  // Keep the crop being dragged before its editor unmounts on a frame switch.
  const switchFrame = (f: "mobile" | "desktop") => {
    if (f === frame) return;
    if (frame === "mobile") { const v = mobileRef.current?.getFocus(); if (v) setFocusMobile(v); }
    else { const v = desktopRef.current?.getFocus(); if (v) setFocusDesktop(v); }
    setFrame(f);
  };

  const frameButton = (f: "mobile" | "desktop", label: string) => (
    <button key={f} type="button" onClick={() => switchFrame(f)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${frame === f ? "bg-slate-700 text-blue-400 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/80 backdrop-blur-sm pt-3 md:pt-0 md:p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl h-[97dvh] md:h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-800 flex-shrink-0">
          <div className="min-w-0 flex items-baseline gap-2">
            <h2 className="font-bold text-white text-base truncate">Header photo</h2>
            <span className="hidden sm:inline text-sm text-slate-500 truncate">{coasterName}</span>
          </div>
          {!picking && image && (
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 ml-2">
              {frameButton("mobile", "📱 Phone")}
              {frameButton("desktop", "🖥️ Desktop")}
            </div>
          )}
          {error && <span className="hidden md:inline text-sm text-red-400 truncate">{error}</span>}
          <button onClick={picking && image ? () => setPicking(false) : onClose} aria-label="Close"
            className="ml-auto p-2 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        {error && <div className="md:hidden px-4 py-1.5 text-xs text-red-400 border-b border-slate-800">{error}</div>}

        {picking || !image ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
            <p className="text-sm text-slate-400">Pick the photo for the top of the page. Upload new photos in the gallery first.</p>
            <ImagePickerGrid
              galleryImages={images}
              selected={image ? [image.path] : []}
              onSelect={pick}
              maxSelection={1}
              captions={captions}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 gap-4">
            {/* One editor at a time: a hidden editor measures a zero-size box and
                draws nothing. Each frame's crop lives in state between switches. */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              {frame === "mobile" ? (
                <div className="h-full max-h-full" style={{ aspectRatio: HERO_ASPECT.mobile }}>
                  <CropEditor
                    key={`m-${image.id}`}
                    editorRef={mobileRef}
                    src={image.path}
                    focusStr={focusMobile}
                    onCommit={setFocusMobile}
                    className="h-full w-full rounded-2xl"
                  >
                    <div className="absolute inset-x-0 bottom-0 p-4 pointer-events-none bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent">
                      <p className="text-3xl font-bold text-white leading-tight">{coasterName}</p>
                      <p className="text-[11px] text-white/60 mt-3">Phone · drag, pinch or scroll to zoom</p>
                    </div>
                  </CropEditor>
                </div>
              ) : (
                <div className="w-full max-h-full" style={{ aspectRatio: HERO_ASPECT.desktop }}>
                  <CropEditor
                    key={`d-${image.id}`}
                    editorRef={desktopRef}
                    src={image.path}
                    focusStr={focusDesktop}
                    onCommit={setFocusDesktop}
                    className="h-full w-full rounded-2xl"
                  >
                    <div className="absolute inset-x-0 bottom-0 p-5 pointer-events-none bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent">
                      <p className="text-4xl font-bold text-white leading-tight">{coasterName}</p>
                      <p className="text-[11px] text-white/60 mt-3">Desktop · drag or scroll to zoom</p>
                    </div>
                  </CropEditor>
                </div>
              )}
            </div>

            <div className="flex gap-3 flex-shrink-0">
              <button type="button" onClick={() => setPicking(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-700 text-slate-300 hover:border-blue-400 hover:text-blue-400 transition-all cursor-pointer">
                Change photo
              </button>
              <button type="button" onClick={save} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors cursor-pointer">
                {saving ? "Saving…" : "Save both crops"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
