// The clean-up tool: every editorial gap on the site as a task, worked through
// by Jannik and Nicklas. Tasks are computed from the content tables on every
// request; the tool only stores what a person did (cleanup_marks: "this one
// was checked by eye", cleanup_log: who gets the credit).
//
// Framing is one task per place a photo fills on the site: a park's front
// page card, a park or coaster page cover, a curated image, a photo in a
// review, a list photo.
// Each place has one or two framings (slots), usually phone and desktop, and
// each slot frames one photo (a cover can have its own photo for phones). A
// slot counts as done once someone checked it in the tool (saved or "Looks
// right"); its fingerprint is its photo, so a new photo there opens it again.
// The tool shows each slot on the real page (views): it loads the page and
// moves the photo in its real frame (framingPreview.ts).
//
// Everything missing counts one point: a framing slot, a caption, a pick, a
// review. The overview's figures are those points.

import { pool } from "@/app/lib/db";
import { getImageSizes, type ImageSize } from "@/app/lib/imageDims";
import { ensureVisitHeaderColumns } from "@/app/lib/visitHeader";
import { ensureParkTextsUnique } from "@/app/lib/parkTextsIndex";
import { regenerateParkCuts } from "@/app/lib/cardCut";
import { groupOf } from "@/app/lib/cleanupGroup";
import { joinFocusPair, splitFocusPair } from "@/app/lib/framing";
import { overview as tiebreakOverview } from "@/app/lib/tiebreakStore";

export const CLEANUP_PEOPLE = ["Jannik", "Nicklas"] as const;
export type CleanupPerson = typeof CLEANUP_PEOPLE[number];

export type CleanupKind =
  | "frame" | "caption" | "curated-pick" | "coaster-pick"
  | "review-photos" | "coaster-review-photos" | "park-review" | "coaster-review" | "coaster-photos";
/** Fixed on the page itself (a review to write, photos to place, a visit to make): listed with a link, never handed out by the runner. */
export const PAGE_KINDS: CleanupKind[] = ["review-photos", "coaster-review-photos", "park-review", "coaster-review", "coaster-photos"];
/** Can be checked off as fine as it is. */
export const CHECKABLE_KINDS: CleanupKind[] = ["caption", "review-photos", "coaster-review-photos", "park-review"];

export type PlaceKind = "card" | "park-cover" | "coaster-cover" | "curated" | "coaster-curated" | "review-photo" | "list-photo";
export type SlotKind = "card" | "cover-phone" | "cover-desktop" | "curated-phone" | "curated-desktop" | "section-phone" | "section-desktop" | "list-item" | "list-cover";

/** Where a slot's framing is stored; the server writes it, never the page. */
export type SlotTarget =
  | { t: "park-hero"; parkId: number; phone: boolean }
  | { t: "visit-hero"; visitId: number; phone: boolean }
  /** own: the cover's own phone photo (a row flagged is_header_mobile). */
  | { t: "coaster-hero"; rowId: number; phone: boolean; own?: boolean }
  | { t: "card"; parkId: number }
  | { t: "curated"; rowId: number }
  /** A photo in a review section: entry `index` of the row's media, its desktop or phone framing ("url|desktop|phone"). */
  | { t: "section"; table: "parktexts" | "coastertext"; rowId: number; index: number; part: "desktop" | "phone" }
  | { t: "photo"; format: "curated-desktop" | "list-item" | "list-cover" };

/** One screen on which a slot is shown: a real page, and the frame on it (data-framing). */
export interface SlotView { screen: "phone" | "desktop"; page: string; target: string; /** "Park page", "Coaster page", … when a slot shows on more than one page. */ where?: string }

export interface FrameSlot {
  id: string;
  kind: SlotKind;
  /** "Phone", "Desktop", "Phone and desktop", … */
  label: string;
  /** The photo this slot frames: the place's, or the cover's own phone photo. */
  photo: string;
  /** Its pixel size, when recorded. */
  size?: ImageSize;
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
  /**
   * The narrowest frame of this place (width / height). Up and down the photo is
   * kept covering it too: a tall photo is drawn shorter in a narrower frame, so a
   * framing made on a wide screen could leave a strip there (the front page card).
   */
  minAspect?: number;
  /** The real pages to frame it on; none = a plain frame of this shape (no text on the photo). */
  views: SlotView[];
  aspect?: string;
}

/** How "Change photo" works for a place (the site's own endpoints do the change). */
export type ChangeSpec =
  /** phonePhoto: the cover's own phone photo, if it has one. */
  | { t: "park-header"; parkId: number; visitId: number | null; phonePhoto: string | null }
  | { t: "card"; parkId: number; headerPath: string | null }
  | { t: "coaster-header"; coasterId: number; phonePhoto: string | null }
  | { t: "curated"; visitId: number; rowId: number }
  | { t: "coaster-curated"; coasterId: number; rowId: number };

export interface FramePlace {
  kind: PlaceKind;
  /** Park or coaster name (list name for list photos). */
  title: string;
  /** "Visit of 12 Jul 2025", the park of a coaster, a caption, … */
  subtitle?: string;
  /** Where in a review the photo sits ("Category" · "Water rides"), shown big while framing it. */
  category?: { label: string; value: string };
  slots: FrameSlot[];
  change: ChangeSpec | null;
  /** Shown beside the framing: where else this framing is used. */
  note?: string;
}

export interface CleanupTask {
  key: string;
  kind: CleanupKind;
  /** Worked through in the tool (framing, captions, picks); the rest are fixed on the page. */
  quick: boolean;
  parkId: number | null; parkName: string; parkSlug: string | null;
  coasterId?: number; coasterName?: string; coasterSlug?: string;
  visitId?: number; visitDate?: string | null;
  /** The visit is not published yet (a review to write for it). */
  draft?: boolean;
  /** List photos: the list they are in. */
  listSlug?: string;
  label?: string;
  image?: string | null;
  size?: ImageSize;
  /** The page where this is fixed or seen. */
  pageUrl: string;
  place?: FramePlace;
  imageId?: number;
  caption?: { current: string; why: string };
  /** Reviews short on photos: sections with text, and how many of them have a photo. */
  sections?: { total: number; withPhoto: number };
  choices?: number;
  rating?: number;
  /** Points: one per framing slot, one for anything else. */
  points: number;
  fingerprint: string;
}

