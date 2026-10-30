// The clean-up tool: every editorial gap on the site as a task, worked through
// by Jannik and Nicklas. Tasks are computed from the content tables on every
// request; the tool only stores what a person did (cleanup_marks: "this one
// was checked by eye", cleanup_log: who gets the credit).
//
// Framing is one task per photo: every format the photo is shown in on the
// site is a slot of that task (hero phone and desktop, front-page card,
// curated card, review section phone and desktop, photo break, gallery tile,
// coaster strip, list images). A slot counts as done once someone checked it in
// the tool (saved or "Looks right"); its fingerprint is the photo, so a new
// photo in that place opens it again.

import { pool } from "@/app/lib/db";
import { getImageSizes, type ImageSize } from "@/app/lib/imageDims";
import { sectionImageFrame, SECTION_IMAGE_ASPECT } from "@/app/utils/sectionImageAspect";
import { ensureVisitHeaderColumns } from "@/app/lib/visitHeader";
import { regenerateParkCuts } from "@/app/lib/cardCut";
import { splitFocusPair, joinFocusPair } from "@/app/lib/framing";

export const CLEANUP_PEOPLE = ["Jannik", "Nicklas"] as const;
export type CleanupPerson = typeof CLEANUP_PEOPLE[number];

export type CleanupKind = "photo" | "caption" | "curated-pick" | "section-needs-photo" | "coaster-review" | "coaster-photos";
/** Never handed out at random: they need writing or a visit, not a quick fix. */
export const MANUAL_KINDS: CleanupKind[] = ["coaster-review", "coaster-photos"];

export type SlotKind =
  | "hero-phone" | "hero-desktop" | "card" | "curated" | "coaster-strip"
  | "section-phone" | "section-desktop" | "section" | "break-phone" | "break-desktop"
  | "tile" | "list-item" | "list-cover";

/** Where a slot's framing is stored; the server writes it, never the page. */
export type SlotTarget =
  | { t: "park-hero"; parkId: number; phone: boolean }
  | { t: "visit-hero"; visitId: number; phone: boolean }
  | { t: "coaster-hero"; rowId: number; phone: boolean }
  | { t: "card"; parkId: number }
  | { t: "curated"; rowId: number }
  | { t: "section"; table: "parktexts" | "coastertext"; rowId: number; index: number; part: "desktop" | "phone" | "both" }
  | { t: "photo"; format: "gallery-tile" | "coaster-strip" | "list-item" | "list-cover" | "photo-break"; part?: "desktop" | "phone" };

export interface FrameSlot {
  id: string;
  kind: SlotKind;
  /** "Park page cover · phone (tall)", "Front page card", … */
  label: string;
  /** Which page it is on: "Parc Astérix", "Toutatis · Introduction", a list title. */
  where: string;
  aspect: string;
  /** Other shapes the same framing is drawn in (other screens), shown as previews beside the editor. */
  previews?: { label: string; aspect: string }[];
  /** focus = a point at the frame's centre plus zoom (heroes, card, curated); position = object-position, no zoom. */
  mode: "focus" | "position";
  maxZoom: number;
  clampAspect?: number;
  /** What the page draws over the photo in this format. */
  face?: "hero" | "card" | "caption";
  faceText?: string;
  /** Hero: the score the page shows on it. Card: the visit whose scores the card shows. */
  faceRating?: number | null;
  faceVisit?: Record<string, string | number | null> | null;
  value: string | null;
  /** What the site draws when value is empty (a phone frame falls back to the desktop framing), and which format that is. */
  fallback?: string | null;
  fallbackFrom?: string;
  /** Never framed (or an old/default value that shows the centre). */
  fresh: boolean;
  done: boolean;
  target: SlotTarget;
}

export interface CleanupTask {
  key: string;
  kind: CleanupKind;
  quick: boolean;
  /** photo: "never" when a slot was never framed; "framed" when only checks remain. */
  state: "never" | "framed" | "open";
  parkId: number | null; parkName: string; parkSlug: string | null;
  coasterId?: number; coasterName?: string; coasterSlug?: string;
  visitId?: number; visitDate?: string | null;
  /** List photos: the list they are in. */
  listSlug?: string;
  label?: string;
  image?: string | null;
  size?: ImageSize;
  /** photo: every format this photo is shown in (open and done). */
  slots?: FrameSlot[];
  imageId?: number;
  section?: { table: "parktexts" | "coastertext"; rowId: number; index: number; heading: string; excerpt: string };
  caption?: { current: string; why: string };
  choices?: number;
  rating?: number;
  fingerprint: string;
}

