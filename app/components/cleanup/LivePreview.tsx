"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { parseFocusStr } from "@/app/components/FocusedImage";
import { coverPosition, hasCustomFocus } from "@/app/lib/coverPlacement";
import { variantUrl } from "@/app/lib/imageVariants";
import { FRAMING_PREVIEW } from "@/app/lib/framingPreview";

/**
 * One framing, shown on the real page. The page loads in an iframe at a real
 * screen size (name "framing-preview": no admin controls, no analytics); this
 * finds the framed photo by its data-framing marker, scrolls it into view and
 * shows just that frame, scaled to fit. Everything over the photo (navbar,
 * gradients, names, scores, captions) is the page's own. The photo itself is
 * placed here with the same math the page uses for that frame
 * (data-framing-math), and follows drags (pan), the wheel and pinches (zoom).
 */

export type Viewport = { w: number; h: number };
type PlaceMath = "focused" | "card" | "cover" | "position";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const focusValue = (cx: number, cy: number, zoom: number) => `${cx.toFixed(4)} ${cy.toFixed(4)} ${zoom.toFixed(3)}`;

/** The clean-up tool shows phones at the size of ours, desktops at this window's size. */
export function previewViewport(screen: "phone" | "desktop"): Viewport {
  if (typeof window === "undefined") return screen === "phone" ? { w: 384, h: 684 } : { w: 1920, h: 1000 };
  const w = window.innerWidth, h = window.innerHeight;
  if (screen === "phone") return w < 768 ? { w, h } : { w: 384, h: 684 };
  return w >= 1024 ? { w, h } : { w: 1920, h: 1000 };
}

const withPreviewParam = (page: string) => `${page.split("#")[0]}${page.includes("?") ? "&" : "?"}framing-preview=1`;

interface Found { frame: HTMLElement; img: HTMLImageElement; math: PlaceMath; doc: Document; win: Window; last?: { key: string; css: string } }

/**
 * Centre the frame on the page's screen: its own horizontal scrollers (the
 * phone front page strip, photo strips), then the page. Not scrollIntoView:
 * from a same-origin iframe that also scrolls the tool page and the preview box.
 */
function bringIntoView(el: HTMLElement, win: Window, vp: Viewport) {
  for (let p = el.parentElement; p && p !== el.ownerDocument.body; p = p.parentElement) {
    const ox = win.getComputedStyle(p).overflowX;
    if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth + 1) {
      const pr = p.getBoundingClientRect(), er = el.getBoundingClientRect();
      p.scrollLeft += er.left + er.width / 2 - (pr.left + pr.width / 2);
    }
  }
  const er = el.getBoundingClientRect();
  win.scrollTo({ left: 0, top: Math.max(0, win.scrollY + er.top + er.height / 2 - vp.h / 2), behavior: "instant" as ScrollBehavior });
}

/**
 * Put the photo where the page would for this value. focused = FocusedImage's
 * applyStyle, card = the front page card's applyFocusToImg, cover = placeCover
 * (only for a custom focus, as the deck and strip do), position = SectionImage.
 * Writes nothing when the photo is still as it was last left here, so the
 * watcher that calls this on every change of the photo cannot loop.
 */
