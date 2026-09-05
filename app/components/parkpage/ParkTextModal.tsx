"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { parseFocusStr, splitMedia } from "../FocusedImage";
import {
  sectionImageFrame,
  normalizeSectionLayout,
  usesLegacyRow,
  SECTION_LAYOUT_LABELS,
  MAX_SECTION_IMAGES,
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
 * selected section. Right (desktop): the whole review rendered as the park page
 * will show it, scrolled to the section being edited and updating as you type.
 * Ctrl+S saves the sections you changed.
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
  /** How many media slots the editor offers for this section (1..MAX_SECTION_IMAGES). */
  imageCount: number;
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
      imageCount: Math.max(1, Math.min(MAX_SECTION_IMAGES, parsed.length)),
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

/** Large floating preview of the gallery tile under the pointer. */
function HoverPreview({ path, rect }: { path: string; rect: DOMRect }) {
  const W = 460, H = 320, gap = 14;
  if (typeof window === "undefined") return null;
  const fitsRight = rect.right + gap + W <= window.innerWidth - 8;
  const left = fitsRight ? rect.right + gap : Math.max(8, rect.left - gap - W);
  const top = Math.min(Math.max(8, rect.top + rect.height / 2 - H / 2), window.innerHeight - H - 8);
  return (
    <div
      className="fixed z-[1020] pointer-events-none rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shadow-2xl"
      style={{ left, top, width: W, height: H }}
    >
      {isVideoUrl(path) ? (
        <video src={path} className="w-full h-full object-contain" muted autoPlay loop playsInline />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={path} alt="" className="w-full h-full object-contain" />
      )}
    </div>
  );
}

const ImagePickerGrid = React.memo(function ImagePickerGrid({
  galleryImages, selected, onSelect, maxSelection, usedIn, replacing = false,
}: {
  galleryImages: GalleryImage[];
  selected: string[];
  onSelect: (path: string | null) => void;
  maxSelection: number;
  usedIn: Record<string, string[]>;
  /** True while a specific slot is being (re)filled, so a full section still accepts a pick. */
  replacing?: boolean;
}) {
  const [hover, setHover] = useState<{ path: string; rect: DOMRect } | null>(null);
  if (galleryImages.length === 0) {
    return <p className="text-sm text-slate-500">No gallery images available. Upload some in the gallery first.</p>;
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 xl:grid-cols-6 gap-1.5" onMouseLeave={() => setHover(null)}>
      {hover && <HoverPreview path={hover.path} rect={hover.rect} />}
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
        const disabled = !sel && !replacing && maxSelection > 1 && selected.length >= maxSelection;
        const elsewhere = usedIn[img.path];

        return (
          <button key={img.id} onClick={() => !disabled && onSelect(img.path)}
            onMouseEnter={(e) => setHover({ path: img.path, rect: e.currentTarget.getBoundingClientRect() })}
            onMouseLeave={() => setHover(null)}
            aria-disabled={disabled}
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
                {maxSelection > 1 ? (
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
  cat, draft, rating, asVisitor, legacyRight, active, onMediaClick,
}: {
  cat: Category;
  draft: Draft;
  rating: Rating;
  asVisitor: boolean;
  legacyRight: boolean;
  /** True for the section currently open in the editor. */
  active: boolean;
  onMediaClick: (url: string, index: number) => void;
}) {
  const media = mediaEntries(draft);
  const empty = !draft.text.trim() && media.length === 0;
  const isAdminMode = !asVisitor;
  const emptyMsg = (
    <p className="text-slate-600 italic">
      {active ? "Nothing to preview yet. Start writing on the left." : "Nothing written yet."}
    </p>
  );

  if (cat === "description") {
    return (
      <div>
        <h2 className="text-4xl font-bold text-white tracking-tight">Introduction</h2>
        <div className="w-12 h-1 bg-brand rounded-full mt-3 mb-4" />
        {empty ? emptyMsg : (
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
      {empty ? emptyMsg : (
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
  // Slot the next gallery pick goes into (null = default behaviour: fill the next free slot).
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [slotMenu, setSlotMenu] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
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
  // In multi-image mode, crop against the multi-image frame even while fewer are
  // picked, so image 1 is not positioned against a shape it will not get.
  const frameCount = Math.max(1, cur.imageCount);
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

  const setImageMode = useCallback((n: number) => {
    patch(c => ({
      ...c,
      imageCount: n,
      images: c.images.slice(0, n),
      focuses: c.focuses.slice(0, n),
      layout: n !== 2 && c.layout === "double" ? "above" : c.layout,
    }));
    setActiveSlot(null);
    setSlotMenu(null);
  }, [patch]);

  const removeImageAt = useCallback((index: number) => {
    patch(c => ({
      ...c,
      images: c.images.filter((_, i) => i !== index),
      focuses: c.focuses.filter((_, i) => i !== index),
    }));
    setCropIndex(null);
    setSlotMenu(null);
  }, [patch]);

  /** Drop image `from` into position `to`, shifting the others along (crops travel with images). */
  const reorderImage = useCallback((from: number, to: number) => patch(c => {
    if (from === to || from < 0 || to < 0 || from >= c.images.length || to >= c.images.length) return c;
    const images = [...c.images];
    const focuses = c.images.map((_, i) => c.focuses[i] ?? FOCUS_DEFAULT);
    const [img] = images.splice(from, 1);
    const [foc] = focuses.splice(from, 1);
    images.splice(to, 0, img);
    focuses.splice(to, 0, foc);
    return { ...c, images, focuses };
  }), [patch]);

  /** Move image `index` one step earlier (-1) or later (+1), keeping its crop with it. */
  const moveImage = useCallback((index: number, dir: -1 | 1) => patch(c => {
    const j = index + dir;
    if (j < 0 || j >= c.images.length) return c;
    const images = [...c.images];
    const focuses = c.images.map((_, i) => c.focuses[i] ?? FOCUS_DEFAULT);
    [images[index], images[j]] = [images[j], images[index]];
    [focuses[index], focuses[j]] = [focuses[j], focuses[index]];
    return { ...c, images, focuses };
  }), [patch]);

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const handlePick = useCallback((path: string | null) => {
    if (path === null) { patch(c => ({ ...c, images: [], focuses: [] })); setActiveSlot(null); return; }
    const c = draftsRef.current[selectedCat];
    const existing = c.images.indexOf(path);

    // A slot was chosen explicitly: put the pick there (replace, or append when the slot is empty).
    if (activeSlot !== null) {
      const target = Math.min(activeSlot, c.images.length);
      if (existing !== -1) {
        if (existing !== target && target < c.images.length) {
          patch(d => {
            const images = [...d.images];
            const focuses = d.images.map((_, i) => d.focuses[i] ?? FOCUS_DEFAULT);
            [images[existing], images[target]] = [images[target], images[existing]];
            [focuses[existing], focuses[target]] = [focuses[target], focuses[existing]];
            return { ...d, images, focuses };
          });
        }
      } else {
        patch(d => {
          const images = [...d.images];
          const focuses = d.images.map((_, i) => d.focuses[i] ?? FOCUS_DEFAULT);
          images[target] = path;
          focuses[target] = FOCUS_DEFAULT;
          return { ...d, images, focuses };
        });
      }
      setActiveSlot(null);
      setCropIndex(isVideoUrl(path) ? null : target);
      return;
    }

    if (existing !== -1) {
      if (isVideoUrl(path)) removeImageAt(existing);
      else setCropIndex(existing);
      return;
    }
    if (c.imageCount > 1) {
      if (c.images.length >= c.imageCount) return;
      patch(d => ({ ...d, images: [...d.images, path], focuses: [...d.focuses, FOCUS_DEFAULT] }));
      if (!isVideoUrl(path)) setCropIndex(c.images.length);
    } else {
      patch(d => ({ ...d, images: [path], focuses: [FOCUS_DEFAULT] }));
      if (!isVideoUrl(path)) setCropIndex(0);
    }
  }, [selectedCat, patch, removeImageAt, activeSlot]);

  const openCropFor = useCallback((cat: Category, index: number) => {
    const c = draftsRef.current[cat];
    setSelectedCat(cat);
    setCropIndex(c.images[index] && !isVideoUrl(c.images[index]) ? index : null);
  }, []);

  // The preview shows every section; keep the one being edited in view.
  const sectionRefs = useRef<Partial<Record<Category, HTMLDivElement | null>>>({});
  useEffect(() => {
    const el = sectionRefs.current[selectedCat];
    if (!el) return;
    const id = requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(id);
  }, [selectedCat, mobileView]);

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
      const layout = d.layout === "double" && d.images.length !== 2 ? "above" : d.layout;
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

  const layoutOptions: SectionLayout[] = cur.imageCount === 2
    ? ["left", "right", "above", "below", "double"]
    : ["left", "right", "above", "below"];
  const imageModes = Array.from({ length: MAX_SECTION_IMAGES }, (_, i) => i + 1);

  const sectionButton = (cat: Category, compact: boolean) => {
    const d = drafts[cat];
    const filled = !!(d.text || d.images.length > 0);
    const dirty = dirtySet.has(cat);
    const active = selectedCat === cat;
    const dot = dirty ? "bg-amber-400" : filled ? "bg-green-500" : "bg-slate-600";
    if (compact) {
      return (
        <button key={cat} onClick={() => { setSelectedCat(cat); setCropIndex(null); setActiveSlot(null); setSlotMenu(null); }}
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
      <button key={cat} onClick={() => { setSelectedCat(cat); setCropIndex(null); setActiveSlot(null); setSlotMenu(null); }}
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
                      {imageModes.map(n => (
                        <button key={n} onClick={() => setImageMode(n)}
                          className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${cur.imageCount === n ? "bg-slate-700 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
                          {n === 1 ? "1 image" : `${n} images`}
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


                {/* Slots: one box per image the section can hold. Drag filled boxes to reorder. */}
                <div className="flex gap-3">
                  {Array.from({ length: cur.imageCount }, (_, i) => {
                    const url = cur.images[i];
                    const nextFree = i === cur.images.length;
                    const picking = activeSlot !== null && Math.min(activeSlot, cur.images.length) === i;
                    const slotWrap = "flex-1 min-w-0 max-w-48";
                    const boxCls = "relative w-full aspect-[3/2] rounded-xl overflow-hidden";
                    if (!url) {
                      return nextFree ? (
                        <button key={`empty-${i}`} type="button"
                          onClick={() => { setActiveSlot(picking ? null : i); setSlotMenu(null); }}
                          className={`${slotWrap} ${boxCls} border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${picking ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"}`}>
                          <span className="text-2xl leading-none">+</span>
                          {picking ? "Pick below" : cur.imageCount > 1 ? `Add image ${i + 1}` : "Add image"}
                        </button>
                      ) : (
                        <div key={`empty-${i}`} className={`${slotWrap} ${boxCls} border-2 border-dashed border-slate-800 text-slate-700 flex items-center justify-center text-xs`}>
                          {i + 1}
                        </div>
                      );
                    }
                    const focus = parseFocusStr(cur.focuses[i]);
                    const video = isVideoUrl(url);
                    const menuOpen = slotMenu === i;
                    return (
                      <div key={`slot-${i}`} className={`relative ${slotWrap}`}>
                        <div
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(e) => { setDragFrom(i); setSlotMenu(null); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => setDragFrom(null)}
                          onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
                          onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) reorderImage(dragFrom, i); setDragFrom(null); }}
                          onClick={() => { setSlotMenu(menuOpen ? null : i); setActiveSlot(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSlotMenu(menuOpen ? null : i); } }}
                          title="Click for options · drag to reorder"
                          className={`${boxCls} group bg-slate-950 border-2 cursor-pointer transition-all ${picking ? "border-blue-500 ring-2 ring-blue-500/30" : menuOpen ? "border-blue-500" : dragFrom === i ? "border-slate-500 opacity-50" : "border-slate-700 hover:border-slate-500"}`}
                        >
                          {video ? (
                            <video src={url} className="w-full h-full object-cover pointer-events-none" muted playsInline preload="metadata" />
                          ) : (
                            <Image src={url} alt="" fill sizes="160px" quality={50} draggable={false} className="object-cover pointer-events-none" style={{ objectPosition: `${focus.cx * 100}% ${focus.cy * 100}%` }} />
                          )}
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold">{i + 1}</span>
                          {video && (
                            <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold uppercase tracking-wider">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                              Video
                            </span>
                          )}
                          {picking && (
                            <span className="absolute inset-x-0 bottom-0 bg-blue-600/90 text-white text-[10px] font-bold text-center py-0.5">Replacing · pick below</span>
                          )}
                        </div>
                        {menuOpen && (
                          <>
                            <div className="fixed inset-0 z-[1005]" onClick={() => setSlotMenu(null)} />
                            <div className="absolute z-[1006] top-full left-0 mt-1.5 w-40 rounded-xl bg-slate-800 border border-slate-700 shadow-xl p-1 text-sm">
                              {!video && (
                                <button onClick={() => { setSlotMenu(null); setCropIndex(i); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Position</button>
                              )}
                              <button onClick={() => { setSlotMenu(null); setActiveSlot(i); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Replace…</button>
                              {i > 0 && (
                                <button onClick={() => { setSlotMenu(null); moveImage(i, -1); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Move left</button>
                              )}
                              {i < cur.images.length - 1 && (
                                <button onClick={() => { setSlotMenu(null); moveImage(i, 1); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Move right</button>
                              )}
                              <button onClick={() => removeImageAt(i)} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-red-900/40 text-red-400 cursor-pointer">Remove</button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {activeSlot !== null && (
                  <div className="flex items-center justify-between gap-3 text-xs bg-blue-900/20 border border-blue-800/40 text-blue-200 rounded-lg px-3 py-2">
                    <span>
                      {activeSlot < cur.images.length
                        ? `Click a gallery image to replace image ${activeSlot + 1}.`
                        : `Click a gallery image to add it${cur.imageCount > 1 ? ` as image ${Math.min(activeSlot, cur.images.length) + 1}` : ""}.`}
                    </span>
                    <button onClick={() => setActiveSlot(null)} className="font-semibold text-blue-300 hover:text-white cursor-pointer">Cancel</button>
                  </div>
                )}

                <ImagePickerGrid
                  galleryImages={galleryImages}
                  selected={cur.images}
                  onSelect={handlePick}
                  maxSelection={cur.imageCount}
                  usedIn={usedIn}
                  replacing={activeSlot !== null}
                />
                <p className="text-xs text-slate-500">Hover a gallery image for a large preview. Click a slot above for position, replace, or remove; drag slots to reorder. Videos play muted on the page and open with sound when clicked.</p>
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
            <div className="max-w-[900px] px-5 sm:px-8 py-8 space-y-10">
              {CATEGORIES.map(cat => {
                const active = cat === selectedCat;
                return (
                  <React.Fragment key={cat}>
                    {cat === CATEGORIES[1] && (
                      <h2 className="text-3xl font-semibold text-white pt-2">{parkName ? `${parkName} Review` : "Review"}</h2>
                    )}
                    <div
                      ref={el => { sectionRefs.current[cat] = el; }}
                      onClick={active ? undefined : () => setSelectedCat(cat)}
                      title={active ? undefined : `Click to edit ${LABELS[cat]}`}
                      className={`relative rounded-2xl scroll-mt-6 -mx-3 px-3 py-3 transition-[box-shadow,background-color] ${active
                        ? "ring-1 ring-blue-500/50 bg-blue-500/[0.05]"
                        : "cursor-pointer hover:ring-1 hover:ring-slate-600/70"}`}
                    >
                      {active && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                          Editing
                        </span>
                      )}
                      <SectionPreview
                        cat={cat}
                        draft={drafts[cat]}
                        rating={rating}
                        asVisitor={previewAsVisitor}
                        legacyRight={legacy[cat]}
                        active={active}
                        onMediaClick={(_url, i) => openCropFor(cat, i)}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
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
