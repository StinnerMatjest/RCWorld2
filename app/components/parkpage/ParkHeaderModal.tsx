"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { getParkFlag, getRatingColor } from "@/app/utils/design";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import { parseFocusStr } from "@/app/components/FocusedImage";
import type { Visit } from "@/app/types";
import type { ParkRanks } from "@/app/utils/parkRanks";
import { HeroStats } from "./HeroStats";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GalleryImage { id: number; title: string; path: string; visit_id?: number; visit_date?: string; }
type Mode = "header" | "card";

export interface ParkHeaderModalProps {
  parkId: number;
  parkName: string;
  parkCountry?: string;
  parkCity?: string;
  parkContinent?: string;
  /** The visit whose header is edited. Its photos open first in the picker. */
  visitId?: number | null;
  visitDate?: string | null;
  /** How many visits the park has; the visit line is only shown when there are several. */
  visitCount?: number;
  /** Header shown for that visit today: its own, or the park's. */
  currentImagePath: string | null;
  currentHeaderFocus?: string;
  /** Its own framing for the tall phone hero; null = it follows the wide one. */
  currentHeaderFocusMobile?: string | null;
  /** The hero's own phone photo (set in the clean-up tool); the phone views show and frame that one. */
  currentImagePathMobile?: string | null;
  /** The park's own header, which the home card falls back to. */
  parkImagePath?: string | null;
  currentCardImagepath?: string | null;
  currentFocus?: string;
  /** Visit whose scores the home card shows, so the preview carries the real numbers. */
  cardRating?: Visit | null;
  /** The figures the hero draws over the photo, so the crop preview is the real thing. */
  heroOverall?: number | null;
  heroRanks?: ParkRanks | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Home card geometry (mirrors app/HomeClient.tsx) ──────────────────────────

/** Home cards are 500 CSS px tall on every screen (min-h-[500px]). */
const CARD_H = 500;
/** Narrowest home card (phones 320 CSS px wide): a tall photo framed on a wider card must still reach its bottom. */
const CARD_MIN_ASPECT = 250 / CARD_H;
/** Phone strip card width (HomeClient: w-[78vw] min-[400px]:w-[72vw] min-[480px]:w-[68vw] min-[560px]:w-[64vw] max-w-sm). */
function phoneCardWidth(vw: number): number {
  const f = vw < 400 ? 0.78 : vw < 480 ? 0.72 : vw < 560 ? 0.68 : 0.64;
  return Math.min(384, vw * f);
}
/** Our phones are 384 CSS px wide: a 299.5 px card. */
const PHONE_CARD_W = phoneCardWidth(384);
/** Phone park hero: full width at 4:5 (see ParkHero). */
const PHONE_HERO = { w: 384, h: 480 };

function scrollbarWidth(): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll";
  document.body.appendChild(probe);
  const w = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return w;
}

/**
 * Width of a home card on this screen. The home grid is px-6 with gap-4 and
 * 2/3/4/5 columns at md/lg/xl/2xl; the page always scrolls, so its scrollbar
 * takes its share of the width. Phones get the strip card.
 */
function homeCardWidth(): number {
  if (window.innerWidth < 768) return phoneCardWidth(window.innerWidth);
  const vw = window.innerWidth - scrollbarWidth();
  const cols = window.innerWidth >= 1536 ? 5 : window.innerWidth >= 1280 ? 4 : window.innerWidth >= 1024 ? 3 : 2;
  const col = (vw - 48 - 16 * (cols - 1)) / cols;
  return Math.min(400, col);
}

function visitDateLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── CropEditor ───────────────────────────────────────────────────────────────

export type CropEditorHandle = { getFocus: () => string; touched?: () => boolean };

export interface CropEditorProps {
  src: string;
  aspectRatio?: string;
  focusStr: string;
  onCommit: (f: string) => void;
  /** Called with the framing on every move (drag, pinch, wheel) and once the photo is placed. */
  onChange?: (f: string) => void;
  editorRef?: React.MutableRefObject<CropEditorHandle | null>;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  maxZoom?: number;
  /**
   * The narrowest frame the crop is also shown in (width / height, same
   * height): up and down the photo is kept covering that one too. A tall
   * photo is drawn shorter in a narrower frame, so a crop made on a wide
   * screen could otherwise leave a strip at its top or bottom there. Across,
   * a wider frame needs nothing: the pages stop the photo at the frame's edge.
   */
  minAspect?: number;
}

