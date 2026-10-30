import { variantUrl } from "@/app/lib/imageVariants";
import type { CleanupData, CleanupKind, CleanupPerson, CleanupTask, FramePlace, FrameSlot, PlaceKind, SlotView } from "@/app/lib/cleanup";
import { groupOf } from "@/app/lib/cleanupGroup";

export type { CleanupData, CleanupKind, CleanupPerson, CleanupTask, FramePlace, FrameSlot, PlaceKind, SlotView };
export { groupOf };
export const PEOPLE: CleanupPerson[] = ["Jannik", "Nicklas"];
export const PERSON_KEY = "parkrating_cleanup_person";

/** A row on the overview: one or more task groups (see groupOf). */
export interface Category { id: string; title: string; groups: string[]; /** Opens a list of links instead of the runner. */ list?: boolean }
export const FRAMING: Category[] = [
  { id: "card", title: "Front page cards", groups: ["place:card"] },
  { id: "park-cover", title: "Park page covers", groups: ["place:park-cover"] },
  { id: "coaster-cover", title: "Coaster page covers", groups: ["place:coaster-cover"] },
  { id: "curated", title: "Curated images", groups: ["place:curated", "place:coaster-curated"] },
  { id: "break", title: "Photo breaks", groups: ["place:break"] },
  { id: "list-photo", title: "List photos", groups: ["place:list-photo"] },
];
export const QUICK: Category[] = [
  { id: "caption", title: "Captions", groups: ["caption"] },
  { id: "curated-pick", title: "Curated images to pick", groups: ["curated-pick"] },
];
export const ON_PAGE: Category[] = [
  { id: "section-needs-photo", title: "Review sections without a photo", groups: ["section-needs-photo"], list: true },
  { id: "coaster-review", title: "Reviews to write", groups: ["coaster-review"], list: true },
  { id: "coaster-photos", title: "Coasters without photos", groups: ["coaster-photos"], list: true },
];
export const CATEGORIES = [...FRAMING, ...QUICK, ...ON_PAGE];
export const categoryOf = (t: CleanupTask) => CATEGORIES.find((c) => c.groups.includes(groupOf(t)));

/** What a framing place is called, by kind. */
export const PLACE_TITLE: Record<PlaceKind, string> = {
  card: "Front page card", "park-cover": "Park page cover", "coaster-cover": "Coaster page cover",
  curated: "Curated image", "coaster-curated": "Curated image", break: "Photo break", "list-photo": "List photo",
};

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const thumb = (src: string | null | undefined, w = 480) => (src ? variantUrl(src, w) : "");

/**
 * Random picks favour what visitors see first: front page cards and covers,
 * then curated images, captions and picks, then photo breaks and list photos.
 * Never framed before already framed within each.
 */
const TIER: Record<string, number> = {
  "place:card": 0, "place:park-cover": 0, "place:coaster-cover": 1, "place:curated": 2, "place:coaster-curated": 3,
  caption: 2, "curated-pick": 2, "place:break": 4, "place:list-photo": 5,
};
export function priority(t: CleanupTask): number {
  const tier = TIER[groupOf(t)] ?? 6;
  const fresh = t.place ? t.place.slots.some((s) => !s.done && s.fresh) : true;
  return tier * 2 + (fresh ? 0 : 1);
}
export function sortQueue(ts: CleanupTask[]): CleanupTask[] {
  return [...ts].sort((a, b) => priority(a) - priority(b) || a.parkName.localeCompare(b.parkName) || a.key.localeCompare(b.key));
}

/** A random quick fix: three times in four from the most important tier left. */
export function randomTask(ts: CleanupTask[], not: Set<string>): CleanupTask | null {
  const pool = ts.filter((t) => t.quick && !not.has(t.key));
  if (!pool.length) return null;
  const best = Math.min(...pool.map(priority));
  const first = pool.filter((t) => priority(t) === best);
  const from = Math.random() < 0.75 ? first : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/** Open count, done and total of a category in these tasks and totals. */
export function categoryStats(c: Category, tasks: CleanupTask[], totals: CleanupData["totals"]) {
  const open = tasks.filter((t) => c.groups.includes(groupOf(t))).length;
  const done = c.groups.reduce((s, g) => s + (totals[g]?.done ?? 0), 0);
  const total = c.groups.reduce((s, g) => s + (totals[g]?.total ?? 0), 0);
  return { open, done, total };
}

export async function api(action: string, key: string, person: CleanupPerson, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, key, person, ...extra }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || (res.status === 401 ? "Log in to admin mode again." : `Failed (${res.status})`));
  return body as { ok: true; already?: boolean };
}

/** A save through one of the site's own endpoints (the ones its editors use). */
export async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status === 401 ? "Log in to admin mode again." : `Not saved (${res.status})`);
  return res.json().catch(() => ({}));
}
