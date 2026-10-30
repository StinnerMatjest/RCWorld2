// The clean-up tool: every editorial gap on the site as a task, worked through
// by Jannik and Nicklas. Tasks are computed from the content tables on every
// request; the tool only stores what a person did (cleanup_marks: "this one
// was checked by eye", cleanup_log: who gets the credit).
//
// Framing tasks cover every cropped image, framed before or not: a framing
// counts as done once someone looked at it in the tool (saved or "Looks
// right"). Its fingerprint is the photo, so a new photo opens the task again.

import { pool } from "@/app/lib/db";
import { getImageSizes, type ImageSize } from "@/app/lib/imageDims";
import { sectionImageFrame } from "@/app/utils/sectionImageAspect";

export const CLEANUP_PEOPLE = ["Jannik", "Nicklas"] as const;
export type CleanupPerson = typeof CLEANUP_PEOPLE[number];

export type CleanupKind =
  | "park-hero" | "visit-hero" | "park-card" | "coaster-hero" | "curated-photo" | "section-photo"
  | "caption" | "curated-pick" | "section-needs-photo"
  | "coaster-review" | "coaster-photos";

export const FRAMING_KINDS: CleanupKind[] = ["park-hero", "visit-hero", "park-card", "coaster-hero", "curated-photo", "section-photo"];
/** Never handed out at random: they need writing or a visit, not a quick fix. */
export const MANUAL_KINDS: CleanupKind[] = ["coaster-review", "coaster-photos"];

/** One crop of the photo as the site draws it. `focus` is null when this frame shares the task's single focus. */
export type CleanupFrame = { name: "Phone" | "Desktop"; aspect: string; focus?: string | null; clampAspect?: number };

export interface CleanupTask {
  key: string;
  kind: CleanupKind;
  quick: boolean;
  /** Framing: "never" = never framed (or an old/default value that shows the centre); "framed" = framed before, check it. */
  state: "never" | "framed" | "open";
  parkId: number; parkName: string; parkSlug: string;
  coasterId?: number; coasterName?: string; coasterSlug?: string;
  visitId?: number; visitDate?: string | null;
  /** What it is about, shown under the title: a section name, a caption, a visit date. */
  label?: string;
  image?: string | null;
  size?: ImageSize;
  /** Framing: the frames to judge. With `focus` set (single, shared by every frame) the frames are previews of one value. */
  frames?: CleanupFrame[];
  focus?: string | null;
  /** coaster-hero: the gallery row that is the header. curated-photo / caption: the gallery row. */
  imageId?: number;
  section?: { table: "parktexts" | "coastertext"; rowId: number; index: number; heading: string; excerpt: string };
  caption?: { current: string; why: string };
  /** curated-pick / section-needs-photo: how many photos there are to choose from. */
  choices?: number;
  rating?: number;
  fingerprint: string;
}

export interface CleanupTotals { done: number; total: number }
export interface CleanupPark {
  id: number; name: string; slug: string; country: string; overall: number | null; card: string | null;
  done: number; total: number; open: Partial<Record<CleanupKind, number>>;
}
export interface CleanupData {
  tasks: CleanupTask[];
  totals: Partial<Record<CleanupKind, CleanupTotals>>;
  parks: CleanupPark[];
  scores: Record<CleanupPerson, { total: number; week: number }>;
}

// ─── tables ──────────────────────────────────────────────────────────────────

