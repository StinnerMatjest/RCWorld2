"use client";

import React, { useRef, useEffect, useCallback } from "react";

export interface FocusedImageProps {
  src: string;
  alt?: string;
  focusStr?: string | null;
  className?: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  priority?: boolean;
  onLoad?: () => void;
  /** Route the src through Next's image optimizer at this width (must be one of
   *  Next's device sizes). Plain <img> tags otherwise download the full-size
   *  original, which makes first loads slow and staggered. */
  optimizeWidth?: 640 | 750 | 828 | 1080 | 1200 | 1920;
  /** Entrance-stagger slot in ms, measured from mount. A fresh-load fade waits
   *  for this slot if it hasn't passed, so the image reveal lines up with the
   *  container's own staggered entrance animation. */
  staggerDelayMs?: number;
}

// Rewrite an image URL to Next's optimizer endpoint — the same endpoint
// next/image uses (and which the gallery already exercises in production).
// Gives plain <img> tags resized/re-encoded variants instead of R2 originals.
export function optimizedSrc(src: string, w: 640 | 750 | 828 | 1080 | 1200 | 1920 = 1080, q = 85): string {
  if (!src || src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("/_next/")) return src;
  if (/\.(mp4|webm|ogg)$/i.test(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}

// Parse "cx cy zoom" (new) or "X% Y% zoom" (old) focus strings.
// cx, cy are 0–1 fractions of the image width/height at the visible centre.
export function parseFocusStr(f?: string | null): { cx: number; cy: number; zoom: number } {
  const parts = (f || "0.5 0.5 1").split(" ");
  const zoom = Math.max(1, parseFloat(parts[2] || "1") || 1);
  if (parts[0]?.includes("%")) {
    // Old format: objectPosition percentages — treat as centered (pan data was unreliable)
    return { cx: 0.5, cy: 0.5, zoom };
  }
  const cx = parseFloat(parts[0]);
  const cy = parseFloat(parts[1]);
  return {
    cx: isNaN(cx) ? 0.5 : Math.max(0, Math.min(1, cx)),
    cy: isNaN(cy) ? 0.5 : Math.max(0, Math.min(1, cy)),
    zoom,
  };
}

// Section images store an optional focus packed into the value as "url|cx cy zoom".
// Splits it back out; images saved without a focus default to centered.
export function splitMedia(entry: string): { url: string; focus: string } {
  const i = entry.indexOf("|");
  if (i === -1) return { url: entry, focus: "0.5 0.5 1" };
  return { url: entry.slice(0, i), focus: entry.slice(i + 1) || "0.5 0.5 1" };
}

// Renders an image absolutely positioned inside an overflow-hidden container,
// matching exactly what CropEditor shows for the given focusStr.
export function FocusedImage({
  src, alt = "", focusStr, className = "", imgClassName = "", imgStyle, priority, onLoad: onLoadProp, optimizeWidth, staggerDelayMs = 0,
}: FocusedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const nwRef = useRef(0);
  const nhRef = useRef(0);
  const focusRef = useRef(focusStr);
  // First reveal only: fresh network loads fade in; cached images (the
  // complete-check path below) appear instantly so back-navigation doesn't blink.
  const revealedRef = useRef(false);
  const fadeInRef = useRef(false);
  const mountTsRef = useRef(0);
  const staggerRef = useRef(staggerDelayMs);
  useEffect(() => { focusRef.current = focusStr; staggerRef.current = staggerDelayMs; });

  const applyStyle = useCallback(() => {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !nwRef.current || !nhRef.current) return;
    const { cx, cy, zoom } = parseFocusStr(focusRef.current);
    const cs = Math.max(c.clientWidth / nwRef.current, c.clientHeight / nhRef.current);
    const dw = nwRef.current * cs * zoom;
    const dh = nhRef.current * cs * zoom;
    img.style.width = `${dw}px`;
    img.style.height = `${dh}px`;
    img.style.left = `${c.clientWidth / 2 - cx * dw}px`;
    img.style.top = `${c.clientHeight / 2 - cy * dh}px`;
    // Hidden until positioned (see render) — reveal now that the math is done
    if (!revealedRef.current) {
      revealedRef.current = true;
      if (fadeInRef.current) {
        // Wait for the container's entrance-stagger slot if it hasn't passed.
        const elapsed = mountTsRef.current ? performance.now() - mountTsRef.current : Infinity;
        const wait = Math.max(0, staggerRef.current - elapsed);
        img.style.opacity = "0";
        img.style.visibility = "visible";
        requestAnimationFrame(() => {
          img.style.transition = `opacity 500ms ease ${Math.round(wait)}ms`;
          // Clearing the inline value lets it settle at the class-defined
          // opacity (e.g. opacity-70), not a hardcoded 1.
          img.style.opacity = "";
        });
      } else {
        img.style.visibility = "visible";
      }
    } else {
      img.style.visibility = "visible";
    }
  }, []);

  useEffect(() => {
    if (!mountTsRef.current) mountTsRef.current = performance.now();
    // With SSR the image can finish loading before React attaches onLoad
    // (cached or fast images) — capture dimensions from the complete img
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && !nwRef.current) {
      nwRef.current = img.naturalWidth;
      nhRef.current = img.naturalHeight;
      applyStyle();
      onLoadProp?.();
    }
    applyStyle();
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(applyStyle);
    ro.observe(c);
    return () => ro.disconnect();
  }, [focusStr, applyStyle]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={optimizeWidth ? optimizedSrc(src, optimizeWidth) : src}
        alt={alt}
        draggable={false}
        className={`absolute max-w-none select-none ${imgClassName}`}
        style={{ ...imgStyle, visibility: "hidden" }}
        loading={priority ? "eager" : "lazy"}
        onLoad={(e) => {
          nwRef.current = e.currentTarget.naturalWidth;
          nhRef.current = e.currentTarget.naturalHeight;
          // A load event (vs. the complete-check in the effect) means the bytes
          // just arrived over the network — fade the reveal instead of popping.
          if (!revealedRef.current) fadeInRef.current = true;
          applyStyle();
          onLoadProp?.();
        }}
      />
    </div>
  );
}
