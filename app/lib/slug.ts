// URL slug helpers shared by the park and coaster create/update routes and the
// coaster page's legacy-slug redirect.

// Letters that NFD decomposition does not split into base + accent.
const SPECIAL: Record<string, string> = {
  æ: "ae", ø: "o", å: "a", ß: "ss", ð: "d", þ: "th", đ: "d", ł: "l", œ: "oe",
};

// "Fēnix" -> "fenix", "F.L.Y." -> "fly", "Eurosat - CanCan Coaster" -> "eurosat-cancan-coaster".
// Always ASCII, lowercase, single hyphens, no leading/trailing hyphen.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[æøåßðþđłœ]/g, (ch) => SPECIAL[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Old coaster slugs that were live before the 2026-09 normalisation. The coaster
// page 301s these to the new slug so old links, search results and shares keep
// working. Keys are the raw (decoded) path segment.
export const LEGACY_COASTER_SLUGS: Record<string, string> = {
  "bisværmen": "bisvaermen",
  "dragen-legoland-billund-1778746438501": "dragen-legoland-billund",
  "dragen": "dragen-tivoli-friheden",
  "energuś": "energus",
  "eurosat---cancan-coaster": "eurosat-cancan-coaster",
  "f.l.y.": "fly",
  "fønix": "fonix",
  "f-nix": "fenix",
  "mælkevejen": "maelkevejen",
  "mariehønen": "mariehonen",
  "psyké-underground": "psyke-underground",
  "vilde-hønsejagt": "vilde-honsejagt",
};