/** A task finished in the tool: who and when (the newest of its marks and credits). */
export interface DoneTask extends CleanupTask { doneAt: string; doneBy: string }

/** A use of a photo that is not framed in the tool (review sections, gallery tiles): shown as the page draws it. */
export interface PhotoUse { label: string; where: string; page: string; target: string }

export interface CleanupTotals { done: number; total: number }
export interface CleanupPark {
  id: number; name: string; slug: string; country: string; overall: number | null; card: string | null;
  /** The front page card's framing of that photo. */
  cardFocus: string | null;
  /** Points. */
  done: number; total: number; open: Partial<Record<string, number>>;
}
export interface CleanupData {
  tasks: CleanupTask[];
  done: DoneTask[];
  /** Points per group (see groupOf). */
  totals: Partial<Record<string, CleanupTotals>>;
  parks: CleanupPark[];
  scores: Record<CleanupPerson, { total: number; week: number }>;
  /** Uses of the framed photos that are not framed in the tool, by photo. */
  uses: Record<string, PhotoUse[]>;
  /** Tied score groups whose order is not settled on the site yet (the tiebreak tool). */
  tiebreaks: { score: number; count: number; placed: number; ready: boolean; thumbs: string[] }[];
}


// ─── tables ──────────────────────────────────────────────────────────────────

