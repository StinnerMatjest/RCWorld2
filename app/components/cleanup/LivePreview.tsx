"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { parseFocusStr } from "@/app/components/FocusedImage";
import { coverPosition, hasCustomFocus } from "@/app/lib/coverPlacement";
import { exactCoverSrc, isR2Image, sharperSource, variantKey, VARIANT_WIDTHS } from "@/app/lib/imageVariants";
import { FRAMING_PREVIEW } from "@/app/lib/framingPreview";

/**
 * One framing, shown on the real page. The page loads in an iframe at a real
 * screen size (name "framing-preview": no admin controls, no analytics); this
 * finds the framed photo by its data-framing marker, scrolls it into view and
 * shows just that frame, scaled to fit. Everything over the photo (navbar,
 * gradients, names, scores, captions) is the page's own. The photo itself is
 * placed here with the same math the page uses for that frame
 * (data-framing-math), and follows drags (pan), the wheel and pinches (zoom).
 *
 * Without onChange it only shows the frame as the page draws it (a review
 * section's photo, a gallery tile). Switching to another frame on the same
 * page keeps the loaded page and just moves to it.
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

/**
 * ours: the file this preview put in the photo (the page's own src may not be what shows, with
 * a srcset); coming: a sharper file loading in the background, swapped in once it is there.
 */
interface Found { frame: HTMLElement; img: HTMLImageElement; math: PlaceMath; doc: Document; win: Window; last?: { key: string; css: string }; ours?: string; coming?: string; /** The preview is enlarged by this much on screen: the file needs that many more pixels. */ boost?: number }

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

/** Box the photo is fitted into, and how big it is drawn there, for a value. */
function geometry(f: Found, value: string, nw = f.img.naturalWidth || 1, nh = f.img.naturalHeight || 1) {
  const { img, math } = f;
  const box = math === "position" ? img : img.parentElement ?? img;
  const W = box.clientWidth, H = box.clientHeight;
  const { cx, cy, zoom } = parseFocusStr(value);
  const z = math === "cover" ? 1 : zoom; // placeCover (deck, strip) has no zoom
  const cs = Math.max(W / nw, H / nh);
  return { W, H, dw: nw * cs * z, dh: nh * cs * z, cx, cy, z };
}

/** Pixels per stored size, from a URL: a variant's width, Infinity for the original. */
const storedWidth = (u: string) => { const m = u.match(/-w(\d+)\.webp$/); return m ? Number(m[1]) : Infinity; };
/** The photo's own files: the original and its stored sizes (not a card's cut, which is another crop). */
const isFileOf = (photo: string, u: string | null): u is string => !!u && (u === photo || VARIANT_WIDTHS.some((w) => u === variantKey(photo, w)));

/**
 * The file to show for this frame: the smallest stored size that covers the
 * photo as drawn on this screen (zoom included), or the original. Never a
 * smaller file than the one already showing, so zooming out does not flicker.
 */
function pickSrc(photo: string, size: { w: number; h: number } | undefined, f: Found, value: string, current: string | null): string {
  if (!isR2Image(photo)) return photo;
  const dpr = (f.win.devicePixelRatio || window.devicePixelRatio || 1) * Math.max(1, f.boost ?? 1);
  let want: string;
  if (size?.w && size.h) {
    const g = geometry(f, value, size.w, size.h);
    want = exactCoverSrc(photo, size, g.W, g.H, g.z, dpr);
  } else if (f.img.naturalWidth && isFileOf(photo, current)) {
    // Unknown size: judge from the file showing now and step up while it is enlarged.
    const g = geometry(f, value);
    const drawnPx = g.dw * dpr;
    want = drawnPx > f.img.naturalWidth * 1.02 ? sharperSource(photo, current) ?? current : current;
  } else {
    want = variantKey(photo, 1920);
  }
  return isFileOf(photo, current) && storedWidth(current) > storedWidth(want) ? current : want;
}

/**
 * Put the photo where the page would for this value. focused and card =
 * FocusedImage's applyStyle and the front page card (cover x zoom, focus
 * point at the centre, stopping at the frame's edges), cover = placeCover
 * (only for a custom focus, as the deck and strip do), position = object-position.
 * Writes nothing when the photo is still as it was last left here, so the
 * watcher that calls this on every change of the photo cannot loop.
 */
