import { isR2Image, variantKey, VARIANT_WIDTHS } from "@/app/lib/imageVariants";

// Stored sizes plus the original, so the browser fetches the smallest file
// whose pixels cover the hero on its screen. The frame is 100vw wide and
// 5/4 vw (phone), 9/16 vw (tablet) or 9/21 vw (desktop) tall, so a photo of aspect a is drawn
// max(100vw, frameHeight × a) wide, times the framing's zoom (the phone frame
// has its own framing, so its own zoom). Shared by the park and the coaster cover.
export function heroSources(src: string, size: { w: number; h: number }, zoom: { phone: number; wide: number } = { phone: 1, wide: 1 }): { srcSet: string; sizes: string } | undefined {
  if (!isR2Image(src) || !size.w || !size.h) return undefined;
  const a = size.w / size.h;
  const parts = VARIANT_WIDTHS.filter((w) => w < size.w).map((w) => `${variantKey(src, w)} ${w}w`);
  parts.push(`${src} ${size.w}w`);
  // Hinted 4% under the drawn width: an enlargement that small is invisible,
  // while a 2 px shortfall would make the browser take the next stored size
  // at 2.5x the bytes (a 4:3 photo in the 4:5 phone frame on a 1.75x screen
  // needs 1202 px; this keeps it on the 1200 variant).
  const vw = (frameH: number, z: number) => `${Math.floor(Math.max(1, frameH * a) * Math.max(1, z) * 100 * 0.96)}vw`;
  return { srcSet: parts.join(", "), sizes: `(min-width: 1024px) ${vw(9 / 21, zoom.wide)}, (min-width: 640px) ${vw(9 / 16, zoom.wide)}, ${vw(5 / 4, zoom.phone)}` };
}

/**
 * A cover's own phone photo, for phones only (below 640 px): a <picture>
 * source with the same size rule. Without a known size the stored sizes are
 * offered up to the original, hinted for a wide photo in the tall frame, so
 * the phone never gets fewer pixels than it needs.
 */
export function phoneSource(src: string, size?: { w: number; h: number }, zoom = 1): { media: string; srcSet: string; sizes?: string } {
  const media = "(max-width: 639px)";
  if (!isR2Image(src)) return { media, srcSet: src };
  if (!size?.w || !size?.h) {
    const parts = VARIANT_WIDTHS.map((w) => `${variantKey(src, w)} ${w}w`);
    return { media, srcSet: [...parts, `${src} 4000w`].join(", "), sizes: `${Math.ceil(190 * Math.max(1, zoom))}vw` };
  }
  const all = heroSources(src, size)!;
  return { media, srcSet: all.srcSet, sizes: `${Math.floor(Math.max(1, (5 / 4) * (size.w / size.h)) * Math.max(1, zoom) * 100 * 0.96)}vw` };
}