function applyPlacement(f: Found, src: string, value: string) {
  const { img, frame, math } = f;
  const s = img.style;
  if (img.getAttribute("src") !== src) {
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.setAttribute("src", src);
  }
  if (!img.naturalWidth || !img.naturalHeight) return;
  const box = math === "position" ? img : img.parentElement;
  if (!box || !box.clientWidth || !box.clientHeight) return;
  const W = box.clientWidth, H = box.clientHeight;
  const key = `${value}|${src}|${W}x${H}|${img.naturalWidth}x${img.naturalHeight}`;
  if (f.last && f.last.key === key && f.last.css === s.cssText) return;
  if (math === "cover") {
    if (frame.dataset.focus !== value) frame.dataset.focus = value;
    s.objectPosition = hasCustomFocus(value) ? coverPosition(W, H, img.naturalWidth, img.naturalHeight, value) : "";
  } else if (math === "position") {
    const { cx, cy } = parseFocusStr(value);
    s.objectPosition = `${cx * 100}% ${cy * 100}%`;
  } else {
    const { cx, cy, zoom } = parseFocusStr(value);
    const cs = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * cs * zoom, dh = img.naturalHeight * cs * zoom;
    s.width = `${dw}px`;
    s.height = `${dh}px`;
    s.left = `${math === "focused" ? Math.min(0, Math.max(W - dw, W / 2 - cx * dw)) : W / 2 - cx * dw}px`;
    s.top = `${math === "focused" ? Math.min(0, Math.max(H - dh, H / 2 - cy * dh)) : H / 2 - cy * dh}px`;
    s.transform = math === "focused" ? "none" : "";
    s.minWidth = ""; s.minHeight = ""; s.aspectRatio = ""; s.maxWidth = "none"; s.visibility = "visible";
    // The front page card shows its photo at 0.95 once loaded (FullBleedRatingCard's reveal); a card
    // that loads late starts at 0 and may not have been revealed yet.
    if (math === "card") s.opacity = "0.95";
  }
  f.last = { key, css: s.cssText };
}

/** Frame size, photo size and the visible centre for drags: the page's geometry for this value. */
function geometry(f: Found, value: string) {
  const { img, math } = f;
  const box = math === "position" ? img : img.parentElement ?? img;
  const W = box.clientWidth, H = box.clientHeight;
  const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
  const { cx, cy, zoom } = parseFocusStr(value);
  const z = math === "focused" || math === "card" ? zoom : 1;
  const cs = Math.max(W / nw, H / nh);
  return { W, H, dw: nw * cs * z, dh: nh * cs * z, cx, cy, z };
}

/** The visible centre after a pan, kept where the photo still covers the frame (a clampW-wide one when given). */
function clampCentre(c: number, frame: number, drawn: number) {
  if (drawn <= frame + 0.5) return 0.5;
  const half = frame / (2 * drawn);
  return clamp(c, half, 1 - half);
}

