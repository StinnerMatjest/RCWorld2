import { isR2Image, isWebFormat, variantKey, variantUrl, VARIANT_WIDTHS } from "@/app/lib/imageVariants";
import type { CleanupData, CleanupKind, CleanupPerson, CleanupTask, DoneTask, FramePlace, FrameSlot, PhotoUse, PlaceKind, SlotView } from "@/app/lib/cleanup";
import { groupOf } from "@/app/lib/cleanupGroup";

export type { CleanupData, CleanupKind, CleanupPerson, CleanupTask, DoneTask, FramePlace, FrameSlot, PhotoUse, PlaceKind, SlotView };
export { groupOf };
export const PEOPLE: CleanupPerson[] = ["Jannik", "Nicklas"];
export const PERSON_KEY = "parkrating_cleanup_person";

/** A row on the overview: one or more task groups (see groupOf). */
export interface Category { id: string; title: string; groups: string[]; /** Opens a list of links instead of the runner. */ list?: boolean }
/** A block of rows with a line saying what they are. */
export interface Section { id: string; title: string; blurb: string; rows: Category[] }

export const FRAMING: Section = {
  id: "framing", title: "Framing", blurb: "The following images need framing adjusted and approved.",
  rows: [
    { id: "card", title: "Frontpage", groups: ["place:card"] },
    { id: "park-cover", title: "Park Page", groups: ["place:park-cover"] },
    { id: "coaster-cover", title: "Coaster Page", groups: ["place:coaster-cover"] },
    { id: "curated", title: "Curated Gallery", groups: ["place:curated", "place:coaster-curated"] },
    { id: "review-photo", title: "Review Photos", groups: ["place:review-photo"] },
    { id: "list-photo", title: "List Photos", groups: ["place:list-photo"] },
  ],
};
export const QUICK: Section = {
  id: "quick", title: "Gallery & Captions", blurb: "Curated photos to pick and captions to fix.",
  rows: [
    { id: "caption", title: "Captions", groups: ["caption"] },
    { id: "curated-pick", title: "Pick Curated Gallery · parks", groups: ["curated-pick"] },
    { id: "coaster-pick", title: "Pick Curated Gallery · coasters", groups: ["coaster-pick"] },
  ],
};
export const ON_PAGE: Section = {
  id: "page", title: "Other Fixes", blurb: "Open the page and fix it there.",
  rows: [
    { id: "park-review", title: "Park reviews to write", groups: ["park-review"], list: true },
    { id: "coaster-review", title: "Coaster reviews to write", groups: ["coaster-review"], list: true },
    { id: "review-photos", title: "Park reviews short on photos", groups: ["review-photos"], list: true },
    { id: "coaster-review-photos", title: "Coaster reviews short on photos", groups: ["coaster-review-photos"], list: true },
    { id: "coaster-photos", title: "Coasters without photos", groups: ["coaster-photos"], list: true },
  ],
};
export const SECTIONS = [FRAMING, QUICK, ON_PAGE];
export const CATEGORIES = SECTIONS.flatMap((s) => s.rows);
export const categoryOf = (t: CleanupTask) => CATEGORIES.find((c) => c.groups.includes(groupOf(t)));

/** The three parts of "how complete": a group of categories each. */
export const PILLARS: { id: string; title: string; cats: string[] }[] = [
  { id: "framing", title: "Framing", cats: FRAMING.rows.map((r) => r.id) },
  { id: "photos", title: "Photos", cats: ["caption", "curated-pick", "coaster-pick", "review-photos", "coaster-review-photos", "coaster-photos"] },
  { id: "reviews", title: "Reviews", cats: ["park-review", "coaster-review"] },
];