let ready: Promise<void> | null = null;
export function ensureCleanupTables(): Promise<void> {
  if (!ready) {
    ready = Promise.all([
      ensureVisitHeaderColumns(),
      ensureParkTextsUnique(),
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
        CREATE INDEX IF NOT EXISTS cleanup_log_key_idx ON cleanup_log (task_key);
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
const dateOf = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);
const dateLabel = (d: unknown) => (d ? new Date(d as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
/** A phone photo of its own: set and not the desktop photo. */
const ownPhone = (phone: string | null | undefined, desktop: string | null | undefined) => (phone && phone !== desktop ? phone : null);

/** Why a caption needs work, or null when it is fine. Shared = the same caption on 3+ photos of one visit or coaster. */
function captionProblem(desc: string | null | undefined, parkName: string, sharedCount: number): string | null {
  const s = String(desc || "").trim();
  if (!s) return "No caption";
  if (/^untitled|^img[_ -]?\d|^dsc\d|^pxl_|^\d+$/i.test(s) || s.length < 3) return "Looks like a file name";
  if (s.toLowerCase() === parkName.toLowerCase()) return "Just the park's name";
  if (sharedCount >= 3) return `Same caption on ${sharedCount} photos`;
  return null;
}

/** Narrowest front page card: 250 CSS px wide, 500 tall (HomeClient). */
const CARD_MIN_ASPECT = 250 / 500;

// ─── compute ─────────────────────────────────────────────────────────────────

type SlotDraft = Omit<FrameSlot, "fresh" | "done">;
type PlaceDraft = Omit<CleanupTask, "quick" | "place" | "fingerprint" | "size" | "points"> & { place: Omit<FramePlace, "slots"> & { slots: SlotDraft[] } };
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function loadCleanup(): Promise<CleanupData> {
  await ensureCleanupTables();
  const [parksR, visitsR, vgR, ptR, rcR, cgR, ctR, listsR, itemsR, pfR, marksR, logR, scoresR] = await Promise.all([
    pool.query(`SELECT id, name, slug, country, imagepath, imagepath_mobile, header_focus, header_focus_mobile, card_imagepath, image_focus FROM parks ORDER BY name`),
    pool.query(`SELECT id, park_id, date, overall, published, header_imagepath, header_imagepath_mobile, header_focus, header_focus_mobile FROM visits ORDER BY date DESC NULLS LAST, id DESC`),
    pool.query(`SELECT g.id, g.visit_id, g.title, g.path, g.description, g.featured, g.focus FROM visitgallery g JOIN visits v ON v.id = g.visit_id WHERE v.published = true ORDER BY g.sort_order ASC NULLS LAST, g.id ASC`),
    pool.query(`SELECT id, visit_id, category, coalesce(btrim(text), '') <> '' AS has_text, image_url FROM parktexts`),
    pool.query(`SELECT id, name, slug, park_id, rating FROM rollercoasters`),
    pool.query(`SELECT id, coaster_id, title, path, description, is_header, is_header_mobile, focus_mobile, focus_desktop, featured FROM coastergallery ORDER BY sort_order ASC NULLS LAST, id ASC`),
    pool.query(`SELECT id, coaster_id, headline, coalesce(btrim(text), '') <> '' AS has_text, "order", image_url FROM coastertext ORDER BY coaster_id, "order" ASC`),
    pool.query(`SELECT id, title, slug, image_url, published FROM rankinglists`),
    pool.query(`SELECT list_id, title, image_1, image_2 FROM listitems`),
    pool.query(`SELECT format, url, focus FROM photo_framing`),
    pool.query(`SELECT task_key, fingerprint, person, created_at FROM cleanup_marks`),
    pool.query(`SELECT DISTINCT ON (task_key) task_key, person, created_at FROM cleanup_log ORDER BY task_key, created_at DESC`),
    pool.query(`SELECT person, count(*)::int AS total, count(*) FILTER (WHERE created_at >= date_trunc('week', now()))::int AS week FROM cleanup_log GROUP BY person`),
  ]);
  const marks = new Map<string, { fingerprint: string; person: string; at: Date }>(marksR.rows.map((r) => [r.task_key, { fingerprint: r.fingerprint, person: r.person, at: r.created_at }]));
  const credits = new Map<string, { person: string; at: Date }>(logR.rows.map((r) => [r.task_key, { person: r.person, at: r.created_at }]));
  const checked = (key: string, fp: string) => marks.get(key)?.fingerprint === fp;
  const pf = new Map<string, string>(pfR.rows.map((r) => [`${r.format}|${r.url}`, r.focus]));
  const pfGet = (format: string, url: string) => pf.get(`${format}|${url}`) ?? null;

  const parks = new Map<number, Row>(parksR.rows.map((p) => [p.id, p]));
  const publishedByPark = new Map<number, Row[]>();
  const allVisitsByPark = new Map<number, Row[]>();
  for (const v of visitsR.rows) {
    if (!parks.has(v.park_id)) continue;
    (allVisitsByPark.get(v.park_id) ?? allVisitsByPark.set(v.park_id, []).get(v.park_id)!).push(v);
    if (v.published) (publishedByPark.get(v.park_id) ?? publishedByPark.set(v.park_id, []).get(v.park_id)!).push(v);
  }
  const galleryByVisit = new Map<number, Row[]>();
  for (const g of vgR.rows) (galleryByVisit.get(g.visit_id) ?? galleryByVisit.set(g.visit_id, []).get(g.visit_id)!).push(g);
  const textsByVisit = new Map<number, Row[]>();
  for (const t of ptR.rows) (textsByVisit.get(t.visit_id) ?? textsByVisit.set(t.visit_id, []).get(t.visit_id)!).push(t);
  // A photo's phone-deck framing (newest visit first): the desktop strip falls back to it.
  const deckFocusByPath = new Map<string, string>();
  for (const v of visitsR.rows) for (const g of galleryByVisit.get(v.id) ?? []) if (g.focus && !deckFocusByPath.has(g.path)) deckFocusByPath.set(g.path, g.focus);
  const coasters = rcR.rows.filter((c) => parks.has(c.park_id));
  const coasterById = new Map<number, Row>(coasters.map((c) => [c.id, c]));
  const galleryByCoaster = new Map<number, Row[]>();
  for (const g of cgR.rows) if (coasterById.has(g.coaster_id)) (galleryByCoaster.get(g.coaster_id) ?? galleryByCoaster.set(g.coaster_id, []).get(g.coaster_id)!).push(g);
  const textsByCoaster = new Map<number, Row[]>();
  for (const t of ctR.rows) if (coasterById.has(t.coaster_id)) (textsByCoaster.get(t.coaster_id) ?? textsByCoaster.set(t.coaster_id, []).get(t.coaster_id)!).push(t);

  const all: (CleanupTask & { done: boolean })[] = [];
  const push = (t: Omit<CleanupTask, "quick" | "points"> & { done: boolean; points?: number }) =>
    all.push({ ...t, points: t.points ?? 1, quick: !PAGE_KINDS.includes(t.kind) });
  const base = (parkId: number) => { const p = parks.get(parkId)!; return { parkId, parkName: p.name, parkSlug: p.slug }; };
  const parkPage = (parkId: number, visitId?: number) => `/park/${parks.get(parkId)!.slug}${visitId ? `?visit=${visitId}` : ""}`;

  // Places are collected first and turned into tasks at the end (marks, sizes).
  const places: PlaceDraft[] = [];
  const addPlace = (p: PlaceDraft) => { if (p.image && !isVideo(p.image) && p.place.slots.length) places.push(p); };
  /** A cover's two framings. The phone one frames the cover's own phone photo when it has one. */
  const coverSlots = (o: { idBase: string; page: string; target: string; desktopPhoto: string; phonePhoto: string | null; desktop: string | null; phone: string | null; store: (phone: boolean) => SlotTarget; phoneFallsBack: boolean }): SlotDraft[] => [
    {
      id: `${o.idBase}:phone`, kind: "cover-phone", label: "Phone", photo: o.phonePhoto ?? o.desktopPhoto, value: o.phone,
      // Park covers draw the desktop framing in the tall frame until a phone one is set (ParkHero);
      // coaster covers and phone photos of their own draw the centre.
      ...(o.phoneFallsBack && !o.phonePhoto ? { fallback: o.desktop, fallbackFrom: "desktop" } : {}),
      target: o.store(true), maxZoom: 4, views: [{ screen: "phone", page: o.page, target: o.target }],
    },
    { id: `${o.idBase}:desktop`, kind: "cover-desktop", label: "Desktop", photo: o.desktopPhoto, value: o.desktop, target: o.store(false), maxZoom: 4, views: [{ screen: "desktop", page: o.page, target: o.target }] },
  ];

  for (const p of parks.values()) {
    const visits = publishedByPark.get(p.id) ?? [];
    const latest = visits[0];

    // Front page card: parks with a published visit are on the front page.
    const cardSrc = p.card_imagepath || p.imagepath;
    if (latest && cardSrc) {
      addPlace({
        ...base(p.id), key: `card:${p.id}`, kind: "frame", image: cardSrc, pageUrl: "/",
        place: {
          kind: "card", title: p.name, change: { t: "card", parkId: p.id, headerPath: p.imagepath },
          slots: [{
            id: `card:${p.id}`, kind: "card", label: "Phone and desktop", photo: cardSrc, value: p.image_focus, target: { t: "card", parkId: p.id },
            maxZoom: 4, minAspect: CARD_MIN_ASPECT,
            views: [{ screen: "phone", page: "/", target: `card:${p.id}` }, { screen: "desktop", page: "/", target: `card:${p.id}` }],
          }],
        },
      });
    }

    // Park page cover: the park's own, shown whenever the newest visit has no header of its own.
    if (p.imagepath && !(latest && latest.header_imagepath)) {
      const phonePhoto = ownPhone(p.imagepath_mobile, p.imagepath);
      addPlace({
        ...base(p.id), key: `cover:park:${p.id}`, kind: "frame", image: p.imagepath, pageUrl: parkPage(p.id),
        place: {
          kind: "park-cover", title: p.name, change: { t: "park-header", parkId: p.id, visitId: latest?.id ?? null, phonePhoto },
          slots: coverSlots({ idBase: `park:${p.id}:hero`, page: parkPage(p.id), target: "park-cover", desktopPhoto: p.imagepath, phonePhoto, desktop: p.header_focus, phone: p.header_focus_mobile, store: (phone) => ({ t: "park-hero", parkId: p.id, phone }), phoneFallsBack: true }),
        },
      });
    }
    // Visits with a header of their own (the newest one's is the park's cover).
    for (const v of visits) {
      if (!v.header_imagepath) continue;
      const phonePhoto = ownPhone(v.header_imagepath_mobile, v.header_imagepath);
      addPlace({
        ...base(p.id), key: `cover:visit:${v.id}`, kind: "frame", image: v.header_imagepath, visitId: v.id, visitDate: dateOf(v.date), pageUrl: parkPage(p.id, v.id),
        place: {
          kind: "park-cover", title: p.name, subtitle: v === latest ? undefined : `Visit of ${dateLabel(v.date)}`,
          change: { t: "park-header", parkId: p.id, visitId: v.id, phonePhoto },
          slots: coverSlots({ idBase: `visit:${v.id}:hero`, page: parkPage(p.id, v.id), target: "park-cover", desktopPhoto: v.header_imagepath, phonePhoto, desktop: v.header_focus, phone: v.header_focus_mobile, store: (phone) => ({ t: "visit-hero", visitId: v.id, phone }), phoneFallsBack: true }),
        },
      });
    }

    for (const [vi, v] of visits.entries()) {
      const photos = (galleryByVisit.get(v.id) ?? []).filter((g) => !isVideo(g.path));
      if (vi === 0) {
        const picked = photos.filter((g) => g.featured);
        if (photos.length) {
          push({ ...base(p.id), key: `curated-pick:${v.id}`, kind: "curated-pick", visitId: v.id, visitDate: dateOf(v.date), image: photos[0].path, choices: photos.length, pageUrl: parkPage(p.id, v.id), fingerprint: String(v.id), done: picked.length > 0 });
        }
        // Curated images: the phone deck and the desktop strip, each with its own framing.
        picked.forEach((g, i) => {
          addPlace({
            ...base(p.id), key: `curated:${g.id}`, kind: "frame", image: g.path, visitId: v.id, imageId: g.id, pageUrl: parkPage(p.id, v.id),
            place: {
              kind: "curated", title: p.name, subtitle: `Curated image ${i + 1} of ${picked.length}`,
              change: { t: "curated", visitId: v.id, rowId: g.id },
              slots: [
                {
                  id: `curated:${g.id}`, kind: "curated-phone", label: "Phone", photo: g.path, value: g.focus, target: { t: "curated", rowId: g.id }, maxZoom: 1,
                  views: [{ screen: "phone", page: `${parkPage(p.id, v.id)}&framing-deck=${g.id}`, target: `deck:${g.id}` }],
                },
                {
                  id: `strip:${g.path}`, kind: "curated-desktop", label: "Desktop", photo: g.path, value: pfGet("curated-desktop", g.path), fallback: g.focus, fallbackFrom: "phone",
                  target: { t: "photo", format: "curated-desktop" }, maxZoom: 1,
                  views: [{ screen: "desktop", page: parkPage(p.id, v.id), target: `strip:${g.path}`, where: "Park page" }],
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

    // The park's review (newest published visit): flagged when fewer than half of its written sections have a photo.
    if (latest) {
      const written = (textsByVisit.get(latest.id) ?? []).filter((t) => t.has_text);
      const withPhoto = written.filter((t) => splitSectionMedia(t.image_url).length > 0).length;
      const hasPhotos = (galleryByVisit.get(latest.id) ?? []).some((g) => !isVideo(g.path));
      if (written.length >= 2 && hasPhotos) {
        const key = `review-photos:v${latest.id}`;
        push({ ...base(p.id), key, kind: "review-photos", visitId: latest.id, visitDate: dateOf(latest.date), image: latest.header_imagepath || p.imagepath || null, pageUrl: parkPage(p.id, latest.id), sections: { total: written.length, withPhoto }, fingerprint: "ok", done: withPhoto * 2 >= written.length || checked(key, "ok") });
      }
    }
    // Reviews to write: visits not published yet (their sections may hold only checklist
    // notes), and published visits without any review text.
    for (const v of allVisitsByPark.get(p.id) ?? []) {
      const key = `park-review:${v.id}`;
      const hasText = (textsByVisit.get(v.id) ?? []).some((t) => t.has_text);
      push({ ...base(p.id), key, kind: "park-review", visitId: v.id, visitDate: dateOf(v.date), draft: !v.published, rating: Number(v.overall) || undefined, image: v.header_imagepath || p.imagepath || null, pageUrl: parkPage(p.id, v.id), fingerprint: "ok", done: (v.published && hasText) || checked(key, "ok") });
    }
  }

  // Photos in reviews: each photo in a section, framed for the phone and the desktop
  // frame of its section (a phone framing falls back to the desktop one).
  const sectionSlots = (o: { idBase: string; photo: string; focus: string | null; page: string; table: "parktexts" | "coastertext"; rowId: number; index: number }): SlotDraft[] => {
    const pair = splitFocusPair(o.focus);
    const target = `section:${o.photo}`;
    return [
      { id: `${o.idBase}:phone`, kind: "section-phone", label: "Phone", photo: o.photo, value: pair.phone, fallback: pair.desktop, fallbackFrom: "desktop", target: { t: "section", table: o.table, rowId: o.rowId, index: o.index, part: "phone" }, maxZoom: 4, views: [{ screen: "phone", page: o.page, target }] },
      { id: `${o.idBase}:desktop`, kind: "section-desktop", label: "Desktop", photo: o.photo, value: pair.desktop, target: { t: "section", table: o.table, rowId: o.rowId, index: o.index, part: "desktop" }, maxZoom: 4, views: [{ screen: "desktop", page: o.page, target }] },
    ];
  };
  for (const [parkId, visits] of publishedByPark) {
    const p = parks.get(parkId)!;
    visits.forEach((v, vi) => {
      for (const t of textsByVisit.get(v.id) ?? []) {
        const anchor = t.category === "description" ? "section-description" : `section-${t.category}`;
        const page = `${parkPage(parkId, v.id)}#${anchor}`;
        splitSectionMedia(t.image_url).forEach((m, i) => {
          if (isVideo(m.url)) return;
          addPlace({
            ...base(parkId), key: `review-photo:p${t.id}:${i}`, kind: "frame", image: m.url, visitId: v.id, visitDate: dateOf(v.date), pageUrl: page,
            place: {
              kind: "review-photo", title: p.name, subtitle: `${SECTION_LABEL[t.category] ?? t.category}${vi === 0 ? "" : ` · visit of ${dateLabel(v.date)}`}`, change: null,
              category: { label: "Category", value: `${SECTION_LABEL[t.category] ?? t.category}${vi === 0 ? "" : ` · visit of ${dateLabel(v.date)}`}` },
              note: "Change the photo itself in the review editor.",
              slots: sectionSlots({ idBase: `section:p${t.id}:${i}`, photo: m.url, focus: m.focus, page, table: "parktexts", rowId: t.id, index: i }),
            },
          });
        });
      }
    });
  }

  // Coasters.
  const stripPlace = new Map<string, PlaceDraft>(places.filter((p) => p.place.kind === "curated").map((p) => [p.image as string, p]));
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
      // Its own phone photo: the newest flagged row that is not the cover (coaster gallery route).
      const phoneRow = [...fullGallery].filter((g) => g.is_header_mobile && g.path !== header.path).sort((x, y) => y.id - x.id)[0] ?? null;
      const phonePhoto = phoneRow && !isVideo(phoneRow.path) ? phoneRow.path : null;
      const phoneSource = phonePhoto ? phoneRow! : header;
      addPlace({
        ...b, key: `cover:coaster:${c.id}`, kind: "frame", image: header.path, imageId: header.id, pageUrl: coasterPage,
        place: {
          kind: "coaster-cover", title: c.name, subtitle: park.name, change: { t: "coaster-header", coasterId: c.id, phonePhoto },
          note: "Rankle uses these framings too: its cards the phone one, its bonus question the desktop one.",
          slots: coverSlots({
            idBase: `coaster:${c.id}:hero`, page: coasterPage, target: "coaster-cover", desktopPhoto: header.path, phonePhoto,
            desktop: header.focus_desktop, phone: phoneSource.focus_mobile,
            store: (phone) => (phone ? { t: "coaster-hero", rowId: phoneSource.id, phone: true, own: !!phonePhoto } : { t: "coaster-hero", rowId: header.id, phone: false }),
            phoneFallsBack: false,
          }),
        },
      });
    }
    // The photo strip on the coaster page: the picked photos (all of them while none
    // are picked, hidden with fewer than two). Coasters without picks get a pick task;
    // picked photos are framed. The strip framing is the curated image's desktop one,
    // shared with the park page: a photo curated there gets this page as another view.
    const picks = gallery.filter((g) => g.featured);
    if (gallery.length >= 2) {
      push({ ...b, key: `coaster-pick:${c.id}`, kind: "coaster-pick", image: header && !isVideo(header.path) ? header.path : gallery[0].path, choices: gallery.length, pageUrl: coasterPage, fingerprint: String(c.id), done: picks.length > 0 });
    }
    if (picks.length >= 2) {
      for (const g of picks) {
        const views: SlotView[] = [{ screen: "phone", page: coasterPage, target: `strip:${g.path}`, where: "Coaster page" }, { screen: "desktop", page: coasterPage, target: `strip:${g.path}`, where: "Coaster page" }];
        const shared = stripPlace.get(g.path);
        if (shared) {
          shared.place.slots.find((s) => s.id === `strip:${g.path}`)?.views.push(...views);
          continue;
        }
        const deck = deckFocusByPath.get(g.path) ?? null;
        const draft: PlaceDraft = {
          ...b, key: `coaster-curated:${c.id}:${g.id}`, kind: "frame", image: g.path, imageId: g.id, pageUrl: coasterPage,
          place: {
            kind: "coaster-curated", title: c.name, subtitle: park.name, change: { t: "coaster-curated", coasterId: c.id, rowId: g.id },
            slots: [{
              id: `strip:${g.path}`, kind: "curated-desktop", label: "Phone and desktop", photo: g.path, value: pfGet("curated-desktop", g.path),
              ...(deck ? { fallback: deck, fallbackFrom: "park page phone" } : {}),
              target: { t: "photo", format: "curated-desktop" }, maxZoom: 1, views,
            }],
          },
        };
        addPlace(draft);
        stripPlace.set(g.path, draft);
      }
    }

    // The coaster's review: flagged when fewer than half of its written sections have a photo.
    const texts = textsByCoaster.get(c.id) ?? [];
    const written = texts.filter((t) => t.has_text);
    const withPhoto = written.filter((t) => splitSectionMedia(t.image_url).length > 0).length;
    if (written.length >= 2 && gallery.length) {
      const key = `review-photos:c${c.id}`;
      push({ ...b, key, kind: "coaster-review-photos", image: header && !isVideo(header.path) ? header.path : null, pageUrl: coasterPage, sections: { total: written.length, withPhoto }, fingerprint: "ok", done: withPhoto * 2 >= written.length || checked(key, "ok") });
    }

    for (const t of texts) {
      const page = `${coasterPage}#section-${t.id}`;
      splitSectionMedia(t.image_url).forEach((m, i) => {
        if (isVideo(m.url)) return;
        addPlace({
          ...b, key: `review-photo:c${t.id}:${i}`, kind: "frame", image: m.url, pageUrl: page,
          place: {
            kind: "review-photo", title: c.name, subtitle: `${t.headline || "Section"} · ${park.name}`, change: null,
            category: { label: "Section", value: `${t.headline || "Untitled"} · ${park.name}` },
            note: "Change the photo itself in the review editor.",
            slots: sectionSlots({ idBase: `section:c${t.id}:${i}`, photo: m.url, focus: m.focus, page, table: "coastertext", rowId: t.id, index: i }),
          },
        });
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
      push({ ...b, key: `coaster-review:${c.id}`, kind: "coaster-review", rating, image: header && !isVideo(header.path) ? header.path : park.card_imagepath || park.imagepath || null, pageUrl: coasterPage, fingerprint: "", done: written.length > 0 });
      // No photo of its own: the park's stands in for it in the lists.
      push({ ...b, key: `coaster-photos:${c.id}`, kind: "coaster-photos", rating, image: park.card_imagepath || park.imagepath || null, pageUrl: coasterPage, fingerprint: "", done: gallery.length > 0 });
    }
  }

  // Lists: the photos in published lists and their covers on /lists (no text on these photos).
  const listById = new Map<number, Row>(listsR.rows.map((l) => [l.id, l]));
  for (const l of listsR.rows) {
    if (!l.published || !l.image_url) continue;
    addPlace({
      key: `list-cover:${l.id}`, kind: "frame", parkId: null, parkName: "Lists", parkSlug: null, listSlug: l.slug, image: l.image_url, pageUrl: "/lists",
      place: { kind: "list-photo", title: l.title, subtitle: "List cover", change: null, slots: [{ id: `list-cover:${l.image_url}`, kind: "list-cover", label: "List cover", photo: l.image_url, value: pfGet("list-cover", l.image_url), target: { t: "photo", format: "list-cover" }, maxZoom: 1, views: [], aspect: "11 / 6" }] },
    });
  }
  const listItemSeen = new Set<string>();
  for (const it of itemsR.rows) {
    const l = listById.get(it.list_id); if (!l || !l.published) continue;
    for (const u of [it.image_1, it.image_2]) {
      if (!u || listItemSeen.has(u)) continue;
      listItemSeen.add(u);
      addPlace({
        key: `list-item:${u}`, kind: "frame", parkId: null, parkName: "Lists", parkSlug: null, listSlug: l.slug, image: u, pageUrl: `/lists/${l.slug}`,
        place: { kind: "list-photo", title: l.title, subtitle: it.title, change: null, slots: [{ id: `list-item:${u}`, kind: "list-item", label: "List photo", photo: u, value: pfGet("list-item", u), target: { t: "photo", format: "list-item" }, maxZoom: 1, views: [], aspect: "4 / 3" }] },
      });
    }
  }

  // Sizes for previews and thumbnails.
  const sizes = await getImageSizes([...new Set([...all.map((t) => t.image), ...places.flatMap((p) => p.place.slots.map((s) => s.photo))])]);
  const withSize = <T extends CleanupTask>(t: T): T => (t.image && sizes[t.image] ? { ...t, size: sizes[t.image] } : t);

  // Places become tasks: each slot is done when checked for its photo; one point per slot.
  for (const d of places) {
    const slots: FrameSlot[] = d.place.slots.filter((s) => !isVideo(s.photo)).map((s) => ({ ...s, ...(sizes[s.photo] ? { size: sizes[s.photo] } : {}), fresh: !isRealFocus(s.value), done: checked(`frame:${s.id}`, s.photo) }));
    push({ ...d, place: { ...d.place, slots }, fingerprint: d.image as string, points: slots.length, done: slots.every((s) => s.done) });
  }

  // Uses of the framed photos that the tool shows as the page draws them. None at the moment:
  // review photos are framed here, and gallery tiles follow the photo's framing (the galleries).
  const uses: Record<string, PhotoUse[]> = {};

  // Who finished what in the tool, and when: the newest of a task's marks and credits.
  const doneInfo = (t: CleanupTask): { at: Date; by: string } | null => {
    const keys = t.place ? t.place.slots.map((s) => `frame:${s.id}`) : [t.key];
    let best: { at: Date; by: string } | null = null;
    for (const k of keys) {
      for (const e of [marks.get(k), credits.get(k)]) {
        if (e && (!best || e.at > best.at)) best = { at: e.at, by: e.person };
      }
    }
    return best;
  };

  const totals: CleanupData["totals"] = {};
  const parkAgg = new Map<number, CleanupPark>();
  for (const p of parks.values()) {
    const latest = (publishedByPark.get(p.id) ?? [])[0];
    parkAgg.set(p.id, { id: p.id, name: p.name, slug: p.slug, country: p.country, overall: latest ? Number(latest.overall) : null, card: p.card_imagepath || p.imagepath, cardFocus: p.image_focus ?? null, done: 0, total: 0, open: {} });
  }
  const tasks: CleanupTask[] = [];
  const done: DoneTask[] = [];
  for (const t of all) {
    const g = groupOf(t);
    const pts = t.place ? t.place.slots.length : t.points;
    const ptsDone = t.place ? t.place.slots.filter((s) => s.done).length : t.done ? t.points : 0;
    const tt = (totals[g] ??= { done: 0, total: 0 });
    tt.total += pts; tt.done += ptsDone;
    if (t.parkId != null) {
      const pa = parkAgg.get(t.parkId)!;
      pa.total += pts; pa.done += ptsDone;
      if (pts > ptsDone) pa.open[g] = (pa.open[g] ?? 0) + pts - ptsDone;
    }
    const { done: isDone, ...rest } = t;
    if (!isDone) { tasks.push(withSize(rest)); continue; }
    const info = doneInfo(rest);
    if (info) done.push({ ...withSize(rest), doneAt: info.at.toISOString(), doneBy: info.by });
  }
  done.sort((a, b) => b.doneAt.localeCompare(a.doneAt));

  const scores = Object.fromEntries(CLEANUP_PEOPLE.map((n) => [n, { total: 0, week: 0 }])) as CleanupData["scores"];
  for (const r of scoresR.rows) if ((CLEANUP_PEOPLE as readonly string[]).includes(r.person)) scores[r.person as CleanupPerson] = { total: r.total, week: r.week };
  // Tiebreaks not settled: not every coaster listed, or the list not on the site yet ("ready").
  const groups = await tiebreakOverview().catch((err) => { console.error("tiebreak overview failed", err); return []; });
  const tiebreaks = (groups as { score: number; count: number; placed: number; on_site: boolean; thumbs: string[] }[])
    .filter((g) => g.score > 0 && !(g.placed === g.count && g.on_site)) // 0 = not scored, no tie to settle
    .map((g) => ({ score: g.score, count: g.count, placed: g.placed, ready: g.placed === g.count, thumbs: g.thumbs }));
  return { tasks, done, totals, parks: [...parkAgg.values()].filter((p) => p.total > 0), scores, uses, tiebreaks };
}

// ─── actions ─────────────────────────────────────────────────────────────────

/** What a write changed, so it can be undone for a few seconds after. */
export type UndoOp =
  | { t: "slot"; photo: string; target: SlotTarget; old: string | null }
  | { t: "mark"; key: string; prev: { fingerprint: string; person: string; action: string; created_at: Date } | null }
  | { t: "log"; id: number }
  | { t: "caption"; path: string; from: string; to: string };

/**
 * Credit a fix to a person. With a fingerprint the task is also marked as
 * checked; a mark that already holds this fingerprint means someone got the
 * credit already (both of them on the same photo at once), so nothing is logged.
 * Returns what changed (for undo); credited = a credit was logged.
 */
export async function creditTask(key: string, kind: string, person: CleanupPerson, action: string, fingerprint?: string): Promise<{ credited: boolean; ops: UndoOp[] }> {
  await ensureCleanupTables();
  const ops: UndoOp[] = [];
  if (fingerprint !== undefined) {
    const prev = await pool.query(`SELECT fingerprint, person, action, created_at FROM cleanup_marks WHERE task_key = $1`, [key]);
    const r = await pool.query(
      `INSERT INTO cleanup_marks (task_key, fingerprint, person, action) VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_key) DO UPDATE SET fingerprint = EXCLUDED.fingerprint, person = EXCLUDED.person, action = EXCLUDED.action, created_at = now()
       WHERE cleanup_marks.fingerprint IS DISTINCT FROM EXCLUDED.fingerprint`,
      [key, fingerprint, person, action]
    );
    if (!r.rowCount) return { credited: false, ops };
    ops.push({ t: "mark", key, prev: prev.rows[0] ?? null });
  }
  const log = await pool.query(`INSERT INTO cleanup_log (task_key, kind, person, action) VALUES ($1, $2, $3, $4) RETURNING id`, [key, kind, person, action]);
  ops.push({ t: "log", id: log.rows[0].id });
  return { credited: true, ops };
}

/** True when someone already got the credit for this task. */
export async function wasCredited(key: string): Promise<boolean> {
  await ensureCleanupTables();
  const r = await pool.query(`SELECT 1 FROM cleanup_log WHERE task_key = $1 LIMIT 1`, [key]);
  return (r.rowCount ?? 0) > 0;
}

/** Put a task back on the list: its marks and credits go (the credit is earned again when it is done again). */
export async function reopenTask(keys: string[]): Promise<void> {
  await ensureCleanupTables();
  await pool.query(`DELETE FROM cleanup_marks WHERE task_key = ANY($1::text[])`, [keys]);
  await pool.query(`DELETE FROM cleanup_log WHERE task_key = ANY($1::text[])`, [keys]);
}

/** Undo a write a moment after it was made: values, marks and credits go back to how they were. */
export async function undoOps(ops: UndoOp[]): Promise<number | null> {
  let parkId: number | null = null;
  for (const op of [...ops].reverse()) {
    if (op.t === "slot") {
      const r = await writeSlot(op.photo, op.target, op.old);
      if (r.parkId) parkId = r.parkId;
    } else if (op.t === "mark") {
      if (op.prev) {
        await pool.query(
          `INSERT INTO cleanup_marks (task_key, fingerprint, person, action, created_at) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (task_key) DO UPDATE SET fingerprint = EXCLUDED.fingerprint, person = EXCLUDED.person, action = EXCLUDED.action, created_at = EXCLUDED.created_at`,
          [op.key, op.prev.fingerprint, op.prev.person, op.prev.action, op.prev.created_at]
        );
      } else {
        await pool.query(`DELETE FROM cleanup_marks WHERE task_key = $1`, [op.key]);
      }
    } else if (op.t === "log") {
      await pool.query(`DELETE FROM cleanup_log WHERE id = $1`, [op.id]);
    } else if (op.t === "caption") {
      await setCaption(op.path, op.to, op.from);
    }
  }
  return parkId;
}

/** The value a slot's target holds now for this photo (undefined when the photo is no longer there). */
export async function readSlot(photo: string, tg: SlotTarget): Promise<string | null | undefined> {
  const one = async (sql: string, params: unknown[]) => { const r = await pool.query(sql, params); return r.rowCount ? (r.rows[0].v as string | null) : undefined; };
  switch (tg.t) {
    case "park-hero":
      return tg.phone
        ? one(`SELECT header_focus_mobile AS v FROM parks WHERE id = $1 AND coalesce(nullif(imagepath_mobile, ''), imagepath) = $2`, [tg.parkId, photo])
        : one(`SELECT header_focus AS v FROM parks WHERE id = $1 AND imagepath = $2`, [tg.parkId, photo]);
    case "visit-hero":
      return tg.phone
        ? one(`SELECT header_focus_mobile AS v FROM visits WHERE id = $1 AND coalesce(nullif(header_imagepath_mobile, ''), header_imagepath) = $2`, [tg.visitId, photo])
        : one(`SELECT header_focus AS v FROM visits WHERE id = $1 AND header_imagepath = $2`, [tg.visitId, photo]);
    case "coaster-hero":
      return one(`SELECT ${tg.phone ? "focus_mobile" : "focus_desktop"} AS v FROM coastergallery WHERE id = $1 AND path = $2`, [tg.rowId, photo]);
    case "card":
      return one(`SELECT image_focus AS v FROM parks WHERE id = $1 AND coalesce(nullif(card_imagepath, ''), imagepath) = $2`, [tg.parkId, photo]);
    case "curated":
      return one(`SELECT focus AS v FROM visitgallery WHERE id = $1 AND path = $2`, [tg.rowId, photo]);
    case "section": {
      const r = await pool.query(`SELECT image_url FROM ${tg.table} WHERE id = $1`, [tg.rowId]);
      const entry = splitSectionMedia(r.rows[0]?.image_url)[tg.index];
      if (!entry || entry.url !== photo) return undefined;
      return splitFocusPair(entry.focus)[tg.part];
    }
    case "photo": {
      const r = await pool.query(`SELECT focus AS v FROM photo_framing WHERE format = $1 AND url = $2`, [tg.format, photo]);
      return r.rowCount ? r.rows[0].v : null;
    }
  }
}

/**
 * Write one slot's framing where the site reads it (null clears it, for undo).
 * ok = false when the photo moved meanwhile: a phone slot checks the photo
 * phones show (the cover's own phone photo, or else the cover).
 */
export async function writeSlot(photo: string, tg: SlotTarget, value: string | null): Promise<{ ok: boolean; parkId?: number }> {
  switch (tg.t) {
    case "park-hero": {
      const r = tg.phone
        ? await pool.query(`UPDATE parks SET header_focus_mobile = $1 WHERE id = $2 AND coalesce(nullif(imagepath_mobile, ''), imagepath) = $3`, [value, tg.parkId, photo])
        : await pool.query(`UPDATE parks SET header_focus = $1 WHERE id = $2 AND imagepath = $3`, [value, tg.parkId, photo]);
      return { ok: (r.rowCount ?? 0) > 0, parkId: tg.parkId };
    }
    case "visit-hero": {
      const col = tg.phone ? "header_focus_mobile" : "header_focus";
      const r = tg.phone
        ? await pool.query(`UPDATE visits SET header_focus_mobile = $1 WHERE id = $2 AND coalesce(nullif(header_imagepath_mobile, ''), header_imagepath) = $3 RETURNING park_id`, [value, tg.visitId, photo])
        : await pool.query(`UPDATE visits SET header_focus = $1 WHERE id = $2 AND header_imagepath = $3 RETURNING park_id`, [value, tg.visitId, photo]);
      if (!r.rowCount) return { ok: false };
      const parkId = r.rows[0].park_id as number;
      // The park's header follows its newest visit; keep it in step.
      await pool.query(
        `UPDATE parks SET ${col} = $1 WHERE id = $2 AND ${tg.phone ? "coalesce(nullif(imagepath_mobile, ''), imagepath)" : "imagepath"} = $3
           AND (SELECT id FROM visits WHERE park_id = $2 ORDER BY date DESC, id DESC LIMIT 1) = $4`,
        [value, parkId, photo, tg.visitId]
      );
      return { ok: true, parkId };
    }
    case "coaster-hero": {
      const r = await pool.query(
        `UPDATE coastergallery SET ${tg.phone ? "focus_mobile" : "focus_desktop"} = $1 WHERE id = $2 AND path = $3${tg.own ? " AND is_header_mobile" : ""}`,
        [value, tg.rowId, photo]
      );
      return { ok: (r.rowCount ?? 0) > 0 };
    }
    case "card": {
      const r = await pool.query(`UPDATE parks SET image_focus = $1 WHERE id = $2 AND coalesce(nullif(card_imagepath, ''), imagepath) = $3 RETURNING *`, [value, tg.parkId, photo]);
      if (!r.rowCount) return { ok: false };
      // The front page serves a pre-made cut of the card; make the one for the new framing.
      void regenerateParkCuts(r.rows[0]).catch((err) => console.error("card cut regeneration failed for park", tg.parkId, err));
      return { ok: true, parkId: tg.parkId };
    }
    case "curated": {
      const r = await pool.query(`UPDATE visitgallery SET focus = $1 WHERE id = $2 AND path = $3`, [value, tg.rowId, photo]);
      return { ok: (r.rowCount ?? 0) > 0 };
    }
    case "section": {
      // The row keeps every photo of the section as "url|desktop|phone"; only this entry's part changes,
      // and only while the row is still as read (an editor saving meanwhile wins).
      const r = await pool.query(`SELECT image_url FROM ${tg.table} WHERE id = $1`, [tg.rowId]);
      const before = r.rows[0]?.image_url as string | null | undefined;
      const entries = String(before || "").split(",").map((x) => x.trim()).filter(Boolean);
      const entry = splitSectionMedia(before)[tg.index];
      if (!entry || entry.url !== photo) return { ok: false };
      const pair = splitFocusPair(entry.focus);
      const desktop = tg.part === "desktop" ? value : pair.desktop;
      const phone = tg.part === "phone" ? value : pair.phone;
      // The desktop framing is the entry's first part: the page needs one there for a phone one to follow.
      const focus = desktop || phone ? joinFocusPair(desktop ?? "0.5000 0.5000 1.000", phone) : null;
      entries[tg.index] = focus ? `${photo}|${focus}` : photo;
      const w = await pool.query(`UPDATE ${tg.table} SET image_url = $1 WHERE id = $2 AND image_url = $3`, [entries.join(","), tg.rowId, before]);
      return { ok: (w.rowCount ?? 0) > 0 };
    }
    case "photo": {
      if (value === null) {
        await pool.query(`DELETE FROM photo_framing WHERE format = $1 AND url = $2`, [tg.format, photo]);
      } else {
        await pool.query(
          `INSERT INTO photo_framing (format, url, focus) VALUES ($1, $2, $3)
           ON CONFLICT (format, url) DO UPDATE SET focus = EXCLUDED.focus, updated_at = now()`,
          [tg.format, photo, value]
        );
      }
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
