/**
 * Live waits and ride status for a park, from two free feeds:
 *
 * - Queue-Times (https://queue-times.com, "Powered by Queue-Times.com" must be
 *   shown): posted waits and open/closed for each ride.
 * - ThemeParks.wiki (https://themeparks.wiki): the same waits, and a ride status
 *   that tells a breakdown (DOWN) from a ride that is closed or in refurbishment.
 *
 * Waits come from Queue-Times where it has the park, status from ThemeParks.wiki
 * where it has the park; each fills in for the other. A checklist names its park
 * in the feeds once (picked from liveParks(), stored as a key like
 * "qt:4|tpw:dae968d5-..."); older checklists find it by the park's name. Park
 * lists are fetched once a day per feed; live data is cached for a minute per park.
 */

export type RideStatus = "open" | "down" | "closed" | "refurb";
export type FeedRide = { name: string; wait: number | null; status: RideStatus };
export type ParkFeed = {
  /** Which feed the waits and the status came from (null: the park is in neither). */
  waits: "queue-times" | "themeparks.wiki" | null;
  status: "themeparks.wiki" | "queue-times" | null;
  /** The park's time zone, for clock times written into notes. */
  tz: string | null;
  /** The park's name in the feeds (null: no park). */
  park: string | null;
  rides: FeedRide[];
};

const DAY = 24 * 3600 * 1000;
const LIVE_TTL = 60 * 1000;
const TIMEOUT = 8000;