function applyPlacement(f: Found, photo: string, size: { w: number; h: number } | undefined, value: string) {
  const { img, frame, math } = f;
  const s = img.style;
  // The preview owns the photo: a phone source of a <picture> must not win over it.
  const pic = img.parentElement?.tagName === "PICTURE" ? img.parentElement : null;
  pic?.querySelectorAll("source").forEach((el) => el.remove());
  const want = pickSrc(photo, size, f, value, f.ours ?? null);
  if (!f.ours) {
    // Taking over the page's photo (perhaps another crop of it): straight away.
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.setAttribute("src", want);
    f.ours = want;
  } else {
    // The page swapped its file meanwhile (a step-up of its own): back to ours.
    if (img.hasAttribute("srcset") || img.getAttribute("src") !== f.ours) {
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.setAttribute("src", f.ours);
    }
  }
  if (want !== f.ours && want !== f.coming) {
    // A sharper file for a bigger zoom: loaded aside, then swapped in from the cache, so
    // the photo never goes blank while it arrives.
    f.coming = want;
    const pre = new Image();
    pre.onload = () => {
      if (f.coming !== want) return;
      f.coming = undefined;
      f.ours = want;
      img.setAttribute("src", want); // the MutationObserver places it again once it shows
    };
    pre.onerror = () => { if (f.coming === want) f.coming = undefined; };
    pre.src = want;
  }
  const src = f.ours;
  // Placed once its file is in: until then the old one (perhaps another crop) keeps its place.
  if (img.currentSrc && img.currentSrc !== new URL(src, f.doc.baseURI).href) return;
  if (!img.naturalWidth || !img.naturalHeight) return;
  const g = geometry(f, value);
  if (!g.W || !g.H) return;
  const key = `${value}|${src}|${g.W}x${g.H}|${img.naturalWidth}x${img.naturalHeight}`;
  if (f.last && f.last.key === key && f.last.css === s.cssText) return;
  if (math === "cover") {
    if (frame.dataset.focus !== value) frame.dataset.focus = value;
    s.objectPosition = hasCustomFocus(value) ? coverPosition(g.W, g.H, img.naturalWidth, img.naturalHeight, value) : "";
  } else if (math === "position") {
    // object-position, and a zoom scaled from that same point (SectionImage).
    const at = `${g.cx * 100}% ${g.cy * 100}%`;
    s.objectPosition = at;
    s.transform = g.z > 1.001 ? `scale(${g.z})` : "none";
    s.transformOrigin = g.z > 1.001 ? at : "";
  } else {
    s.width = `${g.dw}px`;
    s.height = `${g.dh}px`;
    s.left = `${Math.min(0, Math.max(g.W - g.dw, g.W / 2 - g.cx * g.dw))}px`;
    s.top = `${Math.min(0, Math.max(g.H - g.dh, g.H / 2 - g.cy * g.dh))}px`;
    s.transform = "none";
    s.minWidth = ""; s.minHeight = ""; s.aspectRatio = ""; s.maxWidth = "none"; s.visibility = "visible";
    // The front page card shows its photo at 0.95 once loaded (FullBleedRatingCard's reveal); a card
    // that loads late starts at 0 and may not have been revealed yet.
    if (math === "card") s.opacity = "0.95";
  }
  f.last = { key, css: s.cssText };
}

/** The visible centre after a pan, kept where the photo still covers a frame this long. */
function clampCentre(c: number, frame: number, drawn: number) {
  if (drawn <= frame + 0.5) return 0.5;
  const half = frame / (2 * drawn);
  return clamp(c, half, 1 - half);
}

export type Lift = { left: number; top: number; width: number; height: number };

