"use client";

import { R2Image } from "./R2Image";
import type { CSSProperties } from "react";
import styles from "./SectionImage.module.css";

// All section images crop into the same frame, positioned by the focal point.
// The frame is a bit taller on mobile and shorter on desktop (responsive aspect),
// driven by the --aspect-m / --aspect-d custom properties.
export function SectionImage({
  src, alt, cx, cy, mcx, mcy, mobileAspect, desktopAspect, sizes, framing,
}: {
  src: string;
  alt: string;
  /** Position in the desktop frame (object-position, 0-1). */
  cx: number;
  cy: number;
  /** Position in the phone frame; absent = the desktop position. */
  mcx?: number;
  mcy?: number;
  mobileAspect: string;
  desktopAspect: string;
  sizes: string;
  /** Marker for the clean-up tool's preview (framingPreview.ts). */
  framing?: string;
}) {
  return (
    <div
      className={`${styles.frame} relative w-full overflow-hidden rounded-2xl`}
      data-framing={framing}
      style={{ "--aspect-m": mobileAspect, "--aspect-d": desktopAspect, "--pos-d": `${cx * 100}% ${cy * 100}%`, "--pos-m": `${(mcx ?? cx) * 100}% ${(mcy ?? cy) * 100}%` } as CSSProperties}
    >
      <R2Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={90}
        className={`object-cover rounded-2xl ${styles.pos}`}
      />
    </div>
  );
}
