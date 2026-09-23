import { createHash } from "crypto";
import { pool } from "@/app/lib/db";

// Storage helpers for the Instagram carousel review tool.
// One row per carousel slug holding the clean, self-contained carousel HTML;
// templates are rows with is_template = true. Used by app/api/carousel and
// app/admin/carousel.

export const CAROUSEL_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

export type CarouselRow = {
  html: string;
  name: string | null;
  is_template: boolean;
  updated_at: string;
};

export async function ensureCarouselTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS carousel_drafts (
      slug        TEXT PRIMARY KEY,
      html        TEXT NOT NULL,
      updated_at  TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE carousel_drafts ADD COLUMN IF NOT EXISTS name TEXT`);
  await pool.query(`ALTER TABLE carousel_drafts ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE carousel_drafts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`);
}

export function carouselHash(html: string) {
  return createHash("md5").update(html).digest("hex").slice(0, 12);
}

export async function loadCarousel(slug: string): Promise<CarouselRow | null> {
  await ensureCarouselTable();
  const r = await pool.query<CarouselRow>(
    `SELECT html, name, is_template, updated_at FROM carousel_drafts WHERE slug = $1`,
    [slug]
  );
  return r.rows[0] ?? null;
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Slides inside the carousel track only; prototypes kept in
// <template id="slide-prototypes"> for the "add slide" menu do not count.
export function countSlides(html: string) {
  const start = html.indexOf('class="carousel-track"');
  if (start < 0) return 0;
  const body = html.slice(start).replace(/<template id="slide-prototypes">[\s\S]*?<\/template>/, "");
  return (body.match(/<div class="slide[ "]/g) || []).length;
}

export function isCleanCarousel(html: string) {
  return html.includes('class="carousel-track"') && !html.includes('id="editor-js"');
}