export default function LivePreview({ page, target, viewport, photo, value, onChange, maxZoom = 1, clampAspect, maxW, maxH, label, badge }: {
  page: string;
  target: string;
  viewport: Viewport;
  /** The photo to show (its original URL); the page's own may be a pre-cut copy. */
  photo: string;
  value: string;
  onChange: (value: string) => void;
  maxZoom?: number;
  clampAspect?: number;
  /** Largest size the frame may take on screen. */
  maxW: number;
  maxH: number;
  label?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const foundRef = useRef<Found | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  // The photo itself can arrive after the page: say so instead of showing an empty frame.
  const [photoIn, setPhotoIn] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const src = variantUrl(photo, 1920);
  const srcRef = useRef(src);
  srcRef.current = src;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Find the frame once the page is up, then hold the photo where the value says.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let detachLoad: (() => void) | null = null;
    setStatus("loading"); setRect(null); setPhotoIn(false); foundRef.current = null;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sel = `[data-framing="${CSS.escape(target)}"]`;
    // The frame as it is on screen now: pages can render a copy that is hidden or
    // swap it after loading (the front page switches to its phone strip).
    const findFrame = (doc: Document) => [...doc.querySelectorAll<HTMLElement>(sel)].find((e) => e.isConnected && e.offsetWidth > 0 && e.offsetHeight > 0) ?? null;
    // Take over the photo of this frame: whatever the page does to it later (a load
    // handler, a resize, a swap of its address), it goes back to this value.
    const attach = (frame: HTMLElement, doc: Document, win: Window): boolean => {
      const img = frame.querySelector<HTMLImageElement>("img.framing-photo") ?? frame.querySelector<HTMLImageElement>("img");
      if (!img) return false;
      observer?.disconnect(); detachLoad?.();
      const found: Found = { frame, img, math: (frame.dataset.framingMath as PlaceMath) || "focused", doc, win };
      foundRef.current = found;
      const apply = () => { if (foundRef.current === found) applyPlacement(found, srcRef.current, valueRef.current); };
      img.addEventListener("load", apply);
      detachLoad = () => img.removeEventListener("load", apply);
      observer = new MutationObserver(apply);
      observer.observe(img, { attributes: true, attributeFilter: ["style", "src", "srcset"] });
      apply();
      return true;
    };
    const start = async () => {
      const doc = iframe.contentDocument, win = iframe.contentWindow;
      if (!doc || !win) return;
      const style = doc.createElement("style");
      style.textContent = `nextjs-portal{display:none!important}[aria-label^="Admin mode"]{display:none!important}html{scroll-behavior:auto!important}.framing-photo{transition:none!important}`;
      doc.head.appendChild(style);
      await wait(300); // the page settles after loading (layout swaps, its own scroll to the top)
      let frame: HTMLElement | null = null;
      for (let i = 0; i < 100 && !cancelled && !(frame = findFrame(doc)); i++) await wait(150);
      if (cancelled) return;
      if (!frame) { setStatus("missing"); return; }
      bringIntoView(frame, win, viewport);
      // Let the page bring in its own photo first (in view now, lazy ones load).
      const own = frame.querySelector<HTMLImageElement>("img.framing-photo") ?? frame.querySelector<HTMLImageElement>("img");
      for (let i = 0; i < 40 && !cancelled && own && own.getAttribute("src") && !(own.complete && own.naturalWidth > 0); i++) await wait(150);
      await wait(400); // snap scrolling, card fades and the like settle
      if (cancelled) return;
      frame = findFrame(doc) ?? frame;
      if (!attach(frame, doc, win)) { setStatus("missing"); return; }
      const img = foundRef.current!.img;
      for (let i = 0; i < 50 && !cancelled && !(img.complete && img.naturalWidth > 0 && img.getAttribute("src") === srcRef.current); i++) await wait(100);
      // A frame that fades in (the deck brings the framed card to the front) is measured once it is there.
      for (let i = 0; i < 30 && !cancelled; i++) {
        const cs = win.getComputedStyle(frame);
        if (cs.visibility === "visible" && Number(cs.opacity) > 0.95) break;
        await wait(100);
      }
      if (cancelled) return;
      measure();
      setStatus("ready");
    };
    // Where the frame is on the page's screen. Kept up to date: fonts, a strip that
    // snaps or the page scrolling itself can move it after the first look.
    const measure = () => {
      let f = foundRef.current; if (!f) return;
      if (!f.frame.isConnected || !f.frame.offsetWidth) {
        const again = findFrame(f.doc);
        if (!again || !attach(again, f.doc, f.win)) return;
        f = foundRef.current!;
      }
      let r = f.frame.getBoundingClientRect();
      if (r.top < 0 || r.bottom > viewport.h || r.left < 0 || r.right > viewport.w) {
        bringIntoView(f.frame, f.win, viewport);
        r = f.frame.getBoundingClientRect();
      }
      // The preview box only shows the frame; it never scrolls itself.
      const box = iframe.parentElement;
      if (box && (box.scrollTop || box.scrollLeft)) { box.scrollTop = 0; box.scrollLeft = 0; }
      applyPlacement(f, srcRef.current, valueRef.current);
      setPhotoIn(f.img.complete && f.img.naturalWidth > 0 && f.img.getAttribute("src") === srcRef.current);
      setRect((old) => (old && Math.abs(old.x - r.left) < 0.5 && Math.abs(old.y - r.top) < 0.5 && Math.abs(old.w - r.width) < 0.5 && Math.abs(old.h - r.height) < 0.5 ? old : { x: r.left, y: r.top, w: r.width, h: r.height }));
    };
    const tick = setInterval(measure, 500);
    const onLoad = () => { void start(); };
    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete" && iframe.contentDocument.querySelector("body *")) onLoad();
    return () => { cancelled = true; clearInterval(tick); iframe.removeEventListener("load", onLoad); observer?.disconnect(); detachLoad?.(); foundRef.current = null; };
  }, [page, target, viewport.w, viewport.h]); // eslint-disable-line react-hooks/exhaustive-deps -- the viewport is compared by its size

  // A new value (a drag here, a drag in another view of the same framing, an undo) is applied at once.
  useEffect(() => { const f = foundRef.current; if (f) applyPlacement(f, src, value); }, [value, src]);

  const scale = rect ? Math.min(1, maxW / rect.w, maxH / rect.h) : 1;

  // Pan and zoom, in page pixels.
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; z: number; pid: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const emit = useCallback((cx: number, cy: number, z: number) => {
    const f = foundRef.current; if (!f) return;
    const g = geometry(f, focusValue(cx, cy, z));
    const clampW = clampAspect ? Math.max(g.W, g.H * clampAspect) : g.W;
    if (f.math === "position") {
      onChangeRef.current(focusValue(clamp(cx, 0, 1), clamp(cy, 0, 1), 1));
      return;
    }
    onChangeRef.current(focusValue(clampCentre(cx, clampW, g.dw), clampCentre(cy, g.H, g.dh), z));
  }, [clampAspect]);
  const visibleStart = () => {
    const f = foundRef.current; if (!f) return null;
    const g = geometry(f, valueRef.current);
    if (f.math === "position") return { cx: g.cx, cy: g.cy, z: 1 };
    // Start from what is on screen: a framing saved for another shape shows clamped.
    return { cx: clampCentre(g.cx, g.W, g.dw), cy: clampCentre(g.cy, g.H, g.dh), z: g.z };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (status !== "ready") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = visibleStart(); if (!v) return;
    if (pointers.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, ...v, pid: e.pointerId };
    else if (pointers.current.size === 2 && maxZoom > 1) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: v.z };
      drag.current = null;
    }
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const f = foundRef.current; if (!f) return;
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const z = clamp(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d), 1, maxZoom);
      const v = visibleStart(); if (v) emit(v.cx, v.cy, z);
      return;
    }
    const d = drag.current; if (!d || d.pid !== e.pointerId) return;
    const dx = (e.clientX - d.x) / scale, dy = (e.clientY - d.y) / scale;
    const g = geometry(f, focusValue(d.cx, d.cy, d.z));
    if (f.math === "position") {
      // object-position: the photo moves with the pointer across its overflow.
      const ox = g.dw - g.W, oy = g.dh - g.H;
      emit(ox > 0.5 ? d.cx - dx / ox : d.cx, oy > 0.5 ? d.cy - dy / oy : d.cy, 1);
      return;
    }
    emit(d.cx - dx / g.dw, d.cy - dy / g.dh, d.z);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    if (status !== "ready" || maxZoom <= 1) return;
    const v = visibleStart(); if (!v) return;
    emit(v.cx, v.cy, clamp(v.z * Math.exp(-e.deltaY * 0.0015), 1, maxZoom));
  };
  // The wheel zooms the photo, not the tool page.
  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = layerRef.current; if (!el || maxZoom <= 1) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, [maxZoom, status]);

  const boxW = rect ? rect.w * scale : Math.min(maxW, maxH * 0.8);
  const boxH = rect ? rect.h * scale : Math.min(maxH, boxW * 1.25);
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      {(label || badge) && <figcaption className="flex min-h-[24px] items-center justify-between gap-3 text-sm">{label}{badge}</figcaption>}
      <div className="relative overflow-hidden rounded-xl bg-slate-900" style={{ width: boxW, height: boxH }}>
        <iframe
          ref={iframeRef}
          name={FRAMING_PREVIEW}
          src={withPreviewParam(page)}
          title="Page preview"
          tabIndex={-1}
          aria-hidden
          className="absolute left-0 top-0 max-w-none border-0"
          style={{
            width: viewport.w, height: viewport.h,
            transform: rect ? `translate(${-rect.x * scale}px, ${-rect.y * scale}px) scale(${scale})` : undefined,
            transformOrigin: "0 0", pointerEvents: "none", visibility: status === "ready" ? "visible" : "hidden",
          }}
        />
        <div
          ref={layerRef}
          className={`absolute inset-0 touch-none select-none ${status === "ready" ? "cursor-grab active:cursor-grabbing" : ""}`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
        />
        {status === "loading" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500">Loading the page…</div>}
        {status === "ready" && !photoIn && <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs font-bold text-white/80 drop-shadow">Loading photo…</div>}
        {status === "missing" && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-slate-400">This photo is not on the page right now.</div>}
      </div>
    </figure>
  );
}
