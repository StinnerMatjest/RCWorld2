import { parseFocusStr } from "@/app/components/FocusedImage";
import { positionCss } from "@/app/lib/framing";

export const DEFAULT_FOCUS = "0.5 0.5 1";

/** True when a stored focus would change anything against plain object-cover. */
export function hasCustomFocus(focus?: string | null): boolean {
  if (!focus) return false;
  const { cx, cy, zoom } = parseFocusStr(focus);
  return Math.abs(cx - 0.5) > 0.001 || Math.abs(cy - 0.5) > 0.001 || zoom > 1.001;
}

/** A focus point's zoom (1 for none); a zoomed photo needs that many more pixels. */
export const focusZoom = (focus?: string | null) => parseFocusStr(focus).zoom;

/**
 * Frame a cover-fitted <img> the way the crop editor showed it: the focus
 * point at the frame's centre, clamped so no edge of the photo comes inside
 * the frame. The pan is an object-position, so the image keeps the frame's
 * own size and nothing spills out of a frame that does not clip (the deck's
 * cards cannot, see PhotoDeck). A zoom scales the photo from there with a
 * transform and cuts it back to its own box with a clip-path (corners
 * included), so a zoomed photo needs no clipping frame either. Call it on
 * load and again when the frame changes size.
 */
export function placeCover(img: HTMLImageElement, focus: string | null | undefined): void {
  const c = img.parentElement;
  if (!c || !img.naturalWidth || !img.naturalHeight) return;
  const W = c.clientWidth, H = c.clientHeight;
  if (!W || !H) return;
  applyCover(img, W, H, focus);
}

/** Write placeCover's styles for a W x H frame onto the photo (also the clean-up tool's previews and thumbnails). */
export function applyCover(img: HTMLImageElement, W: number, H: number, focus: string | null | undefined): void {
  // The photo's own corner radius, read before a zoom first replaces it with the clip's.
  if (img.dataset.coverRadius === undefined) img.dataset.coverRadius = String(parseFloat(getComputedStyle(img).borderTopLeftRadius) || 0);
  const p = coverStyle(W, H, img.naturalWidth, img.naturalHeight, focus, Number(img.dataset.coverRadius));
  const s = img.style;
  s.objectPosition = p.objectPosition;
  s.transform = p.transform;
  s.transformOrigin = p.transformOrigin;
  s.clipPath = p.clipPath;
  s.borderRadius = p.borderRadius;
}

/**
 * placeCover's styles for a W x H frame and an nw x nh photo whose corners are
 * rounded by `radius` px. With object-fit: cover the drawn size is the frame
 * times the cover scale, and object-position X% puts the image's X% at the
 * frame's X%, i.e. at left = (W - dw) * X. We want left = W/2 - cx * dw, so X
 * solves that; the clamp to 0..1 is the edge rule. A zoom draws the photo
 * zoom times bigger, the focus point at the centre and stopping at the
 * photo's edges (as FocusedImage), all of it inside what the unzoomed box
 * shows, so the transform only scales that box and moves it into place.
 */
export function coverStyle(W: number, H: number, nw: number, nh: number, focus: string | null | undefined, radius = 0) {
  const { cx, cy, zoom } = parseFocusStr(focus);
  const cs = Math.max(W / nw, H / nh);
  const dw = nw * cs, dh = nh * cs;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const x = dw > W + 0.5 ? clamp01((W / 2 - cx * dw) / (W - dw)) : 0.5;
  const y = dh > H + 0.5 ? clamp01((H / 2 - cy * dh) / (H - dh)) : 0.5;
  const objectPosition = `${(x * 100).toFixed(3)}% ${(y * 100).toFixed(3)}%`;
  if (zoom <= 1.001) return { objectPosition, transform: "", transformOrigin: "", clipPath: "", borderRadius: "" };
  const zw = dw * zoom, zh = dh * zoom;
  const left = Math.min(0, Math.max(W - zw, W / 2 - cx * zw));
  const top = Math.min(0, Math.max(H - zh, H / 2 - cy * zh));
  // Scaled about the box's centre, the photo's edge at e lands at W/2 + zoom (e - W/2) + tx.
  const tx = left - (W / 2 + zoom * ((W - dw) * x - W / 2));
  const ty = top - (H / 2 + zoom * ((H - dh) * y - H / 2));
  // The part of the box that lands on the frame, in the box's own pixels.
  const l = W / 2 - (W / 2 + tx) / zoom, t = H / 2 - (H / 2 + ty) / zoom;
  const px = (v: number) => `${Math.max(0, v).toFixed(2)}px`;
  return {
    objectPosition,
    transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${zoom.toFixed(4)})`,
    transformOrigin: "50% 50%",
    clipPath: `inset(${px(t)} ${px(W - l - W / zoom)} ${px(H - t - H / zoom)} ${px(l)}${radius ? ` round ${(radius / zoom).toFixed(2)}px` : ""})`,
    // The photo's own rounding would grow with the zoom: the clip rounds the corners instead.
    borderRadius: "0",
  };
}

/**
 * How a gallery tile frames its photo: its own position when it has one, else
 * the photo's curated framing (a focus point, placed with placeCover once the
 * photo is in), else where it sits in a review, else the centre. So a photo
 * framed anywhere on the page is never framed again just for its tile. A
 * curated framing lends its point, not its zoom: the tile shows the photo.
 */
export function tileFraming(img: { tile_focus?: string | null; focus?: string | null; strip_focus?: string | null; review_pos?: string | null }): { position?: string; focus?: string } {
  if (img.tile_focus) return { position: positionCss(img.tile_focus) };
  const point = (x: string | null | undefined) => { const { cx, cy } = parseFocusStr(x); return `${cx} ${cy} 1`; };
  const f = [img.focus, img.strip_focus].find((x) => x && hasCustomFocus(point(x)));
  if (f) return { focus: point(f) };
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
