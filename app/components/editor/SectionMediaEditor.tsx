"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { parseFocusStr } from "../FocusedImage";
import {
  sectionImageFrame,
  normalizeSectionLayout,
  SECTION_LAYOUT_LABELS,
  MAX_SECTION_IMAGES,
  layoutOptionsFor,
  type SectionLayout,
} from "@/app/utils/sectionImageAspect";
import { isVideoUrl } from "../parkpage/SectionBody";
import { VideoThumb, getVideoSnapshot } from "../VideoThumb";
import { R2Image } from "../R2Image";
import { variantUrl } from "@/app/lib/imageVariants";

/**
 * The pieces a review editor needs to attach gallery media to a section:
 * the gallery picker grid with its hover preview, the crop/position tool,
 * and a ready-made panel (image count, layout, slots, picker, crop popup)
 * for editors that keep one section open at a time. The park review editor
 * uses the grid and cropper with its own slot UI; the coaster text editor
 * uses the whole panel. Both store media the same way ("url|cx cy zoom").
 */

export const FOCUS_DEFAULT = "0.5 0.5 1";

/** Anything with a path can be picked; captions come from `description`. */
export type PickerImage = { id: number; path: string; title?: string | null; description?: string | null };

// ── Hover preview ─────────────────────────────────────────────────────────────

