"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { getParkFlag, getRatingColor } from "@/app/utils/design";
import { useScrollLock } from "@/app/hooks/useScrollLock";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GalleryImage { id: number; title: string; path: string; }
type CardCatKey = "coasters" | "rides" | "park" | "food" | "mgmt";
type CardImageEntry = { src: string; focus: string };
type CardImagesMap = Partial<Record<CardCatKey, CardImageEntry>>;
type Mode = "header" | "card" | "categories";

const CARD_CATS: { key: CardCatKey; emoji: string; label: string }[] = [
  { key: "coasters", emoji: "🎢", label: "Coasters" },
  { key: "rides",    emoji: "🎡", label: "Rides"    },
  { key: "park",     emoji: "🏞️", label: "Park"     },
  { key: "food",     emoji: "🍔", label: "Food"     },
  { key: "mgmt",     emoji: "📋", label: "Mgmt"     },
];

const CARD_PREVIEW_GROUPS = [
  { emoji: "🎢", label: "Coasters", value: "8.5" },
  { emoji: "🎡", label: "Rides",    value: "7.3" },
  { emoji: "🏞️", label: "Park",     value: "9.0" },
  { emoji: "🍔", label: "Food",     value: "7.8" },
  { emoji: "📋", label: "Mgmt",     value: "8.3" },
];

