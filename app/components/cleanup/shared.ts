import { variantUrl } from "@/app/lib/imageVariants";
import type { CleanupData, CleanupKind, CleanupPerson, CleanupTask } from "@/app/lib/cleanup";

export type { CleanupData, CleanupKind, CleanupPerson, CleanupTask };
export const PEOPLE: CleanupPerson[] = ["Jannik", "Nicklas"];
export const PERSON_KEY = "parkrating_cleanup_person";

export const FRAMING: CleanupKind[] = ["park-hero", "visit-hero", "park-card", "coaster-hero", "curated-photo", "section-photo"];
export const isFraming = (k: CleanupKind) => FRAMING.includes(k);

/** The tiles on the overview: one per kind of quick fix. */
export const CATEGORIES: { id: string; title: string; verb: string; kinds: CleanupKind[] }[] = [
  { id: "coaster-hero", title: "Coaster heroes", verb: "to frame", kinds: ["coaster-hero"] },
  { id: "park-hero", title: "Park heroes", verb: "to frame", kinds: ["park-hero", "visit-hero"] },
  { id: "park-card", title: "Home cards", verb: "to frame", kinds: ["park-card"] },
  { id: "section-photo", title: "Review photos", verb: "to frame", kinds: ["section-photo"] },
  { id: "curated", title: "Curated photos", verb: "to pick or frame", kinds: ["curated-pick", "curated-photo"] },
  { id: "section-needs-photo", title: "Review sections", verb: "without a photo", kinds: ["section-needs-photo"] },
  { id: "caption", title: "Captions", verb: "to fix", kinds: ["caption"] },
];

export const KIND_LABEL: Record<CleanupKind, string> = {
  "park-hero": "Park hero", "visit-hero": "Visit hero", "park-card": "Home card", "coaster-hero": "Coaster hero",
  "curated-photo": "Curated photo", "section-photo": "Review photo", caption: "Caption", "curated-pick": "Curated photos",
  "section-needs-photo": "Review section", "coaster-review": "Review to write", "coaster-photos": "Photos missing",
};
export const KIND_GROUP: Record<CleanupKind, string> = {
  "park-hero": "Framing", "visit-hero": "Framing", "park-card": "Framing", "coaster-hero": "Framing", "curated-photo": "Framing", "section-photo": "Framing",
  caption: "Photos", "curated-pick": "Photos", "section-needs-photo": "Photos", "coaster-review": "Write", "coaster-photos": "Visit",
};

export function taskTitle(t: CleanupTask): string {
  switch (t.kind) {
    case "park-hero": return `Frame ${t.parkName}'s hero`;
    case "visit-hero": return `Frame the ${t.visitDate ?? ""} hero`.replace("  ", " ");
    case "park-card": return `Frame ${t.parkName}'s home card`;
    case "coaster-hero": return `Frame ${t.coasterName}'s hero`;
    case "curated-photo": return "Frame a curated photo";
    case "section-photo": return `Frame the ${t.section?.heading ?? "review"} photo`;
    case "caption": return "Caption this photo";
    case "curated-pick": return `Pick ${t.parkName}'s curated photos`;
    case "section-needs-photo": return `Add a photo to ${t.section?.heading ?? "this section"}`;
    case "coaster-review": return `Write ${t.coasterName}'s review`;
    case "coaster-photos": return `Photos for ${t.coasterName}`;
  }
}

export function taskWhere(t: CleanupTask): string {
  const bits = [t.coasterName ? `${t.coasterName} · ${t.parkName}` : t.parkName];
  if (t.visitDate && t.kind !== "visit-hero") bits.push(fmtDate(t.visitDate));
  if (t.kind === "visit-hero" && t.visitDate) bits.push(`visit of ${fmtDate(t.visitDate)}`);
  return bits.join(" · ");
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
export const pageUrl = (t: CleanupTask) => (t.coasterSlug ? `/coasters/${t.coasterSlug}` : `/park/${t.parkSlug}${t.visitId ? `?visit=${t.visitId}` : ""}`);
export const thumb = (src: string | null | undefined, w = 480) => (src ? variantUrl(src, w) : "");

/** Never-framed framings and the non-framing fixes first; "framed before, check it" after. */
export const priority = (t: CleanupTask) => (isFraming(t.kind) && t.state === "framed" ? 1 : 0);
export function sortQueue(ts: CleanupTask[]): CleanupTask[] {
  return [...ts].sort((a, b) => priority(a) - priority(b) || a.parkName.localeCompare(b.parkName) || a.key.localeCompare(b.key));
}

/** A random quick fix, never-framed ones three times as likely. */
export function randomTask(ts: CleanupTask[], not: Set<string>): CleanupTask | null {
  const pool = ts.filter((t) => t.quick && !not.has(t.key));
  if (!pool.length) return null;
  const first = pool.filter((t) => priority(t) === 0);
  const from = first.length && Math.random() < 0.75 ? first : pool;
  return from[Math.floor(Math.random() * from.length)];
}

export async function api(action: string, key: string, person: CleanupPerson, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, key, person, ...extra }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || (res.status === 401 ? "Log in to admin mode again." : `Failed (${res.status})`));
  return body as { ok: true; already?: boolean };
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status === 401 ? "Log in to admin mode again." : `Not saved (${res.status})`);
}

/**
 * Save a framing through the same endpoint the page's own editor uses, then
 * credit it. Review-section photos go through the clean-up endpoint, which
 * changes only that one photo's framing and credits in one go.
 */
export async function saveFraming(t: CleanupTask, focus: string[], person: CleanupPerson) {
  const f = focus[0];
  switch (t.kind) {
    case "park-hero": await send(`/api/park/${t.parkId}`, "PATCH", { headerFocus: f }); break;
    case "visit-hero": await send(`/api/visits/${t.visitId}/header`, "PATCH", { imagepath: t.image, focus: f }); break;
    case "park-card": await send(`/api/park/${t.parkId}`, "PATCH", { imageFocus: f }); break;
    case "coaster-hero": await send(`/api/coasters/${t.coasterId}/gallery`, "PATCH", { imageId: t.imageId, focusMobile: focus[0], focusDesktop: focus[1] }); break;
    case "curated-photo": await send(`/api/visits/${t.visitId}/gallery`, "PATCH", { focus: { [String(t.imageId)]: f } }); break;
    case "section-photo": return api("section-focus", t.key, person, { focus: f });
    default: throw new Error("Not a framing task");
  }
  return api("done", t.key, person);
}
