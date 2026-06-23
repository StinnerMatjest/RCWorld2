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
  src, alt = "", focusStr, className = "", imgClassName = "", imgStyle, priority, onLoad: onLoadProp,
}: FocusedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const nwRef        = useRef(0);
  const nhRef        = useRef(0);
  const focusRef     = useRef(focusStr);
  useEffect(() => { focusRef.current = focusStr; });

  const applyStyle = useCallback(() => {
    const c   = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !nwRef.current || !nhRef.current) return;
    const { cx, cy, zoom } = parseFocusStr(focusRef.current);
    const cs = Math.max(c.clientWidth / nwRef.current, c.clientHeight / nhRef.current);
    const dw = nwRef.current * cs * zoom;
    const dh = nhRef.current * cs * zoom;
    img.style.width  = `${dw}px`;
    img.style.height = `${dh}px`;
    img.style.left   = `${c.clientWidth  / 2 - cx * dw}px`;
    img.style.top    = `${c.clientHeight / 2 - cy * dh}px`;
    // Hidden until positioned (see render) — reveal now that the math is done
    img.style.visibility = "visible";
  }, []);

  useEffect(() => {
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
        src={src}
        alt={alt}
        draggable={false}
        className={`absolute max-w-none select-none ${imgClassName}`}
        style={{ ...imgStyle, willChange: "width, height, left, top", visibility: "hidden" }}
        loading={priority ? "eager" : "lazy"}
        onLoad={(e) => {
          nwRef.current = e.currentTarget.naturalWidth;
          nhRef.current = e.currentTarget.naturalHeight;
          applyStyle();
          onLoadProp?.();
        }}
      />
    </div>
  );
}