export interface ParkHeaderModalProps {
  parkId: number;
  parkName: string;
  parkCountry?: string;
  currentImagePath: string | null;
  currentCardImagepath?: string | null;
  currentFocus?: string;
  currentHeaderFocus?: string;
  currentCardImages?: CardImagesMap;
  overall?: number;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── CropEditor ───────────────────────────────────────────────────────────────
//
// Zoom fix: toFocusStr converts the current zoomed view to the equivalent
// objectPosition at zoom=1 (cover scale) by preserving the centre point.
//
// Formula derivation:
//   cx (image fraction) = 0.5 - tx / (nw * totalScale)
//   objectPosition X%   = 50  - 100 * tx / (exW1 * zoom)
//   where exW1 = nw * coverScale - containerW  (excess at zoom=1)
//
// Pinch+drag: tracks midpoint of 2 fingers for simultaneous pan+zoom.

interface CropEditorProps {
  src: string;
  aspectRatio?: string;
  focusStr: string;
  onCommit: (f: string) => void;
  editorRef?: React.MutableRefObject<{ getFocus: () => string } | null>;
  className?: string;
  children?: React.ReactNode;
}

function CropEditor({ src, aspectRatio, focusStr, onCommit, editorRef, className = "", children }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const commitRef    = useRef(onCommit);
  useEffect(() => { commitRef.current = onCommit; });
  // Expose getFocus() so the save button can read the live state without waiting for debounce
  useEffect(() => {
    if (editorRef) editorRef.current = { getFocus: () => toFocusStr() };
    return () => { if (editorRef) editorRef.current = null; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const nw = useRef(0);
  const nh = useRef(0);
  const tx   = useRef(0);
  const ty   = useRef(0);
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
    const mx = Math.max(0, (nw.current * s - c.clientWidth)  / 2);
    const my = Math.max(0, (nh.current * s - c.clientHeight) / 2);
    return { tx: clamp(dtx, -mx, mx), ty: clamp(dty, -my, my) };
  }

  function applyDOM(s = totalScale()) {
    const img = imgRef.current;
    const c   = containerRef.current;
    if (!img || !c || !nw.current) return;
    const w = nw.current * s, h = nh.current * s;
    img.style.width     = `${w}px`;
    img.style.height    = `${h}px`;
    img.style.transform = `translate(${(c.clientWidth - w) / 2 + tx.current}px,${(c.clientHeight - h) / 2 + ty.current}px)`;
  }

  // Encodes current editor state as "cx cy zoom" where cx,cy ∈ [0,1] are the
  // fractions of image width/height at the container centre. This works for all
  // aspect-ratio combos, including when excessW=0 at zoom=1.
  function toFocusStr() {
    const c = containerRef.current;
    if (!c || !nw.current) return "0.5000 0.5000 1.000";
    const z  = zoom.current;
    const ts = coverScale() * z;
    const cx = clamp(0.5 - tx.current / (nw.current * ts), 0, 1);
    const cy = clamp(0.5 - ty.current / (nh.current * ts), 0, 1);
    return `${cx.toFixed(4)} ${cy.toFixed(4)} ${z.toFixed(3)}`;
  }

  // Inverse of toFocusStr — sets tx/ty from a saved focus string.
  // Must be called AFTER zoom.current is set.
  function fromFocusStr(f: string) {
    const parts = (f || "0.5 0.5 1").split(" ");
    const c = containerRef.current;
    if (!c) { tx.current = 0; ty.current = 0; return; }
    const ts = coverScale() * zoom.current;
    let cx: number, cy: number;
    if (parts[0]?.includes("%")) {
      // Old "X% Y% zoom" format: convert via the zoom=1 excess formula
      const xPct = parseFloat(parts[0]) || 50;
      const yPct = parseFloat(parts[1]) || 50;
      const cs   = coverScale();
      const ex1w = Math.max(0, nw.current * cs - c.clientWidth);
      const ex1h = Math.max(0, nh.current * cs - c.clientHeight);
      const oldTx = (0.5 - xPct / 100) * ex1w * zoom.current;
      const oldTy = (0.5 - yPct / 100) * ex1h * zoom.current;
      cx = nw.current * ts > 0 ? clamp(0.5 - oldTx / (nw.current * ts), 0, 1) : 0.5;
      cy = nh.current * ts > 0 ? clamp(0.5 - oldTy / (nh.current * ts), 0, 1) : 0.5;
    } else {
      cx = parseFloat(parts[0]); if (isNaN(cx)) cx = 0.5;
      cy = parseFloat(parts[1]); if (isNaN(cy)) cy = 0.5;
    }
    tx.current = (0.5 - cx) * nw.current * ts;
    ty.current = (0.5 - cy) * nh.current * ts;
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
    }
    const tmp = new window.Image();
    tmp.onload = () => init(tmp);
    tmp.src = src;
    if (tmp.complete && tmp.naturalWidth > 0) init(tmp);
    return () => { cancelled = true; tmp.onload = null; };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Native pointer events only ─────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ptrs = new Map<number, { x: number; y: number }>();
    let drag: { x0: number; y0: number; tx0: number; ty0: number } | null = null;
    // Pinch tracks initial distance, zoom, midpoint and pan for simultaneous pinch+drag
    let pinch: { d0: number; z0: number; mx0: number; my0: number; tx0: number; ty0: number } | null = null;
    let wheelTimer = 0;

    function startPinch() {
      const ids = Array.from(ptrs.keys());
      const a = ptrs.get(ids[0])!, b = ptrs.get(ids[1])!;
      pinch = {
        d0:  Math.hypot(a.x - b.x, a.y - b.y),
        z0:  zoom.current,
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
        const d  = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const newZ = clamp(pinch.z0 * (d / pinch.d0), 1, 4);
        zoom.current = newZ;
        // simultaneous pan from midpoint movement
        const { tx: ntx, ty: nty } = clampTxy(
          pinch.tx0 + (mx - pinch.mx0),
          pinch.ty0 + (my - pinch.my0),
        );
        tx.current = ntx;
        ty.current = nty;
        applyDOM();
      } else if (drag && ptrs.size === 1) {
        const { tx: ntx, ty: nty } = clampTxy(
          drag.tx0 + e.clientX - drag.x0,
          drag.ty0 + e.clientY - drag.y0,
        );
        tx.current = ntx;
        ty.current = nty;
        applyDOM();
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
      zoom.current = clamp(zoom.current * (1 - e.deltaY * 0.001), 1, 4);
      const { tx: ntx, ty: nty } = clampTxy(tx.current, ty.current);
      tx.current = ntx; ty.current = nty;
      applyDOM();
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => commitRef.current(toFocusStr()), 250);
    }

    el.addEventListener("pointerdown",   onPointerDown,  { passive: false });
    el.addEventListener("pointermove",   onPointerMove,  { passive: false });
    el.addEventListener("pointerup",     onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel",         onWheel,        { passive: false });
    return () => {
      clearTimeout(wheelTimer);
      el.removeEventListener("pointerdown",   onPointerDown);
      el.removeEventListener("pointermove",   onPointerMove);
      el.removeEventListener("pointerup",     onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel",         onWheel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-800 cursor-grab active:cursor-grabbing select-none touch-none ${className}`}
      style={aspectRatio ? { aspectRatio } : { flex: 1, minHeight: 0 }}
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

// ─── Overlays ─────────────────────────────────────────────────────────────────

function HeaderOverlay({ parkName }: { parkName: string }) {
  return <>
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    <span className="absolute bottom-3 left-5 text-white font-bold text-xl drop-shadow">{parkName}</span>
    <div className="absolute bottom-3 right-3 text-white/30 text-[9px] font-bold uppercase tracking-widest">
      Drag · scroll to zoom
    </div>
  </>;
}

function CardOverlay({ parkName, parkCountry, overall }: { parkName: string; parkCountry?: string; overall: number }) {
  return <>
    <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent px-3 pt-3 pb-12">
      <div className="flex items-center gap-1.5">
        {parkCountry && <img src={getParkFlag(parkCountry)} alt="" width={16} height={11} className="rounded-sm" />}
        <span className="text-white font-bold text-sm truncate">{parkName}</span>
      </div>
    </div>
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 to-transparent px-3 pb-3 pt-12">
      <div className={`text-3xl font-black tabular-nums text-center leading-none mb-2 ${getRatingColor(overall)}`}>
        {overall.toFixed(1)}
      </div>
      <div className="grid grid-cols-5 gap-0.5">
        {CARD_PREVIEW_GROUPS.map(g => (
          <div key={g.label} className="flex flex-col items-center">
            <span className="text-[10px]">{g.emoji}</span>
            <span className="text-[10px] font-bold text-green-400 tabular-nums">{g.value}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="absolute top-2 right-2 text-white/25 text-[9px] font-bold uppercase tracking-widest">
      Drag · pinch to zoom
    </div>
  </>;
}

// ─── Gallery view (replaces content area) ────────────────────────────────────

function GalleryView({
  images, loading, isSelected, onClick, onBack,
  onUpload, uploadProgress,
}: {
  images: GalleryImage[];
  loading: boolean;
  isSelected: (img: GalleryImage) => boolean;
  onClick: (img: GalleryImage) => void;
  onBack: () => void;
  onUpload?: (f: File) => void;
  uploadProgress: number | null;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to editor
        </button>
        {onUpload && (
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-bold transition-all relative overflow-hidden ${
            uploadProgress !== null
              ? "border-blue-400 text-blue-400"
              : "border-gray-700 text-gray-400 hover:border-blue-400 hover:text-blue-400"
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
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {images.map(img => {
              const sel = isSelected(img);
              return (
                <div key={img.id} onClick={() => onClick(img)}
                  className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${
                    sel ? "border-blue-500 ring-2 ring-blue-500/20" : "border-transparent hover:border-blue-400"
                  }`}>
                  <Image src={img.path} alt="" fill className="object-cover" unoptimized />
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
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const ParkHeaderModal: React.FC<ParkHeaderModalProps> = ({
  parkId, parkName, parkCountry,
  currentImagePath, currentCardImagepath,
  currentFocus, currentHeaderFocus, currentCardImages,
  overall, onClose, onSuccess,
}) => {
  useScrollLock();
  const [mode, setMode]               = useState<Mode>("header");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const headerEditorRef = useRef<{ getFocus: () => string } | null>(null);
  const cardEditorRef   = useRef<{ getFocus: () => string } | null>(null);
  const catEditorRef    = useRef<{ getFocus: () => string } | null>(null);
  const [images, setImages]           = useState<GalleryImage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [headerPath,  setHeaderPath]  = useState(currentImagePath ?? "");
  const [headerFocus, setHeaderFocus] = useState(currentHeaderFocus ?? "50% 50%");
  const [cardPath,    setCardPath]    = useState<string | null>(currentCardImagepath ?? null);
  const [cardFocus,   setCardFocus]   = useState(currentFocus ?? "50% 50%");
  const [cardEntries, setCardEntries] = useState<CardImagesMap>({
    coasters: { src: currentImagePath ?? "", focus: currentFocus ?? "50% 50%" },
    ...currentCardImages,
  });
  const [activeCatKey, setActiveCatKey] = useState<CardCatKey>("coasters");

  const effectiveCardPath = cardPath ?? headerPath;
  const activeEntry       = cardEntries[activeCatKey] ?? { src: "", focus: "50% 50%" };
  const displayOverall    = overall ?? 8.5;

  useEffect(() => {
    fetch(`/api/park/${parkId}/gallery`)
      .then(r => r.json())
      .then(d => { setImages(d.gallery || []); setLoading(false); });
  }, [parkId]);

  function handleGalleryClick(img: GalleryImage) {
    if (mode === "header") {
      setHeaderPath(img.path);
    } else if (mode === "card") {
      setCardPath(img.path === headerPath ? null : img.path);
    } else {
      setCardEntries(prev => ({
        ...prev,
        [activeCatKey]: { src: img.path, focus: prev[activeCatKey]?.focus ?? "50% 50%" },
      }));
    }
    setGalleryOpen(false);
  }

  function isSelected(img: GalleryImage) {
    if (mode === "header")     return img.path === headerPath;
    if (mode === "card")       return img.path === effectiveCardPath;
    return img.path === (cardEntries[activeCatKey]?.src ?? "");
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
        setImages(prev => [{ id: Date.now(), title: `${parkName}-header`, path: imagePath }, ...prev]);
        setGalleryOpen(false);
      } else alert("Upload failed.");
      setUploadProgress(null);
    });
    xhr.open("POST", "/api/upload");
    xhr.send(fd);
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (mode === "header") {
        body.imagepath   = headerPath;
        body.headerFocus = headerEditorRef.current?.getFocus() ?? headerFocus;
      } else if (mode === "card") {
        body.cardImagepath = cardPath;
        body.imageFocus    = cardEditorRef.current?.getFocus() ?? cardFocus;
      } else {
        // Commit the active category's latest state before saving
        const latestFocus = catEditorRef.current?.getFocus();
        body.cardImages = latestFocus
          ? { ...cardEntries, [activeCatKey]: { ...cardEntries[activeCatKey] ?? { src: "" }, focus: latestFocus } }
          : cardEntries;
      }
      const res = await fetch(`/api/park/${parkId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Save failed (${res.status}): ${JSON.stringify(err)}`);
        return;
      }
      onSuccess(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/80 backdrop-blur-sm pt-3 md:pt-0 md:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-7xl h-[97dvh] md:h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-white/10">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {galleryOpen ? (
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Select image</span>
          ) : (
            <>
              <span className="font-bold text-sm text-gray-900 dark:text-white truncate hidden sm:block">{parkName}</span>
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5">
                {([
                  { id: "header"     as Mode, label: "🏔️ Header"    },
                  { id: "card"       as Mode, label: "📍 Card"       },
                  { id: "categories" as Mode, label: "🖼️ Categories" },
                ] as const).map(m => (
                  <button key={m.id} onClick={() => { setMode(m.id); setGalleryOpen(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      mode === m.id
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}>{m.label}</button>
                ))}
              </div>
            </>
          )}
          <button onClick={galleryOpen ? () => setGalleryOpen(false) : onClose}
            className="ml-auto p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Gallery replaces entire content area */}
        {galleryOpen ? (
          <GalleryView
            images={images} loading={loading}
            isSelected={isSelected} onClick={handleGalleryClick}
            onBack={() => setGalleryOpen(false)}
            onUpload={mode === "header" ? handleUpload : undefined}
            uploadProgress={uploadProgress}
          />
        ) : (
          <>
            {/* ── HEADER ── */}
            {mode === "header" && (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-6">
                <CropEditor
                  key={`h-${headerPath}-${isMobile}`}
                  editorRef={headerEditorRef}
                  src={headerPath}
                  aspectRatio={isMobile ? "16/8" : "16/4"}
                  focusStr={headerFocus}
                  onCommit={setHeaderFocus}
                  className="w-full rounded-2xl"
                >
                  <HeaderOverlay parkName={parkName} />
                </CropEditor>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setGalleryOpen(true)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-500 transition-all cursor-pointer">
                    Change image
                  </button>
                  <button onClick={save} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer">
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            )}

            {/* ── CARD ── */}
            {mode === "card" && (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-6">
                <div className="min-h-0 flex-1 flex items-center" style={{ aspectRatio: "3/4", maxHeight: "100%" }}>
                  <CropEditor
                    key={`c-${effectiveCardPath}`}
                    editorRef={cardEditorRef}
                    src={effectiveCardPath}
                    aspectRatio="3/4"
                    focusStr={cardFocus}
                    onCommit={setCardFocus}
                    className="rounded-2xl h-full w-auto"
                  >
                    <CardOverlay parkName={parkName} parkCountry={parkCountry} overall={displayOverall} />
                  </CropEditor>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <button onClick={() => setGalleryOpen(true)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-500 transition-all cursor-pointer">
                    Change image
                  </button>
                  {cardPath && (
                    <button onClick={() => setCardPath(null)}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-400/40 text-red-400 hover:border-red-400 transition-all cursor-pointer">
                      Reset to header
                    </button>
                  )}
                  <button onClick={save} disabled={saving}
                    className="px-8 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer">
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            )}

            {/* ── CATEGORIES ── */}
            {mode === "categories" && (
              <div className="flex-1 min-h-0 flex flex-col items-center gap-4 p-6">

                {activeEntry.src ? (
                  <>
                    <div className="min-h-0 flex-1 flex items-center" style={{ aspectRatio: "3/4", maxHeight: "100%" }}>
                      <CropEditor
                        key={`cat-${activeCatKey}-${activeEntry.src}`}
                        editorRef={catEditorRef}
                        src={activeEntry.src}
                        aspectRatio="3/4"
                        focusStr={activeEntry.focus}
                        onCommit={f => setCardEntries(prev => ({
                          ...prev,
                          [activeCatKey]: { ...prev[activeCatKey] ?? { src: "" }, focus: f },
                        }))}
                        className="rounded-2xl h-full w-auto"
                      >
                        <CardOverlay parkName={parkName} parkCountry={parkCountry} overall={displayOverall} />
                      </CropEditor>
                    </div>
                    {/* Pills + action buttons in one row */}
                    <div className="flex flex-col gap-2 flex-shrink-0 w-full">
                      <div className="flex gap-1.5 flex-wrap">
                        {CARD_CATS.map(cat => {
                          const has = !!(cardEntries[cat.key]?.src);
                          return (
                            <button key={cat.key} onClick={() => setActiveCatKey(cat.key)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                                activeCatKey === cat.key
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : has
                                    ? "border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                                    : "border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                              }`}>
                              {cat.emoji} {cat.label}
                              {has && activeCatKey !== cat.key && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setGalleryOpen(true)}
                          className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-500 transition-all cursor-pointer">
                          Change image
                        </button>
                        <button onClick={() => setCardEntries(prev => { const n = { ...prev }; delete n[activeCatKey]; return n; })}
                          className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-400/40 text-red-400 hover:border-red-400 transition-all cursor-pointer">
                          Remove
                        </button>
                        <button onClick={save} disabled={saving}
                          className="px-8 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer">
                          {saving ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    {/* Pills shown above the empty state too */}
                    <div className="flex gap-1.5 flex-wrap self-start">
                      {CARD_CATS.map(cat => {
                        const has = !!(cardEntries[cat.key]?.src);
                        return (
                          <button key={cat.key} onClick={() => setActiveCatKey(cat.key)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                              activeCatKey === cat.key
                                ? "bg-blue-600 border-blue-600 text-white"
                                : has
                                  ? "border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                                  : "border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}>
                            {cat.emoji} {cat.label}
                            {has && activeCatKey !== cat.key && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-700 flex items-center justify-center">
                      <span className="text-gray-600 text-3xl">{CARD_CATS.find(c => c.key === activeCatKey)?.emoji}</span>
                    </div>
                    <p className="text-sm text-gray-400">No image for <strong className="text-gray-300">{CARD_CATS.find(c => c.key === activeCatKey)?.label}</strong></p>
                    <button onClick={() => setGalleryOpen(true)}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-700 text-gray-300 hover:border-blue-400 hover:text-blue-400 transition-all cursor-pointer">
                      Browse gallery
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ParkHeaderModal;
