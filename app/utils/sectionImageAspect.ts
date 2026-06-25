// Single source of truth for review/section image frame shapes.
//
// Each layout has a `mobile` and `desktop` aspect ratio. Mobile is a bit taller
// so images feel bigger on phones; desktop is shorter/wider. The crop editor and
// the park page both read these, and the editor previews the DESKTOP (tighter)
// shape — so a crop set on desktop only ever reveals MORE on mobile, never less.
//
// Change any value to retune; any ratio works and scales on all screen sizes.
// Examples: "16 / 9" (wide), "16 / 10", "3 / 2", "4 / 3" (taller), "21 / 9" (short).
export const SECTION_IMAGE_ASPECT = {
  row: { mobile: "3 / 2", desktop: "3 / 2" },    // image beside text — Left / Right
  full: { mobile: "3 / 2", desktop: "16 / 7" }, // full width — Above / Below / Center / Double
} as const;

//test comment