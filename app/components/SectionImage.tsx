"use client";

import { R2Image } from "./R2Image";
import { useRef, type CSSProperties } from "react";
import styles from "./SectionImage.module.css";

/** A sizes hint for a photo drawn `z` times larger: each size (not the media conditions) times z. */
function scaleSizes(sizes: string, z: number): string {
  return sizes.split(",").map((part) => part.replace(/(\d+(?:\.\d+)?)(vw|px)\s*$/, (_, n: string, unit: string) => `${Math.ceil(Number(n) * z)}${unit}`)).join(",");
}

// All section images crop into the same frame, positioned by the focal point.
// The frame is a bit taller on mobile and shorter on desktop (responsive aspect),
// driven by the --aspect-m / --aspect-d custom properties. A zoomed-in photo is
// scaled from that same point, so it still never shows past its own edges.
export function SectionImage({
  src, alt, cx, cy, mcx, mcy, zoom = 1, mzoom, mobileAspect, desktopAspect, sizes, framing,
}: {
  src: string;
  alt: string;
  /** Position in the desktop frame (object-position, 0-1). */
  cx: number;
  cy: number;
  /** Position in the phone frame; absent = the desktop position. */
  mcx?: number;
  mcy?: number;
  /** Zoom in the desktop frame (1 = the whole frame width), and in the phone frame (absent = the desktop zoom). */
  zoom?: number;
  mzoom?: number;
  mobileAspect: string;
  desktopAspect: string;
  sizes: string;
  /** Marker for the clean-up tool's preview (framingPreview.ts). */
  framing?: string;
}) {
  const zd = Math.max(1, zoom), zm = Math.max(1, mzoom ?? zoom);
  // Only a zoomed photo gets the scale (an unzoomed one renders exactly as before),
  // and its size hint grows with the zoom so the browser fetches enough pixels.
  const zoomed = zd > 1.001 || zm > 1.001;
  const z = Math.max(zd, zm);
  // The photo steps up to a sharper file by itself once drawn (R2Image).
  const frameRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={frameRef}
      className={`${styles.frame} relative w-full overflow-hidden rounded-2xl`}
      data-framing={framing}
      data-framing-math="position"
      style={{ "--aspect-m": mobileAspect, "--aspect-d": desktopAspect, "--pos-d": `${cx * 100}% ${cy * 100}%`, "--pos-m": `${(mcx ?? cx) * 100}% ${(mcy ?? cy) * 100}%`, ...(zoomed ? { "--z-d": zd, "--z-m": zm } : {}) } as CSSProperties}
    >
      <R2Image
        src={src}
        alt={alt}
        fill
        sizes={zoomed ? scaleSizes(sizes, z) : sizes}
        quality={90}
        className={`object-cover rounded-2xl ${styles.pos} ${zoomed ? styles.zoom : ""}`}
      />
    </div>
  );
}
