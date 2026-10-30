import { pool } from "@/app/lib/db";

/**
 * Each visit can carry its own header photo and crop. A visit without one
 * shows the park's header (parks.imagepath / header_focus), which is how every
 * visit worked before. The park's header follows the newest visit, so the home
 * card, share image and search keep showing the latest trip.
 *
 * A hero has two framings: header_focus for the wide frame (tablet and
 * desktop) and header_focus_mobile for the tall phone frame. A missing phone
 * framing falls back to the wide one, which is how heroes worked before.
 *
 * photo_framing holds framings for formats whose rows editors rewrite
 * (gallery tiles, list images), keyed by format and photo URL so they survive.
 *
 * Columns and the table are added in place; runs once per process.
 */
let ready: Promise<void> | null = null;
export function ensureVisitHeaderColumns(): Promise<void> {
  if (!ready) {
    ready = pool
      .query(`
        ALTER TABLE visits
          ADD COLUMN IF NOT EXISTS header_imagepath TEXT,
          ADD COLUMN IF NOT EXISTS header_focus TEXT,
          ADD COLUMN IF NOT EXISTS header_focus_mobile TEXT;
        ALTER TABLE parks ADD COLUMN IF NOT EXISTS header_focus_mobile TEXT;
        CREATE TABLE IF NOT EXISTS photo_framing (
          format TEXT NOT NULL,
          url TEXT NOT NULL,
          focus TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (format, url)
        );
      `)
      .then(() => undefined)
      .catch((err) => { ready = null; throw err; });
  }
  return ready;
}

/**
 * Formats stored in photo_framing. Position formats hold object-position
 * percentages "x y 1" (photo-break holds "desktop|phone"); coaster-strip holds
 * a focus point "cx cy zoom" for the 4:5 strip card (placeCover).
 */
export type PhotoFramingFormat = "gallery-tile" | "photo-break" | "list-item" | "list-cover" | "coaster-strip";

/** The framings of these photos for one format, by URL. */
export async function photoFramings(format: PhotoFramingFormat, urls: (string | null | undefined)[]): Promise<Record<string, string>> {
  const list = [...new Set(urls.filter((u): u is string => !!u))];
  if (!list.length) return {};
  await ensureVisitHeaderColumns();
  const r = await pool.query(`SELECT url, focus FROM photo_framing WHERE format = $1 AND url = ANY($2::text[])`, [format, list]);
  return Object.fromEntries(r.rows.map((x) => [x.url, x.focus]));
}