export function CropEditor({ src, aspectRatio, focusStr, onCommit, onChange, editorRef, className = "", style, children, maxZoom = 4, minAspect }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const commitRef = useRef(onCommit);
  const changeRef = useRef(onChange);
  const touchedRef = useRef(false);
  useEffect(() => { commitRef.current = onCommit; changeRef.current = onChange; });

  useEffect(() => {
    if (editorRef) editorRef.current = { getFocus: () => toFocusStr(), touched: () => touchedRef.current };
    return () => { if (editorRef) editorRef.current = null; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const nw = useRef(0);
  const nh = useRef(0);
  const tx = useRef(0);
  const ty = useRef(0);
  const zoom = useRef(1);

  function coverScale() {
    const c = containerRef.current;
    if (!c || !nw.current) return 1;
    return Math.max(c.clientWidth / nw.current, c.clientHeight / nh.current);
  }
  function totalScale() { return coverScale() * zoom.current; }
  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  function clampTxy(dtx: number, dty: number, s = totalScale()) {
    const c = containerRef.current;
    if (!c) return { tx: dtx, ty: dty };
    const mx = Math.max(0, (nw.current * s - c.clientWidth) / 2);
    let my = Math.max(0, (nh.current * s - c.clientHeight) / 2);
    if (minAspect && c.clientHeight * minAspect < c.clientWidth) {
      // Drawn height in the narrowest frame, and the share of it that may stay outside.
      const H = c.clientHeight;
      const dhN = nh.current * Math.max((H * minAspect) / nw.current, H / nh.current) * zoom.current;
      my = Math.min(my, Math.max(0, (dhN - H) / (2 * dhN)) * nh.current * s);
    }
    return { tx: clamp(dtx, -mx, mx), ty: clamp(dty, -my, my) };
  }

  // Drawn the way the pages draw it: the photo stops at the frame's edges, so a
  // crop made for another frame shape shows here as it shows there.
  function applyDOM(s = totalScale()) {
    const img = imgRef.current;
    const c = containerRef.current;
    if (!img || !c || !nw.current) return;
    const w = nw.current * s, h = nh.current * s;
    const mx = Math.max(0, (w - c.clientWidth) / 2), my = Math.max(0, (h - c.clientHeight) / 2);
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.transform = `translate(${(c.clientWidth - w) / 2 + clamp(tx.current, -mx, mx)}px,${(c.clientHeight - h) / 2 + clamp(ty.current, -my, my)}px)`;
  }

  function toFocusStr() {
    const c = containerRef.current;
    if (!c || !nw.current) return "0.5000 0.5000 1.000";
    const z = zoom.current;
    const ts = coverScale() * z;
    const cx = clamp(0.5 - tx.current / (nw.current * ts), 0, 1);
    const cy = clamp(0.5 - ty.current / (nh.current * ts), 0, 1);
    return `${cx.toFixed(4)} ${cy.toFixed(4)} ${z.toFixed(3)}`;
  }

  function fromFocusStr(f: string) {
    const parts = (f || "0.5 0.5 1").split(" ");
    const c = containerRef.current;
    if (!c) { tx.current = 0; ty.current = 0; return; }
    const ts = coverScale() * zoom.current;
    // Old "X% Y%" framings are drawn centred everywhere on the site (see
    // parseFocusStr); showing them offset here made the editor disagree with
    // the page it previews.
    let cx = 0.5, cy = 0.5;
    if (!parts[0]?.includes("%")) {
      cx = parseFloat(parts[0]); if (isNaN(cx)) cx = 0.5;
      cy = parseFloat(parts[1]); if (isNaN(cy)) cy = 0.5;
    }
    tx.current = (0.5 - clamp(cx, 0, 1)) * nw.current * ts;
    ty.current = (0.5 - clamp(cy, 0, 1)) * nh.current * ts;
  }

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    function init(el: HTMLImageElement) {
      if (cancelled) return;
      nw.current = el.naturalWidth;
      nh.current = el.naturalHeight;
      const parts = (focusStr || "0.5 0.5 1").split(" ");
      zoom.current = Math.max(1, parseFloat(parts[2] || "1") || 1);
      fromFocusStr(focusStr);
      applyDOM();
      changeRef.current?.(toFocusStr());
    }
    const tmp = new window.Image();
    tmp.onload = () => init(tmp);
    tmp.src = src;
    if (tmp.complete && tmp.naturalWidth > 0) init(tmp);
    return () => { cancelled = true; tmp.onload = null; };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ptrs = new Map<number, { x: number; y: number }>();
    let drag: { x0: number; y0: number; tx0: number; ty0: number } | null = null;
    let pinch: { d0: number; z0: number; mx0: number; my0: number; tx0: number; ty0: number } | null = null;
    let wheelTimer = 0;

    function startPinch() {
      const ids = Array.from(ptrs.keys());
      const a = ptrs.get(ids[0])!, b = ptrs.get(ids[1])!;
      pinch = {
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        z0: zoom.current,
        mx0: (a.x + b.x) / 2,
        my0: (a.y + b.y) / 2,
        tx0: tx.current,
        ty0: ty.current,
      };
      drag = null;
    }

    function onPointerDown(e: PointerEvent) {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el!.setPointerCapture(e.pointerId);
      if (ptrs.size === 1) {
        drag = { x0: e.clientX, y0: e.clientY, tx0: tx.current, ty0: ty.current };
      } else if (ptrs.size === 2) {
        startPinch();
      }
      e.preventDefault();
    }

    function onPointerMove(e: PointerEvent) {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinch && ptrs.size >= 2) {
        const ids = Array.from(ptrs.keys());
        const a = ptrs.get(ids[0])!, b = ptrs.get(ids[1])!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const newZ = clamp(pinch.z0 * (d / pinch.d0), 1, maxZoom);
        zoom.current = newZ;
        const { tx: ntx, ty: nty } = clampTxy(
          pinch.tx0 + (mx - pinch.mx0),
          pinch.ty0 + (my - pinch.my0),
        );
        tx.current = ntx;
        ty.current = nty;
        applyDOM();
        touchedRef.current = true;
        changeRef.current?.(toFocusStr());
      } else if (drag && ptrs.size === 1) {
        const { tx: ntx, ty: nty } = clampTxy(
          drag.tx0 + e.clientX - drag.x0,
          drag.ty0 + e.clientY - drag.y0,
        );
        tx.current = ntx;
        ty.current = nty;
        applyDOM();
        touchedRef.current = true;
        changeRef.current?.(toFocusStr());
      }
      e.preventDefault();
    }

    function onPointerUp(e: PointerEvent) {
      ptrs.delete(e.pointerId);
      if (ptrs.size === 0) {
        drag = null; pinch = null;
        commitRef.current(toFocusStr());
      } else if (ptrs.size === 1 && pinch) {
        pinch = null;
        commitRef.current(toFocusStr());
        const [, pos] = Array.from(ptrs.entries())[0];
        drag = { x0: pos.x, y0: pos.y, tx0: tx.current, ty0: ty.current };
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoom.current = clamp(zoom.current * (1 - e.deltaY * 0.001), 1, maxZoom);
      const { tx: ntx, ty: nty } = clampTxy(tx.current, ty.current);
      tx.current = ntx; ty.current = nty;
      applyDOM();
      touchedRef.current = true;
      changeRef.current?.(toFocusStr());
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => commitRef.current(toFocusStr()), 250);
    }

    el.addEventListener("pointerdown", onPointerDown, { passive: false });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(wheelTimer);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-900 cursor-grab active:cursor-grabbing select-none touch-none ${className}`}
      style={style ?? (aspectRatio ? { aspectRatio } : { flex: 1, minHeight: 0 })}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={imgRef} src={src} alt="" draggable={false}
          className="absolute top-0 left-0 max-w-none select-none pointer-events-none"
          style={{ willChange: "transform, width, height" }}
        />
      )}
      {children && <div className="absolute inset-0 pointer-events-none">{children}</div>}
    </div>
  );
}

// ─── Faces: what the page draws over the photo ────────────────────────────────

/**
 * What the park page draws over the header photo (see ParkHeader), at its
 * real size: the title, the place line and the gradient. Drawn inside a
 * ScaledLayer sized like the real page frame, so the text falls on the same
 * part of the photo as on the page, which is how a crop is judged.
 */
export function HeaderFace({ parkName, city, country, continent, phone, hint, overall = null, ranks = null }: {
  parkName: string; city?: string; country?: string; continent?: string; phone: boolean; hint?: boolean;
  overall?: number | null; ranks?: ParkRanks | null;
}) {
  return <>
    {/* The nav as it floats over the hero on the page: its top shade, the logo
        at the page's size and place, and on phones the search and menu icons,
        so the crop is judged with the logo on it. */}
    <div className={`absolute inset-x-0 top-0 bg-gradient-to-b from-[#020617]/45 via-[#020617]/15 to-transparent pointer-events-none ${phone ? "h-[104px]" : "h-[152px]"}`} />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/logos/logodark.svg" alt="" aria-hidden className={`absolute object-contain pointer-events-none ${phone ? "left-2 top-4 w-36 h-14" : "left-6 top-6 w-56 h-20"}`} />
    {!phone && (
      <div className="absolute right-6 top-6 h-20 flex items-center gap-7 text-[17px] text-slate-200 pointer-events-none" aria-hidden>
        <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        {["About", "Ratings", "Parks", "Lists", "Coasters", "Manufacturers"].map((t) => <span key={t}>{t}</span>)}
        <span className="text-fuchsia-400">Games</span>
      </div>
    )}
    {phone && (
      <div className="absolute right-4 top-8 flex items-center gap-6 text-white pointer-events-none" aria-hidden>
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </div>
    )}
    <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent ${phone ? "h-[70%]" : "h-[58%]"}`} />
    <div className={`absolute inset-x-0 bottom-0 ${phone ? "px-4 pb-6" : "px-20 pb-10"}`}>
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className={`font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] break-words ${phone ? "text-[2.75rem] leading-[0.95]" : "text-7xl"}`}>{parkName}</h1>
          <p className={`flex flex-wrap items-center gap-x-1.5 text-slate-300 drop-shadow ${phone ? "mt-2 text-sm" : "mt-3 text-lg"}`}>
            {city && <span>{city}</span>}
            {city && country && <span className="text-slate-500">·</span>}
            {country && <span>{country}</span>}
            {continent && <><span className="text-slate-500">·</span><span>{continent}</span></>}
          </p>
          {phone && <HeroStats overall={overall} ranks={ranks} />}
        </div>
        {!phone && <div className="flex-shrink-0"><HeroStats overall={overall} ranks={ranks} desktop /></div>}
      </div>
    </div>
    {hint && (
      <div className="absolute top-3 right-3 text-white/30 text-[9px] font-bold uppercase tracking-widest">
        Drag · scroll to zoom
      </div>
    )}
  </>;
}

const avg2 = (a: number, b: number) => (Number(a) + Number(b)) / 2;

/** The home card's text and gradients, copied from FullBleedRatingCard at real size. */
export function CardFace({ parkName, parkCountry, rating }: { parkName: string; parkCountry?: string; rating?: Visit | null }) {
  const overall = rating ? Number(rating.overall) : 8.5;
  const groups = rating
    ? [
        { emoji: "🎢", label: "Coasters", value: avg2(rating.bestCoaster, rating.coasterDepth) },
        { emoji: "🎡", label: "Rides", value: avg2(rating.waterRides, rating.flatridesAndDarkrides) },
        { emoji: "🏞️", label: "Park", value: avg2(rating.parkAppearance, rating.parkPracticality) },
        { emoji: "🍔", label: "Food", value: avg2(rating.food, rating.snacksAndDrinks) },
        { emoji: "📋", label: "Mgmt", value: avg2(rating.rideOperations, rating.parkManagement) },
      ]
    : [
        { emoji: "🎢", label: "Coasters", value: 8.5 },
        { emoji: "🎡", label: "Rides", value: 7.3 },
        { emoji: "🏞️", label: "Park", value: 9.0 },
        { emoji: "🍔", label: "Food", value: 7.8 },
        { emoji: "📋", label: "Mgmt", value: 8.3 },
      ];
  const date = rating?.date ? new Date(rating.date).toLocaleDateString("en-GB", { timeZone: "UTC" }) : null;
  return <>
    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent px-4 pt-4 pb-16">
      <div className="flex items-center gap-2">
        {parkCountry && <Image src={getParkFlag(parkCountry)} alt="" width={20} height={14} className="rounded-sm shrink-0" unoptimized />}
        <span className="text-white font-bold text-xl leading-tight drop-shadow-md">{parkName}</span>
      </div>
      {date && <p className="text-white/50 text-xs mt-1">{date}</p>}
    </div>
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-5 pt-16 pb-4 flex flex-col items-center gap-3">
      <span className={`text-[4rem] font-black tabular-nums leading-none drop-shadow-xl ${getRatingColor(overall)}`}>
        {overall.toFixed(2)}
      </span>
      <div className="w-full grid grid-cols-5 gap-1 mt-1">
        {groups.map(g => (
          <div key={g.label} className="flex flex-col items-center gap-0.5">
            <span className="text-base leading-none">{g.emoji}</span>
            <span className={`text-xs font-bold tabular-nums ${getRatingColor(g.value)}`}>{g.value.toFixed(2)}</span>
            <span className="text-[9px] uppercase tracking-wide text-white/40">{g.label}</span>
          </div>
        ))}
      </div>
    </div>
  </>;
}

/** Draws children at their real size (w × h CSS px), shrunk to fit a frame scaled by `scale`. */
export function ScaledLayer({ w, h, scale, children }: { w: number; h: number; scale: number; children: React.ReactNode }) {
  return (
    <div className="absolute left-0 top-0" style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
      {children}
    </div>
  );
}

/**
 * Read-only frame that places the photo with exactly the page's math (cover
 * the frame, times the zoom, focus point at the centre), at the page's real
 * frame size, then shrinks the whole thing by `scale` for display.
 */
function LiveFrame({ src, focus, w, h, scale, className = "", children }: {
  src: string; focus: string; w: number; h: number; scale: number; className?: string; children?: React.ReactNode;
}) {
  const [nat, setNat] = useState<{ src: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    let off = false;
    const im = new window.Image();
    const done = () => { if (!off && im.naturalWidth) setNat({ src, w: im.naturalWidth, h: im.naturalHeight }); };
    im.onload = done;
    im.src = src;
    if (im.complete) done();
    return () => { off = true; im.onload = null; };
  }, [src]);

  let imgStyle: React.CSSProperties = { visibility: "hidden" };
  if (nat && nat.src === src) {
    // The pages stop the photo at the frame's edges (FocusedImage, the home card).
    const { cx, cy, zoom } = parseFocusStr(focus);
    const cs = Math.max(w / nat.w, h / nat.h);
    const dw = nat.w * cs * zoom, dh = nat.h * cs * zoom;
    imgStyle = { width: dw, height: dh, left: Math.min(0, Math.max(w - dw, w / 2 - cx * dw)), top: Math.min(0, Math.max(h - dh, h / 2 - cy * dh)) };
  }
  return (
    <div className={`relative shrink-0 overflow-hidden bg-slate-900 ${className}`} style={{ width: w * scale, height: h * scale }}>
      <ScaledLayer w={w} h={h} scale={scale}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img src={src} alt="" draggable={false} className="absolute max-w-none select-none" style={imgStyle} />}
        {children}
      </ScaledLayer>
    </div>
  );
}

// ─── Gallery view ────────────────────────────────────────────────────────────

function GalleryView({
  images, loading, visitId, visitDate, isSelected, onClick, onBack,
  onUpload, uploadProgress,
}: {
  images: GalleryImage[];
  loading: boolean;
  visitId?: number | null;
  visitDate?: string | null;
  isSelected: (img: GalleryImage) => boolean;
  onClick: (img: GalleryImage) => void;
  onBack: () => void;
  onUpload?: (f: File) => void;
  uploadProgress: number | null;
}) {
  // This visit's photos first; the park's other visits are one tap away.
  const own = useMemo(() => (visitId == null ? images : images.filter(i => i.visit_id === visitId)), [images, visitId]);
  const otherGroups = useMemo(() => {
    if (visitId == null) return [];
    const groups: { visitId: number; date?: string; images: GalleryImage[] }[] = [];
    for (const img of images) {
      if (img.visit_id === visitId || img.visit_id == null) continue;
      let g = groups.find(x => x.visitId === img.visit_id);
      if (!g) { g = { visitId: img.visit_id, date: img.visit_date, images: [] }; groups.push(g); }
      g.images.push(img);
    }
    return groups;
  }, [images, visitId]);
  const othersCount = otherGroups.reduce((n, g) => n + g.images.length, 0);
  const allEarlier = !!visitDate && otherGroups.every(g => !g.date || Date.parse(g.date) < Date.parse(visitDate));
  const othersLabel = allEarlier ? "Earlier visits" : "Other visits";
  const [scope, setScope] = useState<"this" | "others">("this");

  const grid = (list: GalleryImage[]) => (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
      {list.map(img => {
        const sel = isSelected(img);
        return (
          <div key={img.id} onClick={() => onClick(img)}
            className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${sel ? "border-blue-500 ring-2 ring-blue-500/20" : "border-transparent hover:border-blue-400"
              }`}>
            <Image src={img.path} alt="" fill sizes="(max-width: 768px) 33vw, 320px" quality={60} className="object-cover" />
            {sel && <div className="absolute inset-0 bg-blue-600/25 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-blue-600 shadow flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>}
            {!sel && <div className="absolute inset-0 group-hover:bg-black/15 transition-colors" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to editor
        </button>
        {othersCount > 0 && (
          <div className="flex bg-slate-800 rounded-xl p-1 gap-0.5">
            {([
              { id: "this" as const, label: "This visit", n: own.length },
              { id: "others" as const, label: othersLabel, n: othersCount },
            ]).map(t => (
              <button key={t.id} onClick={() => setScope(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${scope === t.id
                  ? "bg-slate-700 text-blue-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
                  }`}>
                {t.label} <span className={scope === t.id ? "text-blue-300/60" : "text-slate-500"}>{t.n}</span>
              </button>
            ))}
          </div>
        )}
        {onUpload && (
          <label className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-bold transition-all relative overflow-hidden ${uploadProgress !== null
              ? "border-blue-400 text-blue-400"
              : "border-slate-700 text-slate-400 hover:border-blue-400 hover:text-blue-400"
            }`}>
            {uploadProgress !== null && (
              <div className="absolute inset-0 bg-blue-900/40 transition-all" style={{ width: `${uploadProgress}%` }} />
            )}
            <input type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} disabled={uploadProgress !== null} />
            <svg className="w-3.5 h-3.5 relative z-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 12l-4-4-4 4M12 8v8" />
            </svg>
            <span className="relative z-10">{uploadProgress !== null ? `${uploadProgress}%` : "Upload"}</span>
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {scope === "this" ? (
            own.length > 0 ? grid(own) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-slate-400">No photos from this visit yet.</p>
                {othersCount > 0 && (
                  <button onClick={() => setScope("others")}
                    className="text-sm font-bold text-blue-400 hover:text-blue-300 cursor-pointer">
                    Show {othersLabel.toLowerCase()}
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="space-y-5">
              {otherGroups.map(g => (
                <section key={g.visitId}>
                  <p className="mb-2 text-xs font-semibold text-slate-400">{visitDateLabel(g.date) ?? "Visit"}</p>
                  {grid(g.images)}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const ParkHeaderModal: React.FC<ParkHeaderModalProps> = ({
  parkId, parkName, parkCountry, parkCity, parkContinent,
  visitId, visitDate, visitCount = 1,
  currentImagePath, currentHeaderFocus, currentHeaderFocusMobile = null, currentImagePathMobile = null, parkImagePath,
  currentCardImagepath, currentFocus, cardRating, heroOverall = null, heroRanks = null,
  onClose, onSuccess,
}) => {
  useScrollLock();
  const [mode, setMode] = useState<Mode>("header");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const headerEditorRef = useRef<CropEditorHandle | null>(null);
  const tallEditorRef = useRef<CropEditorHandle | null>(null);
  const cardEditorRef = useRef<CropEditorHandle | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // What is stored now; a tab is "changed" when its values differ from this.
  const initial = useRef({
    headerPath: currentImagePath ?? "",
    headerFocus: currentHeaderFocus ?? "0.5 0.5 1",
    headerFocusMobile: currentHeaderFocusMobile ?? null,
    cardPath: currentCardImagepath ?? null,
    cardFocus: currentFocus ?? "0.5 0.5 1",
  }).current;
  const [headerPath, setHeaderPath] = useState(initial.headerPath);
  const [headerFocus, setHeaderFocus] = useState(initial.headerFocus);
  // The tall phone hero's own framing; null while it follows the wide one.
  const [headerFocusMobile, setHeaderFocusMobile] = useState<string | null>(initial.headerFocusMobile);
  const [cardPath, setCardPath] = useState<string | null>(initial.cardPath);
  const [cardFocus, setCardFocus] = useState(initial.cardFocus);
  // Follow the drag live in the phone previews.
  const [liveHeaderFocus, setLiveHeaderFocus] = useState(initial.headerFocus);
  const [liveCardFocus, setLiveCardFocus] = useState(initial.cardFocus);
  const rafRef = useRef(0);
  const live = (set: (f: string) => void) => (f: string) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => set(f));
  };
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // The home card shows its own photo, or else the park header.
  const parkHeader = parkImagePath ?? initial.headerPath;
  const effectiveCardPath = cardPath ?? parkHeader;

  const focusNow = (ref: React.MutableRefObject<CropEditorHandle | null>, committed: string) =>
    ref.current?.touched?.() ? ref.current.getFocus() : committed;
  const headerChanged = headerPath !== initial.headerPath || headerFocus !== initial.headerFocus || headerFocusMobile !== initial.headerFocusMobile;
  const cardChanged = cardPath !== initial.cardPath || cardFocus !== initial.cardFocus;

  // Card frame: the home card exactly as this screen draws it, shrunk only if
  // the modal is too short to show it at its real size. It is framed on the
  // phone card: this phone's own, or ours on a bigger screen.
  const [cardW, setCardW] = useState(360);
  const phoneCardW = isMobile ? cardW : PHONE_CARD_W;
  // The page header is the full viewport width; its height is the aspect for
  // the breakpoint (4:5, 16:9 from 640, 21:9 from 1024) capped at 82vh / 68vh,
  // exactly as .park-hero-frame and ParkHero's max-h classes size it. The editor
  // takes that shape, so the crop is judged in the frame this screen shows.
  const [pageW, setPageW] = useState(1920);
  const [pageH, setPageH] = useState(1920 * 9 / 21);
  const pageFrameH = (w: number, h: number) =>
    w >= 1024 ? Math.min(w * 9 / 21, h * 0.68) : w >= 640 ? Math.min(w * 9 / 16, h * 0.82) : Math.min(w * 5 / 4, h * 0.82);
  // Below 640 px the page hero is the tall phone frame, so the editor edits the tall framing.
  const editsTall = pageW < 640;
  // Phones show the hero's own phone photo when it has one: the phone views frame that photo.
  const phonePhoto = currentImagePathMobile && currentImagePathMobile !== headerPath ? currentImagePathMobile : null;
  const headerWrapRef = useRef<HTMLDivElement>(null);
  const [headerFrameW, setHeaderFrameW] = useState(0);
  // Follow the frame's real width: on phones it widens once the phone layout kicks in.
  useLayoutEffect(() => {
    const el = headerWrapRef.current;
    if (!el) return;
    const update = () => setHeaderFrameW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, galleryOpen]);
  const cardAreaRef = useRef<HTMLDivElement>(null);
  const [cardScale, setCardScale] = useState(1);
  useLayoutEffect(() => {
    const measure = () => {
      setCardW(homeCardWidth());
      setPageW(window.innerWidth);
      setPageH(pageFrameH(window.innerWidth, window.innerHeight));
      const el = cardAreaRef.current;
      if (!el) return;
      const room = el.clientHeight - 140; // caption + buttons + padding
      setCardScale(Math.max(0.4, Math.min(1, room / CARD_H)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mode, galleryOpen]);

  useEffect(() => {
    fetch(`/api/park/${parkId}/gallery`)
      .then(r => r.json())
      .then(d => { setImages(d.gallery || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [parkId]);

  function handleGalleryClick(img: GalleryImage) {
    if (mode === "header") {
      setHeaderPath(img.path);
      if (!currentImagePathMobile) setHeaderFocusMobile(null); // a tall framing belongs to the old photo (not to a phone photo of its own)
    } else {
      setCardPath(img.path === parkHeader ? null : img.path);
    }
    setGalleryOpen(false);
  }

  function isSelected(img: GalleryImage) {
    if (mode === "header") return img.path === headerPath;
    return img.path === effectiveCardPath;
  }

  function handleUpload(file: File) {
    setUploadProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", `${parkName}-header`);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { imagePath } = JSON.parse(xhr.responseText);
        setHeaderPath(imagePath);
        if (!currentImagePathMobile) setHeaderFocusMobile(null);
        setImages(prev => [{ id: Date.now(), title: `${parkName}-header`, path: imagePath, visit_id: visitId ?? undefined, visit_date: visitDate ?? undefined }, ...prev]);
        setGalleryOpen(false);
      } else alert("Upload failed.");
      setUploadProgress(null);
    });
    xhr.open("POST", "/api/upload");
    xhr.send(fd);
  }

  // One save for everything changed, whichever tab is open: switching tabs
  // used to drop the other tab's unsaved photo.
  async function save() {
    // On a phone the main editor holds the tall framing; on wider screens the wide one,
    // with the tall one in its own editor beside it (or following the wide one).
    const hFocus = editsTall ? headerFocus : focusNow(headerEditorRef, headerFocus);
    const tFocus = editsTall
      ? (headerEditorRef.current?.touched?.() ? headerEditorRef.current.getFocus() : headerFocusMobile)
      : headerFocusMobile === null ? null : focusNow(tallEditorRef, headerFocusMobile);
    const cFocus = focusNow(cardEditorRef, cardFocus);
    const doHeader = headerPath !== initial.headerPath || hFocus !== initial.headerFocus || tFocus !== initial.headerFocusMobile;
    const doCard = cardPath !== initial.cardPath || cFocus !== initial.cardFocus;
    if (!doHeader && !doCard) { onClose(); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (doHeader) {
        const res = visitId
          ? await fetch(`/api/visits/${visitId}/header`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imagepath: headerPath, focus: hFocus, focusMobile: tFocus }),
            })
          : await fetch(`/api/park/${parkId}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imagepath: headerPath, headerFocus: hFocus, headerFocusMobile: tFocus,
                // A card without its own photo follows the header; the old crop was for the old photo.
                ...(!doCard && cardPath === null && headerPath !== parkHeader ? { imageFocus: "0.5 0.5 1" } : {}),
              }),
            });
        if (!res.ok) throw new Error(`Header not saved (${res.status})`);
      }
      if (doCard) {
        const res = await fetch(`/api/park/${parkId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardImagepath: cardPath, imageFocus: cFocus }),
        });
        if (!res.ok) throw new Error(`Card not saved (${res.status})`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = visitDateLabel(visitDate);
  const changedDot = <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-400 align-middle" />;
  const saveRow = (extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-3 w-full">
      <button onClick={() => setGalleryOpen(true)}
        className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-700 text-slate-300 hover:border-blue-400 hover:text-blue-400 transition-all cursor-pointer">
        Change image
      </button>
      {extra}
      <button onClick={save} disabled={saving || (!headerChanged && !cardChanged && !headerEditorRef.current?.touched?.() && !tallEditorRef.current?.touched?.() && !cardEditorRef.current?.touched?.())}
        className="flex-1 min-w-[10rem] py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors cursor-pointer disabled:cursor-default">
        {saving ? "Saving…" : headerChanged && cardChanged ? "Save header and card" : "Save changes"}
      </button>
      {saveError && <p className="basis-full text-xs text-red-400">{saveError}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/80 backdrop-blur-sm pt-3 md:pt-0 md:p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-7xl h-[97dvh] md:h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
          {galleryOpen ? (
            <span className="text-sm font-bold text-slate-400">Select image</span>
          ) : (
            <>
              <span className="font-bold text-sm text-white truncate hidden sm:block">{parkName}</span>
              <div className="flex bg-slate-800 rounded-xl p-1 gap-0.5">
                {([
                  { id: "header" as Mode, label: "🏔️ Header", changed: headerChanged },
                  { id: "card" as Mode, label: "📍 Card", changed: cardChanged },
                ] as const).map(m => (
                  <button key={m.id} onClick={() => { setMode(m.id); setGalleryOpen(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${mode === m.id
                        ? "bg-slate-700 text-blue-400 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                      }`}>{m.label}{m.changed && changedDot}</button>
                ))}
              </div>
            </>
          )}
          <button onClick={galleryOpen ? () => setGalleryOpen(false) : onClose}
            className="ml-auto p-2 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Gallery replaces entire content area */}
        {galleryOpen ? (
          <GalleryView
            images={images} loading={loading}
            visitId={visitId} visitDate={visitDate}
            isSelected={isSelected} onClick={handleGalleryClick}
            onBack={() => setGalleryOpen(false)}
            onUpload={mode === "header" ? handleUpload : undefined}
            uploadProgress={uploadProgress}
          />
        ) : (
          <>
            {/* ── HEADER ── */}
            {mode === "header" && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="min-h-full flex flex-col justify-center gap-4 p-6">
                  {visitCount > 1 && dateLabel && (
                    <p className="text-xs text-slate-400">Header for the {dateLabel} visit</p>
                  )}
                  {/* On phones the frame runs edge to edge like the page itself. */}
                  <div ref={headerWrapRef} className={isMobile ? "-mx-6" : ""}>
                    <CropEditor
                      key={`h-${headerPath}-${isMobile}-${editsTall}-${phonePhoto ?? ""}`}
                      editorRef={headerEditorRef}
                      src={editsTall && phonePhoto ? phonePhoto : headerPath}
                      aspectRatio={`${Math.round(pageW)}/${Math.round(pageH)}`}
                      focusStr={editsTall ? headerFocusMobile ?? (phonePhoto ? "0.5 0.5 1" : headerFocus) : headerFocus}
                      onCommit={editsTall ? setHeaderFocusMobile : setHeaderFocus}
                      onChange={editsTall ? undefined : live(setLiveHeaderFocus)}
                      className={isMobile ? "w-full" : "w-full rounded-2xl"}
                    >
                      {headerFrameW > 0 && (
                        <ScaledLayer w={pageW} h={pageH} scale={headerFrameW / pageW}>
                          <HeaderFace parkName={parkName} city={parkCity} country={parkCountry} continent={parkContinent} phone={isMobile} hint overall={heroOverall} ranks={heroRanks} />
                        </ScaledLayer>
                      )}
                    </CropEditor>
                  </div>
                  {isMobile && editsTall && (
                    <p className="text-xs text-slate-500 -mt-2 px-1">The tall phone framing. The wide desktop framing is set on a computer or in the clean-up tool.</p>
                  )}
                  {!isMobile && (
                    <p className="text-xs text-slate-500 -mt-3">Header on this screen, {Math.round(pageW)} × {Math.round(pageH)}. Phones below.</p>
                  )}
                  {!isMobile && !editsTall && (
                    <figure className="flex flex-col gap-1.5">
                      {/* The tall phone hero: follows the wide framing until it gets its own (always its own on a phone photo). */}
                      {headerFocusMobile === null && !phonePhoto ? (
                        <LiveFrame src={headerPath} focus={liveHeaderFocus} w={PHONE_HERO.w} h={PHONE_HERO.h} scale={1} className="rounded-xl">
                          <HeaderFace parkName={parkName} city={parkCity} country={parkCountry} continent={parkContinent} phone overall={heroOverall} ranks={heroRanks} />
                        </LiveFrame>
                      ) : (
                        <CropEditor
                          key={`t-${phonePhoto ?? headerPath}`}
                          editorRef={tallEditorRef}
                          src={phonePhoto ?? headerPath}
                          focusStr={headerFocusMobile ?? "0.5 0.5 1"}
                          onCommit={setHeaderFocusMobile}
                          className="rounded-xl"
                          style={{ width: PHONE_HERO.w, height: PHONE_HERO.h }}
                        >
                          <ScaledLayer w={PHONE_HERO.w} h={PHONE_HERO.h} scale={1}>
                            <HeaderFace parkName={parkName} city={parkCity} country={parkCountry} continent={parkContinent} phone overall={heroOverall} ranks={heroRanks} />
                          </ScaledLayer>
                        </CropEditor>
                      )}
                      <figcaption className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                        <span>Phone · {phonePhoto ? "its own photo (change it in the clean-up tool), drag to adjust" : headerFocusMobile === null ? "follows the wide framing" : "its own framing, drag to adjust"}</span>
                        {!phonePhoto && (
                          <button type="button" onClick={() => setHeaderFocusMobile(headerFocusMobile === null ? liveHeaderFocus : null)}
                            className="font-bold text-blue-400 hover:text-blue-300 cursor-pointer">
                            {headerFocusMobile === null ? "Frame the phone separately" : "Follow the wide framing"}
                          </button>
                        )}
                      </figcaption>
                    </figure>
                  )}
                  {saveRow()}
                </div>
              </div>
            )}

            {/* ── CARD ── */}
            {mode === "card" && (
              <div ref={cardAreaRef} className="flex-1 min-h-0 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center gap-5 p-6">
                  <div className="flex items-end justify-center gap-8">
                    {/* The card is framed on the phone card; wider cards show a little more
                        of the photo and stop it at their edges (HomeClient). */}
                    <figure className="flex flex-col items-center gap-2">
                      <CropEditor
                        key={`c-${effectiveCardPath}-${Math.round(phoneCardW)}`}
                        editorRef={cardEditorRef}
                        src={effectiveCardPath}
                        focusStr={cardFocus}
                        onCommit={setCardFocus}
                        onChange={live(setLiveCardFocus)}
                        minAspect={CARD_MIN_ASPECT}
                        className="rounded-2xl shadow-md"
                        style={{ width: phoneCardW * cardScale, height: CARD_H * cardScale }}
                      >
                        <ScaledLayer w={phoneCardW} h={CARD_H} scale={cardScale}>
                          <CardFace parkName={parkName} parkCountry={parkCountry} rating={cardRating} />
                        </ScaledLayer>
                      </CropEditor>
                      <figcaption className="text-xs text-slate-500">Phone</figcaption>
                    </figure>
                    {!isMobile && (
                      <figure className="flex flex-col items-center gap-2">
                        <LiveFrame src={effectiveCardPath} focus={liveCardFocus} w={cardW} h={CARD_H} scale={cardScale} className="rounded-2xl shadow-md">
                          <CardFace parkName={parkName} parkCountry={parkCountry} rating={cardRating} />
                        </LiveFrame>
                        <figcaption className="text-xs text-slate-500">Home page on this screen</figcaption>
                      </figure>
                    )}
                  </div>
                  <div className="w-full max-w-2xl">
                    {saveRow(cardPath && (
                      <button onClick={() => setCardPath(null)}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-400/40 text-red-400 hover:border-red-400 transition-all cursor-pointer">
                        Reset to header
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ParkHeaderModal;