let ready: Promise<void> | null = null;
export function ensureCleanupTables(): Promise<void> {
  if (!ready) {
    ready = pool
      .query(`
        CREATE TABLE IF NOT EXISTS cleanup_marks (
          task_key TEXT PRIMARY KEY,
          fingerprint TEXT NOT NULL,
          person TEXT NOT NULL,
          action TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS cleanup_log (
          id SERIAL PRIMARY KEY,
          task_key TEXT NOT NULL,
          kind TEXT NOT NULL,
          person TEXT NOT NULL,
          action TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS cleanup_log_person_idx ON cleanup_log (person, created_at);
      `)
      .then(() => undefined)
      .catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const blank = (s: unknown) => s == null || !String(s).trim();
const isVideo = (p: string | null | undefined) => /\.(mp4|webm|mov|ogg)$/i.test(p || "");

/** A stored focus that really frames the photo: not missing, not the default centre, not the old "X% Y%" format the site draws centred. */
export function isRealFocus(f: string | null | undefined): boolean {
  if (blank(f)) return false;
  const s = String(f).trim();
  if (s.includes("%")) return false;
  const [x, y, z] = s.split(/\s+/).map(Number);
  if (![x, y].every(Number.isFinite)) return false;
  return !(Math.abs(x - 0.5) < 0.002 && Math.abs(y - 0.5) < 0.002 && (!Number.isFinite(z) || Math.abs(z - 1) < 0.002));
}

/** Section media are stored as "url|cx cy zoom,url|…". */
export function splitSectionMedia(v: string | null | undefined): { url: string; focus: string | null }[] {
  return String(v || "").split(",").map((s) => s.trim()).filter(Boolean).map((e) => {
    const i = e.indexOf("|");
    return { url: i < 0 ? e : e.slice(0, i), focus: i < 0 ? null : e.slice(i + 1) };
  });
}
export const joinSectionMedia = (m: { url: string; focus: string | null }[]) => m.map((e) => (e.focus ? `${e.url}|${e.focus}` : e.url)).join(",");

const SECTION_LABEL: Record<string, string> = {
  description: "Introduction", bestCoaster: "Best coaster", coasterDepth: "Coaster depth", waterRides: "Water rides",
  flatridesAndDarkrides: "Flat rides & dark rides", parkAppearance: "Appearance", parkPracticality: "Practicality",
  food: "Food", snacksAndDrinks: "Snacks & drinks", rideOperations: "Ride operations", parkManagement: "Management",
};
const excerptOf = (t: unknown) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length > 220 ? s.slice(0, 217).trimEnd() + "…" : s; };
const dateOf = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);

/** Why a caption needs work, or null when it is fine. Shared = the same caption on 3+ photos of one visit or coaster. */
function captionProblem(desc: string | null | undefined, parkName: string, sharedCount: number): string | null {
  const s = String(desc || "").trim();
  if (!s) return "No caption";
  if (/^untitled|^img[_ -]?\d|^dsc\d|^pxl_|^\d+$/i.test(s) || s.length < 3) return "Looks like a file name";
  if (s.toLowerCase() === parkName.toLowerCase()) return "Just the park's name";
  if (sharedCount >= 3) return `Same caption on ${sharedCount} photos`;
  return null;
}

// Hero and card frames, as the site draws them (ParkHero, CoasterHero, the home card).
const HERO_FRAMES: CleanupFrame[] = [{ name: "Phone", aspect: "4 / 5" }, { name: "Desktop", aspect: "21 / 9" }];
/** Home card: 500 px tall; ~300 px wide on our phones, up to 400 px in the desktop grid (the crop is clamped for the widest). */
const CARD_FRAMES: CleanupFrame[] = [{ name: "Phone", aspect: "299.5 / 500" }, { name: "Desktop", aspect: "400 / 500", clampAspect: 400 / 500 }];

// ─── compute ─────────────────────────────────────────────────────────────────

