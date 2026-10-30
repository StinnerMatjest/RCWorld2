import { parseFocusStr } from "@/app/components/FocusedImage";
import { positionCss } from "@/app/lib/framing";

export const DEFAULT_FOCUS = "0.5 0.5 1";

/** True when a stored focus would change anything against plain object-cover. */
export function hasCustomFocus(focus?: string | null): boolean {
  if (!focus) return false;
  const { cx, cy } = parseFocusStr(focus);
  return Math.abs(cx - 0.5) > 0.001 || Math.abs(cy - 0.5) > 0.001;
}

/**
 * Frame a cover-fitted <img> the way the crop editor showed it: the focus
 * point at the frame's centre, clamped so no edge of the photo comes inside
 * the frame. Expressed as object-position, so the image keeps the frame's
 * own size and nothing spills out of a frame that does not clip (the deck's
 * cards cannot, see PhotoDeck). Zoom is not representable this way, so the
 * curated-photo editor is pan-only. Call it on load and again when the
 * frame changes size.
 *
 * With object-fit: cover the drawn size is the frame times the cover scale,
 * and object-position X% puts the image's X% at the frame's X%, i.e. at
 * left = (W - dw) * X. We want left = W/2 - cx * dw, so X solves that; the
 * clamp to 0..1 is the edge rule.
 */
export function placeCover(img: HTMLImageElement, focus: string | null | undefined): void {
  const c = img.parentElement;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!c || !nw || !nh) return;
  const W = c.clientWidth, H = c.clientHeight;
  if (!W || !H) return;
  img.style.objectPosition = coverPosition(W, H, nw, nh, focus);
}

/** placeCover's object-position for a W x H frame and an nw x nh photo (also used by the clean-up tool's preview). */
export function coverPosition(W: number, H: number, nw: number, nh: number, focus: string | null | undefined): string {
  const { cx, cy } = parseFocusStr(focus);
  const cs = Math.max(W / nw, H / nh);
  const dw = nw * cs, dh = nh * cs;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const x = dw > W + 0.5 ? clamp01((W / 2 - cx * dw) / (W - dw)) : 0.5;
  const y = dh > H + 0.5 ? clamp01((H / 2 - cy * dh) / (H - dh)) : 0.5;
  return `${(x * 100).toFixed(3)}% ${(y * 100).toFixed(3)}%`;
}

/**
 * How a gallery tile frames its photo: its own position when it has one, else
 * the photo's curated framing (a focus point, placed with placeCover once the
 * photo is in), else where it sits in a review, else the centre. So a photo
 * framed anywhere on the page is never framed again just for its tile.
 */
export function tileFraming(img: { tile_focus?: string | null; focus?: string | null; strip_focus?: string | null; review_pos?: string | null }): { position?: string; focus?: string } {
  if (img.tile_focus) return { position: positionCss(img.tile_focus) };
  const f = [img.focus, img.strip_focus].find((x) => hasCustomFocus(x));
  if (f) return { focus: f };
  if (img.review_pos) return { position: positionCss(img.review_pos) };
  return {};
}

/**
 * Place every loaded image inside a frame that carries data-focus under
 * `root`: on mount (a server-rendered photo is often complete before React
 * hydrates, so its onLoad never fires) and after a resize or rotation.
 */
export function replaceCovers(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-focus]").forEach((frame) => {
    const img = frame.querySelector<HTMLImageElement>(":scope > img");
    if (img && img.complete && img.naturalWidth) placeCover(img, frame.dataset.focus);
  });
}
