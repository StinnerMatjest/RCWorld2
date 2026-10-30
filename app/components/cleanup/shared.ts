import { variantUrl } from "@/app/lib/imageVariants";
import type { CleanupData, CleanupKind, CleanupPerson, CleanupTask, FrameSlot, SlotKind } from "@/app/lib/cleanup";

export type { CleanupData, CleanupKind, CleanupPerson, CleanupTask, FrameSlot, SlotKind };
export const PEOPLE: CleanupPerson[] = ["Jannik", "Nicklas"];
export const PERSON_KEY = "parkrating_cleanup_person";

/** A tile on the overview: a group of photo formats, or a kind of other quick fix. */
export interface Category { id: string; title: string; verb: string; slots?: SlotKind[]; kinds?: CleanupKind[] }
export const CATEGORIES: Category[] = [
  { id: "heroes", title: "Heroes", verb: "tall and wide to frame", slots: ["hero-phone", "hero-desktop"] },
  { id: "cards", title: "Front-page cards", verb: "to frame", slots: ["card"] },
  { id: "curated", title: "Curated & strips", verb: "cards to frame", slots: ["curated", "coaster-strip"] },
  { id: "review", title: "Review photos", verb: "to frame", slots: ["section", "section-phone", "section-desktop", "break-phone", "break-desktop"] },
  { id: "tiles", title: "Gallery tiles", verb: "to frame", slots: ["tile"] },
  { id: "lists", title: "List photos", verb: "to frame", slots: ["list-item", "list-cover"] },
  { id: "curated-pick", title: "Curated picks", verb: "parks to pick for", kinds: ["curated-pick"] },
  { id: "section-needs-photo", title: "Sections", verb: "without a photo", kinds: ["section-needs-photo"] },
  { id: "caption", title: "Captions", verb: "to fix", kinds: ["caption"] },
];

/** Short names for a format, as on the tabs. */
export const SLOT_SHORT: Record<SlotKind, string> = {
  "hero-phone": "Hero · tall", "hero-desktop": "Hero · wide", card: "Front-page card", curated: "Curated card", "coaster-strip": "Strip card",
  section: "Review", "section-phone": "Review · phone", "section-desktop": "Review · desktop", "break-phone": "Break · phone", "break-desktop": "Break · desktop",
  tile: "Gallery tile", "list-item": "List photo", "list-cover": "List cover",
};

export const KIND_LABEL: Record<CleanupKind, string> = {
  photo: "Framing", caption: "Caption", "curated-pick": "Curated photos", "section-needs-photo": "Review section",
  "coaster-review": "Review to write", "coaster-photos": "Photos missing",
};

/** The slots still open, optionally only those of some formats. */
export const openSlots = (t: CleanupTask, only?: SlotKind[]) => (t.slots ?? []).filter((s) => !s.done && (!only || only.includes(s.kind)));

export function taskTitle(t: CleanupTask, only?: SlotKind[]): string {
  switch (t.kind) {
    case "photo": {
      const open = openSlots(t, only);
      const name = t.coasterName ?? t.parkName;
      if (open.some((s) => s.kind === "hero-phone" || s.kind === "hero-desktop")) return `Frame ${name}'s hero`;
      if (open.some((s) => s.kind === "card")) return `Frame ${t.parkName}'s front-page card`;
      return "Frame this photo";
    }
    case "caption": return "Caption this photo";
    case "curated-pick": return `Pick ${t.parkName}'s curated photos`;
    case "section-needs-photo": return `Add a photo to ${t.section?.heading ?? "this section"}`;
    case "coaster-review": return `Write ${t.coasterName}'s review`;
    case "coaster-photos": return `Photos for ${t.coasterName}`;
  }
}

export function taskWhere(t: CleanupTask): string {
  const bits = [t.coasterName ? `${t.coasterName} · ${t.parkName}` : t.parkName];
  if (t.visitDate) bits.push(fmtDate(t.visitDate));
  return bits.join(" · ");
}

/** "Hero · tall, Hero · wide and 2 more" */
export function slotSummary(t: CleanupTask, only?: SlotKind[]): string {
  const names = openSlots(t, only).map((s) => SLOT_SHORT[s.kind]);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
export const pageUrl = (t: CleanupTask) =>
  t.coasterSlug ? `/coasters/${t.coasterSlug}` : t.parkSlug ? `/park/${t.parkSlug}${t.visitId ? `?visit=${t.visitId}` : ""}` : t.listSlug ? `/lists/${t.listSlug}` : "/lists";
export const thumb = (src: string | null | undefined, w = 480) => (src ? variantUrl(src, w) : "");

/**
 * Random picks favour what visitors see first: heroes and front-page cards,
 * then curated cards, review photos, captions and picks, then tiles and lists.
 * Never framed before already framed within each.
 */
const FIRST: SlotKind[] = ["hero-phone", "hero-desktop", "card"];
const LAST: SlotKind[] = ["tile", "list-item", "list-cover"];
export function priority(t: CleanupTask): number {
  if (t.kind !== "photo") return 2;
  const open = openSlots(t);
  const tier = open.some((s) => FIRST.includes(s.kind)) ? 0 : open.some((s) => !LAST.includes(s.kind)) ? 2 : 4;
  return tier + (open.some((s) => s.fresh) ? 0 : 1);
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

/** Does this task belong in a category (a photo with an open format of it, or a task of its kind)? */
export const inCategory = (t: CleanupTask, c: Category) => (c.slots ? t.kind === "photo" && openSlots(t, c.slots).length > 0 : !!c.kinds?.includes(t.kind));
/** Open items of a category in these tasks: formats for photo groups, tasks otherwise. */
export const openCount = (ts: CleanupTask[], c: Category) => (c.slots ? ts.reduce((n, t) => n + openSlots(t, c.slots).length, 0) : ts.filter((t) => c.kinds?.includes(t.kind)).length);
export const categoryKeys = (c: Category) => (c.slots ? c.slots.map((s) => `slot:${s}`) : c.kinds ?? []);

export async function api(action: string, key: string, person: CleanupPerson, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, key, person, ...extra }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || (res.status === 401 ? "Log in to admin mode again." : `Failed (${res.status})`));
  return body as { ok: true; already?: boolean };
}
