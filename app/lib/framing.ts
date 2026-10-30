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
export function withPhoneOf(newDesktop: string, old: string | null | undefined): string {
  return joinFocusPair(splitFocusPair(newDesktop).desktop ?? newDesktop, splitFocusPair(old).phone);
}
