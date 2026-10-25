import { pool } from "@/app/lib/db";

/**
 * Each visit can carry its own header photo and crop. A visit without one
 * shows the park's header (parks.imagepath / header_focus), which is how every
 * visit worked before. The park's header follows the newest visit, so the home
 * card, share image and search keep showing the latest trip.
 *
 * Columns are added in place; runs once per process.
 */
let ready: Promise<void> | null = null;
export function ensureVisitHeaderColumns(): Promise<void> {
  if (!ready) {
    ready = pool
      .query(`ALTER TABLE visits
              ADD COLUMN IF NOT EXISTS header_imagepath TEXT,
              ADD COLUMN IF NOT EXISTS header_focus TEXT`)
      .then(() => undefined)
      .catch((err) => { ready = null; throw err; });
  }
  return ready;
}
