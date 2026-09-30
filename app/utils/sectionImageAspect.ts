// Single source of truth for review/section image frame shapes AND for how a
// section's saved layout string resolves into an actual arrangement.
//
// Each frame has a `mobile` and `desktop` aspect ratio. Mobile is a bit taller
// so images feel bigger on phones; desktop is shorter/wider. The crop editor and
// the park page both read these through `sectionImageFrame`, so the crop you set
// in the editor is always set against the exact frame the page will render.
//
// Change any value to retune; any ratio works and scales on all screen sizes.
// Examples: "16 / 9" (wide), "16 / 10", "3 / 2", "4 / 3" (taller), "21 / 9" (short).
export const SECTION_IMAGE_ASPECT = {
  row: { mobile: "3 / 2", desktop: "3 / 2" },    // image beside text — Left / Right, or two/three images side by side
  full: { mobile: "3 / 2", desktop: "16 / 7" }, // full width — Above / Below with one image, Double
  tall: { mobile: "4 / 5", desktop: "3 / 4" },   // one portrait image beside the text — Tall left / Tall right
} as const;

export type SectionFrame = { mobile: string; desktop: string };

/** Most media entries one section can hold. */
export const MAX_SECTION_IMAGES = 3;

export const SECTION_LAYOUTS = ["left", "right", "tall-left", "tall-right", "above", "below", "double"] as const;
export type SectionLayout = typeof SECTION_LAYOUTS[number];

export const SECTION_LAYOUT_LABELS: Record<SectionLayout, string> = {
  left: "Left",
  right: "Right",
  "tall-left": "Tall left",
  "tall-right": "Tall right",
  above: "Above",
  below: "Below",
  double: "Double",
};

export type ResolvedSectionLayout =
  | { mode: "none" }
  | { mode: "double" }
  | { mode: "row"; isRight: boolean; tall: boolean }
  | { mode: "stack"; isAbove: boolean };

/**
 * Turn a saved layout string into the arrangement the page renders.
 *
 * - "double" only applies with exactly two images (image, text, image).
 * - Left / Right stack every image (up to MAX_SECTION_IMAGES) in a column beside the text.
 * - Tall left / Tall right put one portrait image beside the text, as tall as
 *   two landscape ones; with more than one image they behave like Left / Right.
 * - Above / Below put two or three images side by side in one row.
 * - "center" is a legacy alias for "above".
 * - No layout at all falls back to `defaultLayout`; if that is also empty the
 *   legacy behaviour applies: image beside the text, alternating sides
 *   (`fallbackRight` says which side this section gets).
 */
export function resolveSectionLayout(
  layout: string | null | undefined,
  imageCount: number,
  opts: { defaultLayout?: string | null; fallbackRight?: boolean } = {}
): ResolvedSectionLayout {
  if (imageCount === 0) return { mode: "none" };
  const pref = layout || opts.defaultLayout || null;

  if (pref === "double" && imageCount === 2) return { mode: "double" };
  if (pref === "left") return { mode: "row", isRight: false, tall: false };
  if (pref === "right") return { mode: "row", isRight: true, tall: false };
  if (pref === "tall-left") return { mode: "row", isRight: false, tall: imageCount === 1 };
  if (pref === "tall-right") return { mode: "row", isRight: true, tall: imageCount === 1 };
  if (pref === "above" || pref === "center") return { mode: "stack", isAbove: true };
  if (pref === "below") return { mode: "stack", isAbove: false };
  return { mode: "row", isRight: !!opts.fallbackRight, tall: false };
}

/**
 * The frame an image is cropped into for a given layout and image count.
 * Two or three stacked images sit side by side in one row, so they use the row frame.
 */
export function sectionImageFrame(
  layout: string | null | undefined,
  imageCount: number,
  opts: { defaultLayout?: string | null } = {}
): SectionFrame {
  const r = resolveSectionLayout(layout, Math.max(imageCount, 1), opts);
  if (r.mode === "row") return r.tall ? SECTION_IMAGE_ASPECT.tall : SECTION_IMAGE_ASPECT.row;
  if (r.mode === "stack" && imageCount >= 2) return SECTION_IMAGE_ASPECT.row;
  return SECTION_IMAGE_ASPECT.full;
}

/**
 * True when a section has images but no layout the page recognises, so it
 * falls back to the legacy alternating row. The page and the editor preview both
 * use this to count alternation the same way.
 */
export function usesLegacyRow(layout: string | null | undefined, imageCount: number): boolean {
  if (imageCount === 0) return false;
  if (layout === "double") return imageCount !== 2;
  return !layout || !["left", "right", "tall-left", "tall-right", "above", "center", "below"].includes(layout);
}

/** The layout button that should read as active in the editor for a saved value. */
export function normalizeSectionLayout(
  layout: string | null | undefined,
  imageCount: number,
  defaultLayout: SectionLayout = "left"
): SectionLayout {
  const pref = layout === "center" ? "above" : layout;
  if (pref === "double" && imageCount !== 2) return "above";
  if ((pref === "tall-left" || pref === "tall-right") && imageCount !== 1) return pref === "tall-left" ? "left" : "right";
  if (pref && (SECTION_LAYOUTS as readonly string[]).includes(pref)) return pref as SectionLayout;
  return defaultLayout;
}

/** The layout choices the editor offers for a section with this many image slots. */
export function layoutOptionsFor(imageCount: number): SectionLayout[] {
  if (imageCount === 1) return ["left", "right", "tall-left", "tall-right", "above", "below"];
  if (imageCount === 2) return ["left", "right", "above", "below", "double"];
  return ["left", "right", "above", "below"];
}
