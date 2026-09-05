"use client";

import Image, { type ImageProps } from "next/image";
import { useState, type CSSProperties } from "react";
import { isR2Image, variantKey, VARIANT_WIDTHS } from "@/app/lib/imageVariants";

/**
 * Drop-in for next/image that serves the pre-generated R2 variants
 * (see app/lib/imageVariants.ts) straight from the CDN instead of running the
 * on-server optimiser. It emits one srcset entry per stored width, so the browser
 * picks the smallest variant that covers the rendered size × DPR.
 *
 * Non-R2 sources render through next/image unchanged, and if a variant is missing
 * (an upload that predates the backfill) the image falls back to next/image too.
 */
export function R2Image(props: ImageProps) {
  const [fallback, setFallback] = useState(false);
  const { src, alt, fill, sizes, className, style, width, height, priority, loading, draggable, onLoad, onClick } = props;

  if (fallback || typeof src !== "string" || !isR2Image(src)) {
    return <Image {...props} alt={alt} />;
  }

  const srcSet = VARIANT_WIDTHS.map((w) => `${variantKey(src, w)} ${w}w`).join(", ");
  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : style;
  const sizesAttr = sizes ?? (fill ? "100vw" : width ? `${width}px` : undefined);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={variantKey(src, 1200)}
      srcSet={srcSet}
      sizes={sizesAttr}
      alt={alt}
      className={className}
      style={fillStyle}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? "eager" : (loading ?? "lazy")}
      decoding="async"
      draggable={draggable}
      onLoad={onLoad}
      onClick={onClick}
      onError={() => setFallback(true)}
    />
  );
}
