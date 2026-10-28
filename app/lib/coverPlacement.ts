import { parseFocusStr } from "@/app/components/FocusedImage";

export const DEFAULT_FOCUS = "0.5 0.5 1";

/** True when a stored focus would change anything against plain object-cover. */
export function hasCustomFocus(focus?: string | null): boolean {
  if (!focus) return false;
  const { cx, cy, zoom } = parseFocusStr(focus);
  return zoom > 1.001 || Math.abs(cx - 0.5) > 0.001 || Math.abs(cy - 0.5) > 0.001;
}

/**
 * Place an <img> inside its (position: relative, overflow: hidden) parent the
 * way the crop editor framed it: cover the frame, times the zoom, focus point
 * at the frame's centre, clamped so no edge of the photo comes inside the
 * frame. Same arithmetic as FocusedImage, as inline px, so it works on a plain
 * <img> (R2Image) that already carries srcset and sizes. Call it on load and
 * again whenever the frame changes size.
 */
export function placeCover(img: HTMLImageElement, focus: string | null | undefined): void {
  const c = img.parentElement;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!c || !nw || !nh) return;
  const W = c.clientWidth, H = c.clientHeight;
  if (!W || !H) return;
  const { cx, cy, zoom } = parseFocusStr(focus);
  const cs = Math.max(W / nw, H / nh);
  const dw = nw * cs * zoom, dh = nh * cs * zoom;
  img.style.position = "absolute";
  img.style.width = `${dw}px`;
  img.style.height = `${dh}px`;
  img.style.left = `${Math.min(0, Math.max(W - dw, W / 2 - cx * dw))}px`;
  img.style.top = `${Math.min(0, Math.max(H - dh, H / 2 - cy * dh))}px`;
  img.style.right = "auto";
  img.style.bottom = "auto";
  img.style.maxWidth = "none";
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
