import { ApiCoaster, CoastleCoaster, GameStats, MatchStatus } from "../types";

export const INITIAL_STATS: GameStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0],
};
function getSeedFromDate(d: Date, salt = "") {
  const dateStr = d.toISOString().split("T")[0]; // "2025-12-03"
  const str = salt ? `${dateStr}::${salt}` : dateStr;

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getUTCTodaySeed(salt = "") {
  return getSeedFromDate(new Date(), salt);
}

export function seededRandom(seed: number) {
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  return (a * seed + c) % m;
}

export function getDailyCoaster(
  coasters: CoastleCoaster[],
  salt = ""
): CoastleCoaster | null {
  if (coasters.length === 0) return null;

  // 1. Calculate Today's Index
  const todaySeed = getUTCTodaySeed(salt);
  const randomInt = seededRandom(todaySeed);
  let index = Math.abs(randomInt) % coasters.length;

  // 2. Prevent Back-to-Back Duplicates (Cluster Fix)
  if (coasters.length > 1) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // Go back 1 day

    const yesterdaySeed = getSeedFromDate(yesterday, salt);
    const yesterdayRandom = seededRandom(yesterdaySeed);
    const yesterdayIndex = Math.abs(yesterdayRandom) % coasters.length;

    // If today randomly picks the same as yesterday:
    if (index === yesterdayIndex) {
      console.log("🚫 Duplicate detected! Shifting coaster.");
      // Jump by 17 (prime number) to escape any alphabetical park clusters
      index = (index + 17) % coasters.length;
    }
  }

  return coasters[index];
}

// Keep this as the global "today id" used for saving daily state.
// (Do NOT salt this; it should represent the actual day.)
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

export function getNumericMatchStatus(
  guess: number | null | undefined,
  answer: number | null | undefined,
  closeMargin: number
): MatchStatus {
  if (guess === null || guess === undefined || answer === null || answer === undefined) {
    return "wrong";
  }
  if (guess === answer) return "correct";
  if (Math.abs(guess - answer) <= closeMargin) return "close";
  return "wrong";
}

export const CLOSE_MARGINS = {
  lengthFt: 500,
  heightFt: 30,
  speedMph: 10,
  inversions: 1,
} as const;

export function getStatusStyles(status: MatchStatus) {
  switch (status) {
    case "correct":
      return "bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    case "wrong":
    default:
      return "bg-red-800 text-white border-red-900 dark:bg-red-900 dark:border-red-950";
    case "close":
      return "bg-amber-500 text-white border-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.18)] " +
        "dark:bg-yellow-600 dark:border-yellow-700 dark:shadow-[0_0_12px_rgba(234,179,8,0.24)]";
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
  const countryName = c.country;
  const anyC = c as any;
  const specs = anyC?.specs ?? {};
  const toNumOrNull = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

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
    slug: c.slug,
    countryName,

    height: toNumOrNull(specs.height),       // ft
    length: toNumOrNull(specs.length),       // ft
    speed: toNumOrNull(specs.speed),         // mph
    inversions: toNumOrNull(specs.inversions) // count
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
    document.execCommand("copy");
    return true;
  } catch (err) {
    console.error("Fallback copy failed", err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

// --- VERIFICATION TOOL ---
export function debugSchedule(coasters: CoastleCoaster[], salt = "") {
  console.log(
    "%c 🎢 PREDICTED SCHEDULE (Next 7 Days)",
    "background: #222; color: #bada55; font-size: 14px"
  );

  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);

    // Manually replicate logic to predict future
    const seed = getSeedFromDate(d, salt);
    const randomInt = seededRandom(seed);
    let index = Math.abs(randomInt) % coasters.length;

    // Check duplication logic
    if (i > 0) {
      const prevD = new Date(d);
      prevD.setDate(prevD.getDate() - 1);
      const prevSeed = getSeedFromDate(prevD, salt);
      const prevRand = seededRandom(prevSeed);
      const prevIndex = Math.abs(prevRand) % coasters.length;
      if (index === prevIndex) index = (index + 17) % coasters.length;
    }

    const c = coasters[index];
    if (c) {
      console.log(
        `Day +${i} (${d.toISOString().split("T")[0]}): ${c.name} @ ${c.park}`
      );
    }
  }
}