export async function loadCleanup(): Promise<CleanupData> {
  await ensureCleanupTables();
  const [parksR, visitsR, vgR, ptR, rcR, cgR, ctR, marksR, scoresR] = await Promise.all([
    pool.query(`SELECT id, name, slug, country, imagepath, header_focus, card_imagepath, image_focus FROM parks ORDER BY name`),
    pool.query(`SELECT id, park_id, date, overall, header_imagepath, header_focus FROM visits WHERE published = true ORDER BY date DESC NULLS LAST, id DESC`),
    pool.query(`SELECT g.id, g.visit_id, g.title, g.path, g.description, g.featured, g.focus FROM visitgallery g JOIN visits v ON v.id = g.visit_id WHERE v.published = true ORDER BY g.sort_order ASC NULLS LAST, g.id ASC`),
    pool.query(`SELECT t.id, t.visit_id, t.category, left(t.text, 300) AS text, t.image_url, t.image_layout FROM parktexts t JOIN visits v ON v.id = t.visit_id WHERE v.published = true`),
    pool.query(`SELECT id, name, slug, park_id, rating FROM rollercoasters`),
    pool.query(`SELECT id, coaster_id, title, path, description, is_header, focus_mobile, focus_desktop FROM coastergallery ORDER BY sort_order ASC NULLS LAST, id ASC`),
    pool.query(`SELECT id, coaster_id, headline, left(text, 300) AS text, "order", image_url, image_layout FROM coastertext ORDER BY coaster_id, "order" ASC`),
    pool.query(`SELECT task_key, fingerprint FROM cleanup_marks`),
    pool.query(`SELECT person, count(*)::int AS total, count(*) FILTER (WHERE created_at >= date_trunc('week', now()))::int AS week FROM cleanup_log GROUP BY person`),
  ]);
  const marks = new Map<string, string>(marksR.rows.map((r) => [r.task_key, r.fingerprint]));
  const checked = (key: string, fp: string) => marks.get(key) === fp;

  const parks = new Map<number, { id: number; name: string; slug: string; country: string; imagepath: string | null; header_focus: string | null; card_imagepath: string | null; image_focus: string | null }>(parksR.rows.map((p) => [p.id, p]));
  const visitsByPark = new Map<number, typeof visitsR.rows>();
  for (const v of visitsR.rows) { if (!parks.has(v.park_id)) continue; (visitsByPark.get(v.park_id) ?? visitsByPark.set(v.park_id, []).get(v.park_id)!).push(v); }
  const visitPark = new Map<number, number>(visitsR.rows.map((v) => [v.id, v.park_id]));
  const visitById = new Map<number, (typeof visitsR.rows)[number]>(visitsR.rows.map((v) => [v.id, v]));
  const galleryByVisit = new Map<number, typeof vgR.rows>();
  for (const g of vgR.rows) (galleryByVisit.get(g.visit_id) ?? galleryByVisit.set(g.visit_id, []).get(g.visit_id)!).push(g);
  const coasters = rcR.rows.filter((c) => parks.has(c.park_id));
  const coasterById = new Map<number, (typeof rcR.rows)[number]>(coasters.map((c) => [c.id, c]));
  const galleryByCoaster = new Map<number, typeof cgR.rows>();
  for (const g of cgR.rows) if (coasterById.has(g.coaster_id)) (galleryByCoaster.get(g.coaster_id) ?? galleryByCoaster.set(g.coaster_id, []).get(g.coaster_id)!).push(g);
  const textsByCoaster = new Map<number, typeof ctR.rows>();
  for (const t of ctR.rows) if (coasterById.has(t.coaster_id)) (textsByCoaster.get(t.coaster_id) ?? textsByCoaster.set(t.coaster_id, []).get(t.coaster_id)!).push(t);

  const all: (CleanupTask & { done: boolean })[] = [];
  const push = (t: Omit<CleanupTask, "quick"> & { done: boolean }) => all.push({ ...t, quick: !MANUAL_KINDS.includes(t.kind) });
  const base = (parkId: number) => { const p = parks.get(parkId)!; return { parkId, parkName: p.name, parkSlug: p.slug }; };

  for (const p of parks.values()) {
    const visits = visitsByPark.get(p.id) ?? [];
    const latest = visits[0];
    // Park hero: shown whenever the newest visit has no header of its own.
    if (p.imagepath && !(latest && latest.header_imagepath)) {
      push({ ...base(p.id), key: `park-hero:${p.id}`, kind: "park-hero", state: isRealFocus(p.header_focus) ? "framed" : "never", image: p.imagepath, frames: HERO_FRAMES, focus: p.header_focus, fingerprint: p.imagepath, done: checked(`park-hero:${p.id}`, p.imagepath) });
    }
    for (const v of visits) {
      if (!v.header_imagepath) continue;
      push({ ...base(p.id), key: `visit-hero:${v.id}`, kind: "visit-hero", state: isRealFocus(v.header_focus) ? "framed" : "never", visitId: v.id, visitDate: dateOf(v.date), label: `Visit ${dateOf(v.date) ?? ""}`.trim(), image: v.header_imagepath, frames: HERO_FRAMES, focus: v.header_focus, fingerprint: v.header_imagepath, done: checked(`visit-hero:${v.id}`, v.header_imagepath) });
    }
    const cardSrc = p.card_imagepath || p.imagepath;
    if (cardSrc) {
      push({ ...base(p.id), key: `park-card:${p.id}`, kind: "park-card", state: isRealFocus(p.image_focus) ? "framed" : "never", image: cardSrc, frames: CARD_FRAMES, focus: p.image_focus, fingerprint: cardSrc, done: checked(`park-card:${p.id}`, cardSrc) });
    }
    if (latest) {
      const photos = (galleryByVisit.get(latest.id) ?? []).filter((g) => !isVideo(g.path));
      const picked = photos.filter((g) => g.featured);
      push({ ...base(p.id), key: `curated-pick:${latest.id}`, kind: "curated-pick", state: "open", visitId: latest.id, visitDate: dateOf(latest.date), image: photos[0]?.path ?? null, choices: photos.length, fingerprint: String(latest.id), done: picked.length > 0 || photos.length === 0 });
      for (const g of picked) {
        push({ ...base(p.id), key: `curated-photo:${g.id}`, kind: "curated-photo", state: isRealFocus(g.focus) ? "framed" : "never", visitId: latest.id, imageId: g.id, label: g.description || g.title, image: g.path, frames: [{ name: "Phone", aspect: "4 / 5" }], focus: g.focus, fingerprint: g.path, done: checked(`curated-photo:${g.id}`, g.path) });
      }
    }
    for (const v of visits) {
      // Captions: every photo of every published visit.
      const photos = (galleryByVisit.get(v.id) ?? []).filter((g) => !isVideo(g.path));
      const shared = new Map<string, number>();
      for (const g of photos) { const s = String(g.description || "").trim().toLowerCase(); if (s) shared.set(s, (shared.get(s) ?? 0) + 1); }
      for (const g of photos) {
        const cur = String(g.description || "").trim();
        const why = captionProblem(cur, p.name, shared.get(cur.toLowerCase()) ?? 0);
        const key = `caption:v${g.id}`;
        push({ ...base(p.id), key, kind: "caption", state: "open", visitId: v.id, visitDate: dateOf(v.date), imageId: g.id, label: g.title, image: g.path, caption: { current: cur, why: why ?? "" }, fingerprint: cur, done: !why || checked(key, cur) });
      }
    }
  }

  // Review sections of every published visit: each photo's framing, and sections without a photo.
  for (const t of ptR.rows) {
    const parkId = visitPark.get(t.visit_id); if (parkId == null) continue;
    const v = visitById.get(t.visit_id)!;
    const heading = SECTION_LABEL[t.category] ?? t.category;
    const media = splitSectionMedia(t.image_url).filter((m) => !isVideo(m.url));
    const frame = sectionImageFrame(t.image_layout, media.length, { defaultLayout: t.category === "description" ? "below" : null });
    media.forEach((m, index) => {
      const key = `section-photo:p${t.id}:${index}`;
      push({ ...base(parkId), key, kind: "section-photo", state: isRealFocus(m.focus) ? "framed" : "never", visitId: t.visit_id, visitDate: dateOf(v.date), label: heading, image: m.url, frames: [{ name: "Phone", aspect: frame.mobile }, { name: "Desktop", aspect: frame.desktop }], focus: m.focus, section: { table: "parktexts", rowId: t.id, index, heading, excerpt: excerptOf(t.text) }, fingerprint: m.url, done: checked(key, m.url) });
    });
    if (!media.length && !blank(t.text)) {
      const choices = (galleryByVisit.get(t.visit_id) ?? []).filter((g) => !isVideo(g.path)).length;
      if (choices) {
        const key = `section-needs-photo:p${t.id}`;
        push({ ...base(parkId), key, kind: "section-needs-photo", state: "open", visitId: t.visit_id, visitDate: dateOf(v.date), label: heading, section: { table: "parktexts", rowId: t.id, index: 0, heading, excerpt: excerptOf(t.text) }, choices, fingerprint: "none", done: checked(key, "none") });
      }
    }
  }

  // Coasters: hero framing, section photos, captions, and the manual lists.
  const coasterCaptionSeen = new Set(vgR.rows.map((g) => g.path));
  for (const c of coasters) {
    const b = { ...base(c.park_id), coasterId: c.id, coasterName: c.name, coasterSlug: c.slug };
    const gallery = (galleryByCoaster.get(c.id) ?? []).filter((g) => !isVideo(g.path));
    const header = [...gallery].filter((g) => g.is_header).sort((x, y) => y.id - x.id)[0] ?? gallery[0];
    if (header) {
      const framed = isRealFocus(header.focus_mobile) && isRealFocus(header.focus_desktop);
      const key = `coaster-hero:${c.id}`;
      push({ ...b, key, kind: "coaster-hero", state: framed ? "framed" : "never", label: c.name, imageId: header.id, image: header.path, frames: [{ ...HERO_FRAMES[0], focus: header.focus_mobile }, { ...HERO_FRAMES[1], focus: header.focus_desktop }], fingerprint: header.path, done: checked(key, header.path) });
    }
    const shared = new Map<string, number>();
    for (const g of gallery) { const s = String(g.description || "").trim().toLowerCase(); if (s) shared.set(s, (shared.get(s) ?? 0) + 1); }
    for (const g of gallery) {
      if (coasterCaptionSeen.has(g.path)) continue; // the same photo is captioned through its visit
      coasterCaptionSeen.add(g.path);
      const cur = String(g.description || "").trim();
      const why = captionProblem(cur, parks.get(c.park_id)!.name, shared.get(cur.toLowerCase()) ?? 0);
      const key = `caption:c${g.id}`;
      push({ ...b, key, kind: "caption", state: "open", imageId: g.id, label: g.title, image: g.path, caption: { current: cur, why: why ?? "" }, fingerprint: cur, done: !why || checked(key, cur) });
    }
    const texts = textsByCoaster.get(c.id) ?? [];
    texts.forEach((t, i) => {
      const heading = t.headline || `Section ${i + 1}`;
      const media = splitSectionMedia(t.image_url).filter((m) => !isVideo(m.url));
      const frame = sectionImageFrame(t.image_layout, media.length, { defaultLayout: i % 2 === 0 ? "left" : "right" });
      media.forEach((m, index) => {
        const key = `section-photo:c${t.id}:${index}`;
        push({ ...b, key, kind: "section-photo", state: isRealFocus(m.focus) ? "framed" : "never", label: heading, image: m.url, frames: [{ name: "Phone", aspect: frame.mobile }, { name: "Desktop", aspect: frame.desktop }], focus: m.focus, section: { table: "coastertext", rowId: t.id, index, heading, excerpt: excerptOf(t.text) }, fingerprint: m.url, done: checked(key, m.url) });
      });
      if (!media.length && !blank(t.text) && gallery.length) {
        const key = `section-needs-photo:c${t.id}`;
        push({ ...b, key, kind: "section-needs-photo", state: "open", label: heading, section: { table: "coastertext", rowId: t.id, index: 0, heading, excerpt: excerptOf(t.text) }, choices: gallery.length, fingerprint: "none", done: checked(key, "none") });
      }
    });
    const rating = Number(c.rating) || 0;
    if (rating > 0) {
      push({ ...b, key: `coaster-review:${c.id}`, kind: "coaster-review", state: "open", rating, image: header?.path ?? null, fingerprint: "", done: texts.some((t) => !blank(t.text)) });
      push({ ...b, key: `coaster-photos:${c.id}`, kind: "coaster-photos", state: "open", rating, fingerprint: "", done: gallery.length > 0 });
    }
  }

  // Sizes for the framing previews.
  const sizes = await getImageSizes(all.filter((t) => t.frames && t.image && !t.done).map((t) => t.image));
  const totals: CleanupData["totals"] = {};
  const parkAgg = new Map<number, CleanupPark>();
  for (const p of parks.values()) {
    const latest = (visitsByPark.get(p.id) ?? [])[0];
    parkAgg.set(p.id, { id: p.id, name: p.name, slug: p.slug, country: p.country, overall: latest ? Number(latest.overall) : null, card: p.card_imagepath || p.imagepath, done: 0, total: 0, open: {} });
  }
  for (const t of all) {
    const tt = (totals[t.kind] ??= { done: 0, total: 0 }); tt.total++; if (t.done) tt.done++;
    if (t.quick) { const pa = parkAgg.get(t.parkId)!; pa.total++; if (t.done) pa.done++; else pa.open[t.kind] = (pa.open[t.kind] ?? 0) + 1; }
  }
  const tasks: CleanupTask[] = all.filter((t) => !t.done).map((t) => {
    const { done, ...rest } = t; void done;
    return rest.image && sizes[rest.image] ? { ...rest, size: sizes[rest.image] } : rest;
  });
  const scores = Object.fromEntries(CLEANUP_PEOPLE.map((n) => [n, { total: 0, week: 0 }])) as CleanupData["scores"];
  for (const r of scoresR.rows) if ((CLEANUP_PEOPLE as readonly string[]).includes(r.person)) scores[r.person as CleanupPerson] = { total: r.total, week: r.week };
  return { tasks, totals, parks: [...parkAgg.values()], scores };
}

