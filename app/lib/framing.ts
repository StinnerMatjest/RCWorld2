// Pure framing helpers, safe on server and client.
//
// Two kinds of framing value exist on the site, both stored as "x y z":
// - focus point (heroes, home card, curated deck): the point of the photo at
//   the frame's centre, times a zoom; drawn by FocusedImage / placeCover.
// - position (review-section photos, gallery tiles, list images): CSS
//   object-position percentages, no zoom; drawn with object-fit: cover.

/** "x y z" position percentages as a CSS object-position; undefined for none. */
export function positionCss(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const [x, y] = value.split(/[\s|]+/).map(Number);
  if (![x, y].every(Number.isFinite)) return undefined;
  return `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
}

/**
 * A review-section photo's framing is stored after the URL as "desktop" or
 * "desktop|phone" ("url|0.4 0.5 1|0.6 0.5 1"). Editors that only know one
 * framing keep treating the whole thing as the desktop value, which parses the
 * same; `withPhoneOf` keeps the phone part when they write a new desktop value.
 */
export function splitFocusPair(value: string | null | undefined): { desktop: string | null; phone: string | null } {
  if (!value) return { desktop: null, phone: null };
  const i = value.indexOf("|");
  if (i < 0) return { desktop: value, phone: null };
  return { desktop: value.slice(0, i) || null, phone: value.slice(i + 1) || null };
}
export const joinFocusPair = (desktop: string, phone: string | null | undefined) => (phone ? `${desktop}|${phone}` : desktop);

/** From review sections' stored media ("url|desktop|phone,…"), each photo's desktop position (the first section it is in). */
export function reviewPositions(stored: (string | null | undefined)[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of stored) {
    for (const e of String(v || "").split(",").map((x) => x.trim()).filter(Boolean)) {
      const i = e.indexOf("|");
      if (i < 0) continue;
      const url = e.slice(0, i), desktop = splitFocusPair(e.slice(i + 1)).desktop;
      if (desktop && !(url in out)) out[url] = desktop;
    }
  }
  return out;
}
export function withPhoneOf(newDesktop: string, old: string | null | undefined): string {
  return joinFocusPair(splitFocusPair(newDesktop).desktop ?? newDesktop, splitFocusPair(old).phone);
}
