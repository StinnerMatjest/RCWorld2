// ─── Rating palette — single source of truth ─────────────────────────────────
// Top half (8–11) is a rarity ladder (blue → purple → pink → gold);
// bottom half (0.5–7.5) is a traffic-light heat scale.
// See docs/rating-palette.html for swatches on the site background.

export type RatingTier = { min: number; hex: string; label: string };

export const RATING_TIERS: RatingTier[] = [
  { min: 11,  hex: "#FCD34D", label: "GOATED" },
  { min: 10,  hex: "#F472B6", label: "World Class" },
  { min: 9,   hex: "#C4B5FD", label: "Elite" },
  { min: 8,   hex: "#60A5FA", label: "Fantastic" },
  { min: 7,   hex: "#4ADE80", label: "Great" },
  { min: 6,   hex: "#BEF264", label: "Solid" },
  { min: 5,   hex: "#FDE047", label: "Okay" },
  { min: 4,   hex: "#FB923C", label: "Mediocre" },
  { min: 3,   hex: "#F87171", label: "Poor" },
  { min: 1.5, hex: "#E64558", label: "Terrible" },
  { min: 0,   hex: "#9B7E83", label: "Worthless" },
];

export const getRatingHex = (rating: number): string =>
  RATING_TIERS.find(t => rating >= t.min)?.hex ?? "#9B7E83";

export const getRatingColor = (rating: number | string) => {
  if (
    rating === "" ||
    rating === "Select Rating" ||
    typeof rating !== "number"
  ) {
    // No rating — dimmer than any real score so it can't be read as one
    return "text-slate-500";
  }

  // NOTE: classes must stay literal strings so Tailwind generates them.
  // Keep in sync with RATING_TIERS above.

  // ⭐ 11 — GOATED (gold + glow)
  if (rating >= 11) {
    return "text-[#FCD34D] drop-shadow-[0_0_4px_rgba(252,211,77,0.4)]";
  }

  // 💖 10 — World Class (mythic pink)
  if (rating >= 10.0) {
    return "text-[#F472B6]";
  }

  // 💜 9.5/9.0 — Elite (epic purple)
  if (rating >= 9.0) {
    return "text-[#C4B5FD]";
  }

  // 🔵 8.5/8.0 — Fantastic (rare blue)
  if (rating >= 8.0) {
    return "text-[#60A5FA]";
  }

  // 🌲 7.5/7.0 — Great (green)
  if (rating >= 7.0) {
    return "text-[#4ADE80]";
  }

  // 🍃 6.5/6.0 — Solid (lime)
  if (rating >= 6.0) {
    return "text-[#BEF264]";
  }

  // 🟡 5.5/5.0 — Okay (yellow)
  if (rating >= 5.0) {
    return "text-[#FDE047]";
  }

  // 🟠 4.5/4.0 — Mediocre (proper orange)
  if (rating >= 4.0) {
    return "text-[#FB923C]";
  }

  // 🔴 3.5/3.0 — Poor (light red)
  if (rating >= 3.0) {
    return "text-[#F87171]";
  }

  // 🩸 2.5/2.0/1.5 — Terrible (deep red)
  if (rating >= 1.5) {
    return "text-[#E64558]";
  }

  // 💀 1.0/0.5 — Worthless ("dead" desaturated rose-grey)
  return "text-[#9B7E83]";
};

const countryNameToCode: Record<string, string> = {
  Albania: "al",
  Austria: "at",
  Belarus: "by",
  Belgium: "be",
  BosniaAndHerzegovina: "ba",
  Brazil: "br",
  Bulgaria: "bg",
  Canada: "ca",
  China: "cn",
  Colombia: "co",
  Croatia: "hr",
  Cyprus: "cy",
  CzechRepublic: "cz",
  Denmark: "dk",
  Egypt: "eg",
  Finland: "fi",
  France: "fr",
  Germany: "de",
  Greece: "gr",
  Hungary: "hu",
  India: "in",
  Ireland: "ie",
  Italy: "it",
  Japan: "jp",
  Mexico: "mx",
  Montenegro: "me",
  Netherlands: "nl",
  NorthMacedonia: "mk",
  Norway: "no",
  Poland: "pl",
  Portugal: "pt",
  Romania: "ro",
  Russia: "ru",
  SanMarino: "sm",
  SaudiArabia: "sa",
  Serbia: "rs",
  Slovakia: "sk",
  Slovenia: "si",
  SouthKorea: "kr",
  Korea: "kr",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Ukraine: "ua",
  UnitedArabEmirates: "ae",
  UnitedKingdom: "gb",
  UnitedStates: "us",
  Vietnam: "vn",
};

export const getParkFlag = (countryName: string): string => {
  // Tolerate spaced names ("South Korea") and missing-map fallback
  const code = countryNameToCode[countryName] ?? countryNameToCode[countryName?.replace(/\s+/g, "")];
  if (!code) {
    return "/images/error.PNG";
  }
  return `https://flagcdn.com/w40/${code}.png`;
};