export const getRatingColor = (rating: number): string => {
  if (rating >= 10) return "rainbow-animation";
  if (rating >= 9) return "text-blue-700 dark:text-blue-400";
  if (rating >= 7.5) return "text-green-600 dark:text-green-400";
  if (rating >= 6.5) return "text-green-400 dark:text-green-300";
  if (rating >= 5.5) return "text-yellow-400 dark:text-yellow-300";
  if (rating >= 4.5) return "text-yellow-600 dark:text-yellow-500";
  if (rating >= 3) return "text-red-400 dark:text-red-300";
  return "text-red-600 dark:text-red-500";
};

const countryNameToCode: Record<string, string> = {
  Albania: "al",
  Austria: "at",
  Belarus: "by",
  Belgium: "be",
  BosniaAndHerzegovina: "ba",
  Bulgaria: "bg",
  Croatia: "hr",
  Cyprus: "cy",
  CzechRepublic: "cz",
  Denmark: "dk",
  Finland: "fi",
  France: "fr",
  Germany: "de",
  Greece: "gr",
  Hungary: "hu",
  Ireland: "ie",
  Italy: "it",
  Montenegro: "me",
  Netherlands: "nl",
  NorthMacedonia: "mk",
  Norway: "no",
  Poland: "pl",
  Portugal: "pt",
  Romania: "ro",
  Russia: "ru",
  SanMarino: "sm",
  Serbia: "rs",
  Slovakia: "sk",
  Slovenia: "si",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Ukraine: "ua",
  UnitedKingdom: "gb",
  UnitedStates: "us",
};

export const getParkFlag = (countryName: string): string => {
  const code = countryNameToCode[countryName];
  if (!code) {
    return "/public/images/Error.png";
  }
  return `https://flagcdn.com/w40/${code}.png`;
};

