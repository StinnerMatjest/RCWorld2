import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

// Every published rating is a dated park visit — powers the /about timeline.
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        r.id                       AS "ratingId",
        r.date,
        r.overall,
        p.id                       AS "parkId",
        p.name,
        p.country,
        p.slug,
        p.imagepath,
        p.header_focus             AS "headerFocus",
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY r.date ASC)::int AS "visitNumber",
        COUNT(*)    OVER (PARTITION BY p.id)::int                      AS "totalVisits"
      FROM ratings r
      JOIN parks p ON p.id = r.park_id
      WHERE r.published = TRUE AND r.date IS NOT NULL
      ORDER BY r.date DESC, r.id DESC
    `);
    return NextResponse.json(
      { visits: result.rows },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("visits GET:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
