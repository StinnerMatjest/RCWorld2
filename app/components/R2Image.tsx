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
  /** Offer the original too (a zoomed-in photo can need more pixels than the largest stored size). */
  original?: boolean;
};

export function R2Image(props: Props) {
  const [fallback, setFallback] = useState(false);
  const { fetchPriority, original, ...imageProps } = props;
  const { src, alt, fill, sizes, className, style, width, height, priority, loading, draggable, onLoad, onClick } = imageProps;

  if (fallback || typeof src !== "string" || !isR2Image(src)) {
    return <Image {...imageProps} alt={alt} />;
  }

  // The original only when browsers can show it (an iPhone HEIC original cannot be).
  const withOriginal = original && /\.(jpe?g|png|webp|avif|gif)$/i.test(src);
  const srcSet = [...VARIANT_WIDTHS.map((w) => `${variantKey(src, w)} ${w}w`), ...(withOriginal ? [`${src} 4000w`] : [])].join(", ");
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
