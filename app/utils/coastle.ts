// utils/coastle.ts
import { ApiCoaster, CoastleCoaster, GameStats, MatchStatus } from "../types";

// Static Data
export const PARK_COUNTRY_MAP: Record<string, string> = {
  "Alton Towers": "UnitedKingdom",
  "Bakken": "Denmark",
  "BonBon-Land": "Denmark",
  "Cedar Point": "UnitedStates",
  "Djurs Sommerland": "Denmark",
  "Efteling": "Netherlands",
  "Energylandia": "Poland",
  "Europa-Park": "Germany",
  "Fårup Sommerland": "Denmark",
  "Legendia": "Poland",
  "Legoland Billung": "Denmark",
  "Liseberg": "Sweden",
  "Phantasialand": "Germany",
  "Plopsaland Belgium": "Belgium",
  "Plopsaland Deutschland": "Germany",
  "PortAventura Park": "Spain",
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

// Date & Random Logic
export function getUTCTodaySeed() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return year * 10000 + month * 100 + day;
}

export function seededRandom(seed: number) {
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  return (a * seed + c) % m;
}

export function getDailyCoaster(coasters: CoastleCoaster[]): CoastleCoaster | null {
  if (coasters.length === 0) return null;
  const seed = getUTCTodaySeed();
  const randomInt = seededRandom(seed);
  const index = Math.abs(randomInt) % coasters.length;
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

// Helper: Copy to clipboard
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