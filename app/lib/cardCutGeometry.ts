/**
 * Card cuts: the slice of a photo that the home card actually shows, saved
 * once at native resolution so the card never has to download the whole
 * multi-megabyte original. Pure geometry lives here so the server route and
 * the one-off backfill script share exactly one definition.
 *
 * Why only wide photos: the home card frame is 500 CSS px tall and between
 * 250 and 400 CSS px wide (measured across phones, tablets and desktops), so
 * its aspect is 0.50–0.80. A photo wider than that is always height-limited
 * in the frame (cover scale = frameHeight / visibleHeight), and only the
 * middle band is ever visible. The cut is that band: the full visible height
 * at the card's zoom, and 0.85 × that height wide, which covers the widest
 * frame with margin. Because the cut is still wider than every frame, the
 * frame stays height-limited on the cut too, so the existing focus math
 * renders it identically with zoom 1 and a re-centred focus point.
 *
 * Photos narrower than 0.8 are width-limited in the frame and show most of
 * their height, so their "cut" is the whole photo: what it adds is the set of
 * copies at the widths the cards actually draw (640–1200), which the site-wide
 * 480/1200/1920 ladder skips over. The card's own srcset then lands on the
 * copy that matches the screen's pixels instead of a file twice as wide.
 */

export const CARD_CUT = {
  /** Photos at least this wide-for-their-height get a cut. */
  minAspect: 0.8,
  /** Widest card frame measured is 0.80; the cut is a little wider. */
  frameMaxAspect: 0.85,
  /** Densest phone measured needs 2250 device px of height; native pixels above this are downscaled. */
  maxHeight: 2400,
  /** Whole-photo cuts (narrow photos) are capped at the widest stored size; nothing draws wider. */
  maxWidth: 3840,
  /** WebP quality. The 1920 tier uses 90; the cut is the product, so a notch higher. */
  quality: 92,
  /** Bump when the geometry changes so every cut is regenerated. */
  version: "v2",
  /**
   * Smaller copies saved beside each cut (same slice, fewer pixels) so a
   * screen that needs fewer pixels than the full cut can fetch a matching
   * file. The browser picks via srcset from its own device pixel ratio, so a
   * dense phone still gets the full cut and nothing is ever enlarged. 1200
   * is the densest phone's pick (426 CSS px × 2.8125); the larger widths only
   * exist for cuts wider than them.
   */
  copyWidths: [640, 800, 1000, 1200, 1920, 2560, 3840],
  copyQuality: 90,
} as const;

/** Height of the home card frame in CSS px (min-h-[500px]); measured constant across all screens. */
export const CARD_FRAME_HEIGHT = 500;

export type CardCutRef = { url: string; w: number; h: number; copies?: number[] };

/** R2 key of a copy of a cut: `...-card-<hash>.webp` -> `...-card-<hash>-w640.webp`. */
export function cutCopyKey(cutKey: string, width: number): string {
  return cutKey.replace(/\.webp$/i, `-w${width}.webp`);
}

/** srcset for a cut: its copies plus the full cut, each with its real width. */
export function cutSrcSet(cut: CardCutRef): string {
  const parts = (cut.copies ?? []).filter((w) => w < cut.w).map((w) => `${cutCopyKey(cut.url, w)} ${w}w`);
  parts.push(`${cut.url} ${cut.w}w`);
  return parts.join(", ");
}

export type ImageSize = { w: number; h: number };
export type CardCutPlan = {
  x: number; y: number; cw: number; ch: number;   // slice of the original, source px
  outW: number; outH: number;                       // saved size (native unless taller than maxHeight)
  focus: string;                                    // "cx cy zoom" for the cut (zoom within 0.07% of 1)
};

/** Same parser as the client's parseFocusStr, kept here so server code never imports a client module. */
export function parseFocus(f?: string | null): { cx: number; cy: number; zoom: number } {
  const parts = (f || "0.5 0.5 1").split(" ");
  const zoom = Math.max(1, parseFloat(parts[2] || "1") || 1);
  if (parts[0]?.includes("%")) return { cx: 0.5, cy: 0.5, zoom };
  const cx = parseFloat(parts[0]);
  const cy = parseFloat(parts[1]);
  return {
    cx: isNaN(cx) ? 0.5 : Math.max(0, Math.min(1, cx)),
    cy: isNaN(cy) ? 0.5 : Math.max(0, Math.min(1, cy)),
    zoom,
  };
}

/** Identity of the framing a cut was made for. A cut whose `for` differs from this is stale. */
export function cardCutFor(src: string, focusStr?: string | null): string {
  return `${src}|${focusStr || "0.5 0.5 1"}|${CARD_CUT.version}`;
}

/** Where the cut for (original key, plan) lives on R2. Different framing → different name. */
export function cardCutKey(originalKey: string, plan: CardCutPlan): string {
  const base = originalKey.replace(/\.(jpe?g|png|webp|heic|heif|avif|gif|tiff?)$/i, "");
  return `${base}-card-${fnv1a(`${plan.x},${plan.y},${plan.cw},${plan.ch},${plan.outW},${plan.outH},${CARD_CUT.version}`)}.webp`;
}

/** null when the photo has no size. Narrow photos get a whole-photo plan (see the top of this file). */
export function planCardCut(size: ImageSize, focusStr?: string | null): CardCutPlan | null {
  const W = size.w, H = size.h;
  if (!W || !H) return null;
  const { cx, cy, zoom } = parseFocus(focusStr);
  if (W / H < CARD_CUT.minAspect) {
    const scale = W > CARD_CUT.maxWidth ? CARD_CUT.maxWidth / W : 1;
    return {
      x: 0, y: 0, cw: W, ch: H,
      outW: Math.max(1, Math.round(W * scale)),
      outH: Math.max(1, Math.round(H * scale)),
      focus: `${cx.toFixed(4)} ${cy.toFixed(4)} ${zoom.toFixed(5)}`,
    };
  }

  // Visible band: full height at this zoom, widest frame plus margin. The
  // band is rounded UP to whole pixels and the cut's own zoom (>= 1) trims the
  // fraction back off, so the visible height is exactly H / zoom and the
  // rendered scale matches the original to the pixel.
  const exactH = Math.min(H, H / zoom);
  const ch = Math.max(1, Math.min(H, Math.ceil(exactH)));
  const zoomFix = ch / exactH; // 1.0000–1.0007
  const cw = Math.max(1, Math.min(W, Math.round(ch * CARD_CUT.frameMaxAspect)));

  // Centre it on the focus point, but keep it inside the photo. The card can
  // only ever show pixels inside the photo anyway, so this drops nothing.
  const x = clamp(Math.round(cx * W - cw / 2), 0, W - cw);
  const y = clamp(Math.round(cy * H - ch / 2), 0, H - ch);

  // Focus point expressed in the cut's own coordinates.
  const fx = clamp((cx * W - x) / cw, 0, 1);
  const fy = clamp((cy * H - y) / ch, 0, 1);

  const scale = ch > CARD_CUT.maxHeight ? CARD_CUT.maxHeight / ch : 1;
  return {
    x, y, cw, ch,
    outW: Math.max(1, Math.round(cw * scale)),
    outH: Math.max(1, Math.round(ch * scale)),
    focus: `${fx.toFixed(4)} ${fy.toFixed(4)} ${zoomFix.toFixed(5)}`,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function fnv1a(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}
