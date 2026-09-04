"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { parseFocusStr, splitMedia } from "../FocusedImage";
import {
  sectionImageFrame,
  normalizeSectionLayout,
  usesLegacyRow,
  SECTION_LAYOUT_LABELS,
  type SectionLayout,
} from "@/app/utils/sectionImageAspect";
import { SectionBody, isVideoUrl } from "./SectionBody";
import { MarkdownEditor, countTextStats } from "../editor/MarkdownEditor";
import { getRatingColor } from "@/app/utils/design";
import type { Rating } from "@/app/types";
import type { GalleryImage } from "./ParkGallery";
import { useScrollLock } from "@/app/hooks/useScrollLock";

/**
 * Full-screen review editor. Left: sections. Middle: text + images for the
 * selected section. Right (desktop): the section rendered exactly as the park
 * page will show it, updating as you type. Ctrl+S saves the sections you changed.
 */
interface ParkTextsModalProps {
  rating: Rating;
  explanations: Record<string, string>;
  sectionImages: Record<string, string>;
  sectionLayouts?: Record<string, string>;
  sectionSpoilers?: Record<string, boolean>;
  galleryImages: GalleryImage[];
  parkId: number;
  parkName?: string;
  ratingId: number;
  onClose: () => void;
  onSave?: (updatedText: Record<string, string>, updatedImages: Record<string, string>, updatedLayouts: Record<string, string>, updatedSpoilers: Record<string, boolean>) => void;
}

const CATEGORIES = [
  "description",
  "bestCoaster",
  "coasterDepth",
  "waterRides",
  "flatridesAndDarkrides",
  "parkAppearance",
  "parkPracticality",
  "food",
  "snacksAndDrinks",
  "rideOperations",
  "parkManagement",
] as const;
type Category = typeof CATEGORIES[number];

const LABELS: Record<Category, string> = {
  description: "Description",
  bestCoaster: "Best Coaster",
  coasterDepth: "Coaster Depth",
  waterRides: "Water Rides",
  flatridesAndDarkrides: "Flat & Darkrides",
  parkAppearance: "Appearance",
  parkPracticality: "Practicality",
  food: "Food",
  snacksAndDrinks: "Snacks & Drinks",
  rideOperations: "Ride Operations",
  parkManagement: "Management",
};

// The page renders section titles from the key, not from LABELS; mirror that in the preview.
const humanizeLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();

const FOCUS_DEFAULT = "0.5 0.5 1";
// The description used to render its images full width under the text; keep that
// as its default so existing reviews look the same until someone picks a layout.
const DESCRIPTION_DEFAULT_LAYOUT: SectionLayout = "below";

type Draft = {
  text: string;
  images: string[];
  focuses: string[];
  layout: string | null;
  useTwoImages: boolean;
  isSpoiler: boolean;
};

const mediaEntries = (d: Draft) => d.images.map((u, i) => `${u}|${d.focuses[i] ?? FOCUS_DEFAULT}`);
const fingerprint = (d: Draft) => JSON.stringify([d.text, mediaEntries(d), d.layout ?? null, d.isSpoiler]);

function buildDrafts(
  explanations: Record<string, string>,
  sectionImages: Record<string, string>,
  sectionLayouts: Record<string, string>,
  sectionSpoilers: Record<string, boolean>,
): Record<Category, Draft> {
  return Object.fromEntries(CATEGORIES.map(cat => {
    const parsed = (sectionImages[cat] || "").split(",").filter(Boolean).map(splitMedia);
    return [cat, {
      text: explanations[cat] ?? "",
      images: parsed.map(p => p.url),
      focuses: parsed.map(p => p.focus),
      layout: sectionLayouts[cat] ?? null,
      useTwoImages: parsed.length === 2,
      isSpoiler: sectionSpoilers[cat] || false,
    }];
  })) as Record<Category, Draft>;
}

