// The clean-up tool: every editorial gap on the site as a task, worked through
// by Jannik and Nicklas. Tasks are computed from the content tables on every
// request; the tool only stores what a person did (cleanup_marks: "this one
// was checked by eye", cleanup_log: who gets the credit).
//
// Framing is one task per place a photo fills on the site: a park's front
// page card, a park or coaster page cover, a curated image, a photo break, a
// list photo. Each place has one or two framings (slots), usually phone and
// desktop. A slot counts as done once someone checked it in the tool (saved
// or "Looks right"); its fingerprint is the photo, so a new photo in that
// place opens it again. The tool shows each slot on the real page (views):
// it loads the page and moves the photo in its real frame (framingPreview.ts).

import { pool } from "@/app/lib/db";
import { getImageSizes, type ImageSize } from "@/app/lib/imageDims";
import { ensureVisitHeaderColumns } from "@/app/lib/visitHeader";
import { regenerateParkCuts } from "@/app/lib/cardCut";
import { splitFocusPair, joinFocusPair } from "@/app/lib/framing";
import { groupOf } from "@/app/lib/cleanupGroup";

export const CLEANUP_PEOPLE = ["Jannik", "Nicklas"] as const;
export type CleanupPerson = typeof CLEANUP_PEOPLE[number];

export type CleanupKind = "frame" | "caption" | "curated-pick" | "section-needs-photo" | "coaster-review" | "coaster-photos";
/**
 * Never handed out at random: a review to write or a visit to make, and review
 * sections without a photo, which are fixed in the page's own section editor.
 */
export const MANUAL_KINDS: CleanupKind[] = ["coaster-review", "coaster-photos", "section-needs-photo"];

export type PlaceKind = "card" | "park-cover" | "coaster-cover" | "curated" | "coaster-curated" | "break" | "list-photo";
export type SlotKind = "card" | "cover-phone" | "cover-desktop" | "curated-phone" | "curated-desktop" | "break-phone" | "break-desktop" | "list-item" | "list-cover";

/** Where a slot's framing is stored; the server writes it, never the page. */
export type SlotTarget =
  | { t: "park-hero"; parkId: number; phone: boolean }
  | { t: "visit-hero"; visitId: number; phone: boolean }
  | { t: "coaster-hero"; rowId: number; phone: boolean }
  | { t: "card"; parkId: number }
  | { t: "curated"; rowId: number }
  | { t: "photo"; format: "curated-desktop" | "list-item" | "list-cover" | "photo-break"; part?: "desktop" | "phone" };

/** One screen on which a slot is shown: a real page, and the frame on it (data-framing). */
export interface SlotView { screen: "phone" | "desktop"; page: string; target: string }

export interface FrameSlot {
  id: string;
  kind: SlotKind;
  /** "Phone", "Desktop", "Phone and desktop", … */
  label: string;
  value: string | null;
  /** What the site draws while value is empty (a phone framing falls back to another one), and which one. */
  fallback?: string | null;
  fallbackFrom?: string;
  /** Never framed (or an old/default value that shows the centre). */
  fresh: boolean;
  done: boolean;
  target: SlotTarget;
  /** Zoom allowed by the page's placement (1 = drag only). */
  maxZoom: number;
  /** Keep the photo covering a frame this wide (width / height) when framing on a narrower screen. */
  clampAspect?: number;
  /** The real pages to frame it on; none = a plain frame of this shape (no text on the photo). */
  views: SlotView[];
  aspect?: string;
}

/** How "Change photo" works for a place (the site's own endpoints do the change). */
export type ChangeSpec =
  | { t: "park-header"; parkId: number; visitId: number | null }
  | { t: "card"; parkId: number; headerPath: string | null }
  | { t: "coaster-header"; coasterId: number }
  | { t: "curated"; visitId: number; rowId: number }
  | { t: "coaster-curated"; coasterId: number; rowId: number; picked: boolean };