/** Large floating preview of the gallery tile under the pointer. */
export function HoverPreview({ path, rect, caption }: { path: string; rect: DOMRect; caption?: string }) {
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
        <>
          {/* Same request as the grid tile, so it is already cached and shows instantly… */}
          <R2Image src={path} alt="" fill sizes="(max-width: 640px) 25vw, 160px" quality={55} className="object-contain" />
          {/* …then the sharp 1200px variant fades in on top once loaded (its download starts on mouseenter). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={variantUrl(path, 1200)}
            alt=""
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain opacity-0 transition-opacity duration-150"
            onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
          />
        </>
      )}
      {caption && (
        <p className="absolute inset-x-0 bottom-0 px-3 py-2 bg-black/70 text-slate-100 text-xs leading-snug">{caption}</p>
      )}
    </div>
  );
}

// ── Picker tile ───────────────────────────────────────────────────────────────

type PickerTileProps = {
  img: PickerImage;
  selIndex: number;
  disabled: boolean;
  numbered: boolean;
  elsewhere?: string[];
  onSelect: (path: string) => void;
  onHover: (path: string, rect: DOMRect) => void;
  onLeave: () => void;
};

/** One gallery tile. Memoised so hovering (which changes state in the grid) does not re-render every tile.
 *  Images load eagerly so the whole grid is in place before scrolling (late arrivals repaint mid-scroll). */
export const PickerTile = React.memo(function PickerTile({ img, selIndex, disabled, numbered, elsewhere, onSelect, onHover, onLeave }: PickerTileProps) {
  const sel = selIndex !== -1;
  const dim = elsewhere && !sel ? "opacity-60" : "";
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(img.path)}
      onMouseEnter={(e) => onHover(img.path, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onLeave}
      aria-disabled={disabled}
      title={elsewhere ? `Already used in: ${elsewhere.join(", ")}` : img.title || undefined}
      className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-colors ${sel ? "border-blue-500 ring-2 ring-blue-500/30 cursor-pointer" : disabled ? "border-slate-800/60 opacity-30 cursor-not-allowed" : "border-slate-700 hover:border-slate-500 cursor-pointer"}`}
    >
      {isVideoUrl(img.path) ? (
        <>
          <VideoThumb src={img.path} className={`w-full h-full ${dim}`} />
          <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold uppercase tracking-wider pointer-events-none">
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Video
          </span>
        </>
      ) : (
        <R2Image src={img.path} alt="" fill loading="eager" sizes="(max-width: 640px) 25vw, 160px" quality={55} className={`object-cover ${dim}`} />
      )}
      {elsewhere && !sel && (
        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
          Used
        </span>
      )}
      {sel && (
        <div className="absolute inset-0 bg-blue-500/25 flex items-center justify-center">
          {numbered ? (
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
});

// ── Picker grid ───────────────────────────────────────────────────────────────

const HOVER_REST_MS = 180;      // pointer must rest this long before the big preview appears
const SCROLL_QUIET_MS = 300;    // and no preview while the list is being scrolled

export const ImagePickerGrid = React.memo(function ImagePickerGrid({
  galleryImages, selected, onSelect, maxSelection, usedIn = {}, replacing = false, captions = {},
}: {
  galleryImages: PickerImage[];
  selected: string[];
  onSelect: (path: string | null) => void;
  maxSelection: number;
  usedIn?: Record<string, string[]>;
  /** True while a specific slot is being (re)filled, so a full section still accepts a pick. */
  replacing?: boolean;
  captions?: Record<string, string>;
}) {
  const [hover, setHover] = useState<{ path: string; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollingUntil = useRef(0);

  // Scrolling drags tiles under a still pointer; that must not open previews.
  useEffect(() => {
    const onScroll = () => {
      scrollingUntil.current = Date.now() + SCROLL_QUIET_MS;
      if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
      setHover(h => (h ? null : h));
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const onHover = useCallback((path: string, rect: DOMRect) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (Date.now() < scrollingUntil.current) return;
    // Start fetching the original now, so it is mostly here by the time the preview opens.
    if (!isVideoUrl(path)) { const pre = new window.Image(); pre.decoding = "async"; pre.src = variantUrl(path, 1200); }
    hoverTimer.current = setTimeout(() => setHover({ path, rect }), HOVER_REST_MS);
  }, []);
  const onLeave = useCallback(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setHover(null);
  }, []);
  const pick = useCallback((path: string) => onSelect(path), [onSelect]);

  if (galleryImages.length === 0) {
    return <p className="text-sm text-slate-500">No gallery images available. Upload some in the gallery first.</p>;
  }
  const full = !replacing && maxSelection > 1 && selected.length >= maxSelection;
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 xl:grid-cols-6 gap-1.5" onMouseLeave={onLeave}>
      {hover && <HoverPreview path={hover.path} rect={hover.rect} caption={captions[hover.path]} />}
      <button type="button" onClick={() => onSelect(null)}
        className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${selected.length === 0
          ? "border-blue-500 bg-blue-500/20 text-blue-400"
          : "border-slate-700 text-slate-500 hover:border-slate-600"
          }`}>
        None
      </button>
      {galleryImages.map(img => {
        const selIndex = selected.indexOf(img.path);
        return (
          <PickerTile
            key={img.id}
            img={img}
            selIndex={selIndex}
            disabled={selIndex === -1 && full}
            numbered={maxSelection > 1}
            elsewhere={usedIn[img.path]}
            onSelect={pick}
            onHover={onHover}
            onLeave={onLeave}
          />
        );
      })}
    </div>
  );
});

// ── Cropper ───────────────────────────────────────────────────────────────────