export interface CleanupTotals { done: number; total: number }
export interface CleanupPark {
  id: number; name: string; slug: string; country: string; overall: number | null; card: string | null;
  done: number; total: number; open: Partial<Record<string, number>>;
}
export interface CleanupData {
  tasks: CleanupTask[];
  /** Per task kind, and per slot kind as "slot:<kind>". */
  totals: Partial<Record<string, CleanupTotals>>;
  parks: CleanupPark[];
  scores: Record<CleanupPerson, { total: number; week: number }>;
}

// ─── tables ──────────────────────────────────────────────────────────────────

let ready: Promise<void> | null = null;
export function ensureCleanupTables(): Promise<void> {
  if (!ready) {
    ready = Promise.all([
      ensureVisitHeaderColumns(),
      pool.query(`
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
      `),
    ])
      .then(() => undefined)
      .catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const blank = (s: unknown) => s == null || !String(s).trim();
const isVideo = (p: string | null | undefined) => /\.(mp4|webm|mov|ogg)$/i.test(p || "");

/** A stored value that really frames the photo: not missing, not the default centre, not the old "X% Y%" format the site draws centred. */
export function isRealFocus(f: string | null | undefined): boolean {
  if (blank(f)) return false;
  const s = String(f).trim();
  if (s.includes("%")) return false;
  const [x, y, z] = s.split(/\s+/).map(Number);
  if (![x, y].every(Number.isFinite)) return false;
  return !(Math.abs(x - 0.5) < 0.002 && Math.abs(y - 0.5) < 0.002 && (!Number.isFinite(z) || Math.abs(z - 1) < 0.002));
}

/** Section media are stored as "url|desktop" or "url|desktop|phone", comma-separated. */
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
const SCORE_KEYS = ["overall", "bestCoaster", "coasterDepth", "waterRides", "flatridesAndDarkrides", "parkAppearance", "parkPracticality", "food", "snacksAndDrinks", "rideOperations", "parkManagement"] as const;
/** The scores and date a front-page card shows, for the card overlay in the editor. */
const cardScores = (v: Record<string, unknown>) => ({ ...Object.fromEntries(SCORE_KEYS.map((k) => [k, v[k] == null ? null : Number(v[k])])), date: dateOf(v.date) });
const ratio = (x: string) => { const [w, h] = x.split("/").map(parseFloat); return w / h; };
const sameAspect = (a: string, b: string) => Math.abs(ratio(a) - ratio(b)) < 0.01;

/** Why a caption needs work, or null when it is fine. Shared = the same caption on 3+ photos of one visit or coaster. */
function captionProblem(desc: string | null | undefined, parkName: string, sharedCount: number): string | null {
  const s = String(desc || "").trim();
  if (!s) return "No caption";
  if (/^untitled|^img[_ -]?\d|^dsc\d|^pxl_|^\d+$/i.test(s) || s.length < 3) return "Looks like a file name";
  if (s.toLowerCase() === parkName.toLowerCase()) return "Just the park's name";
  if (sharedCount >= 3) return `Same caption on ${sharedCount} photos`;
  return null;
}

// The site's frame shapes.
const HERO = { phone: "4 / 5", desktop: "21 / 9" };
/** Home card: 500 px tall, ~300 px wide on phones up to 400 px in the desktop grid; the crop is clamped for the widest. */
const CARD = { aspect: "400 / 500", clamp: 400 / 500 };
/**
 * Gallery tiles are h-40 / md:h-48 in a 2- or 3-column grid, so their shape
 * changes with the screen (measured on the pages, 2026-10-30): park galleries
 * 166x160 on a phone, 174x192 on a wide screen, 118x192 on a laptop; coaster
 * galleries 280x192 wide, 192x192 laptop. One position serves all of them.
 */
const TILE = "26 / 25";
const PARK_TILE_PREVIEWS = [{ label: "Park gallery · wide screen", aspect: "29 / 32" }, { label: "Park gallery · laptop", aspect: "3 / 5" }];
const COASTER_TILE_PREVIEWS = [{ label: "Coaster gallery · wide screen", aspect: "35 / 24" }, { label: "Coaster gallery · laptop", aspect: "1 / 1" }];
/** Hero frames are 21:9 capped at 68vh from 1024 px (1865x900 -> 1865x612), 16:9 from 640. */
const HERO_DESKTOP_PREVIEWS = [{ label: "Wide screen", aspect: "61 / 20" }, { label: "Tablet", aspect: "16 / 9" }];
const LIST_ITEM = "4 / 3";
/** h-48 over a 352 px card (one column on phones, three in max-w-6xl). */
const LIST_COVER = "11 / 6";

// ─── compute ─────────────────────────────────────────────────────────────────

/**
 * Formats left out of the tool (user, 2026-10-30): review-section photos are
 * framed when the review is written, and gallery-tile framing does not matter.
 * The site still draws any framing stored for them.
 */
const SKIPPED_FORMATS: SlotKind[] = ["section", "section-phone", "section-desktop", "tile"];

type SlotDraft = Omit<FrameSlot, "fresh" | "done"> & { owner: { parkId: number | null; coasterId?: number; visitId?: number; listSlug?: string } };

export async function loadCleanup(): Promise<CleanupData> {
  await ensureCleanupTables();
  const [parksR, visitsR, vgR, ptR, rcR, cgR, ctR, listsR, itemsR, pfR, marksR, scoresR] = await Promise.all([
    pool.query(`SELECT id, name, slug, country, imagepath, header_focus, header_focus_mobile, card_imagepath, image_focus FROM parks ORDER BY name`),
    pool.query(`SELECT id, park_id, date, overall, header_imagepath, header_focus, header_focus_mobile,
                       bestCoaster AS "bestCoaster", coasterDepth AS "coasterDepth", waterRides AS "waterRides",
                       flatridesAndDarkrides AS "flatridesAndDarkrides", parkAppearance AS "parkAppearance",
                       parkPracticality AS "parkPracticality", food, snacksAndDrinks AS "snacksAndDrinks",
                       rideOperations AS "rideOperations", parkManagement AS "parkManagement"
                FROM visits WHERE published = true ORDER BY date DESC NULLS LAST, id DESC`),
    pool.query(`SELECT g.id, g.visit_id, g.title, g.path, g.description, g.featured, g.focus FROM visitgallery g JOIN visits v ON v.id = g.visit_id WHERE v.published = true ORDER BY g.sort_order ASC NULLS LAST, g.id ASC`),
    pool.query(`SELECT t.id, t.visit_id, t.category, left(t.text, 300) AS text, t.image_url, t.image_layout FROM parktexts t JOIN visits v ON v.id = t.visit_id WHERE v.published = true`),
    pool.query(`SELECT id, name, slug, park_id, rating FROM rollercoasters`),
    pool.query(`SELECT id, coaster_id, title, path, description, is_header, focus_mobile, focus_desktop, featured FROM coastergallery ORDER BY sort_order ASC NULLS LAST, id ASC`),
    pool.query(`SELECT id, coaster_id, headline, left(text, 300) AS text, "order", image_url, image_layout FROM coastertext ORDER BY coaster_id, "order" ASC`),
    pool.query(`SELECT id, title, slug, image_url, published FROM rankinglists`),
    pool.query(`SELECT list_id, title, image_1, image_2 FROM listitems`),
    pool.query(`SELECT format, url, focus FROM photo_framing`),
    pool.query(`SELECT task_key, fingerprint FROM cleanup_marks`),
    pool.query(`SELECT person, count(*)::int AS total, count(*) FILTER (WHERE created_at >= date_trunc('week', now()))::int AS week FROM cleanup_log GROUP BY person`),
  ]);
  const marks = new Map<string, string>(marksR.rows.map((r) => [r.task_key, r.fingerprint]));
  const checked = (key: string, fp: string) => marks.get(key) === fp;
  const pf = new Map<string, string>(pfR.rows.map((r) => [`${r.format}|${r.url}`, r.focus]));
  const pfGet = (format: string, url: string) => pf.get(`${format}|${url}`) ?? null;

  const parks = new Map<number, { id: number; name: string; slug: string; country: string; imagepath: string | null; header_focus: string | null; header_focus_mobile: string | null; card_imagepath: string | null; image_focus: string | null }>(parksR.rows.map((p) => [p.id, p]));
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

  // ── framing slots, collected per photo ──
  const photoSlots = new Map<string, SlotDraft[]>();
  const addSlot = (url: string | null | undefined, s: SlotDraft) => {
    if (!url || isVideo(url) || SKIPPED_FORMATS.includes(s.kind)) return;
    const list = photoSlots.get(url) ?? photoSlots.set(url, []).get(url)!;
    const same = list.find((x) => x.id === s.id);
    if (!same) { list.push(s); return; }
    // The same tile in a park and a coaster gallery: preview both sets of shapes.
    for (const p of s.previews ?? []) if (!(same.previews ??= []).some((q) => q.aspect === p.aspect)) same.previews.push(p);
  };
  // Park and visit heroes draw the wide framing in the tall frame until a tall one is set (ParkHero); coaster heroes draw the centre.
  const heroSlots = (url: string, idBase: string, where: string, name: string, owner: SlotDraft["owner"], desktop: string | null, phone: string | null, target: (phoneFlag: boolean) => SlotTarget, opts: { phoneFallsBack?: boolean; rating?: number | null; page?: string } = {}) => {
    const page = opts.page ?? "Park page cover";
    const faceRating = opts.rating != null && Number(opts.rating) > 0 ? Number(opts.rating) : null;
    addSlot(url, { id: `${idBase}:phone`, kind: "hero-phone", label: `${page} · phone (tall)`, where, aspect: HERO.phone, mode: "focus", maxZoom: 4, face: "hero", faceText: name, faceRating, value: phone, ...(opts.phoneFallsBack !== false ? { fallback: desktop, fallbackFrom: "desktop cover" } : {}), target: target(true), owner });
    addSlot(url, { id: `${idBase}:desktop`, kind: "hero-desktop", label: `${page} · desktop (wide)`, where, aspect: HERO.desktop, previews: HERO_DESKTOP_PREVIEWS, mode: "focus", maxZoom: 4, face: "hero", faceText: name, faceRating, value: desktop, target: target(false), owner });
  };

  for (const p of parks.values()) {
    const visits = visitsByPark.get(p.id) ?? [];
    const latest = visits[0];
    // Park hero: shown whenever the newest visit has no header of its own.
    if (p.imagepath && !(latest && latest.header_imagepath)) {
      heroSlots(p.imagepath, `park:${p.id}:hero`, p.name, p.name, { parkId: p.id }, p.header_focus, p.header_focus_mobile, (phone) => ({ t: "park-hero", parkId: p.id, phone }), { rating: latest?.overall });
    }
    for (const v of visits) {
      if (v.header_imagepath) heroSlots(v.header_imagepath, `visit:${v.id}:hero`, `${p.name} · visit ${dateOf(v.date) ?? ""}`.trim(), p.name, { parkId: p.id, visitId: v.id }, v.header_focus, v.header_focus_mobile, (phone) => ({ t: "visit-hero", visitId: v.id, phone }), { rating: v.overall });
    }
    const cardSrc = p.card_imagepath || p.imagepath;
    if (cardSrc) addSlot(cardSrc, { id: `card:${p.id}`, kind: "card", label: "Front page card", where: p.name, aspect: CARD.aspect, previews: [{ label: "Phone", aspect: "3 / 5" }], clampAspect: CARD.clamp, mode: "focus", maxZoom: 4, face: "card", faceText: p.name, faceVisit: latest ? cardScores(latest) : null, value: p.image_focus, target: { t: "card", parkId: p.id }, owner: { parkId: p.id } });

    for (const [vi, v] of visits.entries()) {
      const photos = (galleryByVisit.get(v.id) ?? []).filter((g) => !isVideo(g.path));
      if (vi === 0) {
        const picked = photos.filter((g) => g.featured);
        push({ ...base(p.id), key: `curated-pick:${v.id}`, kind: "curated-pick", state: "open", visitId: v.id, visitDate: dateOf(v.date), image: photos[0]?.path ?? null, choices: photos.length, fingerprint: String(v.id), done: picked.length > 0 || photos.length === 0 });
      }
      for (const g of photos.filter((x) => x.featured)) {
        addSlot(g.path, { id: `curated:${g.id}`, kind: "curated", label: "Curated photo card (park page)", where: p.name, aspect: "4 / 5", mode: "focus", maxZoom: 1, face: "caption", faceText: g.description || "", value: g.focus, target: { t: "curated", rowId: g.id }, owner: { parkId: p.id, visitId: v.id } });
      }
      // Gallery tiles and captions: every photo of every published visit.
      const shared = new Map<string, number>();
      for (const g of photos) { const s = String(g.description || "").trim().toLowerCase(); if (s) shared.set(s, (shared.get(s) ?? 0) + 1); }
      for (const g of photos) {
        addSlot(g.path, { id: `tile:${g.path}`, kind: "tile", label: "Gallery tile", where: `${p.name} · All photos`, aspect: TILE, previews: PARK_TILE_PREVIEWS, mode: "position", maxZoom: 1, value: pfGet("gallery-tile", g.path), target: { t: "photo", format: "gallery-tile" }, owner: { parkId: p.id, visitId: v.id } });
        const cur = String(g.description || "").trim();
        const why = captionProblem(cur, p.name, shared.get(cur.toLowerCase()) ?? 0);
        const key = `caption:v${g.id}`;
        push({ ...base(p.id), key, kind: "caption", state: "open", visitId: v.id, visitDate: dateOf(v.date), imageId: g.id, label: g.title, image: g.path, caption: { current: cur, why: why ?? "" }, fingerprint: cur, done: !why || checked(key, cur) });
      }
    }
  }

  // Review sections: one slot when both frames share a shape, else one per frame.
  // media is the full list (videos included) so indexes match the stored string.
  const sectionSlots = (table: "parktexts" | "coastertext", rowId: number, media: { url: string; focus: string | null }[], frame: { mobile: string; desktop: string }, where: string, owner: SlotDraft["owner"]) => {
    media.forEach((m, index) => {
      if (isVideo(m.url)) return;
      const pair = splitFocusPair(m.focus);
      const id = `section:${table[0]}${rowId}:${index}`;
      if (sameAspect(frame.mobile, frame.desktop)) {
        addSlot(m.url, { id, kind: "section", label: "Review section", where, aspect: frame.desktop, mode: "position", maxZoom: 1, value: pair.desktop, target: { t: "section", table, rowId, index, part: "both" }, owner });
      } else {
        addSlot(m.url, { id: `${id}:phone`, kind: "section-phone", label: "Review section · phone", where, aspect: frame.mobile, mode: "position", maxZoom: 1, value: pair.phone, fallback: pair.desktop, fallbackFrom: "Review · desktop", target: { t: "section", table, rowId, index, part: "phone" }, owner });
        addSlot(m.url, { id: `${id}:desktop`, kind: "section-desktop", label: "Review section · desktop", where, aspect: frame.desktop, mode: "position", maxZoom: 1, value: pair.desktop, target: { t: "section", table, rowId, index, part: "desktop" }, owner });
      }
    });
  };
  for (const t of ptR.rows) {
    const parkId = visitPark.get(t.visit_id); if (parkId == null) continue;
    const v = visitById.get(t.visit_id)!;
    const heading = SECTION_LABEL[t.category] ?? t.category;
    const media = splitSectionMedia(t.image_url);
    // The introduction defaults to "below" (ParkPageClient); other sections use the legacy row.
    const frame = sectionImageFrame(t.image_layout, media.length, { defaultLayout: t.category === "description" ? "below" : null });
    sectionSlots("parktexts", t.id, media, frame, `${parks.get(parkId)!.name} · ${heading}`, { parkId, visitId: t.visit_id });
    if (!media.length && !blank(t.text)) {
      const choices = (galleryByVisit.get(t.visit_id) ?? []).filter((g) => !isVideo(g.path)).length;
      if (choices) {
        const key = `section-needs-photo:p${t.id}`;
        push({ ...base(parkId), key, kind: "section-needs-photo", state: "open", visitId: t.visit_id, visitDate: dateOf(v.date), label: heading, section: { table: "parktexts", rowId: t.id, index: 0, heading, excerpt: excerptOf(t.text) }, choices, fingerprint: "none", done: checked(key, "none") });
      }
    }
  }

  // Coasters.
  const coasterCaptionSeen = new Set(vgR.rows.map((g) => g.path));
  for (const c of coasters) {
    const park = parks.get(c.park_id)!;
    const b = { ...base(c.park_id), coasterId: c.id, coasterName: c.name, coasterSlug: c.slug };
    const owner = { parkId: c.park_id, coasterId: c.id };
    const fullGallery = galleryByCoaster.get(c.id) ?? [];
    const gallery = fullGallery.filter((g) => !isVideo(g.path));
    // The hero as the coaster page picks it: newest header row, else the first in gallery order.
    const header = [...fullGallery].filter((g) => g.is_header).sort((x, y) => y.id - x.id)[0] ?? fullGallery[0];
    if (header) heroSlots(header.path, `coaster:${c.id}:hero`, `${c.name} · ${park.name}`, c.name, owner, header.focus_desktop, header.focus_mobile, (phone) => ({ t: "coaster-hero", rowId: header.id, phone }), { phoneFallsBack: false, rating: c.rating, page: "Coaster page cover" });
    // The coaster page's photo strip: the picked photos, or all of them.
    const strip = gallery.some((g) => g.featured) ? gallery.filter((g) => g.featured) : gallery;
    for (const g of strip) addSlot(g.path, { id: `strip:${g.path}`, kind: "coaster-strip", label: "Photo strip card (coaster page)", where: `${c.name} · ${park.name}`, aspect: "4 / 5", mode: "focus", maxZoom: 1, face: "caption", faceText: g.description || "", value: pfGet("coaster-strip", g.path), target: { t: "photo", format: "coaster-strip" }, owner });
    for (const g of gallery) addSlot(g.path, { id: `tile:${g.path}`, kind: "tile", label: "Gallery tile", where: `${c.name} · Gallery`, aspect: TILE, previews: COASTER_TILE_PREVIEWS, mode: "position", maxZoom: 1, value: pfGet("gallery-tile", g.path), target: { t: "photo", format: "gallery-tile" }, owner });

    const texts = textsByCoaster.get(c.id) ?? [];
    const used = new Set<string>();
    texts.forEach((t, i) => {
      const heading = t.headline || `Section ${i + 1}`;
      const media = splitSectionMedia(t.image_url);
      media.forEach((m) => used.add(m.url));
      const frame = sectionImageFrame(t.image_layout, media.length);
      sectionSlots("coastertext", t.id, media, frame, `${c.name} · ${heading}`, owner);
      if (!media.length && !blank(t.text) && gallery.length) {
        const key = `section-needs-photo:c${t.id}`;
        push({ ...b, key, kind: "section-needs-photo", state: "open", label: heading, section: { table: "coastertext", rowId: t.id, index: 0, heading, excerpt: excerptOf(t.text) }, choices: gallery.length, fingerprint: "none", done: checked(key, "none") });
      }
    });
    // Photo breaks: gallery photos that are neither the hero nor in a section, one after each section but the last.
    const breaks = gallery.filter((g) => g.path !== header?.path && !used.has(g.path)).slice(0, Math.max(0, texts.length - 1));
    for (const g of breaks) {
      const pair = splitFocusPair(pfGet("photo-break", g.path));
      addSlot(g.path, { id: `break:${g.path}:phone`, kind: "break-phone", label: "Photo break · phone", where: `${c.name} · review`, aspect: SECTION_IMAGE_ASPECT.full.mobile, mode: "position", maxZoom: 1, value: pair.phone, fallback: pair.desktop, fallbackFrom: "Break · desktop", target: { t: "photo", format: "photo-break", part: "phone" }, owner });
      addSlot(g.path, { id: `break:${g.path}:desktop`, kind: "break-desktop", label: "Photo break · desktop", where: `${c.name} · review`, aspect: SECTION_IMAGE_ASPECT.full.desktop, mode: "position", maxZoom: 1, value: pair.desktop, target: { t: "photo", format: "photo-break", part: "desktop" }, owner });
    }

    const shared = new Map<string, number>();
    for (const g of gallery) { const s = String(g.description || "").trim().toLowerCase(); if (s) shared.set(s, (shared.get(s) ?? 0) + 1); }
    for (const g of gallery) {
      if (coasterCaptionSeen.has(g.path)) continue; // the same photo is captioned through its visit
      coasterCaptionSeen.add(g.path);
      const cur = String(g.description || "").trim();
      const why = captionProblem(cur, park.name, shared.get(cur.toLowerCase()) ?? 0);
      const key = `caption:c${g.id}`;
      push({ ...b, key, kind: "caption", state: "open", imageId: g.id, label: g.title, image: g.path, caption: { current: cur, why: why ?? "" }, fingerprint: cur, done: !why || checked(key, cur) });
    }
    const rating = Number(c.rating) || 0;
    if (rating > 0) {
      push({ ...b, key: `coaster-review:${c.id}`, kind: "coaster-review", state: "open", rating, image: header?.path ?? null, fingerprint: "", done: texts.some((t) => !blank(t.text)) });
      push({ ...b, key: `coaster-photos:${c.id}`, kind: "coaster-photos", state: "open", rating, fingerprint: "", done: gallery.length > 0 });
    }
  }

  // Lists: covers on /lists and the photos in each list.
  const listById = new Map<number, (typeof listsR.rows)[number]>(listsR.rows.map((l) => [l.id, l]));
  const listName = (l: { title: string; published: boolean }) => `List · ${l.title}${l.published ? "" : " (draft)"}`;
  for (const l of listsR.rows) if (l.image_url) addSlot(l.image_url, { id: `list-cover:${l.image_url}`, kind: "list-cover", label: "List cover", where: listName(l), aspect: LIST_COVER, mode: "position", maxZoom: 1, value: pfGet("list-cover", l.image_url), target: { t: "photo", format: "list-cover" }, owner: { parkId: null, listSlug: l.slug } });
  for (const it of itemsR.rows) {
    const l = listById.get(it.list_id); if (!l) continue;
    for (const u of [it.image_1, it.image_2]) if (u) addSlot(u, { id: `list-item:${u}`, kind: "list-item", label: "List photo", where: `${listName(l)} · ${it.title}`, aspect: LIST_ITEM, mode: "position", maxZoom: 1, value: pfGet("list-item", u), target: { t: "photo", format: "list-item" }, owner: { parkId: null, listSlug: l.slug } });
  }

  // One framing task per photo.
  for (const [url, drafts] of photoSlots) {
    const slots: FrameSlot[] = drafts.map(({ owner: _o, ...s }) => { void _o; return { ...s, fresh: !isRealFocus(s.value), done: checked(`frame:${s.id}`, url) }; });
    const first = drafts.find((d) => d.owner.coasterId) ?? drafts.find((d) => d.owner.parkId != null) ?? drafts[0];
    const parkId = first.owner.parkId;
    const p = parkId != null ? parks.get(parkId) : undefined;
    const c = first.owner.coasterId ? coasterById.get(first.owner.coasterId) : undefined;
    const open = slots.filter((s) => !s.done);
    push({
      key: `photo:${url}`, kind: "photo", state: open.some((s) => s.fresh) ? "never" : open.length ? "framed" : "open",
      parkId: parkId ?? null, parkName: p?.name ?? drafts[0].where.split(" · ").slice(0, 2).join(": "), parkSlug: p?.slug ?? null,
      ...(c ? { coasterId: c.id, coasterName: c.name, coasterSlug: c.slug } : {}),
      ...(first.owner.listSlug ? { listSlug: first.owner.listSlug } : {}),
      visitId: first.owner.visitId, label: drafts[0].where, image: url, slots, fingerprint: url, done: open.length === 0,
    });
  }

  // Sizes for the editors.
  const sizes = await getImageSizes(all.filter((t) => t.kind === "photo" && !t.done).map((t) => t.image));
  const totals: CleanupData["totals"] = {};
  const parkAgg = new Map<number, CleanupPark>();
  for (const p of parks.values()) {
    const latest = (visitsByPark.get(p.id) ?? [])[0];
    parkAgg.set(p.id, { id: p.id, name: p.name, slug: p.slug, country: p.country, overall: latest ? Number(latest.overall) : null, card: p.card_imagepath || p.imagepath, done: 0, total: 0, open: {} });
  }
  const bump = (key: string, done: boolean) => { const tt = (totals[key] ??= { done: 0, total: 0 }); tt.total++; if (done) tt.done++; };
  for (const t of all) {
    if (t.kind === "photo") {
      for (const s of t.slots ?? []) {
        bump(`slot:${s.kind}`, s.done);
        if (t.parkId != null) { const pa = parkAgg.get(t.parkId)!; pa.total++; if (s.done) pa.done++; else pa.open[`slot:${s.kind}`] = (pa.open[`slot:${s.kind}`] ?? 0) + 1; }
      }
      bump("photo", t.done);
      continue;
    }
    bump(t.kind, t.done);
    if (t.quick && t.parkId != null) { const pa = parkAgg.get(t.parkId)!; pa.total++; if (t.done) pa.done++; else pa.open[t.kind] = (pa.open[t.kind] ?? 0) + 1; }
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

/**
 * Credit a fix to a person. With a fingerprint the task is also marked as
 * checked; a mark that already holds this fingerprint means someone got the
 * credit already (both of them on the same photo at once), so nothing is logged.
 * Returns whether a credit was logged.
 */
export async function creditTask(key: string, kind: string, person: CleanupPerson, action: string, fingerprint?: string): Promise<boolean> {
  await ensureCleanupTables();
  if (fingerprint !== undefined) {
    const r = await pool.query(
      `INSERT INTO cleanup_marks (task_key, fingerprint, person, action) VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_key) DO UPDATE SET fingerprint = EXCLUDED.fingerprint, person = EXCLUDED.person, action = EXCLUDED.action, created_at = now()
       WHERE cleanup_marks.fingerprint IS DISTINCT FROM EXCLUDED.fingerprint`,
      [key, fingerprint, person, action]
    );
    if (!r.rowCount) return false;
  }
  await pool.query(`INSERT INTO cleanup_log (task_key, kind, person, action) VALUES ($1, $2, $3, $4)`, [key, kind, person, action]);
  return true;
}

/** True when someone already got the credit for this task. */
export async function wasCredited(key: string): Promise<boolean> {
  await ensureCleanupTables();
  const r = await pool.query(`SELECT 1 FROM cleanup_log WHERE task_key = $1 LIMIT 1`, [key]);
  return (r.rowCount ?? 0) > 0;
}

/** Write one slot's framing where the site reads it. ok = false when the photo moved meanwhile. */
export async function writeSlot(url: string, slot: FrameSlot, value: string): Promise<{ ok: boolean; parkId?: number }> {
  const tg = slot.target;
  switch (tg.t) {
    case "park-hero": {
      const r = await pool.query(`UPDATE parks SET ${tg.phone ? "header_focus_mobile" : "header_focus"} = $1 WHERE id = $2 AND imagepath = $3`, [value, tg.parkId, url]);
      return { ok: (r.rowCount ?? 0) > 0, parkId: tg.parkId };
    }
    case "visit-hero": {
      const col = tg.phone ? "header_focus_mobile" : "header_focus";
      const r = await pool.query(`UPDATE visits SET ${col} = $1 WHERE id = $2 AND header_imagepath = $3 RETURNING park_id`, [value, tg.visitId, url]);
      if (!r.rowCount) return { ok: false };
      const parkId = r.rows[0].park_id as number;
      // The park's header follows its newest visit; keep it in step.
      await pool.query(
        `UPDATE parks SET ${col} = $1 WHERE id = $2 AND imagepath = $3
           AND (SELECT id FROM visits WHERE park_id = $2 ORDER BY date DESC, id DESC LIMIT 1) = $4`,
        [value, parkId, url, tg.visitId]
      );
      return { ok: true, parkId };
    }
    case "coaster-hero": {
      const r = await pool.query(`UPDATE coastergallery SET ${tg.phone ? "focus_mobile" : "focus_desktop"} = $1 WHERE id = $2 AND path = $3`, [value, tg.rowId, url]);
      return { ok: (r.rowCount ?? 0) > 0 };
    }
    case "card": {
      const r = await pool.query(`UPDATE parks SET image_focus = $1 WHERE id = $2 AND coalesce(nullif(card_imagepath, ''), imagepath) = $3 RETURNING *`, [value, tg.parkId, url]);
      if (!r.rowCount) return { ok: false };
      // The front page serves a pre-made cut of the card; make the one for the new framing.
      void regenerateParkCuts(r.rows[0]).catch((err) => console.error("card cut regeneration failed for park", tg.parkId, err));
      return { ok: true, parkId: tg.parkId };
    }
    case "curated": {
      const r = await pool.query(`UPDATE visitgallery SET focus = $1 WHERE id = $2 AND path = $3`, [value, tg.rowId, url]);
      return { ok: (r.rowCount ?? 0) > 0 };
    }
    case "section": {
      const cur = await pool.query(`SELECT image_url FROM ${tg.table} WHERE id = $1`, [tg.rowId]);
      if (!cur.rowCount) return { ok: false };
      const media = splitSectionMedia(cur.rows[0].image_url);
      const m = media[tg.index];
      if (!m || m.url !== url) return { ok: false };
      const pair = splitFocusPair(m.focus);
      const desktop = tg.part === "phone" ? pair.desktop || "0.5000 0.5000 1" : value;
      const phone = tg.part === "desktop" ? pair.phone : tg.part === "phone" ? value : null;
      media[tg.index] = { url, focus: joinFocusPair(desktop, phone) };
      const r = await pool.query(`UPDATE ${tg.table} SET image_url = $1 WHERE id = $2 AND image_url IS NOT DISTINCT FROM $3`, [joinSectionMedia(media), tg.rowId, cur.rows[0].image_url]);
      return { ok: (r.rowCount ?? 0) > 0 };
    }
    case "photo": {
      let v = value;
      if (tg.format === "photo-break") {
        const old = await pool.query(`SELECT focus FROM photo_framing WHERE format = 'photo-break' AND url = $1`, [url]);
        const pair = splitFocusPair(old.rows[0]?.focus);
        v = tg.part === "phone" ? joinFocusPair(pair.desktop || "0.5000 0.5000 1", value) : joinFocusPair(value, pair.phone);
      }
      await pool.query(
        `INSERT INTO photo_framing (format, url, focus) VALUES ($1, $2, $3)
         ON CONFLICT (format, url) DO UPDATE SET focus = EXCLUDED.focus, updated_at = now()`,
        [tg.format, url, v]
      );
      return { ok: true };
    }
  }
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
