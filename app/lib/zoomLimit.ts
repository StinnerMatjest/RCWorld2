import { SECTION_IMAGE_ASPECT, type SectionFrame } from "@/app/utils/sectionImageAspect";

/** A frame's size in device pixels: width, height. */
export type Box = readonly [number, number];

// Device pixels a frame takes on the sharpest common screens: iPhone Pro Max (430 px @3),
// iPads (744-1023 px @2) and a MacBook (1512 px @2). A photo covers its frame and a framing's
// zoom scales it from there, so at zoom z the photo needs z times the frame on both axes.
export const SHARP = {
  /** Park and coaster cover below 640 px: 4:5, full width. */
  coverPhone: [1290, 1613],
  /** Cover from 640 px: 21:9, full width on a MacBook (16:9 on tablets needs less). */
  coverDesktop: [3024, 1296],
  /** Front page card: the phone strip card, about 310 x 500 px (desktop cards need less). */
  card: [930, 1500],
} as const satisfies Record<string, Box>;

const ratio = (s: string) => { const [a, b] = s.split("/").map((n) => parseFloat(n)); return a / (b || 1); };

/**
 * A review photo's frames. Below 768 px (phones, iPad mini) the photo is 94vw, up to 1400 px
 * across; from 768 px it is the review column (16:7, MacBook 1512), beside the text (tall 3:4,
 * 665) or one of two side by side (3:2, 756).
 */
export function sectionBoxes(frame: SectionFrame): { phone: Box; desktop: Box } {
  const dw = frame.desktop === SECTION_IMAGE_ASPECT.full.desktop ? 1512 : frame.desktop === SECTION_IMAGE_ASPECT.tall.desktop ? 665 : 756;
  return { phone: [1400, Math.round(1400 / ratio(frame.mobile))], desktop: [dw, Math.round(dw / ratio(frame.desktop))] };
}

/**
 * How far a photo of this size can zoom in these frames and stay sharp: never drawn bigger
 * than its own pixels (up to 4% over, as R2Image's stepUp). 1 = no zoom; unknown size = 1.
 */
export function zoomLimit(size: { w: number; h: number } | null | undefined, boxes: readonly Box[], max = 4): number {
  if (!size?.w || !size.h) return 1;
  const z = Math.min(...boxes.map(([w, h]) => Math.min(size.w / w, size.h / h))) / 0.96;
  return Math.max(1, Math.min(max, Math.floor(z * 100) / 100));
}

/** The framing with its zoom brought down to the limit ("cx cy zoom"). */
export function capZoom(value: string, limit: number): string {
  const p = value.split(" ");
  return Number(p[2]) > limit ? `${p[0]} ${p[1]} ${limit.toFixed(3)}` : value;
}
