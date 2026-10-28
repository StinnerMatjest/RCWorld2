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
type Props = ImageProps & {
  /** Browser fetch priority; "low" keeps a below-the-fold photo from racing the hero. */
  fetchPriority?: "high" | "low" | "auto";
};

export function R2Image(props: Props) {
  const [fallback, setFallback] = useState(false);
  const { src, alt, fill, sizes, className, style, width, height, priority, loading, draggable, onLoad, onClick, fetchPriority } = props;

  if (fallback || typeof src !== "string" || !isR2Image(src)) {
    const { fetchPriority: _fp, ...rest } = props;
    return <Image {...rest} alt={alt} />;
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
      // camelCase: React 19 maps it to the attribute and, for "low", does not
      // hoist a preload link for the image (eager images otherwise get one).
      fetchPriority={fetchPriority}
      decoding="async"
      draggable={draggable}
      onLoad={onLoad}
      onClick={onClick}
      onError={() => setFallback(true)}
    />
  );
}
