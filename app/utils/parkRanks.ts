// Where a park stands among the others: overall in its country and worldwide,
// and per rating group worldwide. Computed on the server from the ranked
// parks list (latest visit per park) for the park page's first paint.

export type RankStat = { rank: number; total: number };

export type ParkGroupKey = "Coasters" | "Rides" | "Park" | "Food" | "Management";

export type ParkRanks = {
  world: RankStat;
  /** Null only when the park itself is unrated; a lone park in its country is still #1 there. */
  country: (RankStat & { name: string }) | null;
  groups: Record<ParkGroupKey, RankStat>;
};

/** A row of /api/parks/ranked (scores of the latest visit, any casing of the group fields). */
export type RankedPark = {
  id: number;
  country: string;
  overall: number | string | null;
  [field: string]: unknown;
};

export const PARK_GROUPS: {
  key: ParkGroupKey;
  /** Fields on a ranked row and on a Visit, in that order (the casings differ). */
  ranked: [string, string];
  visit: [string, string];
  /** First review section of the group: the scorecard row jumps here. */
  section: string;
}[] = [
  { key: "Coasters", ranked: ["bestCoaster", "coasterDepth"], visit: ["bestCoaster", "coasterDepth"], section: "bestCoaster" },
  { key: "Rides", ranked: ["waterRides", "flatRidesAndDarkRides"], visit: ["waterRides", "flatridesAndDarkrides"], section: "waterRides" },
  { key: "Park", ranked: ["parkAppearance", "parkPracticality"], visit: ["parkAppearance", "parkPracticality"], section: "parkAppearance" },
  { key: "Food", ranked: ["food", "snacksAndDrinks"], visit: ["food", "snacksAndDrinks"], section: "food" },
  { key: "Management", ranked: ["rideOperations", "parkManagement"], visit: ["rideOperations", "parkManagement"], section: "rideOperations" },
];

/** Every rated park ranks in its country, even when it is the only one there. */
const MIN_COUNTRY_PARKS = 1;

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Competition ranking: ties share the best position (1, 1, 3). */
function rankOf(scores: { id: number; score: number }[], id: number): RankStat | null {
  const me = scores.find((s) => s.id === id);
  if (!me) return null;
  const higher = scores.filter((s) => s.score > me.score).length;
  return { rank: higher + 1, total: scores.length };
}

export function computeParkRanks(all: RankedPark[], parkId: number): ParkRanks | null {
  const rated = all.filter((p) => num(p.overall) > 0);
  const me = rated.find((p) => p.id === parkId);
  if (!me) return null;

  const overall = rated.map((p) => ({ id: p.id, score: num(p.overall) }));
  const world = rankOf(overall, parkId);
  if (!world) return null;

  const inCountry = rated.filter((p) => p.country === me.country);
  const country = inCountry.length >= MIN_COUNTRY_PARKS
    ? { ...rankOf(inCountry.map((p) => ({ id: p.id, score: num(p.overall) })), parkId)!, name: me.country }
    : null;

  const groups = {} as Record<ParkGroupKey, RankStat>;
  for (const g of PARK_GROUPS) {
    const scores = rated.map((p) => ({ id: p.id, score: (num(p[g.ranked[0]]) + num(p[g.ranked[1]])) / 2 }));
    groups[g.key] = rankOf(scores, parkId)!;
  }

  return { world, country, groups };
}

/** Podium colours for a rank, matching the coaster page's rank rail. */
export const rankColorClass = (rank: number | null | undefined) =>
  rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-orange-400" : "text-slate-100";

/** "8.55", "9.45", "9", "7.5": the score as the site writes it, no trailing zeros. */
export const formatScore = (v: number | string | null | undefined) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  return String(Math.round(n * 100) / 100);
};
