export const getRatingColor = (rating: number | string) => {
  if (
    rating === "" ||
    rating === "Select Rating" ||
    typeof rating !== "number"
  ) {
    return "text-slate-400";
  }

  // ⭐ 11 — GOATED (Muted soft gold)
  if (rating >= 11) {
    return "text-[#FCD34D] drop-shadow-[0_0_4px_rgba(252,211,77,0.4)]";
  }

  // 💖 10 — World Class (Soft Bright Pink / 'Mythic' Tier)
  if (rating >= 10.0) {
    return "text-[#F472B6]";
  }

  // 💜 9.5/9.0 — Elite (Soft Pastel Purple / 'Epic' Tier)
  if (rating >= 9.0) {
    return "text-[#C4B5FD]";
  }

  // 🔵 8.5/8.0 — Fantastic (Soft Pastel Blue / 'Rare' Tier)
  if (rating >= 8.0) {
    return "text-[#60A5FA]";
  }

  // 🌲 7.5/7.0 — Extraordinary Family / Good Thrill (Soft Pastel Green)
  if (rating >= 7.0) {
    return "text-[#4ADE80]";
  }

  // 🍃 6.5/6.0 — Great Family / Solid Thrill (Soft Pastel Lime)
  if (rating >= 6.0) {
    return "text-[#BEF264]";
  }

  // 🟡 5.5/5.0 — Good Family / Okay Thrill (Soft Muted Yellow)
  if (rating >= 5.0) {
    return "text-[#FDE047]";
  }

  // 🟠 4.5/4.0 — Decent Family / Mediocre Thrill (Soft Pastel Peach/Orange)
  if (rating >= 4.0) {
    return "text-[#FFB58A]";
  }

  // 🔴 3.5/3.0 — Average Family / Poor Thrill (Soft Muted Coral/Light Red)
  if (rating >= 3.0) {
    return "text-[#FC8181]";
  }

  // 🩸 2.5/2.0/1.5 — Mostly small family / Terrible Thrill (Soft Deep Rose)
  if (rating >= 1.5) {
    return "text-[#FB7185]";
  }

  // ⚫ 1.0/0.5 — Yikes! (Muted Slate Gray - Doesn't strain against background)
  return "text-[#94A3B8]";
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
  const code = countryNameToCode[countryName];
  if (!code) {
    return "/public/images/Error.png";
  }
  return `https://flagcdn.com/w40/${code}.png`;
};