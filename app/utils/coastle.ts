import { ApiCoaster, CoastleCoaster, GameStats, MatchStatus } from "../types";

export const PARK_COUNTRY_MAP: Record<string, string> = {
  "Alton Towers": "UnitedKingdom",
  "Bakken": "Denmark",
  "BonBon-Land": "Denmark",
  "Cedar Point": "UnitedStates",
  "Disneyland Paris - Disneyland Park": "France",
  "Disneyland Paris - Walt Disney Studios Park": "France",
  "Djurs Sommerland": "Denmark",
  "Efteling": "Netherlands",
  "Energylandia": "Poland",
  "Europa-Park": "Germany",
  "Fårup Sommerland": "Denmark",
  "Gardaland": "Italy",
  "Hansa Park": "Germany",
  "Heide Park": "Germany",
  "Jardin d'Acclimatation": "France",
  "Legendia": "Poland",
  "Legoland Billung": "Denmark",
  "Linnanmäki": "Finland",
  "Liseberg": "Sweden",
  "Mer de Sable": "France",
  "Mirabilandia": "Italy",
  "Parc Astérix": "France",
  "Parc Saint Paul": "France",
  "Phantasialand": "Germany",
  "Plopsaland Belgium": "Belgium",
  "Plopsaland Deutschland": "Germany",
  "PortAventura Park": "Spain",
  "PowerPark": "Finland",
  "Särkänniemi": "Finland",
  "Serengeti-Park": "Germany",
  "Tivoli Gardens": "Denmark",
  "Tivoli Friheden": "Denmark",
  "Toverland": "Netherlands",
  "Tusenfryd": "Norway",
  "Walibi Belgium": "Belgium",
};

export const INITIAL_STATS: GameStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0],
};

// Helper for date seeding (Internal use)
function getSeedFromDate(d: Date) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return year * 10000 + month * 100 + day;
}

export function getUTCTodaySeed() {
  return getSeedFromDate(new Date());
}

export function seededRandom(seed: number) {
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  return (a * seed + c) % m;
}

export function getDailyCoaster(coasters: CoastleCoaster[]): CoastleCoaster | null {
  if (coasters.length === 0) return null;

  // 1. Calculate Today's Index
  const todaySeed = getUTCTodaySeed();
  const randomInt = seededRandom(todaySeed);
  let index = Math.abs(randomInt) % coasters.length;

  // 2. Prevent Back-to-Back Duplicates
  if (coasters.length > 1) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // Go back 1 day

    const yesterdaySeed = getSeedFromDate(yesterday);
    const yesterdayRandom = seededRandom(yesterdaySeed);
    const yesterdayIndex = Math.abs(yesterdayRandom) % coasters.length;

    // If today matches yesterday, shift to the next coaster
    if (index === yesterdayIndex) {
      console.log("🚫 Duplicate detected! Shifting coaster to avoid repeat."); //
      index = (index + 1) % coasters.length;
    }
  }

  return coasters[index];
}

export function getTodayString() {
  const seed = getUTCTodaySeed();
  return String(seed);
}

// Game Logic
export function getMatchStatus(
  guess: number | string | undefined | null,
  answer: number | string | undefined | null
): MatchStatus {
  if (guess === answer) return "correct";
  return "wrong";
}

export function getStatusStyles(status: MatchStatus) {
  switch (status) {
    case "correct":
      return "bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    case "wrong":
    default:
      return "bg-red-800 text-white border-red-900 dark:bg-red-900 dark:border-red-950";
  }
}

export function mapApiToCoastle(c: ApiCoaster): CoastleCoaster | null {
  const rawRating = c.rating;
  const rating =
    rawRating === null || rawRating === undefined
      ? null
      : typeof rawRating === "string"
        ? parseFloat(rawRating)
        : rawRating;

  if (rating === null || Number.isNaN(rating)) return null;

  const parkName = c.parkName;
  const countryName = PARK_COUNTRY_MAP[parkName];

  return {
    id: String(c.id),
    name: c.name,
    rating,
    manufacturer: c.manufacturer,
    park: parkName,
    rideCount: c.rideCount ?? 0,
    lastRidden: c.lastVisitDate,
    year: c.year ?? 0,
    parkId: c.parkId,
    rcdbPath: c.rcdbPath,
    countryName,
  };
}

// Copy to clipboard
export async function legacyCopy(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    return true;
  } catch (err) {
    console.error('Fallback copy failed', err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}