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

/** URL to serve for an R2 image at roughly `width` CSS px (× DPR); the original for non-R2 sources. */
export function variantUrl(src: string, width: number): string {
  if (!isR2Image(src)) return src;
  const w = pickVariantWidth(width);
  return w === null ? src : variantKey(src, w);
}
