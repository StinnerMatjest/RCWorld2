import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

// Minimal payload powering the navbar search — one small request instead of
// the full endpoints. Cacheable for repeat visitors.
export async function GET() {
  try {
    const [parksRes, coastersRes, manRes] = await Promise.all([
      pool.query(`
        SELECT p.id, p.name, p.country, p.slug, l.overall
        FROM parks p
        INNER JOIN (
          SELECT DISTINCT ON (park_id) park_id, overall
          FROM visits
          WHERE published = TRUE
          ORDER BY park_id, date DESC
        ) l ON l.park_id = p.id
        ORDER BY l.overall DESC NULLS LAST
      `),
      pool.query(`
        SELECT rc.id, rc.name, rc.slug, rc.rating, p.name AS park_name
        FROM rollercoasters rc
        JOIN parks p ON p.id = rc.park_id
        WHERE rc.rating IS NOT NULL AND rc.slug IS NOT NULL
        ORDER BY rc.rating DESC
      `),
      // Only makers with rated coasters: a manufacturer result opens the coaster
      // list filtered to that maker, and the list holds rated coasters only.
      pool.query(`
        SELECT m.id, m.name, COUNT(rc.id)::int AS coasters
        FROM manufacturers m
        JOIN rollercoasters rc ON rc.manufacturer_id = m.id
        WHERE rc.rating > 0
        GROUP BY m.id, m.name
        ORDER BY m.name ASC
      `),
    ]);

    return NextResponse.json(
      {
        parks: parksRes.rows.map(r => ({
          id: r.id, name: r.name, country: r.country, slug: r.slug,
          overall: r.overall == null ? undefined : Number(r.overall),
        })),
        coasters: coastersRes.rows.map(r => ({
          id: r.id, name: r.name, slug: r.slug, parkName: r.park_name,
          rating: r.rating == null ? undefined : Number(r.rating),
        })),
        manufacturers: manRes.rows.map(r => ({
          id: r.id, name: r.name, coasters: r.coasters,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("search-index GET:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}