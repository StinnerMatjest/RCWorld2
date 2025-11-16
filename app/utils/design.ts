export const getRatingColor = (rating: number | string) => {
  if (
    rating === "" ||
    rating === "Select Rating" ||
    typeof rating !== "number"
  ) {
    return "text-black dark:text-gray-100";
  }

  // ⭐ 11 — SPECIAL (gold + soft glow)
  if (rating >= 11) {
    return [
      "text-[#FACC15]",
      "dark:text-[#FACC15]",
      "drop-shadow-[0_0_6px_rgba(250,204,21,0.55)]",
    ].join(" ");
  }

  // 💜 10 — Extraordinary (clean purple)
  if (rating >= 10.0) {
    return "text-[#8B5CF6] dark:text-[#C4B5FD]";
  }

  // 🔵 9 — Elite (refined deep blue)
  if (rating >= 9.0) {
    return "text-[#1D4ED8] dark:text-[#60A5FA]";
  }

  // 🟦 7.5–8.9 — Great (rich green)
  if (rating >= 7.5) {
    return "text-[#16A34A] dark:text-[#4ADE80]";
  }

  // 🍋 6.5–7.4 — Good (lime-yellow)
  if (rating >= 6.5) {
    return "text-[#A3E635] dark:text-[#BEF264]";
  }

  // 🟡 5.5–6.4 — Decent (original yellow)
  if (rating >= 5.5) {
    return "text-yellow-400 dark:text-yellow-300";
  }

  // 🟠 4.5–5.4 — Below Avg (original darker yellow-orange)
  if (rating >= 4.5) {
    return "text-yellow-600 dark:text-yellow-500";
  }

  // 🔥 3.0–4.4 — Poor (original red-orange)
  if (rating >= 3.0) {
    return "text-red-400 dark:text-red-300";
  }

  // 🩸 0–2.9 — Very Poor (original deep red)
  return "text-red-600 dark:text-red-500";
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