/** What a framing place is called, by kind. */
export const PLACE_TITLE: Record<PlaceKind, string> = {
  card: "Front Page Card", "park-cover": "Park Page Cover", "coaster-cover": "Coaster Page Cover",
  curated: "Curated Gallery", "coaster-curated": "Curated Gallery", "review-photo": "Review Photo", "list-photo": "List Photo",
};
export const KIND_TITLE: Record<CleanupKind, string> = {
  frame: "Framing", caption: "Caption", "curated-pick": "Pick Curated Gallery", "coaster-pick": "Pick Curated Gallery",
  "review-photos": "Park Review Short on Photos", "coaster-review-photos": "Coaster Review Short on Photos", "park-review": "Park Review to Write", "coaster-review": "Coaster Review to Write", "coaster-photos": "Coaster Without Photos",
};
export const taskTitle = (t: CleanupTask) => (t.place ? PLACE_TITLE[t.place.kind] : KIND_TITLE[t.kind]);
/** The park or coaster (or list) a task is about. */
export const taskName = (t: CleanupTask) => (t.place ? t.place.title : t.coasterName ?? t.parkName);

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const thumb = (src: string | null | undefined, w = 480) => (src ? variantUrl(src, w) : "");

/**
 * srcset for a photo shown at a size the browser knows (sizes): every stored
 * size plus the original, so it takes the smallest file whose pixels cover the
 * photo on this screen and never an enlarged one.
 */
export function photoSources(src: string, size?: { w: number; h: number }): { src: string; srcSet?: string } {
  if (!isR2Image(src)) return { src };
  const widths = size?.w ? VARIANT_WIDTHS.filter((w) => w < size.w) : [...VARIANT_WIDTHS];
  return { src: variantKey(src, 1200), srcSet: [...widths.map((w) => `${variantKey(src, w)} ${w}w`), ...(isWebFormat(src) ? [`${src} ${size?.w || 4000}w`] : [])].join(", ") };
}

/**
 * Hand-outs favour what visitors see first: front page cards and covers, then
 * curated images, captions and picks, then list photos. Never framed before
 * already framed within each.
 */
const TIER: Record<string, number> = {
  "place:card": 0, "place:park-cover": 0, "place:coaster-cover": 1, "place:curated": 2, "place:coaster-curated": 3,
  caption: 2, "curated-pick": 2, "coaster-pick": 3, "place:review-photo": 4, "place:list-photo": 5,
};
export function priority(t: CleanupTask): number {
  const tier = TIER[groupOf(t)] ?? 6;
  const fresh = t.place ? t.place.slots.some((s) => !s.done && s.fresh) : true;
  return tier * 2 + (fresh ? 0 : 1);
}
export function sortQueue(ts: CleanupTask[]): CleanupTask[] {
  return [...ts].sort((a, b) => priority(a) - priority(b) || a.parkName.localeCompare(b.parkName) || a.key.localeCompare(b.key));
}

/** Random fixes as a queue: each next one three times in four from the most important tier left. */
export function randomQueue(ts: CleanupTask[]): CleanupTask[] {
  const pool = ts.filter((t) => t.quick);
  const out: CleanupTask[] = [];
  while (pool.length) {
    const best = Math.min(...pool.map(priority));
    const first = pool.filter((t) => priority(t) === best);
    const from = Math.random() < 0.75 ? first : pool;
    const pick = from[Math.floor(Math.random() * from.length)];
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

/** Points open, done and in all of a category (a framing place counts one per framing). */
export function categoryStats(c: Category, tasks: CleanupTask[], totals: CleanupData["totals"]) {
  const mine = tasks.filter((t) => c.groups.includes(groupOf(t)));
  const open = mine.reduce((n, t) => n + openPoints(t), 0);
  const done = c.groups.reduce((s, g) => s + (totals[g]?.done ?? 0), 0);
  const total = c.groups.reduce((s, g) => s + (totals[g]?.total ?? 0), 0);
  return { open, done, total, tasks: mine };
}
/** Points still open in a task. */
export const openPoints = (t: CleanupTask) => (t.place ? t.place.slots.filter((s) => !s.done).length : t.points);

export async function api(action: string, key: string | undefined, person: CleanupPerson, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, key, person, ...extra }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || (res.status === 401 ? "Log in to admin mode again." : `Failed (${res.status})`));
  return body as { ok: true; already?: boolean; credited?: number; undo?: string; kept?: number };
}

/** A save through one of the site's own endpoints (the ones its editors use). */
export async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status === 401 ? "Log in to admin mode again." : `Not saved (${res.status})`);
  return res.json().catch(() => ({}));
}