async function getJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { "User-Agent": "ParkRating checklist (parkrating.com)" } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Lower case, no accents or punctuation, words separated by one space. */
export function normName(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[®™]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
const compact = (s: string) => normName(s).replace(/ /g, "");

/** A park in one feed; `where` is its country (Queue-Times) or its resort (ThemeParks.wiki, also `resort`). */
type ParkRef = { id: string; name: string; tz?: string | null; where?: string | null; resort?: string | null };
let tpwParks: { at: number; list: ParkRef[] } | null = null;
let qtParks: { at: number; list: ParkRef[] } | null = null;

async function themeparksWikiParks(): Promise<ParkRef[]> {
  if (tpwParks && Date.now() - tpwParks.at < DAY) return tpwParks.list;
  const d = await getJson<{ destinations: { name: string; parks: { id: string; name: string }[] }[] }>("https://api.themeparks.wiki/v1/destinations");
  tpwParks = { at: Date.now(), list: d.destinations.flatMap(x => x.parks.map(p => ({ id: p.id, name: p.name, where: x.name, resort: x.name }))) };
  return tpwParks.list;
}

async function queueTimesParks(): Promise<ParkRef[]> {
  if (qtParks && Date.now() - qtParks.at < DAY) return qtParks.list;
  const d = await getJson<{ parks: { id: number; name: string; country?: string; timezone?: string }[] }[]>("https://queue-times.com/parks.json");
  qtParks = { at: Date.now(), list: d.flatMap(g => g.parks.map(p => ({ id: String(p.id), name: p.name, tz: p.timezone ?? null, where: p.country ?? null }))) };
  return qtParks.list;
}

/**
 * The feed's park for a park name: the same name, or a longer feed name around it
 * ("Toverland" / "Attractiepark Toverland"). Never the other way round: "Lotte
 * World Busan" is not the feed's "Lotte World" (Seoul).
 */
export function findPark(name: string, list: ParkRef[]): ParkRef | null {
  const c = compact(name);
  if (c.length < 4) return null;
  const same = list.find(p => compact(p.name) === c);
  if (same) return same;
  const around = list.filter(p => compact(p.name).includes(c));
  return around.length === 1 ? around[0] : null;
}

/**
 * "Disneyland Paris - Disneyland Park" (the resort, a dash, the park): the feeds say
 * "Disneyland Park Paris", or "Disneyland Park" in the resort "Disneyland Paris". A
 * feed park counts when it has every word of the park and no word that is in
 * neither the resort nor the park (its resort's words included).
 */
function findResortPark(name: string, list: ParkRef[]): ParkRef | null {
  const [resort, park, ...rest] = name.split(/\s+[-–]\s+/);
  if (!resort || !park || rest.length) return null;
  const pw = words(park), all = new Set([...words(resort), ...pw]);
  const hits = list.filter(p => {
    const fw = words(p.name);
    return pw.every(w => fw.includes(w)) && [...fw, ...words(p.resort ?? "")].every(w => all.has(w));
  });
  return hits.length === 1 ? hits[0] : null;
}

/** The feed's park for one of our park names, by name alone. */
function guessPark(parkName: string, list: ParkRef[]): ParkRef | null {
  // "Legoland Korea Resort" is "LEGOLAND Korea" in the feeds: try without the generic words too.
  const plain = parkName.replace(/\b(resort|theme park|amusement park|adventure park)\b/gi, " ").replace(/\s+/g, " ").trim();
  return findPark(parkName, list) ?? (plain !== parkName ? findPark(plain, list) : null) ?? findResortPark(parkName, list);
}

/** "qt:4|tpw:dae968d5-..."; "" is a park the feeds don't have. */
export function pickKey(qt: string | null, tpw: string | null): string {
  return [qt ? `qt:${qt}` : "", tpw ? `tpw:${tpw}` : ""].filter(Boolean).join("|");
}
function parsePick(key: string): { qt: string | null; tpw: string | null } {
  const part = (p: string) => key.split("|").find(x => x.startsWith(`${p}:`))?.slice(p.length + 1) || null;
  return { qt: part("qt"), tpw: part("tpw") };
}

/** The same park in ThemeParks.wiki: the same words, or one name inside the other, and only when there is exactly one. */
function pairTpw(q: ParkRef, tpw: ParkRef[]): ParkRef | null {
  const set = (s: string) => [...new Set(words(s))].sort().join(" ");
  const qs = set(q.name), qc = compact(q.name);
  const same = tpw.filter(t => set(t.name) === qs || set(`${t.resort ?? ""} ${t.name}`) === qs);
  if (same.length) return same.length === 1 ? same[0] : null;
  const around = tpw.filter(t => { const tc = compact(t.name); return tc.length >= 5 && qc.length >= 5 && (tc.includes(qc) || qc.includes(tc)); });
  return around.length === 1 ? around[0] : null;
}

export type LivePark = { key: string; name: string; where: string };

/**
 * Every park the feeds have, for picking a checklist's park: the Queue-Times parks
 * (with the same park in ThemeParks.wiki where it is clear which), then the
 * ThemeParks.wiki parks Queue-Times doesn't have. `guess` is the park for `name`.
 */
export async function liveParks(name?: string): Promise<{ parks: LivePark[]; guess: string | null }> {
  const [tpwList, qtList] = await Promise.all([themeparksWikiParks().catch(() => []), queueTimesParks().catch(() => [])]);
  const paired = new Set<string>();
  const parks: LivePark[] = [];
  for (const q of qtList) {
    const t = pairTpw(q, tpwList);
    if (t) paired.add(t.id);
    parks.push({ key: pickKey(q.id, t?.id ?? null), name: q.name, where: q.where ?? "" });
  }
  for (const t of tpwList) if (!paired.has(t.id)) parks.push({ key: pickKey(null, t.id), name: t.name, where: t.where ?? "" });
  parks.sort((a, b) => a.name.localeCompare(b.name));
  let guess: string | null = null;
  if (name) {
    const q = guessPark(name, qtList), t = guessPark(name, tpwList);
    guess = parks.find(p => q && parsePick(p.key).qt === q.id)?.key ?? parks.find(p => t && parsePick(p.key).tpw === t.id)?.key ?? null;
  }
  return { parks, guess };
}

const liveCache = new Map<string, { at: number; feed: ParkFeed }>();

/**
 * Live waits and status for a park, or an empty feed when neither source has it
 * (or both are down). `pick` is the checklist's picked park ("" = none); without
 * one the park is found by name.
 */
export async function parkFeed(parkName: string, pick?: string): Promise<ParkFeed> {
  const key = pick !== undefined ? `pick:${pick}` : compact(parkName);
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < LIVE_TTL) return hit.feed;

  const [tpwList, qtList] = await Promise.all([themeparksWikiParks().catch(() => []), queueTimesParks().catch(() => [])]);
  let tpw: ParkRef | null, qt: ParkRef | null;
  if (pick !== undefined) {
    // By id: a feed whose park list is down still answers for the park.
    const ids = parsePick(pick);
    qt = ids.qt ? qtList.find(p => p.id === ids.qt) ?? { id: ids.qt, name: "" } : null;
    tpw = ids.tpw ? tpwList.find(p => p.id === ids.tpw) ?? { id: ids.tpw, name: "" } : null;
  } else {
    tpw = guessPark(parkName, tpwList);
    qt = guessPark(parkName, qtList);
  }

  type TpwLive = { timezone?: string; liveData?: { name: string; entityType: string; status?: string; queue?: { STANDBY?: { waitTime?: number | null } } }[] };
  type QtLive = { lands?: { rides: { name: string; is_open: boolean; wait_time: number }[] }[]; rides?: { name: string; is_open: boolean; wait_time: number }[] };
  const [tpwLive, qtLive] = await Promise.all([
    tpw ? getJson<TpwLive>(`https://api.themeparks.wiki/v1/entity/${tpw.id}/live`).catch(() => null) : null,
    qt ? getJson<QtLive>(`https://queue-times.com/parks/${qt.id}/queue_times.json`).catch(() => null) : null,
  ]);

  const rides = new Map<string, FeedRide>();
  const qtRides = qtLive ? [...(qtLive.lands ?? []).flatMap(l => l.rides), ...(qtLive.rides ?? [])] : [];
  for (const r of qtRides) {
    rides.set(compact(r.name), { name: r.name, wait: r.is_open ? Math.max(0, Math.round(r.wait_time)) : null, status: r.is_open ? "open" : "closed" });
  }
  for (const e of tpwLive?.liveData ?? []) {
    if (e.entityType !== "ATTRACTION") continue;
    const status: RideStatus = e.status === "OPERATING" ? "open" : e.status === "DOWN" ? "down" : e.status === "REFURBISHMENT" ? "refurb" : "closed";
    const wait = typeof e.queue?.STANDBY?.waitTime === "number" ? e.queue.STANDBY.waitTime : null;
    const k = compact(e.name), cur = rides.get(k);
    // Queue-Times keeps its wait; ThemeParks.wiki's status is the finer one.
    rides.set(k, cur ? { ...cur, status, wait: status === "open" ? cur.wait ?? wait : null } : { name: e.name, wait: status === "open" ? wait : null, status });
  }

  const feed: ParkFeed = {
    waits: qtLive ? "queue-times" : tpwLive ? "themeparks.wiki" : null,
    status: tpwLive ? "themeparks.wiki" : qtLive ? "queue-times" : null,
    tz: tpwLive?.timezone ?? qt?.tz ?? null,
    park: qt?.name || tpw?.name || null,
    rides: [...rides.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
  liveCache.set(key, { at: Date.now(), feed });
  return feed;
}

// ─── coaster names to feed names ─────────────────────────────────────────────

const STOP = new Set(["the", "by", "de", "du", "la", "le", "les", "of", "d", "l", "der", "die", "das", "and", "et", "en", "og", "und"]);
const words = (s: string) => normName(s).split(" ").filter(w => w && !STOP.has(w));

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const wordSim = (a: string, b: string) => (/^\d+$/.test(a) || /^\d+$/.test(b) ? (a === b ? 1 : 0) : 1 - lev(a, b) / Math.max(a.length, b.length));

/**
 * How surely a feed ride is this coaster, 0 to 1. Only a near-certain name counts:
 * the same name, one inside the other ("Toutatis" / "By Toutatis!"), or every
 * word of the coaster's name found, nearly letter for letter, in the ride's
 * ("OzIris" / "Osiris Convolvulis"). A shared word alone ("SOS Tournevis" /
 * "SOS Hieroglyphix") is not enough.
 */
export function nameScore(coaster: string, ride: string): number {
  const a = compact(coaster), b = compact(ride);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return 0.9;
  const wa = words(coaster), wb = words(ride);
  if (!wa.length || !wb.length) return 0;
  const total = wa.reduce((n, w) => n + w.length, 0);
  let covered = 0;
  for (const w of wa) if (wb.some(x => wordSim(w, x) >= 0.7)) covered += w.length;
  // Every word found; the fewer extra words in the ride's name ("Single Rider"), the surer.
  return covered === total ? 0.8 + 0.05 * Math.min(1, wa.length / wb.length) : 0;
}

/** Rough likeness for ordering a picker (letter pairs in common), 0 to 1. */
export function likeness(a: string, b: string): number {
  const pairs = (s: string) => { const c = compact(s); const out: string[] = []; for (let i = 0; i < c.length - 1; i++) out.push(c.slice(i, i + 2)); return out; };
  const pa = pairs(a), pb = pairs(b);
  if (!pa.length || !pb.length) return 0;
  const pool = [...pb];
  let hit = 0;
  for (const p of pa) { const i = pool.indexOf(p); if (i >= 0) { hit++; pool.splice(i, 1); } }
  return (2 * hit) / (pa.length + pb.length);
}

/**
 * Feed ride for each coaster: a hand-made link first ("" = not in the feeds),
 * else the surest name match above the bar, each ride used once.
 */
export function matchCoasters(coasters: { item: string; name: string }[], rides: string[], links: Record<string, string>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const taken = new Set<string>();
  for (const c of coasters) {
    if (c.item in links) { out[c.item] = links[c.item] || null; if (links[c.item]) taken.add(links[c.item]); }
  }
  const pairs: { item: string; ride: string; s: number }[] = [];
  for (const c of coasters) {
    if (c.item in out) continue;
    for (const r of rides) { const s = nameScore(c.name, r); if (s >= 0.8) pairs.push({ item: c.item, ride: r, s }); }
  }
  pairs.sort((x, y) => y.s - x.s);
  for (const p of pairs) {
    if (p.item in out || taken.has(p.ride)) continue;
    out[p.item] = p.ride; taken.add(p.ride);
  }
  for (const c of coasters) if (!(c.item in out)) out[c.item] = null;
  return out;
}
