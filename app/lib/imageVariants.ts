/**
 * Pre-generated image variants on R2.
 *
 * Every image uploaded to the public R2 bucket gets resized copies stored next
 * to the original: `<name>-w480.webp`, `-w1200.webp` and `-w1920.webp`. Pages load those
 * straight from the CDN instead of asking the Next.js image optimiser to resize
 * the multi-megabyte original on the fly (whose cache is wiped on every deploy).
 *
 * `scripts/backfill-image-variants.mjs` creates them for existing files; the
 * upload API creates them for new ones.
 */

export const VARIANT_WIDTHS = [480, 1200, 1920] as const;
export type VariantWidth = (typeof VARIANT_WIDTHS)[number];

/** WebP quality per size: thumbnails can be lighter, the large sizes match the quality the pages used before (90). */
export const VARIANT_QUALITY: Record<VariantWidth, number> = { 480: 82, 1200: 88, 1920: 90 };

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|avif|gif|tiff?)$/i;
const VARIANT_SUFFIX = /-w\d+\.webp$/i;

/** True for images that live in the public R2 bucket (and are not already a variant). */
export function isR2Image(src: string): boolean {
  return /^https:\/\/pub-[a-z0-9]+\.r2\.dev\//i.test(src) && IMAGE_EXT.test(src) && !VARIANT_SUFFIX.test(src);
}

/** Object key of a variant for an original key, e.g. `a-1.jpg` → `a-1-w480.webp`. */
export function variantKey(key: string, width: VariantWidth): string {
  return key.replace(IMAGE_EXT, "") + `-w${width}.webp`;
}

/** Smallest stored variant that is at least `width` wide, or null when the original is needed. */
export function pickVariantWidth(width: number): VariantWidth | null {
  for (const w of VARIANT_WIDTHS) if (width <= w) return w;
  return null;
}

/**
 * For a frame that cover-crops the photo (home cards): the smallest stored
 * variant that should cover `cssW × cssH` CSS px on a screen with this DPR.
 * The source aspect is unknown before load, so a portrait-ish 3:4 photo is
 * assumed (the cheaper guess: lazy cards only load as they scroll into view,
 * and a landscape photo that turns out too small steps up one size). Never
 * returns the original: cards top out at the largest stored size. A 3:4 photo is
 * assumed; callers check the real scale after load and step up with
 * `nextLargerVariant` if the pick turns out to be enlarged. That way a screen
 * never gets fewer source pixels than it can show, but downloads a fraction of
 * the original.
 */
export function coverVariantUrl(src: string, cssW: number, cssH: number, dpr: number): string {
  if (!isR2Image(src)) return src;
  const need = Math.max(cssW, cssH * 0.75) * dpr;
  const w = VARIANT_WIDTHS.find((v) => v >= need) ?? VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];
  return variantKey(src, w);
}

/**
 * The next stored size above the variant `current`; null when `current` is
 * already the largest stored size (or the original), or `src` is not an R2
 * image. Never returns the original: a cover-cropped card is at most a few
 * hundred CSS px wide, and the multi-megabyte original is for the lightbox.
 */
export function nextLargerVariant(src: string, current: string): string | null {
  if (!isR2Image(src)) return null;
  const m = current.match(/-w(\d+)\.webp(?:\?.*)?$/i);
  if (!m) return null;
  const cur = Number(m[1]);
  const next = VARIANT_WIDTHS.find((v) => v > cur);
  return next ? variantKey(src, next) : null;
}

/**
 * Enlargement a cover-cropped card tolerates before stepping up a size. A
 * landscape 1920px photo filling a tall phone card is enlarged ~1.1x, which is
 * invisible at card size; refetching for that used to pull the original.
 */
export const COVER_UPSCALE_TOLERANCE = 1.25;

/** True for a stored variant URL (`...-w1200.webp`). */
export function isVariantUrl(url: string): boolean {
  return VARIANT_SUFFIX.test(url.split("?")[0]);
}

/**
 * What a cover-cropped frame should load next when the current file is being
 * enlarged beyond COVER_UPSCALE_TOLERANCE: the next stored size, or, when the
 * largest stored size is already the one being enlarged (wide panoramas in a
 * tall phone card, with crop zoom on top), the original. Null when nothing
 * larger exists or the source is not an R2 image.
 */
export function sharperSource(src: string, current: string): string | null {
  if (!isR2Image(src)) return null;
  const next = nextLargerVariant(src, current);
  if (next) return next;
  return isVariantUrl(current) ? src : null;
}

/**
 * Exact pick for a frame that cover-crops a photo whose pixel size is known:
 * the smallest stored size whose pixels cover the frame on this screen
 * (including crop zoom), or the original when even the largest stored size
 * would have to be enlarged. No guessing, no second download.
 *
 * `cssW × cssH` is the frame in CSS px, `zoom` the crop zoom (>= 1), `dpr`
 * the device pixel ratio. Non-R2 sources are returned unchanged.
 */
export function exactCoverSrc(src: string, size: { w: number; h: number }, cssW: number, cssH: number, zoom: number, dpr: number): string {
  if (!isR2Image(src) || !size.w || !size.h) return src;
  // Scale at which the photo is drawn to cover the frame, in device px per source px.
  const drawn = Math.max(cssW / size.w, cssH / size.h) * Math.max(1, zoom) * dpr;
  // Source width that would be drawn 1:1 on device pixels.
  const needW = size.w * drawn;
  const w = VARIANT_WIDTHS.find((v) => v >= needW);
  if (!w) return src; // only the original has enough pixels
  return variantKey(src, w); // stored for every width (not enlarged), so the key always exists
}

/** URL to serve for an R2 image at roughly `width` CSS px (× DPR); the original for non-R2 sources. */
export function variantUrl(src: string, width: number): string {
  if (!isR2Image(src)) return src;
  const w = pickVariantWidth(width);
  return w === null ? src : variantKey(src, w);
}