// ─── actions ─────────────────────────────────────────────────────────────────

export async function creditTask(key: string, kind: CleanupKind, person: CleanupPerson, action: string, fingerprint?: string) {
  await ensureCleanupTables();
  if (fingerprint !== undefined) {
    await pool.query(
      `INSERT INTO cleanup_marks (task_key, fingerprint, person, action) VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_key) DO UPDATE SET fingerprint = EXCLUDED.fingerprint, person = EXCLUDED.person, action = EXCLUDED.action, created_at = now()`,
      [key, fingerprint, person, action]
    );
  }
  await pool.query(`INSERT INTO cleanup_log (task_key, kind, person, action) VALUES ($1, $2, $3, $4)`, [key, kind, person, action]);
}

/** True when someone already got the credit for this task. */
export async function wasCredited(key: string): Promise<boolean> {
  await ensureCleanupTables();
  const r = await pool.query(`SELECT 1 FROM cleanup_log WHERE task_key = $1 LIMIT 1`, [key]);
  return (r.rowCount ?? 0) > 0;
}

/** Replace one section photo's framing, only if that slot still holds the same photo. */
export async function setSectionFocus(table: "parktexts" | "coastertext", rowId: number, index: number, url: string, focus: string): Promise<boolean> {
  const cur = await pool.query(`SELECT image_url FROM ${table} WHERE id = $1`, [rowId]);
  if (!cur.rowCount) return false;
  const media = splitSectionMedia(cur.rows[0].image_url);
  if (!media[index] || media[index].url !== url) return false;
  media[index] = { url, focus };
  const res = await pool.query(`UPDATE ${table} SET image_url = $1 WHERE id = $2 AND image_url IS NOT DISTINCT FROM $3`, [joinSectionMedia(media), rowId, cur.rows[0].image_url]);
  return (res.rowCount ?? 0) > 0;
}

/** Give a section its first photo, only if it still has none. */
export async function addSectionPhoto(table: "parktexts" | "coastertext", rowId: number, url: string): Promise<boolean> {
  const res = await pool.query(`UPDATE ${table} SET image_url = $1 WHERE id = $2 AND (image_url IS NULL OR btrim(image_url) = '')`, [`${url}|0.5000 0.5000 1.000`, rowId]);
  return (res.rowCount ?? 0) > 0;
}

/** Set a caption on every gallery row that shows this photo with the old caption (a photo can sit in a visit and a coaster gallery). */
export async function setCaption(path: string, oldCaption: string, text: string): Promise<number> {
  const a = await pool.query(`UPDATE visitgallery SET description = $1 WHERE path = $2 AND coalesce(btrim(description), '') = $3`, [text, path, oldCaption]);
  const b = await pool.query(`UPDATE coastergallery SET description = $1 WHERE path = $2 AND coalesce(btrim(description), '') = $3`, [text, path, oldCaption]);
  return (a.rowCount ?? 0) + (b.rowCount ?? 0);
}