export default function LivePreview({ page, target, viewport, photo, size, value = "0.5 0.5 1", onChange, maxZoom = 1, minAspect, maxW, maxH, maxScale = 1, onFrame, lift = null, label, badge }: {
  page: string;
  target: string;
  viewport: Viewport;
  /** The photo to show (its original URL); the page's own may be a pre-cut copy. Unused when only showing. */
  photo?: string;
  /** Its pixel size, for picking the file up front. */
  size?: { w: number; h: number };
  value?: string;
  /** Without it the frame is only shown, as the page draws it. */
  onChange?: (value: string) => void;
  maxZoom?: number;
  /** Narrowest frame of this place (width / height): up and down the photo also covers that one. */
  minAspect?: number;
  /** Largest size the frame may take on screen, and how far past its real size it may be enlarged to get there. */
  maxW: number;
  maxH: number;
  maxScale?: number;
  /** The frame's size on its page, once found (for laying out several previews). */
  onFrame?: (w: number, h: number) => void;
  /** Shown big in a window at this place on the screen (the same element moves, the page stays loaded). */
  lift?: Lift | null;
  label?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const editable = !!onChange && !!photo;
  // The page without its #anchor: frames on one page share one load.
  const url = withPreviewParam(page);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const foundRef = useRef<Found | null>(null);
  const [docReady, setDocReady] = useState(0);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  // The photo itself can arrive after the page: say so instead of showing an empty frame.
  const [photoIn, setPhotoIn] = useState(false);
  const live = useRef({ value, photo, size, editable });
  live.current = { value, photo, size, editable };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // The page: loaded once per page and screen size.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setDocReady(0); setStatus("loading"); setRect(null);
    let n = 0;
    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const style = doc.createElement("style");
      // No scrollbar: phones have none taking width, and a desktop one would narrow the page.
      style.textContent = `nextjs-portal{display:none!important}[aria-label^="Admin mode"]{display:none!important}html{scroll-behavior:auto!important;scrollbar-width:none}html::-webkit-scrollbar{display:none}.framing-photo{transition:none!important}`;
      doc.head.appendChild(style);
      setDocReady(++n);
    };
    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete" && iframe.contentDocument.querySelector("body *")) onLoad();
    return () => iframe.removeEventListener("load", onLoad);
  }, [url, viewport.w, viewport.h]);

  // The frame on it: found, centred, and (when editable) its photo held where the value says.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !docReady) return;
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let detachLoad: (() => void) | null = null;
    setStatus("loading"); setRect(null); setPhotoIn(false); foundRef.current = null;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sel = `[data-framing="${CSS.escape(target)}"]`;
    // The frame as it is on screen now: pages can render a copy that is hidden or
    // swap it after loading (the front page switches to its phone strip).
    const findFrame = (doc: Document) => [...doc.querySelectorAll<HTMLElement>(sel)].find((e) => e.isConnected && e.offsetWidth > 0 && e.offsetHeight > 0) ?? null;
    const photoOf = (frame: HTMLElement) => frame.querySelector<HTMLImageElement>("img.framing-photo") ?? frame.querySelector<HTMLImageElement>("img");
    // Take over the photo of this frame: whatever the page does to it later (a load
    // handler, a resize, a swap of its address), it goes back to this value.
    const attach = (frame: HTMLElement, doc: Document, win: Window): boolean => {
      const img = photoOf(frame);
      if (!img) return false;
      observer?.disconnect(); detachLoad?.();
      const found: Found = { frame, img, math: (frame.dataset.framingMath as PlaceMath) || "focused", doc, win };
      foundRef.current = found;
      if (!live.current.editable) return true;
      const apply = () => { const l = live.current; if (foundRef.current === found && l.photo) applyPlacement(found, l.photo, l.size, l.value); };
      img.addEventListener("load", apply);
      detachLoad = () => img.removeEventListener("load", apply);
      observer = new MutationObserver(apply);
      observer.observe(img, { attributes: true, attributeFilter: ["style", "src", "srcset"] });
      if (img.parentElement?.tagName === "PICTURE") observer.observe(img.parentElement, { childList: true });
      apply();
      return true;
    };
    const run = async () => {
      const doc = iframe.contentDocument, win = iframe.contentWindow;
      if (!doc || !win) return;
      await wait(300); // the page settles after loading (layout swaps, its own scroll to the top)
      let frame: HTMLElement | null = null;
      for (let i = 0; i < 100 && !cancelled && !(frame = findFrame(doc)); i++) await wait(150);
      if (cancelled) return;
      if (!frame) { setStatus("missing"); return; }
      bringIntoView(frame, win, viewport);
      // Let the page bring in its own photo first (in view now, lazy ones load).
      const own = photoOf(frame);
      for (let i = 0; i < 40 && !cancelled && own && own.getAttribute("src") && !(own.complete && own.naturalWidth > 0); i++) await wait(150);
      await wait(400); // snap scrolling, card fades and the like settle
      if (cancelled) return;
      frame = findFrame(doc) ?? frame;
      if (!attach(frame, doc, win)) { setStatus("missing"); return; }
      const img = foundRef.current!.img;
      for (let i = 0; i < 60 && !cancelled && !(img.complete && img.naturalWidth > 0); i++) await wait(100);
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
      const l = live.current;
      if (l.editable && l.photo) applyPlacement(f, l.photo, l.size, l.value);
      setPhotoIn(f.img.complete && f.img.naturalWidth > 0);
      setRect((old) => (old && Math.abs(old.x - r.left) < 0.5 && Math.abs(old.y - r.top) < 0.5 && Math.abs(old.w - r.width) < 0.5 && Math.abs(old.h - r.height) < 0.5 ? old : { x: r.left, y: r.top, w: r.width, h: r.height }));
    };
    void run();
    const tick = setInterval(measure, 500);
    return () => { cancelled = true; clearInterval(tick); observer?.disconnect(); detachLoad?.(); foundRef.current = null; };
  }, [docReady, target]); // eslint-disable-line react-hooks/exhaustive-deps -- the viewport only changes with the page (it reloads)

  // A new value (a drag here, a drag in another view of the same framing, an undo) is applied at once.
  useEffect(() => { const f = foundRef.current; if (f && editable && photo) applyPlacement(f, photo, size, value); }, [value, photo, size, editable]);

  const fitW = lift ? lift.width - 32 : maxW, fitH = lift ? lift.height - 64 : maxH;
  const scale = rect ? Math.min(lift ? 3 : maxScale, fitW / rect.w, fitH / rect.h) : 1;
  // The frame's own size goes up; an enlarged preview asks for a sharper file.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  useEffect(() => { if (rect) onFrameRef.current?.(Math.round(rect.w), Math.round(rect.h)); }, [rect]);
  useEffect(() => {
    const f = foundRef.current;
    if (!f) return;
    f.boost = scale;
    if (editable && photo) applyPlacement(f, photo, size, value);
  }, [scale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan and zoom, in page pixels.
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; z: number; pid: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** Drawn height in the narrowest frame of this place (as tall as this one). */
  const narrowDh = useCallback((f: Found, z: number) => {
    const nw = f.img.naturalWidth || 1, nh = f.img.naturalHeight || 1;
    const g = geometry(f, focusValue(0.5, 0.5, z));
    if (!minAspect || g.H * minAspect >= g.W) return g.dh;
    return nh * Math.max((g.H * minAspect) / nw, g.H / nh) * z;
  }, [minAspect]);
  const emit = useCallback((cx: number, cy: number, z: number) => {
    const f = foundRef.current; if (!f) return;
    if (f.math === "position") { onChangeRef.current?.(focusValue(clamp(cx, 0, 1), clamp(cy, 0, 1), z)); return; }
    const g = geometry(f, focusValue(cx, cy, z));
    onChangeRef.current?.(focusValue(clampCentre(cx, g.W, g.dw), clampCentre(cy, g.H, narrowDh(f, z)), z));
  }, [narrowDh]);
  const visibleStart = () => {
    const f = foundRef.current; if (!f) return null;
    const g = geometry(f, live.current.value);
    if (f.math === "position") return { cx: g.cx, cy: g.cy, z: g.z };
    // Start from what is on screen: a framing saved for another shape shows clamped.
    return { cx: clampCentre(g.cx, g.W, g.dw), cy: clampCentre(g.cy, g.H, g.dh), z: g.z };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (status !== "ready" || !editable) return;
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
      // object-position: the photo moves with the pointer across its overflow (drawn size at this zoom).
      const ox = g.dw - g.W, oy = g.dh - g.H;
      emit(ox > 0.5 ? d.cx - dx / ox : d.cx, oy > 0.5 ? d.cy - dy / oy : d.cy, d.z);
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
    if (status !== "ready" || !editable || maxZoom <= 1) return;
    const v = visibleStart(); if (!v) return;
    emit(v.cx, v.cy, clamp(v.z * Math.exp(-e.deltaY * 0.0015), 1, maxZoom));
  };
  // The wheel zooms the photo, not the tool page.
  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = layerRef.current; if (!el || !editable || maxZoom <= 1) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, [maxZoom, status, editable]);

  const boxW = rect ? rect.w * scale : Math.min(fitW, fitH * 0.8);
  const boxH = rect ? rect.h * scale : Math.min(fitH, boxW * 1.25);
  return (
    <figure className={`flex min-w-0 flex-col gap-2 ${lift ? "fixed z-[70] items-center justify-center rounded-3xl border border-white/15 bg-[#0f172a] p-4 shadow-2xl" : ""}`}
      style={lift ? { left: lift.left, top: lift.top, width: lift.width, height: lift.height } : undefined}>
      {(label || badge) && <figcaption className="flex min-h-[24px] items-center justify-between gap-3 text-sm" style={lift ? { width: boxW } : undefined}>{label}{lift ? <span className="text-xs text-slate-500">Move out or press Esc to close</span> : badge}</figcaption>}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 transition-[width,height] duration-200" style={{ width: boxW, height: boxH }}>
        <iframe
          ref={iframeRef}
          name={FRAMING_PREVIEW}
          src={url}
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
          className={`absolute inset-0 touch-none select-none ${status === "ready" && editable ? "cursor-grab active:cursor-grabbing" : ""}`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
        />
        {status === "loading" && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Loading the page…</div>
          </div>
        )}
        {status === "ready" && !photoIn && <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs font-bold text-white/80 drop-shadow">Loading photo…</div>}
        {status === "missing" && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-slate-400">This photo is not on the page right now.</div>}
      </div>
    </figure>
  );
}