export function SectionImageCropper({
  src, mobileAspect, desktopAspect, value, onChange, isVideo = false,
}: {
  src: string;
  mobileAspect: string;
  desktopAspect: string;
  value: string;
  onChange: (v: string) => void;
  /** Position a clip using its cached still frame (see VideoThumb). */
  isVideo?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const init = parseFocusStr(value);
  const [pos, setPos] = useState({ cx: init.cx, cy: init.cy });
  const posRef = useRef(pos);
  posRef.current = pos;
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    if (isVideo) {
      let alive = true;
      getVideoSnapshot(src).then((snap) => {
        if (!alive) return;
        const c = frameRef.current;
        if (c) { c.width = snap.width; c.height = snap.height; c.getContext("2d")?.drawImage(snap, 0, 0); }
        setDims({ w: snap.width, h: snap.height });
      }).catch(() => {});
      return () => { alive = false; };
    }
    const img = new window.Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src, isVideo]);

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
        className="relative mx-auto overflow-hidden rounded-xl bg-slate-950 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ aspectRatio: desktopAspect, width: `min(100%, calc(58vh * ${ratio(desktopAspect)}))` }}
      >
        {isVideo ? (
          <canvas
            ref={frameRef}
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            style={{ objectPosition: `${pos.cx * 100}% ${pos.cy * 100}%` }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            style={{ objectPosition: `${pos.cx * 100}% ${pos.cy * 100}%` }}
          />
        )}
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

// ── Media draft helpers ───────────────────────────────────────────────────────

export type MediaDraft = {
  images: string[];
  focuses: string[];
  layout: string | null;
  /** How many media slots the editor offers (1..MAX_SECTION_IMAGES). */
  imageCount: number;
};

/** Stored "url|focus,url|focus" list -> draft. */
export function mediaDraftFromStored(stored: string | null | undefined, layout: string | null | undefined): MediaDraft {
  const parsed = (stored || "").split(",").filter(Boolean).map((entry) => {
    const bar = entry.indexOf("|");
    return bar === -1 ? { url: entry, focus: FOCUS_DEFAULT } : { url: entry.slice(0, bar), focus: entry.slice(bar + 1) || FOCUS_DEFAULT };
  });
  return {
    images: parsed.map((p) => p.url),
    focuses: parsed.map((p) => p.focus),
    layout: layout ?? null,
    imageCount: Math.max(1, Math.min(MAX_SECTION_IMAGES, parsed.length)),
  };
}

/** Draft -> the "url|cx cy zoom" entries SectionBody renders. */
export const mediaEntriesOf = (d: MediaDraft) => d.images.map((u, i) => `${u}|${d.focuses[i] ?? FOCUS_DEFAULT}`);

/** Draft -> what is stored (null when there are no images). */
export const mediaStoredOf = (d: MediaDraft) => (d.images.length ? mediaEntriesOf(d).join(",") : null);

// ── Panel ─────────────────────────────────────────────────────────────────────

/**
 * Image count, layout, slots, picker and crop popup for one section. The
 * host owns the draft and passes it back; the panel never touches text.
 */
export function SectionMediaPanel({
  draft, onChange, galleryImages, captions = {}, usedIn = {}, defaultLayout = "left",
}: {
  draft: MediaDraft;
  onChange: (next: MediaDraft) => void;
  galleryImages: PickerImage[];
  captions?: Record<string, string>;
  usedIn?: Record<string, string[]>;
  defaultLayout?: SectionLayout;
}) {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [slotMenu, setSlotMenu] = useState<number | null>(null);

  const patch = useCallback((fn: (d: MediaDraft) => MediaDraft) => onChange(fn(draft)), [draft, onChange]);

  const frameCount = Math.max(1, draft.imageCount);
  const activeLayout = normalizeSectionLayout(draft.layout, frameCount, defaultLayout);
  const cropFrame = sectionImageFrame(draft.layout, frameCount, { defaultLayout: null });
  const layoutOptions: SectionLayout[] = layoutOptionsFor(draft.imageCount);
  const imageModes = Array.from({ length: MAX_SECTION_IMAGES }, (_, i) => i + 1);

  const setImageMode = (n: number) => {
    patch((c) => ({
      ...c,
      imageCount: n,
      images: c.images.slice(0, n),
      focuses: c.focuses.slice(0, n),
      layout: n !== 2 && c.layout === "double" ? "above" : c.layout,
    }));
    setActiveSlot(null);
    setSlotMenu(null);
  };
  const removeImageAt = (index: number) => {
    patch((c) => ({ ...c, images: c.images.filter((_, i) => i !== index), focuses: c.focuses.filter((_, i) => i !== index) }));
    setCropIndex(null);
    setSlotMenu(null);
  };
  const moveImage = (index: number, dir: -1 | 1) => patch((c) => {
    const j = index + dir;
    if (j < 0 || j >= c.images.length) return c;
    const images = [...c.images];
    const focuses = c.images.map((_, i) => c.focuses[i] ?? FOCUS_DEFAULT);
    [images[index], images[j]] = [images[j], images[index]];
    [focuses[index], focuses[j]] = [focuses[j], focuses[index]];
    return { ...c, images, focuses };
  });
  const updateFocus = (index: number, focus: string) => patch((c) => {
    const focuses = [...c.focuses];
    focuses[index] = focus;
    return { ...c, focuses };
  });

  const handlePick = (path: string | null) => {
    if (path === null) { patch((c) => ({ ...c, images: [], focuses: [] })); setActiveSlot(null); return; }
    const existing = draft.images.indexOf(path);
    if (activeSlot !== null) {
      const target = Math.min(activeSlot, draft.images.length);
      if (existing === -1) {
        patch((d) => {
          const images = [...d.images];
          const focuses = d.images.map((_, i) => d.focuses[i] ?? FOCUS_DEFAULT);
          images[target] = path;
          focuses[target] = FOCUS_DEFAULT;
          return { ...d, images, focuses };
        });
      } else if (existing !== target && target < draft.images.length) {
        patch((d) => {
          const images = [...d.images];
          const focuses = d.images.map((_, i) => d.focuses[i] ?? FOCUS_DEFAULT);
          [images[existing], images[target]] = [images[target], images[existing]];
          [focuses[existing], focuses[target]] = [focuses[target], focuses[existing]];
          return { ...d, images, focuses };
        });
      }
      setActiveSlot(null);
      setCropIndex(target);
      return;
    }
    if (existing !== -1) { setCropIndex(existing); return; }
    if (draft.imageCount > 1) {
      if (draft.images.length >= draft.imageCount) return;
      patch((d) => ({ ...d, images: [...d.images, path], focuses: [...d.focuses, FOCUS_DEFAULT] }));
      setCropIndex(draft.images.length);
    } else {
      patch((d) => ({ ...d, images: [path], focuses: [FOCUS_DEFAULT] }));
      setCropIndex(0);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-slate-300">Images <span className="text-slate-500 font-normal">(optional)</span></p>
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
            {imageModes.map((n) => (
              <button key={n} type="button" onClick={() => setImageMode(n)}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${draft.imageCount === n ? "bg-slate-700 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
                {n === 1 ? "1 image" : `${n} images`}
              </button>
            ))}
          </div>
        </div>
        {draft.images.length > 0 && (
          <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
            {layoutOptions.map((opt) => (
              <button key={opt} type="button" onClick={() => { patch((c) => ({ ...c, layout: opt })); if (opt.startsWith("tall") && draft.images[0]) setCropIndex(0); }}
                title={opt === "double" ? "Image, text, image" : undefined}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeLayout === opt ? "bg-slate-700 text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
                {SECTION_LAYOUT_LABELS[opt]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Slots: one box per image the section can hold. */}
      <div className="flex gap-3" style={{ "--slot-aspect": cropFrame.desktop } as React.CSSProperties}>
        {Array.from({ length: draft.imageCount }, (_, i) => {
          const url = draft.images[i];
          const nextFree = i === draft.images.length;
          const picking = activeSlot !== null && Math.min(activeSlot, draft.images.length) === i;
          const slotWrap = "flex-1 min-w-0 max-w-48";
          const boxCls = "relative w-full aspect-[var(--slot-aspect)] rounded-xl overflow-hidden";
          if (!url) {
            return nextFree ? (
              <button key={`empty-${i}`} type="button"
                onClick={() => { setActiveSlot(picking ? null : i); setSlotMenu(null); }}
                className={`${slotWrap} ${boxCls} border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${picking ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"}`}>
                <span className="text-2xl leading-none">+</span>
                {picking ? "Pick below" : draft.imageCount > 1 ? `Add image ${i + 1}` : "Add image"}
              </button>
            ) : (
              <div key={`empty-${i}`} className={`${slotWrap} ${boxCls} border-2 border-dashed border-slate-800 text-slate-700 flex items-center justify-center text-xs`}>
                {i + 1}
              </div>
            );
          }
          const focus = parseFocusStr(draft.focuses[i]);
          const video = isVideoUrl(url);
          const menuOpen = slotMenu === i;
          return (
            <div key={`slot-${i}`} className={`relative ${slotWrap}`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setSlotMenu(menuOpen ? null : i); setActiveSlot(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSlotMenu(menuOpen ? null : i); } }}
                title="Click for options"
                className={`${boxCls} group bg-slate-950 border-2 cursor-pointer transition-all ${picking ? "border-blue-500 ring-2 ring-blue-500/30" : menuOpen ? "border-blue-500" : "border-slate-700 hover:border-slate-500"}`}
              >
                {video ? (
                  <VideoThumb src={url} className="w-full h-full pointer-events-none" />
                ) : (
                  <R2Image src={url} alt="" fill sizes="160px" quality={50} draggable={false} className="object-cover pointer-events-none" style={{ objectPosition: `${focus.cx * 100}% ${focus.cy * 100}%` }} />
                )}
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold">{i + 1}</span>
                {picking && (
                  <span className="absolute inset-x-0 bottom-0 bg-blue-600/90 text-white text-[10px] font-bold text-center py-0.5">Replacing · pick below</span>
                )}
              </div>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[1005]" onClick={() => setSlotMenu(null)} />
                  <div className="absolute z-[1006] top-full left-0 mt-1.5 w-40 rounded-xl bg-slate-800 border border-slate-700 shadow-xl p-1 text-sm">
                    <button type="button" onClick={() => { setSlotMenu(null); setCropIndex(i); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Position</button>
                    <button type="button" onClick={() => { setSlotMenu(null); setActiveSlot(i); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Replace…</button>
                    {i > 0 && (
                      <button type="button" onClick={() => { setSlotMenu(null); moveImage(i, -1); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Move left</button>
                    )}
                    {i < draft.images.length - 1 && (
                      <button type="button" onClick={() => { setSlotMenu(null); moveImage(i, 1); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 cursor-pointer">Move right</button>
                    )}
                    <button type="button" onClick={() => removeImageAt(i)} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-red-900/40 text-red-400 cursor-pointer">Remove</button>
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
            {activeSlot < draft.images.length
              ? `Click a gallery image to replace image ${activeSlot + 1}.`
              : `Click a gallery image to add it${draft.imageCount > 1 ? ` as image ${Math.min(activeSlot, draft.images.length) + 1}` : ""}.`}
          </span>
          <button type="button" onClick={() => setActiveSlot(null)} className="font-semibold text-blue-300 hover:text-white cursor-pointer">Cancel</button>
        </div>
      )}

      <ImagePickerGrid
        galleryImages={galleryImages}
        selected={draft.images}
        onSelect={handlePick}
        maxSelection={draft.imageCount}
        usedIn={usedIn}
        replacing={activeSlot !== null}
        captions={captions}
      />
      <p className="text-xs text-slate-500">Hover a gallery image for a large preview. Click a slot above for position, replace, or remove.</p>

      {cropIndex !== null && draft.images[cropIndex] && (
        <div className="fixed inset-0 z-[1010] bg-black/70 flex items-center justify-center p-4" onClick={() => setCropIndex(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Position image {cropIndex + 1}</p>
              <button type="button" onClick={() => setCropIndex(null)} aria-label="Close"
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <SectionImageCropper
              key={`crop-${cropIndex}-${draft.images[cropIndex]}-${cropFrame.desktop}`}
              src={draft.images[cropIndex]}
              isVideo={isVideoUrl(draft.images[cropIndex])}
              mobileAspect={cropFrame.mobile}
              desktopAspect={cropFrame.desktop}
              value={draft.focuses[cropIndex] ?? FOCUS_DEFAULT}
              onChange={(f) => updateFocus(cropIndex, f)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => removeImageAt(cropIndex)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-400/40 text-red-400 hover:border-red-400 transition-all cursor-pointer">
                Remove
              </button>
              <button type="button" onClick={() => setCropIndex(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
