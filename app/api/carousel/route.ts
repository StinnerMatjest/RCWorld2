import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { CAROUSEL_SLUG_RE, carouselHash, countSlides, ensureCarouselTable, isCleanCarousel, loadCarousel } from "@/app/lib/carouselStore";

// Shared drafts and templates for the Instagram carousel review tool
// (editor: app/admin/carousel/route.ts). One row per carousel slug holding the
// clean, self-contained carousel HTML. Templates are rows with is_template = true.
//
// GET    ?list=1                    -> { carousels: [...], templates: [...] }
// GET    ?slug=x                    -> { exists, hash, name, updated_at }
// GET    ?slug=x&v=1                -> { hash }                (editor polls this)
// GET    ?slug=x&raw=1              -> the HTML itself         (local PNG export)
// POST   ?slug=x  body=html         -> { hash }                (save)
// POST   ?slug=x&from=t&name=n      -> { slug }                (new carousel from template t)
// POST   ?slug=x&template=1|0       -> { ok }                  (mark / unmark as template)
// POST   ?slug=x&rename=n           -> { ok }
// DELETE ?slug=x                    -> { ok }
// All reads and writes require the admin cookie (middleware gates non-GET too).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = CAROUSEL_SLUG_RE;
const MAX_BYTES = 3 * 1024 * 1024;

function slugFrom(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  return SLUG_RE.test(slug) ? slug : null;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  const params = req.nextUrl.searchParams;

  if (params.get("list")) {
    await ensureCarouselTable();
    const r = await pool.query<{ slug: string; name: string | null; is_template: boolean; updated_at: string; created_at: string; html: string }>(
      `SELECT slug, name, is_template, updated_at, created_at, html FROM carousel_drafts ORDER BY updated_at DESC`
    );
    const rows = r.rows.map(({ html, ...rest }) => ({ ...rest, slides: countSlides(html) }));
    return NextResponse.json({
      carousels: rows.filter(x => !x.is_template),
      templates: rows.filter(x => x.is_template),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const slug = slugFrom(req);
  if (!slug) return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  const row = await loadCarousel(slug);
  if (!row) return NextResponse.json({ exists: false, hash: null });

  if (params.get("raw")) {
    return new NextResponse(row.html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const hash = carouselHash(row.html);
  if (params.get("v")) return NextResponse.json({ hash }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ exists: true, hash, name: row.name, is_template: row.is_template, updated_at: row.updated_at });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  const params = req.nextUrl.searchParams;
  const slug = slugFrom(req);
  if (!slug) return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  await ensureCarouselTable();

  // new carousel from a template
  const from = params.get("from");
  if (from) {
    if (!SLUG_RE.test(from)) return NextResponse.json({ error: "Bad template slug" }, { status: 400 });
    const tpl = await loadCarousel(from);
    if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    const exists = await loadCarousel(slug);
    if (exists) return NextResponse.json({ error: "A carousel with that name already exists" }, { status: 409 });
    const name = (params.get("name") || slug).slice(0, 120);
    await pool.query(
      `INSERT INTO carousel_drafts (slug, html, name, is_template) VALUES ($1, $2, $3, false)`,
      [slug, tpl.html, name]
    );
    return NextResponse.json({ slug, name });
  }

  // flag changes
  if (params.has("template")) {
    const flag = params.get("template") === "1";
    const r = await pool.query(`UPDATE carousel_drafts SET is_template = $2 WHERE slug = $1`, [slug, flag]);
    return NextResponse.json({ ok: (r.rowCount ?? 0) > 0 });
  }
  if (params.has("rename")) {
    const name = (params.get("rename") || "").trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "Empty name" }, { status: 400 });
    const r = await pool.query(`UPDATE carousel_drafts SET name = $2 WHERE slug = $1`, [slug, name]);
    return NextResponse.json({ ok: (r.rowCount ?? 0) > 0 });
  }

  // save html (create or update)
  const html = await req.text();
  if (html.length > MAX_BYTES) return NextResponse.json({ error: "Carousel HTML too large" }, { status: 413 });
  if (!isCleanCarousel(html)) return NextResponse.json({ error: "Not a clean carousel document" }, { status: 400 });
  const name = params.get("name");
  await pool.query(
    `INSERT INTO carousel_drafts (slug, html, name, is_template) VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET html = EXCLUDED.html, updated_at = now(),
       name = COALESCE(EXCLUDED.name, carousel_drafts.name)`,
    [slug, html, name ? name.slice(0, 120) : null, params.get("template") === "1"]
  );
  return NextResponse.json({ hash: carouselHash(html), bytes: html.length });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  const slug = slugFrom(req);
  if (!slug) return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  await ensureCarouselTable();
  const r = await pool.query(`DELETE FROM carousel_drafts WHERE slug = $1`, [slug]);
  return NextResponse.json({ ok: (r.rowCount ?? 0) > 0 });
}