export interface FramePlace {
  kind: PlaceKind;
  /** Park or coaster name (list name for list photos). */
  title: string;
  /** "Visit of 12 Jul 2025", the park of a coaster, a caption, … */
  subtitle?: string;
  slots: FrameSlot[];
  change: ChangeSpec | null;
  /** Shown beside the framing: where else this framing is used. */
  note?: string;
}

export interface CleanupTask {
  key: string;
  kind: CleanupKind;
  quick: boolean;
  parkId: number | null; parkName: string; parkSlug: string | null;
  coasterId?: number; coasterName?: string; coasterSlug?: string;
  visitId?: number; visitDate?: string | null;
  /** List photos: the list they are in. */
  listSlug?: string;
  label?: string;
  image?: string | null;
  size?: ImageSize;
  /** The page where this is fixed or seen. */
  pageUrl: string;
  place?: FramePlace;
  imageId?: number;
  section?: { table: "parktexts" | "coastertext"; rowId: number; heading: string; excerpt: string };
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
  /** Per place kind as "place:<kind>", and per other task kind. */
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

const SECTION_LABEL: Record<string, string> = {
  description: "Introduction", bestCoaster: "Best coaster", coasterDepth: "Coaster depth", waterRides: "Water rides",
  flatridesAndDarkrides: "Flat rides & dark rides", parkAppearance: "Appearance", parkPracticality: "Practicality",
  food: "Food", snacksAndDrinks: "Snacks & drinks", rideOperations: "Ride operations", parkManagement: "Management",
};
const excerptOf = (t: unknown) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length > 160 ? s.slice(0, 157).trimEnd() + "…" : s; };
const dateOf = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);
const dateLabel = (d: unknown) => (d ? new Date(d as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** Why a caption needs work, or null when it is fine. Shared = the same caption on 3+ photos of one visit or coaster. */
function captionProblem(desc: string | null | undefined, parkName: string, sharedCount: number): string | null {
  const s = String(desc || "").trim();
  if (!s) return "No caption";
  if (/^untitled|^img[_ -]?\d|^dsc\d|^pxl_|^\d+$/i.test(s) || s.length < 3) return "Looks like a file name";
  if (s.toLowerCase() === parkName.toLowerCase()) return "Just the park's name";
  if (sharedCount >= 3) return `Same caption on ${sharedCount} photos`;
  return null;
}

/** Widest front page card: grid cards stop at 400 px, 500 px tall (HomeClient). */
const CARD_CLAMP = 400 / 500;

// ─── compute ─────────────────────────────────────────────────────────────────

type SlotDraft = Omit<FrameSlot, "fresh" | "done">;
type PlaceDraft = Omit<CleanupTask, "quick" | "place" | "fingerprint" | "size"> & { place: Omit<FramePlace, "slots"> & { slots: SlotDraft[] } };

export async function loadCleanup(): Promise<CleanupData> {
  await ensureCleanupTables();
  const [parksR, visitsR, vgR, ptR, rcR, cgR, ctR, listsR, itemsR, pfR, marksR, scoresR] = await Promise.all([
    pool.query(`SELECT id, name, slug, country, imagepath, header_focus, header_focus_mobile, card_imagepath, image_focus FROM parks ORDER BY name`),
    pool.query(`SELECT id, park_id, date, overall, header_imagepath, header_focus, header_focus_mobile FROM visits WHERE published = true ORDER BY date DESC NULLS LAST, id DESC`),
    pool.query(`SELECT g.id, g.visit_id, g.title, g.path, g.description, g.featured, g.focus FROM visitgallery g JOIN visits v ON v.id = g.visit_id WHERE v.published = true ORDER BY g.sort_order ASC NULLS LAST, g.id ASC`),
    pool.query(`SELECT t.id, t.visit_id, t.category, left(t.text, 300) AS text, t.image_url FROM parktexts t JOIN visits v ON v.id = t.visit_id WHERE v.published = true`),
    pool.query(`SELECT id, name, slug, park_id, rating FROM rollercoasters`),
    pool.query(`SELECT id, coaster_id, title, path, description, is_header, focus_mobile, focus_desktop, featured FROM coastergallery ORDER BY sort_order ASC NULLS LAST, id ASC`),
    pool.query(`SELECT id, coaster_id, headline, left(text, 300) AS text, "order", image_url FROM coastertext ORDER BY coaster_id, "order" ASC`),
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
  // A photo's phone-deck framing (newest visit first): the desktop strip falls back to it.
  const deckFocusByPath = new Map<string, string>();
  for (const v of visitsR.rows) for (const g of galleryByVisit.get(v.id) ?? []) if (g.focus && !deckFocusByPath.has(g.path)) deckFocusByPath.set(g.path, g.focus);
  const coasters = rcR.rows.filter((c) => parks.has(c.park_id));
  const coasterById = new Map<number, (typeof rcR.rows)[number]>(coasters.map((c) => [c.id, c]));
  const galleryByCoaster = new Map<number, typeof cgR.rows>();
  for (const g of cgR.rows) if (coasterById.has(g.coaster_id)) (galleryByCoaster.get(g.coaster_id) ?? galleryByCoaster.set(g.coaster_id, []).get(g.coaster_id)!).push(g);
  const textsByCoaster = new Map<number, typeof ctR.rows>();
  for (const t of ctR.rows) if (coasterById.has(t.coaster_id)) (textsByCoaster.get(t.coaster_id) ?? textsByCoaster.set(t.coaster_id, []).get(t.coaster_id)!).push(t);

  const all: (CleanupTask & { done: boolean })[] = [];
  const push = (t: Omit<CleanupTask, "quick"> & { done: boolean }) => all.push({ ...t, quick: !MANUAL_KINDS.includes(t.kind) });
  const base = (parkId: number) => { const p = parks.get(parkId)!; return { parkId, parkName: p.name, parkSlug: p.slug }; };
  const parkPage = (parkId: number, visitId?: number) => `/park/${parks.get(parkId)!.slug}${visitId ? `?visit=${visitId}` : ""}`;

  // Places are collected first and turned into tasks at the end (marks, sizes).
  const places: PlaceDraft[] = [];
  const addPlace = (p: PlaceDraft) => { if (p.image && !isVideo(p.image) && p.place.slots.length) places.push(p); };
  const coverSlots = (idBase: string, page: string, target: string, desktop: string | null, phone: string | null, store: (phone: boolean) => SlotTarget, phoneFallsBack: boolean): SlotDraft[] => [
    {
      id: `${idBase}:phone`, kind: "cover-phone", label: "Phone", value: phone,
      // Park covers draw the desktop framing in the tall frame until a phone one is set (ParkHero); coaster covers draw the centre.
      ...(phoneFallsBack ? { fallback: desktop, fallbackFrom: "desktop" } : {}),
      target: store(true), maxZoom: 4, views: [{ screen: "phone", page, target }],
    },
    { id: `${idBase}:desktop`, kind: "cover-desktop", label: "Desktop", value: desktop, target: store(false), maxZoom: 4, views: [{ screen: "desktop", page, target }] },
  ];

  for (const p of parks.values()) {
    const visits = visitsByPark.get(p.id) ?? [];
    const latest = visits[0];

    // Front page card: parks with a published visit are on the front page.
    const cardSrc = p.card_imagepath || p.imagepath;
    if (latest && cardSrc) {
      addPlace({
        ...base(p.id), key: `card:${p.id}`, kind: "frame", image: cardSrc, pageUrl: "/",
        place: {
          kind: "card", title: p.name, change: { t: "card", parkId: p.id, headerPath: p.imagepath },
          slots: [{
            id: `card:${p.id}`, kind: "card", label: "Phone and desktop", value: p.image_focus, target: { t: "card", parkId: p.id },
            maxZoom: 4, clampAspect: CARD_CLAMP,
            views: [{ screen: "phone", page: "/", target: `card:${p.id}` }, { screen: "desktop", page: "/", target: `card:${p.id}` }],
          }],
        },
      });
    }

    // Park page cover: the park's own, shown whenever the newest visit has no header of its own.
    if (p.imagepath && !(latest && latest.header_imagepath)) {
      addPlace({
        ...base(p.id), key: `cover:park:${p.id}`, kind: "frame", image: p.imagepath, pageUrl: parkPage(p.id),
        place: {
          kind: "park-cover", title: p.name, change: { t: "park-header", parkId: p.id, visitId: latest?.id ?? null },
          slots: coverSlots(`park:${p.id}:hero`, parkPage(p.id), "park-cover", p.header_focus, p.header_focus_mobile, (phone) => ({ t: "park-hero", parkId: p.id, phone }), true),
        },
      });
    }
    // Visits with a header of their own (the newest one's is the park's cover).
    for (const v of visits) {
      if (!v.header_imagepath) continue;
      addPlace({
        ...base(p.id), key: `cover:visit:${v.id}`, kind: "frame", image: v.header_imagepath, visitId: v.id, visitDate: dateOf(v.date), pageUrl: parkPage(p.id, v.id),
        place: {
          kind: "park-cover", title: p.name, subtitle: v === latest ? undefined : `Visit of ${dateLabel(v.date)}`,
          change: { t: "park-header", parkId: p.id, visitId: v.id },
          slots: coverSlots(`visit:${v.id}:hero`, parkPage(p.id, v.id), "park-cover", v.header_focus, v.header_focus_mobile, (phone) => ({ t: "visit-hero", visitId: v.id, phone }), true),
        },
      });
    }

    for (const [vi, v] of visits.entries()) {
      const photos = (galleryByVisit.get(v.id) ?? []).filter((g) => !isVideo(g.path));
      if (vi === 0) {
        const picked = photos.filter((g) => g.featured);
        push({ ...base(p.id), key: `curated-pick:${v.id}`, kind: "curated-pick", visitId: v.id, visitDate: dateOf(v.date), image: photos[0]?.path ?? null, choices: photos.length, pageUrl: parkPage(p.id, v.id), fingerprint: String(v.id), done: picked.length > 0 || photos.length === 0 });
        // Curated images: the phone deck and the desktop strip, each with its own framing.
        picked.forEach((g, i) => {
          addPlace({
            ...base(p.id), key: `curated:${g.id}`, kind: "frame", image: g.path, visitId: v.id, imageId: g.id, pageUrl: parkPage(p.id, v.id),
            place: {
              kind: "curated", title: p.name, subtitle: `Curated image ${i + 1} of ${picked.length}`,
              change: { t: "curated", visitId: v.id, rowId: g.id },
              slots: [
                {
                  id: `curated:${g.id}`, kind: "curated-phone", label: "Phone", value: g.focus, target: { t: "curated", rowId: g.id }, maxZoom: 1,
                  views: [{ screen: "phone", page: `${parkPage(p.id, v.id)}&framing-deck=${g.id}`, target: `deck:${g.id}` }],
                },
                {
                  id: `strip:${g.path}`, kind: "curated-desktop", label: "Desktop", value: pfGet("curated-desktop", g.path), fallback: g.focus, fallbackFrom: "phone",
                  target: { t: "photo", format: "curated-desktop" }, maxZoom: 1,
                  views: [{ screen: "desktop", page: parkPage(p.id, v.id), target: `strip:${g.path}` }],
                },
              ],
            },
          });
        });
      }
      // Captions: every photo of every published visit.
      const shared = new Map<string, number>();
      for (const g of photos) { const s = String(g.description || "").trim().toLowerCase(); if (s) shared.set(s, (shared.get(s) ?? 0) + 1); }
      for (const g of photos) {
        const cur = String(g.description || "").trim();
        const why = captionProblem(cur, p.name, shared.get(cur.toLowerCase()) ?? 0);
        const key = `caption:v${g.id}`;
        push({ ...base(p.id), key, kind: "caption", visitId: v.id, visitDate: dateOf(v.date), imageId: g.id, label: g.title, image: g.path, pageUrl: parkPage(p.id, v.id), caption: { current: cur, why: why ?? "" }, fingerprint: cur, done: !why || checked(key, cur) });
      }
    }
  }

  // Review sections without a photo: listed with a link to the page, fixed in the page's own editor.
  for (const t of ptR.rows) {
    const parkId = visitPark.get(t.visit_id); if (parkId == null) continue;
    const v = visitById.get(t.visit_id)!;
    if (splitSectionMedia(t.image_url).length || blank(t.text)) continue;
    if (!(galleryByVisit.get(t.visit_id) ?? []).some((g) => !isVideo(g.path))) continue;
    const heading = SECTION_LABEL[t.category] ?? t.category;
    const key = `section-needs-photo:p${t.id}`;
    const anchor = t.category === "description" ? "section-description" : `section-${t.category}`;
    push({ ...base(parkId), key, kind: "section-needs-photo", visitId: t.visit_id, visitDate: dateOf(v.date), label: heading, pageUrl: `${parkPage(parkId, t.visit_id)}#${anchor}`, section: { table: "parktexts", rowId: t.id, heading, excerpt: excerptOf(t.text) }, fingerprint: "none", done: checked(key, "none") });
  }

  // Coasters.
  const stripTaken = new Set(places.filter((p) => p.place.kind === "curated").map((p) => p.image as string));
  const coasterCaptionSeen = new Set(vgR.rows.map((g) => g.path));
  for (const c of coasters) {
    const park = parks.get(c.park_id)!;
    const coasterPage = `/coasters/${c.slug}`;
    const b = { ...base(c.park_id), coasterId: c.id, coasterName: c.name, coasterSlug: c.slug };
    const fullGallery = galleryByCoaster.get(c.id) ?? [];
    const gallery = fullGallery.filter((g) => !isVideo(g.path));
    // The cover as the coaster page picks it: newest header row, else the first in gallery order.
    const header = [...fullGallery].filter((g) => g.is_header).sort((x, y) => y.id - x.id)[0] ?? fullGallery[0];
    if (header) {
      addPlace({
        ...b, key: `cover:coaster:${c.id}`, kind: "frame", image: header.path, imageId: header.id, pageUrl: coasterPage,
        place: {
          kind: "coaster-cover", title: c.name, subtitle: park.name, change: { t: "coaster-header", coasterId: c.id },
          note: "Rankle uses these framings too: its cards the phone one, its bonus question the desktop one.",
          slots: coverSlots(`coaster:${c.id}:hero`, coasterPage, "coaster-cover", header.focus_desktop, header.focus_mobile, (phone) => ({ t: "coaster-hero", rowId: header.id, phone }), false),
        },
      });
    }
    // Curated images on the coaster page: the photo strip (picked photos, or all of them;
    // hidden with fewer than two). Its framing is the curated image's desktop one, shared
    // with the park page, so a photo curated there is framed there.
    const hasPicks = fullGallery.some((g) => g.featured);
    const shownInStrip = hasPicks ? fullGallery.filter((g) => g.featured) : fullGallery;
    if (shownInStrip.length >= 2) {
      for (const g of shownInStrip) {
        if (isVideo(g.path) || stripTaken.has(g.path)) continue;
        stripTaken.add(g.path);
        const deck = deckFocusByPath.get(g.path) ?? null;
        addPlace({
          ...b, key: `coaster-curated:${c.id}:${g.id}`, kind: "frame", image: g.path, imageId: g.id, pageUrl: coasterPage,
          place: {
            kind: "coaster-curated", title: c.name, subtitle: park.name, change: { t: "coaster-curated", coasterId: c.id, rowId: g.id, picked: hasPicks },
            note: hasPicks ? undefined : "No curated images are picked for this coaster, so its page shows all its photos.",
            slots: [{
              id: `strip:${g.path}`, kind: "curated-desktop", label: "Phone and desktop", value: pfGet("curated-desktop", g.path),
              ...(deck ? { fallback: deck, fallbackFrom: "park page phone" } : {}),
              target: { t: "photo", format: "curated-desktop" }, maxZoom: 1,
              views: [{ screen: "phone", page: coasterPage, target: `strip:${g.path}` }, { screen: "desktop", page: coasterPage, target: `strip:${g.path}` }],
            }],
          },
        });
      }
    }

    const texts = textsByCoaster.get(c.id) ?? [];
    const used = new Set<string>();
    texts.forEach((t, i) => {
      const heading = t.headline || `Section ${i + 1}`;
      const media = splitSectionMedia(t.image_url);
      media.forEach((m) => used.add(m.url));
      if (!media.length && !blank(t.text) && gallery.length) {
        const key = `section-needs-photo:c${t.id}`;
        push({ ...b, key, kind: "section-needs-photo", label: heading, pageUrl: `${coasterPage}#section-${t.id}`, section: { table: "coastertext", rowId: t.id, heading, excerpt: excerptOf(t.text) }, fingerprint: "none", done: checked(key, "none") });
      }
    });
    // Photo breaks: gallery photos that are neither the cover nor in a section, one after each section but the last (CoasterText).
    const breaks = gallery.filter((g) => g.path !== header?.path && !used.has(g.path)).slice(0, Math.max(0, texts.length - 1));
    for (const g of breaks) {
      const pair = splitFocusPair(pfGet("photo-break", g.path));
      addPlace({
        ...b, key: `break:${c.id}:${g.id}`, kind: "frame", image: g.path, imageId: g.id, pageUrl: coasterPage,
        place: {
          kind: "break", title: c.name, subtitle: park.name, change: null,
          note: "Photo breaks are picked by the page: gallery photos not used as the cover or in a section.",
          slots: [
            { id: `break:${g.path}:phone`, kind: "break-phone", label: "Phone", value: pair.phone, fallback: pair.desktop, fallbackFrom: "desktop", target: { t: "photo", format: "photo-break", part: "phone" }, maxZoom: 1, views: [{ screen: "phone", page: coasterPage, target: `break:${g.path}` }] },
            { id: `break:${g.path}:desktop`, kind: "break-desktop", label: "Desktop", value: pair.desktop, target: { t: "photo", format: "photo-break", part: "desktop" }, maxZoom: 1, views: [{ screen: "desktop", page: coasterPage, target: `break:${g.path}` }] },
          ],
        },
      });
    }

    const shared = new Map<string, number>();
    for (const g of gallery) { const s = String(g.description || "").trim().toLowerCase(); if (s) shared.set(s, (shared.get(s) ?? 0) + 1); }
    for (const g of gallery) {
      if (coasterCaptionSeen.has(g.path)) continue; // the same photo is captioned through its visit
      coasterCaptionSeen.add(g.path);
      const cur = String(g.description || "").trim();
      const why = captionProblem(cur, park.name, shared.get(cur.toLowerCase()) ?? 0);
      const key = `caption:c${g.id}`;
      push({ ...b, key, kind: "caption", imageId: g.id, label: g.title, image: g.path, pageUrl: coasterPage, caption: { current: cur, why: why ?? "" }, fingerprint: cur, done: !why || checked(key, cur) });
    }
    const rating = Number(c.rating) || 0;
    if (rating > 0) {
      push({ ...b, key: `coaster-review:${c.id}`, kind: "coaster-review", rating, image: header?.path ?? null, pageUrl: coasterPage, fingerprint: "", done: texts.some((t) => !blank(t.text)) });
      push({ ...b, key: `coaster-photos:${c.id}`, kind: "coaster-photos", rating, pageUrl: coasterPage, fingerprint: "", done: gallery.length > 0 });
    }
  }

  // Lists: the photos in each list and the covers on /lists (no text on these photos).
  const listById = new Map<number, (typeof listsR.rows)[number]>(listsR.rows.map((l) => [l.id, l]));
  const listTitle = (l: { title: string; published: boolean }) => `${l.title}${l.published ? "" : " (draft)"}`;
  for (const l of listsR.rows) {
    if (!l.image_url) continue;
    addPlace({
      key: `list-cover:${l.id}`, kind: "frame", parkId: null, parkName: "Lists", parkSlug: null, listSlug: l.slug, image: l.image_url, pageUrl: "/lists",
      place: { kind: "list-photo", title: listTitle(l), subtitle: "List cover", change: null, slots: [{ id: `list-cover:${l.image_url}`, kind: "list-cover", label: "List cover", value: pfGet("list-cover", l.image_url), target: { t: "photo", format: "list-cover" }, maxZoom: 1, views: [], aspect: "11 / 6" }] },
    });
  }
  const listItemSeen = new Set<string>();
  for (const it of itemsR.rows) {
    const l = listById.get(it.list_id); if (!l) continue;
    for (const u of [it.image_1, it.image_2]) {
      if (!u || listItemSeen.has(u)) continue;
      listItemSeen.add(u);
      addPlace({
        key: `list-item:${u}`, kind: "frame", parkId: null, parkName: "Lists", parkSlug: null, listSlug: l.slug, image: u, pageUrl: `/lists/${l.slug}`,
        place: { kind: "list-photo", title: listTitle(l), subtitle: it.title, change: null, slots: [{ id: `list-item:${u}`, kind: "list-item", label: "List photo", value: pfGet("list-item", u), target: { t: "photo", format: "list-item" }, maxZoom: 1, views: [], aspect: "4 / 3" }] },
      });
    }
  }

  // Places become tasks: each slot is done when checked for this photo.
  for (const d of places) {
    const url = d.image as string;
    const slots: FrameSlot[] = d.place.slots.map((s) => ({ ...s, fresh: !isRealFocus(s.value), done: checked(`frame:${s.id}`, url) }));
    push({ ...d, place: { ...d.place, slots }, fingerprint: url, done: slots.every((s) => s.done) });
  }

  // Sizes for the framing previews.
  const sizes = await getImageSizes(all.filter((t) => t.kind === "frame" && !t.done).map((t) => t.image));
  const totals: CleanupData["totals"] = {};
  const parkAgg = new Map<number, CleanupPark>();
  for (const p of parks.values()) {
    const latest = (visitsByPark.get(p.id) ?? [])[0];
    parkAgg.set(p.id, { id: p.id, name: p.name, slug: p.slug, country: p.country, overall: latest ? Number(latest.overall) : null, card: p.card_imagepath || p.imagepath, done: 0, total: 0, open: {} });
  }
  for (const t of all) {
    const g = groupOf(t);
    const tt = (totals[g] ??= { done: 0, total: 0 });
    tt.total++; if (t.done) tt.done++;
    if (t.quick && t.parkId != null) {
      const pa = parkAgg.get(t.parkId)!;
      pa.total++;
      if (t.done) pa.done++; else pa.open[g] = (pa.open[g] ?? 0) + 1;
    }
  }
  const tasks: CleanupTask[] = all.filter((t) => !t.done).map((t) => {
    const { done, ...rest } = t; void done;
    return rest.image && sizes[rest.image] ? { ...rest, size: sizes[rest.image] } : rest;
  });
  const scores = Object.fromEntries(CLEANUP_PEOPLE.map((n) => [n, { total: 0, week: 0 }])) as CleanupData["scores"];
  for (const r of scoresR.rows) if ((CLEANUP_PEOPLE as readonly string[]).includes(r.person)) scores[r.person as CleanupPerson] = { total: r.total, week: r.week };
  return { tasks, totals, parks: [...parkAgg.values()].filter((p) => p.total > 0), scores };
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

/** Set a caption on every gallery row that shows this photo with the old caption (a photo can sit in a visit and a coaster gallery). */
export async function setCaption(path: string, oldCaption: string, text: string): Promise<number> {
  const a = await pool.query(`UPDATE visitgallery SET description = $1 WHERE path = $2 AND coalesce(btrim(description), '') = $3`, [text, path, oldCaption]);
  const b = await pool.query(`UPDATE coastergallery SET description = $1 WHERE path = $2 AND coalesce(btrim(description), '') = $3`, [text, path, oldCaption]);
  return (a.rowCount ?? 0) + (b.rowCount ?? 0);
}
