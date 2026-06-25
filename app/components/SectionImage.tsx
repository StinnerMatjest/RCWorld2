"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./SectionImage.module.css";

// All section images crop into the same frame, positioned by the focal point.
// The frame is a bit taller on mobile and shorter on desktop (responsive aspect),
// driven by the --aspect-m / --aspect-d custom properties.
export function SectionImage({
  src, alt, cx, cy, mobileAspect, desktopAspect, sizes,
}: {
  src: string;
  alt: string;
  cx: number;
  cy: number;
  mobileAspect: string;
  desktopAspect: string;
  sizes: string;
}) {
  return (
    <div
      className={`${styles.frame} relative w-full overflow-hidden rounded-2xl`}
      style={{ "--aspect-m": mobileAspect, "--aspect-d": desktopAspect } as CSSProperties}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={90}
        style={{ objectPosition: `${cx * 100}% ${cy * 100}%` }}
        className="object-cover rounded-2xl"
      />
    </div>
  );
}
