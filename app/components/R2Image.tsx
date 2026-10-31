"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isR2Image, isWebFormat, variantKey, VARIANT_WIDTHS } from "@/app/lib/imageVariants";

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
  /** Offer the original above the stored sizes (default): a photo drawn wider than 3840 device px needs it. */
  original?: boolean;
};

/**
 * The sizes hints assume a photo about as wide as its box, but a wide photo in a
 * narrower cover frame is drawn wider, a zoomed one wider still. Once the file is
 * in, compare: a srcset image reports the width its hint gave it, so when it is
 * drawn wider the hint grows to the drawn width and the browser fetches the
 * stored size (or the original) that covers it. The next load matches and stops.
 */
export function stepUp(img: HTMLImageElement) {
  // Only a srcset choice can step up (a lone src, such as the clean-up tool's preview sets, has nothing to pick).
  if (!img.srcset || !img.naturalWidth || !img.naturalHeight || !img.clientWidth || !img.clientHeight) return;
  const cs = getComputedStyle(img);
  const z = cs.transform && cs.transform !== "none" ? new DOMMatrix(cs.transform).a : 1;
  const a = img.naturalWidth / img.naturalHeight;
  const box = cs.objectFit === "cover" ? Math.max(img.clientWidth, img.clientHeight * a)
    : cs.objectFit === "contain" ? Math.min(img.clientWidth, img.clientHeight * a) : img.clientWidth;
  // Hinted 4% under the drawn width (as the hero is): an enlargement that small is invisible,
  // while a few px short would take the next file up, the original at many times the bytes.
  const want = Math.ceil(box * z * 0.96);
  const next = `${want}px`;
  // Setting sizes, even to the same value, makes the browser fetch again: only when it grows.
  if (want > img.naturalWidth && img.sizes !== next) img.sizes = next;
}

export function R2Image(props: Props) {
  const [fallback, setFallback] = useState(false);
  const { fetchPriority, original = true, ...imageProps } = props;
  // A photo that was in before hydration fired its load before React listened.
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { const img = ref.current; if (img?.complete) stepUp(img); }, [props.src, props.sizes]);
  const { src, alt, fill, sizes, className, style, width, height, priority, loading, draggable, onLoad, onClick } = imageProps;

  if (fallback || typeof src !== "string" || !isR2Image(src)) {
    return <Image {...imageProps} alt={alt} />;
  }

  // The original only when browsers can show it (an iPhone HEIC original cannot be).
  const withOriginal = original && isWebFormat(src);
  const srcSet = [...VARIANT_WIDTHS.map((w) => `${variantKey(src, w)} ${w}w`), ...(withOriginal ? [`${src} 4000w`] : [])].join(", ");
  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : style;
  const sizesAttr = sizes ?? (fill ? "100vw" : width ? `${width}px` : undefined);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
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
      onLoad={(e) => { stepUp(e.currentTarget); onLoad?.(e); }}
      onClick={onClick}
      onError={() => setFallback(true)}
    />
  );
}