/** Which side the legacy alternating layout puts each section's image on (mirrors ParkText). */
function legacySides(drafts: Record<Category, Draft>): Record<Category, boolean> {
  let i = 0;
  const out = {} as Record<Category, boolean>;
  for (const cat of CATEGORIES) {
    if (cat === "description") { out[cat] = false; continue; }
    const d = drafts[cat];
    out[cat] = usesLegacyRow(d.layout, d.images.length) ? i++ % 2 !== 0 : false;
  }
  return out;
}

// ── Image picker grid ─────────────────────────────────────────────────────────

const ImagePickerGrid = React.memo(function ImagePickerGrid({
  galleryImages, selected, onSelect, maxSelection, usedIn,
}: {
  galleryImages: GalleryImage[];
  selected: string[];
  onSelect: (path: string | null) => void;
  maxSelection: number;
  usedIn: Record<string, string[]>;
}) {
  if (galleryImages.length === 0) {
    return <p className="text-sm text-slate-500">No gallery images available. Upload some in the gallery first.</p>;
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 xl:grid-cols-6 gap-1.5">
      <button onClick={() => onSelect(null)}
        className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${selected.length === 0
          ? "border-blue-500 bg-blue-500/20 text-blue-400"
          : "border-slate-700 text-slate-500 hover:border-slate-600"
          }`}>
        None
      </button>
      {galleryImages.map(img => {
        const selIndex = selected.indexOf(img.path);
        const sel = selIndex !== -1;
        const disabled = !sel && maxSelection > 1 && selected.length >= maxSelection;
        const elsewhere = usedIn[img.path];

        return (
          <button key={img.id} onClick={() => !disabled && onSelect(img.path)}
            disabled={disabled}
            title={elsewhere ? `Already used in: ${elsewhere.join(", ")}` : img.title || undefined}
            className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${sel ? "border-blue-500 ring-2 ring-blue-500/30 cursor-pointer" : disabled ? "border-slate-800/60 opacity-30 cursor-not-allowed" : "border-slate-700 hover:border-slate-500 cursor-pointer"
              }`}>
            {isVideoUrl(img.path) ? (
              <>
                <video src={img.path} className={`w-full h-full object-cover ${elsewhere && !sel ? "opacity-60" : ""}`} muted playsInline preload="metadata" />
                <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold uppercase tracking-wider pointer-events-none">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Video
                </span>
              </>
            ) : (
              <Image src={img.path} alt="" fill sizes="(max-width: 640px) 25vw, 160px" quality={55} className={`object-cover ${elsewhere && !sel ? "opacity-60" : ""}`} />
            )}
            {elsewhere && !sel && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                Used
              </span>
            )}
            {sel && (
              <div className="absolute inset-0 bg-blue-500/25 flex items-center justify-center">
                {maxSelection === 2 ? (
                  <span className="bg-blue-600 text-white font-bold rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-lg border-2 border-white/20">
                    {selIndex + 1}
                  </span>
                ) : (
                  <svg className="w-5 h-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
});

// ── Cropper ───────────────────────────────────────────────────────────────────

function SectionImageCropper({
  src, mobileAspect, desktopAspect, value, onChange,
}: {
  src: string;
  mobileAspect: string;
  desktopAspect: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const init = parseFocusStr(value);
  const [pos, setPos] = useState({ cx: init.cx, cy: init.cy });
  const posRef = useRef(pos);
  posRef.current = pos;
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  useEffect(() => {
    const p = parseFocusStr(value);
    setPos({ cx: p.cx, cy: p.cy });
  }, [value, src]);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const ratio = (s: string) => {
    const [a, b] = s.split("/").map((n) => parseFloat(n.trim()));
    return a / (b || 1);
  };

  const Ai = dims ? dims.w / dims.h : 1;
  const win = (Af: number, cx: number, cy: number) =>
    Ai >= Af
      ? { left: cx * (1 - Af / Ai), top: 0, w: Af / Ai, h: 1 }
      : { left: 0, top: cy * (1 - Ai / Af), w: 1, h: Ai / Af };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: posRef.current.cx, cy: posRef.current.cy };
  };
  const onMove = (e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!drag.current || !box || !dims) return;
    const cw = box.clientWidth, ch = box.clientHeight;
    const d = win(ratio(desktopAspect), drag.current.cx, drag.current.cy);
    const m = win(ratio(mobileAspect), drag.current.cx, drag.current.cy);
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    let ncx = drag.current.cx, ncy = drag.current.cy;
    if (1 - d.w > 0.0005) ncx = clamp(drag.current.cx - dx / (cw * (1 - d.w)));
    else if (1 - m.w > 0.0005) ncx = clamp(drag.current.cx + dx / (cw * (1 - m.w)));
    if (1 - d.h > 0.0005) ncy = clamp(drag.current.cy - dy / (ch * (1 - d.h)));
    else if (1 - m.h > 0.0005) ncy = clamp(drag.current.cy + dy / (ch * (1 - m.h)));
    setPos({ cx: ncx, cy: ncy });
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    onChange(`${posRef.current.cx.toFixed(4)} ${posRef.current.cy.toFixed(4)} 1`);
  };

  let safe: { left: number; top: number; w: number; h: number } | null = null;
  if (dims) {
    const d = win(ratio(desktopAspect), pos.cx, pos.cy);
    const m = win(ratio(mobileAspect), pos.cx, pos.cy);
    const left = Math.max(d.left, m.left);
    const top = Math.max(d.top, m.top);
    const right = Math.min(d.left + d.w, m.left + m.w);
    const bottom = Math.min(d.top + d.h, m.top + m.h);
    safe = {
      left: (left - d.left) / d.w,
      top: (top - d.top) / d.h,
      w: (right - left) / d.w,
      h: (bottom - top) / d.h,
    };
  }
  const showSafe = !!safe && (safe.w < 0.995 || safe.h < 0.995);

  return (
    <>
      <div
        ref={boxRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative w-full overflow-hidden rounded-xl bg-slate-950 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ aspectRatio: desktopAspect, maxHeight: "58vh" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ objectPosition: `${pos.cx * 100}% ${pos.cy * 100}%` }}
        />
        {showSafe && safe && (
          <div
            className="absolute border-2 border-white/90 rounded-sm pointer-events-none"
            style={{
              left: `${safe.left * 100}%`,
              top: `${safe.top * 100}%`,
              width: `${safe.w * 100}%`,
              height: `${safe.h * 100}%`,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            }}
          />
        )}
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        {showSafe
          ? "Drag to position. The bright box is what shows on every screen."
          : "Drag to position the crop."}
      </p>
    </>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────

function SectionPreview({
  cat, draft, rating, asVisitor, legacyRight, onMediaClick,
}: {
  cat: Category;
  draft: Draft;
  rating: Rating;
  asVisitor: boolean;
  legacyRight: boolean;
  onMediaClick: (url: string, index: number) => void;
}) {
  const media = mediaEntries(draft);
  const empty = !draft.text.trim() && media.length === 0;
  const isAdminMode = !asVisitor;

  if (cat === "description") {
    return (
      <div>
        <h2 className="text-4xl font-bold text-white tracking-tight">Introduction</h2>
        <div className="w-12 h-1 bg-brand rounded-full mt-3 mb-4" />
        {empty ? (
          <p className="text-slate-600 italic">Nothing to preview yet. Start writing on the left.</p>
        ) : (
          <SectionBody
            text={draft.text}
            media={media}
            layout={draft.layout}
            defaultLayout={DESCRIPTION_DEFAULT_LAYOUT}
            isSpoiler={draft.isSpoiler}
            isAdminMode={isAdminMode}
            altLabel="Introduction"
            textClassName="text-slate-400 text-base leading-relaxed"
            onMediaClick={onMediaClick}
          />
        )}
      </div>
    );
  }

  const value = (rating as unknown as Record<string, number | undefined>)[cat] ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
        <h3 className="text-xl font-semibold text-white">{humanizeLabel(cat)}</h3>
        <span className={`text-2xl font-bold ${getRatingColor(value)}`}>{value}</span>
        {isAdminMode && draft.isSpoiler && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400 border border-red-800/50">
            Spoiler
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-slate-600 italic">Nothing to preview yet. Start writing on the left.</p>
      ) : (
        <SectionBody
          text={draft.text}
          media={media}
          layout={draft.layout}
          fallbackRight={legacyRight}
          isSpoiler={draft.isSpoiler}
          isAdminMode={isAdminMode}
          altLabel={humanizeLabel(cat)}
          onMediaClick={onMediaClick}
        />
      )}
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

const ParkTextModal: React.FC<ParkTextsModalProps> = ({
  rating,
  explanations, sectionImages, sectionLayouts = {}, sectionSpoilers = {}, galleryImages, parkId, parkName, ratingId, onClose, onSave,
}) => {
  useScrollLock();

  const [drafts, setDrafts] = useState<Record<Category, Draft>>(() => buildDrafts(explanations, sectionImages, sectionLayouts, sectionSpoilers));
  // What the server currently has; drafts are compared against this to find unsaved work.
  const [saved, setSaved] = useState<Record<Category, Draft>>(() => buildDrafts(explanations, sectionImages, sectionLayouts, sectionSpoilers));
  const [persisted, setPersisted] = useState<Set<string>>(() => new Set(CATEGORIES.filter(c => explanations[c] !== undefined)));

  const [selectedCat, setSelectedCat] = useState<Category>("description");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"write" | "preview">("write");
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false);

  const cur = drafts[selectedCat];
  const textStats = countTextStats(cur.text);
  const isDescription = selectedCat === "description";

  const dirtyCats = useMemo(
    () => CATEGORIES.filter(c => fingerprint(drafts[c]) !== fingerprint(saved[c])),
    [drafts, saved]
  );
  const dirtySet = useMemo(() => new Set<string>(dirtyCats), [dirtyCats]);
  const legacy = useMemo(() => legacySides(drafts), [drafts]);

  const defaultLayout: SectionLayout = isDescription
    ? DESCRIPTION_DEFAULT_LAYOUT
    : legacy[selectedCat] ? "right" : "left";
  // In two-image mode, crop against the two-image frame even while only the first
  // image is picked, so image 1 is not positioned against a shape it will not get.
  const frameCount = cur.useTwoImages ? 2 : Math.max(1, cur.images.length);
  const activeLayout = normalizeSectionLayout(cur.layout, frameCount, defaultLayout);
  const cropFrame = sectionImageFrame(cur.layout, frameCount, {
    defaultLayout: isDescription ? DESCRIPTION_DEFAULT_LAYOUT : null,
  });

  // Gallery images already placed in another section, so the picker can flag them.
  const usedIn = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cat of CATEGORIES) {
      if (cat === selectedCat) continue;
      for (const url of drafts[cat].images) (map[url] ??= []).push(LABELS[cat]);
    }
    return map;
  }, [drafts, selectedCat]);

  // ── Draft mutations ─────────────────────────────────────────────────────────
  const patch = useCallback((fn: (c: Draft) => Draft) =>
    setDrafts(d => ({ ...d, [selectedCat]: fn(d[selectedCat]) })), [selectedCat]);

  const updateText = useCallback((text: string) => patch(c => ({ ...c, text })), [patch]);
  const updateSpoiler = useCallback((isSpoiler: boolean) => patch(c => ({ ...c, isSpoiler })), [patch]);
  const updateLayout = useCallback((layout: SectionLayout) => patch(c => ({ ...c, layout })), [patch]);
  const updateFocus = useCallback((index: number, focus: string) => patch(c => {
    const focuses = [...c.focuses];
    focuses[index] = focus;
    return { ...c, focuses };
  }), [patch]);

  const setImageMode = useCallback((two: boolean) => patch(c => ({
    ...c,
    useTwoImages: two,
    images: two ? c.images : c.images.slice(0, 1),
    focuses: two ? c.focuses : c.focuses.slice(0, 1),
    layout: !two && c.layout === "double" ? "above" : c.layout,
  })), [patch]);

  const removeImageAt = useCallback((index: number) => {
    patch(c => ({
      ...c,
      images: c.images.filter((_, i) => i !== index),
      focuses: c.focuses.filter((_, i) => i !== index),
    }));
    setCropIndex(null);
  }, [patch]);

  const swapImages = useCallback(() => patch(c => c.images.length === 2
    ? { ...c, images: [c.images[1], c.images[0]], focuses: [c.focuses[1] ?? FOCUS_DEFAULT, c.focuses[0] ?? FOCUS_DEFAULT] }
    : c), [patch]);

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const handlePick = useCallback((path: string | null) => {
    if (path === null) { patch(c => ({ ...c, images: [], focuses: [] })); return; }
    const c = draftsRef.current[selectedCat];
    const existing = c.images.indexOf(path);

    if (existing !== -1) {
      if (isVideoUrl(path)) removeImageAt(existing);
      else setCropIndex(existing);
      return;
    }
    if (c.useTwoImages) {
      if (c.images.length >= 2) return;
      patch(d => ({ ...d, images: [...d.images, path], focuses: [...d.focuses, FOCUS_DEFAULT] }));
      if (!isVideoUrl(path)) setCropIndex(c.images.length);
    } else {
      patch(d => ({ ...d, images: [path], focuses: [FOCUS_DEFAULT] }));
      if (!isVideoUrl(path)) setCropIndex(0);
    }
  }, [selectedCat, patch, removeImageAt]);

  const openCropFor = useCallback((_url: string, index: number) => {
    const c = draftsRef.current[selectedCat];
    if (c.images[index] && !isVideoUrl(c.images[index])) setCropIndex(index);
  }, [selectedCat]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const dirtyRef = useRef(dirtyCats);
  dirtyRef.current = dirtyCats;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const cats = dirtyRef.current;
    if (cats.length === 0) return;
    setIsSaving(true);
    setSaveMsg(null);

    const results = await Promise.all(cats.map(async cat => {
      const d = draftsRef.current[cat];
      const layout = d.layout === "double" && d.images.length < 2 ? "above" : d.layout;
      const imgString = d.images.length > 0 ? mediaEntries(d).join(",") : null;
      const method = persistedRef.current.has(cat) ? "PUT" : "POST";
      try {
        const res = await fetch(`/api/park/${parkId}/parkTexts`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, text: d.text, ratingId, imageUrl: imgString, imageLayout: layout ?? null, isSpoiler: d.isSpoiler }),
        });
        return { cat, ok: res.ok, status: res.status, draft: { ...d, layout } };
      } catch {
        return { cat, ok: false, status: 0, draft: d };
      }
    }));

    const newSaved = { ...savedRef.current };
    const newPersisted = new Set(persistedRef.current);
    const failed: { cat: Category; status: number }[] = [];
    for (const r of results) {
      if (r.ok) { newSaved[r.cat] = r.draft; newPersisted.add(r.cat); }
      else failed.push({ cat: r.cat, status: r.status });
    }
    setSaved(newSaved);
    setPersisted(newPersisted);
    // Saved layouts that were normalised should show up in the draft too.
    setDrafts(d => {
      const next = { ...d };
      for (const r of results) if (r.ok && r.draft.layout !== d[r.cat].layout) next[r.cat] = { ...d[r.cat], layout: r.draft.layout };
      return next;
    });

    onSave?.(
      Object.fromEntries(CATEGORIES.filter(c => newSaved[c].text).map(c => [c, newSaved[c].text])),
      Object.fromEntries(CATEGORIES.filter(c => newSaved[c].images.length > 0).map(c => [c, mediaEntries(newSaved[c]).join(",")])),
      Object.fromEntries(CATEGORIES.filter(c => newSaved[c].layout).map(c => [c, newSaved[c].layout!])),
      Object.fromEntries(CATEGORIES.map(c => [c, newSaved[c].isSpoiler])),
    );

    if (failed.length > 0) {
      setSaveMsg({
        kind: "err",
        text: failed.some(f => f.status === 401)
          ? "Not saved: session expired. Log in to admin mode again."
          : failed.some(f => f.status === 0)
            ? "Save failed: network error."
            : `Failed to save: ${failed.map(f => LABELS[f.cat]).join(", ")}`,
      });
    } else {
      setSaveMsg({ kind: "ok", text: `Saved ${cats.length === 1 ? LABELS[cats[0]] : `${cats.length} sections`}` });
      setTimeout(() => setSaveMsg(m => (m?.kind === "ok" ? null : m)), 2500);
    }
    setIsSaving(false);
  }, [isSaving, parkId, ratingId, onSave]);

  const requestClose = useCallback(() => {
    const dirty = dirtyRef.current;
    if (dirty.length > 0) {
      const names = dirty.map(c => LABELS[c]).join(", ");
      if (!confirm(`Unsaved changes in: ${names}.\n\nClose and discard them?`)) return;
    }
    onClose();
  }, [onClose]);

  // Ctrl+S saves, Escape closes (the crop dialog handles its own Escape first).
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  const cropOpenRef = useRef(cropIndex !== null);
  cropOpenRef.current = cropIndex !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
        return;
      }
      if (e.key === "Escape") {
        if (cropOpenRef.current) { setCropIndex(null); return; }
        requestCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleUnpublish = async () => {
    if (!confirm("Unpublish this review?")) return;
    const res = await fetch(`/api/ratings/${ratingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: false }),
    });
    if (res.ok) window.location.reload();
    else setSaveMsg({ kind: "err", text: "Failed to unpublish." });
  };

  const layoutOptions: SectionLayout[] = cur.useTwoImages
    ? ["left", "right", "above", "below", "double"]
    : ["left", "right", "above", "below"];

  const sectionButton = (cat: Category, compact: boolean) => {
    const d = drafts[cat];
    const filled = !!(d.text || d.images.length > 0);
    const dirty = dirtySet.has(cat);
    const active = selectedCat === cat;
    const dot = dirty ? "bg-amber-400" : filled ? "bg-green-500" : "bg-slate-600";
    if (compact) {
      return (
        <button key={cat} onClick={() => { setSelectedCat(cat); setCropIndex(null); }}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${active
            ? "bg-blue-600 border-blue-600 text-white"
            : "border-slate-700 text-slate-400"
            }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : dot}`} />
          {LABELS[cat]}
        </button>
      );
    }
    return (
      <button key={cat} onClick={() => { setSelectedCat(cat); setCropIndex(null); }}
        title={dirty ? "Unsaved changes" : undefined}
        className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-left w-full transition-colors cursor-pointer rounded-lg ${active
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          }`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="flex-1 truncate">{LABELS[cat]}</span>
        {dirty && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">edited</span>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col text-slate-200">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14 border-b border-slate-800 flex-shrink-0 bg-slate-900/60">
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <h2 className="font-bold text-white text-base truncate">Edit review</h2>
          {parkName && <span className="hidden sm:inline text-sm text-slate-500 truncate">{parkName}</span>}
        </div>

        {/* Mobile write / preview switch */}
        <div className="lg:hidden flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
          {(["write", "preview"] as const).map(v => (
            <button key={v} onClick={() => setMobileView(v)}
              className={`px-3 py-1 rounded-md capitalize cursor-pointer transition-colors ${mobileView === v ? "bg-slate-700 text-white" : "text-slate-400"}`}>
              {v}
            </button>
          ))}
        </div>

        {saveMsg && (
          <span className={`hidden md:inline text-sm font-medium ${saveMsg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{saveMsg.text}</span>
        )}
        {rating.published && (
          <button onClick={handleUnpublish}
            className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-red-900/50 text-red-400 text-sm font-medium hover:bg-red-900/20 transition-colors cursor-pointer">
            Unpublish
          </button>
        )}
        <button onClick={handleSave} disabled={isSaving || dirtyCats.length === 0} title="Ctrl+S"
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-default text-white text-sm font-bold transition-colors cursor-pointer">
          {isSaving ? "Saving…" : dirtyCats.length > 0 ? `Save ${dirtyCats.length}` : "Saved"}
        </button>
        <button onClick={requestClose} aria-label="Close editor"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {saveMsg && (
        <div className={`md:hidden px-4 py-1.5 text-xs font-medium border-b border-slate-800 ${saveMsg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{saveMsg.text}</div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Sections sidebar (desktop) */}
        <nav className="hidden lg:flex flex-col w-52 border-r border-slate-800 overflow-y-auto flex-shrink-0 p-2 gap-0.5 bg-slate-900/40">
          {CATEGORIES.map(cat => sectionButton(cat, false))}
        </nav>

        {/* Editor column */}
        <div className={`${mobileView === "preview" ? "hidden lg:flex" : "flex"} flex-1 min-w-0 min-h-0 flex-col overflow-hidden`}>
          <div className="lg:hidden flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0 border-b border-slate-800 no-scrollbar">
            {CATEGORIES.map(cat => sectionButton(cat, true))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-6">

              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  {LABELS[selectedCat]}
                  {cur.isSpoiler && <span className="text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400 border border-red-800/50 px-2 py-0.5 rounded">Spoiler</span>}
                </h3>
                {!isDescription && (
                  <div className="bg-slate-800/80 border border-slate-700 px-3 py-1 rounded-lg flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Score</span>
                    <span className="text-blue-400 font-bold text-lg">{String((rating as unknown as Record<string, unknown>)[selectedCat] ?? "-")}</span>
                  </div>
                )}
              </div>

              <MarkdownEditor
                key={selectedCat}
                value={cur.text}
                onChange={updateText}
                placeholder={`Write about ${LABELS[selectedCat].toLowerCase()}…`}
                toolbarEnd={
                  <span className="text-xs text-slate-500 font-medium tracking-wide">
                    {textStats.words} words · {textStats.paragraphs} paragraphs
                  </span>
                }
              />

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={cur.isSpoiler}
                  onChange={(e) => updateSpoiler(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500/50"
                />
                <span className="text-sm font-medium text-slate-300">Mark whole section as spoiler</span>
              </label>

              {/* ── Images ──────────────────────────────────────────────────── */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-slate-300">Images <span className="text-slate-500 font-normal">(optional)</span></p>
                    <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
                      {([false, true] as const).map(two => (
                        <button key={String(two)} onClick={() => setImageMode(two)}
                          className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${cur.useTwoImages === two ? "bg-slate-700 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
                          {two ? "2 images" : "1 image"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {cur.images.length > 0 && (
                    <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
                      {layoutOptions.map(opt => (
                        <button key={opt} onClick={() => updateLayout(opt)}
                          title={opt === "double" ? "Image, text, image" : undefined}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeLayout === opt ? "bg-slate-700 text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
                          {SECTION_LAYOUT_LABELS[opt]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {cur.useTwoImages && cur.images.length === 1 && (
                  <p className="text-xs text-amber-400/90 bg-amber-900/15 border border-amber-800/40 rounded-lg px-3 py-2">
                    Two-image mode with one image picked. Pick a second one, or switch to 1 image. Saving as-is keeps just the one.
                  </p>
                )}

                {cur.images.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {cur.images.map((url, i) => (
                      <div key={`${i}-${url}`} className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700 rounded-lg p-1 pr-2">
                        <div className="relative w-12 h-9 rounded overflow-hidden bg-slate-950 flex-shrink-0">
                          {isVideoUrl(url) ? (
                            <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                          ) : (
                            <Image src={url} alt="" fill sizes="48px" quality={40} className="object-cover" style={{ objectPosition: `${parseFocusStr(cur.focuses[i]).cx * 100}% ${parseFocusStr(cur.focuses[i]).cy * 100}%` }} />
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-medium inline-flex items-center gap-1">
                          {cur.images.length > 1 ? `#${i + 1}` : isVideoUrl(url) ? "Video" : "Image"}
                          {cur.images.length > 1 && isVideoUrl(url) && (
                            <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="currentColor" aria-label="Video"><path d="M8 5v14l11-7z" /></svg>
                          )}
                        </span>
                        {isVideoUrl(url) ? (
                          <span className="text-[11px] text-slate-500 px-1" title="Videos fill the frame automatically and cannot be repositioned">Plays muted, loops</span>
                        ) : (
                          <button onClick={() => setCropIndex(i)} className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer px-1">Position</button>
                        )}
                        <button onClick={() => removeImageAt(i)} aria-label="Remove image" className="text-slate-500 hover:text-red-400 cursor-pointer px-1">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                        </button>
                      </div>
                    ))}
                    {cur.images.length === 2 && (
                      <button onClick={swapImages} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                        Swap order
                      </button>
                    )}
                  </div>
                )}

                <ImagePickerGrid
                  galleryImages={galleryImages}
                  selected={cur.images}
                  onSelect={handlePick}
                  maxSelection={cur.useTwoImages ? 2 : 1}
                  usedIn={usedIn}
                />
                <p className="text-xs text-slate-500">Click a picked image, here or in the preview, to reposition it. Videos play muted on the page and open with sound when clicked.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview column */}
        <div className={`${mobileView === "write" ? "hidden lg:flex" : "flex"} flex-col lg:w-[46%] xl:w-1/2 flex-1 lg:flex-none min-w-0 min-h-0 border-l border-slate-800 bg-[#0f172a]`}>
          <div className="flex items-center justify-between px-4 h-10 border-b border-slate-800/80 flex-shrink-0 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-500">Preview</span>
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 font-bold">
              {([false, true] as const).map(v => (
                <button key={String(v)} onClick={() => setPreviewAsVisitor(v)}
                  className={`px-2.5 py-0.5 rounded-md cursor-pointer transition-colors ${previewAsVisitor === v ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                  {v ? "As visitor" : "As admin"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-[900px] px-5 sm:px-8 py-8">
              <SectionPreview
                cat={selectedCat}
                draft={cur}
                rating={rating}
                asVisitor={previewAsVisitor}
                legacyRight={legacy[selectedCat]}
                onMediaClick={openCropFor}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Crop dialog ─────────────────────────────────────────────────────── */}
      {cropIndex !== null && cur.images[cropIndex] && !isVideoUrl(cur.images[cropIndex]) && (
        <div
          className="fixed inset-0 z-[1010] flex items-center justify-center bg-black/80 p-3 sm:p-4"
          onClick={() => setCropIndex(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col gap-3 p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-200">
                Position image{cur.images.length > 1 ? ` ${cropIndex + 1}` : ""}
                <span className="text-slate-500 font-normal"> · drag to choose what shows</span>
              </p>
              <button
                onClick={() => setCropIndex(null)}
                aria-label="Close"
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <SectionImageCropper
              key={`popup-crop-${selectedCat}-${cropIndex}-${cur.images[cropIndex]}-${cropFrame.desktop}`}
              src={cur.images[cropIndex]}
              mobileAspect={cropFrame.mobile}
              desktopAspect={cropFrame.desktop}
              value={cur.focuses[cropIndex] ?? FOCUS_DEFAULT}
              onChange={(f) => updateFocus(cropIndex, f)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => removeImageAt(cropIndex)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-400/40 text-red-400 hover:border-red-400 transition-all cursor-pointer"
              >
                Remove
              </button>
              <button
                onClick={() => setCropIndex(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkTextModal;
